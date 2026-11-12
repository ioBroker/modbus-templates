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

## How to get my exports in here?
In fact there are two options

### Create a Pull request
You can use the GitHub Web editor to create a fork, add folders and files and provide a Pull Request

### Create an Issue with all Files attached
If you find this whole GitHub stuff too complicated then create an issue cin this repository and add all infos and tsv Files as attachments (please not inline as text!) there. Then we take it over
