#!/usr/bin/env node
/**
 * Validator and index builder for ioBroker/modbus-templates.
 *
 * Usage:
 *   node scripts/templates.mjs validate [file ...]   check all TSV files (or only the given ones)
 *   node scripts/templates.mjs build                 write templates.json (index for ioBroker.modbus)
 *   node scripts/templates.mjs check                 validate + fail if templates.json is not up to date
 *
 * Options:
 *   --strict        treat warnings as errors
 *   --quiet         print only errors
 *   --json          print the validation result as JSON
 *
 * No dependencies, needs Node.js >= 18.
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, relative, sep, posix, extname, basename, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const INDEX_FILE = 'templates.json';
const MANIFEST_FILE = 'template.json';
const CATEGORIES_FILE = 'categories.json';
const FORMAT_VERSION = 1;
const REPOSITORY = 'ioBroker/modbus-templates';
const BRANCH = 'main';

// ---------------------------------------------------------------------------------------------------------------------
// Knowledge about ioBroker.modbus (keep in sync with src-admin/src/data/*.json of the adapter)

/** Data types and the number of 16-bit registers they occupy (0 = variable, defined by "len") */
const TYPE_LENGTH = {
    uint16be: 1,
    uint16le: 1,
    int16be: 1,
    int16le: 1,
    uint8be: 1,
    uint8le: 1,
    int8be: 1,
    int8le: 1,
    signExtendedInt8be: 1,
    signExtendedInt8le: 1,
    uint32be: 2,
    uint32le: 2,
    uint32sw: 2,
    uint32sb: 2,
    int32be: 2,
    int32le: 2,
    int32sw: 2,
    int32sb: 2,
    floatbe: 2,
    floatle: 2,
    floatsw: 2,
    floatsb: 2,
    uint64be: 4,
    uint64le: 4,
    int64be: 4,
    int64le: 4,
    uint64bestr: 4,
    uint64lestr: 4,
    int64bestr: 4,
    int64lestr: 4,
    doublebe: 4,
    doublele: 4,
    string: 0,
    stringle: 0,
    string16: 0,
    string16le: 0,
    rawhex: 0,
};

/** Roles offered by the select box in the admin GUI. Others work, but are shown empty in the GUI. */
const GUI_ROLES = new Set([
    '',
    'value',
    'level',
    'state',
    'switch',
    'value.temperature',
    'value.humidity',
    'value.brightness',
    'value.uv',
    'value.pressure',
    'value.battery',
    'value.valve',
    'value.time',
    'value.interval',
    'value.window',
    'button',
    'indicator',
    'level.dimmer',
    'level.valve',
    'level.blind',
    'level.temperature',
    'level.interval',
    'value.power.consumption',
]);

const BOOLEAN_COLUMNS = ['poll', 'wp', 'cw', 'isScale', 'sanitize'];
const SANITIZE_ACTIONS = ['', 'keepLastValid', 'replaceWithZero'];

/** Columns that the adapter exports per register type (deviceId is added in multi-device mode) */
const REGISTER_TYPES = {
    disInputs: ['_address', 'name', 'description', 'formula', 'role', 'room', 'cw', 'isScale'],
    coils: ['_address', 'name', 'description', 'formula', 'role', 'room', 'poll', 'wp', 'cw', 'isScale'],
    inputRegs: [
        '_address', 'name', 'description', 'unit', 'type', 'len', 'factor', 'offset', 'formula', 'role', 'room',
        'cw', 'isScale', 'sanitize', 'sanitizeAction', 'minValidValue', 'maxValidValue',
    ],
    holdingRegs: [
        '_address', 'name', 'description', 'unit', 'type', 'len', 'factor', 'offset', 'formula', 'role', 'room',
        'poll', 'wp', 'cw', 'isScale', 'sanitize', 'sanitizeAction', 'minValidValue', 'maxValidValue',
    ],
};
/** Offsets added to the addresses if "Show aliases" is enabled in the adapter (e.g. 40001 for holding registers) */
const ALIAS_OFFSET = { coils: 1, disInputs: 10001, inputRegs: 30001, holdingRegs: 40001 };
const KNOWN_COLUMNS = new Set(['deviceId', ...Object.values(REGISTER_TYPES).flat()]);
const REQUIRED_COLUMNS = ['_address', 'name'];

/** Derive the register type from the file path (file name and sub folders) */
function registerTypeFromPath(relPath) {
    const p = relPath.toLowerCase().replace(/[_\s]+/g, '-');
    if (/discrete-?inputs?|dis-?inputs?|diskrete-?eing/.test(p)) {
        return 'disInputs';
    }
    if (/coils?\b|coils?\/|discrete-?outputs?|diskrete-?ausg/.test(p)) {
        return 'coils';
    }
    if (/holding|halte/.test(p)) {
        return 'holdingRegs';
    }
    if (/input|eingang/.test(p)) {
        return 'inputRegs';
    }
    return null;
}

/** Derive the register type from the columns, like the adapter exports them */
function registerTypeFromHeader(header) {
    const has = name => header.includes(name);
    if (!has('type')) {
        return has('poll') || has('wp') ? 'coils' : 'disInputs';
    }
    return has('poll') || has('wp') ? 'holdingRegs' : 'inputRegs';
}

// ---------------------------------------------------------------------------------------------------------------------
// TSV parser, identical in behaviour to the "tsv-json" package used by the adapter GUI

export function parseTsv(text) {
    const rows = [];
    let row = [];
    let cell = '';
    let i = 0;
    const len = text.length;
    while (i < len) {
        // start of a cell
        if (text[i] === '"') {
            i++;
            while (i < len) {
                if (text[i] === '"') {
                    if (text[i + 1] === '"') {
                        cell += '"';
                        i += 2;
                        continue;
                    }
                    i++;
                    break;
                }
                cell += text[i++];
            }
        }
        // raw part until \t or \n
        while (i < len && text[i] !== '\t' && text[i] !== '\n' && !(text[i] === '\r' && text[i + 1] === '\n')) {
            cell += text[i++];
        }
        row.push(cell);
        cell = '';
        if (i >= len) {
            rows.push(row);
            break;
        }
        if (text[i] === '\t') {
            i++;
            if (i >= len) {
                row.push('');
                rows.push(row);
            }
            continue;
        }
        // end of line
        i += text[i] === '\r' ? 2 : 1;
        rows.push(row);
        row = [];
    }
    return rows;
}

// ---------------------------------------------------------------------------------------------------------------------
// helpers

const isInteger = v => /^-?\d+$/.test(v);
const isNumber = v => /^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(v);

function parseAddress(v) {
    if (/^0x[0-9a-f]+$/i.test(v)) {
        return parseInt(v, 16);
    }
    if (/^\d+$/.test(v)) {
        return parseInt(v, 10);
    }
    return NaN;
}

function toPosix(p) {
    return p.split(sep).join(posix.sep);
}

function walk(dir, list = []) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'scripts') {
            continue;
        }
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
            walk(full, list);
        } else {
            list.push(toPosix(relative(ROOT, full)));
        }
    }
    return list;
}

function readJson(relPath, issues) {
    try {
        return JSON.parse(readFileSync(join(ROOT, relPath), 'utf8'));
    } catch (e) {
        issues.push({ file: relPath, level: 'error', message: `Cannot parse JSON: ${e.message}` });
        return null;
    }
}

/** "Category/Device/sub/file.tsv" -> { category, device, devicePath, inner } */
function splitPath(relPath) {
    const parts = relPath.split('/');
    if (parts.length >= 3) {
        return {
            category: parts[0],
            device: parts[1],
            devicePath: `${parts[0]}/${parts[1]}`,
            inner: parts.slice(2).join('/'),
        };
    }
    if (parts.length === 2) {
        const device = basename(parts[1], extname(parts[1]));
        return { category: parts[0], device, devicePath: `${parts[0]}/${device}`, inner: parts[1] };
    }
    return { category: null, device: null, devicePath: null, inner: relPath };
}

// ---------------------------------------------------------------------------------------------------------------------
// validation of one file

/**
 * @returns {{ kind: 'registers' | 'table' | 'invalid', registerType?: string, header?: string[], rows?: string[][], issues: object[] }}
 */
export function validateFile(relPath, buffer, manifestEntry) {
    const issues = [];
    const add = (level, message, line) => issues.push({ file: relPath, line, level, message });

    // --- encoding
    let text;
    try {
        text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    } catch {
        add('error', 'File is not UTF-8 encoded (umlauts will be broken). Save it as UTF-8.');
        text = new TextDecoder('latin1').decode(buffer);
    }
    if (text.charCodeAt(0) === 0xfeff) {
        text = text.slice(1);
        add('warning', 'File starts with a byte order mark (BOM)');
    }

    const rows = parseTsv(text);
    // line numbers: count physical lines per row (quoted cells may contain line breaks)
    const lineOfRow = [];
    {
        let line = 1;
        for (const r of rows) {
            lineOfRow.push(line);
            line += 1 + r.reduce((n, c) => n + (c.match(/\n/g)?.length || 0), 0);
        }
    }

    const isEmptyRow = r => r.every(c => c.trim() === '');
    let headerIndex = rows.findIndex(r => !isEmptyRow(r));
    if (headerIndex === -1) {
        add('error', 'File is empty');
        return { kind: 'invalid', issues };
    }
    if (headerIndex > 0) {
        add('warning', `${headerIndex} empty line(s) before the header. The TSV import of the adapter fails on them.`);
    }
    const header = rows[headerIndex].map(h => h.trim());
    // trailing empty header cells (Excel)
    while (header.length && header[header.length - 1] === '') {
        header.pop();
    }

    if (header[0] !== '_address') {
        if (manifestEntry?.registerType) {
            add('error', `Header must start with "_address", found "${header[0]}"`, lineOfRow[headerIndex]);
            return { kind: 'invalid', issues };
        }
        // a documentation table (e.g. error codes), not an ioBroker.modbus export
        add('info', 'Not a register export (header does not start with "_address"), ignored');
        return { kind: 'table', issues };
    }

    // --- header
    let headerOk = true;
    const seen = new Set();
    header.forEach((h, i) => {
        if (!h) {
            add('error', `Empty column name in column ${i + 1}`, lineOfRow[headerIndex]);
            headerOk = false;
        } else if (seen.has(h)) {
            add('error', `Duplicate column "${h}"`, lineOfRow[headerIndex]);
            headerOk = false;
        } else if (!KNOWN_COLUMNS.has(h)) {
            const hint = [...KNOWN_COLUMNS].find(k => k.toLowerCase() === h.toLowerCase());
            add('error', `Unknown column "${h}"${hint ? ` (did you mean "${hint}"?)` : ''}`, lineOfRow[headerIndex]);
            headerOk = false;
        }
        seen.add(h);
    });
    for (const col of REQUIRED_COLUMNS) {
        if (!header.includes(col)) {
            add('error', `Required column "${col}" is missing`, lineOfRow[headerIndex]);
            headerOk = false;
        }
    }

    // --- register type
    const fromHeader = registerTypeFromHeader(header);
    const fromPath = registerTypeFromPath(relPath);
    let registerType = manifestEntry?.registerType || fromPath || fromHeader;
    if (!REGISTER_TYPES[registerType]) {
        add('error', `Unknown register type "${registerType}" in ${MANIFEST_FILE}`);
        registerType = fromHeader;
    }
    if (!manifestEntry?.registerType && fromPath && fromPath !== fromHeader) {
        const bitType = t => t === 'coils' || t === 'disInputs';
        if (bitType(fromPath) !== bitType(fromHeader)) {
            add(
                'error',
                `File name says "${fromPath}", but the columns belong to "${fromHeader}". Rename the file or set "registerType" in ${MANIFEST_FILE}.`,
            );
        } else {
            add(
                'warning',
                `File name says "${fromPath}", but the columns look like a "${fromHeader}" export. Using "${fromPath}".`,
            );
        }
    }
    if (!fromPath && !manifestEntry?.registerType) {
        add(
            'warning',
            `Register type is not visible in the file name, guessed "${fromHeader}" from the columns. Name the file e.g. "holding-registers.tsv" or set it in ${MANIFEST_FILE}.`,
        );
    }
    const isWord = registerType === 'inputRegs' || registerType === 'holdingRegs';
    if (isWord && !header.includes('type')) {
        add('error', 'Column "type" is required for registers');
        headerOk = false;
    }
    const allowed = new Set(['deviceId', ...REGISTER_TYPES[registerType]]);
    for (const h of header) {
        if (KNOWN_COLUMNS.has(h) && !allowed.has(h)) {
            add('warning', `Column "${h}" is not used for ${registerType} and will be ignored`);
        }
    }
    if (extname(relPath).toLowerCase() !== '.tsv') {
        add('warning', 'File extension should be ".tsv"');
    }

    if (!headerOk) {
        return { kind: 'invalid', registerType, header, issues };
    }

    // --- rows
    const col = Object.fromEntries(header.map((h, i) => [h, i]));
    const dataRows = [];
    const byAddress = new Map(); // `${deviceId}:${address}` -> [{ name, line }]
    const byName = new Map();
    const ranges = [];
    let minAddress = Infinity;
    let maxAddress = -Infinity;

    for (let r = headerIndex + 1; r < rows.length; r++) {
        const raw = rows[r];
        const line = lineOfRow[r];
        if (isEmptyRow(raw)) {
            continue;
        }
        // tolerate trailing empty cells (Excel), but not extra content
        const cells = raw.slice();
        while (cells.length > header.length && cells[cells.length - 1] === '') {
            cells.pop();
        }
        if (cells.length > header.length) {
            add('error', `Row has ${cells.length} columns, header has ${header.length} (tab inside a text?)`, line);
            continue;
        }
        if (cells.length < header.length) {
            add('error', `Row has only ${cells.length} of ${header.length} columns`, line);
            while (cells.length < header.length) {
                cells.push('');
            }
        }
        const get = name => (col[name] === undefined ? undefined : cells[col[name]]);
        const err = msg => add('error', msg, line);
        const warn = msg => add('warning', msg, line);

        const addressStr = get('_address').trim();
        const address = parseAddress(addressStr);
        if (addressStr === '') {
            err('Address is empty');
        } else if (Number.isNaN(address)) {
            err(`Address "${addressStr}" is not a number (decimal or 0x hex)`);
        } else if (address > 65535 + 40001) {
            // 65535 is the highest Modbus address, aliases add up to 40001 (holding registers)
            err(`Address ${address} is out of range`);
        }

        let deviceId = '';
        if (col.deviceId !== undefined) {
            deviceId = get('deviceId').trim();
            if (!isInteger(deviceId) || parseInt(deviceId, 10) < 0 || parseInt(deviceId, 10) > 255) {
                err(`Slave ID (deviceId) "${deviceId}" must be an integer 0..255`);
            } else if (parseInt(deviceId, 10) > 247) {
                warn(`Slave ID ${deviceId} is reserved by the Modbus specification`);
            }
        }

        const name = get('name');
        if (!name.trim()) {
            err('Name is empty');
        } else {
            if (name !== name.trim()) {
                warn(`Name "${name}" has leading or trailing spaces`);
            }
            const key = `${deviceId}:${name.trim().toLowerCase()}`;
            if (byName.has(key)) {
                warn(
                    `Name "${name.trim()}" is also used in line ${byName.get(key)} (same state ID if "Do not include address in ID" is enabled)`,
                );
            } else {
                byName.set(key, line);
            }
        }

        let length = 1;
        if (isWord) {
            const type = get('type').trim();
            const lenStr = (get('len') ?? '').trim();
            if (!type) {
                err('Type is empty');
            } else if (!(type in TYPE_LENGTH)) {
                const hint = Object.keys(TYPE_LENGTH).find(t => t.toLowerCase() === type.toLowerCase());
                err(`Unknown type "${type}"${hint ? ` (did you mean "${hint}"?)` : ''}`);
            } else {
                const expected = TYPE_LENGTH[type];
                if (lenStr === '') {
                    if (expected === 0) {
                        err(`Length is required for type "${type}"`);
                    }
                    length = expected || 1;
                } else if (!isInteger(lenStr) || parseInt(lenStr, 10) < 1) {
                    err(`Length "${lenStr}" must be a positive integer`);
                } else {
                    length = parseInt(lenStr, 10);
                    if (expected && length !== expected) {
                        warn(`Type "${type}" has length ${expected}, found ${length}`);
                        length = expected;
                    }
                }
            }
            // the adapter accepts "," as decimal separator for factor and offset (replace(',', '.'))
            for (const n of ['factor', 'offset', 'minValidValue', 'maxValidValue']) {
                const v = (get(n) ?? '').trim();
                const normalized = n === 'factor' || n === 'offset' ? v.replace(',', '.') : v;
                if (v !== '' && !isNumber(normalized)) {
                    err(`${n} "${v}" is not a number`);
                }
            }
            const factor = (get('factor') ?? '').trim().replace(',', '.');
            if (factor !== '' && isNumber(factor) && parseFloat(factor) === 0) {
                warn('Factor 0 is treated as 1 by the adapter');
            }
            const action = (get('sanitizeAction') ?? '').trim();
            if (!SANITIZE_ACTIONS.includes(action)) {
                err(`sanitizeAction "${action}" must be one of ${SANITIZE_ACTIONS.filter(Boolean).join(', ')}`);
            }
        }

        for (const n of BOOLEAN_COLUMNS) {
            const v = (get(n) ?? '').trim();
            if (v !== '' && v !== 'true' && v !== 'false') {
                err(`${n} must be "true", "false" or empty, found "${v}"`);
            }
        }

        const role = (get('role') ?? '').trim();
        if (!GUI_ROLES.has(role)) {
            warn(`Role "${role}" is not in the role list of the admin GUI (works, but the TSV import of the GUI rejects it)`);
        }

        if (!Number.isNaN(address) && addressStr !== '') {
            // the same register may be read twice (e.g. high and low byte), but not with the same name,
            // because the state ID is built from address and name
            const key = `${deviceId}:${address}`;
            const sameAddress = byAddress.get(key) || [];
            const where = deviceId ? ` (Slave ID ${deviceId})` : '';
            const sameName = sameAddress.find(a => a.name === name.trim().toLowerCase());
            if (sameName) {
                err(`Address ${addressStr}${where} with name "${name.trim()}" is already defined in line ${sameName.line}`);
            } else if (sameAddress.length) {
                warn(`Address ${addressStr}${where} is also defined in line ${sameAddress[0].line}`);
            } else {
                ranges.push({ deviceId, start: address, end: address + length - 1, line });
            }
            sameAddress.push({ name: name.trim().toLowerCase(), line });
            minAddress = Math.min(minAddress, address);
            maxAddress = Math.max(maxAddress, address);
            byAddress.set(key, sameAddress);
        }
        dataRows.push(cells);
    }

    // overlapping registers (e.g. a 32-bit value at 100 and another value at 101)
    ranges.sort((a, b) => (a.deviceId === b.deviceId ? a.start - b.start : a.deviceId < b.deviceId ? -1 : 1));
    for (let i = 1; i < ranges.length; i++) {
        const prev = ranges[i - 1];
        const cur = ranges[i];
        if (prev.deviceId === cur.deviceId && cur.start <= prev.end) {
            add('warning', `Register ${cur.start} overlaps with register ${prev.start} (line ${prev.line})`, cur.line);
        }
    }

    if (!dataRows.length) {
        add('error', 'No registers defined');
    }

    // Addresses below the alias offset (e.g. < 40001 for holding registers) can only be raw addresses
    let addressing = manifestEntry?.addressing;
    if (addressing && addressing !== 'raw' && addressing !== 'alias') {
        add('error', `addressing "${addressing}" in ${MANIFEST_FILE} must be "raw" or "alias"`);
        addressing = undefined;
    }
    if (minAddress < ALIAS_OFFSET[registerType]) {
        if (addressing === 'alias') {
            add('error', `addressing is "alias", but address ${minAddress} is below ${ALIAS_OFFSET[registerType]}`);
        }
        addressing = 'raw';
    }
    // Addresses above 65535 can only be aliases (e.g. 103247 = 40001 + 63246)
    if (maxAddress > 65535) {
        if (addressing === 'raw') {
            add(
                'error',
                minAddress < ALIAS_OFFSET[registerType]
                    ? `Addresses ${minAddress} and ${maxAddress} cannot be both raw and alias addresses`
                    : `addressing is "raw", but address ${maxAddress} is above 65535`,
            );
        }
        addressing = addressing === 'raw' ? addressing : 'alias';
    }

    const hasErrors = issues.some(i => i.level === 'error');
    return { kind: hasErrors ? 'invalid' : 'registers', registerType, addressing, header, rows: dataRows, issues };
}

// ---------------------------------------------------------------------------------------------------------------------
// whole repository

function loadManifests(files, issues) {
    const manifests = {};
    for (const f of files.filter(f => basename(f) === MANIFEST_FILE)) {
        const { devicePath } = splitPath(f);
        if (!devicePath || f !== `${devicePath}/${MANIFEST_FILE}`) {
            issues.push({ file: f, level: 'error', message: `${MANIFEST_FILE} must be placed directly in the device folder` });
            continue;
        }
        const json = readJson(f, issues);
        if (!json) {
            continue;
        }
        const allowedKeys = ['name', 'manufacturer', 'models', 'description', 'files', 'ignore'];
        for (const key of Object.keys(json)) {
            if (!allowedKeys.includes(key)) {
                issues.push({ file: f, level: 'warning', message: `Unknown key "${key}"` });
            }
        }
        for (const [file, entry] of Object.entries(json.files || {})) {
            if (!existsSync(join(ROOT, devicePath, file))) {
                issues.push({ file: f, level: 'error', message: `files: "${file}" does not exist` });
            }
            for (const key of Object.keys(entry)) {
                if (!['registerType', 'title', 'addressing'].includes(key)) {
                    issues.push({ file: f, level: 'warning', message: `files: "${file}" has unknown key "${key}"` });
                }
            }
            if (entry.registerType && !REGISTER_TYPES[entry.registerType]) {
                issues.push({
                    file: f,
                    level: 'error',
                    message: `files: "${file}" has unknown registerType "${entry.registerType}" (${Object.keys(REGISTER_TYPES).join(', ')})`,
                });
            }
        }
        manifests[devicePath] = json;
    }
    return manifests;
}

function isIgnored(manifest, inner) {
    return (manifest?.ignore || []).some(pattern => {
        const re = new RegExp(
            `^${pattern
                .split('*')
                .map(s => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
                .join('.*')}$`,
        );
        return re.test(inner);
    });
}

function scan(onlyFiles) {
    const issues = [];
    const files = walk(ROOT).sort();
    const manifests = loadManifests(files, issues);

    // case-insensitive path collisions break checkouts on Windows and macOS
    const lower = new Map();
    for (const f of files) {
        const key = f.toLowerCase();
        if (lower.has(key)) {
            issues.push({ file: f, level: 'error', message: `Same path as "${lower.get(key)}" on case-insensitive file systems` });
        }
        lower.set(key, f);
    }
    const folders = new Map();
    for (const f of files) {
        const { devicePath } = splitPath(f);
        if (!devicePath) {
            continue;
        }
        const key = devicePath.toLowerCase();
        if (folders.has(key) && folders.get(key) !== devicePath) {
            issues.push({
                file: devicePath,
                level: 'warning',
                message: `Folder differs from "${folders.get(key)}" only in case. Merge both folders.`,
            });
            folders.set(key, devicePath);
        } else {
            folders.set(key, devicePath);
        }
    }

    const results = [];
    for (const f of files) {
        const ext = extname(f).toLowerCase();
        if (!['.tsv', '.txt', '.csv'].includes(ext)) {
            continue;
        }
        const { devicePath, inner, category } = splitPath(f);
        if (!category) {
            continue;
        }
        const manifest = manifests[devicePath];
        if (isIgnored(manifest, inner)) {
            continue;
        }
        if (ext === '.csv') {
            issues.push({ file: f, level: 'warning', message: 'CSV files are not supported, export as TSV' });
            continue;
        }
        const buffer = readFileSync(join(ROOT, f));
        // .txt files are only taken if they are register exports
        const result = validateFile(f, buffer, manifest?.files?.[inner]);
        if (ext === '.txt' && result.kind === 'table') {
            continue;
        }
        results.push({ file: f, ...result });
        issues.push(...result.issues);
    }

    const relevant = onlyFiles?.length
        ? issues.filter(i => onlyFiles.some(o => i.file === o || i.file.startsWith(`${o}/`) || o.startsWith(`${i.file}/`)))
        : issues;
    return { files, manifests, results, issues: relevant };
}

// ---------------------------------------------------------------------------------------------------------------------
// index

const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });

function buildIndex(scanResult) {
    const { files, manifests, results } = scanResult;
    const issues = [];
    const categoriesJson = existsSync(join(ROOT, CATEGORIES_FILE)) ? readJson(CATEGORIES_FILE, issues) || {} : {};

    const devices = new Map();
    for (const r of results) {
        if (r.kind !== 'registers') {
            continue;
        }
        const { category, device, devicePath, inner } = splitPath(r.file);
        if (!devices.has(devicePath)) {
            const manifest = manifests[devicePath] || {};
            const readme = files.find(f => f.toLowerCase() === `${devicePath}/readme.md`.toLowerCase());
            devices.set(devicePath, {
                id: devicePath,
                category,
                name: manifest.name || device,
                ...(manifest.manufacturer ? { manufacturer: manifest.manufacturer } : {}),
                ...(manifest.models ? { models: manifest.models } : {}),
                ...(manifest.description ? { description: manifest.description } : {}),
                ...(readme ? { readme } : {}),
                files: [],
            });
        }
        const entry = manifests[devicePath]?.files?.[inner];
        const col = r.header.indexOf('deviceId');
        const deviceIds =
            col === -1 ? [] : [...new Set(r.rows.map(row => parseInt(row[col], 10)))].sort((a, b) => a - b);
        devices.get(devicePath).files.push({
            path: r.file,
            title: entry?.title || inner.replace(/\.(tsv|txt)$/i, ''),
            registerType: r.registerType,
            registers: r.rows.length,
            ...(r.addressing ? { addressing: r.addressing } : {}),
            ...(deviceIds.length ? { deviceIds } : {}),
            ...(r.issues.some(i => i.level === 'warning') ? { warnings: r.issues.filter(i => i.level === 'warning').length } : {}),
        });
    }

    const templates = [...devices.values()]
        .map(t => ({ ...t, files: t.files.sort((a, b) => collator.compare(a.path, b.path)) }))
        .sort((a, b) => collator.compare(a.id, b.id));

    const categories = [...new Set(templates.map(t => t.category))].sort(collator.compare).map(id => ({
        id,
        title: categoriesJson[id] || { en: id },
    }));

    return {
        index: {
            formatVersion: FORMAT_VERSION,
            repository: REPOSITORY,
            branch: BRANCH,
            categories,
            templates,
        },
        issues,
    };
}

// ---------------------------------------------------------------------------------------------------------------------
// CLI

function printIssues(issues, { quiet }) {
    const order = { error: 0, warning: 1, info: 2 };
    const byFile = new Map();
    for (const i of issues) {
        if (quiet && i.level !== 'error') {
            continue;
        }
        if (!byFile.has(i.file)) {
            byFile.set(i.file, []);
        }
        byFile.get(i.file).push(i);
    }
    const color = process.stdout.isTTY && !process.env.NO_COLOR;
    const c = (code, s) => (color ? `\x1b[${code}m${s}\x1b[0m` : s);
    const gh = !!process.env.GITHUB_ACTIONS;
    for (const [file, list] of [...byFile.entries()].sort((a, b) => collator.compare(a[0], b[0]))) {
        console.log(c(1, file));
        for (const i of list.sort((a, b) => order[a.level] - order[b.level] || (a.line || 0) - (b.line || 0))) {
            const label = i.level === 'error' ? c(31, 'error  ') : i.level === 'warning' ? c(33, 'warning') : c(2, 'info   ');
            console.log(`  ${label} ${i.line ? `line ${String(i.line).padEnd(5)}` : '          '} ${i.message}`);
            if (gh && i.level !== 'info') {
                // annotations in the pull request
                const msg = i.message.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
                console.log(`::${i.level} file=${file}${i.line ? `,line=${i.line}` : ''}::${msg}`);
            }
        }
    }
}

function summary(issues, results) {
    const count = level => issues.filter(i => i.level === level).length;
    const ok = results.filter(r => r.kind === 'registers').length;
    const invalid = results.filter(r => r.kind === 'invalid').length;
    const tables = results.filter(r => r.kind === 'table').length;
    console.log(
        `\n${ok} valid register file(s), ${invalid} invalid, ${tables} other table(s) ignored. ` +
            `${count('error')} error(s), ${count('warning')} warning(s).`,
    );
}

function main() {
    const args = process.argv.slice(2);
    const flags = new Set(args.filter(a => a.startsWith('--')));
    const positional = args.filter(a => !a.startsWith('--'));
    const command = positional.shift() || 'validate';
    const opts = { quiet: flags.has('--quiet') };
    const onlyFiles = positional.map(p => toPosix(relative(ROOT, join(process.cwd(), p))));

    if (!['validate', 'build', 'check'].includes(command)) {
        console.error(`Unknown command "${command}". Use validate, build or check.`);
        process.exit(2);
    }

    const scanResult = scan(command === 'validate' ? onlyFiles : []);
    let { issues } = scanResult;
    let failed = false;

    if (command === 'build' || command === 'check') {
        const { index, issues: indexIssues } = buildIndex(scanResult);
        issues = [...issues, ...indexIssues];
        const content = `${JSON.stringify(index, null, 2)}\n`;
        const target = join(ROOT, INDEX_FILE);
        if (command === 'build') {
            const old = existsSync(target) ? readFileSync(target, 'utf8') : '';
            if (old !== content) {
                writeFileSync(target, content);
                console.log(`${INDEX_FILE} written: ${index.templates.length} device(s).`);
            } else {
                console.log(`${INDEX_FILE} is up to date: ${index.templates.length} device(s).`);
            }
        } else if (!existsSync(target) || readFileSync(target, 'utf8') !== content) {
            console.error(`${INDEX_FILE} is not up to date. Run "node scripts/templates.mjs build".`);
            failed = true;
        }
    }

    if (flags.has('--json')) {
        console.log(JSON.stringify(issues, null, 2));
    } else {
        printIssues(issues, opts);
        summary(issues, scanResult.results);
    }

    const hasErrors = issues.some(i => i.level === 'error' || (flags.has('--strict') && i.level === 'warning'));
    // "build" always writes the index (invalid files are left out), the errors are reported only
    if ((command !== 'build' && hasErrors) || failed) {
        // exitCode instead of exit(): let stdout flush when piped
        process.exitCode = 1;
    }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
    main();
}

// for tests
export { scan, buildIndex, registerTypeFromPath, registerTypeFromHeader, TYPE_LENGTH, REGISTER_TYPES };
