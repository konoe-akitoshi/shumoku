/**
 * Topology Observations Service
 *
 * Manages the `topology_observations` table — one row per source-snapshot.
 * The resolver folds these (plus the authored layer from
 * `topologies.content_json`) into the displayed graph.
 *
 * Design references:
 *   - apps/server/docs/design/topology-foundation.md
 *   - apps/server/docs/design/topology-foundation-schema.md
 */

import type { Database } from 'bun:sqlite'
import type { NetworkGraph } from '@shumoku/core'
import { generateId, getDatabase, timestamp } from '../db/index.js'

export type ObservationStatus = 'ok' | 'partial' | 'failed' | 'empty'

export interface TopologyObservation {
  id: string
  topologyId: string
  sourceId: string
  capturedAt: number
  status: ObservationStatus
  statusMessage?: string
  /** Parsed NetworkGraph — null when status === 'failed'. */
  graph: NetworkGraph | null
  nodeCount: number
  linkCount: number
  portCount: number
  createdAt: number
}

export interface RecordObservationInput {
  topologyId: string
  sourceId: string
  capturedAt: number
  status: ObservationStatus
  statusMessage?: string
  graph: NetworkGraph | null
}

interface ObservationRow {
  id: string
  topology_id: string
  source_id: string
  captured_at: number
  status: string
  status_message: string | null
  graph_json: string | null
  node_count: number
  link_count: number
  port_count: number
  created_at: number
}

function rowToObservation(row: ObservationRow): TopologyObservation {
  return {
    id: row.id,
    topologyId: row.topology_id,
    sourceId: row.source_id,
    capturedAt: row.captured_at,
    status: row.status as ObservationStatus,
    statusMessage: row.status_message ?? undefined,
    graph: row.graph_json ? (JSON.parse(row.graph_json) as NetworkGraph) : null,
    nodeCount: row.node_count,
    linkCount: row.link_count,
    portCount: row.port_count,
    createdAt: row.created_at,
  }
}

/**
 * Cheap counters that scan the parsed graph once. Stored on each row
 * so list endpoints don 't have to parse JSON.
 */
function countGraph(graph: NetworkGraph | null): {
  nodeCount: number
  linkCount: number
  portCount: number
} {
  if (!graph) return { nodeCount: 0, linkCount: 0, portCount: 0 }
  const nodeCount = graph.nodes?.length ?? 0
  const linkCount = graph.links?.length ?? 0
  let portCount = 0
  for (const node of graph.nodes ?? []) {
    portCount += node.ports?.length ?? 0
  }
  return { nodeCount, linkCount, portCount }
}

export class ObservationsService {
  private db: Database

  constructor() {
    this.db = getDatabase()
  }

  /**
   * Record a new observation snapshot. Each call appends one row.
   * Retention / GC is handled separately (see `pruneOldObservations`).
   */
  async record(input: RecordObservationInput): Promise<TopologyObservation> {
    const id = await generateId()
    const now = timestamp()
    const { nodeCount, linkCount, portCount } = countGraph(input.graph)

    const graphJson = input.graph ? JSON.stringify(input.graph) : null

    this.db
      .query(
        `INSERT INTO topology_observations (
          id, topology_id, source_id, captured_at, status, status_message,
          graph_json, node_count, link_count, port_count, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        input.topologyId,
        input.sourceId,
        input.capturedAt,
        input.status,
        input.statusMessage ?? null,
        graphJson,
        nodeCount,
        linkCount,
        portCount,
        now,
      )

    // Enforce retention on write — the table is otherwise append-only and grew
    // unbounded (this method was never called). Cheap once the window is small;
    // a prune hiccup must never fail the record itself.
    try {
      this.pruneOldObservations()
    } catch (err) {
      console.warn('[Observations] prune failed:', err instanceof Error ? err.message : err)
    }

    return {
      id,
      topologyId: input.topologyId,
      sourceId: input.sourceId,
      capturedAt: input.capturedAt,
      status: input.status,
      statusMessage: input.statusMessage,
      graph: input.graph,
      nodeCount,
      linkCount,
      portCount,
      createdAt: now,
    }
  }

  /**
   * Get the latest observation for each source attached to a topology —
   * INCLUDING a failed latest. Used by status / history surfaces and the
   * editor's per-source latest-snapshot view, which want the true latest.
   * For the resolver feed use `latestSuccessfulPerSource` instead, so a
   * transient failed scan doesn't drop a source's last-good nodes.
   */
  latestPerSource(topologyId: string): TopologyObservation[] {
    const rows = this.db
      .query(
        `SELECT t.* FROM topology_observations t
         INNER JOIN (
           SELECT source_id, MAX(captured_at) AS latest
           FROM topology_observations
           WHERE topology_id = ?
           GROUP BY source_id
         ) m ON m.source_id = t.source_id AND m.latest = t.captured_at
         WHERE t.topology_id = ?
         ORDER BY t.captured_at DESC`,
      )
      .all(topologyId, topologyId) as ObservationRow[]
    return rows.map(rowToObservation)
  }

  /**
   * Latest NON-FAILED observation per source — the input the resolver
   * consumes. A `failed` snapshot means "couldn't scan", which carries no
   * information about what the source sees, so it must NOT replace the
   * source's last-good snapshot (otherwise a flapping source would wipe its
   * nodes off the diagram — a retraction the design forbids; see
   * topology-source-priority-merge.md decision 4 / C7). `empty` and
   * `partial` ARE kept: those are successful scans whose absence of a node
   * is real evidence.
   */
  latestSuccessfulPerSource(topologyId: string): TopologyObservation[] {
    const rows = this.db
      .query(
        `SELECT t.* FROM topology_observations t
         INNER JOIN (
           SELECT source_id, MAX(captured_at) AS latest
           FROM topology_observations
           WHERE topology_id = ? AND status != 'failed'
           GROUP BY source_id
         ) m ON m.source_id = t.source_id AND m.latest = t.captured_at
         WHERE t.topology_id = ? AND t.status != 'failed'
         ORDER BY t.captured_at DESC`,
      )
      .all(topologyId, topologyId) as ObservationRow[]
    return rows.map(rowToObservation)
  }

  /**
   * Recent observations across all sources for a topology (history view).
   */
  listForTopology(topologyId: string, limit = 50): TopologyObservation[] {
    const rows = this.db
      .query(
        `SELECT * FROM topology_observations
         WHERE topology_id = ?
         ORDER BY captured_at DESC
         LIMIT ?`,
      )
      .all(topologyId, limit) as ObservationRow[]
    return rows.map(rowToObservation)
  }

  /**
   * Get a single observation by id.
   */
  get(id: string): TopologyObservation | null {
    const row = this.db.query('SELECT * FROM topology_observations WHERE id = ?').get(id) as
      | ObservationRow
      | undefined
    return row ? rowToObservation(row) : null
  }

  /**
   * Delete an observation explicitly.
   */
  delete(id: string): boolean {
    const result = this.db.query('DELETE FROM topology_observations WHERE id = ?').run(id)
    return result.changes > 0
  }

  /**
   * Retention: keep at most `keepPerSource` rows per (topology, source).
   * Older rows beyond that window are dropped. Failed-status rows are
   * pruned more aggressively (only the very latest one is kept).
   *
   * Returns the count of rows deleted.
   */
  pruneOldObservations(keepPerSource = 10): number {
    // Successful (or partial / empty) rows: keep the most recent N per source.
    const ok = this.db
      .query(
        `DELETE FROM topology_observations
         WHERE id IN (
           SELECT id FROM (
             SELECT id,
                    ROW_NUMBER() OVER (
                      PARTITION BY topology_id, source_id
                      ORDER BY captured_at DESC
                    ) AS rn
             FROM topology_observations
             WHERE status != 'failed'
           ) ranked
           WHERE rn > ?
         )`,
      )
      .run(keepPerSource)

    // Failed rows: keep only the most recent 1 per (topology, source).
    const failed = this.db
      .query(
        `DELETE FROM topology_observations
         WHERE id IN (
           SELECT id FROM (
             SELECT id,
                    ROW_NUMBER() OVER (
                      PARTITION BY topology_id, source_id
                      ORDER BY captured_at DESC
                    ) AS rn
             FROM topology_observations
             WHERE status = 'failed'
           ) ranked
           WHERE rn > 1
         )`,
      )
      .run()

    return ok.changes + failed.changes
  }

  /**
   * Update the consecutive-failures hysteresis counter on the
   * topology_data_sources row. Called by whoever runs the actual scan.
   *
   * - successful scan → reset to 0, stamp last_ok_captured_at
   * - failed scan     → increment
   */
  updateHysteresis(
    topologyId: string,
    sourceId: string,
    outcome: 'ok' | 'failed',
    capturedAt?: number,
  ): void {
    if (outcome === 'ok') {
      this.db
        .query(
          `UPDATE topology_data_sources
           SET consecutive_failures = 0,
               last_ok_captured_at = COALESCE(?, last_ok_captured_at),
               updated_at = ?
           WHERE topology_id = ? AND data_source_id = ?`,
        )
        .run(capturedAt ?? null, timestamp(), topologyId, sourceId)
    } else {
      this.db
        .query(
          `UPDATE topology_data_sources
           SET consecutive_failures = consecutive_failures + 1,
               updated_at = ?
           WHERE topology_id = ? AND data_source_id = ?`,
        )
        .run(timestamp(), topologyId, sourceId)
    }
  }
}
