# shumoku-plugin-aruba-instant-on

[Aruba Instant On](https://www.arubainstanton.com/) data source plugin for [Shumoku](https://github.com/konoe-akitoshi/shumoku). Pulls access points, switches, per-device metrics, and site alerts from the cloud portal.

> Uses the **unofficial** `portal.arubainstanton.com` API. There is no published contract, so failures are deliberately loud to catch upstream changes early.

## Capabilities

| Capability | What it provides |
|------------|------------------|
| `hosts` | Access points and switches across the account's sites |
| `metrics` | Per-device up/down (from the inventory snapshot) and per-port throughput |
| `alerts` | Site-level alerts mapped to Shumoku's neutral severity scale |

## Configuration

| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| `username` | string (email) | ✅ | — | Portal account email. **The account must not have MFA enabled** |
| `password` | string (password) | ✅ | — | Portal password |
| `siteId` | string | | _all_ | Restrict to one site. Blank polls every site the account can see |

## Usage

Bundled with [`apps/server`](../../../apps/server). To register elsewhere:

```typescript
import { register } from 'shumoku-plugin-aruba-instant-on'
register(pluginRegistry)
```

## Exports

`register(registry)`, `ArubaInstantOnPlugin`, and the type `ArubaInstantOnConfig`.

Depends on [`@shumoku/core`](../../@shumoku/core). See [Plugin Authoring](../../../docs/plugin-authoring.md).

## License

AGPL-3.0-only. For commercial licensing, contact contact@shumoku.dev.
