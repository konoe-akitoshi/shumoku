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
