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

describe('P1a style, equal-level rank and direction', () => {
  it('renders saved colors and line styles with identical A/B structure and unchanged facts', async () => {
    const fixtures = await loadFixtures()
    const before = structuredClone(fixtures)
    const saved = await saveAndReload(fixtures)
    for (const presentation of saved.styled.presentations) {
      const a = await prepareExperiment({ candidate: 'A', topology: saved.styled.a }, presentation)
      const b = await prepareExperiment({ candidate: 'B', topology: saved.styled.b }, presentation)
      expect(a.graph).toEqual(b.graph)
      expect(a.svg).toEqual(b.svg)
      for (const entry of presentation.nodeStyles ?? []) {
        expect(b.resolved.nodes.get(entry.nodeId)?.style).toEqual(entry.style)
        if (entry.style.fill) expect(b.svg).toContain(`fill="${entry.style.fill}"`)
        if (entry.style.stroke) expect(b.svg).toContain(`stroke="${entry.style.stroke}"`)
      }
      for (const entry of presentation.connectionStyles ?? []) {
        const edge = b.resolved.edges.get(entry.connectionId)
        expect(edge?.link.style).toEqual(entry.style)
        if (entry.style.strokeWidth) expect(edge?.width).toBe(entry.style.strokeWidth)
        if (entry.style.strokeDasharray) {
          expect(b.svg).toContain(`stroke-dasharray="${entry.style.strokeDasharray}"`)
        }
      }
      expect(
        [...b.resolved.edges.values()].map((edge) => [edge.id, edge.fromPortId, edge.toPortId]),
      ).toEqual([
        ['connection-a', 'node-gateway:port-gw-a', 'node-a:port-a'],
        ['connection-b', 'node-gateway:port-gw-b', 'node-b:port-b-in'],
        ['connection-c', 'node-b:port-b-out', 'node-c:port-c'],
      ])
    }
    expect(saved).toEqual(before)
    expect(fixtures).toEqual(before)
  })

  it('aligns previously different levels and recalculates attached ports in four directions', async () => {
    const { styled } = await loadFixtures()
    const original = styled.presentations[1]
    if (!original) throw new Error('Missing fixture')
    const inputs: ExperimentInput[] = [
      { candidate: 'A', topology: styled.a },
      { candidate: 'B', topology: styled.b },
    ]
    for (const input of inputs) {
      for (const direction of ['TB', 'BT', 'LR', 'RL'] as const) {
        const presentation = { ...original, direction }
        const before = structuredClone(presentation)
        const baseline = await prepareExperiment(input, { ...presentation, nodeRanks: [] })
        const ranked = await prepareExperiment(input, presentation)
        const axis = direction === 'LR' || direction === 'RL' ? 'x' : 'y'
        expect(baseline.resolved.nodes.get('node-a')?.position?.[axis]).not.toBe(
          baseline.resolved.nodes.get('node-c')?.position?.[axis],
        )
        expect(ranked.resolved.nodes.get('node-a')?.position?.[axis]).toBe(
          ranked.resolved.nodes.get('node-c')?.position?.[axis],
        )
        for (const edge of ranked.resolved.edges.values()) {
          expect(edge.points[0]).toEqual(edge.fromPort.absolutePosition)
          expect(edge.points.at(-1)).toEqual(edge.toPort.absolutePosition)
        }
        for (const port of ranked.resolved.ports.values()) {
          const node = ranked.resolved.nodes.get(port.nodeId)
          if (!node?.position || !node.size) throw new Error('Missing geometry')
          const point = port.absolutePosition
          if (port.side === 'top' || port.side === 'bottom') {
            expect(point.y).toBe(
              node.position.y + ((port.side === 'top' ? -1 : 1) * node.size.height) / 2,
            )
          } else {
            expect(point.x).toBe(
              node.position.x + ((port.side === 'left' ? -1 : 1) * node.size.width) / 2,
            )
          }
          expect(point.x).toBeGreaterThanOrEqual(ranked.resolved.bounds.x)
          expect(point.x).toBeLessThanOrEqual(
            ranked.resolved.bounds.x + ranked.resolved.bounds.width,
          )
          expect(point.y).toBeGreaterThanOrEqual(ranked.resolved.bounds.y)
          expect(point.y).toBeLessThanOrEqual(
            ranked.resolved.bounds.y + ranked.resolved.bounds.height,
          )
        }
        const from = ranked.resolved.edges.get('connection-b')?.fromPort
        const expectedSide = { TB: 'bottom', BT: 'top', LR: 'right', RL: 'left' }[direction]
        expect(from?.side).toBe(expectedSide)
        expect(presentation).toEqual(before)
      }
    }
  })

  it('changes only presentation when styles change at fixed layout direction', async () => {
    const { styled } = await loadFixtures()
    const base = styled.presentations[0]
    const alternate = styled.presentations[1]
    if (!base || !alternate) throw new Error('Missing fixture')
    const input: ExperimentInput = { candidate: 'B', topology: styled.b }
    const a = await prepareExperiment(input, base)
    const b = await prepareExperiment(input, {
      ...base,
      nodeStyles: alternate.nodeStyles,
      connectionStyles: alternate.connectionStyles,
    })
    expect([...a.resolved.nodes].map(([id, node]) => [id, node.position, node.size])).toEqual(
      [...b.resolved.nodes].map(([id, node]) => [id, node.position, node.size]),
    )
    expect(a.svg).not.toBe(b.svg)
    const graph = deriveGraph(input, base)
    const style = graph.nodes.find((node) => node.id === 'node-gateway')?.style
    if (!style) throw new Error('Missing style')
    style.fill = '#ffffff'
    expect(base.nodeStyles?.[0]?.style.fill).toBe('#dbeafe')
  })

  it('rejects display fields in topology and unsupported style/direction values', async () => {
    const { styled } = await loadFixtures()
    const presentation = styled.presentations[0]
    if (!presentation) throw new Error('Missing fixture')
    expect(() => parseTopology('A', { ...styled.a, settings: { direction: 'LR' } })).toThrow()
    expect(() =>
      parseTopology('B', {
        ...styled.b,
        nodes: styled.b.nodes.map((n) => ({ ...n, rank: 'servers' })),
      }),
    ).toThrow()
    expect(() => parsePresentation({ ...presentation, direction: 'diagonal' })).toThrow()
    expect(() => parsePresentation({ ...presentation, layerGap: 0 })).toThrow()
    expect(() =>
      parsePresentation({
        ...presentation,
        nodeStyles: [{ nodeId: 'node-a', style: { opacity: 0.5 } }],
      }),
    ).toThrow()
    expect(() =>
      parsePresentation({
        ...presentation,
        connectionStyles: [{ connectionId: 'connection-a', style: { strokeWidth: 0 } }],
      }),
    ).toThrow()
    expect(() =>
      parsePresentation({
        ...presentation,
        nodeStyles: [{ nodeId: 'node-a', style: { fill: 'url(#gradient)' } }],
      }),
    ).toThrow()
  })

  it('diagnoses missing and duplicate style/rank references', async () => {
    const { styled } = await loadFixtures()
    const presentation = styled.presentations[1]
    if (!presentation) throw new Error('Missing fixture')
    const input: ExperimentInput = { candidate: 'B', topology: styled.b }
    expect(() =>
      deriveGraph(input, { ...presentation, nodeRanks: [{ nodeId: 'missing', rank: 1 }] }),
    ).toThrow('Missing rank node')
    expect(() =>
      deriveGraph(input, { ...presentation, nodeStyles: [{ nodeId: 'missing', style: {} }] }),
    ).toThrow('Missing style node')
    expect(() =>
      deriveGraph(input, {
        ...presentation,
        connectionStyles: [{ connectionId: 'missing', style: {} }],
      }),
    ).toThrow('Missing style connection')
    expect(() =>
      deriveGraph(input, {
        ...presentation,
        nodeRanks: [...(presentation.nodeRanks ?? []), ...(presentation.nodeRanks ?? [])],
      }),
    ).toThrow('Duplicate node presentation')
    expect(() =>
      deriveGraph(input, {
        ...presentation,
        connectionStyles: [
          ...(presentation.connectionStyles ?? []),
          ...(presentation.connectionStyles ?? []),
        ],
      }),
    ).toThrow('Duplicate connection style')
  })

  it('honors one fixed rank anchor and diagnoses conflicting fixed positions or collisions', async () => {
    const { styled } = await loadFixtures()
    const presentation = styled.presentations[1]
    if (!presentation) throw new Error('Missing fixture')
    const input: ExperimentInput = { candidate: 'B', topology: styled.b }
    const base = await prepareExperiment(input, { ...presentation, nodeRanks: [] })
    const anchor = base.resolved.nodes.get('node-c')?.position
    const other = base.resolved.nodes.get('node-a')?.position
    if (!anchor || !other) throw new Error('Missing geometry')
    const fixed = await prepareExperiment(input, {
      ...presentation,
      nodePlacements: [{ nodeId: 'node-c', position: anchor }],
    })
    expect(fixed.resolved.nodes.get('node-a')?.position?.x).toBe(anchor.x)
    await expect(
      prepareExperiment(input, {
        ...presentation,
        nodePlacements: [
          { nodeId: 'node-c', position: anchor },
          { nodeId: 'node-a', position: other },
        ],
      }),
    ).rejects.toThrow('Rank conflicts with fixed positions')
    await expect(
      prepareExperiment(input, {
        ...presentation,
        nodeRanks: [
          { nodeId: 'node-b', rank: 'same' },
          { nodeId: 'node-c', rank: 'same' },
        ],
      }),
    ).rejects.toThrow('Display nodes overlap')
  })
})
