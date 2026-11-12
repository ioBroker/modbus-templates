// Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateDevice, generateEntry } from './generate.mjs';
import { generatedFiles, validateGenerate } from './templates.mjs';

const COMMON = {
    id: 1,
    group: {
        name: 'common',
        type: 'group',
        points: [
            { name: 'ID', type: 'uint16', size: 1, value: 1 },
            { name: 'L', type: 'uint16', size: 1 },
            { name: 'Mn', type: 'string', size: 16, label: 'Manufacturer' },
            { name: 'Pad', type: 'pad', size: 1 },
        ],
    },
};

const DEFINITION = `parameters:
  - group: Battery
    items:
      - name: "Battery Temperature"
        scale: 0.1
        offset: 1000
        rule: 1
        registers: [0x00B6]
      - name: "Battery SOC"
        rule: 1
        registers: [0x00B8]
      - name: "Grid Power"
        rule: 2
        code: 4
        registers: [0x0100]
`;

const loaders = {
    loadModel: async id => {
        if (id !== 1) {
            throw new Error(`SunSpec model ${id}: HTTP 404`);
        }
        return COMMON;
    },
    loadDefinition: async (name, ref) => {
        assert.equal(ref, 'v1');
        if (name !== 'test') {
            throw new Error(`ha-solarman definition ${name}@${ref}: HTTP 404`);
        }
        return DEFINITION;
    },
};

test('validation of the generate block', () => {
    assert.deepEqual(validateGenerate([{ source: 'sunspec', models: [{ id: 1, address: 40002 }] }]), []);
    assert.deepEqual(validateGenerate([{ source: 'solarman', definition: 'deye_p3', ref: 'main', mod: 1 }]), []);
    assert.match(validateGenerate([{ source: 'modbus' }])[0], /source must be one of sunspec, solarman/);
    assert.match(validateGenerate([{ source: 'solarman', definition: '../x' }])[0], /definition must be/);
    assert.match(validateGenerate([{ source: 'sunspec', models: [{ id: 1 }] }])[0], /numeric "id" and "address"/);
    assert.match(validateGenerate([{ source: 'sunspec', models: [{ id: 1, address: 0 }], file: '../a.tsv' }])[0], /stay in/);
    // both write holding-registers.tsv
    assert.match(
        validateGenerate([
            { source: 'sunspec', models: [{ id: 1, address: 0 }] },
            { source: 'solarman', definition: 'x' },
        ]).join(),
        /generated twice/,
    );
    assert.deepEqual(
        generatedFiles({ generate: [{ source: 'solarman', definition: 'x', files: { inputRegs: 'meter.tsv' } }] }).map(
            g => `${g.registerType}:${g.file}`,
        ),
        ['inputRegs:meter.tsv'],
    );
});

test('sunspec entry with skip', async () => {
    const { files, warnings } = await generateEntry(
        { source: 'sunspec', marker: 40000, models: [{ id: 1, address: 40002 }], skip: ['ID', 'Nothing'] },
        loaders,
    );
    assert.equal(files.length, 1);
    assert.equal(files[0].file, 'holding-registers.tsv');
    assert.deepEqual(
        files[0].content
            .trim()
            .split('\n')
            .slice(1)
            .map(line => line.split('\t').slice(0, 2).join(' ')),
        ['40000 SunSpec_ID', '40003 L', '40004 Mn'],
    );
    assert.deepEqual(warnings, ['skip: "Nothing" not found']);
});

test('device: solarman files are validated, errors keep the old files', async () => {
    const manifest = {
        generate: [{ source: 'solarman', definition: 'test', ref: 'v1', files: { holdingRegs: 'inverter.tsv', inputRegs: 'meter-input.tsv' } }],
        files: {},
    };
    const ok = await generateDevice('Inverter/Test', manifest, loaders);
    assert.deepEqual(ok.errors, []);
    assert.deepEqual(
        ok.files.map(f => `${f.path} ${f.rows}`),
        ['Inverter/Test/inverter.tsv 2', 'Inverter/Test/meter-input.tsv 1'],
    );
    assert.match(ok.files[0].content, /^_address\tname/);

    const broken = await generateDevice(
        'Inverter/Test',
        { generate: [{ source: 'solarman', definition: 'missing', ref: 'v1' }, { source: 'sunspec', models: [{ id: 2, address: 0 }], file: 'b.tsv' }] },
        loaders,
    );
    assert.deepEqual(broken.files, []);
    assert.deepEqual(broken.errors, [
        'generate[0] (solarman missing): ha-solarman definition missing@v1: HTTP 404',
        'generate[1] (sunspec): SunSpec model 2: HTTP 404',
    ]);
});
