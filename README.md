<div align="center">

<img src="assets/logo-symbol.svg" alt="Shumoku" width="120" height="120">

# Shumoku

### Network diagrams that don't drift away from reality.

Shumoku generates readable network topology maps from structured network data.

Network diagrams should not be static drawings that slowly become outdated.
They should be reproducible, updateable, and grounded in a source of truth.

Shumoku turns YAML, NetBox, LLDP, SNMP, and other topology data into diagrams that reflect how the network actually exists.

[![npm version](https://img.shields.io/npm/v/shumoku.svg)](https://www.npmjs.com/package/shumoku)
[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL--3.0-blue.svg)](./LICENSE)
[![OpenSSF Best Practices](https://www.bestpractices.dev/projects/13294/badge)](https://www.bestpractices.dev/projects/13294)
[![Discord](https://img.shields.io/discord/1476527182669938720?logo=discord&logoColor=white&label=Discord)](https://discord.gg/dyYbEsDZYr)
[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-support-yellow?logo=buy-me-a-coffee&logoColor=white)](https://buymeacoffee.com/akitoshi)

[**Try the playground**](https://www.shumoku.dev/) &nbsp;·&nbsp; [**Documentation**](https://www.shumoku.dev/ja/docs/server) &nbsp;·&nbsp; [**Discord**](https://discord.gg/dyYbEsDZYr)

</div>

> [!NOTE]
> 製作者が janog58 NOC に参加中です。導入支援・技術サポートはお気軽にご相談ください。
> &ensp;📧&ensp;[contact@shumoku.dev](mailto:contact@shumoku.dev) &ensp;·&ensp; 𝕏&ensp;[@shumoku_dev](https://x.com/shumoku_dev)

<div align="center">

<table>
<tr>
<td align="center" width="50%">

<!-- TODO(hero): swap this still for an ~8s animated GIF — the live weathermap recoloring links by load, or a pan/zoom + tooltip demo. Drop the file in assets/ and update the src below. -->
<img src="assets/screenshots/topology.png" alt="Live weathermap — traffic utilization overlaid on the topology" width="100%">

<em>Live weathermap — real-time traffic overlaid on the topology</em>

</td>
<td align="center" width="50%">

<img src="assets/screenshots/dashboard.png" alt="NOC dashboard in production at JANOG57" width="100%">

<em>Dashboard in production — JANOG57 NOC Live</em>

</td>
</tr>
</table>

</div>

## Philosophy

> **Networks need maps, too.** &emsp;*ネットワークにも、地図が必要だ。*

Network diagrams are one of the most important tools in network operations. But in many environments they are still drawn by hand, updated manually, and slowly drift away from the real network.

Shumoku starts from three principles.

### 1. A diagram should be readable

A topology map should make the structure of the network understandable at a glance — the relationships, layers, paths, and points of failure.

### 2. A diagram should be trustworthy

A diagram is only useful when it reflects reality. Shumoku generates diagrams from structured data — YAML, NetBox, LLDP, SNMP — instead of relying on manual drawing alone.

### 3. A diagram should be updateable

Networks change. Diagrams should be regenerated, reviewed, and maintained as part of the operational workflow.

Shumoku treats network diagrams not as static pictures, but as **generated views of the network** — close to the source of truth, and easy to keep that way.

→ Read the full [design philosophy](docs/PHILOSOPHY.md).

## What's in the box

At its core, Shumoku is a **topology generation engine** — it turns structured network data into a readable diagram. Around that core, it ships ready-to-use apps:

| | | |
|---|---|---|
| 📦 **Library + CLI** | The core engine — turn a YAML / JSON `NetworkGraph` into SVG / HTML / PNG, in Node or the browser | [`libs/shumoku`](libs/shumoku) |
| ✏️ **Editor** | Visual topology designer built on the engine — lay out devices, modules, and cables; derive a bill of materials | [`apps/editor`](apps/editor) |
| 🖥️ **Server** | Topology-based monitoring built on the engine — overlay live metrics and alerts on the map, build dashboards, share read-only links | [`apps/server`](apps/server) |

## Features

- **Live weathermap** — Overlay real-time traffic utilization on links, color-coded by load
- **Alert visualization** — Show active alerts from Zabbix, Prometheus, and Grafana on topology
- **Auto-generate from NetBox** — Pull devices and cables from NetBox to build topology automatically
- **Network discovery** — Seed-crawl SNMP + LLDP to discover topology with no inventory at all
- **Interactive dashboards** — Pan, zoom, and drill into multi-layer network views in the browser
- **900+ vendor icons** — Yamaha, Aruba, AWS, Juniper, and more — rendered at correct aspect ratios
- **Shareable links** — Publish topology views with a share token — no login required

## Server

The server is the full platform: a Bun + Hono API with an SQLite store and a SvelteKit web UI. Run it from the **published Docker image**, or build from source.

See the **[Server Setup Guide](apps/server/README.md)** for Docker, Kubernetes (Helm), systemd, and manual deployment.

```bash
# Published Docker image (quickest)
docker run -d -p 8080:8080 -v shumoku-data:/data ghcr.io/konoe-akitoshi/shumoku:latest
# → http://localhost:8080   (add `-e DEMO_MODE=true` to preload a sample network)

# Docker Compose with an exact production version
cd apps/server && SHUMOKU_VERSION=0.1.1 docker compose up -d

# Development from source (API :8080 + web UI :5173)
bun run dev:server     # from the repo root
```

What you can do:

1. **Create topologies** — Upload YAML files or write them in the built-in editor
2. **Connect data sources** — Link Zabbix, Prometheus, or NetBox to pull live metrics
3. **Monitor in real-time** — See node status and link utilization update live over WebSocket
4. **Build dashboards** — Combine multiple topologies and metric widgets into custom views
5. **Share** — Generate public links for read-only access without authentication

## Editor

The [Editor](https://editor.shumoku.dev/) is hosted on Vercel independently from
the Server. Branches and pull requests receive isolated Preview deployments;
merging to `main` updates Production. The running version, deployment channel,
and commit are shown on the Editor home screen.

### Integrations

| Source | What it pulls |
|---|---|
| **Zabbix** | Traffic metrics, host status, LLDP topology, and alerts via JSON-RPC |
| **Prometheus** | SNMP / node-exporter metrics for link utilization, hosts, and Alertmanager alerts |
| **NetBox** | Topology and hosts auto-discovered from DCIM / IPAM |
| **Grafana** | Alerts via webhook or Alertmanager |
| **Aruba Instant On** | Access points, switches, and site alerts from the cloud portal |
| **Network scan** | Topology discovered by SNMP + LLDP seed-crawl, no inventory required |
| **REST API** | Render topologies and fetch metrics programmatically from your own tools |

See **[Plugin Authoring](docs/plugin-authoring.md)** to write your own data source.

## YAML format

```yaml
name: "Simple Network"

settings:
  direction: TB
  theme: light

subgraphs:
  - id: core
    label: "Core Layer"

nodes:
  - id: rt-01
    label: "Router 01"
    type: router
    vendor: yamaha
    model: rtx3510
    parent: core

  - id: sw-01
    label: "Switch 01"
    type: l3-switch
    parent: core

links:
  - from:
      node: rt-01
      port: lan1
    to:
      node: sw-01
      port: ge-0/0/0
    bandwidth: 10G
```

## Library

The rendering engine is also published to npm as standalone packages.

![Sample network diagram](apps/docs/public/hero-diagram.png)

```bash
npm install shumoku
```

```typescript
import { YamlParser, renderGraphToHtml } from 'shumoku'

const { graph } = new YamlParser().parse(yamlString)

// Interactive HTML (pan / zoom / tooltips)
const html = await renderGraphToHtml(graph, { title: 'My Network' })
```

Need SVG or PNG instead? Use the dedicated renderers:

```typescript
import { renderGraphToSvg } from '@shumoku/renderer-svg'
import { renderGraphToPng } from '@shumoku/renderer-png' // Node.js only

const svg = await renderGraphToSvg(graph)
const png = await renderGraphToPng(graph, { scale: 2 })
```

### CLI

```bash
npx @shumoku/cli render network.yaml -o diagram.svg
npx @shumoku/cli render network.yaml -f html -o diagram.html
npx @shumoku/cli render network.yaml -f png -o diagram.png --scale 3
```

**[Playground](https://www.shumoku.dev/)** | **[YAML Reference](https://www.shumoku.dev/docs/npm/yaml-reference)**

<details>
<summary>Packages</summary>

| Package | Path | Description |
|---------|------|-------------|
| [`shumoku`](libs/shumoku) | `libs/shumoku` | All-in-one — core + SVG/HTML renderers |
| [`@shumoku/core`](libs/@shumoku/core) | `libs/@shumoku/core` | Models, parser, layout engine, themes, plugin kit |
| [`@shumoku/renderer-svg`](libs/@shumoku/renderer-svg) | `libs/@shumoku/renderer-svg` | SVG render pipeline (`prepareRender` → `renderSvg`) |
| [`@shumoku/renderer-html`](libs/@shumoku/renderer-html) | `libs/@shumoku/renderer-html` | Interactive HTML output |
| [`@shumoku/renderer-png`](libs/@shumoku/renderer-png) | `libs/@shumoku/renderer-png` | PNG output (Node.js, via resvg) |
| [`@shumoku/renderer`](libs/@shumoku/renderer) | `libs/@shumoku/renderer` | Svelte interactive renderer (pan/zoom components) |
| [`@shumoku/catalog`](libs/@shumoku/catalog) | `libs/@shumoku/catalog` | Device / service catalog (vendor, model, sysObjectID) |
| [`@shumoku/plugin-sdk`](libs/@shumoku/plugin-sdk) | `libs/@shumoku/plugin-sdk` | HTTP client + pagination for data-source plugins |
| [`@shumoku/cli`](apps/cli) | `apps/cli` | `shumoku render` command-line tool |

Data-source plugins live in [`libs/plugins`](libs/plugins): `zabbix`, `prometheus`, `netbox`, `grafana`, `aruba-instant-on`, `network-scan`.

</details>

## Repository layout

```
apps/
  server/   Real-time monitoring platform — Bun + Hono API, SvelteKit web UI
  editor/   Visual topology designer — SvelteKit + xyflow
  cli/      Render YAML → SVG / HTML / PNG
  docs/     Documentation site (Next.js + Fumadocs)
libs/
  shumoku            All-in-one npm package
  @shumoku/*         Core engine, renderers, catalog, plugin SDK
  plugins/*          Data-source integrations
docs/                Architecture, YAML reference, plugin authoring
examples/            Sample YAML networks + a sample plugin
```

Each top-level directory has its own index: [`apps/`](apps/README.md) · [`libs/`](libs/README.md) · [`examples/`](examples/README.md).

## Documentation

- [Server Guide](https://www.shumoku.dev/ja/docs/server) — Setup, data sources, dashboards
- [YAML Reference](https://www.shumoku.dev/docs/npm/yaml-reference) — Full YAML syntax
- [Vendor Icons](https://www.shumoku.dev/docs/npm/vendor-icons) — Available icons
- [Playground](https://www.shumoku.dev/) — Try without installation
- [Architecture](docs/ARCHITECTURE.md) — Monorepo overview, load pipeline, layout engine
- [Plugin Authoring](docs/plugin-authoring.md) — Writing a `DataSourcePlugin`: capability mixins, data shapes, severity mapping

## Development

```bash
git clone https://github.com/konoe-akitoshi/shumoku.git
cd shumoku
bun install
bun run build      # build all libraries (excludes the server app)
bun run dev        # run everything in dev mode
```

Common scripts: `bun run test`, `bun run lint`, `bun run typecheck`, `bun run format`.
This is a [Bun](https://bun.sh) workspaces + [Turborepo](https://turbo.build) monorepo — see [CONTRIBUTING.md](CONTRIBUTING.md).

## Star History

<a href="https://www.star-history.com/#konoe-akitoshi/shumoku&type=date&legend=top-left">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=konoe-akitoshi/shumoku&type=date&theme=dark&legend=top-left" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=konoe-akitoshi/shumoku&type=date&legend=top-left" />
   <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=konoe-akitoshi/shumoku&type=date&legend=top-left" />
 </picture>
</a>

## Community & governance

Shumoku is an open-source project led by [@konoe-akitoshi](https://github.com/konoe-akitoshi).
Contributions are welcome under the AGPL-3.0 license.

- [Contributing](CONTRIBUTING.md) — dev setup, pull requests, DCO sign-off
- [Governance](GOVERNANCE.md) — roles, decision-making, releases
- [Support](SUPPORT.md) — community help and commercial / implementation support
- [Code of Conduct](CODE_OF_CONDUCT.md) · [Security](SECURITY.md) · [Brand guidelines](TRADEMARK.md)

## License

Shumoku is free and open-source software, licensed under **AGPL-3.0**
([LICENSE](./LICENSE)).

For enterprise use, we can provide commercial **support and implementation
services** (deployment, NetBox/Zabbix integration, PoC, custom development) —
separate from the open-source license. See [SUPPORT.md](SUPPORT.md), or reach out
at [contact@shumoku.dev](mailto:contact@shumoku.dev). If AGPL-3.0 does not fit your
use case, contact us to discuss the options.
