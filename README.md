# Ever Works — templates

**This is the listing of the templates Ever Works offers — a human index, not the machine source of truth.**
Every template is its own repository, named `ever-works/<name>-template`, and that repository is the only
place its App spec, its shape and its documentation live. This repository lists them: one row per template
repository in [`manifest.json`](./manifest.json), the licence registry in [`licenses.yml`](./licenses.yml),
the schemas both are checked against, and the CI that checks them. It holds **no application code and no
copy of any template**.

> **Status: seed.** The App Blueprint rows are marked `placeholder`: their template repositories exist, but
> none has been released (tagged) or verified on a cluster yet. The four Website/Work Template rows are in
> production.

---

## The templates

### App Blueprints

| Template | Upstream project | License | Install shape | Status | Template repository |
| --- | --- | --- | --- | --- | --- |
| Cal (community build) | [`calcom/cal.diy`](https://github.com/calcom/cal.diy) | MIT | `metadata-only` | `placeholder` | [`ever-works/cal-template`](https://github.com/ever-works/cal-template) |
| Umami | [`umami-software/umami`](https://github.com/umami-software/umami) | MIT | `metadata-only` | `placeholder` | [`ever-works/umami-template`](https://github.com/ever-works/umami-template) |

**Cal** is open-source scheduling. Its Blueprint targets the upstream's **community edition** —
`calcom/cal.diy`, which the upstream calls *Cal.diy* — carries the trademark notice the upstream requires,
and is **not** offered for managed hosting: upstream recommends personal, non-production use, so it stays on
the user's own cluster. Its template repository holds our metadata only, so creating an App Work forks
`calcom/cal.diy` and records the template as provenance; re-creating the template as a public fork of the
upstream (`code-bearing`) remains a future option.

**Umami** is privacy-first, cookieless web analytics. Its Blueprint deploys the upstream's published
container image pinned by digest, so a run spends no build minutes.

### Website/Work Templates

| Template | Template repository | License | Status |
| --- | --- | --- | --- |
| Directory (Next.js) | [`ever-works/directory-web-template`](https://github.com/ever-works/directory-web-template) | AGPL-3.0-only | `production` |
| Directory (Minimal, Astro) | [`ever-works/directory-web-minimal-template`](https://github.com/ever-works/directory-web-minimal-template) | AGPL-3.0-only | `production` |
| Website (Next.js) | [`ever-works/web-template`](https://github.com/ever-works/web-template) | AGPL-3.0-only | `production` |
| Website (Minimal, Astro) | [`ever-works/web-minimal-template`](https://github.com/ever-works/web-minimal-template) | AGPL-3.0-only | `production` |

---

## What an App Blueprint is

An **App Blueprint** is a reviewable, versioned description of *how to build and run a specific open-source
application* on Ever Works. It is the App spec — a `works.yml` document — that names the build strategy, the
runtime components, the probes, the dependencies, the environment, the jobs, the cron calls, the smoke tests
and the domain behaviour of one app, plus a `README.md` that records **where each fact was read** in the
upstream project and what is still unverified.

A Blueprint deliberately contains **no upstream source**. It is metadata: the smallest artifact that lets
the platform stand an app up reproducibly, and the artifact a reviewer can actually read.

**All of it lives in the template repository**, never here:

| File in `ever-works/<name>-template` | What it is |
| --- | --- |
| `.works/works.yml` | The App spec — the file the platform's Blueprint resolver reads and applies. |
| `.works/template.yml` | The repository's shape (`code-bearing` or `metadata-only`) and its app source. |
| `README.md` | The human document: what the Blueprint decides, the facts and where they were read, and what is still unverified. |

The platform accepts a repository as a Blueprint only when it is inside the `ever-works` organization and
**public**, carries the topic `ever-works-app-blueprint`, has a `.works/works.yml` that validates with
`spec.blueprint.repo` naming that very repository, and declares a licence that does not classify `red`.

---

## Ever Works can run any GitHub project as a Work

You do not need a Blueprint to use Ever Works, and you do not need one for a project to be *runnable*:

- **Paste any GitHub repository URL** into the create flow and Ever Works runs it as a **Work**. Nothing has
  to be listed here first. If a Blueprint matches the URL, it is applied; if none does, the **App
  Provisioner** studies the repository, writes an App spec for it, and offers it back as a proposed
  Blueprint.
- **A listed Blueprint is curation, not a gate.** Being listed means the template is badged, searchable,
  pinned to a reviewed revision, classified by licence, and eligible (or not) for managed hosting.
- **A template becomes usable the moment its `-template` repository exists** and carries valid metadata; a
  row in this listing is what makes it *listed*.

---

## Install shapes

`Install shape` decides how many repositories are forked when you create an App Work from the template:

| Shape | What the template repository holds | What provisioning forks |
| --- | --- | --- |
| `code-bearing` | The whole application, kept as a fork of the original project with our metadata on top. | **One fork** — the template itself, and that fork is the Work's repository. |
| `metadata-only` | Our metadata only. The application source is a separate repository. | **Two forks** — the app source first (the Work's repository), then the template (recorded as provenance). |

---

## Licence classes

Every row records the licence the running application is under (`license.spdx`) and its class, from the
registry in [`licenses.yml`](./licenses.yml). The three classes are fixed — no pull request here may loosen
one, and the platform keeps its last good copy of the registry if one tries:

| Class | Managed hosting on Ever Works | On the user's own cluster |
| --- | --- | --- |
| `green` | Allowed. Permissive and copyleft licences, AGPL included. | Allowed. |
| `amber` | Only with a recorded upstream agreement. | Allowed, with an attestation. |
| `red` | Never — and never listed in the catalog. | Allowed, with an attestation. |

A licence the registry cannot identify is treated as `amber`.

---

## What is in this repository

| Path | What it is |
| --- | --- |
| [`manifest.json`](./manifest.json) | The listing: one row per template repository — name, summary, kind, status, install shape, app source, pin, licence, managed-hosting decision, verification flag. |
| [`licenses.yml`](./licenses.yml) | The licence registry the platform's licence gate reads. |
| [`schema/templates-manifest.schema.json`](./schema/templates-manifest.schema.json) | The schema `manifest.json` is validated against. |
| [`schema/app-spec.schema.json`](./schema/app-spec.schema.json) | The App spec schema the `spec` block of each listed template repository's `.works/works.yml` is validated against. |
| [`tools/validate-specs.mjs`](./tools/validate-specs.mjs) | The check itself. |
| [`.github/workflows/validate.yml`](./.github/workflows/validate.yml) | Runs the check on every pull request, on every push to `main`, weekly, and on demand. |

`schema/app-spec.schema.json` is a verbatim copy of the platform's published App spec schema,
`packages/agent/src/works-config/schema/app-spec.v1.schema.json` in `ever-works/ever-works` (branch
`feat/app-works-implementation`, commit `c7ca76c`); refresh it by copying that file again, never by editing it here.

## What CI checks

[`tools/validate-specs.mjs`](./tools/validate-specs.mjs) — `ajv` 8, draft 2020-12:

1. `manifest.json` is valid against `schema/templates-manifest.schema.json`, and its slugs and Blueprint ids
   are unique.
2. For every app row, `.works/works.yml` is fetched **from the row's own template repository**, at
   `template.sha` when the row is pinned and `template.ref` otherwise. Its root `kind` must be `app` (as the
   platform's Blueprint resolver requires) and its `spec` block must be valid against
   `schema/app-spec.schema.json`. Its `spec.blueprint.id`, `spec.blueprint.repo`, `spec.license.spdx` and
   `spec.blueprint.version` must agree with the row, and its `.works/template.yml` with the row's install
   shape and upstream.
3. A missing file fails the run for a released row; for a `placeholder` row it is a warning.

The template repositories change without a pull request here, so the workflow also runs every Monday: a
template that drifts away from its row turns the listing red.

A spec that passes here is *well formed*, not *verified*: the rules JSON Schema cannot express, and the
verification runs on a cluster, belong to the platform.

---

## Proposing a template

See [`CONTRIBUTING.md`](./CONTRIBUTING.md).

---

## License

This repository's own content is **MIT** — see [`LICENSE`](./LICENSE). Each template repository carries its
own licence, and each row additionally records the **upstream project's** licence, because that is the
licence the running application is under.
