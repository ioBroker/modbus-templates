// Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import YAML from 'yaml';
import { convertDefinition, headerComment, toTsv } from './solarman.mjs';
import { validateFile } from './templates.mjs';

// shortened from the definitions of ha-solarman (https://github.com/davidrapan/ha-solarman, MIT)
const TEXT = `#
# SUN-5/6/8/10/12K-SG04LP3 | Three Phase | Hybrid Inverter
#
info:
  manufacturer: Deye

default:
  update_interval: 60

parameters:
  - group: Info
    items:
      - name: "Device"
        rule: 1
        registers: [0x0000]
        lookup:
          - key: [0x0002, 0x0200]
            value: "String Inverter"
          - key: 0x0005
            value: "LV 3-Phase Hybrid Inverter"
      - name: "Device Serial Number"
        rule: 5
        registers: [0x0003, 0x0004, 0x0005, 0x0006, 0x0007]
      - name: "Device MPPTs"
        rule: 1
        mask: 0x0F00
        divide: 256
        registers: [0x0016]
  - group: Battery
    items:
      - name: "Battery Temperature"
        class: "temperature"
        uom: "°C"
        scale: 0.1
        offset: 1000
        rule: 1
        registers: [0x00B6]
      - name: "Battery Current"
        uom: "A"
        scale: [0.01, 0.1]
        rule: 2
        registers: [0x00BF]
        validation:
          min: -300
          max: 300
      - name: "Total Battery Charge"
        uom: "kWh"
        scale: 0.1
        rule: 3
        registers: [0x00B4, 0x00B5]
      - name: "Battery Power"
        uom: "W"
        rule: 4
        registers: [0x00BE, 0x00BD]
      - name: "Grid Power"
        uom: "W"
        rule: 2
        registers: [0x0271, 0x02B2]
      - name: "Battery Max Charge Current"
        uom: "A"
        rule: 1
        configurable:
          min: 0
          max: 185
        registers: [0x006C]
      - name: "Battery Losses"
        uom: "kWh"
        rule: 1
        sensors:
          - registers: [0x00B4]
      - name: "Firmware"
        rule: 7
        registers: [0x000E, 0x000F, 0x000B]
      - name: ""
        platform: switch
        rule: 1
        registers: [0x0050]
  - group: Time of Use
    items:
      - name: "Timed Charge Start"
        platform: time
        rule: 9
        registers: [0x0094, 0x0095]
      - name: "Time Point 1"
        platform: time
        rule: 9
        registers: [0x0096]
  - group: Alarm
    items:
      - name: "Device Fault"
        rule: 3
        registers: [0x0405, 0x0406, 0x0407, 0x0408, 0x0409, 0x040A]
        lookup:
          - key: 0
            value: "OK"
          - bit: 0
            value: "ID01 Grid Overvoltage"
  - group: Meter
    items:
      - name: "Meter Power"
        rule: 2
        code: 4
        registers: [0x0100]
`;

test('rules, word order, scale, offset, mask and lookup', () => {
    const { files, warnings, skipped } = convertDefinition(YAML.parse(TEXT));
    const holding = Object.fromEntries(files.holdingRegs.map(r => [r.name, r]));

    assert.equal(holding.Device.description, '2/512=String Inverter, 5=LV 3-Phase Hybrid Inverter');
    assert.equal(holding['Device Serial Number'].type, 'string');
    assert.equal(holding['Device Serial Number'].len, '5');
    assert.equal(holding['Device MPPTs'].formula, 'Math.floor((x & 0xF00) / 256)');

    // (raw - 1000) * 0.1 = raw * 0.1 - 100
    const temperature = holding['Battery Temperature'];
    assert.equal(temperature._address, String(0xb6));
    assert.equal(temperature.factor, '0,1');
    assert.equal(temperature.offset, '-100');
    assert.equal(temperature.formula, '');
    assert.equal(temperature.role, 'value.temperature');

    // the first variant of the scale, validation as sanitize
    const current = holding['Battery Current'];
    assert.equal(current.type, 'int16be');
    assert.equal(current.factor, '0,01');
    assert.equal(current.sanitize, 'true');
    assert.equal(current.minValidValue, '-300');
    assert.equal(current.maxValidValue, '300');
    assert.ok(warnings.some(w => w.includes('mod 0 is used')));

    // low word first -> word swapped; high word first -> big endian
    assert.equal(holding['Total Battery Charge'].type, 'uint32sw');
    assert.equal(holding['Total Battery Charge']._address, String(0xb4));
    assert.equal(holding['Battery Power'].type, 'int32be');
    assert.equal(holding['Battery Power']._address, String(0xbd));

    // high word in another block: only the low word
    assert.equal(holding['Grid Power'].type, 'int16be');
    assert.equal(holding['Grid Power']._address, String(0x271));
    assert.equal(holding['Grid Power'].description, 'low word only, the high word for values above 32767 is in register 690 (0x2B2)');
    assert.ok(warnings.some(w => w.startsWith('1 values have the high word in another register')));

    assert.equal(holding['Battery Max Charge Current'].role, 'level');
    assert.equal(holding['Battery switch'].role, 'level');

    // time: one register per part, or HHMM in one register
    assert.equal(holding['Timed Charge Start hour']._address, String(0x94));
    assert.equal(holding['Timed Charge Start minute']._address, String(0x95));
    assert.equal(holding['Timed Charge Start minute'].role, 'level');
    assert.equal(holding['Time Point 1'].description, 'time as HHMM');

    // fault bits in many registers: raw hex
    assert.equal(holding['Device Fault'].type, 'rawhex');
    assert.equal(holding['Device Fault'].len, '6');
    assert.equal(holding['Device Fault'].description, 'bits (0..15 in the first register): 0=OK, bit 0=ID01 Grid Overvoltage');

    // computed values and versions in scattered registers are left out
    assert.equal(holding['Battery Losses'], undefined);
    assert.equal(holding.Firmware, undefined);
    assert.ok(warnings.some(w => w.startsWith('Battery/Firmware')));
    assert.equal(skipped, 2);

    // function code 4 -> input registers
    assert.deepEqual(
        files.inputRegs.map(r => r.name),
        ['Meter Power'],
    );
});

test('another model variant', () => {
    const { files } = convertDefinition(YAML.parse(TEXT), { mod: 1 });
    assert.equal(files.holdingRegs.find(r => r.name === 'Battery Current').factor, '0,1');
    // a variant beyond the list takes the last element
    const { files: files5 } = convertDefinition(YAML.parse(TEXT), { mod: 5 });
    assert.equal(files5.holdingRegs.find(r => r.name === 'Battery Current').factor, '0,1');
});

test('generated files are valid', () => {
    const { files } = convertDefinition(YAML.parse(TEXT));
    for (const [regType, file] of [
        ['holdingRegs', 'holding-registers.tsv'],
        ['inputRegs', 'input-registers.tsv'],
    ]) {
        const result = validateFile(`X/Y/${file}`, Buffer.from(toTsv(files[regType], regType), 'utf8'));
        assert.deepEqual(
            result.issues.filter(i => i.level === 'error'),
            [],
        );
        assert.equal(result.registerType, regType);
    }
    assert.deepEqual(headerComment(TEXT), ['SUN-5/6/8/10/12K-SG04LP3 | Three Phase | Hybrid Inverter']);
});
