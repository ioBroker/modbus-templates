#!/usr/bin/env node
/**
 * Generates a register file for ioBroker.modbus from the official SunSpec model definitions.
 *
 * The models come from https://github.com/sunspec/models (Apache-2.0, (c) SunSpec Alliance). Where each model starts is
 * device specific, so it is given in a small layout file:
 *
 * {
 *     "marker": 40000,                                   // optional: address of "SunS", adds this register
 *     "models": [
 *         { "id": 1, "address": 40002 },                 // address of the "ID" register of the model
 *         { "id": 103, "address": 40069 },
 *         { "id": 1, "address": 40121, "prefix": "M1_" },
 *         { "id": 203, "address": 40188, "prefix": "M1_" },
 *         { "id": 160, "address": 40300, "repeat": { "module": 2 } }
 *     ]
 * }
 *
 * - `prefix` is put in front of every name, so a model can be used several times (e.g. 2 meters)
 * - `repeat` gives the number of repetitions of a repeating group (e.g. the MPPT modules), default 1
 * - `skip` is a list of point names that are left out (e.g. ["Pad"]); `ID` and `L` are kept
 *
 * Usage:
 *   node scripts/sunspec.mjs <layout.json> [--out <file.tsv>] [--models <dir with model_N.json>]
 *
 * The addresses are raw (as on the wire), so set `"addressing": "raw"` in template.json if no address is below 40001.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const MODELS_URL = 'https://raw.githubusercontent.com/sunspec/models/master/json';

export const COLUMNS = [
    '_address', 'name', 'description', 'unit', 'type', 'len', 'factor', 'offset', 'formula',
    'role', 'room', 'poll', 'wp', 'cw', 'isScale',
];

/** SunSpec point type -> data type of ioBroker.modbus (SunSpec is always big endian) */
const TYPES = {
    uint16: 'uint16be',
    enum16: 'uint16be',
    bitfield16: 'uint16be',
    acc16: 'uint16be',
    count: 'uint16be',
    int16: 'int16be',
    sunssf: 'int16be',
    uint32: 'uint32be',
    enum32: 'uint32be',
    bitfield32: 'uint32be',
    acc32: 'uint32be',
    ipaddr: 'uint32be',
    int32: 'int32be',
    float32: 'floatbe',
    uint64: 'uint64be',
    acc64: 'uint64be',
    bitfield64: 'uint64be',
    int64: 'int64be',
    float64: 'doublebe',
    string: 'string',
};

/** The names of the scale factors are only unique inside a group and its parents */
function findScale(scopes, name) {
    for (let i = scopes.length - 1; i >= 0; i--) {
        if (scopes[i].has(name)) {
            return scopes[i].get(name);
        }
    }
    return undefined;
}

function describe(point) {
    let text = point.desc || point.label || '';
    if (point.label && point.desc && !point.desc.toLowerCase().startsWith(point.label.toLowerCase())) {
        text = `${point.label}: ${point.desc}`;
    }
    if (point.symbols?.length && point.type.startsWith('enum')) {
        text += ` (${point.symbols.map(s => `${s.value}=${s.name}`).join(', ')})`;
    }
    return text;
}

/**
 * Converts one SunSpec model to rows of the TSV.
 *
 * @param {object} model the parsed model_N.json
 * @param {number} address address of the "ID" register
 * @param {{ prefix?: string, repeat?: Record<string, number>, skip?: string[] }} [options]
 * @returns {{ rows: Record<string, string>[], end: number, warnings: string[] }} end is the first address after the model
 */
export function convertModel(model, address, options = {}) {
    const prefix = options.prefix || '';
    const repeat = options.repeat || {};
    const skip = new Set(options.skip || []);
    const rows = [];
    const warnings = [];
    const scopes = [];

    const walk = (group, namePrefix) => {
        // first pass: addresses of the scale factors of this group
        const scales = new Map();
        let a = address;
        for (const point of group.points) {
            if (point.type === 'sunssf') {
                scales.set(point.name, a);
            }
            a += point.size;
        }
        scopes.push(scales);

        for (const point of group.points) {
            const start = address;
            address += point.size;
            if (point.type === 'pad' || skip.has(point.name)) {
                continue;
            }
            const type = TYPES[point.type];
            const row = {
                _address: String(start),
                name: `${prefix}${namePrefix}${point.name}`,
                description: describe(point),
                unit: point.units || '',
                type: type || 'rawhex',
                len: String(point.size),
                factor: '1',
                offset: '0',
                formula: '',
                role: point.type === 'string' || !type ? 'state' : point.access === 'RW' ? 'level' : 'value',
                room: '',
                poll: 'true',
                wp: 'false',
                cw: 'false',
                isScale: point.type === 'sunssf' ? 'true' : 'false',
            };
            if (!type) {
                warnings.push(`${row.name}: type "${point.type}" is read as raw hex`);
            }
            if (point.sf !== undefined && point.sf !== '') {
                const fixed = Number(point.sf);
                if (Number.isInteger(fixed)) {
                    // a fixed scale factor
                    row.factor = String(10 ** fixed).replace('.', ',');
                } else {
                    const sfAddress = findScale(scopes, point.sf);
                    if (sfAddress === undefined) {
                        warnings.push(`${row.name}: scale factor "${point.sf}" not found`);
                    } else {
                        row.formula = `x * Math.pow(10, sf['${sfAddress}'])`;
                    }
                }
            }
            rows.push(row);
        }

        for (const sub of group.groups || []) {
            // count: 1 or missing = once, 0 or the name of a point = repeating, the number comes from the layout
            const fixedCount = typeof sub.count === 'number' && sub.count > 0 ? sub.count : undefined;
            const count = repeat[sub.name] ?? fixedCount ?? 1;
            const repeating = fixedCount !== 1 && (sub.count !== undefined || repeat[sub.name] !== undefined);
            if (sub.count !== undefined && fixedCount === undefined && repeat[sub.name] === undefined) {
                warnings.push(`Repeating group "${sub.name}" of model ${model.id}: set "repeat": { "${sub.name}": N }, 1 is used`);
            }
            for (let i = 1; i <= count; i++) {
                walk(sub, repeating ? `${namePrefix}${sub.name}${i}_` : namePrefix);
            }
        }
        scopes.pop();
    };

    walk(model.group, '');
    // skipped points at the end (e.g. "Pad" of model 1, which older devices do not have) do not belong to the model
    const last = rows[rows.length - 1];
    const end = last ? parseInt(last._address, 10) + parseInt(last.len, 10) : address;
    return { rows, end, warnings };
}

/** Quotes a value for TSV if needed (like Excel and the adapter do) */
function cell(value) {
    const text = String(value ?? '');
    return /[\t\r\n"]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toTsv(rows) {
    return [COLUMNS.join('\t'), ...rows.map(row => COLUMNS.map(c => cell(row[c])).join('\t'))].join('\n') + '\n';
}

/**
 * Converts a whole layout.
 *
 * @param {object} layout see the description at the top of the file
 * @param {(id: number) => object | Promise<object>} loadModel returns the parsed model_N.json
 */
export async function convertLayout(layout, loadModel) {
    const rows = [];
    const warnings = [];
    if (layout.marker !== undefined) {
        rows.push({
            ...Object.fromEntries(COLUMNS.map(c => [c, ''])),
            _address: String(layout.marker),
            name: 'SunSpec_ID',
            description: 'SunSpec marker "SunS"',
            type: 'string',
            len: '2',
            factor: '1',
            offset: '0',
            role: 'state',
            poll: 'false',
            wp: 'false',
            cw: 'false',
            isScale: 'false',
        });
    }
    let lastEnd;
    for (const entry of layout.models || []) {
        if (typeof entry.id !== 'number' || typeof entry.address !== 'number') {
            throw new Error(`Every model needs a numeric "id" and "address": ${JSON.stringify(entry)}`);
        }
        if (lastEnd !== undefined && entry.address < lastEnd) {
            warnings.push(`Model ${entry.id} at ${entry.address} overlaps with the model before (ends at ${lastEnd - 1})`);
        }
        const model = await loadModel(entry.id);
        const result = convertModel(model, entry.address, entry);
        rows.push(...result.rows);
        warnings.push(...result.warnings);
        lastEnd = result.end;
    }
    const names = new Set();
    for (const row of rows) {
        if (names.has(row.name)) {
            warnings.push(`Name "${row.name}" is used twice, set a "prefix" for one of the models`);
        }
        names.add(row.name);
    }
    return { rows, warnings };
}

/**
 * Returns `async id => model`: from `modelsDir/model_N.json` if there, otherwise downloaded from sunspec/models.
 * Every model is loaded only once.
 */
export function createModelLoader(modelsDir) {
    const cache = new Map();
    return id => {
        if (!cache.has(id)) {
            const local = modelsDir && join(modelsDir, `model_${id}.json`);
            cache.set(
                id,
                local && existsSync(local)
                    ? Promise.resolve(JSON.parse(readFileSync(local, 'utf8')))
                    : fetch(`${MODELS_URL}/model_${id}.json`).then(res => {
                          if (!res.ok) {
                              throw new Error(`SunSpec model ${id}: HTTP ${res.status}`);
                          }
                          return res.json();
                      }),
            );
        }
        return cache.get(id);
    };
}

async function main(argv) {
    const args = argv.slice(2);
    const option = name => {
        const i = args.indexOf(name);
        if (i === -1) {
            return undefined;
        }
        const [, value] = args.splice(i, 2);
        return value;
    };
    const out = option('--out');
    const modelsDir = option('--models');
    if (args.length !== 1) {
        console.error('Usage: node scripts/sunspec.mjs <layout.json> [--out <file.tsv>] [--models <dir>]');
        process.exit(1);
    }
    const layout = JSON.parse(readFileSync(args[0], 'utf8'));
    const { rows, warnings } = await convertLayout(layout, createModelLoader(modelsDir));
    warnings.forEach(w => console.error(`warning: ${w}`));
    const tsv = toTsv(rows);
    if (out) {
        writeFileSync(out, tsv);
        console.error(`${rows.length} registers written to ${out}`);
    } else {
        process.stdout.write(tsv);
    }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
    main(process.argv).catch(e => {
        console.error(e.message);
        process.exit(1);
    });
}
