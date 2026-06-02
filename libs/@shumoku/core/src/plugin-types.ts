// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Plugin Type Definitions
 *
 * Base interfaces for data source plugins.
 * External plugins can import these types without server dependencies.
 */

import type { NetworkGraph } from './models/types.js'

// ============================================
// Capability Types
// ============================================

/**
 * The capabilities the host knows how to dispatch to. Each maps to a required
 * instance method (see `CAPABILITY_METHOD`).
 */
export type KnownDataSourceCapability =
  | 'topology' // Can provide NetworkGraph
  | 'metrics' // Can provide MetricsData
  | 'hosts' // Can list hosts (for mapping UI)
  | 'alerts' // Can provide alerts from monitoring system
  | 'autoscan' // Can perform seed-crawl network discovery (SNMP/LLDP etc.)

/**
 * Capabilities a data source plugin can provide.
 *
 * OPEN set (decision 3): the known values get IDE autocomplete and host
 * dispatch wiring, but any string is accepted so a new plugin can advertise a
 * capability the host doesn't recognize yet. Unknown capabilities are
 * gracefully ignored, never rejected — adding one must not require a core edit.
 */
export type DataSourceCapability = KnownDataSourceCapability | (string & {})

// ============================================
// Common Types
// ============================================

export interface ConnectionResult {
  success: boolean
  message: string
  version?: string
  /** Non-critical warnings (e.g., insecure HTTP connection) */
  warnings?: string[]
}

export interface Host {
  id: string
  name: string
  displayName?: string
  status?: 'up' | 'down' | 'unknown'
  ip?: string
}

export interface HostItem {
  id: string
  hostId: string
  name: string
  key: string
  lastValue?: string
  unit?: string
  /** Extracted interface name (e.g., "GigabitEthernet0/0", "eth0") */
  interfaceName?: string
  /** Traffic direction */
  direction?: 'in' | 'out'
}

/**
 * A metric discovered from a data source for a specific host.
 *
 * The "All metrics" tab in the mapping UI dumps these for browsing —
 * the contract is intentionally just the bits the UI renders: a name,
 * a current value, optional labels for sub-dimensions, and a help blurb.
 * Plugin-specific metadata (Prometheus type, Zabbix value_type, SNMP OID,
 * …) can ride in `labels` if the plugin wants to surface it.
 */
export interface DiscoveredMetric {
  /** Metric name (e.g., "ifHCInOctets", "node_cpu_seconds_total") */
  name: string
  /** Labels associated with this metric */
  labels: Record<string, string>
  /**
   * Current value. Widened beyond `number` because the "All metrics"
   * tab is a dump of *everything* a plugin can surface — numeric gauges
   * coexist with categorical attributes (model strings, link state
   * tokens, boolean health flags). UI branches on `typeof value`.
   */
  value: number | string | boolean
  /** Human-readable description (from HELP) */
  help?: string
}

// ============================================
// Base Plugin Interface
// ============================================

/**
 * Base interface all data source plugins must implement
 */
export interface DataSourcePlugin {
  /** Unique plugin type identifier */
  readonly type: string

  /** Human-readable name */
  readonly displayName: string

  /** List of capabilities this plugin provides */
  readonly capabilities: readonly DataSourceCapability[]

  /** Initialize the plugin with configuration */
  initialize(config: unknown): void

  /** Test connection to the data source */
  testConnection(): Promise<ConnectionResult>

  /** Clean up resources */
  dispose?(): void
}

// ============================================
// Metrics Types
// ============================================

/**
 * Recognized node / link status values. Plugins are encouraged to map
 * their native states onto these so the renderer's NodeStatusOverlay
 * (which has CSS for all five) can light up the right indicator.
 */
export type MetricsStatus = 'up' | 'down' | 'unknown' | 'warning' | 'degraded'

/**
 * Health of the monitoring path itself — orthogonal to `status` (which is the
 * device's operational state). Lets the UI distinguish "device is down" from
 * "we can't reach the device to find out".
 *
 * - `healthy`: monitoring is collecting data
 * - `failing`: monitoring has tried and explicitly failed (e.g. SNMP timeout,
 *   agent unreachable). The reported `status` is best-effort.
 * - `pending`: monitoring hasn't reached a verdict yet (e.g. host just added,
 *   first poll not run, or backoff)
 * - `paused`: monitoring intentionally muted by the operator (maintenance
 *   window, host disabled). Not an error condition.
 */
export type MonitoringHealth = 'healthy' | 'failing' | 'pending' | 'paused'

export interface NodeMetrics {
  status: MetricsStatus
  /** State of the monitoring path (not the device). Omit if irrelevant. */
  monitoring?: MonitoringHealth
  /** Short human-readable reason when `monitoring !== 'healthy'`. */
  monitoringError?: string
  cpu?: number
  memory?: number
  lastSeen?: number
}

export interface LinkMetrics {
  status: MetricsStatus
  utilization?: number // Legacy: max of in/out for backward compatibility
  inUtilization?: number // Incoming direction utilization (0-100)
  outUtilization?: number // Outgoing direction utilization (0-100)
  inBps?: number
  outBps?: number
}

export interface MetricsData {
  nodes: Record<string, NodeMetrics>
  links: Record<string, LinkMetrics>
  timestamp: number
  warnings?: string[]
}

export interface NodeMetricsMapping {
  hostId?: string
  hostName?: string
}

export interface LinkMetricsMapping {
  monitoredNodeId?: string
  interface?: string
  /**
   * Override for the link's bandwidth (bits per second). When set,
   * this value wins over the topology's `link.bandwidth` for both
   * stroke-width rendering and utilization calculation.
   */
  bandwidth?: number
}

export interface MetricsMapping {
  nodes: Record<string, NodeMetricsMapping>
  links: Record<string, LinkMetricsMapping>
}

// ============================================
// Alert Types
// ============================================

/**
 * Alert severity levels — neutral scale (CVSS-style) so plugins map their
 * native vocabularies onto a display contract instead of bending toward any
 * one upstream's terminology. Ordered ok < info < low < medium < high < critical.
 */
export type AlertSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info' | 'ok'

/**
 * Alert status
 */
export type AlertStatus = 'active' | 'resolved'

/**
 * Alert from a monitoring system
 */
export interface Alert {
  /** Unique identifier */
  id: string
  /** Alert severity */
  severity: AlertSeverity
  /** Alert title/name */
  title: string
  /** Detailed description */
  description?: string
  /** Host name (for node mapping) */
  host?: string
  /** Host ID in the data source */
  hostId?: string
  /** Mapped node ID (if mapping exists) */
  nodeId?: string
  /** When the alert started (Unix timestamp in ms) */
  startTime: number
  /** When the alert was resolved (Unix timestamp in ms) */
  endTime?: number
  /** Current alert status */
  status: AlertStatus
  /** Source plugin `type` (e.g. 'zabbix', 'prometheus'). Open string so
   *  external plugins can supply their own identifier without core edits. */
  source: string
  /** When the alert was received via webhook (Unix timestamp in ms) */
  receivedAt?: number
  /** URL to the alert details in the source system */
  url?: string
  /** Labels from the source system */
  labels?: Record<string, string>
}

/**
 * Options for querying alerts
 */
export interface AlertQueryOptions {
  /** Time range in seconds (default: 3600 = 1 hour) */
  timeRange?: number
  /** Minimum severity to include */
  minSeverity?: AlertSeverity
  /** Only return active alerts */
  activeOnly?: boolean
  /** Filter by specific host IDs */
  hostIds?: string[]
}

// ============================================
// Capability Interfaces (Mixins)
// ============================================

/**
 * Plugin can provide topology (NetworkGraph)
 */
export interface TopologyCapable {
  /**
   * Fetch the current topology
   */
  fetchTopology(options?: Record<string, unknown>): Promise<NetworkGraph>

  /**
   * Watch for topology changes (optional)
   * Returns a cleanup function
   */
  watchTopology?(onChange: (graph: NetworkGraph) => void): () => void
}

/**
 * Plugin can list hosts (for mapping UI)
 */
export interface HostsCapable {
  /**
   * Get all available hosts
   */
  getHosts(): Promise<Host[]>

  /**
   * Get items for a specific host
   */
  getHostItems?(hostId: string): Promise<HostItem[]>

  /**
   * Search hosts by name
   */
  searchHosts?(query: string): Promise<Host[]>

  /**
   * Discover all available metrics for a host
   */
  discoverMetrics?(hostId: string): Promise<DiscoveredMetric[]>
}

/**
 * Plugin can provide metrics data
 */
export interface MetricsCapable {
  /**
   * Poll current metrics based on mapping
   */
  pollMetrics(mapping: MetricsMapping): Promise<MetricsData>

  /**
   * Subscribe to metrics updates (optional)
   * Returns a cleanup function
   */
  subscribeMetrics?(mapping: MetricsMapping, onUpdate: (metrics: MetricsData) => void): () => void
}

/**
 * Plugin can provide alerts
 */
export interface AlertsCapable {
  /**
   * Get alerts from the monitoring system
   */
  getAlerts(options?: AlertQueryOptions): Promise<Alert[]>
}

/**
 * One source's observation at a point in time. Returned by autoscan-type
 * plugins; consumed by the server's resolver. See
 * `apps/server/docs/design/topology-foundation-plugin-contract.md`.
 *
 * The graph is `null` when status is `'failed'`. All elements in the
 * graph should carry `provenance.source` stamped with the plugin
 * instance id and (where available) `identity` keys so the resolver can
 * cluster observations across sources.
 */
export interface Snapshot {
  /** Aggregate status. Retraction gating: only `'ok'` / `'partial'` /
   *  `'empty'` are treated as authoritative about presence. */
  status: 'ok' | 'partial' | 'failed' | 'empty'
  /** Human-readable message when status !== 'ok'. */
  statusMessage?: string
  /** Unix ms — when the source captured the snapshot. */
  capturedAt: number
  /** The observed graph. `null` only when status === 'failed'. */
  graph: NetworkGraph | null
  /** Non-fatal warnings (e.g., timeouts on individual devices). */
  warnings?: string[]
}

/**
 * Crawl-scope policy for seed-crawl autoscans. Inspired by Netdisco
 * `discover_only` / `discover_no` semantics.
 */
export interface ScopePolicy {
  /** Restrict crawl to these CIDRs. */
  includeCidrs?: string[]
  /** Skip these CIDRs even if reachable. */
  excludeCidrs?: string[]
  /** "Do not crawl past these nodes" — stops neighbor expansion. */
  boundaryNodes?: string[]
  /** Skip devices whose CDP/LLDP type matches these regex patterns. */
  noTypesPatterns?: string[]
}

/** Hints from the catalog about which discovery protocols / MIBs to try
 *  for a given identified device. v1 keeps this loose; the catalog
 *  surface will tighten in v2. */
export interface DiscoveryCapabilityHints {
  snmp?: { versions?: string[]; mibs?: string[] }
  netconf?: { yang?: string[] }
  cli?: { family?: string }
}

export interface AutoscanInput {
  /** Crawl seed devices (IP or hostname). */
  seeds: string[]
  /** Where the crawl may go. */
  scope?: ScopePolicy
  /** Optional per-device catalog hints. */
  capabilityHints?: DiscoveryCapabilityHints
  /**
   * Per-target SNMP credential override. Keyed by IP (or hostname) of
   * the target; value is the literal community string to use for that
   * one device. For IPs not in the map (or when this whole field is
   * undefined), the plugin falls back to its config-wide community.
   *
   * Server resolves these from the topology's discovery-policy
   * inheritance chain (the per-node/subgraph `community`) and passes
   * them in here, so the plugin only ever sees a flat ip→community map.
   */
  credentials?: Record<string, string>
}

/** Optional progress event stream during a long scan. */
export interface AutoscanProgress {
  phase: 'reachability' | 'identify' | 'walk' | 'finalize'
  totalCandidates: number
  processed: number
  failed: number
  messages: string[]
}

/**
 * Plugin can perform seed-crawl network discovery (SNMP/LLDP, ARP,
 * etc.). Distinct from `TopologyCapable` because autoscan has its own
 * scope/seed semantics and emits a `Snapshot` (with status + identity
 * + provenance) rather than a bare `NetworkGraph`.
 *
 * The same plugin class MAY implement both `TopologyCapable` and
 * `AutoscanCapable`. NetBox provides only `topology`; an SNMP plugin
 * provides only `autoscan`; nothing prevents a future plugin from
 * doing both.
 */
export interface AutoscanCapable {
  /** Run the scan and return a snapshot. */
  scan(input: AutoscanInput): Promise<Snapshot>
  /** Subscribe to per-phase progress events (optional). */
  subscribeProgress?(input: AutoscanInput, onProgress: (p: AutoscanProgress) => void): () => void
}

/**
 * Plugin exposes a raw passthrough to the upstream native API. Intended for
 * **developer-time debugging** — the server routes that call this MUST gate
 * themselves on a non-production environment so credentials and arbitrary
 * upstream methods aren't surfaced to end users.
 *
 * The shape of `method` and `params` is plugin-defined (e.g. Zabbix expects
 * a JSON-RPC method name + params object; a REST plugin might interpret
 * `method` as an HTTP verb). Returning the raw upstream response unchanged
 * is intentional — the consumer is a developer who wants to see exactly
 * what the upstream system said.
 */
export interface NativeApiCapable {
  nativeApi(method: string, params: Record<string, unknown>): Promise<unknown>
}

// ============================================
// Type Guards
// ============================================

export function hasTopologyCapability(
  plugin: DataSourcePlugin,
): plugin is DataSourcePlugin & TopologyCapable {
  return plugin.capabilities.includes('topology')
}

export function hasHostsCapability(
  plugin: DataSourcePlugin,
): plugin is DataSourcePlugin & HostsCapable {
  return plugin.capabilities.includes('hosts')
}

export function hasMetricsCapability(
  plugin: DataSourcePlugin,
): plugin is DataSourcePlugin & MetricsCapable {
  return plugin.capabilities.includes('metrics')
}

export function hasAlertsCapability(
  plugin: DataSourcePlugin,
): plugin is DataSourcePlugin & AlertsCapable {
  return plugin.capabilities.includes('alerts')
}

export function hasAutoscanCapability(
  plugin: DataSourcePlugin,
): plugin is DataSourcePlugin & AutoscanCapable {
  return plugin.capabilities.includes('autoscan')
}

/**
 * Duck-type check: does this plugin expose a native-API passthrough?
 * Intentionally not bound to a `DataSourceCapability` literal — this is a
 * developer-only escape hatch, not a product feature, so it stays off the
 * advertised capability list.
 */
export function hasNativeApi(
  plugin: DataSourcePlugin,
): plugin is DataSourcePlugin & NativeApiCapable {
  return typeof (plugin as Partial<NativeApiCapable>).nativeApi === 'function'
}

/**
 * Required instance method for each KNOWN capability. Unknown (open)
 * capabilities are intentionally absent — the host can't know their contract,
 * so it can't verify or dispatch them.
 */
export const CAPABILITY_METHOD: Record<KnownDataSourceCapability, string> = {
  topology: 'fetchTopology',
  hosts: 'getHosts',
  metrics: 'pollMetrics',
  alerts: 'getAlerts',
  autoscan: 'scan',
}

/**
 * Declared capabilities whose required method is missing on a constructed
 * instance, formatted `"cap → method()"`. Empty array = compliant. Unknown
 * (open) capabilities are skipped. The registry calls this once at first
 * instantiate (decision 7) to catch a plugin that advertises a capability it
 * doesn't actually implement (C6).
 */
export function missingCapabilityMethods(plugin: DataSourcePlugin): string[] {
  const missing: string[] = []
  const asRecord = plugin as unknown as Record<string, unknown>
  for (const cap of plugin.capabilities) {
    const method = CAPABILITY_METHOD[cap as KnownDataSourceCapability]
    if (!method) continue
    if (typeof asRecord[method] !== 'function') missing.push(`${cap} → ${method}()`)
  }
  return missing
}

// ============================================
// Plugin Registry Types
// ============================================

/**
 * Factory function to create plugin instances
 */
export type PluginFactory = (config: unknown) => DataSourcePlugin

/**
 * Self-description of a plugin — the single contract bundled and external
 * plugins both provide. Bundled plugins pass this to `registerDescriptor`;
 * the external loader builds it from `plugin.json`. The host renders forms and
 * validates config purely from `configSchema` / `optionsSchema`, so no
 * per-plugin branch is needed (this closes the bundled-vs-external asymmetry
 * where only external plugins carried a configSchema).
 */
export interface PluginDescriptor {
  type: string
  displayName: string
  capabilities: readonly DataSourceCapability[]
  version?: string
  description?: string
  /** Connection config schema; the host renders the form and validates from it. */
  configSchema?: PluginConfigSchema
  /** Per-use options schema (e.g. topology groupBy/filters), rendered on the Sources page. */
  optionsSchema?: PluginConfigSchema
  /**
   * Declares this plugin ingests webhooks; the host then shows the generic
   * `/api/webhooks/:type/:id` URL via `getConnectionInfo`. Consumed in Phase 5 (F6).
   */
  webhook?: boolean
  /**
   * INERT today (decision 5 / §3.10): recorded and displayable, never enforced.
   * Reserved for a future (b) untrusted-author model with sandboxing — kept so
   * authors can start declaring it, not because anything reads it yet.
   */
  apiVersion?: string
  permissions?: string[]
}

/**
 * Plugin registration info: a descriptor plus its factory. Keeps the flat
 * `type` / `displayName` / `capabilities` fields (existing readers rely on
 * them) and adds the descriptor's schema fields.
 */
export interface PluginRegistration extends PluginDescriptor {
  factory: PluginFactory
}

/**
 * Plugin registry interface that plugins register against.
 */
export interface PluginRegistryInterface {
  /** Register from a full self-description (preferred — carries config/options schema). */
  registerDescriptor(descriptor: PluginDescriptor, factory: PluginFactory): void
  /**
   * Back-compat 4-arg form (no schema). Delegates to `registerDescriptor`.
   * Retained so existing external plugins keep working without edits.
   */
  register(
    type: string,
    displayName: string,
    capabilities: readonly DataSourceCapability[],
    factory: PluginFactory,
  ): void
}

// ============================================
// Plugin Manifest (plugin.json)
// ============================================

/**
 * JSON Schema property definition for configSchema
 */
export interface PluginConfigProperty {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array'
  title?: string
  description?: string
  /** String formatting hint (masked password / URL / email). */
  format?: 'password' | 'uri' | 'email'
  /** Placeholder shown in an empty input. */
  placeholder?: string
  default?: unknown

  // --- choices ---------------------------------------------------------
  /** Enumerated values WITH display labels. Prefer this over `enum`. */
  oneOf?: { const: string | number; title: string }[]
  /** Enumerated values (no labels). Kept for back-compat; new schemas use `oneOf`. */
  enum?: (string | number)[]

  // --- number ----------------------------------------------------------
  minimum?: number
  maximum?: number
  /** Step for numeric inputs. */
  step?: number

  // --- array<string> ---------------------------------------------------
  /** Item schema for `type:'array'` (string items only, for now). */
  items?: { type: 'string' }
  /** Key passed to `getConfigOptions(key, config)` to fetch dynamic candidates. */
  optionsSource?: string
  /** Allow hand-typed values not in the candidate list (fallback when candidates fail/empty). */
  freeSolo?: boolean

  // --- object (nested) -------------------------------------------------
  /** Child properties for `type:'object'`. */
  properties?: Record<string, PluginConfigProperty>
  /** Required child keys for `type:'object'`. */
  required?: string[]

  // --- conditionals ----------------------------------------------------
  /** Render this field only when a sibling field equals a value. */
  visibleWhen?: { field: string; equals: string | number | boolean }
  /** Require this field only when a sibling field equals a value (in addition to top-level `required`). */
  requiredWhen?: { field: string; equals: string | number | boolean }

  // --- advisory / display ----------------------------------------------
  /** Warning shown by the field (e.g. "account must NOT have MFA enabled"). */
  warning?: string
  /** Help/hint text. */
  help?: string
  /** Link to relevant documentation. */
  docUrl?: string
  /** Supplied by the host at construction, not the user — exclude from forms. */
  serverSupplied?: boolean
}

/**
 * JSON-schema-ish object descriptor, reused for plugin `configSchema`
 * (connection config) and per-use `optionsSchema` (e.g. topology groupBy/filters).
 */
export interface PluginConfigSchema {
  type: 'object'
  required?: string[]
  properties: Record<string, PluginConfigProperty>
}

/**
 * Plugin manifest (plugin.json)
 */
export interface PluginManifest {
  /** Unique plugin identifier */
  id: string
  /** Human-readable name */
  name: string
  /** Plugin version */
  version: string
  /** Description */
  description?: string
  /** Plugin capabilities */
  capabilities: DataSourceCapability[]
  /** Entry point file (default: index.js) */
  entry?: string
  /** JSON Schema for plugin configuration */
  configSchema?: PluginConfigSchema
  /** Per-use options schema (e.g. topology groupBy/filters). */
  optionsSchema?: PluginConfigSchema
}

// ============================================
// Helper Functions
// ============================================

/**
 * Add HTTP warning to connection result if URL uses insecure HTTP
 */
export function addHttpWarning(url: string, result: ConnectionResult): ConnectionResult {
  if (url.startsWith('http://')) {
    result.warnings = [...(result.warnings || []), 'Using insecure HTTP connection']
  }
  return result
}
