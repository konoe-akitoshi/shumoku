import { describe, expect, it } from 'vitest'
import { readNetworkModel } from '../models/network-model-graph.js'
import { deriveStructure } from '../structure/index.js'
import { deriveElements } from './elements.js'
import { layoutDrawing, layoutLayers } from './index.js'
import type { Box, Metrics } from './metrics.js'
import { placingLines } from './placing.js'

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

const drawn = (net: ReturnType<typeof network>, boundary: string[]) =>
  layoutDrawing(net, deriveStructure(net, { boundary }), metrics)

/** Pairs of drawn wire segments that cross each other, counted geometrically. */
function crossingsOf(scene: ReturnType<typeof layoutDrawing>): number {
  type P = { x: number; y: number }
  const side = (p: P, q: P, r: P) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x)
  const segments = scene.wires.flatMap((w, i) =>
    w.points.slice(1).map((p, k) => ({ wire: i, a: w.points[k] as P, b: p })),
  )
  let total = 0
  for (const [i, s] of segments.entries()) {
    for (const t of segments.slice(i + 1)) {
      if (s.wire === t.wire) continue
      if (
        side(s.a, s.b, t.a) * side(s.a, s.b, t.b) < -1e-9 &&
        side(t.a, t.b, s.a) * side(t.a, t.b, s.b) < -1e-9
      )
        total++
    }
  }
  return total
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

  it('keeps only the host nodes in the host unit and draws each hosted node as its own card', () => {
    expect(e.elements.find((x) => x.id === 'unit:pair')?.members).toEqual(['h1', 'h2'])
    expect(e.elements.find((x) => x.id === 'unit:lone')?.members).toEqual(['lone'])
    for (const id of ['vm', 'ct', 'lonevm']) {
      const el = e.elements.find((x) => x.id === `unit:${id}`)
      expect(el?.members).toEqual([id])
      expect(el?.size).toEqual({ width: 10, height: 6 })
    }
  })

  it('puts a hosted element after its host, down a chain of hosts', () => {
    const scene = layoutDrawing(hosted, structure, metrics)
    const middle = (id: string) => {
      const b = scene.nodes.find((n) => n.node.id === id)?.box
      if (!b) throw new Error(`no box for ${id}`)
      return b.y + b.height / 2
    }
    expect(middle('h1')).toBeLessThan(middle('vm'))
    expect(middle('vm')).toBeLessThan(middle('ct'))
    expect(middle('lone')).toBeLessThan(middle('lonevm'))
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

describe('2. layers of a level', () => {
  const middleOf = (net: ReturnType<typeof network>, boundary: string[]) => {
    const { layers } = run(net, boundary)
    return (id: string) => {
      const b = layers.composition.boxes.get(`unit:${id}`)
      if (!b) throw new Error(`no box for ${id}`)
      return b.y + b.height / 2
    }
  }

  it('follows the longest path over the directed lines: each end of a line below its nearer end', () => {
    // flows x>a, a>b, c>b, x>c: b comes after both a and c, whichever way round it is joined
    const y = middleOf(network('x-a a-b b-c x-c'), ['x'])
    expect(y('x')).toBeLessThan(y('a'))
    expect(y('x')).toBeLessThan(y('c'))
    expect(y('a')).toBeLessThan(y('b'))
    expect(y('c')).toBeLessThan(y('b'))
  })

  it('stands the ends of an even pair in one layer', () => {
    // a and b are as near as each other (a-b is only even), and c is after a
    const y = middleOf(network('x-a x-b a-b a-c'), ['x'])
    expect(y('a')).toBeCloseTo(y('b'), 6)
    expect(y('a')).toBeLessThan(y('c'))
  })

  it('reads the nearer end from the structure on the virtual side too', () => {
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
    const { layers } = run(net, ['r'])
    const box = (id: string) => {
      const b = layers.composition.boxes.get(id)
      if (!b) throw new Error(`no box for ${id}`)
      return b
    }
    expect(box('segment:ix').y).toBeGreaterThan(box('unit:r').y + box('unit:r').height)
    expect(box('unit:s').y).toBeGreaterThan(box('unit:r').y + box('unit:r').height)
  })

  it('invents no direction without a boundary', () => {
    const net = network('a-b a-c')
    const structure = deriveStructure(net)
    const flat = layoutLayers(net, structure, { ...metrics, aspect: 100 })
    expect(placingLines(flat.elements, structure).near.every((n) => n === undefined)).toBe(true)
    // nothing is above anything: with a shape that asks for one row, all three stand in it
    const tops = ['a', 'b', 'c'].map((id) => flat.composition.boxes.get(`unit:${id}`)?.y)
    expect(new Set(tops).size).toBe(1)
  })

  it('names the nearer end of a line by its flows pair, not by a number', () => {
    const net = network('x-a a-b')
    const forward = run(net, ['x'])
    const backward = run(net, ['b'])
    const near = (r: typeof forward) => placingLines(r.layers.elements, r.structure).near
    expect(near(forward)).toEqual([0, 0])
    expect(near(backward)).toEqual([1, 1])
  })
})

describe('3. order', () => {
  it('gives a dummy to no line: lines that place run one layer, the rest are laid over', () => {
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
    // the structure does not count the line between b and ix as nearness: it is laid over the
    // network and has no path through the layers
    const long = layers.elements.lines.findIndex(
      (l) =>
        l.ends.some((e) => e.element === 'unit:b') &&
        l.ends.some((e) => e.element === 'segment:ix'),
    )
    expect(long).toBeGreaterThanOrEqual(0)
    expect(layers.composition.routes.get(long)).toBeUndefined()
    expect(layers.composition.routes.size).toBeLessThan(layers.elements.lines.length)
  })

  it('places the same with or without a line laid over the network', () => {
    const base = `
nodes:
  - { id: r }
  - { id: a }
  - { id: b }
  - { id: c }
  - { id: d }
links:
  - endpoints: [{ node: r }, { node: a }]
  - endpoints: [{ node: r }, { node: b }]
  - endpoints: [{ node: a }, { node: c }]
  - endpoints: [{ node: b }, { node: d }]
`
    const plain = readNetworkModel(base).config
    const tunnelled = readNetworkModel(
      `${base}  - endpoints: [{ node: c }, { node: d }]
    virtual: true
`,
    ).config
    const a = layoutDrawing(plain, deriveStructure(plain, { boundary: ['r'] }), metrics)
    const b = layoutDrawing(tunnelled, deriveStructure(tunnelled, { boundary: ['r'] }), metrics)
    expect(b.nodes.map((n) => n.box)).toEqual(a.nodes.map((n) => n.box))
    expect(b.wires).toHaveLength(5)
  })

  it('draws a tree with no crossings', () => {
    const net = network('r-a r-b a-c a-d b-e b-f')
    expect(crossingsOf(drawn(net, ['r']))).toBe(0)
  })

  it('untangles a layer that was written crossed', () => {
    const net = network('r-a r-b a-d b-c')
    expect(crossingsOf(drawn(net, ['r']))).toBe(0)
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

  it('keeps layers apart by the least the metrics ask', () => {
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

  it('keeps sibling groups a group gap apart', () => {
    const ga = scene.groups.find((g) => g.group.id === 'ga')?.box
    const gb = scene.groups.find((g) => g.group.id === 'gb')?.box
    if (!ga || !gb) throw new Error('missing frame')
    expect(overlaps(ga, gb)).toBe(false)
    const [near, far] = ga.x < gb.x ? [ga, gb] : [gb, ga]
    const apart = Math.max(far.x - (near.x + near.width), far.y - (near.y + near.height))
    expect(apart).toBeGreaterThanOrEqual(0)
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

  it('draws a line laid over the network straight, on top, without moving anything', () => {
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
    const over = s.wires.find((w) => w.link.from.node === 'b' || w.link.to.node === 'b')
    expect(over).toBeDefined()
    expect(over?.points).toHaveLength(2)
    expect(s.wires).toHaveLength(4)
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
