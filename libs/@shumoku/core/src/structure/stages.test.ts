import { describe, expect, it } from 'vitest'
import { plainNetwork, stagesOfYaml, structureOfYaml } from './fixtures.js'
import { canonicalForm } from './index.js'

const u = (id: string) => `unit:${id}`
const s = (id: string) => `segment:${id}`
const derive = (
  links: string,
  more: Parameters<typeof plainNetwork>[0] extends infer T ? Partial<T> : never = {},
) => {
  const plane = stagesOfYaml(plainNetwork({ links, ...more })).planes.find(
    (p) => p.plane === 'default',
  )
  if (!plane) throw new Error('no default plane')
  return plane
}
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
  const g = stagesOfYaml(yaml).analysis

  it('has the nodes, and the segments and routing domains a line ends at', () => {
    expect(g.vertices.map((v) => v.ref)).toEqual([
      'node:a',
      'node:b',
      'node:c',
      'node:d',
      'node:e',
      'routingDomain:vrf',
      s('lan'),
    ])
  })

  it('keeps a virtual line as a line marked virtual, and a line to a routing domain', () => {
    const ab = g.edges.find(
      (e) => e.kind === 'link' && 'node' in e.ends[1] && e.ends[1].node === 'b',
    )
    expect(ab).toMatchObject({ ends: [{ node: 'a' }, { node: 'b' }], virtual: true })
    expect(g.edges.map((e) => e.ends)).toContainEqual([{ node: 'b' }, { routingDomain: 'vrf' }])
  })

  it('runs a virtual session that carries a segment over that segment', () => {
    const over = stagesOfYaml(`segments: [{ id: ix }]
nodes: [{ id: r }, { id: peer }]
links:
  - endpoints: [{ node: r }, { segment: ix }]
  - endpoints: [{ node: r }, { node: peer }]
    segments: [ix]
    virtual: true
`).analysis
    expect(over.edges.map((e) => [e.kind, e.ends])).toEqual([
      ['link', [{ node: 'r' }, { segment: 'ix' }]],
      ['member', [{ node: 'peer' }, { segment: 'ix' }]],
    ])
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
    stagesOfYaml(`
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
    const units = stagesOfYaml(`
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
    const units = stagesOfYaml(`
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
    const units = stagesOfYaml(`
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
    const d = stagesOfYaml(`
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
`).planes[0]
    expect(d?.edges).toHaveLength(1)
    expect(d?.edges[0]?.multiplicity).toBe(2)
  })

  it('places a unit that has members in different groups in the group above both', () => {
    const p = stagesOfYaml(`
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

describe('3. planes', () => {
  // A ring through a routing domain: a-b-c in the default plane, and a-vrf-c beside it.
  const ring = `
routingDomains: [{ id: vrf }]
nodes: [{ id: a }, { id: b }, { id: c }, { id: d }]
links:
  - endpoints: [{ node: a }, { node: b }]
  - endpoints: [{ node: b }, { node: c }]
  - endpoints: [{ node: a }, { routingDomain: vrf }]
  - endpoints: [{ node: c }, { routingDomain: vrf }]
  - endpoints: [{ node: c }, { node: d }]
`
  const planeOf = (yaml: string, name: string) =>
    structureOfYaml(yaml).planes.find((p) => p.plane === name)
  const stageOf = (yaml: string, name: string) =>
    stagesOfYaml(yaml).planes.find((p) => p.plane === name)

  it('keeps a ring through a routing domain out of the default decomposition', () => {
    const main = stageOf(ring, 'default')
    expect(main?.decomposition.blocks.map((b) => b.vertices.length)).toEqual([2, 2, 2])
    expect(main?.decomposition.cutVertices.map((c) => c.vertex)).toEqual([u('b'), u('c')])
    expect(JSON.stringify(main)).not.toContain('vrf')
    // Blocks of two vertices are not in the output.
    expect(planeOf(ring, 'default')?.blocks).toEqual([])
  })

  it('gives a routing domain a plane of its own with its own blocks', () => {
    expect(structureOfYaml(ring).planes.map((p) => p.plane)).toEqual(['default', 'vrf'])
    const vrf = stageOf(ring, 'vrf')
    expect(vrf?.decomposition.blocks.map((b) => b.vertices)).toEqual([
      ['routingDomain:vrf', u('a')],
      ['routingDomain:vrf', u('c')],
    ])
    expect(vrf?.decomposition.cutVertices.map((c) => c.vertex)).toEqual(['routingDomain:vrf'])
  })

  it('does not put a unit in a plane where it has no line', () => {
    const inVrf = stageOf(ring, 'vrf')?.vertices ?? []
    expect(inVrf).not.toContain(u('b'))
    expect(inVrf).not.toContain(u('d'))
  })

  it('puts the lines of a segment written in a routing domain, and those carrying it, there', () => {
    const yaml = `
routingDomains: [{ id: vpc }]
segments:
  - { id: subnet, routingDomain: vpc }
  - { id: plain }
nodes: [{ id: x }, { id: y }, { id: z }, { id: w }]
links:
  - endpoints: [{ node: x }, { segment: subnet }]
  - endpoints: [{ node: y }, { node: z }]
    segments: [subnet]
  - endpoints: [{ node: w }, { segment: plain }]
  - endpoints: [{ node: w }, { node: x }]
`
    expect(structureOfYaml(yaml).planes.map((p) => p.plane)).toEqual(['default', 'vpc'])
    const members = stageOf(yaml, 'vpc')?.vertices ?? []
    for (const v of [s('subnet'), u('x'), u('y'), u('z')]) expect(members).toContain(v)
    const main = stageOf(yaml, 'default')?.vertices ?? []
    expect(main).toContain(s('plain'))
    expect(main).not.toContain(s('subnet'))
  })

  it('keeps a unit with no line at all in the default plane', () => {
    expect(derive('a-b', { alone: 'z' }).vertices).toContain(u('z'))
  })
})

describe('4. decomposition output', () => {
  it('gives a shape to a block of three or more only, as S, P and R', () => {
    const [main] = structureOfYaml(plainNetwork({ links: 'a-b b-c c-a c-d' })).planes
    expect(main?.blocks).toEqual([
      { members: [{ unit: 'a' }, { unit: 'b' }, { unit: 'c' }], shape: [{ S: expect.any(Array) }] },
    ])
    const [p] = structureOfYaml(
      plainNetwork({ links: 'p1-a1 p1-a2 p1-a3 p2-a1 p2-a2 p2-a3' }),
    ).planes
    const kinds = (p?.blocks[0]?.shape ?? []).map((x) => Object.keys(x)[0]).sort()
    expect(kinds).toEqual(['P', 'S', 'S', 'S'])
  })
})

describe('5. twins output', () => {
  it('finds adjacent twins: the same closed neighbourhood', () => {
    const t = derive('a-b a-c a-d b-c b-d').twins
    expect(t.map((x) => [x.members, x.neighbours, x.adjacent])).toEqual([
      [[u('a'), u('b')], [u('c'), u('d')], true],
      [[u('c'), u('d')], [u('a'), u('b')], false],
    ])
  })

  it('carries them to the output with the shared neighbours', () => {
    const [main] = structureOfYaml(plainNetwork({ links: 'a-b a-c a-d b-c b-d' })).planes
    expect(main?.twins).toEqual([
      {
        members: [{ unit: 'a' }, { unit: 'b' }],
        with: [{ unit: 'c' }, { unit: 'd' }],
        adjacent: true,
      },
      {
        members: [{ unit: 'c' }, { unit: 'd' }],
        with: [{ unit: 'a' }, { unit: 'b' }],
        adjacent: false,
      },
    ])
  })

  it('does not make a pair that touch only each other adjacent twins', () => {
    expect(derive('a-b').twins).toEqual([])
  })

  it('finds twins in each plane on its own', () => {
    const yaml = `
routingDomains: [{ id: vrf }]
nodes: [{ id: a }, { id: b }, { id: h }]
links:
  - endpoints: [{ node: a }, { routingDomain: vrf }]
  - endpoints: [{ node: b }, { routingDomain: vrf }]
  - endpoints: [{ node: a }, { node: h }]
`
    const planes = structureOfYaml(yaml).planes
    expect(planes.find((p) => p.plane === 'vrf')?.twins).toEqual([
      {
        members: [{ unit: 'a' }, { unit: 'b' }],
        with: [{ routingDomain: 'vrf' }],
        adjacent: false,
      },
    ])
    expect(planes.find((p) => p.plane === 'default')?.twins).toEqual([])
  })
})

describe('6. same shape', () => {
  const sameOf = (links: string, more: Parameters<typeof derive>[1]) =>
    structureOfYaml(plainNetwork({ links, ...more })).same

  it('says two groups of the same form are the same', () => {
    const same = sameOf('a1-a2 a2-a3 a3-a1 b1-b2 b2-b3 b3-b1 c1-c2 c2-c3 a1-b1 b2-c3', {
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
    })
    expect(same).toContainEqual(['ga', 'gb'])
    expect(JSON.stringify(same)).not.toContain('gc')
  })

  it('does not compare twins, whose form is only their count', () => {
    expect(sameOf('h-l1 h-l2 g-m1 g-m2 h-g', {})).toEqual([])
  })

  it('compares a group by the default plane only', () => {
    const yaml = `
${groups('ga gb')}
routingDomains: [{ id: vrf }]
nodes:
  - { id: a1, group: ga }
  - { id: a2, group: ga }
  - { id: b1, group: gb }
  - { id: b2, group: gb }
links:
  - endpoints: [{ node: a1 }, { node: a2 }]
  - endpoints: [{ node: b1 }, { node: b2 }]
  - endpoints: [{ node: b1 }, { routingDomain: vrf }]
  - endpoints: [{ node: b2 }, { routingDomain: vrf }]
`
    expect(structureOfYaml(yaml).same).toContainEqual(['ga', 'gb'])
  })

  it('does not make a form for a group larger than the limit, and says so', () => {
    const leaves = Array.from({ length: 11 }, (_, i) => `h-l${i + 1}`).join(' ')
    const place = Object.fromEntries(
      ['h', ...Array.from({ length: 11 }, (_, i) => `l${i + 1}`)].map((n) => [n, 'big']),
    )
    const sh = stagesOfYaml(plainNetwork({ links: leaves, rest: groups('big'), place })).shapes
    const big = sh.shapes.find((x) => x.group === 'big')
    expect(big?.form).toEqual({ kind: 'too-large', size: 12 })
    expect(sh.limit).toBe(10)
  })

  it('makes a form for a group at the limit with many interchangeable members', () => {
    const leaves = Array.from({ length: 9 }, (_, i) => `h-l${i + 1}`).join(' ')
    const place = Object.fromEntries(
      ['h', ...Array.from({ length: 9 }, (_, i) => `l${i + 1}`)].map((n) => [n, 'g']),
    )
    const sh = stagesOfYaml(plainNetwork({ links: leaves, rest: groups('g'), place })).shapes
    expect(sh.shapes.find((x) => x.group === 'g')?.form.kind).toBe('exact')
  })
})

describe('the output', () => {
  it('names only ids of the configuration, with no prefixed string', () => {
    const yaml = `
${groups('ga gb')}
routingDomains: [{ id: vrf }]
segments: [{ id: lan }]
redundancy: [{ id: ha, nodes: [a1, a2] }]
nodes:
  - { id: a1, group: ga }
  - { id: a2, group: ga }
  - { id: b1, group: gb }
  - { id: b2, group: gb }
  - { id: c }
links:
  - endpoints: [{ node: a1 }, { segment: lan }]
  - endpoints: [{ node: b1 }, { segment: lan }]
  - endpoints: [{ node: b2 }, { segment: lan }]
  - endpoints: [{ node: c }, { segment: lan }]
  - endpoints: [{ node: c }, { routingDomain: vrf }]
  - endpoints: [{ node: b1 }, { routingDomain: vrf }]
  - endpoints: [{ node: a1 }, { node: c }]
  - endpoints: [{ node: a2 }, { node: c }]
`
    const structure = structureOfYaml(yaml)
    expect(Object.keys(structure).sort()).toEqual(['edges', 'nodes', 'planes', 'same'])
    expect(structure.nodes).toEqual({ a1: { unit: 'ha' }, a2: { unit: 'ha' } })
    expect(JSON.stringify(structure)).not.toMatch(/\b(node|unit|segment|routingDomain|S|P|R):/)
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
