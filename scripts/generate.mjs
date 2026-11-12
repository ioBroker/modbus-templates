#!/usr/bin/env node
/**
 * Generates register files from the "generate" block of template.json, so a device can be described by its source
 * (SunSpec models, ha-solarman definition) instead of a hand-made TSV file.
 *
 * {
 *     "generate": [
 *         { "source": "sunspec", "marker": 40000, "models": [{ "id": 1, "address": 40002 }, { "id": 103, "address": 40069 }] },
 *         { "source": "solarman", "definition": "deye_p3", "ref": "v25.08.16", "mod": 0, "skip": ["Device"] }
 *     ]
 * }
 *
 * - sunspec: the layout as for scripts/sunspec.mjs, written to `file` (default holding-registers.tsv)
 * - solarman: `definition` in ha-solarman, `ref` branch/tag/commit (default main), `mod` model variant,
 *   `files` other file names ({ "holdingRegs": "...", "inputRegs": "..." })
 * - `skip`: names of registers to leave out
 *
 * The GitHub Action runs this after every merge into main and once a week (so changes of the sources arrive) and
 * commits the files. A generated file with errors is not written, the old one stays.
 *
 * Usage:
 *   node scripts/generate.mjs [device folder ...]   generate all devices (or only the given ones)
 *   node scripts/generate.mjs --check               do not write, fail if a file is not up to date
 *   --models <dir>                                  local copies of the SunSpec model_N.json
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, relative, sep, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { loadAllManifests, generatedFiles, validateFile } from './templates.mjs';
import { convertLayout, createModelLoader, toTsv as sunspecTsv } from './sunspec.mjs';
import { convertDefinition, loadDefinitionText, toTsv as solarmanTsv } from './solarman.mjs';

/**
 * Converts one entry of "generate".
 *
 * @param loaders `{ loadModel(id), loadDefinition(name, ref) }`
 * @returns {Promise<{ files: { file: string, registerType: string, content: string, rows: number }[], warnings: string[] }>}
 */
export async function generateEntry(entry, loaders) {
    const names = Object.fromEntries(generatedFiles({ generate: [entry] }).map(g => [g.registerType, g.file]));
    const skip = new Set(entry.skip || []);
    const used = new Set();
    const keep = rows =>
        rows.filter(row => {
            if (skip.has(row.name)) {
                used.add(row.name);
                return false;
            }
            return true;
        });

    let rowsByType;
    let toTsv;
    let warnings;
    if (entry.source === 'sunspec') {
        const result = await convertLayout({ marker: entry.marker, models: entry.models }, loaders.loadModel);
        rowsByType = { holdingRegs: result.rows };
        toTsv = rows => sunspecTsv(rows);
        warnings = result.warnings;
    } else if (entry.source === 'solarman') {
        const text = await loaders.loadDefinition(entry.definition, entry.ref || 'main');
        const result = convertDefinition(YAML.parse(text), { mod: entry.mod || 0 });
        rowsByType = result.files;
        toTsv = solarmanTsv;
        warnings = result.warnings;
    } else {
        throw new Error(`Unknown source "${entry.source}"`);
    }

    const files = [];
    for (const [registerType, all] of Object.entries(rowsByType)) {
        const rows = keep(all);
        if (rows.length && names[registerType]) {
            files.push({ file: names[registerType], registerType, content: toTsv(rows, registerType), rows: rows.length });
        }
    }
    for (const name of skip) {
        if (!used.has(name)) {
            warnings.push(`skip: "${name}" not found`);
        }
    }
    return { files, warnings };
}

/**
 * Generates all files of one device and validates them. Files with errors are not returned.
 *
 * @returns {Promise<{ files: { path: string, content: string, rows: number }[], warnings: string[], errors: string[] }>}
 */
export async function generateDevice(devicePath, manifest, loaders) {
    const result = { files: [], warnings: [], errors: [] };
    for (const [i, entry] of (manifest.generate || []).entries()) {
        const at = `generate[${i}] (${entry.source}${entry.definition ? ` ${entry.definition}` : ''})`;
        let generated;
        try {
            generated = await generateEntry(entry, loaders);
        } catch (e) {
            result.errors.push(`${at}: ${e.message}`);
            continue;
        }
        result.warnings.push(...generated.warnings.map(w => `${at}: ${w}`));
        for (const { file, content, rows } of generated.files) {
            const path = `${devicePath}/${file}`;
            const check = validateFile(path, Buffer.from(content, 'utf8'), manifest.files?.[file]);
            const errors = check.issues.filter(issue => issue.level === 'error');
            if (errors.length) {
                result.errors.push(...errors.map(e => `${file}${e.line ? ` line ${e.line}` : ''}: ${e.message}`));
            } else {
                result.files.push({ path, content, rows });
            }
        }
    }
    return result;
}

function toPosix(p) {
    return p.split(sep).join(posix.sep);
}

async function main(argv) {
    const args = argv.slice(2);
    const option = name => {
        const i = args.indexOf(name);
        return i === -1 ? undefined : args.splice(i, 2)[1];
    };
    const modelsDir = option('--models');
    const check = args.includes('--check');
    const { root, manifests, issues } = loadAllManifests();
    const only = args
        .filter(a => !a.startsWith('--'))
        .map(a => toPosix(relative(root, join(process.cwd(), a))).replace(/\/$/, ''));

    const devices = Object.entries(manifests).filter(
        ([devicePath, manifest]) =>
            manifest.generate && (!only.length || only.some(o => devicePath === o || devicePath.startsWith(`${o}/`))),
    );
    const gh = !!process.env.GITHUB_ACTIONS;
    const report = (level, file, message) => {
        console.log(`  ${level.padEnd(7)} ${message}`);
        if (gh) {
            console.log(`::${level} file=${file}::${message.replace(/%/g, '%25').replace(/\r?\n/g, '%0A')}`);
        }
    };

    const loaders = { loadModel: createModelLoader(modelsDir), loadDefinition: loadDefinitionText };
    let failed = false;
    let written = 0;
    for (const [devicePath, manifest] of devices) {
        console.log(devicePath);
        const manifestFile = `${devicePath}/template.json`;
        const manifestErrors = issues.filter(i => i.file === manifestFile && i.level === 'error');
        if (manifestErrors.length) {
            manifestErrors.forEach(i => report('error', manifestFile, i.message));
            failed = true;
            continue;
        }
        const result = await generateDevice(devicePath, manifest, loaders);
        result.warnings.forEach(w => report('warning', manifestFile, w));
        result.errors.forEach(e => report('error', manifestFile, e));
        failed ||= result.errors.length > 0;
        for (const { path, content, rows } of result.files) {
            const target = join(root, path);
            const old = existsSync(target) ? readFileSync(target, 'utf8') : null;
            if (old === content) {
                console.log(`  ok      ${path}: ${rows} registers, up to date`);
            } else if (check) {
                report('error', path, `${path} is not up to date, run "npm run generate"`);
                failed = true;
            } else {
                writeFileSync(target, content);
                written++;
                console.log(`  written ${path}: ${rows} registers`);
            }
        }
    }
    console.log(`\n${devices.length} device(s) with "generate", ${written} file(s) written.`);
    if (failed) {
        process.exitCode = 1;
    }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
    main(process.argv).catch(e => {
        console.error(e.message);
        process.exit(1);
    });
}
