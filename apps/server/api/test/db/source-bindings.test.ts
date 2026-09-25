import { afterAll, beforeAll, expect, test } from 'bun:test'
import type { NetworkGraph } from '@shumoku/core'
import { ObservationsService } from '../../src/services/observations.ts'
import { bindSourceHosts } from '../../src/services/source-topology.ts'
import { TopologyService } from '../../src/services/topology.ts'
import { attachSource, insertDataSource, setupTempDb, type TempDb } from './helper.ts'

let db: TempDb
beforeAll(() => {
  db = setupTempDb()
})
afterAll(() => db.teardown())

test('manual cables merge with source inventory without inventing interface bindings', async () => {
  const svc = new TopologyService()
  const topology = await svc.create({ name: 'manual-source-composition' })
  const source = insertDataSource('test', 'inventory')
  const manual = insertDataSource('manual', 'cables')
  attachSource(topology.id, source, 'topology')
  attachSource(topology.id, source, 'metrics')
  attachSource(topology.id, manual, 'topology')
  const obs = new ObservationsService()
  const inventory: NetworkGraph = {
    version: '1',
    nodes: ['a', 'b'].map((id) => ({
      id,
      label: id,
      shape: 'rect',
      identity: { vendorIds: { test: id } },
      ports: [{ id: 'eth0', identity: { ifName: 'eth0' }, connectors: [] }],
    })),
    links: [],
  }
  const bound = bindSourceHosts(
    inventory,
    inventory.nodes.map((n) => ({ id: n.id, name: n.id, status: 'unknown' })),
    source,
  )
  const record = async (sourceId: string, graph: NetworkGraph) => {
    await obs.record({
      topologyId: topology.id,
      sourceId,
      capturedAt: Date.now(),
      status: 'ok',
      graph,
    })
    svc.clearCacheEntry(topology.id)
    return svc.getParsed(topology.id)
  }
  await record(source, bound)
  const cables: NetworkGraph = {
    version: '1',
    nodes: ['a', 'b'].map((id) => ({
      id: `manual-${id}`,
      label: id,
      shape: 'rect',
      identity: { vendorIds: { test: id } },
      ports: [{ id: 'endpoint', connectors: [] }],
    })),
    links: [
      {
        id: 'cable',
        from: { node: 'manual-a', port: 'endpoint' },
        to: { node: 'manual-b', port: 'endpoint' },
      },
    ],
  }
  const unknown = await record(manual, cables)
  expect(unknown?.graph.nodes).toHaveLength(2)
  expect(unknown?.graph.links).toHaveLength(1)
  expect(Object.keys(unknown?.mapping?.nodes ?? {})).toHaveLength(2)
  expect(unknown?.mapping?.links ?? {}).toEqual({})

  const matched = await record(manual, {
    ...cables,
    nodes: cables.nodes.map((node) => ({
      ...node,
      ports: [{ id: 'endpoint', identity: { ifName: 'eth0' }, connectors: [] }],
    })),
  })
  expect(matched?.graph.nodes).toHaveLength(2)
  expect(matched?.graph.nodes.every((n) => n.ports?.length === 1)).toBe(true)
  expect(Object.values(matched?.mapping?.links ?? {})[0]?.interface).toBe('eth0')
  const resynced = await record(source, bound)
  expect(resynced?.graph.links).toHaveLength(1)
  expect(Object.values(resynced?.mapping?.links ?? {})[0]?.interface).toBe('eth0')
})

test('source bindings survive registry resolution, new hosts, manual opt-out and reload', async () => {
  const svc = new TopologyService()
  const t = await svc.create({ name: 'source-bindings' })
  const source = insertDataSource('test', 'source')
  attachSource(t.id, source, 'topology')
  attachSource(t.id, source, 'metrics')
  const obs = new ObservationsService()
  const graph: NetworkGraph = {
    version: '1',
    nodes: [
      {
        id: 'g',
        label: 'router',
        shape: 'rect',
        identity: { vendorIds: { test: 'g' } },
        ports: [
          { id: 'eth0', interfaceName: 'eth0', identity: { ifName: 'eth0' }, connectors: [] },
        ],
      },
    ],
    links: [],
  }
  const sync = async (g: NetworkGraph) => {
    await obs.record({
      topologyId: t.id,
      sourceId: source,
      capturedAt: Date.now(),
      status: 'ok',
      graph: bindSourceHosts(
        g,
        g.nodes.map((n) => ({ id: n.id, name: n.label ?? n.id, status: 'unknown' })),
        source,
      ),
    })
    svc.clearCacheEntry(t.id)
    return svc.getParsed(t.id)
  }
  const first = await sync(graph)
  const id = first?.graph.nodes[0]?.id ?? ''
  expect(first?.mapping?.nodes[id]?.hostId).toBe('g')
  expect(first?.graph.nodes[0]?.ports).toHaveLength(1)
  await svc.updateMapping(t.id, { nodes: {}, links: {} }, { sourceId: source })
  expect((await svc.getParsed(t.id))?.mapping).toBeUndefined()
  const second = await sync({
    ...graph,
    nodes: [
      ...graph.nodes,
      { id: 'g2', label: 'second', shape: 'rect', identity: { vendorIds: { test: 'g2' } } },
    ],
  })
  expect(second?.mapping?.nodes[id]).toBeUndefined()
  expect(Object.values(second?.mapping?.nodes ?? {}).map((n) => n.hostId)).toEqual(['g2'])
  const absent: NetworkGraph = {
    ...graph,
    nodes: [{ id: 'g2', label: 'second', shape: 'rect', identity: { vendorIds: { test: 'g2' } } }],
  }
  const whileAbsent = await sync(absent)
  await svc.updateMapping(
    t.id,
    { nodes: whileAbsent?.mapping?.nodes ?? {}, links: {} },
    { sourceId: source },
  )
  const returned = await sync({ ...graph, nodes: [...graph.nodes, ...absent.nodes] })
  expect(returned?.mapping?.nodes[id]).toBeUndefined()
  await svc.updateMapping(
    t.id,
    { nodes: { ...second?.mapping?.nodes, [id]: { hostId: 'override' } }, links: {} },
    { sourceId: source },
  )
  expect((await sync(graph))?.mapping?.nodes[id]?.hostId).toBe('override')
})

test('port bindings resolve to cable metrics and a user-cleared link stays cleared', async () => {
  const svc = new TopologyService()
  const t = await svc.create({ name: 'source-port-bindings' })
  const source = insertDataSource('test', 'port-source')
  attachSource(t.id, source, 'topology')
  attachSource(t.id, source, 'metrics')
  const graph: NetworkGraph = {
    version: '1',
    nodes: ['a', 'b'].map((id) => ({
      id,
      label: id,
      shape: 'rect',
      identity: { vendorIds: { test: id } },
      ports: [{ id: 'eth0', interfaceName: 'eth0', identity: { ifName: 'eth0' }, connectors: [] }],
    })),
    links: [{ id: 'cable', from: { node: 'a', port: 'eth0' }, to: { node: 'b', port: 'eth0' } }],
  }
  const bound = bindSourceHosts(
    graph,
    graph.nodes.map((n) => ({ id: n.id, name: n.id, status: 'unknown' })),
    source,
  )
  const obs = new ObservationsService()
  await obs.record({
    topologyId: t.id,
    sourceId: source,
    capturedAt: Date.now(),
    status: 'ok',
    graph: bound,
  })
  svc.clearCacheEntry(t.id)
  const first = await svc.getParsed(t.id)
  const key = first?.graph.links[0]?.id ?? ''
  expect(first?.mapping?.links[key]?.interface).toBe('eth0')
  expect(Object.keys(first?.mapping?.nodes ?? {})).toContain(
    first?.mapping?.links[key]?.monitoredNodeId,
  )
  await svc.updateMapping(
    t.id,
    { nodes: first?.mapping?.nodes ?? {}, links: {} },
    { sourceId: source },
  )
  await obs.record({
    topologyId: t.id,
    sourceId: source,
    capturedAt: Date.now(),
    status: 'ok',
    graph: bound,
  })
  svc.clearCacheEntry(t.id)
  expect((await svc.getParsed(t.id))?.mapping?.links).toEqual({})
})
