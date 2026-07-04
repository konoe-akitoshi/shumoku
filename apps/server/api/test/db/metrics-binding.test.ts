// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import type { Identity, NetworkGraph } from '@shumoku/core'
import { TopologyService } from '../../src/services/topology.ts'
import { attachSource, getDatabase, insertDataSource, setupTempDb, type TempDb } from './helper.ts'

let db_: TempDb
let svc: TopologyService
beforeAll(() => {
  db_ = setupTempDb()
  svc = new TopologyService()
})
afterAll(() => db_.teardown())

/** Topology with a Manual graph (2 nodes + a link, port identities) and a metrics source. */
async function fixture(
  name: string,
): Promise<{ topoId: string; nodeAId: string; metricsId: string }> {
  const topo = await svc.create({ name })
  const graph: NetworkGraph = {
    version: '1',
    name,
    nodes: [
      {
        id: 'a',
        label: 'A',
        shape: 'rect',
        identity: { mgmtIp: '10.0.0.1' },
        ports: [{ id: 'pa', label: 'Gi0/1', connectors: ['rj45'], identity: { ifName: 'Gi0/1' } }],
      },
      {
        id: 'b',
        label: 'B',
        shape: 'rect',
        identity: { mgmtIp: '10.0.0.2' },
        ports: [{ id: 'pb', label: 'Gi0/2', connectors: ['rj45'], identity: { ifName: 'Gi0/2' } }],
      },
    ],
    links: [{ id: 'L1', from: { node: 'a', port: 'pa' }, to: { node: 'b', port: 'pb' } }],
  } as NetworkGraph
  await svc.writeProjectOverlay(topo.id, graph)
  const metricsId = insertDataSource('zabbix', `zbx_${name}`)
  attachSource(topo.id, metricsId, 'metrics')
  const parsed = await svc.getParsed(topo.id)
  const nodeAId = parsed?.graph.nodes.find((n) => n.identity?.mgmtIp === '10.0.0.1')?.id ?? ''
  return { topoId: topo.id, nodeAId, metricsId }
}

describe('metrics binding write path (identity-keyed attachments)', () => {
  test('node + link bindings derive back; clearing removes them', async () => {
    const { topoId, nodeAId } = await fixture('mb1')
    await svc.updateMapping(topoId, {
      nodes: { [nodeAId]: { hostId: '42', hostName: 'hostA' } },
      links: { L1: { monitoredNodeId: nodeAId, interface: 'Gi0/1', bandwidth: 1000 } },
    })
    let m = (await svc.getParsed(topoId))?.mapping
    expect(m?.nodes?.[nodeAId]).toEqual({ hostId: '42', hostName: 'hostA' })
    expect(m?.links?.['L1']?.monitoredNodeId).toBe(nodeAId)
    expect(m?.links?.['L1']?.interface).toBe('Gi0/1')
    expect(m?.links?.['L1']?.bandwidth).toBe(1000)

    await svc.updateMapping(topoId, { nodes: {}, links: {} })
    m = (await svc.getParsed(topoId))?.mapping
    expect(m?.nodes?.[nodeAId]).toBeUndefined()
    expect(m?.links?.['L1']).toBeUndefined()
  })

  test('a binding from a detached metrics source stops driving the mapping', async () => {
    const { topoId, nodeAId, metricsId } = await fixture('mb2')
    await svc.updateMapping(topoId, { nodes: { [nodeAId]: { hostId: '7' } }, links: {} })
    expect((await svc.getParsed(topoId))?.mapping?.nodes?.[nodeAId]?.hostId).toBe('7')

    // Detach the metrics source → its binding must no longer surface.
    getDatabase()
      .query("DELETE FROM topology_data_sources WHERE data_source_id = ? AND purpose = 'metrics'")
      .run(metricsId)
    svc.clearCacheEntry(topoId)
    expect((await svc.getParsed(topoId))?.mapping?.nodes?.[nodeAId]).toBeUndefined()
  })
})

/**
 * A NetBox-style topology: nodes with NO enumerated ports, ports referenced only
 * by link endpoint names. The contribution store synthesizes stub ports and (as of
 * #548) stamps each with `identity.ifName = <port id>`, so a link metrics binding
 * can anchor. Before the fix the binding was silently skipped and vanished on
 * reload. `writeProjectOverlay` runs through `ingestGraph`, so the stub-port stamp
 * applies here.
 */
async function netboxishFixture(
  name: string,
  // Required (no default): a default object would be substituted when a test
  // passes `undefined` explicitly, defeating the identity-less case.
  nodeAIdentity: Identity | undefined,
): Promise<{ topoId: string; nodeAId: string }> {
  const topo = await svc.create({ name })
  const graph: NetworkGraph = {
    version: '1',
    name,
    nodes: [
      { id: 'a', label: 'A', shape: 'rect', ...(nodeAIdentity ? { identity: nodeAIdentity } : {}) },
      { id: 'b', label: 'B', shape: 'rect', identity: { mgmtIp: '10.5.0.2' } },
    ],
    links: [
      { id: 'L1', from: { node: 'a', port: 'ge-0/0/1' }, to: { node: 'b', port: 'ge-0/0/2' } },
    ],
  } as NetworkGraph
  await svc.writeProjectOverlay(topo.id, graph)
  attachSource(topo.id, insertDataSource('netbox', `nb_${name}`), 'metrics')
  const parsed = await svc.getParsed(topo.id)
  // Use the resolved endpoint id (resolve may re-key the node) so the mapping's
  // monitoredNodeId matches an actual endpoint of the link.
  const nodeAId = parsed?.graph.links.find((l) => l.id === 'L1')?.from.node ?? 'a'
  return { topoId: topo.id, nodeAId }
}

describe('link bindings to identity-less ports (issue #548)', () => {
  test('a link-only-referenced port anchors its binding (skipped=0) and derives back', async () => {
    const { topoId, nodeAId } = await netboxishFixture('mb-nb', { mgmtIp: '10.5.0.1' })
    const { skipped } = await svc.updateMapping(topoId, {
      nodes: {},
      links: { L1: { monitoredNodeId: nodeAId, interface: 'ge-0/0/1', bandwidth: 1000 } },
    })
    // The stub port got identity.ifName at ingest → nothing is dropped.
    expect(skipped).toEqual({ nodes: 0, links: 0 })

    // And it survives reload (the reported bug was this returning empty).
    const m = (await svc.getParsed(topoId))?.mapping
    expect(m?.links?.['L1']?.monitoredNodeId).toBe(nodeAId)
    expect(m?.links?.['L1']?.interface).toBe('ge-0/0/1')
    expect(m?.links?.['L1']?.bandwidth).toBe(1000)
  })

  test('updateMapping reports link bindings it cannot anchor (skipped is honest)', async () => {
    // Node 'a' has no node identity, so even a stamped port can't anchor the
    // binding — it must be counted, not silently dropped.
    const { topoId, nodeAId } = await netboxishFixture('mb-skip', undefined)
    const { skipped } = await svc.updateMapping(topoId, {
      nodes: {},
      links: { L1: { monitoredNodeId: nodeAId, interface: 'ge-0/0/1' } },
    })
    expect(skipped.links).toBe(1)
  })
})
