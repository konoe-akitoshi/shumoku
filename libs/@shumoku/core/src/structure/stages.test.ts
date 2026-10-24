import { describe, expect, it } from 'vitest'
import { plainNetwork, structureOfYaml } from './fixtures.js'
import { canonicalForm } from './index.js'

const u = (id: string) => `unit:${id}`
const s = (id: string) => `segment:${id}`
const derive = (
  links: string,
  more: Parameters<typeof plainNetwork>[0] extends infer T ? Partial<T> : never = {},
) => structureOfYaml(plainNetwork({ links, ...more }))
const groups = (ids: string) =>
  `groups:\n${ids
    .split(/\s+/)
    .filter(Boolean)
    .map((g) => `  - { id: ${g} }`)
    .join('\n')}`

describe('1. analysis graph', () => {
  const yaml = `
segments:
  - id: lan
    addresses: { a: 10.0.0.1, ha: 10.0.0.9 }
  - id: unused
  - id: trunk-vlan
routingDomains:
  - { id: vrf }
redundancy:
  - { id: ha, nodes: [b, c] }
nodes:
  - { id: a }
  - { id: b }
  - { id: c }
  - { id: d }
  - { id: e }
links:
  - endpoints: [{ node: a }, { segment: lan }]
  - endpoints: [{ node: a }, { node: b }]
    virtual: true
  - endpoints: [{ node: b }, { routingDomain: vrf }]
  - endpoints: [{ node: d }, { node: e, port: p1 }]
    segments: [lan]
  - endpoints: [{ node: d }, { node: e, port: p1 }]
  - endpoints: [{ node: e, port: p1 }, { node: d }]
`
  const g = structureOfYaml(yaml).analysis

  it('has the nodes and the segments a line ends at', () => {
    expect(g.vertices.map((v) => v.ref)).toEqual([
      'node:a',
      'node:b',
      'node:c',
      'node:d',
      'node:e',
      s('lan'),
    ])
  })

  it('leaves out virtual lines and lines to a routing domain', () => {
    const ends = g.edges.map((e) => e.ends)
    expect(ends).not.toContainEqual([{ node: 'a' }, { node: 'b' }])
    expect(JSON.stringify(g.edges)).not.toContain('vrf')
  })

  it('counts lines with the same ends and ports as one with a multiplicity', () => {
    const de = g.edges.filter(
      (e) => e.kind === 'link' && 'node' in e.ends[0] && e.ends[0].node === 'd',
    )
    expect(de).toHaveLength(1)
    expect(de[0]?.multiplicity).toBe(3)
    expect(de[0]?.carries).toEqual(['lan'])
  })

  it('joins a node to a segment it is in by an address, a set address or a carried segment', () => {
    const members = g.edges.filter((e) => e.kind === 'member').map((e) => e.ends)
    expect(members).toEqual([
      [{ node: 'b' }, { segment: 'lan' }],
      [{ node: 'c' }, { segment: 'lan' }],
      [{ node: 'd' }, { segment: 'lan' }],
      [{ node: 'e' }, { segment: 'lan' }],
    ])
  })
})

describe('2. units', () => {
  const sets = (extra: string, nodes: string) =>
    structureOfYaml(`
${groups('g1 g2')}
redundancy:
${extra}
nodes:
${nodes}
links:
  - endpoints: [{ node: sw }, { node: r1 }]
  - endpoints: [{ node: sw }, { node: r2 }]
`).units

  it('folds a redundancy set whose nodes share a place', () => {
    const units = sets(
      '  - { id: ha, nodes: [r1, r2] }',
      '  - { id: sw }\n  - { id: r1, group: g1 }\n  - { id: r2, group: g1 }',
    )
    expect(units.units.map((x) => [x.id, x.kind, x.members, x.place])).toEqual([
      ['ha', 'redundancy', ['r1', 'r2'], 'g1'],
      ['sw', 'node', ['sw'], undefined],
    ])
  })

  it('keeps a set apart when its nodes are in different places', () => {
    const units = sets(
      '  - { id: ha, nodes: [r1, r2] }',
      '  - { id: sw }\n  - { id: r1, group: g1 }\n  - { id: r2, group: g2 }',
    )
    expect(units.units.map((x) => x.id)).toEqual(['r1', 'r2', 'sw'])
    expect(units.kept).toEqual([{ redundancy: 'ha', why: 'places' }])
  })

  it('takes a node without a group from its host for the place', () => {
    const units = structureOfYaml(`
${groups('g1 g2')}
redundancy:
  - { id: ha, nodes: [r1, r2] }
  - { id: ha2, nodes: [q1, q2] }
nodes:
  - { id: h1, group: g1 }
  - { id: h2, group: g1 }
  - { id: h3, group: g1 }
  - { id: h4, group: g2 }
  - { id: r1, host: h1 }
  - { id: r2, host: h2 }
  - { id: q1, host: h3 }
  - { id: q2, host: h4 }
links:
  - endpoints: [{ node: h1 }, { node: h2 }]
`).units
    const ids = units.units.map((x) => x.id)
    expect(ids).toContain('ha')
    expect(ids).not.toContain('ha2')
    expect(units.units.find((x) => x.id === 'ha')?.place).toBe('g1')
    expect(units.kept).toEqual([{ redundancy: 'ha2', why: 'places' }])
  })

  it('folds a chain of hosts into the lowest host', () => {
    const units = structureOfYaml(`
nodes:
  - { id: metal }
  - { id: hv, host: metal }
  - { id: vm, host: hv }
  - { id: other }
links:
  - endpoints: [{ node: vm }, { node: other }]
`).units
    expect(units.units.map((x) => [x.id, x.kind, x.members])).toEqual([
      ['metal', 'host', ['hv', 'metal', 'vm']],
      ['other', 'node', ['other']],
    ])
  })

  it('does not fold sets that share a node', () => {
    const units = structureOfYaml(`
redundancy:
  - { id: s1, nodes: [a, b] }
  - { id: s2, nodes: [b, c] }
nodes:
  - { id: a }
  - { id: b }
  - { id: c }
links:
  - endpoints: [{ node: a }, { node: c }]
`).units
    expect(units.units.map((x) => x.id)).toEqual(['a', 'b', 'c'])
    expect(units.kept.map((k) => k.why)).toEqual(['overlap', 'overlap'])
  })

  it('turns lines between members of a unit into no line of the unit graph', () => {
    const d = structureOfYaml(`
redundancy:
  - { id: ha, nodes: [a, b] }
nodes:
  - { id: a }
  - { id: b }
  - { id: c }
links:
  - endpoints: [{ node: a }, { node: b }]
  - endpoints: [{ node: a }, { node: c }]
  - endpoints: [{ node: b }, { node: c }]
`).decomposition
    expect(d.edges).toHaveLength(1)
    expect(d.edges[0]?.multiplicity).toBe(2)
  })
})

describe('3. decomposition', () => {
  it('makes a ring one block with one S node going round', () => {
    const d = derive('a-b b-c c-d d-e e-a').decomposition
    expect(d.blocks).toHaveLength(1)
    const nodes = d.blocks[0]?.spqr?.nodes ?? []
    expect(nodes).toHaveLength(1)
    expect(nodes[0]?.kind).toBe('S')
    expect(nodes[0]?.vertices).toEqual(['a', 'b', 'c', 'd', 'e'].map(u))
    expect(d.cutVertices).toEqual([])
  })

  it('makes a tree of bridges joined at cut vertices', () => {
    const d = derive('a-b b-c b-d d-e').decomposition
    expect(d.blocks.map((b) => b.vertices.length)).toEqual([2, 2, 2, 2])
    expect(d.blocks.every((b) => b.spqr === undefined)).toBe(true)
    expect(d.cutVertices.map((c) => c.vertex)).toEqual([u('b'), u('d')])
    expect(d.cutVertices[0]?.blocks).toHaveLength(3)
  })

  it('makes K4 one R node', () => {
    const d = derive('a-b a-c a-d b-c b-d c-d').decomposition
    const nodes = d.blocks[0]?.spqr?.nodes ?? []
    expect(nodes.map((n) => [n.kind, n.vertices.length, n.edges.length])).toEqual([['R', 4, 6]])
  })

  it('splits two poles with several between them into a P node and one S node each', () => {
    const d = derive('p1-a1 p1-a2 p1-a3 p2-a1 p2-a2 p2-a3').decomposition
    const nodes = d.blocks[0]?.spqr?.nodes ?? []
    expect(nodes.map((n) => n.kind).sort()).toEqual(['P', 'S', 'S', 'S'])
    const p = nodes.find((n) => n.kind === 'P')
    expect(p?.vertices).toEqual([u('p1'), u('p2')])
    expect(p?.edges.every((e) => e.kind === 'virtual')).toBe(true)
    expect(p?.edges).toHaveLength(3)
    for (const n of nodes.filter((x) => x.kind === 'S')) {
      expect(n.vertices).toHaveLength(3)
      expect(n.edges.filter((e) => e.kind === 'virtual')).toHaveLength(1)
    }
  })

  it('keeps 3 by 3 complete bipartite as one R node', () => {
    const d = derive('x1-y1 x1-y2 x1-y3 x2-y1 x2-y2 x2-y3 x3-y1 x3-y2 x3-y3').decomposition
    const nodes = d.blocks[0]?.spqr?.nodes ?? []
    expect(nodes.map((n) => [n.kind, n.vertices.length, n.edges.length])).toEqual([['R', 6, 9]])
  })

  it('puts the direct line between the poles in the P node', () => {
    const d = derive('p1-p2 p1-a1 a1-p2 p1-a2 a2-p2').decomposition
    const p = (d.blocks[0]?.spqr?.nodes ?? []).find((n) => n.kind === 'P')
    expect(p?.edges.map((e) => e.kind).sort()).toEqual(['real', 'virtual', 'virtual'])
  })

  it('finds a ring of rings: S nodes joined through P nodes are not merged', () => {
    // A cycle a-b-c-d with the chord a-c: two triangles on the chord.
    const d = derive('a-b b-c c-d d-a a-c').decomposition
    const nodes = d.blocks[0]?.spqr?.nodes ?? []
    expect(nodes.map((n) => n.kind).sort()).toEqual(['P', 'S', 'S'])
  })

  it('gives a vertex with no line a block of its own', () => {
    const d = derive('a-b', { alone: 'z' }).decomposition
    expect(d.blocks.map((b) => b.vertices)).toEqual([[u('a'), u('b')], [u('z')]])
  })

  it('joins every virtual edge to a node that joins it back', () => {
    const d = derive('a-b b-c c-d d-a a-c c-e e-f f-c b-g g-d').decomposition
    for (const block of d.blocks) {
      const nodes = block.spqr?.nodes ?? []
      for (const n of nodes) {
        for (const e of n.edges) {
          if (e.kind !== 'virtual') continue
          const back = nodes.find((m) => m.key === e.to)
          expect(back?.edges.some((f) => f.kind === 'virtual' && f.to === n.key)).toBe(true)
        }
      }
    }
  })
})

describe('4. twins', () => {
  it('bundles units with the same neighbours', () => {
    const t = derive('p1-a1 p1-a2 p1-a3 p2-a1 p2-a2 p2-a3 a1-x').twins
    expect(t.map((x) => x.members)).toEqual([
      [u('a2'), u('a3')],
      [u('p1'), u('p2')],
    ])
  })

  it('bundles leaves of one switch and not leaves of two', () => {
    const t = derive('sw-l1 sw-l2 sw-l3 sw2-m1 sw-sw2').twins
    expect(t.map((x) => x.members)).toEqual([[u('l1'), u('l2'), u('l3')]])
    expect(t[0]?.neighbours).toEqual([u('sw')])
  })

  it('finds the twins of a complete bipartite graph on both sides', () => {
    const t = derive('p1-a1 p1-a2 p2-a1 p2-a2').twins
    expect(t.map((x) => x.members)).toEqual([
      [u('a1'), u('a2')],
      [u('p1'), u('p2')],
    ])
  })

  it('leaves out a unit with no neighbours', () => {
    expect(derive('a-b', { alone: 'y z' }).twins).toEqual([])
  })
})

describe('5. parts', () => {
  it('makes the sides that nothing crosses into parts', () => {
    const p = derive('x1-x2 x2-x3 x3-x4').parts
    expect(p.parts.map((x) => x.members)).toEqual([
      [u('x1'), u('x2')],
      [u('x3'), u('x4')],
    ])
    expect(p.spanning).toEqual([])
  })

  it('lets a group that holds the middle make both sides span', () => {
    const p = derive('x1-x2 x2-x3 x3-x4', {
      rest: groups('mid'),
      place: { x2: 'mid', x3: 'mid' },
    }).parts
    expect(p.spanning.map((x) => x.members)).toEqual([
      [u('x1'), u('x2')],
      [u('x3'), u('x4')],
    ])
    expect(p.spanning[0]?.crosses).toEqual([{ kind: 'group', of: 'mid' }])
    expect(p.parts.map((x) => x.groups)).toEqual([['mid']])
  })

  it('merges a candidate that equals a group with it', () => {
    const p = derive('x1-x2 x2-x3 x3-x4', {
      rest: groups('right'),
      place: { x3: 'right', x4: 'right' },
    }).parts
    const right = p.parts.find((x) => x.groups.includes('right'))
    expect(right?.members).toEqual([u('x3'), u('x4')])
    expect(right?.origins).toEqual([{ kind: 'side', cut: u('x2') }])
    expect(p.parts).toHaveLength(2)
  })

  it('nests parts by what they hold', () => {
    const p = derive('c-a1 c-a2 c-a3 c-b1 c-b2 a1-z', {
      rest: `groups:\n  - id: outer\n    groups:\n      - { id: inner }`,
      place: { a1: 'inner', z: 'inner', a2: 'outer', a3: 'outer', c: 'outer' },
    }).parts
    const outer = p.parts.find((x) => x.groups.includes('outer'))
    const inner = p.parts.find((x) => x.groups.includes('inner'))
    expect(inner?.members).toEqual([u('a1'), u('z')])
    expect(outer?.children).toContainEqual(inner?.members)
    expect(outer?.own).toEqual([u('a2'), u('a3'), u('c')])
  })

  it('lets a group split a twin bundle', () => {
    const p = derive('sw-l1 sw-l2 sw-l3 sw-m1', {
      rest: groups('half'),
      place: { l1: 'half', sw: 'half' },
    }).parts
    expect(p.spanning.map((x) => x.members)).toContainEqual([u('l1'), u('l2'), u('l3'), u('m1')])
    expect(p.parts.map((x) => x.groups)).toContainEqual(['half'])
  })

  it('places a unit that has members in different groups in the group above both', () => {
    const p = structureOfYaml(`
groups:
  - id: site
    groups:
      - { id: r1 }
      - { id: r2 }
nodes:
  - { id: host, group: r1 }
  - { id: vm, host: host, group: r2 }
  - { id: far }
  - { id: sw, group: site }
links:
  - endpoints: [{ node: vm }, { node: sw }]
  - endpoints: [{ node: sw }, { node: far }]
`).units
    expect(p.units.find((x) => x.id === 'host')?.place).toBe('site')
  })
})

describe('6. same shape', () => {
  it('says two parts of the same form are the same', () => {
    const sh = derive('a1-a2 a2-a3 a3-a1 b1-b2 b2-b3 b3-b1 c1-c2 c2-c3 a1-b1 b2-c3', {
      rest: groups('ga gb gc'),
      place: {
        a1: 'ga',
        a2: 'ga',
        a3: 'ga',
        b1: 'gb',
        b2: 'gb',
        b3: 'gb',
        c1: 'gc',
        c2: 'gc',
        c3: 'gc',
      },
    }).shapes
    const triangles = sh.same.find((c) =>
      c.parts.some((p) => p.includes(u('a1')) && p.length === 3),
    )
    expect(triangles?.parts).toEqual([
      [u('a1'), u('a2'), u('a3')],
      [u('b1'), u('b2'), u('b3')],
    ])
  })

  it('does not make a form for a part larger than the limit, and says so', () => {
    const leaves = Array.from({ length: 11 }, (_, i) => `h-l${i + 1}`).join(' ')
    const sh = derive(leaves).shapes
    const big = sh.shapes.find((x) => x.part.length === 11)
    expect(big?.form).toEqual({ kind: 'too-large', size: 11 })
    expect(sh.limit).toBe(10)
  })

  it('makes a form for a part at the limit with many interchangeable members', () => {
    const leaves = Array.from({ length: 10 }, (_, i) => `h-l${i + 1}`).join(' ')
    const sh = derive(leaves).shapes
    expect(sh.shapes.find((x) => x.part.length === 10)?.form.kind).toBe('exact')
  })
})

describe('canonicalForm', () => {
  const graph = (n: number, pairs: [number, number][]) => {
    const m = Array.from({ length: n }, () => Array.from({ length: n }, () => 0))
    for (const [a, b] of pairs) {
      const row = m[a]
      const other = m[b]
      if (row) row[b] = (row[b] ?? 0) + 1
      if (other) other[a] = (other[a] ?? 0) + 1
    }
    return m
  }
  const label = (n: number) => Array.from({ length: n }, () => 'unit')

  it('is the same for a renamed graph', () => {
    const a = graph(5, [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 0],
      [0, 2],
    ])
    const b = graph(5, [
      [3, 1],
      [1, 4],
      [4, 0],
      [0, 2],
      [2, 3],
      [3, 4],
    ])
    expect(canonicalForm(label(5), a)).toBe(canonicalForm(label(5), b))
  })

  it('tells a 6-cycle from two triangles, which colour refinement alone cannot', () => {
    const six = graph(6, [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 5],
      [5, 0],
    ])
    const two = graph(6, [
      [0, 1],
      [1, 2],
      [2, 0],
      [3, 4],
      [4, 5],
      [5, 3],
    ])
    expect(canonicalForm(label(6), six)).not.toBe(canonicalForm(label(6), two))
  })

  it('counts lines and tells the kinds apart', () => {
    const one = graph(2, [[0, 1]])
    const two = graph(2, [
      [0, 1],
      [0, 1],
    ])
    expect(canonicalForm(label(2), one)).not.toBe(canonicalForm(label(2), two))
    expect(canonicalForm(['unit', 'segment'], one)).not.toBe(canonicalForm(label(2), one))
    expect(canonicalForm(['unit', 'segment'], one)).toBe(canonicalForm(['segment', 'unit'], one))
  })
})
