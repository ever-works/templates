# Contributing to the Ever Works templates listing

Thanks for helping. This repository is the curated listing of Ever Works App Blueprints and Website/Work
Templates. It contains **metadata only** — no application code — and every pull request here is reviewed as
a description of how some software will be built and run on other people's clusters.

## Proposing a new template

**1. Open an issue first** (recommended for anything beyond a small correction) describing the project:
what it does, its licence, its build shape (does it ship a Dockerfile? a published image? both?), and what a
minimal deployment needs. That is where the licence classification and the managed-hosting question get
settled.

**2. Create the template repository.** `ever-works/<name>-template`, **public**, topic
`ever-works-app-blueprint`, default branch `main`, with:

- `README.md` — the required headings: what the Blueprint decides, the facts and **where they were read**,
  and what is still unverified.
- `app-spec.yml` — the App spec, valid against `schema/app-spec.schema.json`.
- `.works/template.yml` — the shape (`code-bearing` or `metadata-only`) and the app source.

A `code-bearing` template is created as a **fork of the upstream project** and our metadata is added as
commits on top — never copy upstream files into a fresh repository, or upstream sync and upstream pull
requests stop working. A `metadata-only` template carries **no application source at all**.

**3. Open one pull request here** that adds:

```
<name>/
    README.md        the Blueprint's README
    app-spec.yml     the App spec, verbatim
    metadata.yml     name · repository · license · verified
```

plus the row in `manifest.json` and, when the licence is new to us, the entry in `licenses.yml`.

**4. Tag the release** `vMAJOR.MINOR.PATCH` in the template repository and put that tag in the row's
`template.ref` with the tag's commit in `template.sha`. Until a tag exists the row's `status` is
`placeholder`; publishing is what moves it to `beta` and, after a green verification run, `production`.

## What CI checks

`.github/workflows/validate.yml` runs `npm run validate` on every pull request:

1. every `app-spec.yml` in this repository is valid against `schema/app-spec.schema.json` (`ajv` 8,
   draft 2020-12), and
2. `manifest.json` is valid against `schema/templates-manifest.schema.json`.

A failing file is named with its errors, and the job exits non-zero. Run the same check locally before you
push:

```bash
npm install
npm run validate
```

## Rules that are not negotiable

- **No secrets, tokens, generated credentials or real addresses — ever, in any template repository or
  here.** A Blueprint never contains a credential: values are prompted or generated per App Work.
- **A `metadata-only` template never contains application source.**
- **A `code-bearing` template contains exactly one thing that is not ours: the upstream project itself, as
  a fork.** Everything we add is metadata.
- **Never edit an upstream file to work around a product limit.** That is what overlay files and the App
  spec are for.
- **The three licence classes are fixed.** A pull request that loosens `green`/`amber`/`red` is rejected by
  the platform, which keeps its last good copy of the registry.
- **Count what you cannot verify as unverified.** A `README.md` that says "verified" when nothing has run on
  a cluster is worse than one that says "unverified" — the verification lane, not the prose, is what changes
  a Blueprint's `verified` flag.
- **Never remove a row to fix a problem.** Mark it `deprecated` and say why; removing it strands every App
  Work already created from it.

## Changing an existing template

Open a pull request that changes the Blueprint folder and the matching `manifest.json` row **in the same
commit**, and bump `blueprint.version` whenever the App spec changes. A licence change also needs the
`licenses.yml` entry updated and a maintainer review.

## Commit messages

Short imperative subject, and a body line:

```
Refs: ever-works/ever-works App Works program
```
