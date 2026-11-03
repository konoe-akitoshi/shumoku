# libs/

The Shumoku libraries — the rendering engine, its supporting packages, and the data-source plugins.

## Core engine & renderers

| Package | What it is |
|---------|-----------|
| [`shumoku`](shumoku) | All-in-one — re-exports core + the SVG/HTML renderers. Start here. |
| [`@shumoku/core`](@shumoku/core) | Models, YAML reader, the drawing engine (`drawNetwork`), themes, plugin kit. Browser-safe and render-agnostic. |
| [`@shumoku/renderer-svg`](@shumoku/renderer-svg) | Thin wrapper re-exporting `@shumoku/renderer/static` (`renderNetworkSvg`, `renderSceneSvg`, `drawNetworkScene`), plus `renderGraphToSvg` and icon fetch helpers. |
| [`@shumoku/renderer-html`](@shumoku/renderer-html) | Interactive HTML output. |
| [`@shumoku/renderer-png`](@shumoku/renderer-png) | PNG output (Node.js, via resvg). |
| [`@shumoku/renderer`](@shumoku/renderer) | Svelte kit + static SVG renderer that draws core's Scene (pan/zoom camera, overlays) — used by the editor and the server web UI. |
| [`@shumoku/catalog`](@shumoku/catalog) | Device / service catalog (vendor, model, SNMP sysObjectID). |
| [`@shumoku/plugin-sdk`](@shumoku/plugin-sdk) | Node HTTP client + pagination for data-source plugins. |

## Data-source plugins

[`plugins/`](plugins) — each implements `DataSourcePlugin` and translates its upstream vocabulary into core's neutral types at the boundary:

| Plugin | Capabilities |
|--------|--------------|
| [`zabbix`](plugins/zabbix) | metrics, hosts, topology, alerts |
| [`prometheus`](plugins/prometheus) | metrics, hosts, alerts |
| [`netbox`](plugins/netbox) | topology, hosts |
| [`grafana`](plugins/grafana) | alerts |
| [`aruba-instant-on`](plugins/aruba-instant-on) | hosts, metrics, alerts |
| [`network-scan`](plugins/network-scan) | autoscan (SNMP / LLDP discovery) |
| [`arista-cv-cue`](plugins/arista-cv-cue) | topology, hosts, metrics, alerts (private, bundled in the server) |
| [`huawei-nce-campus`](plugins/huawei-nce-campus) | topology, hosts, metrics, alerts (private, bundled in the server) |
| [`newrelic`](plugins/newrelic) | topology, hosts, metrics, alerts (private, bundled in the server) |

See [Plugin Authoring](../docs/plugin-authoring.md) to write your own.
