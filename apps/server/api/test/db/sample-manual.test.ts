// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * DEMO_MODE seeds a sample network. It is a Manual source of its topology, visible under the
 * topology's sources like any other, and nothing is stored without an owner.
 *
 * Run with: cd apps/server/api && bun test test/db/sample-manual.test.ts
 */

import { afterAll, beforeAll, expect, test } from 'bun:test'
import { TopologyService } from '../../src/services/topology.ts'
import { getDatabase, setupTempDb, type TempDb } from './helper.ts'

let tmp: TempDb
const demoBefore = process.env['DEMO_MODE']
beforeAll(() => {
  tmp = setupTempDb()
  process.env['DEMO_MODE'] = 'true'
})
afterAll(() => {
  if (demoBefore === undefined) delete process.env['DEMO_MODE']
  else process.env['DEMO_MODE'] = demoBefore
  tmp.teardown()
})

test('the sample network is a Manual source, and no contribution is ownerless', async () => {
  const svc = new TopologyService()
  await svc.initializeSample()

  const topologies = svc.list()
  expect(topologies.map((t) => t.name)).toEqual(['Sample Network'])
  const topology = topologies[0]
  if (!topology) throw new Error('no sample topology')

  const sources = getDatabase()
    .query(
      `SELECT ds.type AS type, tds.purpose AS purpose
       FROM topology_data_sources tds JOIN data_sources ds ON ds.id = tds.data_source_id
       WHERE tds.topology_id = ?`,
    )
    .all(topology.id) as { type: string; purpose: string }[]
  expect(sources).toEqual([{ type: 'manual', purpose: 'topology' }])

  const ownerless = getDatabase()
    .query('SELECT COUNT(*) AS c FROM contribution_source WHERE attachment_id IS NULL')
    .get() as { c: number }
  expect(ownerless.c).toBe(0)

  // It is drawn: the sample's nodes and links reach the resolved graph.
  const graph = (await svc.getParsed(topology.id))?.graph
  expect(graph?.nodes.length ?? 0).toBeGreaterThan(0)
  expect(graph?.links.length ?? 0).toBeGreaterThan(0)
})
