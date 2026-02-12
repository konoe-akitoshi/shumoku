/**
 * Topology Data Sources Service
 * Manages the relationship between topologies and data sources
 */

import type { Database } from 'bun:sqlite'
import crypto from 'node:crypto'
import { generateId, getDatabase, timestamp } from '../db/index.js'
import type {
  DataSource,
  DataSourcePurpose,
  SyncMode,
  TopologyDataSource,
  TopologyDataSourceInput,
} from '../types.js'

interface TopologyDataSourceRow {
  id: string
  topology_id: string
  data_source_id: string
  purpose: string
  sync_mode: string
  webhook_secret: string | null
  last_synced_at: number | null
  priority: number
  options_json: string | null
  created_at: number
  updated_at: number
  // Joined columns from data_sources
  ds_id?: string
  ds_name?: string
  ds_type?: string
  ds_config_json?: string
  ds_status?: string
  ds_fail_count?: number
  ds_created_at?: number
  ds_updated_at?: number
}

function rowToTopologyDataSource(row: TopologyDataSourceRow): TopologyDataSource {
  const result: TopologyDataSource = {
    id: row.id,
    topologyId: row.topology_id,
    dataSourceId: row.data_source_id,
    purpose: row.purpose as DataSourcePurpose,
    syncMode: row.sync_mode as SyncMode,
    webhookSecret: row.webhook_secret || undefined,
    lastSyncedAt: row.last_synced_at || undefined,
    priority: row.priority,
    optionsJson: row.options_json || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }

  // Include joined data source if available
  if (row.ds_id) {
    result.dataSource = {
      id: row.ds_id,
      name: row.ds_name!,
      type: row.ds_type as DataSource['type'],
      configJson: row.ds_config_json!,
      status: (row.ds_status as DataSource['status']) || 'unknown',
      failCount: row.ds_fail_count || 0,
      createdAt: row.ds_created_at!,
      updatedAt: row.ds_updated_at!,
    }
  }

  return result
}

export class TopologySourcesService {
  private db: Database
  private readonly baseSelectQuery = `
    SELECT
      tds.*,
      ds.id as ds_id,
      ds.name as ds_name,
      ds.type as ds_type,
      ds.config_json as ds_config_json,
      ds.status as ds_status,
      ds.fail_count as ds_fail_count,
      ds.created_at as ds_created_at,
      ds.updated_at as ds_updated_at
    FROM topology_data_sources tds
    JOIN data_sources ds ON ds.id = tds.data_source_id`

  constructor() {
    this.db = getDatabase()
  }

  /**
   * List all data sources for a topology
   */
  listByTopology(topologyId: string): TopologyDataSource[] {
    const rows = this.db
      .query(
        `${this.baseSelectQuery}
        WHERE tds.topology_id = ?
        ORDER BY tds.purpose, tds.priority`,
      )
      .all(topologyId) as TopologyDataSourceRow[]
    return rows.map(rowToTopologyDataSource)
  }

  /**
   * List data sources by purpose (topology or metrics)
   */
  listByPurpose(topologyId: string, purpose: DataSourcePurpose): TopologyDataSource[] {
    const rows = this.db
      .query(
        `${this.baseSelectQuery}
        WHERE tds.topology_id = ? AND tds.purpose = ?
        ORDER BY tds.priority`,
      )
      .all(topologyId, purpose) as TopologyDataSourceRow[]
    return rows.map(rowToTopologyDataSource)
  }

  /**
   * Get a single topology data source by ID
   */
  get(id: string): TopologyDataSource | null {
    const row = this.db
      .query(
        `${this.baseSelectQuery}
        WHERE tds.id = ?`,
      )
      .get(id) as TopologyDataSourceRow | undefined
    return row ? rowToTopologyDataSource(row) : null
  }

  /**
   * Find by topology, data source, and purpose
   */
  find(
    topologyId: string,
    dataSourceId: string,
    purpose: DataSourcePurpose,
  ): TopologyDataSource | null {
    const row = this.db
      .query(
        `${this.baseSelectQuery}
        WHERE tds.topology_id = ? AND tds.data_source_id = ? AND tds.purpose = ?`,
      )
      .get(topologyId, dataSourceId, purpose) as TopologyDataSourceRow | undefined
    return row ? rowToTopologyDataSource(row) : null
  }

  /**
   * Find by webhook secret (for webhook validation)
   */
  findByWebhookSecret(secret: string): TopologyDataSource | null {
    const row = this.db
      .query(
        `${this.baseSelectQuery}
        WHERE tds.webhook_secret = ?`,
      )
      .get(secret) as TopologyDataSourceRow | undefined
    return row ? rowToTopologyDataSource(row) : null
  }

  /**
   * Add a data source to a topology
   */
  async add(topologyId: string, input: TopologyDataSourceInput): Promise<TopologyDataSource> {
    const id = generateId()
    const now = timestamp()
    const syncMode = input.syncMode || 'manual'

    // Generate webhook secret if webhook mode
    const webhookSecret = syncMode === 'webhook' ? crypto.randomBytes(32).toString('hex') : null

    this.db
      .query(
        `INSERT INTO topology_data_sources
        (id, topology_id, data_source_id, purpose, sync_mode, webhook_secret, priority, options_json, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        topologyId,
        input.dataSourceId,
        input.purpose,
        syncMode,
        webhookSecret,
        input.priority ?? 0,
        input.optionsJson ?? null,
        now,
        now,
      )

    return this.get(id)!
  }

  /**
   * Update a topology data source
   */
  update(
    id: string,
    updates: Partial<Pick<TopologyDataSourceInput, 'syncMode' | 'priority' | 'optionsJson'>>,
  ): TopologyDataSource | null {
    const existing = this.get(id)
    if (!existing) return null

    const updateParts: string[] = []
    const values: (string | number | null)[] = []

    if (updates.syncMode !== undefined) {
      updateParts.push('sync_mode = ?')
      values.push(updates.syncMode)

      // Generate or clear webhook secret based on mode
      if (updates.syncMode === 'webhook' && !existing.webhookSecret) {
        updateParts.push('webhook_secret = ?')
        values.push(crypto.randomBytes(32).toString('hex'))
      } else if (updates.syncMode !== 'webhook') {
        updateParts.push('webhook_secret = NULL')
      }
    }

    if (updates.priority !== undefined) {
      updateParts.push('priority = ?')
      values.push(updates.priority)
    }

    if (updates.optionsJson !== undefined) {
      updateParts.push('options_json = ?')
      values.push(updates.optionsJson)
    }

    if (updateParts.length === 0) return existing

    updateParts.push('updated_at = ?')
    values.push(timestamp())
    values.push(id)

    this.db
      .query(`UPDATE topology_data_sources SET ${updateParts.join(', ')} WHERE id = ?`)
      .run(...values)

    return this.get(id)
  }

  /**
   * Update last synced timestamp
   */
  updateLastSynced(id: string): void {
    const now = timestamp()
    this.db
      .query('UPDATE topology_data_sources SET last_synced_at = ?, updated_at = ? WHERE id = ?')
      .run(now, now, id)
  }

  /**
   * Remove a data source from a topology
   */
  remove(id: string): boolean {
    const result = this.db.query('DELETE FROM topology_data_sources WHERE id = ?').run(id)
    return result.changes > 0
  }

  /**
   * Remove all data sources from a topology
   */
  removeAllForTopology(topologyId: string): number {
    const result = this.db
      .query('DELETE FROM topology_data_sources WHERE topology_id = ?')
      .run(topologyId)
    return result.changes
  }

  /**
   * Bulk update: replace all sources for a topology with new ones
   */
  async replaceAll(
    topologyId: string,
    sources: TopologyDataSourceInput[],
  ): Promise<TopologyDataSource[]> {
    // Delete existing
    this.removeAllForTopology(topologyId)

    // Add new ones
    const results: TopologyDataSource[] = []
    for (const source of sources) {
      const added = await this.add(topologyId, source)
      results.push(added)
    }

    return results
  }
}
