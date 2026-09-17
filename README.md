# Ever Works — templates

**This is the curated listing of the templates Ever Works offers.** It is a *metadata* repository: it holds
one folder per template — the Blueprint's `README.md`, its App spec, and a small `metadata.yml` — plus the
machine-readable listing (`manifest.json`) that the platform curates from. It holds **no application code**.

> **Status: seed.** The three App Blueprint rows below and in `manifest.json` are marked `placeholder`: the
> template repositories exist, but none has been released or verified on a cluster yet. The four
> Website/Work Template rows in `manifest.json` are in production.

---

## What an App Blueprint is

An **App Blueprint** is a reviewable, versioned description of *how to build and run a specific open-source
application* on Ever Works. It is the App spec — a `works.yml` document — that names the build strategy, the
runtime components, the probes, the dependencies, the environment, the jobs, the cron calls, the smoke tests
and the domain behaviour of one app, plus a `README.md` that records **where each fact was read** in the
upstream project and what is still unverified.

A Blueprint deliberately contains **no upstream source**. It is metadata: the smallest artifact that lets
the platform stand an app up reproducibly, and the artifact a reviewer can actually read.

Every Blueprint in this listing carries:

| File | What it is |
| --- | --- |
| `README.md` | The human document: what the Blueprint decides, the facts and where they were read, and what is still unverified. |
| `app-spec.yml` | The App spec itself, verbatim. |
| `metadata.yml` | `name`, `repository`, `license`, `verified` — the row as this listing keeps it. |

The App spec is validated on every pull request by
[`.github/workflows/validate.yml`](./.github/workflows/validate.yml), which runs
[`tools/validate-specs.mjs`](./tools/validate-specs.mjs) — `ajv` 8 (draft 2020-12) against
[`schema/app-spec.schema.json`](./schema/app-spec.schema.json). `manifest.json` is validated against
[`schema/templates-manifest.schema.json`](./schema/templates-manifest.schema.json) in the same run.

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
  pull request here is what makes it *listed*.

---

## The templates

| Template | Upstream project | License | Install shape | Link |
| --- | --- | --- | --- | --- |
| Cal.diy (community build) | [`calcom/cal.diy`](https://github.com/calcom/cal.diy) | MIT | `code-bearing` | [`ever-works/cal-diy-template`](https://github.com/ever-works/cal-diy-template) · [`cal-diy/`](./cal-diy/) |
| Umami | [`umami-software/umami`](https://github.com/umami-software/umami) | MIT | `metadata-only` | [`ever-works/umami-template`](https://github.com/ever-works/umami-template) · [`umami/`](./umami/) |

**Cal.diy** is the Open Scheduling community edition. Its Blueprint targets the **community build**
specifically, carries the trademark notice the upstream requires, and is **not** offered for managed hosting
— upstream recommends personal, non-production use, so it stays on the user's own cluster.

**Umami** is privacy-first, cookieless web analytics. Its Blueprint deploys the upstream's published
container image pinned by digest, so a run spends no build minutes.

`Install shape` is what decides how many repositories are forked when you create an App Work from the
template:

| Shape | What the template repository holds | What provisioning forks |
| --- | --- | --- |
| `code-bearing` | The whole application, kept as a fork of the original project with our metadata on top. | **One fork** — the template itself, and that fork is the Work's repository. |
| `metadata-only` | Our metadata only. The application source is a separate repository. | **Two forks** — the app source first (the Work's repository), then the template (recorded as provenance). |

---

## The full listing

`manifest.json` is the machine-readable listing the platform reads. It carries **seven** rows: the two App
Blueprints above, the acceptance fixture (`app-fixture-hello`), and the four Website/Work Templates already
in production (`directory-web`, `directory-web-minimal`, `web`, `web-minimal`). `licenses.yml` is the
licence registry the platform's licence gate reads — the three classes are fixed, and no pull request here
may loosen one.

---

## Proposing a template

See [`CONTRIBUTING.md`](./CONTRIBUTING.md).

---

## License

This repository's own content is **MIT** — see [`LICENSE`](./LICENSE). Each template repository carries its
own licence, and each Blueprint additionally records the **upstream project's** licence, because that is the
licence the running application is under.
