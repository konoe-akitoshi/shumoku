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
  closeDatabase,
  generateId,
  getDatabase,
  initDatabase,
  timestamp,
} from '../../src/db/index.ts'

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
