/**
 * Data Source Service
 * Manages data source connections using plugin architecture
 */

import type { Database } from 'bun:sqlite'
import type { NetworkGraph } from '@shumoku/core'
import { generateId, getDatabase, timestamp } from '../db/index.js'
import {
  hasAutoMappingCapability,
  hasHostsCapability,
  hasTopologyCapability,
  hasAlertsCapability,
  pluginRegistry,
} from '../plugins/index.js'
import type {
  ConnectionResult,
  DiscoveredMetric,
  Host,
  HostItem,
  MappingHint,
  Alert,
  AlertQueryOptions,
} from '../plugins/types.js'
import type { DataSource, DataSourceInput, DataSourceStatus, DataSourceType } from '../types.js'

interface DataSourceRow {
  id: string
  name: string
  type: string
  config_json: string
  status: string
  status_message: string | null
  last_checked_at: number | null
  fail_count: number
  created_at: number
  updated_at: number
}

function rowToDataSource(row: DataSourceRow): DataSource {
  return {
    id: row.id,
    name: row.name,
    type: row.type as DataSourceType,
    configJson: row.config_json,
    status: row.status as DataSourceStatus,
    statusMessage: row.status_message ?? undefined,
    lastCheckedAt: row.last_checked_at ?? undefined,
    failCount: row.fail_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class DataSourceService {
  private db: Database

  constructor() {
    this.db = getDatabase()
  }

  /**
   * Get all data sources
   */
  list(): DataSource[] {
    const rows = this.db
      .query('SELECT * FROM data_sources ORDER BY created_at DESC')
      .all() as DataSourceRow[]
    return rows.map(rowToDataSource)
  }

  /**
   * Get data sources by capability
   */
  listByCapability(capability: 'topology' | 'metrics'): DataSource[] {
    const all = this.list()
    return all.filter((ds) => {
      const pluginInfo = pluginRegistry.getInfo(ds.type)
      return pluginInfo?.capabilities.includes(capability)
    })
  }

  /**
   * Get a single data source by ID
   */
  get(id: string): DataSource | null {
    const row = this.db.query('SELECT * FROM data_sources WHERE id = ?').get(id) as
      | DataSourceRow
      | undefined
    return row ? rowToDataSource(row) : null
  }

  /**
   * Get a data source by name
   */
  getByName(name: string): DataSource | null {
    const row = this.db.query('SELECT * FROM data_sources WHERE name = ?').get(name) as
      | DataSourceRow
      | undefined
    return row ? rowToDataSource(row) : null
  }

  /**
   * Create a new data source
   */
  async create(input: DataSourceInput): Promise<DataSource> {
    // Validate plugin type exists
    if (!pluginRegistry.has(input.type)) {
      throw new Error(`Unknown data source type: ${input.type}`)
    }

    const id = await generateId()
    const now = timestamp()

    this.db
      .query(
        `INSERT INTO data_sources (id, name, type, config_json, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(id, input.name, input.type, input.configJson, now, now)

    return this.get(id)!
  }

  /**
   * Update an existing data source
   */
  update(id: string, input: Partial<DataSourceInput>): DataSource | null {
    const existing = this.get(id)
    if (!existing) {
      return null
    }

    const updates: string[] = []
    const values: (string | number | null)[] = []

    if (input.name !== undefined) {
      updates.push('name = ?')
      values.push(input.name)
    }
    if (input.type !== undefined) {
      if (!pluginRegistry.has(input.type)) {
        throw new Error(`Unknown data source type: ${input.type}`)
      }
      updates.push('type = ?')
      values.push(input.type)
    }
    if (input.configJson !== undefined) {
      updates.push('config_json = ?')
      values.push(input.configJson)
    }

    if (updates.length === 0) {
      return existing
    }

    updates.push('updated_at = ?')
    values.push(timestamp())
    values.push(id)

    // Clear cached plugin instance on update
    pluginRegistry.removeInstance(id)

    this.db.query(`UPDATE data_sources SET ${updates.join(', ')} WHERE id = ?`).run(...values)

    return this.get(id)
  }

  /**
   * Delete a data source
   */
  delete(id: string): boolean {
    // Clear cached plugin instance
    pluginRegistry.removeInstance(id)

    const result = this.db.query('DELETE FROM data_sources WHERE id = ?').run(id)
    return result.changes > 0
  }

  /**
   * Get a plugin instance for a data source
   */
  getPlugin(id: string) {
    const dataSource = this.get(id)
    if (!dataSource) {
      return null
    }

    const config = JSON.parse(dataSource.configJson)
    return pluginRegistry.getInstance(id, dataSource.type, config)
  }

  /**
   * Test connection to a data source
   */
  async testConnection(id: string): Promise<ConnectionResult> {
    const plugin = this.getPlugin(id)
    if (!plugin) {
      return { success: false, message: 'Data source not found' }
    }

    return plugin.testConnection()
  }

  /**
   * Get hosts from a data source (if supported)
   */
  async getHosts(id: string): Promise<Host[]> {
    const plugin = this.getPlugin(id)
    if (!plugin || !hasHostsCapability(plugin)) {
      return []
    }

    return plugin.getHosts()
  }

  /**
   * Get host items from a data source (if supported)
   */
  async getHostItems(id: string, hostId: string): Promise<HostItem[]> {
    const plugin = this.getPlugin(id)
    if (!plugin || !hasHostsCapability(plugin)) {
      return []
    }

    return plugin.getHostItems?.(hostId) || []
  }

  /**
   * Discover all metrics for a host from a data source (if supported)
   */
  async discoverMetrics(id: string, hostId: string): Promise<DiscoveredMetric[]> {
    const plugin = this.getPlugin(id)
    if (!plugin || !hasHostsCapability(plugin)) {
      return []
    }

    return plugin.discoverMetrics?.(hostId) || []
  }

  /**
   * Fetch topology from a data source (if supported)
   */
  async fetchTopology(id: string): Promise<NetworkGraph | null> {
    const plugin = this.getPlugin(id)
    if (!plugin || !hasTopologyCapability(plugin)) {
      return null
    }

    return plugin.fetchTopology()
  }

  /**
   * Get auto-mapping hints for a graph (if supported)
   */
  async getMappingHints(id: string, graph: NetworkGraph): Promise<MappingHint[]> {
    const plugin = this.getPlugin(id)
    if (!plugin || !hasAutoMappingCapability(plugin)) {
      return []
    }

    return plugin.getMappingHints(graph)
  }

  /**
   * Get alerts from a data source (if supported)
   */
  async getAlerts(id: string, options?: AlertQueryOptions): Promise<Alert[]> {
    const plugin = this.getPlugin(id)
    if (!plugin || !hasAlertsCapability(plugin)) {
      return []
    }

    return plugin.getAlerts(options)
  }

  /**
   * Check if a data source supports alerts
   */
  hasAlertsCapability(id: string): boolean {
    const plugin = this.getPlugin(id)
    return plugin !== null && hasAlertsCapability(plugin)
  }

  /**
   * Get plugin info for a type
   */
  getPluginInfo(type: string) {
    return pluginRegistry.getInfo(type)
  }

  /**
   * Get all registered plugin types
   */
  getRegisteredTypes() {
    return pluginRegistry.getRegisteredTypes()
  }

  /**
   * Update health status for a data source
   */
  updateHealthStatus(
    id: string,
    status: DataSourceStatus,
    message?: string,
    failCount?: number,
  ): void {
    const now = timestamp()
    this.db
      .query(
        `UPDATE data_sources
         SET status = ?, status_message = ?, last_checked_at = ?, fail_count = ?
         WHERE id = ?`,
      )
      .run(status, message ?? null, now, failCount ?? 0, id)
  }

  /**
   * Increment fail count for a data source
   */
  incrementFailCount(id: string): number {
    const ds = this.get(id)
    if (!ds) return 0
    const newCount = ds.failCount + 1
    this.updateHealthStatus(id, 'disconnected', ds.statusMessage, newCount)
    return newCount
  }

  /**
   * Reset fail count on successful connection
   */
  resetFailCount(id: string): void {
    this.updateHealthStatus(id, 'connected', undefined, 0)
  }
}
