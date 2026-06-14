<div align="center">

<img src="assets/logo-symbol.svg" alt="Shumoku" width="120" height="120">

# Shumoku

### Living network diagrams from plain YAML.

Real-time traffic, alerts, and 900+ vendor icons —<br>
in your Markdown, your browser, or a self-hosted NOC dashboard.

[![npm version](https://img.shields.io/npm/v/shumoku.svg)](https://www.npmjs.com/package/shumoku)
[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL--3.0-blue.svg)](./LICENSE)
[![Discord](https://img.shields.io/discord/1476527182669938720?logo=discord&logoColor=white&label=Discord)](https://discord.gg/dyYbEsDZYr)
[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-support-yellow?logo=buy-me-a-coffee&logoColor=white)](https://buymeacoffee.com/akitoshi)

[**▶ Try the live playground**](https://www.shumoku.dev/) &nbsp;·&nbsp; [**Documentation**](https://www.shumoku.dev/ja/docs/server) &nbsp;·&nbsp; [**Discord**](https://discord.gg/dyYbEsDZYr)

<br>

<!-- TODO(hero): swap this still for an ~8s animated GIF — the live weathermap recoloring links by load, or a pan/zoom + tooltip demo. Drop the file in assets/ and update the src below. -->
<img src="assets/screenshots/topology.png" alt="Live weathermap — traffic utilization overlaid on the topology" width="90%">

<em>Live weathermap — real-time traffic utilization overlaid on your topology</em>

<br><br>

<img src="assets/screenshots/dashboard.png" alt="NOC dashboard in production at JANOG57" width="90%">

<em>Dashboard in production — JANOG57 NOC Live</em>

</div>

> [!NOTE]
> 製作者が cloudnativekaigi NOC に参加中です。導入支援・技術サポートはお気軽にご相談ください。
> &ensp;📧&ensp;[contact@shumoku.dev](mailto:contact@shumoku.dev) &ensp;·&ensp; 𝕏&ensp;[@shumoku_dev](https://x.com/shumoku_dev)

## What's in the box

Shumoku is a monorepo with three ways to use it:

| | | |
|---|---|---|
| 🖥️ **Server** | Real-time monitoring platform — connect data sources, overlay live metrics, build dashboards, share read-only links | [`apps/server`](apps/server) |
| 📦 **Library + CLI** | The rendering engine on npm — turn a `NetworkGraph` into SVG / HTML / PNG, in Node or the browser | [`libs/shumoku`](libs/shumoku) |
| ✏️ **Editor** | Visual topology designer — lay out devices, modules, and cables; derive a bill of materials | [`apps/editor`](apps/editor) |

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

# Or build from source / run in dev (API :8080 + web UI :5173)
cd apps/server && docker compose up -d
bun run dev:server     # from the repo root
```

What you can do:

1. **Create topologies** — Upload YAML files or write them in the built-in editor
2. **Connect data sources** — Link Zabbix, Prometheus, or NetBox to pull live metrics
3. **Monitor in real-time** — See node status and link utilization update live over WebSocket
4. **Build dashboards** — Combine multiple topologies and metric widgets into custom views
5. **Share** — Generate public links for read-only access without authentication

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
npx shumoku render network.yaml -o diagram.svg
npx shumoku render network.yaml -f html -o diagram.html
npx shumoku render network.yaml -f png -o diagram.png --scale 3
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

## License

This project is dual-licensed:

- **AGPL-3.0** — For open-source use ([LICENSE](./LICENSE))
- **Commercial License** — For proprietary use, contact contact@shumoku.dev
