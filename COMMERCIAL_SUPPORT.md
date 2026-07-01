# Commercial Support

Shumoku is free and open-source software under **AGPL-3.0**. Using it never
requires a commercial relationship, and community support is available to
everyone on GitHub — see [SUPPORT.md](SUPPORT.md).

Commercial support is a **separate, paid service** for organizations that need
help beyond what public, best-effort community support covers: hands-on work in
their specific environment, guaranteed attention, or custom development. Paying
for support buys services — it does not change the AGPL-3.0 terms of the
software, and it does not buy influence over the project (see
[GOVERNANCE.md](GOVERNANCE.md)).

## Community or commercial?

The line between the two is not *who you are* but *what the work is*:

| The work is… | Route |
|---|---|
| A reproducible bug report, a general question, a feature request, a docs improvement — anything that can be discussed publicly and benefits the project as a whole | **Community** — [GitHub Issues / Discussions](SUPPORT.md) |
| Investigation of your specific environment, private support, guaranteed response, a deadline, priority implementation, or development for your requirements | **Commercial** — email [contact@shumoku.dev](mailto:contact@shumoku.dev) |

Feature requests posted on GitHub are always welcome, but whether, when, and in
what order they are implemented is decided by the Shumoku Project based on the
project's direction, roadmap, and maintainability. If your organization needs a
specific outcome on a specific timeline, that is commercial work.

## What commercial support covers

Commercial support is paid work, scoped and agreed individually. It can cover:

- **Implementation and deployment support** — installing and operating the
  Shumoku Server (and Editor) in your environment.
- **Data source integration** — investigating and configuring connections to
  NetBox, Zabbix, Prometheus, Grafana, and similar systems, including reviewing
  the configuration on the monitoring side.
- **Environment-specific mapping** — adapting topology, metrics, and alert
  mappings to your network and conventions.
- **Custom plugin development** — building integrations for data sources that
  the open-source project does not cover (see [Plugin policy](#plugin-policy)).
- **Priority handling and deadline-bound work** — guaranteed attention to
  specific bugs or features within an agreed timeframe.
- **Proof-of-concept (PoC) support** — helping you evaluate Shumoku against
  your requirements.
- **Operational design and ongoing support** — consulting on how to run Shumoku
  as part of your operations, and continued technical support after rollout.

## Plugin policy

Shumoku is extensible through data source plugins. Not all plugins are — or
will be — part of the open-source project. There are three kinds:

1. **Bundled open-source plugins** — maintained in this repository under
   [`libs/plugins/`](libs/plugins) (currently `zabbix`, `prometheus`, `netbox`,
   `grafana`, `aruba-instant-on`, `network-scan`). These are part of the OSS
   project and covered by community support.
2. **Community plugins** — plugins anyone can build and publish independently
   using the public plugin contract (see
   [docs/plugin-authoring.md](docs/plugin-authoring.md)). They are maintained by
   their authors, not by the Shumoku Project.
3. **Commercially developed plugins** — plugins built as commercial work for a
   specific organization. These may remain private to that customer. Whether
   such a plugin is later open-sourced, bundled, or offered as a paid add-on is
   decided case by case by the Shumoku Project together with the customer.

## Commercial support partner

<!-- TODO: enterprise/commercial contact will move to support@shumoku.dev -->

Commercial support and implementation services are provided by the Project Lead
in collaboration with our commercial support partner:

> **TelHi Corporation（輝日株式会社）** — Commercial Support Partner

This partnership is **non-exclusive**: there is no sole agent, exclusive
distributor, or single official reseller of Shumoku, and other partners may
offer services as well. Partners provide services around Shumoku; they do not
own, control, or speak for the open-source project. Technical direction, the
roadmap, releases, and community governance remain with the Shumoku Project —
see [GOVERNANCE.md](GOVERNANCE.md) and [TRADEMARK.md](TRADEMARK.md).

## Case studies and PoC

If your deployment can be published as a case study, PoC and implementation
support terms can be discussed individually — mention it when you reach out.

## Contact

<!-- TODO: enterprise/commercial contact will move to support@shumoku.dev -->

Email **[contact@shumoku.dev](mailto:contact@shumoku.dev)** with a short
description of your environment and what you need. We will scope the work and,
where appropriate, involve our partner.
