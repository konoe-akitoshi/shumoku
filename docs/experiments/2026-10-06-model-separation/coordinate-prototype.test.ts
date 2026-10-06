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

describe('P1a coordinate separation', () => {
  it('preserves structure, membership and physical facts across file reload and two layouts', async () => {
    const fixtures = await loadFixtures()
    const before = structuredClone(fixtures)
    const saved = await saveAndReload(fixtures)
    expect(saved).toEqual(before)
    const inputs: ExperimentInput[] = [
      { candidate: 'A', topology: saved.a },
      { candidate: 'B', topology: saved.b },
    ]
    for (const input of inputs) {
      for (const presentation of saved.presentations) {
        const { graph, resolved, svg } = await prepareExperiment(input, presentation)
        for (const placement of presentation.nodePlacements) {
          expect(resolved.nodes.get(placement.nodeId)?.position).toEqual(placement.position)
        }
        for (const placement of presentation.portPlacements) {
          const port = [...resolved.ports.values()].find((p) =>
            p.id.endsWith(`:${placement.portId}`),
          )
          expect(port?.side).toBe(placement.side)
        }
        const edge = resolved.edges.get('connection-uplink')
        expect(edge?.points).toEqual([
          edge?.fromPort.absolutePosition,
          edge?.toPort.absolutePosition,
        ])
        expect(graph.links.map((link) => link.id)).toEqual(['connection-uplink'])
        expect(svg).toContain('edge-router')
        expect(svg).toContain('access-switch')
      }
    }
    expect(saved).toEqual(before)
    expect(fixtures).toEqual(before)
    expect(saved.b.groups).toHaveLength(2)
    expect(saved.physicalProfile).toMatchObject({
      payload: { routes: [{ length_m: 12.5, basis: 'measured' }] },
    })
  })

  it('produces the same node/port/connection rendering from A and B for both presentations', async () => {
    const { a, b, presentations } = await loadFixtures()
    for (const presentation of presentations) {
      const first = await prepareExperiment({ candidate: 'A', topology: a }, presentation)
      const second = await prepareExperiment({ candidate: 'B', topology: b }, presentation)
      expect(second.graph).toEqual(first.graph)
      expect(second.svg).toEqual(first.svg)
    }
  })

  it('uses automatic coordinates only in derived layout when no positions are saved', async () => {
    const { b, presentations } = await loadFixtures()
    const original = presentations[0]
    if (!original) throw new Error('Missing fixture')
    const presentation = { ...original, nodePlacements: [] }
    const before = structuredClone({ b, presentation })
    const { resolved } = await prepareExperiment({ candidate: 'B', topology: b }, presentation)
    expect([...resolved.nodes.values()].every((node) => node.position && node.size)).toBe(true)
    expect({ b, presentation }).toEqual(before)
  })

  it('isolates attributes in the derived graph from topology', async () => {
    const { a, b, presentations } = await loadFixtures()
    const presentation = presentations[0]
    if (!presentation) throw new Error('Missing fixture')
    for (const input of [
      { candidate: 'A', topology: a },
      { candidate: 'B', topology: b },
    ] satisfies ExperimentInput[]) {
      const before = structuredClone(input)
      const graph = deriveGraph(input, presentation)
      const node = graph.nodes[0]
      const link = graph.links[0]
      if (!node?.metadata || !link?.metadata) throw new Error('Missing attributes')
      node.metadata['device.role'] = 'changed by renderer'
      link.metadata['connection.technology'] = 'changed by renderer'
      expect(input).toEqual(before)
    }
  })

  it('rejects unsupported display fields and non-finite coordinates at the file boundary', async () => {
    const { a, b, presentations } = await loadFixtures()
    const presentation = presentations[0]
    if (!presentation) throw new Error('Missing fixture')
    expect(() => parseTopology('A', { ...a, style: {} })).toThrow()
    expect(() => parseTopology('B', { ...b, position: { x: 1, y: 2 } })).toThrow()
    expect(() =>
      parseTopology('A', {
        ...a,
        nodes: a.nodes.map((node) => ({ ...node, position: { x: 1, y: 2 } })),
      }),
    ).toThrow()
    expect(() =>
      parseTopology('B', {
        ...b,
        nodes: b.nodes.map((node) => ({ ...node, style: { fill: 'red' } })),
      }),
    ).toThrow()
    for (const coordinate of [Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() =>
        parsePresentation({
          ...presentation,
          nodePlacements: [{ nodeId: 'node-router', position: { x: coordinate, y: 0 } }],
        }),
      ).toThrow()
    }
  })

  it('diagnoses wrong topology, missing/duplicate placements and broken endpoint ownership', async () => {
    const { a, b, presentations } = await loadFixtures()
    const presentation = presentations[0]
    if (!presentation) throw new Error('Missing fixture')
    const input: ExperimentInput = { candidate: 'B', topology: b }
    expect(() => deriveGraph(input, { ...presentation, topologyId: 'other' })).toThrow('topologyId')
    expect(() =>
      deriveGraph(input, {
        ...presentation,
        nodePlacements: [{ nodeId: 'missing', position: { x: 0, y: 0 } }],
      }),
    ).toThrow('Missing presentation node')
    expect(() =>
      deriveGraph(input, {
        ...presentation,
        portPlacements: [{ portId: 'missing', side: 'left' }],
      }),
    ).toThrow('Missing presentation port')
    expect(() =>
      deriveGraph(input, {
        ...presentation,
        nodePlacements: [...presentation.nodePlacements, ...presentation.nodePlacements],
      }),
    ).toThrow('Duplicate node placement')
    const wrongOwner = structuredClone(a)
    const link = wrongOwner.links[0]
    if (!link) throw new Error('Missing fixture')
    link.from.node = 'node-switch'
    expect(() => deriveGraph({ candidate: 'A', topology: wrongOwner }, presentation)).toThrow(
      'wrong owner',
    )
    const brokenPort = structuredClone(b)
    brokenPort.ports = []
    expect(() => deriveGraph({ candidate: 'B', topology: brokenPort }, presentation)).toThrow(
      'Missing connection port',
    )
    expect(() =>
      deriveGraph(
        { candidate: 'B', topology: { ...b, ports: [...b.ports, ...b.ports] } },
        presentation,
      ),
    ).toThrow('Duplicate element ID')
  })
})
