#!/usr/bin/env node
/**
 * Generates register files for ioBroker.modbus from the inverter definitions of ha-solarman
 * (https://github.com/davidrapan/ha-solarman, MIT, (c) David Rapan and contributors).
 *
 * Usage:
 *   node scripts/solarman.mjs <definition.yaml | name> [--out <dir>]
 *
 * `name` is the file name in custom_components/solarman/inverter_definitions without ".yaml" (e.g. "deye_p3"),
 * it is downloaded then. Without --out only a summary is printed.
 *
 * One file per function code is written: holding-registers.tsv (0x03) and input-registers.tsv (0x04).
 * The addresses are raw.
 *
 * How the definitions are converted (see parser.py of ha-solarman):
 * - `registers` lists the low word first: [a, a+1] is uint32sw, [a+1, a] is uint32be
 * - value = ((raw & mask) - offset) * scale, then // divide. Without mask/bit/divide this is factor and offset,
 *   otherwise a formula (the adapter passes the raw value as x to the formula and ignores factor and offset then)
 * - rule 1/3 unsigned, 2/4 signed, 5 text, 6 bits, 7 version (hex), 8 date and time (hex), 9 time (HHMM), 10 raw
 * - `lookup` is written to the description, `validation` min/max to minValidValue/maxValidValue
 * - computed values (rule 0, `sensors`) cannot be read from a register and are left out
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';

const REPOSITORY_URL = 'https://raw.githubusercontent.com/davidrapan/ha-solarman';
const DEFINITIONS_PATH = 'custom_components/solarman/inverter_definitions';

const COLUMNS = {
    holdingRegs: [
        '_address', 'name', 'description', 'unit', 'type', 'len', 'factor', 'offset', 'formula', 'role', 'room',
        'poll', 'wp', 'cw', 'isScale', 'sanitize', 'sanitizeAction', 'minValidValue', 'maxValidValue',
    ],
    inputRegs: [
        '_address', 'name', 'description', 'unit', 'type', 'len', 'factor', 'offset', 'formula', 'role', 'room',
        'cw', 'isScale', 'sanitize', 'sanitizeAction', 'minValidValue', 'maxValidValue',
    ],
};
export const FILE_NAMES = { holdingRegs: 'holding-registers.tsv', inputRegs: 'input-registers.tsv' };
const CODES = { 3: 'holdingRegs', 4: 'inputRegs' };
const ALIAS_OFFSET = { holdingRegs: 40001, inputRegs: 30001 };

/** Avoids 1000 * 0.1 = 100.00000000000001 */
const round = n => Number(n.toPrecision(12));
/** Numbers are written with a decimal comma, as the adapter exports them */
const num = n => String(round(n)).replace('.', ',');
const hex = n => `0x${n.toString(16).toUpperCase()}`;

function readCode(value) {
    if (value && typeof value === 'object') {
        return value.read;
    }
    return value;
}

function describeLookup(lookup) {
    if (!Array.isArray(lookup)) {
        return '';
    }
    return lookup
        .map(entry => {
            const keys = Array.isArray(entry.key) ? entry.key : [entry.key];
            return `${keys.join('/')}=${entry.value}`;
        })
        .join(', ');
}

function bounds(validation) {
    const min = validation?.min;
    const max = validation?.max;
    return {
        min: typeof min === 'number' ? min : undefined,
        max: typeof max === 'number' ? max : undefined,
    };
}

/**
 * Some values differ between the models of a definition (e.g. `scale: [0.01, 0.1]` for LV and HV batteries).
 * ha-solarman takes the element of the configured "mod" or the last one, as `unwrap` in common.py.
 *
 * @returns {{ item: object, variants: boolean }}
 */
function unwrap(item, mod) {
    let variants = false;
    const pick = value => {
        variants = true;
        return mod < value.length ? value[mod] : value[value.length - 1];
    };
    const modify = source => {
        const result = { ...source };
        for (const [key, value] of Object.entries(source)) {
            if (['scale', 'min', 'max', 'default', 'step'].includes(key) && Array.isArray(value)) {
                result[key] = pick(value);
            } else if (key === 'registers' && Array.isArray(value) && Array.isArray(value[0])) {
                result[key] = pick(value);
            } else if (value && typeof value === 'object' && !Array.isArray(value)) {
                result[key] = modify(value);
            }
        }
        return result;
    };
    const result = modify(item);
    return { item: result, variants };
}

function role(item, type) {
    if (type === 'string' || type === 'stringle' || type === 'rawhex') {
        return 'state';
    }
    const writable = item.configurable !== undefined || ['number', 'select', 'switch', 'time', 'datetime'].includes(item.platform);
    if (item.class === 'temperature') {
        return writable ? 'level.temperature' : 'value.temperature';
    }
    if (item.class === 'battery' && !writable) {
        return 'value.battery';
    }
    return writable ? 'level' : 'value';
}

/**
 * Data type and start address from the list of registers.
 *
 * @returns {{ address: number, type: string, len: number } | { error: string }}
 */
function layout(item) {
    const regs = item.registers;
    const n = regs.length;
    const ascending = regs.every((r, i) => i === 0 || r === regs[i - 1] + 1);
    const descending = regs.every((r, i) => i === 0 || r === regs[i - 1] - 1);
    const start = Math.min(...regs);
    const signed = item.rule === 2 || item.rule === 4;

    switch (item.rule) {
        case 1:
        case 2:
        case 3:
        case 4:
            if (n === 1) {
                return { address: start, type: signed ? 'int16be' : 'uint16be', len: 1 };
            }
            if (n === 2 && ascending) {
                return { address: start, type: signed ? 'int32sw' : 'uint32sw', len: 2 };
            }
            if (n === 2 && descending) {
                return { address: start, type: signed ? 'int32be' : 'uint32be', len: 2 };
            }
            if (n === 4 && descending) {
                return { address: start, type: signed ? 'int64be' : 'uint64be', len: 4 };
            }
            // e.g. the power of the large Deye models: low word in one block, high word in another one.
            // The adapter cannot combine them, the low word alone is right up to 32767 (signed) or 65535.
            if (n === 2) {
                return {
                    address: regs[0],
                    type: signed ? 'int16be' : 'uint16be',
                    len: 1,
                    note: `low word only, the high word for values above ${signed ? 32767 : 65535} is in register ${regs[1]} (${hex(regs[1])})`,
                };
            }
            return { error: `${n} registers in the order ${regs.map(hex).join(', ')} are not supported` };
        case 5:
            if (!ascending) {
                return { error: 'text in registers that do not follow each other' };
            }
            return { address: start, type: item.reverse_bytes !== undefined ? 'stringle' : 'string', len: n };
        case 6:
            if (n === 1) {
                return { address: start, type: 'uint16be', len: 1 };
            }
            return ascending ? { address: start, type: 'rawhex', len: n } : { error: 'bits in registers that do not follow each other' };
        case 7:
        case 8:
        case 10:
            return ascending ? { address: start, type: 'rawhex', len: n } : { error: 'registers that do not follow each other' };
        case 9:
            return n === 1 ? { address: start, type: 'uint16be', len: 1 } : { error: 'time in several registers' };
        default:
            return { error: `rule ${item.rule} is not supported` };
    }
}

/**
 * Converts the parsed YAML of a definition.
 *
 * @returns {{ files: Record<string, Record<string, string>[]>, warnings: string[], skipped: number }}
 */
export function convertDefinition(definition, options = {}) {
    const mod = options.mod ?? 0;
    const warnings = [];
    const variantNames = [];
    const files = { holdingRegs: [], inputRegs: [] };
    const defaultCode = readCode(definition.default?.code) ?? 3;
    const requests = (definition.requests || []).map(r => ({
        start: r.start,
        end: r.end,
        code: readCode(r.code ?? r.mb_functioncode),
    }));
    const names = new Set();
    const lowWordOnly = [];
    let skipped = 0;

    for (const group of definition.parameters || []) {
        for (const original of group.items || []) {
            const { item, variants } = unwrap(original, mod);
            const label = `${group.group}/${item.name}`;
            if (variants) {
                variantNames.push(item.name);
            }
            if (!item.registers?.length || !item.rule || item.sensors) {
                skipped++;
                continue;
            }
            const result = layout(item);
            if ('error' in result) {
                warnings.push(`${label}: ${result.error}, left out`);
                skipped++;
                continue;
            }
            const start = Math.min(...item.registers);
            const code =
                readCode(item.code) ?? requests.find(r => start >= r.start && start <= r.end)?.code ?? defaultCode;
            const regType = CODES[code];
            if (!regType) {
                warnings.push(`${label}: function code ${code} is not supported, left out`);
                skipped++;
                continue;
            }

            let factor = '1';
            let offset = '0';
            let formula = '';
            const numeric = item.rule >= 1 && item.rule <= 4;
            if (numeric) {
                const scale = item.scale ?? 1;
                const off = item.offset ?? 0;
                if (item.magnitude) {
                    if (result.len !== 1) {
                        warnings.push(`${label}: "magnitude" with more than one register, left out`);
                        skipped++;
                        continue;
                    }
                    // sign and magnitude: read unsigned, bit 15 is the sign
                    result.type = 'uint16be';
                }
                let x = item.magnitude ? '(x & 0x8000 ? -(x & 0x7FFF) : x)' : 'x';
                if (item.mask !== undefined) {
                    x = `(x & ${hex(item.mask)})`;
                }
                if (item.bit !== undefined) {
                    x = `((x >> ${item.bit}) & 1)`;
                }
                if (item.bitmask !== undefined) {
                    x = `Math.floor((x & ${hex(item.bitmask)}) / ${item.bitmask})`;
                }
                if (x === 'x' && item.divide === undefined) {
                    factor = num(scale);
                    offset = num(-off * scale);
                } else {
                    let expression = off ? `(${x} - ${off})` : x;
                    if (scale !== 1) {
                        expression = `${expression} * ${round(scale)}`;
                    }
                    if (item.divide !== undefined) {
                        expression = `Math.floor(${expression} / ${item.divide})`;
                    }
                    formula = expression;
                }
                if (item.uint !== undefined) {
                    formula = `Math.max(0, ${formula || (factor === '1' && offset === '0' ? 'x' : `x * ${factor.replace(',', '.')} + ${offset.replace(',', '.')}`)})`;
                }
            }

            let description = item.description || '';
            if (item.lookup) {
                description = [description, describeLookup(item.lookup)].filter(Boolean).join(': ');
            }
            if (result.note) {
                description = [description, result.note].filter(Boolean).join(', ');
                lowWordOnly.push(item.name);
            }
            if (item.rule === 9) {
                description = [description, 'time as HHMM'].filter(Boolean).join(', ');
            }

            // an empty name gives the entity the name of the device in Home Assistant (e.g. the on/off switch)
            let name = String(item.name ?? '').trim() || `${group.group} ${item.platform || 'state'}`;
            if (names.has(`${regType}/${name}`)) {
                name = `${name} (${group.group})`;
            }
            if (names.has(`${regType}/${name}`)) {
                warnings.push(`${label}: name is used twice`);
            }
            names.add(`${regType}/${name}`);

            const { min, max } = bounds(item.validation);
            const sanitize = numeric && (min !== undefined || max !== undefined);
            files[regType].push({
                _address: String(result.address),
                name,
                description,
                unit: item.uom || '',
                type: result.type,
                len: String(result.len),
                factor,
                offset,
                formula,
                role: role(item, result.type),
                room: '',
                poll: 'true',
                wp: 'false',
                cw: 'false',
                isScale: 'false',
                sanitize: sanitize ? 'true' : 'false',
                sanitizeAction: sanitize ? 'keepLastValid' : '',
                minValidValue: sanitize && min !== undefined ? String(round(min)) : '',
                maxValidValue: sanitize && max !== undefined ? String(round(max)) : '',
            });
        }
    }

    for (const rows of Object.values(files)) {
        rows.sort((a, b) => a._address - b._address);
    }
    if (lowWordOnly.length) {
        warnings.push(
            `${lowWordOnly.length} values have the high word in another register, only the low word is read: ${lowWordOnly.slice(0, 5).join(', ')}${lowWordOnly.length > 5 ? ', ...' : ''}`,
        );
    }
    if (variantNames.length) {
        warnings.push(
            `${variantNames.length} values differ between the models of the definition, mod ${mod} is used (--mod): ${variantNames.slice(0, 5).join(', ')}${variantNames.length > 5 ? ', ...' : ''}`,
        );
    }
    return { files, warnings, skipped };
}

function cell(value) {
    const text = String(value ?? '');
    return /[\t\r\n"]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toTsv(rows, regType) {
    const columns = COLUMNS[regType];
    return [columns.join('\t'), ...rows.map(row => columns.map(c => cell(row[c])).join('\t'))].join('\n') + '\n';
}

/** The comment at the top of a definition (models, data sheet), for the README of the device */
export function headerComment(text) {
    const lines = [];
    for (const line of text.split(/\r?\n/)) {
        if (!line.startsWith('#')) {
            break;
        }
        const content = line.replace(/^#\s?/, '').trim();
        if (content) {
            lines.push(content);
        }
    }
    return lines;
}

/**
 * Text of a definition: a local file, or the name in ha-solarman (e.g. "deye_p3"), downloaded from the branch, tag or
 * commit `ref` (default "main").
 */
export async function loadDefinitionText(nameOrPath, ref = 'main') {
    if (/\.ya?ml$/i.test(nameOrPath) && existsSync(nameOrPath)) {
        return readFileSync(nameOrPath, 'utf8');
    }
    const name = nameOrPath.replace(/\.ya?ml$/i, '');
    if (!/^[\w.-]+$/.test(name) || !/^[\w./-]+$/.test(ref)) {
        throw new Error(`Invalid definition "${nameOrPath}" or ref "${ref}"`);
    }
    const res = await fetch(`${REPOSITORY_URL}/${ref}/${DEFINITIONS_PATH}/${name}.yaml`);
    if (!res.ok) {
        throw new Error(`ha-solarman definition ${name}@${ref}: HTTP ${res.status}`);
    }
    return res.text();
}

async function main(argv) {
    const args = argv.slice(2);
    const option = name => {
        const i = args.indexOf(name);
        return i === -1 ? undefined : args.splice(i, 2)[1];
    };
    const out = option('--out');
    const mod = parseInt(option('--mod') ?? '0', 10);
    if (args.length !== 1 || Number.isNaN(mod)) {
        console.error('Usage: node scripts/solarman.mjs <definition.yaml | name> [--out <dir>] [--mod <n>]');
        process.exit(1);
    }
    const text = existsSync(args[0]) ? readFileSync(args[0], 'utf8') : await loadDefinitionText(args[0]);
    const definition = YAML.parse(text);
    const { files, warnings, skipped } = convertDefinition(definition, { mod });
    warnings.forEach(w => console.error(`warning: ${w}`));
    headerComment(text).forEach(line => console.error(`# ${line}`));
    const ambiguous = [];
    for (const [regType, rows] of Object.entries(files)) {
        if (!rows.length) {
            continue;
        }
        if (out) {
            mkdirSync(out, { recursive: true });
            writeFileSync(join(out, FILE_NAMES[regType]), toTsv(rows, regType));
        }
        console.error(`${FILE_NAMES[regType]}: ${rows.length} registers${out ? ` written to ${out}` : ''}`);
        // with no address below the alias offset the adapter cannot know that the addresses are raw
        if (Math.min(...rows.map(r => parseInt(r._address, 10))) >= ALIAS_OFFSET[regType]) {
            ambiguous.push(FILE_NAMES[regType]);
        }
    }
    if (ambiguous.length) {
        const files = Object.fromEntries(ambiguous.map(f => [f, { addressing: 'raw' }]));
        console.error(`Add to template.json: ${JSON.stringify({ files })}`);
    }
    console.error(`${skipped} computed or unsupported values left out`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
    main(process.argv).catch(e => {
        console.error(e.message);
        process.exit(1);
    });
}
