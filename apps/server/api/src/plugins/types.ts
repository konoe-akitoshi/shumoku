/**
 * Data Source Plugin Architecture
 *
 * Unified plugin system for topology and metrics providers.
 * Each plugin declares its capabilities and implements corresponding interfaces.
 */

import type { MetricsData, MetricsMapping } from '../types.js'

// ============================================
// Re-export base types from @shumoku/core
// ============================================

// These are the types that external plugins need
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
  type PluginManifest,
  type PluginConfigProperty,
  hasTopologyCapability,
  hasHostsCapability,
  hasAutoMappingCapability,
  addHttpWarning,
} from '@shumoku/core'

// Re-export registry types (defined in registry.ts)
export type { PluginFactory, PluginRegistration, PluginRegistryInterface } from './registry.js'

// ============================================
// Server-specific Capability Interfaces
// ============================================

/**
 * Plugin can provide metrics data
 * (Server-specific: depends on MetricsData and MetricsMapping)
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

// ============================================
// Alerts Types (Server-specific)
// ============================================

/**
 * Alert severity levels
 */
export type AlertSeverity = 'disaster' | 'high' | 'average' | 'warning' | 'information' | 'ok'

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
  /** Source system */
  source: 'zabbix' | 'prometheus' | 'grafana'
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

/**
 * Plugin can provide alerts
 */
export interface AlertsCapable {
  /**
   * Get alerts from the monitoring system
   */
  getAlerts(options?: AlertQueryOptions): Promise<Alert[]>
}

// ============================================
// Server-specific Type Guards
// ============================================

import type { DataSourcePlugin } from '@shumoku/core'

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

