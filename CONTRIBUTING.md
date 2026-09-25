# Contributing to the Ever Works templates listing

Thanks for helping. This repository is the **listing** of Ever Works App Blueprints and Website/Work
Templates: a human index of the templates we keep. It contains **metadata about templates only** — no
application code, and no copy of any template. Every template is its own repository,
`ever-works/<name>-template`, and its App spec, shape and documentation live there and nowhere else.

So there are two kinds of change, in two places:

| You want to change… | Open the pull request in… |
| --- | --- |
| A template's App spec (`.works/works.yml`), shape (`.works/template.yml`) or documentation (`README.md`) | the template repository, `ever-works/<name>-template` |
| Whether and how a template is **listed** — its row: name, summary, status, install shape, pin, licence class, managed-hosting decision, verification flag | this repository: `manifest.json` (and `licenses.yml` when the licence is new to us) |

## Proposing a new template

**1. Open an issue first** (recommended for anything beyond a small correction) describing the project:
what it does, its licence, its build shape (does it ship a Dockerfile? a published image? both?), and what a
minimal deployment needs. That is where the licence classification and the managed-hosting question get
settled.

**2. Create the template repository.** `ever-works/<name>-template`, **public**, topic
`ever-works-app-blueprint`, default branch `main`, with:

- `.works/works.yml` — the App spec, valid against [`schema/app-spec.schema.json`](./schema/app-spec.schema.json),
  with `spec.blueprint.id` = the row's `blueprint.id` and `spec.blueprint.repo` = the repository itself.
- `.works/template.yml` — the shape (`code-bearing` or `metadata-only`) and the app source.
- `README.md` — the required headings: what the Blueprint decides, the facts and **where they were read**,
  and what is still unverified.

A `code-bearing` template is created as a **fork of the upstream project** and our metadata is added as
commits on top — never copy upstream files into a fresh repository, or upstream sync and upstream pull
requests stop working. A `metadata-only` template carries **no application source at all**.

**3. Open one pull request here** that adds the template's row to `manifest.json` — `status: placeholder`,
`template.ref` the default branch, `template.sha` `null` — and, when the licence is new to us, its entry in
`licenses.yml`. Nothing else: no folder, no README copy, no spec copy. Add the template to the table in
`README.md` with a link to its repository.

**4. Release.** Tag `vMAJOR.MINOR.PATCH` (= `blueprint.version`) in the template repository, then open a pull
request here that puts the tag in the row's `template.ref` and the tag's commit in `template.sha`. Until a tag
exists the row's `status` is `placeholder`; publishing is what moves it to `beta` and, after a green
verification run on a cluster, `production`. The schema refuses a `beta` or `production` app row without a
40-hex `template.sha`.

## Changing an existing template

Change the spec or the documentation **in the template repository**. When that changes something the row
records — `blueprint.version`, the licence, the install shape, the upstream — open the matching pull request
here as well. CI fetches the template's own `.works/works.yml` and compares it with the row, so a row that no
longer matches its template is reported: as a warning while the row is a `placeholder`, as a failure once it
is released. A licence change also needs the `licenses.yml` entry updated and a maintainer review.

## What CI checks

[`.github/workflows/validate.yml`](./.github/workflows/validate.yml) runs `npm run validate`
([`tools/validate-specs.mjs`](./tools/validate-specs.mjs), `ajv` 8, draft 2020-12) on every pull request,
on every push to `main`, every Monday, and on demand:

1. `manifest.json` is valid against `schema/templates-manifest.schema.json`, and slugs and Blueprint ids are
   unique.
2. For every app row, `.works/works.yml` is fetched from the row's template repository — at `template.sha`
   when pinned, else at `template.ref` — and validated against `schema/app-spec.schema.json`. Its
   `spec.blueprint.id`, `spec.blueprint.repo` and `spec.license.spdx` must match the row (always an error);
   `spec.blueprint.version`, and the `shape` and `source.repo` of `.works/template.yml`, must match too (an
   error once released, a warning for a `placeholder`).
3. A missing `.works/works.yml` (HTTP 404) fails the run for a released row and is a warning for a
   `placeholder` row. Any other fetch failure fails the run.

Every failure is named with its errors, and the job exits non-zero. Run the same check locally before you
push (it reads the template repositories over the network; set `GITHUB_TOKEN` to raise the rate limit):

```bash
npm ci
npm run validate
```

## Rules that are not negotiable

- **No copies here.** A template's spec, shape and documentation live only in its own repository; this
  listing links to it.
- **No secrets, tokens, generated credentials or real addresses — ever, in any template repository or
  here.** A Blueprint never contains a credential: values are prompted or generated per App Work.
- **A `metadata-only` template never contains application source.**
- **A `code-bearing` template contains exactly one thing that is not ours: the upstream project itself, as
  a fork.** Everything we add is metadata.
- **Never edit an upstream file to work around a product limit.** That is what overlay files and the App
  spec are for.
- **The three licence classes are fixed.** A pull request that loosens `green`/`amber`/`red` is rejected by
  the platform, which keeps its last good copy of the registry.
- **Count what you cannot verify as unverified.** A row or README that says "verified" when nothing has run
  on a cluster is worse than one that says "unverified" — the verification lane, not the prose, is what
  changes a Blueprint's `verified` flag.
- **Never remove a row to fix a problem.** Mark it `deprecated` and say why; removing it strands every App
  Work already created from it.

## Commit messages

Short imperative subject, and a body line:

```
Refs: ever-works/ever-works App Works program
```
