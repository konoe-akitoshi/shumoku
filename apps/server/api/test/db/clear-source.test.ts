// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { ObservationsService } from '../../src/services/observations.ts'
import { TopologyService } from '../../src/services/topology.ts'
import {
  attachSource,
  graphToSource,
  insertDataSource,
  type ObservedGraph as NetworkGraph,
  parsedGraph,
  setupTempDb,
  type TempDb,
  timestamp,
} from './helper.ts'

let db_: TempDb
let svc: TopologyService
let obs: ObservationsService
beforeAll(() => {
  db_ = setupTempDb()
  svc = new TopologyService()
  obs = new ObservationsService()
})
afterAll(() => db_.teardown())

const graphWith = (nodeId: string): NetworkGraph =>
  ({
    version: '1',
    name: 't',
    nodes: [{ id: nodeId, label: nodeId, shape: 'rect', identity: { sysName: nodeId } }],
    links: [],
  }) as NetworkGraph

describe('clear a source (deleteForSource) → resolve sweeps its orphans', () => {
  test('removes only the cleared source contribution; others survive', async () => {
    const topo = await svc.create({ name: 'clear' })
    await svc.writeProjectOverlay(topo.id, graphToSource(graphWith('authored-A')))

    const nbId = insertDataSource('netbox', 'nb_clear')
    attachSource(topo.id, nbId, 'topology')
    await obs.record({
      topologyId: topo.id,
      sourceId: nbId,
      capturedAt: timestamp(),
      status: 'ok',
      source: graphToSource(graphWith('nb-B')),
    })
    svc.clearCacheEntry(topo.id)

    // Both contributions present.
    let ids = parsedGraph(await svc.getParsed(topo.id)).nodes.map((n) => n.identity?.sysName) ?? []
    expect(ids).toContain('authored-A')
    expect(ids).toContain('nb-B')

    // Clear netbox's contribution.
    const deleted = obs.deleteForSource(topo.id, nbId)
    expect(deleted).toBe(1)
    svc.clearCacheEntry(topo.id)

    // nb-B is swept; the authored node survives. The attachment row stays.
    ids = parsedGraph(await svc.getParsed(topo.id)).nodes.map((n) => n.identity?.sysName) ?? []
    expect(ids).toContain('authored-A')
    expect(ids).not.toContain('nb-B')
  })
})
