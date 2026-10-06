import { describe, expect, it } from 'vitest'
import {
  deriveGraph,
  type ExperimentInput,
  loadFixtures,
  parsePresentation,
  parseTopology,
  prepareExperiment,
  saveAndReload,
} from './coordinate-prototype'

describe('P1a display sizes and multiple ports', () => {
  it('reproduces two sizes and opposite port orders for A/B without changing endpoints', async () => {
    const fixtures = await loadFixtures()
    const before = structuredClone(fixtures)
    const saved = await saveAndReload(fixtures)
    const inputs: ExperimentInput[] = [
      { candidate: 'A', topology: saved.multiport.a },
      { candidate: 'B', topology: saved.multiport.b },
    ]
    for (const input of inputs) {
      for (const [index, presentation] of saved.multiport.presentations.entries()) {
        const { resolved, svg } = await prepareExperiment(input, presentation)
        for (const placement of presentation.nodePlacements) {
          expect(resolved.nodes.get(placement.nodeId)?.position).toEqual(placement.position)
        }
        const request = presentation.nodeSizes?.[0]
        if (!request) throw new Error('Missing fixture size')
        const node = resolved.nodes.get(request.nodeId)
        if (!node?.position || !node.size) throw new Error('Missing resolved switch')
        expect(node.size).toEqual(request.size)
        expect(svg).toContain(
          `<rect x="${node.position.x - node.size.width / 2}" y="${node.position.y - node.size.height / 2}" width="${node.size.width}" height="${node.size.height}"`,
        )
        const ports = [...resolved.ports.values()]
          .filter((port) => port.nodeId === request.nodeId)
          .sort((a, b) => a.absolutePosition.x - b.absolutePosition.x)
        const order = index === 0 ? ['a', 'b', 'c'] : ['c', 'b', 'a']
        expect(ports.map((p) => p.id)).toEqual(order.map((key) => `node-switch:port-switch-${key}`))
        for (const port of ports) {
          expect(port.absolutePosition.y).toBe(node.position.y + node.size.height / 2)
          expect(port.absolutePosition.x).toBeGreaterThan(node.position.x - node.size.width / 2)
          expect(port.absolutePosition.x).toBeLessThan(node.position.x + node.size.width / 2)
        }
        for (const port of resolved.ports.values()) {
          const owner = resolved.nodes.get(port.nodeId)
          if (!owner?.position || !owner.size) throw new Error('Missing port owner geometry')
          expect(port.absolutePosition.y).toBe(
            owner.position.y +
              (port.side === 'top' ? -owner.size.height / 2 : owner.size.height / 2),
          )
        }
        for (const key of ['a', 'b', 'c']) {
          const edge = resolved.edges.get(`connection-${key}`)
          if (!edge) throw new Error('Missing connection')
          expect(edge.fromPortId).toBe(`node-switch:port-switch-${key}`)
          expect(edge.toPortId).toBe(`node-${key}:port-${key}`)
          expect(edge.points[0]).toEqual(edge.fromPort.absolutePosition)
          expect(edge.points.at(-1)).toEqual(edge.toPort.absolutePosition)
        }
        for (const item of resolved.nodes.values()) {
          if (!item.position || !item.size) throw new Error('Missing geometry')
          expect(item.position.x - item.size.width / 2).toBeGreaterThanOrEqual(resolved.bounds.x)
          expect(item.position.x + item.size.width / 2).toBeLessThanOrEqual(
            resolved.bounds.x + resolved.bounds.width,
          )
          expect(item.position.y + item.size.height / 2).toBeLessThanOrEqual(
            resolved.bounds.y + resolved.bounds.height,
          )
          expect(item.position.y - item.size.height / 2).toBeGreaterThanOrEqual(resolved.bounds.y)
        }
      }
    }
    expect(saved).toEqual(before)
    expect(fixtures).toEqual(before)
  })

  it('keeps A and B equivalent for these size and ordering cases', async () => {
    const { multiport } = await loadFixtures()
    for (const presentation of multiport.presentations) {
      const a = await prepareExperiment({ candidate: 'A', topology: multiport.a }, presentation)
      const b = await prepareExperiment({ candidate: 'B', topology: multiport.b }, presentation)
      expect(b.graph).toEqual(a.graph)
      expect(b.svg).toEqual(a.svg)
    }
  })

  it('passes explicit sizes to automatic placement and leaves omitted sizes unsaved', async () => {
    const { multiport } = await loadFixtures()
    const original = multiport.presentations[0]
    if (!original) throw new Error('Missing fixture')
    const presentation = { ...original, nodePlacements: [] }
    const before = structuredClone({ multiport, presentation })
    const { graph, resolved } = await prepareExperiment(
      { candidate: 'B', topology: multiport.b },
      presentation,
    )
    expect(resolved.nodes.get('node-switch')?.size).toEqual({ width: 420, height: 100 })
    expect(resolved.nodes.get('node-a')?.size).toBeDefined()
    expect(graph.nodes.find((node) => node.id === 'node-a')?.size).toBeUndefined()
    expect({ multiport, presentation }).toEqual(before)
  })

  it('uses final fixed peer positions to order ports when explicit order is absent', async () => {
    const { multiport } = await loadFixtures()
    const original = multiport.presentations[0]
    if (!original) throw new Error('Missing fixture')
    const presentation = {
      ...original,
      nodePlacements: original.nodePlacements.map((p) =>
        p.nodeId === 'node-a'
          ? { ...p, position: { x: 860, y: 460 } }
          : p.nodeId === 'node-c'
            ? { ...p, position: { x: 140, y: 460 } }
            : p,
      ),
      portPlacements: original.portPlacements.map(({ order: _order, ...p }) => p),
    }
    const { resolved } = await prepareExperiment(
      { candidate: 'B', topology: multiport.b },
      presentation,
    )
    const ports = [...resolved.ports.values()]
      .filter((p) => p.nodeId === 'node-switch')
      .sort((a, b) => a.absolutePosition.x - b.absolutePosition.x)
    expect(ports.map((p) => p.id)).toEqual([
      'node-switch:port-switch-c',
      'node-switch:port-switch-b',
      'node-switch:port-switch-a',
    ])
  })

  it('rejects non-positive sizes, structural size fields, missing size references and duplicates', async () => {
    const { multiport } = await loadFixtures()
    const presentation = multiport.presentations[0]
    if (!presentation) throw new Error('Missing fixture')
    for (const width of [0, -1, Number.POSITIVE_INFINITY, Number.NaN]) {
      expect(() =>
        parsePresentation({
          ...presentation,
          nodeSizes: [{ nodeId: 'node-switch', size: { width, height: 100 } }],
        }),
      ).toThrow()
    }
    for (const candidate of ['A', 'B'] as const) {
      const topology = candidate === 'A' ? multiport.a : multiport.b
      expect(() =>
        candidate === 'A'
          ? parseTopology('A', {
              ...topology,
              nodes: topology.nodes.map((n) => ({ ...n, size: { width: 420, height: 100 } })),
            })
          : parseTopology('B', {
              ...topology,
              nodes: topology.nodes.map((n) => ({ ...n, size: { width: 420, height: 100 } })),
            }),
      ).toThrow()
    }
    const input: ExperimentInput = { candidate: 'B', topology: multiport.b }
    expect(() =>
      deriveGraph(input, {
        ...presentation,
        nodeSizes: [{ nodeId: 'missing', size: { width: 420, height: 100 } }],
      }),
    ).toThrow('Missing presentation size node')
    expect(() =>
      deriveGraph(input, {
        ...presentation,
        nodeSizes: [...(presentation.nodeSizes ?? []), ...(presentation.nodeSizes ?? [])],
      }),
    ).toThrow('Duplicate node size')
  })

  it('diagnoses undersized or overlapping nodes and ambiguous port order', async () => {
    const { multiport } = await loadFixtures()
    const presentation = multiport.presentations[0]
    if (!presentation) throw new Error('Missing fixture')
    const input: ExperimentInput = { candidate: 'B', topology: multiport.b }
    await expect(
      prepareExperiment(input, {
        ...presentation,
        nodeSizes: [{ nodeId: 'node-switch', size: { width: 80, height: 60 } }],
      }),
    ).rejects.toThrow('Display size too small')
    await expect(
      prepareExperiment(input, {
        ...presentation,
        nodeSizes: [{ nodeId: 'node-switch', size: { width: 1100, height: 800 } }],
      }),
    ).rejects.toThrow('Display nodes overlap')
    await expect(
      prepareExperiment(input, {
        ...presentation,
        portPlacements: presentation.portPlacements.map((p) => ({ ...p, order: 1 })),
      }),
    ).rejects.toThrow('Duplicate port order')
  })

  it('diagnoses a presentation placement for a port that the current renderer omits', async () => {
    const { multiport } = await loadFixtures()
    const presentation = multiport.presentations[0]
    if (!presentation) throw new Error('Missing fixture')
    const topology = structuredClone(multiport.b)
    topology.ports.push({ id: 'port-unused', nodeId: 'node-switch', interfaceName: 'Ethernet4' })
    const before = structuredClone(topology)
    await expect(
      prepareExperiment(
        { candidate: 'B', topology },
        {
          ...presentation,
          portPlacements: [
            ...presentation.portPlacements,
            { portId: 'port-unused', side: 'bottom' },
          ],
        },
      ),
    ).rejects.toThrow('Presentation port is not rendered')
    expect(topology).toEqual(before)
  })
})
