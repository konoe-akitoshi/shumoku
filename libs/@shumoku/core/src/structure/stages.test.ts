import { describe, expect, it } from 'vitest'
import { plainNetwork, stagesOfYaml, structureOfYaml } from './fixtures.js'

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
    const members = g.edges
      .filter((e) => e.kind === 'member')
      .map((e) => [e.ends, e.virtual] as const)
      .sort(([x], [y]) => JSON.stringify(x).localeCompare(JSON.stringify(y)))
    // b and c are in the segment by the set's address only, d and e by a link with a cable.
    expect(members).toEqual([
      [[{ node: 'b' }, { segment: 'lan' }], true],
      [[{ node: 'c' }, { segment: 'lan' }], true],
      [[{ node: 'd' }, { segment: 'lan' }], false],
      [[{ node: 'e' }, { segment: 'lan' }], false],
    ])
  })

  it('makes a membership virtual unless a link with a cable carries the segment', () => {
    const over = stagesOfYaml(`segments: [{ id: ix }]
nodes: [{ id: r }, { id: peer }]
links:
  - { endpoints: [{ node: r }, { segment: ix }] }
  - { endpoints: [{ node: r }, { node: peer }], segments: [ix], virtual: true }
`).analysis
    const peer = over.edges.find((e) => e.kind === 'member')
    expect(peer).toMatchObject({ ends: [{ node: 'peer' }, { segment: 'ix' }], virtual: true })
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
  const stageOf = (yaml: string, name: string) =>
    stagesOfYaml(yaml).planes.find((p) => p.plane === name)

  it('keeps a ring through a routing domain out of the default plane', () => {
    const main = stageOf(ring, 'default')
    expect(main?.edges.map((e) => [e.a, e.b])).toEqual([
      [u('a'), u('b')],
      [u('b'), u('c')],
      [u('c'), u('d')],
    ])
    expect(JSON.stringify(main)).not.toContain('vrf')
  })

  it('gives a routing domain a plane of its own', () => {
    expect(structureOfYaml(ring).planes.map((p) => p.plane)).toEqual(['default', 'vrf'])
    expect(stageOf(ring, 'vrf')?.edges.map((e) => [e.a, e.b])).toEqual([
      ['routingDomain:vrf', u('a')],
      ['routingDomain:vrf', u('c')],
    ])
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
    expect(Object.keys(structure).sort()).toEqual(['boundary', 'candidates', 'nodes', 'planes'])
    expect(structure.nodes).toEqual({ a1: { unit: 'ha' }, a2: { unit: 'ha' } })
    expect(JSON.stringify(structure)).not.toMatch(/\b(node|unit|segment|routingDomain|S|P|R):/)
  })
})
