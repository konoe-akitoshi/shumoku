# shumoku-plugin-prometheus

[Prometheus](https://prometheus.io/) data source plugin for [Shumoku](https://github.com/konoe-akitoshi/shumoku). Polls link and node metrics, discovers hosts from scoped `up` series, and reads alerts from Alertmanager.

## Capabilities

| Capability | What it provides |
|------------|------------------|
| `metrics` | Node up/down and link traffic (interface counters via `rate(...[5m])`) |
| `hosts` | Hosts discovered from a label (default `instance`), with their interfaces |
| `alerts` | Active / resolved alerts from the Alertmanager API |

## Configuration

| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| `url` | string (uri) | ✅ | — | Prometheus base URL |
| `preset` | `snmp` \| `node_exporter` \| `custom` | ✅ | `snmp` | Which metric names to query |
| `customMetrics` | object | when `preset=custom` | — | `inOctets`, `outOctets`, `interfaceLabel` (required), `upMetric` (optional) |
| `hostLabel` | string | | `instance` | Label that identifies a host |
| `jobFilter` | string | ✅ | — | `job` label scope shared by hosts, status, discovery, and traffic |
| `jobFilterMode` | `exact` \| `regex` | | `exact` | Use `regex` for fully-anchored RE2 matching such as `snmp-.*` |
| `alertmanagerUrl` | string (uri) | | _Prometheus URL_ | Alertmanager endpoint |
| `basicAuth` | object | | — | `username` / `password` |

**Presets** — `snmp` uses `ifHCInOctets` / `ifHCOutOctets`; `node_exporter` uses `node_network_receive_bytes_total` / `node_network_transmit_bytes_total`; `custom` lets you name your own. Label values are escaped before being interpolated into PromQL selectors.

## Job scope

Prometheus identifies every scrape target by both `job` and `instance`, and generates
`up{job,instance}` for scrape health. A Shumoku Prometheus source therefore uses one job scope
consistently for host discovery, node status, metric discovery, interface inventory, and traffic.

- Configure `jobFilterMode: exact` for one job, for example `node-exporter`.
- Configure `jobFilterMode: regex` for a related job family, for example `snmp-.*`. Prometheus
  regex matchers are fully anchored.
- Existing configurations without `jobFilter` fail closed: the plugin returns no host candidates,
  does not issue a global `up{instance=...}` query, and leaves status unknown rather than
  attributing another exporter's failure to the node. Save the source with an explicit scope to
  enable polling.

This follows Prometheus's [jobs and instances](https://prometheus.io/docs/concepts/jobs_instances/),
[label matcher](https://prometheus.io/docs/prometheus/latest/querying/basics/#time-series-selectors),
and [instant-query API](https://prometheus.io/docs/prometheus/latest/querying/api/#instant-queries)
semantics.

## Usage

Bundled with [`apps/server`](../../../apps/server). To register elsewhere:

```typescript
import { register } from 'shumoku-plugin-prometheus'
register(pluginRegistry)
```

The host validates config against `configSchema` and renders the form generically — no per-plugin UI code.

## Exports

`register(registry)`, `PrometheusPlugin`, and the types `PrometheusPluginConfig`, `PrometheusCustomMetrics`, `PrometheusMetricPreset`, `PrometheusNodeMapping`, `PrometheusLinkMapping`.

Depends on [`@shumoku/core`](../../@shumoku/core) and [`@shumoku/plugin-sdk`](../../@shumoku/plugin-sdk). See [Plugin Authoring](../../../docs/plugin-authoring.md).

## License

AGPL-3.0-only. For commercial licensing, contact contact@shumoku.dev.
