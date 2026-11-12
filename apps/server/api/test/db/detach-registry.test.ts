// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Detaching a source: the registry keys it wrote no longer match, so a new source's device is not
 * absorbed into an entity only the detached source had bound; re-attaching re-adopts its entities.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { ObservationsService } from '../../src/services/observations.ts'
import { TopologyService } from '../../src/services/topology.ts'
import { TopologySourcesService } from '../../src/services/topology-sources.ts'
import {
  attachSource,
  getDatabase,
  graphToSource,
  insertDataSource,
  type ObservedGraph as NetworkGraph,
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

const attachmentId = (topologyId: string, dataSourceId: string): string =>
  `tds_${topologyId}_${dataSourceId}_topology`

async function record(topologyId: string, sourceId: string, graph: NetworkGraph): Promise<void> {
  await obs.record({
    topologyId,
    sourceId,
    capturedAt: timestamp(),
    status: 'ok',
    source: graphToSource(graph),
  })
  svc.clearCacheEntry(topologyId)
}

function nodeEntity(topologyId: string, sourceId: string, nodeId: string): string | undefined {
  return getDatabase()
    .query<{ entity_id: string }, [string, string, string]>(
      `SELECT entity_id FROM entity_element
       WHERE topology_id = ? AND source_id = ? AND kind = 'node' AND local_id = ?`,
    )
    .get(topologyId, sourceId, nodeId)?.entity_id
}

describe('detaching a source', () => {
  test("its registry keys no longer pull another source's device into its entity", async () => {
    const topo = await svc.create({ name: 'detach-magnet' })
    const old = insertDataSource('manual', 'detach_old')
    attachSource(topo.id, old, 'topology')
    await record(topo.id, old, {
      version: '1',
      name: 'old',
      nodes: [{ id: 'd10', label: 'd10', shape: 'rect', identity: { mgmtIp: '172.20.17.12' } }],
      links: [],
    } as NetworkGraph)
    const oldEntity = nodeEntity(topo.id, old, 'd10')
    expect(oldEntity).toBeDefined()

    expect(new TopologySourcesService().remove(attachmentId(topo.id, old))).toBe(true)

    const fresh = insertDataSource('manual', 'detach_new')
    attachSource(topo.id, fresh, 'topology')
    await record(topo.id, fresh, {
      version: '1',
      name: 'new',
      nodes: [{ id: 'd19', label: 'd19', shape: 'rect', identity: { mgmtIp: '172.20.17.12' } }],
      links: [],
    } as NetworkGraph)
    const freshEntity = nodeEntity(topo.id, fresh, 'd19')
    expect(freshEntity).toBeDefined()
    expect(freshEntity).not.toBe(oldEntity)
  })

  test('re-attaching the source adopts its old entities again', async () => {
    const topo = await svc.create({ name: 'detach-reattach' })
    const src = insertDataSource('manual', 'reattach_src')
    const graph = {
      version: '1',
      name: 'src',
      nodes: [{ id: 'r1', label: 'r1', shape: 'rect', identity: { mgmtIp: '10.1.0.1' } }],
      links: [],
    } as NetworkGraph
    attachSource(topo.id, src, 'topology')
    await record(topo.id, src, graph)
    const before = nodeEntity(topo.id, src, 'r1')

    new TopologySourcesService().remove(attachmentId(topo.id, src))
    attachSource(topo.id, src, 'topology')
    await record(topo.id, src, graph)
    expect(nodeEntity(topo.id, src, 'r1')).toBe(before)
  })
})
