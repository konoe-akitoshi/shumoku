import { describe, expect, it } from 'vitest'
import { DeviceType, type NetworkGraph } from '@shumoku/core'
import { LayoutPipeline } from '../pipeline.js'
import { ElkPlacement } from '../placement/elk.js'
import { StraightRouter } from '../routing/straight.js'
import { OrthogonalRouter } from '../routing/orthogonal.js'
import { SplineRouter } from '../routing/spline.js'

/** Minimal test graph */
const testGraph: NetworkGraph = {
  version: '1',
  name: 'test',
  nodes: [
    { id: 'sw1', label: 'Core Switch', shape: 'rounded', type: DeviceType.L3Switch },
    { id: 'sw2', label: 'Dist Switch 1', shape: 'rounded', type: DeviceType.L2Switch },
    { id: 'sw3', label: 'Dist Switch 2', shape: 'rounded', type: DeviceType.L2Switch },
    { id: 'srv1', label: 'Server 1', shape: 'rect', type: DeviceType.Server },
  ],
  links: [
    {
      id: 'l1',
      from: { node: 'sw1', port: 'eth0' },
      to: { node: 'sw2', port: 'eth0' },
      bandwidth: '10G',
    },
    {
      id: 'l2',
      from: { node: 'sw1', port: 'eth1' },
      to: { node: 'sw3', port: 'eth0' },
      bandwidth: '10G',
    },
    {
      id: 'l3',
      from: { node: 'sw2', port: 'eth1' },
      to: { node: 'srv1' },
      bandwidth: '1G',
    },
  ],
}

describe('LayoutPipeline', () => {
  it('produces layout with ELK placement + straight routing', async () => {
    const pipeline = new LayoutPipeline(new ElkPlacement(), new StraightRouter())
    const result = await pipeline.layout(testGraph)

    expect(result.nodes.size).toBe(testGraph.nodes.length)
    expect(result.links.size).toBeGreaterThan(0)

    for (const edge of result.links.values()) {
      expect(edge.points).toHaveLength(2)
    }

    expect(result.bounds.width).toBeGreaterThan(0)
    expect(result.bounds.height).toBeGreaterThan(0)
  })

  it('produces layout with ELK placement + orthogonal routing', async () => {
    const pipeline = new LayoutPipeline(new ElkPlacement(), new OrthogonalRouter())
    const result = await pipeline.layout(testGraph)

    expect(result.nodes.size).toBe(testGraph.nodes.length)
    expect(result.links.size).toBeGreaterThan(0)

    for (const edge of result.links.values()) {
      for (let i = 0; i < edge.points.length - 1; i++) {
        const dx = Math.abs(edge.points[i].x - edge.points[i + 1].x)
        const dy = Math.abs(edge.points[i].y - edge.points[i + 1].y)
        expect(dx < 1 || dy < 1).toBe(true)
      }
    }
  })

  it('produces layout with ELK placement + spline routing', async () => {
    const pipeline = new LayoutPipeline(new ElkPlacement(), new SplineRouter())
    const result = await pipeline.layout(testGraph)

    expect(result.nodes.size).toBe(testGraph.nodes.length)
    expect(result.links.size).toBeGreaterThan(0)
  })

  it('reroute produces new edges without re-placing', async () => {
    const pipeline = new LayoutPipeline(new ElkPlacement(), new StraightRouter())
    const result = await pipeline.layout(testGraph)

    const orthoPipeline = pipeline.withRouter(new OrthogonalRouter())
    const rerouted = orthoPipeline.reroute(testGraph, result.nodes)

    expect(rerouted.size).toBeGreaterThan(0)

    for (const edge of rerouted.values()) {
      for (let i = 0; i < edge.points.length - 1; i++) {
        const dx = Math.abs(edge.points[i].x - edge.points[i + 1].x)
        const dy = Math.abs(edge.points[i].y - edge.points[i + 1].y)
        expect(dx < 1 || dy < 1).toBe(true)
      }
    }
  })

  it('withStrategy creates new pipeline with different router', async () => {
    const pipeline = new LayoutPipeline(new ElkPlacement(), new StraightRouter())
    const result = await pipeline.layout(testGraph)

    const orthoPipeline = pipeline.withStrategy('orthogonal')
    const result2 = await orthoPipeline.layout(testGraph)

    expect(result.nodes.size).toBe(result2.nodes.size)
    expect(result.metadata?.routing?.strategy).toBe('straight')
    expect(result2.metadata?.routing?.strategy).toBe('orthogonal')
  })

  it('metadata includes both placement and routing info', async () => {
    const pipeline = new LayoutPipeline(new ElkPlacement(), new OrthogonalRouter())
    const result = await pipeline.layout(testGraph)

    expect(result.metadata?.placement?.algorithm).toBe('elk-layered')
    expect(result.metadata?.routing?.strategy).toBe('orthogonal')
    expect(typeof result.metadata?.placement?.duration).toBe('number')
    expect(typeof result.metadata?.routing?.duration).toBe('number')
  })
})
