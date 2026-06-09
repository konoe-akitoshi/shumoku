// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { getDatabase, setupTempDb, type TempDb } from './helper.ts'

let db_: TempDb
beforeAll(() => {
  db_ = setupTempDb()
})
afterAll(() => db_.teardown())

const tableNames = (): string[] =>
  (
    getDatabase().query("SELECT name FROM sqlite_master WHERE type='table'").all() as {
      name: string
    }[]
  ).map((t) => t.name)

const columns = (table: string): string[] =>
  (getDatabase().query(`PRAGMA table_info(${table})`).all() as { name: string }[]).map(
    (c) => c.name,
  )

describe('migration chain (001-014)', () => {
  test('all composition-store tables exist', () => {
    const t = tableNames()
    for (const name of [
      'data_sources',
      'topologies',
      'topology_data_sources',
      'topology_observations',
      'topology_resolved_graph',
    ]) {
      expect(t).toContain(name)
    }
  })

  test('topologies is a shell — legacy columns dropped, composition_revision added', () => {
    const cols = columns('topologies')
    expect(cols).toContain('composition_revision')
    expect(cols).toContain('share_token')
    // Dropped by migrations: content_json (010), source pointers (013).
    expect(cols).not.toContain('topology_source_id')
    expect(cols).not.toContain('metrics_source_id')
    expect(cols).not.toContain('content_json')
    // NOTE: mapping_json is created by 001 and dropped by the imperative
    // backfill (not a migration), so it's still present right after migrations.
    // Its removal is covered in mapping-backfill.test.ts.
    expect(cols).toContain('mapping_json')
  })

  test('topology_resolved_graph has the artifact columns', () => {
    const cols = columns('topology_resolved_graph')
    for (const c of ['graph_json', 'layout_json', 'built_revision', 'resolver_version']) {
      expect(cols).toContain(c)
    }
  })

  test('topology_data_sources has per-source composition-mode columns (018)', () => {
    const cols = columns('topology_data_sources')
    for (const c of ['node_contribution', 'link_contribution']) {
      expect(cols).toContain(c)
    }
    // scope_role was retired (020): scope is a topology-level decision now.
    expect(cols).not.toContain('scope_role')
  })

  test('topologies has topology-level scope columns (020)', () => {
    const cols = columns('topologies')
    for (const c of ['scope_mode', 'scope_source_id']) {
      expect(cols).toContain(c)
    }
  })

  test('contribution_link.local_id is nullable (019) — id-less links are allowed', () => {
    const info = getDatabase().query('PRAGMA table_info(contribution_link)').all() as {
      name: string
      notnull: number
    }[]
    expect(info.find((c) => c.name === 'local_id')?.notnull).toBe(0)
  })
})
