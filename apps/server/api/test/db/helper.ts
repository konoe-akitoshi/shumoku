// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Shared setup for DB-backed tests (run under `bun test`, not vitest — they need
 * `bun:sqlite`). Each test file inits a fresh temp database in `beforeAll` and
 * tears it down in `afterAll`; the DB connection is a process singleton, so
 * files run sequentially and each closes before the next inits.
 */
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  fromNetworkGraph,
  type NetworkGraph,
  type SourceNetwork,
  sourceToGraph,
} from '@shumoku/core'
import { ingestNetwork as ingestNetworkCodec } from '../../src/db/contribution-codec.ts'
import {
  closeDatabase,
  generateId,
  getDatabase,
  initDatabase,
  timestamp,
} from '../../src/db/index.ts'
import {
  buildNetwork,
  type IngestOptions,
  ingestNetwork,
} from '../../src/services/contribution-store.ts'
import { adoptOrMintForGraph } from '../../src/services/entity-registry.ts'
import { ObservationsService } from '../../src/services/observations.ts'

export interface TempDb {
  dir: string
  teardown: () => void
}

export function setupTempDb(): TempDb {
  const dir = mkdtempSync(join(tmpdir(), 'shumoku-db-test-'))
  initDatabase(dir)
  return {
    dir,
    teardown: () => {
      closeDatabase()
      try {
        rmSync(dir, { recursive: true, force: true })
      } catch {
        // Windows may hold the file briefly; the temp dir is reaped by the OS.
      }
    },
  }
}

export { generateId, getDatabase, timestamp }

/** Insert a data source row directly (bypassing the plugin layer). */
export function insertDataSource(type: string, id?: string): string {
  const db = getDatabase()
  const sid = id ?? `ds_${Math.abs(hash(type + Math.random().toString()))}`
  const now = timestamp()
  db.query(
    `INSERT INTO data_sources (id, name, type, config_json, status, fail_count, created_at, updated_at)
     VALUES (?, ?, ?, '{}', 'connected', 0, ?, ?)`,
  ).run(sid, type, type, now, now)
  return sid
}

/** Attach a data source to a topology via the m2m table. */
export function attachSource(
  topologyId: string,
  dataSourceId: string,
  purpose: 'topology' | 'metrics',
): void {
  const db = getDatabase()
  const now = timestamp()
  db.query(
    `INSERT INTO topology_data_sources (id, topology_id, data_source_id, purpose, sync_mode, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'manual', ?, ?)`,
  ).run(`tds_${topologyId}_${dataSourceId}_${purpose}`, topologyId, dataSourceId, purpose, now, now)
}

function hash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return h
}

/**
 * Tests describe sources as the graph a source used to send; these turn one into what a source
 * sends now (`SourceNetwork`) and project a stored contribution back to a graph to assert on.
 */
export function sourceOf(graph: NetworkGraph): SourceNetwork {
  const { config, ...layers } = fromNetworkGraph(graph)
  return { network: config, ...layers }
}

export function ingestGraphFixture(
  topologyId: string,
  sourceId: string,
  graph: NetworkGraph,
  opts?: Partial<IngestOptions>,
): void {
  ingestNetwork(topologyId, sourceId, sourceOf(graph), {
    ...opts,
    attachmentId: opts?.attachmentId ?? ownerOf(topologyId, sourceId),
  })
}

export function buildGraphView(topologyId: string, sourceId: string): NetworkGraph | null {
  const built = buildNetwork(topologyId, sourceId)
  return built ? sourceToGraph(built) : null
}

/**
 * The attachment that owns `sourceId`'s contribution in a topology. Created, with its data
 * source, when the test has not attached one: a contribution always belongs to an attachment.
 */
export function ownerOf(topologyId: string, sourceId: string, priority = 0): string {
  const db = getDatabase()
  const existing = db
    .query<{ id: string }, [string, string]>(
      `SELECT id FROM topology_data_sources
       WHERE topology_id = ? AND data_source_id = ? ORDER BY purpose = 'topology' DESC`,
    )
    .get(topologyId, sourceId)
  if (existing) return existing.id
  const now = timestamp()
  db.query(
    `INSERT OR IGNORE INTO data_sources (id, name, type, config_json, status, fail_count, created_at, updated_at)
     VALUES (?, ?, 'manual', '{}', 'connected', 0, ?, ?)`,
  ).run(sourceId, sourceId, now, now)
  const id = `att_${topologyId}_${sourceId}`
  db.query(
    `INSERT INTO topology_data_sources (id, topology_id, data_source_id, purpose, sync_mode, priority, created_at, updated_at)
     VALUES (?, ?, ?, 'topology', 'manual', ?, ?, ?)`,
  ).run(id, topologyId, sourceId, priority, now, now)
  return id
}

/**
 * A project overlay as a pre-0.3.0-beta.2 database kept it: a contribution under
 * `source_id = 'intrinsic'` with no attachment. Nothing writes one any more; this is for the
 * tests of what reads and removes it, so it goes through the codec the old writer used.
 */
export function writeLegacyOverlay(topologyId: string, source: SourceNetwork): void {
  const db = getDatabase()
  ingestNetworkCodec(
    topologyId,
    'intrinsic',
    source,
    { attachmentId: null, lastStatus: 'ok', lastOkAt: timestamp() },
    db,
  )
  adoptOrMintForGraph(topologyId, 'intrinsic', db)
}

/** Write a source's contribution as its owner would, attaching the source first if need be. */
export function ingestOwned(topologyId: string, sourceId: string, source: SourceNetwork): void {
  ingestNetwork(topologyId, sourceId, source, { attachmentId: ownerOf(topologyId, sourceId) })
}

/**
 * Stand-in for the hidden project overlay that tests used as "the authored graph": a Manual
 * source of the topology with a priority above any test source, re-recorded on each call.
 */
export async function writeAuthored(
  svc: { clearCacheEntry(id: string): void },
  topologyId: string,
  source: SourceNetwork,
): Promise<void> {
  const sourceId = `authored_${topologyId}`
  ownerOf(topologyId, sourceId, 1000)
  await new ObservationsService().record({
    topologyId,
    sourceId,
    capturedAt: Date.now(),
    status: 'ok',
    source,
  })
  svc.clearCacheEntry(topologyId)
}
