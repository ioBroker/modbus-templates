# Modbus Templates

The ioBroker adapter ioBroker.modbus can connect to many devices that are on the market. But normally you need to manually add all the registers and fiel definitions based on the device specifications. This is a lot of work ...

## The Idea
What if only one user needs to make this work to collect all registers and fields and would share his results as an export TSV file and adds it here. Then other users can simply download it and use it directly. That would be cool, or?

## So, Let's start


## Repository structure

We are now just at the beginning, so we need to find the best way together.
We start the following:
* In the repository we have folders for "device categories" (We build then as we add devices when we find out that a new device do not match to existing categories
* For each device we add another folder with the device name
* In there we have some files
  1. **README.md**: AN md File with more information to the device, the Full name, potential other compatible devices and special settings. Let's try to fnd a template structure together
  2. **TYPE.tsv**: this is the Exported TSV File with the register definitions for the device by relevant register type (if relevant)
    * discrete-inputs.tsv
    * discrete-outputs.tsv
    * input-registers.tsv
    * holding-registers.tsv
  3. If relevant we could also have a settings.jpg or such

## Use the templates in ioBroker.modbus
The admin GUI of ioBroker.modbus reads `templates.json` from this repository and offers all devices in a dropdown
("Load from template library"). You select category, device and the files, and the registers are imported into the
matching tabs (input registers, holding registers, coils, discrete inputs).

`templates.json` is generated automatically by a GitHub Action after every merge into `main`. Please do not edit it
by hand. Files with errors are left out of the index, so they do not appear in the adapter.

### How the register type of a file is detected
1. From `template.json` in the device folder (see below), if present
2. From the file name or sub folder: `holding`, `input`/`eingang`, `coil`/`discrete-outputs`, `discrete-inputs`
3. From the columns, as the adapter exports them (with `type`: registers, with `poll`/`wp`: writable)

So please name the files like `holding-registers.tsv` or `input-registers.tsv`.

TSV files that do not start with the column `_address` (e.g. tables with error codes) are documentation only and
are ignored.

### Optional: template.json
Place a `template.json` next to the TSV files to give the device a nicer name or to set details that cannot be
derived from the file names. All keys are optional:

```json
{
    "name": "Eastron SDM630 Modbus V2",
    "manufacturer": "Eastron",
    "models": ["SDM630-Modbus V2", "SDM630MCT"],
    "description": "3-phase energy meter, RS485",
    "files": {
        "Sdm72dm-v2.tsv": { "registerType": "inputRegs", "title": "SDM72D-M v2", "addressing": "alias" }
    },
    "ignore": ["Tabellen/*"]
}
```

`registerType` is one of `inputRegs`, `holdingRegs`, `coils`, `disInputs`.

`addressing` tells how the addresses were exported: `raw` (as in the data sheet, "Show aliases" off) or `alias`
(with offset 30001/40001/10001/1, "Show aliases" on). If an address is below the offset, `raw` is detected
automatically. Otherwise the adapter asks the user, so please set it if you know it.

`directAddresses` (`true`/`false`) is only needed for **coils and discrete inputs with `"addressing": "alias"`**: it is the
instance option "Use direct addresses by aliases" at the time of the export. It changes the bit order inside each block of
16 bits (without it, alias 10001 is bit 15 of the first block, with it bit 0). For registers and raw addresses it has no effect.
If it is missing for such a file, the adapter asks the user.

```json
{
    "files": {
        "discrete-inputs.tsv": { "addressing": "alias", "directAddresses": true }
    }
}
```

### Optional: device detection

With a `detect` block in `template.json` the adapter can recognize the device ("Detect device" in the template
dialog). The adapter reads the probes from the connected device and offers the template if **all** probes match.

```json
{
    "detect": {
        "probes": [
            { "registerType": "holdingRegs", "address": 40000, "type": "string", "len": 2, "equals": "SunS" },
            { "registerType": "holdingRegs", "address": 40004, "type": "string", "len": 16, "startsWith": "Fronius" }
        ],
        "note": "SunSpec common model"
    }
}
```

* `registerType`: `holdingRegs` (function code 3) or `inputRegs` (function code 4). Only read requests are sent.
* `address`: always the **raw** address (as on the wire, without alias offset), independent of `addressing`.
* `type`: `string` (2 characters per register, `len` = number of registers, trailing `\0` and spaces are removed),
  `uint16`, `int16`, `uint32`, `int32` (big endian, high word first).
* exactly one of `equals`, `startsWith` (strings only), `oneOf` (list) or `range` (`[min, max]`).
* at most 5 probes. Use registers that identify the device: a type code, a model string, a SunSpec header.
* `"weak": true` if the probes could also match other devices. The adapter then shows the device as "possible".
* `note`: where the values come from (data sheet), for reviewers.

### Check your files before the pull request
Every pull request is validated automatically. You can do the same locally with Node.js 18 or newer:

```bash
node scripts/templates.mjs validate                       # all files
node scripts/templates.mjs validate "Wallbox/Cfos"        # one device
node scripts/templates.mjs build                          # rebuild templates.json
```

Errors (the file is not offered in the adapter):
* file is not UTF-8 encoded
* unknown or duplicate column, missing `_address`, `name` or (for registers) `type`
* a row has more or fewer columns than the header (e.g. a tab inside a description)
* address is not a number (decimal or `0x` hex), Slave ID is not 0..255
* unknown data type, missing length for strings
* `factor`, `offset`, min/max are not numbers, booleans are not `true`/`false`
* the same address with the same name twice (same state ID)

Warnings (the file is offered, but please check):
* length does not fit the data type, overlapping registers
* the same address twice with different names (fine for e.g. high and low byte)
* duplicate names, role unknown to the admin GUI, factor `0`
* register type not visible in the file name

### Generate a file for a SunSpec device
Many inverters, meters and batteries (SolarEdge, Fronius, SMA, Kostal, ...) implement the
[SunSpec](https://sunspec.org) models. `scripts/sunspec.mjs` creates the register file from the official model
definitions, so nothing has to be typed from the data sheet. Only the start address of each model is needed. You find
it in the data sheet of the device: the register with the model ID (e.g. `1` for "common", `103` for a three phase
inverter, `203` for a meter) is the start.

```json
{
    "marker": 40000,
    "models": [
        { "id": 1, "address": 40002, "prefix": "C_", "skip": ["Pad"] },
        { "id": 103, "address": 40069, "prefix": "I_" },
        { "id": 1, "address": 40121, "prefix": "M1_C_", "skip": ["Pad"] },
        { "id": 203, "address": 40188, "prefix": "M1_" }
    ]
}
```

```bash
npm run sunspec -- layout.json --out holding-registers.tsv
```

* `marker`: address of `SunS` (optional, adds this register)
* `prefix`: put in front of every name, needed if a model is used more than once (e.g. common model of the meter)
* `repeat`: number of repetitions of a repeating group, e.g. `{ "module": 2 }` for 2 MPPT trackers of model 160
* `skip`: names of points to leave out

The addresses are raw, the scale factors are converted to formulas (`x * Math.pow(10, sf['40084'])`) and the values of
enumerations are written to the description. The model definitions are loaded from
[sunspec/models](https://github.com/sunspec/models) (Apache-2.0, © SunSpec Alliance); `--models <dir>` uses local
copies of `model_N.json` instead. Please mention the source in the README of the device.

### Generate files from a Solarman definition
[ha-solarman](https://github.com/davidrapan/ha-solarman) (MIT, © David Rapan and contributors) describes many inverters
(Deye, Sofar, Solis, Afore, Kstar, ...) in YAML files. `scripts/solarman.mjs` converts such a definition:

```bash
npm install                                            # once, for the YAML parser
npm run solarman -- deye_p3 --out "PV-Wechselrichter/Deye P3"
npm run solarman -- my-definition.yaml --out out --mod 1
```

A name without `.yaml` is downloaded from `custom_components/solarman/inverter_definitions` of ha-solarman. One file
per function code is written: `holding-registers.tsv` (0x03) and `input-registers.tsv` (0x04), with raw addresses.

* `registers` lists the low word first in ha-solarman, so `[0x00B4, 0x00B5]` becomes `uint32sw` at 0x00B4
* `scale` and `offset` become factor and offset; `mask`, `bit` and `divide` a formula
* `lookup` (texts of the values) goes to the description, `validation` min/max to `minValidValue`/`maxValidValue`
* `--mod <n>`: some values differ between the models of a definition (e.g. `scale: [0.01, 0.1]` for LV and HV
  batteries). The script uses the element `n` (default 0), as the setting "mod" of ha-solarman
* computed values (`sensors`) are left out, the script lists them as warnings

If no address is below 40001 (30001 for input registers), the script prints the `template.json` entry with
`"addressing": "raw"`. Please check the result with the data sheet and mention the source in the README of the device.

### Generate the files automatically
Instead of committing the generated files, you can describe the source in `template.json`. The GitHub Action then
generates the files after the merge, commits them, and updates them once a week when the source changes:

```json
{
    "name": "Deye SUN-xK-SG04LP3",
    "generate": [
        { "source": "solarman", "definition": "deye_p3", "ref": "v25.08.16", "mod": 0, "skip": ["Device"] }
    ]
}
```

```json
{
    "name": "SolarEdge SE10K",
    "generate": [
        {
            "source": "sunspec",
            "file": "holding-registers.tsv",
            "marker": 40000,
            "models": [
                { "id": 1, "address": 40002, "prefix": "C_", "skip": ["Pad"] },
                { "id": 103, "address": 40069, "prefix": "I_" }
            ]
        }
    ]
}
```

* `solarman`: `definition` is the name in ha-solarman, `ref` a branch, tag or commit (default `main`; with a tag the
  file changes only when you change the tag), `mod` as `--mod`, `files` other file names
  (`{ "holdingRegs": "inverter.tsv", "inputRegs": "meter.tsv" }`, default `holding-registers.tsv` and
  `input-registers.tsv`)
* `sunspec`: the layout as above, `file` the file name (default `holding-registers.tsv`)
* `skip`: names of registers to leave out
* the files get `"addressing": "raw"` automatically
* do not edit generated files, they are overwritten. Change `template.json` instead.
* a generated file with errors is not written, the old file stays

In a pull request the files of a changed `template.json` are generated and validated. Locally:

```bash
npm install
npm run generate                              # all devices with "generate"
npm run generate -- "PV-Wechselrichter/Deye"  # one device
npm run generate -- --check                   # fail if a file is not up to date
```

## How to get my exports in here?
In fact there are two options

### Create a Pull request
You can use the GitHub Web editor to create a fork, add folders and files and provide a Pull Request

### Create an Issue with all Files attached
If you find this whole GitHub stuff too complicated then create an issue cin this repository and add all infos and tsv Files as attachments (please not inline as text!) there. Then we take it over
