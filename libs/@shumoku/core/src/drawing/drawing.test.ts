import { describe, expect, it } from 'vitest'
import { readNetworkModel } from '../models/network-model-graph.js'
import { deriveStructure } from '../structure/index.js'
import { deriveElements } from './elements.js'
import { layoutDrawing, layoutLayers } from './index.js'
import type { Box, Metrics } from './metrics.js'
import { rankElements } from './ranks.js'

const metrics: Metrics = {
  card: () => ({ width: 10, height: 6 }),
  bus: (_id, lines) => ({ width: Math.max(8, lines * 2), height: 2 }),
  cloud: () => ({ width: 8, height: 4 }),
  group: () => ({ top: 3, right: 1, bottom: 1, left: 1 }),
  gap: 2,
  memberGap: 1,
  groupGap: 3,
  hullPad: 1,
  pitch: 0.5,
  leadOut: 1,
  aspect: 16 / 9,
}

/** `a-b` pairs become nodes and links; the rest of the YAML is written by the caller. */
function network(links: string, rest = '', place: Record<string, string> = {}) {
  const ids = new Set(
    links
      .split(/\s+/)
      .flatMap((p) => p.split('-'))
      .filter(Boolean),
  )
  const nodes = [...ids].map((id) => `  - { id: ${id}${place[id] ? `, group: ${place[id]}` : ''} }`)
  const ls = links
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => {
      const [a, b] = p.split('-')
      return `  - endpoints: [{ node: ${a} }, { node: ${b} }]`
    })
  return readNetworkModel(`${rest}\nnodes:\n${nodes.join('\n')}\nlinks:\n${ls.join('\n')}\n`).config
}

const run = (net: ReturnType<typeof network>, boundary: string[]) => {
  const structure = deriveStructure(net, { boundary })
  return { structure, layers: layoutLayers(net, structure, metrics) }
}

describe('1. elements', () => {
  const net = network(
    'a-b b-c b-d',
    `redundancy:\n  - { id: pair, kind: ha, nodes: [c, d] }
segments:\n  - { id: lan }
routingDomains:\n  - { id: vrf }`,
  )
  const withLinks = readNetworkModel(`
redundancy:
  - { id: pair, kind: ha, nodes: [c, d] }
segments:
  - { id: lan }
routingDomains:
  - { id: vrf }
nodes:
  - { id: a }
  - { id: c }
  - { id: d }
links:
  - endpoints: [{ node: a }, { node: c }]
  - endpoints: [{ node: c }, { node: d }]
    id: peer
  - endpoints: [{ node: a }, { segment: lan }]
  - endpoints: [{ node: d }, { routingDomain: vrf }]
    virtual: true
`).config
  const structure = deriveStructure(withLinks, { boundary: ['lan'] })
  const e = deriveElements(withLinks, structure, metrics)

  it('draws a redundancy set as one element holding its members side by side', () => {
    const set = e.elements.find((x) => x.id === 'unit:pair')
    expect(set?.members).toEqual(['c', 'd'])
    expect(set?.hull).toEqual({ kind: 'ha' })
    // two cards, the gap between them, the outline's room on both sides
    expect(set?.size).toEqual({ width: 10 + 1 + 10 + 2, height: 6 + 2 })
    expect(set?.parts.map((p) => p.x)).toEqual([1, 12])
  })

  it('draws a bus for a segment and a cloud for a routing domain, sized by the metrics', () => {
    expect(e.elements.find((x) => x.id === 'segment:lan')?.size).toEqual({ width: 8, height: 2 })
    expect(e.elements.find((x) => x.id === 'routingDomain:vrf')?.size).toEqual({
      width: 8,
      height: 4,
    })
  })

  it('maps each link to the elements at its ends and keeps a line inside a unit apart', () => {
    expect(e.lines.map((l) => l.ends.map((x) => x.element))).toEqual([
      ['unit:a', 'unit:pair'],
      ['unit:a', 'segment:lan'],
      ['unit:pair', 'routingDomain:vrf'],
    ])
    expect(e.inner.map((l) => l.linkId)).toEqual(['peer'])
    expect(e.lines.map((l) => l.virtual)).toEqual([false, false, true])
    expect(net.nodes).toHaveLength(4)
  })
})

describe('1b. hosted nodes', () => {
  const hosted = readNetworkModel(`
redundancy:
  - { id: pair, kind: ha, nodes: [h1, h2] }
nodes:
  - { id: sw }
  - { id: h1 }
  - { id: h2 }
  - { id: vm, host: pair }
  - { id: ct, host: vm }
  - { id: lone }
  - { id: lonevm, host: lone }
links:
  - endpoints: [{ node: sw }, { node: h1 }]
  - endpoints: [{ node: sw }, { node: h2 }]
  - endpoints: [{ node: sw }, { node: lone }]
  - endpoints: [{ node: vm }, { node: h1 }]
    id: vnic
`).config
  const structure = deriveStructure(hosted, { boundary: ['sw'] })
  const e = deriveElements(hosted, structure, metrics)
  const rank = rankElements(e, structure)

  it('keeps only the host nodes in the host unit and draws each hosted node as its own card', () => {
    expect(e.elements.find((x) => x.id === 'unit:pair')?.members).toEqual(['h1', 'h2'])
    expect(e.elements.find((x) => x.id === 'unit:lone')?.members).toEqual(['lone'])
    for (const id of ['vm', 'ct', 'lonevm']) {
      const el = e.elements.find((x) => x.id === `unit:${id}`)
      expect(el?.members).toEqual([id])
      expect(el?.size).toEqual({ width: 10, height: 6 })
    }
  })

  it('puts a hosted element one rank beyond its host, down a chain of hosts', () => {
    expect(rank.get('unit:pair')).toBe(1)
    expect(rank.get('unit:vm')).toBe(2)
    expect(rank.get('unit:ct')).toBe(3)
    expect(rank.get('unit:lonevm')).toBe(2)
  })

  it('joins a hosted element to its host by a layout line that is not a wire', () => {
    const layout = e.lines.filter((l) => l.layoutOnly)
    expect(layout.map((l) => l.ends.map((x) => x.element))).toEqual([
      ['unit:pair', 'unit:vm'],
      ['unit:vm', 'unit:ct'],
      ['unit:lone', 'unit:lonevm'],
    ])
    const scene = layoutDrawing(hosted, structure, metrics)
    // the three links written, nothing for hosting
    expect(scene.wires).toHaveLength(4)
    expect(scene.wires.some((w) => w.link.id === 'vnic')).toBe(true)
  })

  it('keeps a hosted card under its host in the order', () => {
    const scene = layoutDrawing(hosted, structure, metrics)
    const box = (id: string) => scene.nodes.find((n) => n.node.id === id)?.box
    const lone = box('lone')
    const vm = box('lonevm')
    if (!lone || !vm) throw new Error('missing')
    expect(vm.y).toBeGreaterThan(lone.y + lone.height)
    expect(Math.abs(vm.x + vm.width / 2 - (lone.x + lone.width / 2))).toBeLessThan(10)
  })
})

describe('2. ranks', () => {
  it('ranks by lines from the boundary and puts an unreached leaf next to its neighbour', () => {
    const net = network('x-a a-b b-c')
    const structure = deriveStructure(net, { boundary: ['x'] })
    const rank = rankElements(deriveElements(net, structure, metrics), structure)
    expect([...rank]).toEqual([
      ['unit:x', 0],
      ['unit:a', 1],
      ['unit:b', 2],
      ['unit:c', 3],
    ])
  })

  it('puts the virtual side on the other side of the boundary', () => {
    const net = readNetworkModel(`
segments:
  - { id: ix }
nodes:
  - { id: r }
  - { id: s }
links:
  - endpoints: [{ node: r }, { node: s }]
  - endpoints: [{ node: r }, { segment: ix }]
    virtual: true
`).config
    const structure = deriveStructure(net, { boundary: ['r'] })
    const rank = rankElements(deriveElements(net, structure, metrics), structure)
    expect(rank.get('unit:r')).toBe(0)
    expect(rank.get('unit:s')).toBe(1)
    expect(rank.get('segment:ix')).toBe(-1)
  })

  it('puts a separate part after everything on the physical side', () => {
    const net = network('x-a a-b p-q')
    const structure = deriveStructure(net, { boundary: ['x'] })
    const rank = rankElements(deriveElements(net, structure, metrics), structure)
    expect(rank.get('unit:b')).toBe(2)
    expect(rank.get('unit:p')).toBe(3)
    expect(rank.get('unit:q')).toBe(4)
  })

  it('ranks without a boundary from the best connected element', () => {
    const net = network('a-b a-c')
    const structure = deriveStructure(net)
    const rank = rankElements(deriveElements(net, structure, metrics), structure)
    expect(rank.get('unit:a')).toBe(0)
    expect(rank.get('unit:b')).toBe(1)
  })
})

describe('3. order', () => {
  it('puts a dummy in each rank a long line passes', () => {
    const net = readNetworkModel(`
segments:
  - { id: ix }
nodes:
  - { id: r }
  - { id: a }
  - { id: b }
links:
  - endpoints: [{ node: r }, { node: a }]
  - endpoints: [{ node: a }, { node: b }]
  - endpoints: [{ node: r }, { segment: ix }]
    virtual: true
  - endpoints: [{ node: b }, { segment: ix }]
    virtual: true
`).config
    const { layers } = run(net, ['r'])
    // b is at rank 2 and ix at rank -1: the line between them passes ranks 0 and 1
    const long = layers.elements.lines.findIndex(
      (l) =>
        l.ends.some((e) => e.element === 'unit:b') &&
        l.ends.some((e) => e.element === 'segment:ix'),
    )
    const path = layers.ordered.paths[long] ?? []
    expect(path).toHaveLength(4)
    expect(path.slice(1, -1).every((id) => id.startsWith('~line.'))).toBe(true)
  })

  it('draws a tree with no crossings', () => {
    const net = network('r-a r-b a-c a-d b-e b-f')
    expect(run(net, ['r']).layers.ordered.crossings).toBe(0)
  })

  it('untangles a layer that was written crossed', () => {
    const net = network('r-a r-b a-d b-c')
    const { layers } = run(net, ['r'])
    expect(layers.ordered.crossings).toBe(0)
  })

  it('keeps a group contiguous and stands sibling groups in the same order in every rank', () => {
    const net = network(
      'r-a r-b a-c a-d b-e b-f c-g e-h',
      'groups:\n  - { id: ga }\n  - { id: gb }',
      { a: 'ga', c: 'ga', d: 'ga', g: 'ga', b: 'gb', e: 'gb', f: 'gb', h: 'gb' },
    )
    const { layers } = run(net, ['r'])
    const runs = layers.ordered.layers.map((layer) => {
      const seq = layer.map((slot) => slot.group ?? '-')
      return seq.filter((g, i) => g !== seq[i - 1])
    })
    for (const r of runs) expect(new Set(r).size).toBe(r.length)
    // ga stands left of gb, or right of it, the same in every rank that has both
    const sides = new Set(
      layers.ordered.layers.flatMap((layer) => {
        const ia = layer.findIndex((s) => s.group === 'ga')
        const ib = layer.findIndex((s) => s.group === 'gb')
        return ia >= 0 && ib >= 0 ? [ia < ib] : []
      }),
    )
    expect(sides.size).toBeLessThanOrEqual(1)
  })
})

const overlaps = (a: Box, b: Box) =>
  a.x < b.x + b.width - 1e-6 &&
  b.x < a.x + a.width - 1e-6 &&
  a.y < b.y + b.height - 1e-6 &&
  b.y < a.y + a.height - 1e-6
const inside = (inner: Box, outer: Box) =>
  inner.x >= outer.x - 1e-6 &&
  inner.y >= outer.y - 1e-6 &&
  inner.x + inner.width <= outer.x + outer.width + 1e-6 &&
  inner.y + inner.height <= outer.y + outer.height + 1e-6

describe('4. coordinates and 8. scene', () => {
  const net = network(
    'r-a r-b a-c a-d b-e b-f c-g r-g',
    'groups:\n  - id: site\n    groups:\n      - { id: ga }\n      - { id: gb }',
    { a: 'ga', c: 'ga', d: 'ga', g: 'ga', b: 'gb', e: 'gb', f: 'gb' },
  )
  const structure = deriveStructure(net, { boundary: ['r'] })
  const scene = layoutDrawing(net, structure, metrics)
  const boxOf = (id: string) => scene.nodes.find((n) => n.node.id === id)?.box

  it('keeps cards apart', () => {
    for (const [i, a] of scene.nodes.entries()) {
      for (const b of scene.nodes.slice(i + 1)) expect(overlaps(a.box, b.box)).toBe(false)
    }
  })

  it('keeps ranks apart by the least the metrics ask', () => {
    const ra = boxOf('r')
    const aa = boxOf('a')
    if (!ra || !aa) throw new Error('missing')
    expect(aa.y - (ra.y + ra.height)).toBeGreaterThanOrEqual(2 * metrics.leadOut + metrics.pitch)
  })

  it('draws every group around its members, the label band above, outer groups first', () => {
    const ids = scene.groups.map((g) => g.group.id)
    expect(ids.indexOf('site')).toBeLessThan(ids.indexOf('ga'))
    const frame = (id: string) => scene.groups.find((g) => g.group.id === id)?.box
    const ga = frame('ga')
    const site = frame('site')
    if (!ga || !site) throw new Error('missing frame')
    for (const id of ['a', 'c', 'd', 'g']) {
      const box = boxOf(id)
      if (!box) throw new Error('missing node')
      expect(inside(box, ga)).toBe(true)
      expect(box.y - ga.y).toBeGreaterThanOrEqual(3 - 1e-6)
    }
    expect(inside(ga, site)).toBe(true)
  })

  it('keeps sibling groups a group gap apart in every layer they share', () => {
    const { placed } = layoutLayers(net, structure, metrics)
    const ga = placed.frames.get('ga')
    const gb = placed.frames.get('gb')
    if (!ga || !gb) throw new Error('missing frame')
    let shared = 0
    for (const [k, a] of ga.intervals.entries()) {
      const b = gb.intervals[ga.first + k - gb.first]
      if (!b) continue
      shared++
      const [near, far] = a.left < b.left ? [a, b] : [b, a]
      expect(far.left - near.right).toBeGreaterThanOrEqual(metrics.groupGap - 1e-6)
    }
    expect(shared).toBeGreaterThan(0)
  })

  it('keeps other cards out of a frame', () => {
    const ga = scene.groups.find((g) => g.group.id === 'ga')?.box
    const gb = scene.groups.find((g) => g.group.id === 'gb')?.box
    if (!ga || !gb) throw new Error('missing frame')
    const r = boxOf('r')
    if (!r) throw new Error('missing node')
    expect(overlaps(r, ga)).toBe(false)
    expect(overlaps(r, gb)).toBe(false)
  })

  it('ends every wire on its cards and runs it through its dummy points', () => {
    expect(scene.wires).toHaveLength(8)
    for (const wire of scene.wires) {
      const from = boxOf(wire.link.from.node)
      const to = boxOf(wire.link.to.node)
      if (!from || !to) throw new Error('missing node')
      const touches = (b: Box, p: { x: number; y: number }) =>
        p.x >= b.x - 1e-6 &&
        p.x <= b.x + b.width + 1e-6 &&
        p.y >= b.y - 1e-6 &&
        p.y <= b.y + b.height + 1e-6
      expect(touches(from, wire.points[0] ?? { x: NaN, y: NaN })).toBe(true)
      expect(touches(to, wire.points[wire.points.length - 1] ?? { x: NaN, y: NaN })).toBe(true)
    }
  })

  it('runs a wire through the dummy points of the ranks it passes', () => {
    const net = readNetworkModel(`
segments:
  - { id: ix }
nodes:
  - { id: r }
  - { id: a }
  - { id: b }
links:
  - endpoints: [{ node: r }, { node: a }]
  - endpoints: [{ node: a }, { node: b }]
  - endpoints: [{ node: r }, { segment: ix }]
    virtual: true
  - endpoints: [{ node: b }, { segment: ix }]
    virtual: true
`).config
    const s = layoutDrawing(net, deriveStructure(net, { boundary: ['r'] }), metrics)
    const long = s.wires.find((w) => w.link.from.node === 'b' || w.link.to.node === 'b')
    expect(s.wires.some((w) => w.points.length === 4)).toBe(true)
    expect(long).toBeDefined()
  })

  it('lists a redundancy set as a hull of its members', () => {
    const ha = readNetworkModel(`
redundancy:
  - { id: p, kind: ha, nodes: [a, b] }
nodes:
  - { id: x }
  - { id: a }
  - { id: b }
links:
  - endpoints: [{ node: x }, { node: a }]
  - endpoints: [{ node: x }, { node: b }]
  - endpoints: [{ node: a }, { node: b }]
`).config
    const s = layoutDrawing(ha, deriveStructure(ha, { boundary: ['x'] }), metrics)
    expect(s.hulls).toEqual([{ members: ['a', 'b'], kind: 'ha' }])
    expect(s.wires).toHaveLength(3)
  })

  it('has bounds around everything', () => {
    for (const n of scene.nodes) expect(inside(n.box, scene.bounds)).toBe(true)
  })
})
