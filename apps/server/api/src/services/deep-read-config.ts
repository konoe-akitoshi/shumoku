// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Discovery config — the Discovery feature's own per-node settings store.
 *
 * One row per node entity (`deep_read_config.entity_id` → `entity_registry.id`):
 * the SNMP community used to deep-read the node, and optional scheduler
 * mode / interval overrides. Plain relational rows — no inheritance chain, no
 * topology default, no overlay anchoring. A node either has a row or it
 * doesn't; bulk assignment is one INSERT...SELECT.
 *
 * This deliberately lives OUTSIDE the contribution/overlay machinery: it is
 * feature configuration (like a poller's target list), not an observation and
 * not operator authorship of the graph.
 */

import type { DiscoveryMode } from '@shumoku/core'
import { getDatabase, timestamp } from '../db/index.js'

export interface DeepReadConfig {
  entityId: string
  community?: string
  mode?: DiscoveryMode
  intervalMs?: number
}

/** Partial update; `undefined` = keep, `null` = clear the field. */
export interface DeepReadConfigPatch {
  community?: string | null
  mode?: DiscoveryMode | null
  intervalMs?: number | null
}

interface Row {
  entity_id: string
  community: string | null
  mode: string | null
  interval_ms: number | null
}

function rowToConfig(r: Row): DeepReadConfig {
  return {
    entityId: r.entity_id,
    ...(r.community != null ? { community: r.community } : {}),
    ...(r.mode != null ? { mode: r.mode as DiscoveryMode } : {}),
    ...(r.interval_ms != null ? { intervalMs: r.interval_ms } : {}),
  }
}

/** All config rows for a topology, keyed by entity id. */
export function listDeepReadConfigs(topologyId: string): Map<string, DeepReadConfig> {
  const rows = getDatabase()
    .query(
      'SELECT entity_id, community, mode, interval_ms FROM deep_read_config WHERE topology_id = ?',
    )
    .all(topologyId) as Row[]
  return new Map(rows.map((r) => [r.entity_id, rowToConfig(r)]))
}

export function getDeepReadConfig(entityId: string): DeepReadConfig | null {
  const row = getDatabase()
    .query(
      'SELECT entity_id, community, mode, interval_ms FROM deep_read_config WHERE entity_id = ?',
    )
    .get(entityId) as Row | undefined
  return row ? rowToConfig(row) : null
}

/** The entity must be a node in this topology — the FK plus this guard keep
 *  config rows from dangling off ports/links or another topology's nodes. */
function isNodeEntity(topologyId: string, entityId: string): boolean {
  return (
    getDatabase()
      .query("SELECT 1 FROM entity_registry WHERE id = ? AND topology_id = ? AND kind = 'node'")
      .get(entityId, topologyId) !== null
  )
}

/**
 * Merge-upsert one node's config. Fields left `undefined` are kept, `null`
 * clears. When every field ends up empty the row is deleted — an all-empty
 * row and no row mean the same thing.
 * Returns the resulting config (null = row removed / never existed), or
 * `'not-a-node'` when the entity isn't a node of this topology.
 */
export function upsertDeepReadConfig(
  topologyId: string,
  entityId: string,
  patch: DeepReadConfigPatch,
): DeepReadConfig | null | 'not-a-node' {
  if (!isNodeEntity(topologyId, entityId)) return 'not-a-node'
  const db = getDatabase()
  const current = getDeepReadConfig(entityId)

  const next = {
    community: patch.community === undefined ? (current?.community ?? null) : patch.community,
    mode: patch.mode === undefined ? (current?.mode ?? null) : patch.mode,
    intervalMs: patch.intervalMs === undefined ? (current?.intervalMs ?? null) : patch.intervalMs,
  }

  if (next.community == null && next.mode == null && next.intervalMs == null) {
    db.query('DELETE FROM deep_read_config WHERE entity_id = ?').run(entityId)
    return null
  }

  db.query(
    `INSERT INTO deep_read_config (entity_id, topology_id, community, mode, interval_ms, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(entity_id) DO UPDATE SET
       community = excluded.community,
       mode = excluded.mode,
       interval_ms = excluded.interval_ms,
       updated_at = excluded.updated_at`,
  ).run(entityId, topologyId, next.community, next.mode, next.intervalMs, timestamp())
  return getDeepReadConfig(entityId)
}

export function deleteDeepReadConfig(entityId: string): void {
  getDatabase().query('DELETE FROM deep_read_config WHERE entity_id = ?').run(entityId)
}

/**
 * Bulk-set fields for EVERY node entity in the topology — the "give all 58
 * switches community X" operation, as the single SQL statement it should be.
 * Only the provided fields are written; existing rows keep their other
 * fields, missing rows are created.
 *
 * Deliberately NOT filtered by `entity_registry.status`: the registry's
 * active/retired flag can lag behind what the resolved graph actually shows
 * (mass retire-and-readopt churn), and a config row for a truly-gone entity
 * is inert — it only ever matters when a resolved node id matches it.
 */
export function bulkSetDeepReadConfig(
  topologyId: string,
  patch: DeepReadConfigPatch,
): { updated: number } {
  const db = getDatabase()
  const now = timestamp()
  const community = patch.community === undefined ? null : patch.community
  const mode = patch.mode === undefined ? null : patch.mode
  const intervalMs = patch.intervalMs === undefined ? null : patch.intervalMs
  const setCommunity = patch.community !== undefined ? 1 : 0
  const setMode = patch.mode !== undefined ? 1 : 0
  const setInterval = patch.intervalMs !== undefined ? 1 : 0

  db.query(
    `INSERT INTO deep_read_config (entity_id, topology_id, community, mode, interval_ms, updated_at)
     SELECT er.id, er.topology_id, ?, ?, ?, ?
       FROM entity_registry er
      WHERE er.topology_id = ? AND er.kind = 'node'
     ON CONFLICT(entity_id) DO UPDATE SET
       community = CASE WHEN ? THEN excluded.community ELSE deep_read_config.community END,
       mode = CASE WHEN ? THEN excluded.mode ELSE deep_read_config.mode END,
       interval_ms = CASE WHEN ? THEN excluded.interval_ms ELSE deep_read_config.interval_ms END,
       updated_at = excluded.updated_at`,
  ).run(community, mode, intervalMs, now, topologyId, setCommunity, setMode, setInterval)

  // Drop rows the bulk clear emptied out (all-empty row ≡ no row).
  db.query(
    `DELETE FROM deep_read_config
      WHERE topology_id = ? AND community IS NULL AND mode IS NULL AND interval_ms IS NULL`,
  ).run(topologyId)

  const row = db
    .query('SELECT COUNT(*) AS n FROM deep_read_config WHERE topology_id = ?')
    .get(topologyId) as { n: number }
  return { updated: row.n }
}
