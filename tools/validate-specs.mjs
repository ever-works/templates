#!/usr/bin/env node
/**
 * Validates every App spec in this repository against the App spec JSON Schema.
 *
 * WHAT IT CHECKS
 * --------------
 * Layer 1 (this script): the JSON Schema `schema/app-spec.schema.json` compiled with `ajv` 8 through its
 * draft 2020-12 build, with the option set the platform's own validator uses
 * (`new Ajv2020({ strict: false, allErrors: true, allowUnionTypes: true })`). YAML is parsed with the
 * `yaml` package. Both are ordinary dependencies of this repository's `package.json`.
 *
 * It also validates `manifest.json` against `schema/templates-manifest.schema.json`, so the listing and
 * the specs it points at cannot drift apart without CI noticing.
 *
 * Layer 2 (NOT here): the rules the JSON Schema cannot express — reference resolution, secrecy
 * propagation, duplicate names, RE2 compatibility, generated-length agreement and the warnings — are
 * specified in the program's `validator-rules.md` and implemented by the platform, not by this listing
 * repository. A spec that passes here is *well formed*; it is not yet *verified*.
 *
 * PROVENANCE
 * ----------
 * The Ajv core (options, `describe()` error rendering) is taken from the APW-03 build artifact
 * `_build-artifacts/apw-03-schema/evidence/validate.mjs`, which is the reference runner that proved the
 * schema against 42 fixtures. That runner is tied to the platform monorepo (it resolves `ajv` and `yaml`
 * out of `packages/agent/node_modules`); this file is the same Layer-1 check, made standalone and pointed
 * at a directory tree instead of a fixture registry.
 *
 * USAGE
 * -----
 *   npm ci
 *   node tools/validate-specs.mjs            # exit 0 iff every file is valid
 *   node tools/validate-specs.mjs --quiet    # print only failures and the summary
 *
 * Exit code is 1 when any file fails, and every failing file is named with its Ajv errors.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import Ajv2020Module from 'ajv/dist/2020.js';
import YAML from 'yaml';

const Ajv2020 = Ajv2020Module.Ajv2020 ?? Ajv2020Module.default ?? Ajv2020Module;

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const QUIET = process.argv.includes('--quiet');

/** Every App spec in the repository, by convention (see README.md §“What lives here”). */
const SPEC_GLOB = /^app-spec\.ya?ml$/;
const SKIP_DIRS = new Set(['node_modules', '.git', '.github']);

const ajv = new Ajv2020({ strict: false, allErrors: true, allowUnionTypes: true });

/** Human sentence for one Ajv error — mirrors `describeSchemaError` in the platform's schema-validator. */
function describe(error) {
	const where = error.instancePath === '' ? 'the document root' : error.instancePath;
	if (error.keyword === 'additionalProperties') {
		return `${where} has an unpermitted field "${error.params.additionalProperty}"`;
	}
	if (error.keyword === 'required') {
		return `${where} is missing the required field "${error.params.missingProperty}"`;
	}
	if (error.keyword === 'oneOf') return `${where} must match exactly one of the allowed shapes`;
	if (error.keyword === 'not') return `${where} must NOT match the forbidden shape`;
	if (error.keyword === 'const') return `${where} must be ${JSON.stringify(error.params.allowedValue)}`;
	if (error.keyword === 'enum') return `${where} must be one of ${error.params.allowedValues.join(', ')}`;
	if (error.keyword === 'pattern') return `${where} does not match ${error.params.pattern}`;
	return `${where} ${error.message}`;
}

function loadSchema(relative) {
	const file = path.join(ROOT, relative);
	if (!fs.existsSync(file)) {
		throw new Error(`schema not found: ${relative}`);
	}
	return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function walk(dir, match, found = []) {
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		if (entry.isDirectory()) {
			if (SKIP_DIRS.has(entry.name)) continue;
			walk(path.join(dir, entry.name), match, found);
		} else if (entry.isFile() && match(entry.name)) {
			found.push(path.join(dir, entry.name));
		}
	}
	return found;
}

function relative(file) {
	return path.relative(ROOT, file).replace(/\\/g, '/');
}

/* ── Layer 1: the App specs ─────────────────────────────────────────────────────────────────────── */

const appSpecSchema = loadSchema('schema/app-spec.schema.json');
const validateAppSpec = ajv.compile(appSpecSchema);
const specFiles = walk(ROOT, (name) => SPEC_GLOB.test(name)).sort();

let failures = 0;
const results = [];

for (const file of specFiles) {
	const name = relative(file);
	let document;
	try {
		document = YAML.parse(fs.readFileSync(file, 'utf8'), { uniqueKeys: true, maxAliasCount: 100 });
	} catch (error) {
		failures += 1;
		results.push({ name, ok: false, errors: [{ at: '(document root)', message: `YAML parse error: ${error.message}` }] });
		continue;
	}
	if (validateAppSpec(document)) {
		results.push({ name, ok: true, errors: [] });
		continue;
	}
	failures += 1;
	results.push({
		name,
		ok: false,
		errors: (validateAppSpec.errors ?? []).map((error) => ({
			at: error.instancePath || '/',
			message: describe(error),
		})),
	});
}

/* ── Layer 1: the listing ───────────────────────────────────────────────────────────────────────── */

const manifestFile = path.join(ROOT, 'manifest.json');
let manifestResult = null;
if (fs.existsSync(manifestFile)) {
	const manifestSchema = loadSchema('schema/templates-manifest.schema.json');
	const validateManifest = ajv.compile(manifestSchema);
	const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
	if (validateManifest(manifest)) {
		manifestResult = { name: 'manifest.json', ok: true, errors: [] };
	} else {
		failures += 1;
		manifestResult = {
			name: 'manifest.json',
			ok: false,
			errors: (validateManifest.errors ?? []).map((error) => ({
				at: error.instancePath || '/',
				message: describe(error),
			})),
		};
	}
}

/* ── Report ─────────────────────────────────────────────────────────────────────────────────────── */

const out = [];
const line = (text = '') => out.push(text);

line('Ever Works — templates listing: App spec validation');
line(`repository : ${ROOT}`);
line(`ajv options: { strict: false, allErrors: true, allowUnionTypes: true }`);
line(`schema     : schema/app-spec.schema.json  ($id ${appSpecSchema.$id})`);
line(`specs found: ${specFiles.length}`);
line();

if (!QUIET) {
	for (const result of results) {
		line(`${result.ok ? 'PASS' : 'FAIL'}  ${result.name}`);
	}
	if (manifestResult) line(`${manifestResult.ok ? 'PASS' : 'FAIL'}  ${manifestResult.name}`);
	line();
}

for (const result of results.filter((entry) => !entry.ok)) {
	line(`FAILED  ${result.name}`);
	for (const error of result.errors) line(`          ${error.at.padEnd(38)} ${error.message}`);
	line();
}
if (manifestResult && !manifestResult.ok) {
	line(`FAILED  ${manifestResult.name}`);
	for (const error of manifestResult.errors) line(`          ${error.at.padEnd(38)} ${error.message}`);
	line();
}

const passed = results.filter((entry) => entry.ok).length + (manifestResult?.ok ? 1 : 0);
line(`${passed} passed, ${failures} failed`);

process.stdout.write(`${out.join('\n')}\n`);

if (failures) {
	process.exitCode = 1;
}
