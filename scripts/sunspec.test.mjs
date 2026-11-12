// Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { convertModel, convertLayout, toTsv } from './sunspec.mjs';
import { validateFile } from './templates.mjs';

// shortened copies of the SunSpec models (https://github.com/sunspec/models, Apache-2.0)
const COMMON = {
    id: 1,
    group: {
        name: 'common',
        type: 'group',
        points: [
            { name: 'ID', type: 'uint16', size: 1, value: 1, desc: 'Model identifier', label: 'Model ID' },
            { name: 'L', type: 'uint16', size: 1, desc: 'Model length', label: 'Model Length' },
            { name: 'Mn', type: 'string', size: 16, label: 'Manufacturer', desc: 'Well known value' },
            { name: 'DA', type: 'uint16', size: 1, label: 'Device Address', access: 'RW' },
            { name: 'Pad', type: 'pad', size: 1 },
        ],
    },
};
const METER = {
    id: 203,
    group: {
        name: 'ac_meter',
        type: 'group',
        points: [
            { name: 'ID', type: 'uint16', size: 1, value: 203 },
            { name: 'L', type: 'uint16', size: 1 },
            { name: 'A', type: 'int16', size: 1, sf: 'A_SF', units: 'A', label: 'Amps', desc: 'Total AC Current' },
            { name: 'A_SF', type: 'sunssf', size: 1 },
            { name: 'TotWhExp', type: 'acc32', size: 2, sf: 'TotWh_SF', units: 'Wh' },
            { name: 'TotWh_SF', type: 'sunssf', size: 1 },
            { name: 'Fixed', type: 'uint16', size: 1, sf: -2 },
            {
                name: 'Evt',
                type: 'enum16',
                size: 1,
                desc: 'Events',
                symbols: [
                    { name: 'OFF', value: 1 },
                    { name: 'ON', value: 2 },
                ],
            },
        ],
    },
};
const MPPT = {
    id: 160,
    group: {
        name: 'mppt',
        type: 'group',
        points: [
            { name: 'ID', type: 'uint16', size: 1, value: 160 },
            { name: 'L', type: 'uint16', size: 1 },
            { name: 'DCA_SF', type: 'sunssf', size: 1 },
            { name: 'N', type: 'count', size: 1 },
        ],
        groups: [
            {
                name: 'module',
                type: 'group',
                count: 'N',
                points: [
                    { name: 'ID', type: 'uint16', size: 1 },
                    { name: 'DCA', type: 'uint16', size: 1, sf: 'DCA_SF', units: 'A' },
                ],
            },
        ],
    },
};

test('addresses, types, scale factors and the pad', () => {
    const { rows, end, warnings } = convertModel(METER, 40188, { prefix: 'M1_' });
    assert.deepEqual(warnings, []);
    const byName = Object.fromEntries(rows.map(r => [r.name, r]));
    assert.equal(byName.M1_ID._address, '40188');
    assert.equal(byName.M1_A._address, '40190');
    assert.equal(byName.M1_A.type, 'int16be');
    assert.equal(byName.M1_A.formula, "x * Math.pow(10, sf['40191'])");
    assert.equal(byName.M1_A.description, 'Amps: Total AC Current');
    assert.equal(byName.M1_A_SF.isScale, 'true');
    assert.equal(byName.M1_TotWhExp.type, 'uint32be');
    assert.equal(byName.M1_TotWhExp.len, '2');
    assert.equal(byName.M1_TotWhExp.formula, "x * Math.pow(10, sf['40194'])");
    assert.equal(byName.M1_Fixed.factor, '0,01');
    assert.equal(byName.M1_Fixed.formula, '');
    assert.equal(byName.M1_Evt.description, 'Events (1=OFF, 2=ON)');
    assert.equal(end, 40197);

    const common = convertModel(COMMON, 40002, { prefix: 'C_' });
    assert.equal(common.rows.find(r => r.name === 'C_DA').role, 'level');
    assert.equal(common.rows.find(r => r.name === 'C_Mn').type, 'string');
    assert.ok(!common.rows.some(r => r.name === 'C_Pad'));
    // the pad at the end does not count, so the next model may start there (as with SolarEdge)
    assert.equal(common.end, 40021);
});

test('repeating groups use the scale factor of the parent', () => {
    const { rows, warnings } = convertModel(MPPT, 40300, { repeat: { module: 2 } });
    assert.deepEqual(warnings, []);
    const names = rows.map(r => `${r._address} ${r.name} ${r.formula}`);
    assert.deepEqual(names.slice(4), [
        '40304 module1_ID ',
        "40305 module1_DCA x * Math.pow(10, sf['40302'])",
        '40306 module2_ID ',
        "40307 module2_DCA x * Math.pow(10, sf['40302'])",
    ]);
    assert.match(convertModel(MPPT, 40300).warnings[0], /"repeat": \{ "module": N \}/);
});

test('layout: marker, overlaps, duplicate names and a valid file', async () => {
    const models = { 1: COMMON, 203: METER };
    const layout = {
        marker: 40000,
        models: [
            { id: 1, address: 40002, prefix: 'C_' },
            { id: 1, address: 40020, prefix: 'C_' },
            { id: 203, address: 40100 },
        ],
    };
    const { rows, warnings } = await convertLayout(layout, id => models[id]);
    assert.equal(rows[0].name, 'SunSpec_ID');
    assert.ok(warnings.some(w => w.includes('overlaps')));
    assert.ok(warnings.some(w => w.includes('"C_ID" is used twice')));

    layout.models[1] = { id: 1, address: 40021, prefix: 'M1_C_' };
    const ok = await convertLayout(layout, id => models[id]);
    assert.deepEqual(ok.warnings, []);
    const tsv = toTsv(ok.rows);
    assert.match(tsv.split('\n')[1], /^40000\tSunSpec_ID\t"SunSpec marker ""SunS"""\t/);
    const result = validateFile('X/Y/holding-registers.tsv', Buffer.from(tsv, 'utf8'));
    assert.deepEqual(
        result.issues.filter(i => i.level === 'error'),
        [],
    );
    assert.equal(result.addressing, 'raw');
});
