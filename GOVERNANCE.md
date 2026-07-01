# Shumoku Project Governance

This document describes how the Shumoku open-source project is organized and how
decisions are made. It is intended to keep the project transparent and welcoming
to contributors, while making it clear who is responsible for the direction of
the project.

Shumoku is, and intends to remain, a community-driven open-source project. This
document is a description of how we work, not a legal contract.

## Mission

Shumoku is an open-source toolkit for generating readable, trustworthy network
topology diagrams from structured data (YAML, NetBox, LLDP, SNMP, and more), and
for overlaying live metrics and alerts from monitoring systems such as Zabbix and
Prometheus on top of those diagrams.

The project's goal is to make network diagrams **reproducible, updateable, and
grounded in a source of truth**, rather than static drawings that drift away from
reality.

Shumoku is licensed under **AGPL-3.0**. The freedom to use, study, modify, and
redistribute the software under that license is a core value of this project and
will not be taken away.

## Roles

### Project Lead

The Project Lead is **Akitoshi Saeki (佐伯明俊, GitHub [@konoe-akitoshi](https://github.com/konoe-akitoshi))**.

The Project Lead:

- Sets and maintains the overall vision and direction of the project.
- Has the final say on decisions when maintainers cannot reach agreement.
- Is responsible for the roadmap, together with the maintainers.
- Approves the addition and removal of maintainers.

The Project Lead role is a stewardship role, not an ownership claim over
contributors' work. All contributions remain licensed under AGPL-3.0 to the
community (see [CONTRIBUTING.md](CONTRIBUTING.md)).

### Maintainers

Maintainers are contributors who have taken on ongoing responsibility for the
health of the project. They:

- Review and merge pull requests.
- Triage issues and help contributors.
- Participate in roadmap and release discussions.
- Help uphold the [Code of Conduct](CODE_OF_CONDUCT.md).

#### Current maintainers

- Akitoshi Saeki — [@konoe-akitoshi](https://github.com/konoe-akitoshi) (Project Lead)
- Joichiro Hayashi — [@jo16oh](https://github.com/jo16oh)
- Koichi Hirachi — [@csenet](https://github.com/csenet)
- 黒猫 — [@jg1vxg](https://github.com/jg1vxg)
- [@nullpo7z](https://github.com/nullpo7z)

New maintainers are invited by the Project Lead, typically after a sustained
track record of high-quality contributions and good judgement. There is no fixed
quota; the number of maintainers grows with the project.

### Contributors

Anyone who opens an issue, proposes a change, improves documentation, reports a
bug, or otherwise helps the project is a contributor. You do not need any special
status to contribute — see [CONTRIBUTING.md](CONTRIBUTING.md) to get started.

### Partners

A **partner** is an organization or individual that provides commercial services
around Shumoku — for example implementation support, integration help, or
first-line support for enterprise users. See
[COMMERCIAL_SUPPORT.md](COMMERCIAL_SUPPORT.md) for what such services may cover
and for the current commercial support partners.

Partners are an important part of making Shumoku usable in production
environments, but their role is deliberately bounded:

- Partnerships are **non-exclusive**. There is no sole agent, exclusive
  distributor, or single official reseller of Shumoku.
- A partner does **not** own, control, or speak on behalf of the Shumoku project.
- Providing commercial support does **not** grant control over the roadmap,
  release decisions, or project governance.
- Feature requests from partners and their customers are welcome and valued, but
  are treated like any other request — they are not guaranteed to be implemented
  or prioritized.

> A partner company may provide commercial support or implementation services for
> Shumoku, but such services are separate from the Shumoku open-source project
> unless explicitly stated otherwise.

## Decision-making

Most decisions are made informally, through discussion on GitHub issues and pull
requests, using **lazy consensus**: a proposal is assumed to be accepted if no
maintainer objects within a reasonable time.

When a decision is contested:

1. Maintainers discuss the trade-offs openly, usually in the relevant issue or PR.
2. The group aims for consensus among maintainers.
3. If consensus cannot be reached, the **Project Lead makes the final decision**.

Decisions should favor the long-term health of the project and its users over any
single stakeholder.

## Roadmap

The roadmap is owned by the **Project Lead and the maintainers**. It is shaped by:

- The project's mission and design philosophy.
- Community feedback from issues and discussions.
- Requests from users, including enterprise users and partners.

Requests from partners or enterprise customers are welcome, but listing a request
on the roadmap — or implementing it at all — is at the discretion of the
maintainers and Project Lead. No external party can require a feature to be added.

## Releases

Release decisions belong to the **Shumoku project** (maintainers and Project
Lead). Merging a pull request does **not** publish or deploy anything by itself;
releases are a separate, deliberate action.

The detailed, authoritative release process lives in
[docs/releasing.md](docs/releasing.md). Shumoku ships several independent release
streams (npm packages, CLI, Server, Editor), and there is intentionally no single
monorepo-wide version.

No partner or external organization can trigger or block a release on its own.

## Open source vs. commercial support

Two things are kept clearly separate:

- **The open-source project.** The Shumoku software is provided under AGPL-3.0,
  as-is and without warranty. Anyone may use, modify, and redistribute it under
  that license.
- **Commercial support and services.** Implementation help, integration support,
  PoC assistance, and similar offerings may be provided commercially by the
  Project Lead and/or by partners. These are separate services and are not part of
  the AGPL-3.0 license grant. See [SUPPORT.md](SUPPORT.md).

Use of Shumoku as open-source software never requires a commercial relationship.

## Changes to this document

This document may evolve as the project grows. Changes are proposed via pull
request and follow the same decision-making process described above, with the
Project Lead having final approval.

## References

The community and governance practices in this repository — this document plus
[CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md),
[SUPPORT.md](SUPPORT.md), [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md), and
[TRADEMARK.md](TRADEMARK.md) — are informed by the Linux Foundation's recommended
practices for running open-source projects on GitHub:

- Ibrahim Haddad, Ph.D., *Recommended Practices for Hosting and Managing Open
  Source Projects on GitHub*, foreword by Jeff McAffer, The Linux Foundation,
  March 2023.
  [PDF](https://www.linuxfoundation.org/hubfs/LF%20Research/Recommended%20Practices%20for%20Hosting%20and%20Managing%20OS%20Projects%20on%20Github%20-%20Report.pdf)
