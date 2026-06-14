# shumoku-plugin-zabbix

[Zabbix](https://www.zabbix.com/) data source plugin for [Shumoku](https://github.com/konoe-akitoshi/shumoku). Pulls device inventory, interface traffic, LLDP-derived topology, and trigger events from a Zabbix server over its JSON-RPC API.

## Capabilities

| Capability | What it provides |
|------------|------------------|
| `topology` | Builds a `NetworkGraph` from hosts (nodes) + LLDP neighbor items (links), grouped by host group |
| `hosts` | Lists Zabbix hosts with management IP, interfaces, and discoverable metrics |
| `metrics` | Polls node health (ICMP ping / fresh item data / maintenance) and link traffic; stale data is reported as `unknown` |
| `alerts` | Fetches trigger events, mapping Zabbix severities (0–5) into the neutral `AlertSeverity` scale |

## Usage

This plugin ships bundled with [`apps/server`](../../../apps/server). To use it elsewhere, register it into a Shumoku plugin registry — the registry then constructs an instance from validated config:

```typescript
import { register } from 'shumoku-plugin-zabbix'

register(pluginRegistry) // exposes the descriptor below; the host validates config + builds the plugin
```

Each plugin self-describes via `registry.registerDescriptor({ type, displayName, capabilities, configSchema, optionsSchema }, factory)`. The server renders the config form generically from `configSchema` — there are no per-plugin branches.

## Configuration

| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| `url` | string (uri) | ✅ | — | Zabbix base URL, e.g. `https://zabbix.example.com` |
| `token` | string (password) | ✅ | — | API token |
| `insecure` | boolean | | `false` | Skip TLS verification. Self-signed certs in trusted networks only |
| `pollInterval` | number (ms) | | `60000` | One of 5s / 10s / 30s / 1m / 5m |

## Topology options

Per-attachment options (stored as the source's `optionsJson`, rendered on the Sources page). Topology is generated from hosts + LLDP neighbor items.

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| `hostGroups` | string[] | _all_ | Only keep hosts in these host groups (by name). Candidates come from `getConfigOptions('hostgroup')` |
| `groupBy` | `hostgroup` \| `none` | `hostgroup` | Nest each node under its most-specific host group, or emit a flat graph |
| `groupExclude` | string[] | — | Drop hosts in these groups (admin / catch-all groups) |
| `includeExternalNeighbors` | boolean | `true` | Add nodes for LLDP neighbors that are not Zabbix hosts, so their links still render |
| `parentTag` | string | `PARENT` | Host-tag name whose value names an upstream device — draws a link where LLDP saw no neighbor. Empty to disable |

## How it maps Zabbix → Shumoku

Core types are the display contract; the plugin translates Zabbix vocabulary at the boundary:

- **Severity** — Zabbix priorities `0–5` map to the neutral `critical | high | medium | low | info | ok` scale (shared severity helper, never Zabbix-flavored values).
- **Health** — fresh ICMP ping wins; otherwise any fresh real device item (SNMP / Agent, excluding internal `zabbix[...]` keys); otherwise `unknown`. Link metrics older than ~5 min are treated as stale.
- **Topology** — interface adjacencies come from per-interface LLDP-MIB items (`lldp.rem.sysname`, `lldp.rem.port.id`, `lldp.rem.chassisid`); `parentTag` provides a manual fallback link.

## Exports

| Export | Description |
|--------|-------------|
| `register(registry)` | Registers the descriptor + factory (entry point) |
| `ZabbixPlugin` | The plugin class (advanced / direct use) |
| `ZabbixHost`, `ZabbixItem`, `ZabbixPluginConfig` | Types |

Depends on [`@shumoku/core`](../../@shumoku/core) (types + plugin kit) and [`@shumoku/plugin-sdk`](../../@shumoku/plugin-sdk) (HTTP client). See [Plugin Authoring](../../../docs/plugin-authoring.md) for the plugin contract.

## License

AGPL-3.0-only. For commercial licensing, contact contact@shumoku.dev.
