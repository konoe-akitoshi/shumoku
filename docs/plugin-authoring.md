# Authoring a data source plugin

A `DataSourcePlugin` is what connects shumoku to a monitoring or
inventory system (Zabbix, NetBox, Prometheus, Grafana, Aruba Instant
On, …). Plugins surface **hosts**, **metrics**, **alerts**, or
**topology** through a small set of TypeScript interfaces defined in
`@shumoku/core`. The UI and runtime do not know which plugins exist —
they only know the capability contracts.

This document is the contract reference for authors of bundled and
external plugins.

## Contents

- [Design principle](#design-principle)
- [Capability interfaces](#capability-interfaces)
- [Lifecycle](#lifecycle)
- [Data shapes](#data-shapes)
- [Alert severity mapping](#alert-severity-mapping)
- [The three node-state axes](#the-three-node-state-axes)
- [`discoverMetrics` — passthrough by default](#discovermetrics--passthrough-by-default)
- [Native API passthrough (dev only)](#native-api-passthrough-dev-only)
- [Registration](#registration)
- [Security practices for unofficial APIs](#security-practices-for-unofficial-apis)
- [Don'ts](#donts)

---

## Design principle

> **Core defines the display contract. Plugins conform to it.**

The types in `libs/@shumoku/core/src/plugin-types.ts` describe what
the UI consumes — `Host`, `HostItem`, `Alert`, `LinkMetrics`,
`DiscoveredMetric`, etc. Plugins translate their native vocabulary
into these shapes at the **plugin boundary** so the UI never has to
know whether it's looking at a Zabbix item or a Prometheus series.

Consequences:

- **Never enumerate plugin names in core.** `Alert.source: string`,
  not `'zabbix' | 'prometheus' | …`. New plugins must not require
  edits to `@shumoku/core`.
- **Never push upstream vocabulary into core.** If an upstream system
  says `"average"` and the rest of the world says `"medium"`, the
  plugin translates `"average" → "medium"` — not the other way.
- **Never branch on plugin type in the UI.** Render plugins through
  their `configSchema` (open issue #270 tracks bundled-plugin
  cleanup); render alerts through `AlertSeverity`; render hosts
  through `Host`. The renderer should be a generic consumer.

If you find yourself adding a `if (plugin.type === 'foo')` in core
or the web app, that's the signal something is wrong with the
contract, not with the UI.

---

## Capability interfaces

A plugin implements `DataSourcePlugin` plus zero or more capability
mixins. The mixins advertise what the plugin can do; the runtime asks
each plugin for its declared capabilities and routes calls
accordingly.

| Mixin              | Purpose                                                | Methods                              |
|--------------------|--------------------------------------------------------|--------------------------------------|
| `TopologyCapable`  | Provide a `NetworkGraph` (nodes, links, subgraphs)     | `fetchTopology`, `watchTopology?`    |
| `HostsCapable`     | List the monitored hosts so the mapping UI can choose  | `getHosts`, `getHostItems?`, `searchHosts?`, `discoverMetrics?` |
| `MetricsCapable`   | Poll current metrics for mapped nodes/links            | `pollMetrics`, `subscribeMetrics?`   |
| `AlertsCapable`    | Surface active/resolved alerts                         | `getAlerts`                          |
| `NativeApiCapable` | Dev-only raw API passthrough for debugging             | `nativeApi(method, params)`          |

`capabilities` on the plugin instance is the **advertised** set:

```ts
readonly capabilities: readonly DataSourceCapability[] = ['hosts', 'metrics', 'alerts']
```

Type guards (`hasMetricsCapability(plugin)`, etc.) gate dispatch in
the server, so capabilities and the implemented methods must agree.

`NativeApiCapable` is intentionally **off** the advertised
capability list — it's a duck-typed escape hatch (`hasNativeApi`)
that the server only exposes when `NODE_ENV=development`.

---

## Lifecycle

```ts
class MyPlugin implements DataSourcePlugin, MetricsCapable {
  readonly type = 'my-plugin'
  readonly displayName = 'My Plugin'
  readonly capabilities = ['metrics'] as const

  initialize(config: unknown): void {
    // Validate and store config. Throw on missing required fields —
    // the server logs and surfaces the error in the data-source UI.
    const c = config as Partial<MyPluginConfig>
    if (!c.url) throw new Error('`url` is required')
    this.config = c as MyPluginConfig
  }

  async testConnection(): Promise<ConnectionResult> {
    // Cheap end-to-end check (≤1 HTTP call). Used by the "Test
    // connection" button in the data-source UI. Return `warnings`
    // for non-fatal concerns (insecure HTTP, unofficial API).
  }

  dispose(): void {
    // Optional. Free resources (timers, websockets, caches).
  }
}
```

`initialize()` is called once after construction. The plugin keeps
its config for the lifetime of the instance. Server code may swap
instances when a data source's config changes — implement `dispose`
if you hold long-lived resources.

---

## Data shapes

### `Host`

What the mapping UI lists as candidates for a topology node.

```ts
interface Host {
  id: string            // stable upstream id (serial, hostid, instance)
  name: string          // canonical name for matching
  displayName?: string  // operator-assigned label, if different
  status?: 'up' | 'down' | 'unknown'
  ip?: string
}
```

Pick `id` from the **most stable** upstream identifier. For Aruba
we use serial number; for Zabbix the `hostid`; for Prometheus the
`instance` label. Renames in the upstream system shouldn't change
`id`.

### `HostItem`

Per-host *interfaces* the link-mapping UI offers. Two items per
physical port (one `in`, one `out`) is the convention — that
matches Zabbix's `net.if.in[*]` / `net.if.out[*]` split and lets
plugins with a single bidirectional reading (Aruba, SNMP
`portDataTraffic`) expand transparently.

```ts
interface HostItem {
  id: string
  hostId: string
  name: string           // human label
  key: string            // upstream key (used by pollMetrics)
  lastValue?: string
  unit?: string
  interfaceName?: string // "Gi1/0/1" — used by auto-mapping
  direction?: 'in' | 'out'
}
```

### `MetricsData` / `NodeMetrics` / `LinkMetrics`

The shape `pollMetrics` returns. One entry per mapped node/link.

```ts
interface MetricsData {
  nodes: Record<string, NodeMetrics>
  links: Record<string, LinkMetrics>
  timestamp: number
  warnings?: string[]
}

interface NodeMetrics {
  status: 'up' | 'down' | 'unknown' | 'warning' | 'degraded'
  monitoring?: 'healthy' | 'failing' | 'pending' | 'paused'
  monitoringError?: string
  cpu?: number
  memory?: number
  lastSeen?: number
}

interface LinkMetrics {
  status: 'up' | 'down' | 'unknown' | 'warning' | 'degraded'
  utilization?: number     // legacy: max of in/out
  inUtilization?: number   // 0–100
  outUtilization?: number
  inBps?: number
  outBps?: number
}
```

Plugins that report only a percentage (legacy Zabbix items) can
leave `inBps` / `outBps` undefined; renderers will animate by
utilization instead. Plugins that report only bps should compute
utilization from the link's bandwidth (`linkMapping.bandwidth ??
link.bandwidth`) at the boundary so the renderer doesn't have to
care.

### `Alert`

```ts
interface Alert {
  id: string
  severity: AlertSeverity          // see mapping below
  title: string
  description?: string
  host?: string
  hostId?: string
  nodeId?: string
  startTime: number                // unix ms
  endTime?: number
  status: 'active' | 'resolved'
  source: string                   // your plugin's `type`
  receivedAt?: number
  url?: string                     // back to upstream UI
  labels?: Record<string, string>
}
```

---

## Alert severity mapping

Core uses a neutral CVSS-style scale, ordered low → high:

```
ok  <  info  <  low  <  medium  <  high  <  critical
```

Plugins translate their upstream vocabulary at the boundary. Common
mappings:

| Upstream               | Token       | → shumoku  |
|------------------------|-------------|------------|
| Zabbix priority 0–1    | not-classified / information | `info`     |
| Zabbix priority 2      | warning     | `low`      |
| Zabbix priority 3      | average     | `medium`   |
| Zabbix priority 4      | high        | `high`     |
| Zabbix priority 5      | disaster    | `critical` |
| Prometheus / Alertmanager | `critical` | `critical` |
| Prometheus / Alertmanager | `warning`  | `low`      |
| Prometheus / Alertmanager | `info`     | `info`     |
| Aruba Instant On       | `MAJOR`     | `high`     |
| Aruba Instant On       | `MINOR`     | `low`      |
| (generic)              | `error` / `major` | `high`     |
| (generic)              | `medium` / `moderate` | `medium`   |
| (generic)              | `none` / `ok` | `ok`       |

The mapping is **position-preserving** against the pre-refactor
Zabbix-flavored scale — plugins that used to emit `'disaster'` now
emit `'critical'`, plugins that used to emit `'average'` now emit
`'medium'`, etc. If you're authoring a new plugin, copy the table
above; don't invent a new mapping.

---

## The three node-state axes

When a plugin reports a node's state, three orthogonal concepts are
in play. Keep them separate; conflating them is a regression we've
hit multiple times.

| Axis             | Field                       | Question answered             |
|------------------|-----------------------------|-------------------------------|
| **Mapping**      | (presence of host mapping)  | "Is this topology node bound to an upstream host?" |
| **Device**      | `NodeMetrics.status`        | "Is the device itself up/down?" |
| **Monitoring** | `NodeMetrics.monitoring`    | "Is our monitoring path healthy?" |

A reachable agent on a powered-off device → `status: 'down'`,
`monitoring: 'healthy'`. A working device behind a flapping SNMP
collector → `status: 'unknown'`, `monitoring: 'failing'`. Don't
collapse them — the UI renders them separately.

---

## `discoverMetrics` — passthrough by default

`HostsCapable.discoverMetrics(hostId)` powers the "All metrics"
debug panel in the node-detail modal. Its purpose is **to show
exactly what the upstream system returned** so an operator can pick
the right item to map.

This is a **passthrough dump**, not a curated report. Three
implications:

1. Don't hand-enumerate fields. If you do, you'll forget some, and
   the operator can't tell the difference between "we don't get
   that field" and "the plugin forgot it." Use the existing
   `flattenObject` pattern in `libs/plugins/aruba-instant-on/src/plugin.ts`
   as a template — it walks the upstream record and emits one
   `DiscoveredMetric` per primitive leaf.

2. `DiscoveredMetric.value` is `number | string | boolean`.
   Categorical attributes (model strings, health tokens, IP
   addresses) flow through unchanged. The UI renders them as text.

3. Plugin-specific metadata (Prometheus's `counter`/`gauge` type,
   Zabbix's `value_type`, SNMP's OID) goes in `labels` with an `__`
   prefix:

   ```ts
   labels['__type'] = 'counter'         // Prometheus
   labels['__value_type'] = 'numeric_unsigned'  // Zabbix
   ```

   Core doesn't bless a "metric type" vocabulary. The `__` prefix
   signals "metadata about the metric itself, not a sub-dimension."

---

## Native API passthrough (dev only)

For plugins backed by undocumented or rapidly-changing APIs (Aruba
Instant On is the canonical example), implement
`NativeApiCapable.nativeApi(method, params)` so developers can poke
the upstream system directly through the debug UI.

```ts
async nativeApi(method: string, params: Record<string, unknown>): Promise<unknown> {
  // `method` is plugin-defined. For REST plugins, treat it as the
  // path; for JSON-RPC plugins, treat it as the method name.
  // Return the raw upstream response unchanged — the caller is a
  // developer who wants to see what the API actually said.
}
```

The server only exposes this when `NODE_ENV=development`. Do not
gate on a config flag — the env check is the single source of truth.
See PR #260 for the pattern.

---

## Registration

**Bundled plugins** ship in `libs/plugins/<name>/` and self-register
on startup via `apps/server/api/src/plugins/index.ts`:

```ts
import { register as registerMyPlugin } from 'shumoku-plugin-my-plugin'

export function registerBundledPlugins(): void {
  registerMyPlugin(pluginRegistry)
}
```

Each plugin's `index.ts` exports a `register` function that calls
`pluginRegistry.register(type, displayName, capabilities, factory)`.

**External plugins** are installed at runtime via the plugins UI;
they ship a `plugin.json` manifest plus a JS bundle and are loaded
dynamically. The manifest's `configSchema` (JSON Schema subset)
drives the data-source config form automatically.

Bundled plugins **should** declare a `configSchema` too — they
currently don't (issue #270), which is why the web app carries
hardcoded form branches per plugin. New plugins are encouraged to
populate it from day one even though the bundled-plugin path
doesn't read it yet.

---

## Security practices for unofficial APIs

When the upstream API is undocumented or unsupported (Instant On,
scraped portals, etc.), follow the patterns established in
`libs/plugins/aruba-instant-on/src/auth.ts`:

- **Hard-code endpoint URLs.** No `config.url` overrides for
  upstream hosts — that's a credential-exfiltration vector if a
  hostile operator points the plugin at their own server.
- **HTTPS only.** Reject `http://` at parse time.
- **Never log credentials or tokens.** Not in error messages, not
  in debug output, not in the native API response.
- **In-memory token cache.** Refresh on 401, never persist to disk.
- **Loud failure on auth flow regressions.** If the upstream
  changes the auth response shape, fail with a clear error rather
  than silently downgrading — these APIs break without notice and
  silent degradation hides the cause.
- **Document the warranty.** Surface a `ConnectionResult.warnings`
  entry explaining the API is unofficial. The data-source UI
  displays them.

---

## Don'ts

- **Don't widen `Alert.source` to include your plugin name as a
  literal.** It's already `string`. The plugin emits its `type`.
- **Don't add your plugin's name to any union type in core or in
  `apps/server/web/`.** If something requires this, it's a contract
  bug — file an issue rather than working around it.
- **Don't bypass the capability mixins.** If your plugin has a
  capability not in the list (e.g. config validation, schema
  introspection), don't bolt it onto `DataSourcePlugin` as an
  optional method — propose a new mixin in `plugin-types.ts`.
- **Don't translate to shumoku vocab inside `pollMetrics` only.**
  Centralize upstream-vocab → core-vocab translation in helpers
  (`mapSeverity`, `classifyDeviceStatus`) at the **boundary** of
  the plugin, so the rest of the plugin code reads in core's
  vocabulary.
- **Don't emit zeros for missing data.** A `LinkMetrics` with
  `status: 'unknown'` and no `inBps`/`outBps` is better than
  `status: 'up'` with `inBps: 0` — the second pretends to know
  something. The renderer treats `unknown` as "no data".

---

## Reference plugins

When in doubt, read the existing bundled plugins — they're each
opinionated about a different upstream shape:

| Plugin                            | Demonstrates                                                  |
|-----------------------------------|---------------------------------------------------------------|
| `libs/plugins/zabbix/`            | JSON-RPC auth, paginated item polling, severity translation   |
| `libs/plugins/netbox/`            | REST + token, topology generation, site/tag filtering         |
| `libs/plugins/prometheus/`        | Range queries, Alertmanager severity mapping, host discovery  |
| `libs/plugins/grafana/`           | Webhook receiver, in-memory alert state                       |
| `libs/plugins/aruba-instant-on/`  | OAuth2+PKCE auth, single inventory call feeding multiple capabilities, passthrough `discoverMetrics`, dev-only `nativeApi` |
