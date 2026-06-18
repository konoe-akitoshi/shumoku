# Contributing to Shumoku

Thanks for your interest in contributing! Shumoku is an open-source project and
we welcome issues, pull requests, documentation improvements, and ideas.

By participating, you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md).
For how the project is organized and how decisions are made, see
[GOVERNANCE.md](GOVERNANCE.md).

## Ways to contribute

- **Report a bug** — open a [Bug Report](https://github.com/konoe-akitoshi/shumoku/issues/new?template=bug_report.yml).
- **Request a feature** — open a [Feature Request](https://github.com/konoe-akitoshi/shumoku/issues/new?template=feature_request.yml).
- **Ask a question / discuss an idea** — use [GitHub Discussions](https://github.com/konoe-akitoshi/shumoku/discussions) or [Discord](https://discord.gg/dyYbEsDZYr).
- **Send a pull request** — fix a bug, add a feature, or improve the docs.

> **Security issues are different.** Please do **not** open a public issue for a
> security vulnerability. Follow [SECURITY.md](SECURITY.md) instead.

Before starting non-trivial work, please search existing issues and discussions,
and consider opening an issue first so we can agree on the approach. This avoids
wasted effort and makes review faster.

## Reporting bugs

A good bug report includes:

- **What happened** and **what you expected** to happen.
- **Steps to reproduce** — ideally a minimal YAML/JSON `NetworkGraph` or a small
  code snippet.
- **Version** of the package, CLI, or server you are using.
- **Environment** — OS, runtime (Bun/Node), and browser if relevant.
- **Logs, error messages, or screenshots** where applicable.

The [bug report template](.github/ISSUE_TEMPLATE/bug_report.yml) walks you through
this.

## Requesting features

Open a [feature request](.github/ISSUE_TEMPLATE/feature_request.yml) describing:

- The **problem** you are trying to solve (not just the proposed solution).
- A **proposed solution** and any **alternatives** you considered.

Feature requests are very welcome, but please note that acceptance and
prioritization are at the discretion of the maintainers and Project Lead — see
[GOVERNANCE.md](GOVERNANCE.md).

## Development setup

Shumoku is a [Bun](https://bun.sh) workspaces + [Turborepo](https://turbo.build)
monorepo.

```bash
# Clone
git clone https://github.com/konoe-akitoshi/shumoku.git
cd shumoku

# Install (requires Bun — see packageManager in package.json for the version)
bun install

# Install git hooks (runs format/lint/typecheck on commit)
bunx lefthook install

# Build all libraries (excludes the server app)
bun run build

# Run the docs site + playground
cd apps/docs && bun run dev
```

### Project structure

```
libs/
├── shumoku              # All-in-one package
├── @shumoku/core        # Models, parser, layout, themes, plugin kit
├── @shumoku/renderer-*  # SVG / HTML / PNG / Svelte renderers
├── @shumoku/catalog     # Device / service catalog
├── @shumoku/plugin-sdk  # HTTP client for data-source plugins
└── plugins/             # Zabbix, Prometheus, NetBox, Grafana, Aruba, network-scan

apps/
├── server               # Real-time monitoring platform (API + web)
├── editor               # Visual topology designer
├── cli                  # `shumoku render` CLI
└── docs                 # Documentation site + playground
```

## Running tests, lint, and format

Run these from the repository root before opening a pull request:

```bash
bun run typecheck   # Type check all packages
bun run lint        # Lint (Biome)
bun run format      # Auto-format (Biome)
bun run test        # Run tests across packages
bun run build       # Build all libraries
```

You can also lint only the files you changed:

```bash
bunx biome check <changed-files>
```

If you installed the git hooks (`bunx lefthook install`), format, lint, and
typecheck also run automatically on commit.

## Code style

- TypeScript with strict mode; ESM modules (`"type": "module"`).
- [Biome](https://biomejs.dev/) for formatting and linting.
- Single quotes, no semicolons, trailing commas, 100-character line width.
- Avoid non-null assertions (`!`) and `any`; prefer `for...of`; don't leave unused
  imports/variables. See [CLAUDE.md](CLAUDE.md) for the full house rules.

## Pull requests

1. **Fork** the repository and create a feature branch:
   `git checkout -b feature/short-description`.
2. **Keep PRs small and focused.** One logical change per PR is much easier to
   review and merge than a large, mixed change. If a change is large, consider
   splitting it or opening an issue to discuss the plan first.
3. **Run** `bun run typecheck && bun run lint && bun run test` and make sure the
   build passes.
4. **Sign off your commits** for the DCO (see below) — use `git commit -s`.
5. **Open the pull request** against `main` and fill out the
   [PR template](.github/pull_request_template.md).

### What to include in a pull request

- **Tests** for new behavior or bug fixes where practical.
- **Screenshots or short clips** for any change that affects the UI (Editor,
  Server web UI, rendered diagrams). Before/after is ideal.
- **A clear note if the change is breaking** — call it out in the PR description
  and check the "Breaking change" box in the template, so it can be released
  appropriately.
- **A changeset** if you changed a published package (anything under
  `libs/@shumoku/*` or `apps/cli`). CI fails PRs that touch published packages
  without one:

  ```bash
  bun run changeset            # pick the package(s) + bump type (patch for 0.x)
  bun x changeset add --empty  # for changes that need no release (tests, internal refactors)
  ```

  Do **not** hand-edit version numbers. See [docs/releasing.md](docs/releasing.md)
  for the full release process.

Maintainers review PRs and may ask for changes. Please be patient and responsive —
small, well-described PRs are reviewed fastest.

## Developer Certificate of Origin (DCO)

This project uses the [Developer Certificate of Origin](https://developercertificate.org/)
(DCO) rather than a CLA. The DCO is a lightweight way for contributors to certify
that they wrote, or otherwise have the right to submit, the code they are
contributing.

To comply, **sign off every commit** by adding a `Signed-off-by` line. The easiest
way is the `-s` flag:

```bash
git commit -s -m "Fix link bandwidth normalization"
```

This adds a line like:

```
Signed-off-by: Your Name <you@example.com>
```

By signing off, you certify that you agree to the terms of the
[DCO](https://developercertificate.org/): that you have the right to submit the
contribution, and that you understand it is provided under the project's license.

> **Forgot to sign off? No problem.** A missing sign-off won't block an otherwise
> good contribution. You can:
> - amend the last commit: `git commit --amend -s`,
> - sign off several commits at once: `git rebase --signoff main`, or
> - simply add the sign-off in a follow-up commit — our DCO check accepts that,
>   and a maintainer is happy to help you get it sorted.
>
> Tip: set `git config user.name` / `git config user.email` so the sign-off
> matches your commit author.

## License of contributions

Shumoku is released under the **GNU Affero General Public License v3.0
(AGPL-3.0)**. Unless explicitly stated otherwise, all contributions are accepted
under AGPL-3.0 and become part of the project under that license. By submitting a
contribution (and signing off with the DCO), you agree to license your
contribution under AGPL-3.0.

## Releases

You don't need to publish anything to contribute. Releases are handled separately
by the maintainers — see [docs/releasing.md](docs/releasing.md) for the npm, CLI,
Server, and Editor release processes.
