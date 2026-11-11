// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Migration 037 on a database that still has `deep_read_config` rows: one
 * server-wide credential per distinct community, linked to every topology that
 * used it, devices pointed at it, `disabled` rows kept as enabled = 0.
 */

import { Database } from 'bun:sqlite'
import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const MIGRATIONS = join(import.meta.dir, '../../src/db/migrations')
const sql = (name: string) => readFileSync(join(MIGRATIONS, name), 'utf8')

/** An in-memory database as it stood after 032: just the tables 031/032/037 touch. */
function databaseBefore037(): Database {
  const db = new Database(':memory:')
  db.exec('CREATE TABLE topologies (id TEXT PRIMARY KEY, name TEXT NOT NULL)')
  db.exec('CREATE TABLE entity_registry (id TEXT PRIMARY KEY, topology_id TEXT)')
  db.exec(sql('031_discovery_config.sql'))
  db.exec(sql('032_deep_read_rename.sql'))
  return db
}

describe('037 device access migration', () => {
  test('old deep_read_config rows become credentials, links and device_access rows', () => {
    const db = databaseBefore037()
    for (const t of ['t1', 't2', 't3']) db.query('INSERT INTO topologies VALUES (?, ?)').run(t, t)
    const seed = db.query(
      `INSERT INTO deep_read_config (entity_id, topology_id, community, mode, interval_ms, updated_at)
       VALUES (?, ?, ?, ?, NULL, ?)`,
    )
    // community "shared" is used in two topologies; "solo" in one
    seed.run('e1', 't1', 'shared', null, 11)
    seed.run('e2', 't1', 'solo', 'auto', 12)
    seed.run('e3', 't2', 'shared', 'observe', 13)
    seed.run('e4', 't2', 'shared', 'disabled', 14) // credential, but turned off
    seed.run('e5', 't2', null, 'disabled', 15) // disabled, no credential
    seed.run('e6', 't3', null, 'auto', 16) // says nothing
    seed.run('e7', 't3', '', null, 17) // empty community, says nothing

    db.exec(sql('037_device_access.sql'))

    const credentials = db
      .query('SELECT id, name, method, params_json, secret_json FROM credential ORDER BY name')
      .all() as Array<{
      id: string
      name: string
      method: string
      params_json: string
      secret_json: string
    }>
    expect(credentials).toHaveLength(2)
    expect(credentials.map((c) => c.name)).toEqual(['SNMP 1', 'SNMP 2'])
    expect(credentials.every((c) => c.method === 'snmp' && c.params_json === '{}')).toBe(true)
    // Names never contain the secret.
    expect(credentials.every((c) => !c.name.includes('shared') && !c.name.includes('solo'))).toBe(
      true,
    )
    const byCommunity = new Map(
      credentials.map((c) => [
        (JSON.parse(c.secret_json) as { community: string }).community,
        c.id,
      ]),
    )
    expect([...byCommunity.keys()].sort()).toEqual(['shared', 'solo'])

    const links = db
      .query(
        'SELECT topology_id, credential_id FROM topology_credential ORDER BY topology_id, credential_id',
      )
      .all() as Array<{ topology_id: string; credential_id: string }>
    const shared = byCommunity.get('shared')
    const solo = byCommunity.get('solo')
    expect(links.map((l) => `${l.topology_id}:${l.credential_id}`).sort()).toEqual(
      [`t1:${shared}`, `t1:${solo}`, `t2:${shared}`].sort(),
    )

    const rows = new Map(
      (
        db
          .query('SELECT entity_id, topology_id, credential_id, enabled FROM device_access')
          .all() as Array<{
          entity_id: string
          topology_id: string
          credential_id: string | null
          enabled: number
        }>
      ).map((r) => [r.entity_id, r]),
    )
    expect([...rows.keys()].sort()).toEqual(['e1', 'e2', 'e3', 'e4', 'e5'])
    expect(rows.get('e1')).toMatchObject({ credential_id: shared, enabled: 1 })
    expect(rows.get('e2')).toMatchObject({ credential_id: solo, enabled: 1 })
    expect(rows.get('e3')).toMatchObject({ credential_id: shared, enabled: 1 })
    expect(rows.get('e4')).toMatchObject({ credential_id: shared, enabled: 0 })
    expect(rows.get('e5')).toMatchObject({ credential_id: null, enabled: 0 })

    // The old table is gone, and the clock stamps are set.
    expect(
      db.query("SELECT name FROM sqlite_master WHERE name = 'deep_read_config'").get(),
    ).toBeNull()
    const stamps = db.query('SELECT secret_changed_at FROM credential').all() as Array<{
      secret_changed_at: number
    }>
    expect(stamps.every((s) => s.secret_changed_at > 0)).toBe(true)
    db.close()
  })

  test('an empty old table migrates to empty new tables', () => {
    const db = databaseBefore037()
    db.exec(sql('037_device_access.sql'))
    for (const table of ['credential', 'topology_credential', 'device_access']) {
      expect(db.query(`SELECT COUNT(*) AS n FROM ${table}`).get()).toEqual({ n: 0 })
    }
    db.close()
  })
})
