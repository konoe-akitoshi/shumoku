// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Composition — service round-trips:
 *  - Per-source modes (topology-source-modes.md, Axis D): defaults are Additive
 *    (scoop / add); roles persist. Scope is NOT per-source anymore.
 *  - Topology-level scope (020): scopeMode persists; scopeSourceId only sticks
 *    for 'closed'.
 */
import { afterAll, beforeAll, expect, test } from 'bun:test'
import { TopologyService } from '../../src/services/topology.ts'
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

test('add() defaults to Additive (scoop / add)', async () => {
  makeTopology('t_modes_1')
  const ds = insertDataSource('zabbix')
  const svc = new TopologySourcesService()
  const added = await svc.add('t_modes_1', { dataSourceId: ds, purpose: 'topology' })
  expect(added.nodeContribution).toBe('scoop')
  expect(added.linkContribution).toBe('add')

  const got = svc.get(added.id)
  expect(got?.nodeContribution).toBe('scoop')
  expect(got?.linkContribution).toBe('add')
})

test('update() sets per-source role (Enrichment)', async () => {
  makeTopology('t_modes_2')
  const ds = insertDataSource('netbox')
  const svc = new TopologySourcesService()
  const added = await svc.add('t_modes_2', { dataSourceId: ds, purpose: 'topology' })

  const enriched = svc.update(added.id, { nodeContribution: 'anchor', linkContribution: 'update' })
  expect(enriched?.nodeContribution).toBe('anchor')
  expect(enriched?.linkContribution).toBe('update')

  const additive = svc.update(added.id, { nodeContribution: 'scoop', linkContribution: 'add' })
  expect(additive?.nodeContribution).toBe('scoop')
  expect(additive?.linkContribution).toBe('add')
})

test('topology scope defaults to auto, and setScope round-trips', () => {
  makeTopology('t_scope_1')
  const ds = insertDataSource('zabbix', 'ds_scope_src')
  const svc = new TopologyService()

  expect(svc.get('t_scope_1')?.scopeMode).toBe('auto')
  expect(svc.get('t_scope_1')?.scopeSourceId).toBeUndefined()

  const closed = svc.setScope('t_scope_1', 'closed', ds)
  expect(closed?.scopeMode).toBe('closed')
  expect(closed?.scopeSourceId).toBe(ds)

  // scopeSourceId is only meaningful for 'closed' — switching away clears it.
  const open = svc.setScope('t_scope_1', 'open', ds)
  expect(open?.scopeMode).toBe('open')
  expect(open?.scopeSourceId).toBeUndefined()
})

test('topology scope criteria round-trip (setScopeCriteria / readScopeCriteria)', () => {
  makeTopology('t_scope_2')
  const svc = new TopologyService()

  // Defaults: empty filter.
  expect(svc.get('t_scope_2')?.scope).toEqual({ include: [], exclude: [] })

  const set = svc.setScopeCriteria('t_scope_2', {
    include: [{ attr: 'metadata', key: 'hostGroups', value: 'Backbone Routers' }],
    exclude: [{ attr: 'name', value: '^mgmt-' }],
  })
  expect(set?.scope.include).toEqual([
    { attr: 'metadata', key: 'hostGroups', value: 'Backbone Routers' },
  ])
  expect(set?.scope.exclude).toEqual([{ attr: 'name', value: '^mgmt-' }])

  // Replace wholesale: empty clears.
  const cleared = svc.setScopeCriteria('t_scope_2', { include: [], exclude: [] })
  expect(cleared?.scope).toEqual({ include: [], exclude: [] })
})
