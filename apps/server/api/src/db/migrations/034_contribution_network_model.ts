// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

import type { Database } from 'bun:sqlite'
import { fromNetworkGraph, type NetworkGraph } from '@shumoku/core'
import { ingestNetwork } from '../contribution-codec.js'
import { buildLegacyGraph } from '../legacy/contribution-graph.js'

/**
 * Rewrite every stored contribution, and every observation in the audit log, in the network
 * model's shape. Each was stored as a NetworkGraph; it is read back as one, split into its
 * configuration and layers, and written again. A contribution's content hash is cleared, so
 * the next sync writes the source afresh.
 */
export function migrateContributionsToNetworkModel(db: Database): void {
  const sources = db
    .query(
      'SELECT topology_id, source_id, attachment_id, last_status, last_ok_at FROM contribution_source',
    )
    .all() as {
    topology_id: string
    source_id: string
    attachment_id: string | null
    last_status: string | null
    last_ok_at: number | null
  }[]
  for (const s of sources) {
    const graph = buildLegacyGraph(s.topology_id, s.source_id, db)
    if (!graph) continue
    const { config, ...layers } = fromNetworkGraph(graph)
    ingestNetwork(
      s.topology_id,
      s.source_id,
      { network: config, ...layers },
      {
        attachmentId: s.attachment_id,
        ...(s.last_status != null && { lastStatus: s.last_status }),
        ...(s.last_ok_at != null && { lastOkAt: s.last_ok_at }),
        contentHash: null,
      },
      db,
    )
  }
}

/** Rewrite each audit row's observed graph as what the source observed, in the model's shape. */
export function migrateObservationsToNetworkModel(db: Database): void {
  const rows = db
    .query('SELECT id, graph_json FROM topology_observations WHERE graph_json IS NOT NULL')
    .all() as { id: string; graph_json: string }[]
  const update = db.query('UPDATE topology_observations SET graph_json = ? WHERE id = ?')
  for (const row of rows) {
    const stored = JSON.parse(row.graph_json) as Partial<NetworkGraph> & { network?: unknown }
    if (stored.network !== undefined || !Array.isArray(stored.nodes)) continue
    const { config, ...layers } = fromNetworkGraph({
      version: '1',
      ...stored,
      nodes: stored.nodes,
      links: stored.links ?? [],
    })
    update.run(JSON.stringify({ network: config, ...layers }), row.id)
  }
}
