// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Phase 3 (entity registry): the resolved graph's `node.id` / `link.id` are
 * flipped to their stable entity ids, and the drawn scene that shares those ids
 * is flipped in lockstep. These tests cover:
 *   - the pure flip mechanics (graph + scene stay internally consistent;
 *     `port.id` is preserved; only the node prefix of a scene port id moves);
 *   - the integration path (getParsed serves a graph whose node/link ids are
 *     ULIDs, stable across re-bakes, and round-trips through the metrics mapping).
 *
 * Run with: cd apps/server/api && bun test test/db/entity-id-flip.test.ts
 */

import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { fromNetworkGraph } from '@shumoku/core'
import { drawNetworkScene } from '@shumoku/renderer/static'
import { flipToEntityIds } from '../../src/services/entity-registry.ts'
import { TopologyService } from '../../src/services/topology.ts'
import {
  attachSource,
  entitiesOf,
  graphToSource,
  insertDataSource,
  type ObservedGraph as NetworkGraph,
  parsedGraph,
  setupTempDb,
  type TempDb,
} from './helper.ts'

// A ULID: 26 Crockford base32 chars (excludes I, L, O, U).
const ULID_RE = /^[0-9A-HJKMNP-TV-Z]{26}$/

/** A 2-node + 1-link graph with port identities so every element gets an entity. */
function sampleGraph(name: string): NetworkGraph {
  return {
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
}

describe('flip mechanics (pure)', () => {
  test('graph + scene flip together; port.id preserved', () => {
    // Draw the ORIGINAL-id graph exactly like the derive worker does.
    const base = sampleGraph('flip-pure')
    const scene = drawNetworkScene(fromNetworkGraph(base))

    // Stamp entity ids by hand (no registry needed for the pure flip): the flip
    // reads whatever `entityId` the graph carries.
    const stamped: NetworkGraph = {
      ...base,
      nodes: [
        { ...base.nodes[0], entityId: 'AAAAAAAAAAAAAAAAAAAAAAAAAA' },
        { ...base.nodes[1], entityId: 'BBBBBBBBBBBBBBBBBBBBBBBBBB' },
      ] as NetworkGraph['nodes'],
      links: [
        { ...base.links[0], entityId: 'LLLLLLLLLLLLLLLLLLLLLLLLLL' },
      ] as NetworkGraph['links'],
    }

    const flipped = flipToEntityIds(stamped, scene, entitiesOf(stamped))

    // --- graph ---
    const [na, nb] = flipped.graph.nodes
    expect(na?.id).toBe('AAAAAAAAAAAAAAAAAAAAAAAAAA')
    expect(nb?.id).toBe('BBBBBBBBBBBBBBBBBBBBBBBBBB')
    // port.id is NOT flipped
    expect(na?.ports?.[0]?.id).toBe('pa')
    const link = flipped.graph.links[0]
    expect(link?.id).toBe('LLLLLLLLLLLLLLLLLLLLLLLLLL')
    expect(link?.from.node).toBe('AAAAAAAAAAAAAAAAAAAAAAAAAA')
    expect(link?.to.node).toBe('BBBBBBBBBBBBBBBBBBBBBBBBBB')
    // link endpoint PORT names are untouched
    expect(link?.from.port).toBe('pa')

    // --- scene (nodes, wires, ports under the new ids) ---
    const sceneNodeIds = flipped.scene.nodes.map((n) => n.node.id).sort()
    expect(sceneNodeIds).toEqual(['AAAAAAAAAAAAAAAAAAAAAAAAAA', 'BBBBBBBBBBBBBBBBBBBBBBBBBB'])
    const wire = flipped.scene.wires[0]
    expect(wire?.link.id).toBe('LLLLLLLLLLLLLLLLLLLLLLLLLL')
    expect(wire?.link.from.node).toBe('AAAAAAAAAAAAAAAAAAAAAAAAAA')
    expect(wire?.link.to.node).toBe('BBBBBBBBBBBBBBBBBBBBBBBBBB')
    // a scene port id keeps its port-name suffix, only the node prefix moves
    const port = flipped.scene.ports?.find((p) => p.nodeId === 'AAAAAAAAAAAAAAAAAAAAAAAAAA')
    expect(port?.id).toBe('AAAAAAAAAAAAAAAAAAAAAAAAAA/pa')
  })

  test('no entityId stamped → nothing changes (identity flip)', () => {
    const base = sampleGraph('flip-noop')
    const scene = drawNetworkScene(fromNetworkGraph(base))
    const flipped = flipToEntityIds(base, scene, entitiesOf(base))
    expect(flipped.graph.nodes[0]?.id).toBe('a')
    expect(flipped.graph.links[0]?.id).toBe('L1')
    expect(flipped.scene).toBe(scene)
  })

  test('duplicate entity claims: only the first node flips; ids stay unique', () => {
    // The registry can (correctly) unify two RESOLVED nodes as one entity when
    // resolve's fold didn't bridge them (zabbix host node + its LLDP-peer stub,
    // chained through a NetBox observation). Flipping BOTH to the same id
    // collapsed the renderer's keyed collections — one box vanished while its
    // ports kept rendering (the prod defect). The guard: first claimant in
    // graph order takes the entity id, later claimants keep their element id.
    const base = sampleGraph('flip-dup')
    const stamped: NetworkGraph = {
      ...base,
      nodes: [
        { ...base.nodes[0], entityId: 'DDDDDDDDDDDDDDDDDDDDDDDDDD' },
        { ...base.nodes[1], entityId: 'DDDDDDDDDDDDDDDDDDDDDDDDDD' }, // same entity!
      ] as NetworkGraph['nodes'],
      links: base.links,
    }
    const g = flipToEntityIds(
      stamped,
      drawNetworkScene(fromNetworkGraph(stamped)),
      entitiesOf(stamped),
    ).graph
    const ids = g.nodes.map((n) => n.id)
    // first claimant flipped, second keeps its original element id
    expect(ids[0]).toBe('DDDDDDDDDDDDDDDDDDDDDDDDDD')
    expect(ids[1]).toBe('b')
    // the invariant that matters: no duplicate ids in the flipped graph
    expect(new Set(ids).size).toBe(ids.length)
    // links referencing the un-flipped node still resolve to its (kept) id
    expect(g.links[0]?.to.node).toBe('b')
    expect(g.links[0]?.from.node).toBe('DDDDDDDDDDDDDDDDDDDDDDDDDD')
  })

  test('duplicate link-entity claims: later links keep their element id', () => {
    const base = sampleGraph('flip-dup-link')
    const stamped: NetworkGraph = {
      ...base,
      links: [
        { ...base.links[0], entityId: 'KKKKKKKKKKKKKKKKKKKKKKKKKK' },
        {
          id: 'second',
          from: { node: 'a', port: 'px' },
          to: { node: 'b', port: 'py' },
          entityId: 'KKKKKKKKKKKKKKKKKKKKKKKKKK', // same entity!
        },
      ] as NetworkGraph['links'],
    }
    const g = flipToEntityIds(
      stamped,
      drawNetworkScene(fromNetworkGraph(stamped)),
      entitiesOf(stamped),
    ).graph
    const ids = g.links.map((l) => l.id)
    expect(ids[0]).toBe('KKKKKKKKKKKKKKKKKKKKKKKKKK')
    expect(ids[1]).toBe('second')
    expect(new Set(ids).size).toBe(ids.length)
  })

  test('the flip moves a graph without a stamped scene too', () => {
    const base = sampleGraph('flip-graph-only')
    const stamped: NetworkGraph = {
      ...base,
      nodes: [
        { ...base.nodes[0], entityId: 'AAAAAAAAAAAAAAAAAAAAAAAAAA' },
        { ...base.nodes[1], entityId: 'BBBBBBBBBBBBBBBBBBBBBBBBBB' },
      ] as NetworkGraph['nodes'],
      links: [
        { ...base.links[0], entityId: 'LLLLLLLLLLLLLLLLLLLLLLLLLL' },
      ] as NetworkGraph['links'],
    }
    const g = flipToEntityIds(
      stamped,
      drawNetworkScene(fromNetworkGraph(stamped)),
      entitiesOf(stamped),
    ).graph
    expect(g.nodes[0]?.id).toBe('AAAAAAAAAAAAAAAAAAAAAAAAAA')
    expect(g.links[0]?.from.node).toBe('AAAAAAAAAAAAAAAAAAAAAAAAAA')
    expect(g.links[0]?.id).toBe('LLLLLLLLLLLLLLLLLLLLLLLLLL')
  })
})

describe('flip integration (via the derive worker)', () => {
  let db_: TempDb
  let svc: TopologyService
  beforeAll(() => {
    db_ = setupTempDb()
    svc = new TopologyService()
  })
  afterAll(() => db_.teardown())

  async function makeTopo(name: string): Promise<string> {
    const topo = await svc.create({ name })
    await svc.writeProjectOverlay(topo.id, graphToSource(sampleGraph(name)))
    attachSource(topo.id, insertDataSource('zabbix', `zbx_${name}`), 'metrics')
    return topo.id
  }

  test('resolved graph node/link ids are ULIDs (entity ids)', async () => {
    const topoId = await makeTopo('flip-int')
    const parsed = await svc.getParsed(topoId)
    expect(parsed).not.toBeNull()
    if (!parsed) return

    for (const node of parsedGraph(parsed).nodes) {
      // Both nodes have a network identity → each gets a ULID id === its entityId.
      expect(node.id).toMatch(ULID_RE)
      expect(node.id).toBe(node.entityId)
      // port.id stays the human-facing local name.
      expect(node.ports?.[0]?.id).not.toMatch(ULID_RE)
    }
    const link = parsedGraph(parsed).links[0]
    expect(link?.id).toMatch(ULID_RE)
    expect(link?.id).toBe(link?.entityId)
    // endpoints reference the flipped node ids
    expect(link?.from.node).toBe(
      parsedGraph(parsed).nodes.find((n) => n.entityId === link?.from.node)?.id,
    )
  })

  test('graph ↔ scene stay consistent after the flip', async () => {
    const topoId = await makeTopo('flip-consistent')
    const parsed = await svc.getParsed(topoId)
    expect(parsed?.scene).toBeDefined()
    if (!parsed?.scene) return

    const graphNodeIds = new Set(parsed.graph.nodes.map((n) => n.id))
    for (const { node } of parsed.scene.nodes) {
      expect(graphNodeIds.has(node.id)).toBe(true)
    }
    // every wire is a graph link, and its endpoints are graph nodes
    const graphLinkIds = new Set(parsed.graph.links.map((l) => l.id))
    for (const { link } of parsed.scene.wires) {
      expect(link.id !== undefined && graphLinkIds.has(link.id)).toBe(true)
      expect(graphNodeIds.has(link.from.node)).toBe(true)
      expect(graphNodeIds.has(link.to.node)).toBe(true)
    }
    // scene ports sit on flipped (graph) nodes
    for (const port of parsed.scene.ports ?? []) {
      expect(graphNodeIds.has(port.nodeId)).toBe(true)
    }
  })

  test('ids are stable across a re-bake (resolve twice → same ids)', async () => {
    const topoId = await makeTopo('flip-stable')
    const first = await svc.getParsed(topoId)
    const firstNodeIds = first?.graph.nodes.map((n) => n.id).sort()
    const firstLinkId = first?.graph.links[0]?.id

    // Force a fresh derive (drops the artifact + bumps revision) and re-serve.
    await svc.rebake(topoId)
    const second = await svc.getParsed(topoId)
    const secondNodeIds = second?.graph.nodes.map((n) => n.id).sort()
    const secondLinkId = second?.graph.links[0]?.id

    expect(secondNodeIds).toEqual(firstNodeIds)
    expect(secondLinkId).toBe(firstLinkId)
  })

  test('the (entity-id) node/link ids round-trip through the metrics mapping', async () => {
    const topoId = await makeTopo('flip-mapping')
    const parsed = await svc.getParsed(topoId)
    const nodeId = parsed?.graph.nodes[0]?.id ?? ''
    const linkKey = parsed?.graph.links[0]?.id ?? ''
    expect(nodeId).toMatch(ULID_RE)
    expect(linkKey).toMatch(ULID_RE)

    await svc.updateMapping(topoId, {
      nodes: { [nodeId]: { hostId: '1' } },
      links: { [linkKey]: { monitoredNodeId: nodeId, interface: 'Gi0/1' } },
    })
    const m = (await svc.getParsed(topoId))?.mapping
    expect(m?.nodes?.[nodeId]?.hostId).toBe('1')
    expect(m?.links?.[linkKey]?.monitoredNodeId).toBe(nodeId)
  })
})
