/**
 * Topology Observations Service
 *
 * Manages the `topology_observations` table — one append-only row per
 * source-snapshot. This is the **audit / history log** (status, captured-at,
 * counts, raw graph for the history-detail view): it powers the "Recent
 * observations" surfaces and the retraction-hysteresis counter.
 *
 * It is NO LONGER what the resolver reads. The canonical observed state — the
 * latest graph each external source contributes — now lives DB-native in the
 * `contribution_*` store (one `contribution_source` row per attached source,
 * decomposed into queryable element/link/attachment rows). `record()` is the
 * single choke point every observed writer funnels through, so it materializes
 * that contribution here too: ingest the graph into the contribution store
 * (canonical) and then append the audit row (history) — current-state table +
 * event log; see db-native-persistence.md.
 *
 * Design references:
 *   - apps/server/docs/design/db-native-persistence.md
 *   - apps/server/docs/design/topology-foundation.md
 */

import type { Database } from 'bun:sqlite'
import type { NetworkGraph } from '@shumoku/core'
import { generateId, getDatabase, timestamp } from '../db/index.js'
import { ingestGraph } from './contribution-store.js'

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

    // Canonical write FIRST: materialize the observed contribution (the DB-native
    // state the resolver reads). Doing it before the audit insert means a failed
    // canonical write throws WITHOUT leaving an audit row that claims a snapshot
    // the diagram never applied — the audit log can only ever lag the canonical
    // state, never lead it.
    this.materializeContribution(input)

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
   * Project one snapshot into the canonical observed contribution.
   *
   * The contribution is keyed by `(topology_id, source_id = data_sources.id)` and
   * owned by its topology-purpose attach row (`attachment_id`), so detaching the
   * source cascades the contribution away. Skipped when:
   *   - `status === 'failed'` — a failed scan carries no information, so it must
   *     NOT replace the source's last-good contribution (C7);
   *   - the source isn't attached for the `topology` purpose (preview scans,
   *     metrics-only sources) — there is nothing to contribute to the graph;
   *   - the source is a Manual one — its graph is the intrinsic contribution,
   *     written via `TopologyService.writeManualGraph`, not an observation;
   *   - this snapshot is OLDER than the stored contribution — out-of-order
   *     delivery (a slow scan landing after a newer one) must not regress the
   *     canonical state. Preserves the old `MAX(captured_at)` selection.
   * A non-failed snapshot with no graph is a malformed `empty`; it is normalized
   * to an empty graph so a successful empty scan still retracts the source's prior
   * nodes (successful absence is real evidence).
   */
  private materializeContribution(input: RecordObservationInput): void {
    if (input.status === 'failed') return
    const attach = this.db
      .query(
        `SELECT tds.id AS attach_id, ds.type AS ds_type
         FROM topology_data_sources tds
         JOIN data_sources ds ON ds.id = tds.data_source_id
         WHERE tds.topology_id = ? AND tds.data_source_id = ? AND tds.purpose = 'topology'`,
      )
      .get(input.topologyId, input.sourceId) as { attach_id: string; ds_type: string } | undefined
    if (!attach || attach.ds_type === 'manual') return
    // Out-of-order guard: never let a strictly older scan replace newer canonical
    // state (re-applying the same capturedAt is fine — idempotent replace).
    const existing = this.db
      .query('SELECT last_ok_at FROM contribution_source WHERE topology_id = ? AND source_id = ?')
      .get(input.topologyId, input.sourceId) as { last_ok_at: number | null } | undefined
    if (existing?.last_ok_at != null && input.capturedAt < existing.last_ok_at) return
    const graph: NetworkGraph = input.graph ?? {
      version: '1',
      name: '',
      nodes: [],
      links: [],
    }
    ingestGraph(
      input.topologyId,
      input.sourceId,
      graph,
      { attachmentId: attach.attach_id, lastStatus: input.status, lastOkAt: input.capturedAt },
      this.db,
    )
  }

  /**
   * Get the latest observation for each source attached to a topology —
   * INCLUDING a failed latest. Used by status / history surfaces, the editor's
   * per-source latest-snapshot view, and the probe-merge base (all of which want
   * the true latest from the audit log). The resolver no longer reads here — it
   * reads the canonical observed state from the contribution store.
   */
  latestPerSource(topologyId: string): TopologyObservation[] {
    // ROW_NUMBER (not MAX+join) so a same-millisecond capture_at tie resolves
    // deterministically to ONE row per source (latest captured, then highest
    // rowid = insert order) instead of returning both.
    const rows = this.db
      .query(
        `SELECT * FROM (
           SELECT t.*,
                  ROW_NUMBER() OVER (
                    PARTITION BY source_id ORDER BY captured_at DESC, rowid DESC
                  ) AS rn
           FROM topology_observations t
           WHERE topology_id = ?
         ) WHERE rn = 1
         ORDER BY captured_at DESC`,
      )
      .all(topologyId) as ObservationRow[]
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
   * Clear one source's contribution to a topology: drop all its observation
   * snapshots. `resolve()` then re-stitches from the remaining sources, so
   * entities only this source asserted disappear by orphan sweep. Returns the
   * number of rows deleted. (Backstage-style mark-and-sweep; see
   * topology-ui-ia.md § "Per-source operations".)
   */
  deleteForSource(topologyId: string, sourceId: string): number {
    // Drop the canonical observed contribution too — `resolve()` reads that, not
    // the audit log, so clearing only the audit rows would leave the source's
    // nodes on the diagram. (Never touches the intrinsic: its source_id is
    // 'intrinsic', not a data-source id.) Detach also cascades this via the
    // attach-row FK; this covers the Clear-without-detach path.
    this.db
      .query('DELETE FROM contribution_source WHERE topology_id = ? AND source_id = ?')
      .run(topologyId, sourceId)
    const result = this.db
      .query('DELETE FROM topology_observations WHERE topology_id = ? AND source_id = ?')
      .run(topologyId, sourceId)
    return result.changes
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
                      ORDER BY captured_at DESC, rowid DESC
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
                      ORDER BY captured_at DESC, rowid DESC
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
