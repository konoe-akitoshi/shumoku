import type { DrawingScene, Link, MetricsData, NetworkGraph, Node, Subgraph } from '@shumoku/core'
import { describe, expect, it } from 'vitest'
import { createShareApplicationService } from '../../app/share.js'
import type { DashboardService } from '../../services/dashboard.js'
import type { DataSourceService } from '../../services/datasource.js'
import type { ParsedTopology, TopologyService } from '../../services/topology.js'
import type { Topology } from '../../types.js'
import {
  publicGraph,
  publicScene,
  publicTopologyContext,
  publicTopologyGraph,
} from './projections.js'

// Fictional data-source id; it must not appear anywhere in a share response.
const SECRET = 'ds-secret-source-0042'
const provenance = { source: SECRET, state: 'confirmed' as const, observedAt: 1 }
const fieldSources = { label: SECRET, 'spec.model': SECRET }

const node = (id: string): Node => ({
  id,
  label: id,
  provenance,
  fieldSources,
  identity: { sysName: `${SECRET}-sys` },
  ports: [{ id: `${id}-p1`, label: 'p1', provenance, identity: { ifName: 'p1' } }],
})
const link: Link = {
  id: 'l1',
  from: { node: 'a', port: 'a-p1' },
  to: { node: 'b', port: 'b-p1' },
  provenance,
}
const subgraph: Subgraph = { id: 'sg1', label: 'Zone', provenance }

const graph: NetworkGraph = {
  name: 'Example',
  nodes: [node('a'), node('b')],
  links: [link],
  subgraphs: [subgraph],
}
const box = { x: 0, y: 0, width: 10, height: 10 }
const scene: DrawingScene = {
  nodes: graph.nodes.map((n) => ({ node: n, box })),
  groups: [{ group: subgraph, box }],
  wires: [{ link, points: [], radii: [], stroke: 1, label: { x: 0, y: 0 } }],
  inner: [{ link, host: 'a' }],
  bounds: box,
}
const metrics: MetricsData = { nodes: {}, links: {}, timestamp: 1 }
const parsed: ParsedTopology = { id: 't1', name: 'Example', graph, scene, metrics }
const topology = { id: 't1', name: 'Example' } as Topology

describe('share projections', () => {
  it('drop provenance and fieldSources from the graph and scene', () => {
    const outputs = [
      publicGraph(graph),
      publicScene(scene),
      publicTopologyGraph(parsed),
      publicTopologyContext(parsed),
    ]
    for (const output of outputs) expect(JSON.stringify(output)).not.toContain(SECRET)
  })

  it('do not mutate their input', () => {
    publicGraph(graph)
    publicScene(scene)
    expect(graph.nodes[0]?.provenance).toBe(provenance)
    expect(scene.inner?.[0]?.link.provenance).toBe(provenance)
  })

  it('keep what the shared viewer draws', () => {
    const out = publicGraph(graph)
    expect(out.nodes.map((n) => n.id)).toEqual(['a', 'b'])
    expect(out.nodes[0]?.ports?.[0]?.id).toBe('a-p1')
    expect(out.links[0]?.from.node).toBe('a')
    expect(out.subgraphs?.[0]?.label).toBe('Zone')
  })
})

describe('share routes', () => {
  const service = createShareApplicationService({
    topologies: {
      getByShareToken: () => topology,
      get: () => topology,
      getParsed: async () => parsed,
    } as unknown as TopologyService,
    dashboards: {
      getByShareToken: () => ({
        id: 'd1',
        name: 'D',
        layoutJson: JSON.stringify({ widgets: [{ config: { topologyId: 't1' } }] }),
      }),
    } as unknown as DashboardService,
    dataSources: {} as unknown as DataSourceService,
  })

  it('never include a data-source id in any topology response', async () => {
    const results = [
      await service.topology('tok', 'context'),
      await service.topology('tok', 'graph'),
      await service.topology('tok', 'view'),
      await service.topology('tok', 'render'),
      await service.dashboardTopology('tok', 't1', 'graph'),
      await service.dashboardTopology('tok', 't1', 'context'),
      await service.dashboardTopology('tok', 't1', 'metadata'),
    ]
    for (const result of results) {
      expect(result.ok).toBe(true)
      expect(JSON.stringify(result)).not.toContain(SECRET)
    }
  })
})
