// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Per-source composition modes (topology-source-modes.md, Axis D) — service
 * round-trip: defaults are Additive (scoop / add / no scope); roles persist;
 * scopeRole clears back to additive with an explicit null.
 */
import { afterAll, beforeAll, expect, test } from 'bun:test'
import { TopologySourcesService } from '../../src/services/topology-sources.ts'
import { getDatabase, insertDataSource, setupTempDb, type TempDb } from './helper.ts'

let db_: TempDb
beforeAll(() => {
  db_ = setupTempDb()
})
afterAll(() => db_.teardown())

function makeTopology(id: string): void {
  getDatabase()
    .query('INSERT INTO topologies (id, name, created_at, updated_at) VALUES (?, ?, 0, 0)')
    .run(id, id)
}

test('add() defaults to Additive (scoop / add / no scope)', async () => {
  makeTopology('t_modes_1')
  const ds = insertDataSource('zabbix')
  const svc = new TopologySourcesService()
  const added = await svc.add('t_modes_1', { dataSourceId: ds, purpose: 'topology' })
  expect(added.nodeContribution).toBe('scoop')
  expect(added.linkContribution).toBe('add')
  expect(added.scopeRole).toBeUndefined()

  const got = svc.get(added.id)
  expect(got?.nodeContribution).toBe('scoop')
  expect(got?.linkContribution).toBe('add')
  expect(got?.scopeRole).toBeUndefined()
})

test('update() sets a role, and scopeRole clears with explicit null', async () => {
  makeTopology('t_modes_2')
  const ds = insertDataSource('netbox')
  const svc = new TopologySourcesService()
  const added = await svc.add('t_modes_2', { dataSourceId: ds, purpose: 'topology' })

  // → Enrichment
  const enriched = svc.update(added.id, { nodeContribution: 'anchor', linkContribution: 'update' })
  expect(enriched?.nodeContribution).toBe('anchor')
  expect(enriched?.linkContribution).toBe('update')

  // → Scoping
  const scoped = svc.update(added.id, {
    nodeContribution: 'scoop',
    linkContribution: 'add',
    scopeRole: 'scoping',
  })
  expect(scoped?.scopeRole).toBe('scoping')

  // clear scope back to additive
  const cleared = svc.update(added.id, { scopeRole: null })
  expect(cleared?.scopeRole).toBeUndefined()
})

test('add() honors explicit modes', async () => {
  makeTopology('t_modes_3')
  const ds = insertDataSource('prometheus')
  const svc = new TopologySourcesService()
  const added = await svc.add('t_modes_3', {
    dataSourceId: ds,
    purpose: 'topology',
    nodeContribution: 'anchor',
    linkContribution: 'update',
    scopeRole: 'scoping',
  })
  expect(added.nodeContribution).toBe('anchor')
  expect(added.linkContribution).toBe('update')
  expect(added.scopeRole).toBe('scoping')
})
