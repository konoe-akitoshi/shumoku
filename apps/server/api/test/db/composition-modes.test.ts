// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Composition — service round-trips. Scope (020) and the merge method (022) are
 * topology-level: scopeMode persists, scopeSourceId only sticks for 'closed', and
 * compositionMode persists. Nothing about either is per source.
 */
import { afterAll, beforeAll, expect, test } from 'bun:test'
import { TopologyService } from '../../src/services/topology.ts'
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

test('topology composition mode defaults to additive and round-trips', () => {
  makeTopology('t_mode_topo')
  const svc = new TopologyService()
  expect(svc.get('t_mode_topo')?.compositionMode).toBe('additive')
  const enriched = svc.setCompositionMode('t_mode_topo', 'enrichment')
  expect(enriched?.compositionMode).toBe('enrichment')
  const back = svc.setCompositionMode('t_mode_topo', 'additive')
  expect(back?.compositionMode).toBe('additive')
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
