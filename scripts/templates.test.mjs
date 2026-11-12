// Run with: npm test (node --test scripts/templates.test.mjs)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseTsv, validateFile, registerTypeFromPath } from './templates.mjs';

const HEADER = '_address\tname\tdescription\tunit\ttype\tlen\tfactor\toffset\tformula\trole\troom\tpoll\twp\tcw\tisScale';
const row = (address, name, type = 'uint16be', len = '1', factor = '1') =>
    `${address}\t${name}\t\t\t${type}\t${len}\t${factor}\t0\t\tvalue\t\ttrue\tfalse\tfalse\tfalse`;
const check = (path, text) => validateFile(path, Buffer.from(text, 'utf8'));
const errors = r => r.issues.filter(i => i.level === 'error').map(i => i.message);

test('parseTsv handles CRLF, quotes and trailing newline', () => {
    assert.deepEqual(parseTsv('a\tb\r\n"x\ty"\t"he said ""hi"""\n'), [
        ['a', 'b'],
        ['x\ty', 'he said "hi"'],
    ]);
    assert.deepEqual(parseTsv('a\t\nb\t'), [
        ['a', ''],
        ['b', ''],
    ]);
});

test('register type from path', () => {
    assert.equal(registerTypeFromPath('A/B/holding-registers.tsv'), 'holdingRegs');
    assert.equal(registerTypeFromPath('A/B/eingang-registers.tsv'), 'inputRegs');
    assert.equal(registerTypeFromPath('A/B/Coils/0-32 Alarm.tsv'), 'coils');
    assert.equal(registerTypeFromPath('A/B/discrete-outputs.tsv'), 'coils');
    assert.equal(registerTypeFromPath('A/B/discrete-inputs.tsv'), 'disInputs');
    assert.equal(registerTypeFromPath('A/B/Gen24 register.tsv'), null);
});

test('valid file', () => {
    const r = check('A/B/holding-registers.tsv', [HEADER, row(100, 'x'), row(101, 'y', 'floatbe', '2', '0,1')].join('\n'));
    assert.equal(r.kind, 'registers');
    assert.equal(r.registerType, 'holdingRegs');
    assert.deepEqual(errors(r), []);
});

test('detects broken rows', () => {
    const r = check(
        'A/B/holding-registers.tsv',
        [HEADER, row(100, 'x', 'uint16'), row('abc', 'y'), row(102, 'z', 'string', ''), row(100, 'x'), 'only\ttwo'].join('\n'),
    );
    assert.equal(r.kind, 'invalid');
    const e = errors(r).join('\n');
    assert.match(e, /Unknown type "uint16"/);
    assert.match(e, /Address "abc" is not a number/);
    assert.match(e, /Length is required for type "string"/);
    assert.match(e, /Address 100 with name "x" is already defined/);
    assert.match(e, /Row has only 2 of 15 columns/);
});

test('detects bad header and encoding', () => {
    assert.match(errors(check('A/B/input-registers.tsv', '_address\tnmae\n1\tx'))[0], /Unknown column "nmae"/);
    const latin1 = Buffer.from(`${HEADER}\n${row(1, 'Temperatur', 'uint16be')}`.replace('value', 'valu\xe4'), 'latin1');
    assert.match(errors(validateFile('A/B/holding-registers.tsv', latin1))[0], /not UTF-8/);
});

test('tables that are no register exports are ignored', () => {
    assert.equal(check('A/B/Tabellen/codes.tsv', 'Code\tMessage\n1\tError').kind, 'table');
});

test('address format is detected where it is unambiguous', () => {
    assert.equal(check('A/B/holding-registers.tsv', [HEADER, row(100, 'x')].join('\n')).addressing, 'raw');
    assert.equal(check('A/B/holding-registers.tsv', [HEADER, row(40001, 'x'), row(103247, 'y')].join('\n')).addressing, 'alias');
    assert.equal(check('A/B/holding-registers.tsv', [HEADER, row(40001, 'x')].join('\n')).addressing, undefined);
});

test('directAddresses is only kept for bit registers with alias addresses', () => {
    const coils = '_address\tname\tdescription\tformula\trole\troom\tpoll\twp\tcw\tisScale\n1\tx\t\t\tvalue\t\ttrue\tfalse\tfalse\tfalse\n17\ty\t\t\tvalue\t\ttrue\tfalse\tfalse\tfalse';
    const r1 = validateFile('A/B/coils.tsv', Buffer.from(coils), { addressing: 'alias', directAddresses: true });
    assert.equal(r1.directAddresses, true);
    const r2 = validateFile('A/B/coils.tsv', Buffer.from(coils), { addressing: 'raw', directAddresses: true });
    assert.equal(r2.directAddresses, undefined);
    assert.match(r2.issues.map(i => i.message).join(), /no effect with raw/);
    const r3 = validateFile('A/B/holding-registers.tsv', Buffer.from([HEADER, row(40001, 'x')].join('\n')), { directAddresses: false });
    assert.equal(r3.directAddresses, undefined);
    const r4 = validateFile('A/B/coils.tsv', Buffer.from(coils), { addressing: 'alias', directAddresses: 'yes' });
    assert.equal(r4.kind, 'invalid');
});

test('detect block', async () => {
    const { validateDetect } = await import('./templates.mjs');
    const sunspec = {
        probes: [
            { registerType: 'holdingRegs', address: 40000, type: 'string', len: 2, equals: 'SunS' },
            { registerType: 'holdingRegs', address: 40004, type: 'string', len: 16, startsWith: 'Fronius' },
        ],
    };
    assert.deepEqual(validateDetect(sunspec), []);
    assert.deepEqual(validateDetect({ probes: [{ registerType: 'inputRegs', address: 9000, type: 'uint16', equals: 5 }], weak: true }), []);
    assert.deepEqual(validateDetect({ probes: [{ registerType: 'holdingRegs', address: 11, type: 'uint16', oneOf: [71, 72] }] }), []);
    const bad = validateDetect({
        probes: [
            { registerType: 'coils', address: 70000, type: 'string', equals: 'x' },
            { registerType: 'holdingRegs', address: 1, type: 'uint16', startsWith: 'x' },
            { registerType: 'holdingRegs', address: 1, type: 'uint16', equals: 1, oneOf: [1] },
        ],
    }).join('\n');
    assert.match(bad, /registerType/);
    assert.match(bad, /raw address/);
    assert.match(bad, /len \(registers\)/);
    assert.match(bad, /startsWith is only for strings/);
    assert.match(bad, /exactly one of/);
    assert.match(validateDetect([]).join(), /must be an object/);
});
