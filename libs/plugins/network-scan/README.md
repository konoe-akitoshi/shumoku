# shumoku-plugin-network-scan

Active network discovery plugin for [Shumoku](https://github.com/konoe-akitoshi/shumoku). Seed-crawls a network over **SNMP** and **LLDP** — identifying devices (System-MIB), walking ports (IF-MIB), and harvesting neighbors (LLDP-MIB) — to discover topology with no upstream inventory at all.

## Capability

| Capability | What it provides |
|------------|------------------|
| `autoscan` | `scan(input) → Snapshot` — probes the targets and returns a discovered graph |

> Unlike the inventory plugins, this implements **`autoscan`**, not `topology`. The host dispatches to `scan()` (a one-shot crawl that returns a `Snapshot` with `status`, `graph`, and `warnings`) rather than `fetchTopology()`.

## Configuration

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| `community` | string | `public` | SNMPv2c community used for every target |
| `targets` | string[] | — | IPv4 addresses, hostnames, or CIDR blocks (e.g. `10.0.0.0/24`). CIDR is expanded and liveness-probed |
| `timeoutMs` | number | `2000` | Per-device timeout (200–30000) |

`instanceId` is intentionally **not** a config field — the server supplies it at construction. Per-target credential overrides arrive on the scan input, resolved from the server's policy chain.

## Usage

Bundled with [`apps/server`](../../../apps/server). To register elsewhere:

```typescript
import { register } from 'shumoku-plugin-network-scan'
register(pluginRegistry)
```

## Exports

`register(registry)`, `NetworkScanPlugin`, `spikeBunCompat`.

Uses `net-snmp` for the SNMP transport and depends on [`@shumoku/core`](../../@shumoku/core). See [Plugin Authoring](../../../docs/plugin-authoring.md).

## License

AGPL-3.0-only. For commercial licensing, contact contact@shumoku.dev.
