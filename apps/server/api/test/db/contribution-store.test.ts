// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Stage 1 of the DB-native persistence refactor: the uniform contribution store
 * (migration 016). These assert the SCHEMA + its integrity constraints actually
 * bite — the codec (ingestGraph/buildGraph) is tested separately. See
 * apps/server/docs/design/db-native-persistence.md.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { getDatabase, setupTempDb, type TempDb } from './helper.ts'

let db_: TempDb
beforeAll(() => {
  db_ = setupTempDb()
})
afterAll(() => db_.teardown())

const tables = (): string[] =>
  (
    getDatabase().query("SELECT name FROM sqlite_master WHERE type='table'").all() as {
      name: string
    }[]
  ).map((t) => t.name)

/** A statement that must throw (constraint violation). */
const expectReject = (fn: () => void) => expect(fn).toThrow()

function seedTopology(id: string): void {
  getDatabase()
    .query('INSERT INTO topologies (id, name, created_at, updated_at) VALUES (?, ?, 0, 0)')
    .run(id, id)
}

describe('migration 016 — contribution store schema', () => {
  test('all contribution tables exist', () => {
    const t = tables()
    for (const name of [
      'contribution_source',
      'contribution_element',
      'contribution_identity',
      'contribution_link',
      'contribution_link_via',
      'contribution_attachment',
    ]) {
      expect(t).toContain(name)
    }
  })

  test('integrity_check + foreign_key_check are clean', () => {
    const db = getDatabase()
    expect(
      (db.query('PRAGMA integrity_check').get() as { integrity_check: string }).integrity_check,
    ).toBe('ok')
    expect(db.query('PRAGMA foreign_key_check').all().length).toBe(0)
  })
})

describe('migration 016 — integrity constraints bite', () => {
  test('at most one intrinsic (attachment_id NULL) contribution per topology', () => {
    const db = getDatabase()
    seedTopology('t_intrinsic')
    db.query(
      'INSERT INTO contribution_source (topology_id, source_id, attachment_id) VALUES (?, ?, NULL)',
    ).run('t_intrinsic', 'c1')
    expectReject(() =>
      db
        .query(
          'INSERT INTO contribution_source (topology_id, source_id, attachment_id) VALUES (?, ?, NULL)',
        )
        .run('t_intrinsic', 'c2'),
    )
  })

  test('element FK to contribution_source is enforced; bad kind rejected', () => {
    const db = getDatabase()
    seedTopology('t_el')
    db.query(
      'INSERT INTO contribution_source (topology_id, source_id, attachment_id) VALUES (?, ?, NULL)',
    ).run('t_el', 'c')
    db.query(
      'INSERT INTO contribution_element (topology_id, source_id, local_id, kind, presence) VALUES (?, ?, ?, ?, ?)',
    ).run('t_el', 'c', 'n1', 'node', 'present')
    expectReject(() =>
      db
        .query(
          'INSERT INTO contribution_element (topology_id, source_id, local_id, kind) VALUES (?, ?, ?, ?)',
        )
        .run('t_el', 'missing-source', 'n2', 'node'),
    )
    expectReject(() =>
      db
        .query(
          'INSERT INTO contribution_element (topology_id, source_id, local_id, kind) VALUES (?, ?, ?, ?)',
        )
        .run('t_el', 'c', 'n3', 'widget'),
    )
  })

  test('attachment CHECKs: topology-default ⇔ element NULL, and binding needs a target', () => {
    const db = getDatabase()
    seedTopology('t_att')
    db.query(
      'INSERT INTO contribution_source (topology_id, source_id, attachment_id) VALUES (?, ?, NULL)',
    ).run('t_att', 'c')
    db.query(
      'INSERT INTO contribution_element (topology_id, source_id, local_id, kind, presence) VALUES (?, ?, ?, ?, ?)',
    ).run('t_att', 'c', 'n1', 'node', null)
    const eid = (
      db
        .query('SELECT id FROM contribution_element WHERE topology_id=? AND local_id=?')
        .get('t_att', 'n1') as {
        id: number
      }
    ).id
    // topology-default scope with an element_id → reject
    expectReject(() =>
      db
        .query(
          'INSERT INTO contribution_attachment (topology_id, source_id, element_id, scope, kind, attachment_key) VALUES (?, ?, ?, ?, ?, ?)',
        )
        .run('t_att', 'c', eid, 'topology-default', 'policy', 'policy'),
    )
    // metrics-binding, asserted (negate 0), no target → reject
    expectReject(() =>
      db
        .query(
          'INSERT INTO contribution_attachment (topology_id, source_id, element_id, scope, kind, attachment_key, negate) VALUES (?, ?, ?, ?, ?, ?, 0)',
        )
        .run('t_att', 'c', eid, 'node', 'metrics-binding', 'metrics-binding:x'),
    )
    // valid policy attachment → ok
    db.query(
      'INSERT INTO contribution_attachment (topology_id, source_id, element_id, scope, kind, attachment_key) VALUES (?, ?, ?, ?, ?, ?)',
    ).run('t_att', 'c', eid, 'node', 'policy', 'policy')
    expect(
      (
        db
          .query('SELECT COUNT(*) c FROM contribution_attachment WHERE topology_id=?')
          .get('t_att') as { c: number }
      ).c,
    ).toBe(1)
  })

  test('deleting a topology cascades the whole contribution graph', () => {
    const db = getDatabase()
    seedTopology('t_cas')
    db.query(
      'INSERT INTO contribution_source (topology_id, source_id, attachment_id) VALUES (?, ?, NULL)',
    ).run('t_cas', 'c')
    db.query(
      'INSERT INTO contribution_element (topology_id, source_id, local_id, kind) VALUES (?, ?, ?, ?)',
    ).run('t_cas', 'c', 'n1', 'node')
    db.query('DELETE FROM topologies WHERE id=?').run('t_cas')
    expect(
      (
        db.query('SELECT COUNT(*) c FROM contribution_source WHERE topology_id=?').get('t_cas') as {
          c: number
        }
      ).c,
    ).toBe(0)
    expect(
      (
        db
          .query('SELECT COUNT(*) c FROM contribution_element WHERE topology_id=?')
          .get('t_cas') as { c: number }
      ).c,
    ).toBe(0)
  })
})
