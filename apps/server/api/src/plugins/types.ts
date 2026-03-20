/**
 * Data Source Plugin Architecture
 *
 * Unified plugin system for topology and metrics providers.
 * Re-exports all plugin types from @shumoku/core.
 */

// Re-export all plugin types from @shumoku/core
export {
  type DataSourceCapability,
  type ConnectionResult,
  type Host,
  type HostItem,
  type DiscoveredMetric,
  type MappingHint,
  type DataSourcePlugin,
  type TopologyCapable,
  type HostsCapable,
  type AutoMappingCapable,
  type MetricsCapable,
  type AlertsCapable,
  type AlertSeverity,
  type AlertStatus,
  type Alert,
  type AlertQueryOptions,
  type MetricsData,
  type MetricsMapping,
  type NodeMetrics,
  type LinkMetrics,
  type NodeMetricsMapping,
  type LinkMetricsMapping,
  type PluginManifest,
  type PluginConfigProperty,
  type PluginFactory,
  type PluginRegistration,
  type PluginRegistryInterface,
  hasTopologyCapability,
  hasHostsCapability,
  hasAutoMappingCapability,
  hasMetricsCapability,
  hasAlertsCapability,
  addHttpWarning,
} from '@shumoku/core'

// Re-export registry (server-specific singleton)
export { pluginRegistry } from './registry.js'
