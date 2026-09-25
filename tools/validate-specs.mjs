#!/usr/bin/env node
/**
 * Validates the templates listing and the App specs of the template repositories it lists.
 *
 * This repository is a LISTING. It holds no copy of any template: every template is its own repository,
 * `ever-works/<name>-template`, and that repository's `.works/works.yml` is the only App spec there is.
 * So this script checks the listing locally and the specs where they live.
 *
 * WHAT IT CHECKS
 * --------------
 * 1. `manifest.json` against `schema/templates-manifest.schema.json`, plus the two rules the schema cannot
 *    express: `slug` is unique, and `blueprint.id` is unique among app rows.
 * 2. For every row with `kind: app`: `.works/works.yml` is fetched from the row's `template.repo` at
 *    `template.sha` (when pinned) or else `template.ref`. Its root `kind` must be `app` (the platform's
 *    Blueprint resolver requires it, and its validator does not check the root kind), `spec.kind`, when
 *    present, must agree, and the `spec` block must be valid against `schema/app-spec.schema.json` — a
 *    verbatim copy of the platform's published App spec schema (`app-spec.v1.schema.json`), which describes
 *    the `spec` block, not the envelope. The file must also agree with the row: `spec.blueprint.id`,
 *    `spec.blueprint.repo` and `spec.license.spdx` must match (always an error), and
 *    `spec.blueprint.version` must match (an error for a released row, a warning for a placeholder).
 * 3. For the same rows, `.works/template.yml` (when present) must agree with the row's `shape` and name one of
 *    the row's upstreams as `source.repo` — an error for a released row, a warning for a placeholder,
 *    because a placeholder row may record the shape the template takes once it is released.
 *
 * A missing file (HTTP 404) is an ERROR for a row whose status is not `placeholder`, and a WARNING for a
 * `placeholder` row (its repository may not exist yet, or may not be public yet). Any other HTTP or network
 * failure is an error: "we could not look" is never reported as "valid". Website rows carry no App spec and
 * are listed as skipped.
 *
 * The JSON Schema layer uses `ajv` 8 through its draft 2020-12 build with the option set the platform's own
 * validator uses (`new Ajv2020({ strict: false, allErrors: true, allowUnionTypes: true })`); YAML is parsed
 * with the `yaml` package. The rules JSON Schema cannot express (reference resolution, secrecy propagation,
 * duplicate names, the blueprint-mode rules) are the platform's, not this repository's: a spec that passes
 * here is *well formed*, not *verified*.
 *
 * FETCHING
 * --------
 * Files are read from `https://raw.githubusercontent.com/<repo>/<ref>/<path>`. When `GITHUB_TOKEN` (or
 * `GH_TOKEN`) is set it is sent as a bearer token, which raises the rate limit; it is only ever sent to
 * raw.githubusercontent.com. Only repositories inside the catalog organization are fetched — the manifest
 * schema already restricts `template.repo` to `ever-works/…`.
 *
 * USAGE
 * -----
 *   npm ci
 *   node tools/validate-specs.mjs            # exit 0 iff nothing failed (warnings do not fail)
 *   node tools/validate-specs.mjs --quiet    # print only failures, warnings and the summary
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

const RAW_BASE = 'https://raw.githubusercontent.com';
const SPEC_PATH = '.works/works.yml';
const TEMPLATE_PATH = '.works/template.yml';
const TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';
const FETCH_TIMEOUT_MS = 20_000;
const FETCH_ATTEMPTS = 3;
const SAFE_REPO = /^ever-works\/[a-z0-9-]+$/;
const SAFE_REF = /^[A-Za-z0-9._\/-]{1,100}$/;

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

function ajvErrors(validate) {
	return (validate.errors ?? []).map((error) => ({ at: error.instancePath || '/', message: describe(error) }));
}

function loadJson(relative) {
	const file = path.join(ROOT, relative);
	if (!fs.existsSync(file)) {
		throw new Error(`not found: ${relative}`);
	}
	return JSON.parse(fs.readFileSync(file, 'utf8'));
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * GET one file from a repository. Resolves to `{ status: 'ok', text }`, `{ status: 'missing' }` (404) or
 * `{ status: 'error', message }` after {@link FETCH_ATTEMPTS} tries on a network error, 429 or 5xx.
 */
async function fetchRepoFile(repo, ref, file) {
	const url = `${RAW_BASE}/${repo}/${encodeURIComponent(ref).replace(/%2F/g, '/')}/${file}`;
	const headers = { 'user-agent': 'ever-works-templates-validate' };
	if (TOKEN) headers.authorization = `Bearer ${TOKEN}`;
	let last = '';
	for (let attempt = 1; attempt <= FETCH_ATTEMPTS; attempt += 1) {
		try {
			const response = await fetch(url, { headers, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
			if (response.ok) return { status: 'ok', url, text: await response.text() };
			if (response.status === 404) return { status: 'missing', url };
			last = `HTTP ${response.status} ${response.statusText}`.trim();
			if (response.status !== 429 && response.status < 500) break;
		} catch (error) {
			last = error?.cause?.message ?? error?.message ?? String(error);
		}
		if (attempt < FETCH_ATTEMPTS) await sleep(1000 * attempt);
	}
	return { status: 'error', url, message: last };
}

function parseYaml(text) {
	return YAML.parse(text, { uniqueKeys: true, maxAliasCount: 100 });
}

/* ── 1. The listing ─────────────────────────────────────────────────────────────────────────────── */

const manifestSchema = loadJson('schema/templates-manifest.schema.json');
const appSpecSchema = loadJson('schema/app-spec.schema.json');
const validateManifest = ajv.compile(manifestSchema);
const validateAppSpec = ajv.compile(appSpecSchema);

const manifest = loadJson('manifest.json');
const results = [];

{
	const errors = validateManifest(manifest) ? [] : ajvErrors(validateManifest);
	const rows = Array.isArray(manifest.templates) ? manifest.templates : [];
	const seen = new Map();
	const seenBlueprint = new Map();
	rows.forEach((row, index) => {
		if (typeof row?.slug === 'string') {
			if (seen.has(row.slug)) {
				errors.push({ at: `/templates/${index}/slug`, message: `duplicate slug "${row.slug}" (also /templates/${seen.get(row.slug)})` });
			} else seen.set(row.slug, index);
		}
		const id = row?.kind === 'app' ? row?.blueprint?.id : undefined;
		if (typeof id === 'string') {
			if (seenBlueprint.has(id)) {
				errors.push({ at: `/templates/${index}/blueprint/id`, message: `duplicate blueprint.id "${id}" (also /templates/${seenBlueprint.get(id)})` });
			} else seenBlueprint.set(id, index);
		}
	});
	results.push({ name: 'manifest.json', outcome: errors.length ? 'FAIL' : 'PASS', errors, warnings: [] });
}

/* ── 2 + 3. Each app row's own spec, in its own repository ──────────────────────────────────────── */

async function checkAppRow(row) {
	const name = `${row.slug} → ${row.template?.repo ?? '(no repository)'}`;
	const placeholder = row.status === 'placeholder';
	const errors = [];
	const warnings = [];
	/** Row/repository disagreement: an error once released, a warning while a placeholder. */
	const drift = (entry) => (placeholder ? warnings : errors).push(entry);

	const repo = row.template?.repo;
	const ref = row.template?.sha || row.template?.ref || 'HEAD';
	if (!repo) {
		(placeholder ? warnings : errors).push({ at: 'template.repo', message: 'no repository named, nothing to fetch' });
		return { name, outcome: placeholder ? 'WARN' : 'FAIL', errors, warnings };
	}
	if (!SAFE_REPO.test(repo) || !SAFE_REF.test(ref)) {
		errors.push({ at: 'template', message: `refusing to fetch ${repo}@${ref}: not an ever-works repository or not a plain ref` });
		return { name, outcome: 'FAIL', errors, warnings };
	}
	const label = `${repo}@${ref}`;

	const spec = await fetchRepoFile(repo, ref, SPEC_PATH);
	if (spec.status === 'missing') {
		const entry = { at: SPEC_PATH, message: `not found at ${label} (HTTP 404: missing file, missing ref, or a repository that does not exist or is not public)` };
		(placeholder ? warnings : errors).push(entry);
		return { name, outcome: placeholder ? 'WARN' : 'FAIL', errors, warnings };
	}
	if (spec.status === 'error') {
		errors.push({ at: SPEC_PATH, message: `could not be read at ${label}: ${spec.message}` });
		return { name, outcome: 'FAIL', errors, warnings };
	}

	let document;
	try {
		document = parseYaml(spec.text);
	} catch (error) {
		errors.push({ at: SPEC_PATH, message: `YAML parse error: ${error.message}` });
		return { name, outcome: 'FAIL', errors, warnings };
	}
	const isMapping = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
	if (!isMapping(document)) {
		errors.push({ at: SPEC_PATH, message: 'the document is not a YAML mapping' });
		return { name, outcome: 'FAIL', errors, warnings };
	}
	if (document.kind !== 'app') {
		errors.push({ at: `${SPEC_PATH} /kind`, message: `is ${JSON.stringify(document.kind)}; an App Blueprint's root kind must be "app"` });
	}
	if (!isMapping(document.spec)) {
		errors.push({ at: `${SPEC_PATH} /spec`, message: 'is missing or not a mapping' });
	} else {
		if (document.spec.kind !== undefined && document.spec.kind !== document.kind) {
			errors.push({ at: `${SPEC_PATH} /spec/kind`, message: `is ${JSON.stringify(document.spec.kind)}, the root kind is ${JSON.stringify(document.kind)} (kind_mismatch)` });
		}
		if (!validateAppSpec(document.spec)) {
			for (const error of validateAppSpec.errors ?? []) {
				const scoped = { ...error, instancePath: `/spec${error.instancePath}` };
				errors.push({ at: `${SPEC_PATH} ${scoped.instancePath}`, message: describe(scoped) });
			}
		}
	}

	const blueprint = document?.spec?.blueprint ?? {};
	if (row.blueprint?.id !== undefined && blueprint.id !== row.blueprint.id) {
		errors.push({ at: `${SPEC_PATH} /spec/blueprint/id`, message: `is ${JSON.stringify(blueprint.id)}, the row says ${JSON.stringify(row.blueprint.id)}` });
	}
	if (blueprint.repo !== repo) {
		errors.push({ at: `${SPEC_PATH} /spec/blueprint/repo`, message: `is ${JSON.stringify(blueprint.repo)}, the row's template.repo is ${JSON.stringify(repo)}` });
	}
	const spdx = document?.spec?.license?.spdx;
	if (row.license?.spdx && spdx !== undefined && spdx !== row.license.spdx) {
		errors.push({ at: `${SPEC_PATH} /spec/license/spdx`, message: `is ${JSON.stringify(spdx)}, the row says ${JSON.stringify(row.license.spdx)}` });
	}
	if (row.blueprint?.version && blueprint.version !== row.blueprint.version) {
		drift({ at: `${SPEC_PATH} /spec/blueprint/version`, message: `is ${JSON.stringify(blueprint.version)}, the row says ${JSON.stringify(row.blueprint.version)}` });
	}

	const template = await fetchRepoFile(repo, ref, TEMPLATE_PATH);
	if (template.status === 'missing') {
		warnings.push({ at: TEMPLATE_PATH, message: `not found at ${label}; shape and app source not cross-checked` });
	} else if (template.status === 'error') {
		errors.push({ at: TEMPLATE_PATH, message: `could not be read at ${label}: ${template.message}` });
	} else {
		let meta;
		try {
			meta = parseYaml(template.text);
		} catch (error) {
			errors.push({ at: TEMPLATE_PATH, message: `YAML parse error: ${error.message}` });
		}
		if (meta) {
			if (row.shape && meta.shape !== row.shape) {
				drift({ at: `${TEMPLATE_PATH} /shape`, message: `is ${JSON.stringify(meta.shape)}, the row says ${JSON.stringify(row.shape)}` });
			}
			const upstreams = (Array.isArray(row.upstreams) ? row.upstreams : [])
				.map((upstream) => (typeof upstream?.repo === 'string' ? upstream.repo.toLowerCase() : ''))
				.filter(Boolean);
			const source = typeof meta.source?.repo === 'string' ? meta.source.repo.toLowerCase() : undefined;
			if (upstreams.length && !upstreams.includes(source)) {
				drift({ at: `${TEMPLATE_PATH} /source/repo`, message: `is ${JSON.stringify(meta.source?.repo)}, not one of the row's upstreams (${upstreams.join(', ')})` });
			}
		}
	}

	return { name, outcome: errors.length ? 'FAIL' : warnings.length ? 'WARN' : 'PASS', errors, warnings, source: label };
}

const rows = Array.isArray(manifest.templates) ? manifest.templates : [];
for (const row of rows) {
	if (row?.kind !== 'app') {
		results.push({ name: `${row?.slug ?? '(row)'} → ${row?.template?.repo ?? '(no repository)'}`, outcome: 'SKIP', errors: [], warnings: [], why: `kind ${row?.kind}: no App spec` });
		continue;
	}
	results.push(await checkAppRow(row));
}

/* ── Report ─────────────────────────────────────────────────────────────────────────────────────── */

const out = [];
const line = (text = '') => out.push(text);

line('Ever Works — templates listing: manifest + template App specs');
line(`repository : ${ROOT}`);
line(`ajv options: { strict: false, allErrors: true, allowUnionTypes: true }`);
line(`schemas    : schema/templates-manifest.schema.json; schema/app-spec.schema.json for the spec block ($id ${appSpecSchema.$id})`);
line(`specs from : ${RAW_BASE}/<template.repo>/<template.sha || template.ref>/${SPEC_PATH} (token: ${TOKEN ? 'yes' : 'no'})`);
line();

if (!QUIET) {
	for (const result of results) {
		const detail = result.why ?? result.source ?? '';
		line(`${result.outcome.padEnd(4)}  ${result.name}${detail ? `  (${detail})` : ''}`);
	}
	line();
}

for (const result of results.filter((entry) => entry.errors.length)) {
	line(`FAILED  ${result.name}`);
	for (const error of result.errors) line(`          ${error.at.padEnd(38)} ${error.message}`);
	line();
}
for (const result of results.filter((entry) => entry.warnings.length)) {
	line(`WARNING ${result.name}`);
	for (const warning of result.warnings) line(`          ${warning.at.padEnd(38)} ${warning.message}`);
	line();
}

const count = (outcome) => results.filter((entry) => entry.outcome === outcome).length;
line(`${count('PASS')} passed, ${count('WARN')} passed with warnings, ${count('SKIP')} skipped, ${count('FAIL')} failed`);

process.stdout.write(`${out.join('\n')}\n`);

if (count('FAIL')) {
	process.exitCode = 1;
}
