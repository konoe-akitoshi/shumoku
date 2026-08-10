/**
 * Data Source Plugin Architecture
 *
 * Unified plugin system for topology and metrics providers.
 * Re-exports all plugin types from @shumoku/core.
 */

// Re-export all plugin types from @shumoku/core
export {
  type Alert,
  type AlertQueryOptions,
  type AlertSeverity,
  type AlertStatus,
  type AlertsCapable,
  type AutoscanCapable,
  type AutoscanInput,
  type AutoscanProgress,
  addHttpWarning,
  type ConnectionResult,
  type DataSourceCapability,
  type DataSourcePlugin,
  type DiscoveredMetric,
  type Host,
  type HostItem,
  type HostsCapable,
  hasAlertsCapability,
  hasAutoscanCapability,
  hasHostsCapability,
  hasMetricsCapability,
  hasNativeApi,
  hasTopologyCapability,
  type InterfaceNeighbor,
  type LinkMetrics,
  type LinkMetricsMapping,
  type MetricsCapable,
  type MetricsData,
  type MetricsMapping,
  type NativeApiCapable,
  type NodeMetrics,
  type NodeMetricsMapping,
  type PluginConfigProperty,
  type PluginFactory,
  type PluginManifest,
  type PluginRegistration,
  type PluginRegistryInterface,
  type ScopePolicy,
  type Snapshot,
  type TopologyCapable,
} from '@shumoku/core'

// Re-export registry (server-specific singleton)
export { pluginRegistry } from './registry.js'

import { type DataSourcePlugin, hasAutoscanCapability, hasTopologyCapability } from '@shumoku/core'

/**
 * Whether a sync can PULL topology data from this plugin (autoscan or
 * topology capability). The complement is a push-only source (Manual —
 * empty capability list), whose data arrives via editor saves instead.
 * Callers holding a possibly-unloaded plugin should treat `null` as
 * pullable so the load error surfaces on a failed fetch step rather than
 * being silently downgraded to a stored source.
 */
export function canPullTopology(plugin: DataSourcePlugin): boolean {
  return hasAutoscanCapability(plugin) || hasTopologyCapability(plugin)
}
