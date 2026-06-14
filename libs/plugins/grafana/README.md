# shumoku-plugin-grafana

[Grafana](https://grafana.com/) data source plugin for [Shumoku](https://github.com/konoe-akitoshi/shumoku). Surfaces Grafana alerts on your topology — either by **polling** the bundled Alertmanager, or by **receiving a webhook** push from a Grafana contact point.

## Capabilities

| Capability | What it provides |
|------------|------------------|
| `alerts` | Active / resolved alerts, with severity mapped to Shumoku's neutral scale |

The descriptor declares `webhook: true`, so the host exposes a generic `/api/webhooks/:type/:id` endpoint (via `getConnectionInfo`) to point a Grafana contact point at.

## Configuration

| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| `url` | string (uri) | ✅ | — | Grafana base URL |
| `token` | string (password) | ✅ | — | API token |
| `useWebhook` | boolean | | `false` | Receive alerts via webhook instead of polling |
| `webhookSecret` | string (password) | | _auto_ | Shown when `useWebhook` is on. Leave blank to auto-generate on save |

## Usage

Bundled with [`apps/server`](../../../apps/server). To register elsewhere:

```typescript
import { register } from 'shumoku-plugin-grafana'
register(pluginRegistry)
```

## Exports

`register(registry)`, `GrafanaPlugin`, `isGrafanaWebhookPayload`, and the types `GrafanaPluginConfig`, `GrafanaWebhookPayload`, `GrafanaWebhookAlert`, `AlertStoreService`.

Alert parsing and severity mapping reuse the shared Alertmanager helpers from [`@shumoku/core`](../../@shumoku/core)'s plugin kit, so Grafana and Prometheus alerts render identically. See [Plugin Authoring](../../../docs/plugin-authoring.md).

## License

AGPL-3.0-only. For commercial licensing, contact contact@shumoku.dev.
