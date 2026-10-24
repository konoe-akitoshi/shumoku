import { describe, expect, it } from 'vitest'
import { stagesOfYaml, structureOfYaml } from './fixtures.js'
import type { Branch } from './types.js'

const u = (id: string) => `unit:${id}`

/** Nodes and plain links written out; `in` puts nodes in groups, the rest are unplaced. */
function net(opts: {
  links: string
  in?: Record<string, string>
  groups?: string
  rest?: string
  virtual?: string[]
}): string {
  const ids = new Set<string>()
  const lines: string[] = []
  for (const pair of opts.links.split(/\s+/).filter(Boolean)) {
    const [a, b] = pair.split('-')
    if (a === undefined || b === undefined) throw new Error(`bad link ${pair}`)
    ids.add(a)
    ids.add(b)
    const virtual = opts.virtual?.includes(pair) ? '\n    virtual: true' : ''
    lines.push(`  - endpoints: [{ node: ${a} }, { node: ${b} }]${virtual}`)
  }
  const nodes = [...ids].map((id) => {
    const group = opts.in?.[id]
    return `  - { id: ${id}${group ? `, group: ${group}` : ''} }`
  })
  return `${opts.groups ?? ''}\n${opts.rest ?? ''}\nnodes:\n${nodes.join('\n')}\nlinks:\n${lines.join('\n')}\n`
}

/** Every named node is placed in the one group `g`; the others are outside. */
const placedIn = (g: string, ids: string): Record<string, string> =>
  Object.fromEntries(ids.split(/\s+/).map((id) => [id, g]))

const G = 'groups:\n  - { id: g }'

describe('7. entrances', () => {
  it('takes a placed vertex with a physical line to a vertex with no place', () => {
    const s = stagesOfYaml(net({ links: 'a-b b-x', groups: G, in: placedIn('g', 'a b') }))
    expect(s.entrances).toEqual([{ vertex: u('b'), toward: [u('x')] }])
  })

  it('does not take a virtual line to a vertex with no place', () => {
    const s = stagesOfYaml(
      net({ links: 'a-b b-x', groups: G, in: placedIn('g', 'a b'), virtual: ['b-x'] }),
    )
    expect(s.entrances).toEqual([])
  })

  it('takes a line to a routing domain, virtual or not', () => {
    const yaml = `
groups: [{ id: g }]
routingDomains: [{ id: isp }, { id: wan }]
nodes:
  - { id: a, group: g }
  - { id: b, group: g }
links:
  - endpoints: [{ node: a }, { node: b }]
  - endpoints: [{ node: a }, { routingDomain: isp }]
    virtual: true
  - endpoints: [{ node: b }, { routingDomain: wan }]
`
    expect(stagesOfYaml(yaml).entrances).toEqual([
      { vertex: u('a'), toward: ['routingDomain:isp'] },
      { vertex: u('b'), toward: ['routingDomain:wan'] },
    ])
  })

  it('does not take lines between placed vertices, or from vertices with no place', () => {
    const s = stagesOfYaml(net({ links: 'a-b x-y', groups: G, in: placedIn('g', 'a b') }))
    expect(s.entrances).toEqual([])
  })

  it('takes a segment with a place that has a line to a vertex with no place', () => {
    const yaml = `
groups: [{ id: g }]
segments: [{ id: lan, group: g }]
nodes: [{ id: a, group: g }, { id: x }]
links:
  - endpoints: [{ node: a }, { segment: lan }]
  - endpoints: [{ segment: lan }, { node: x }]
`
    expect(stagesOfYaml(yaml).entrances).toEqual([{ vertex: 'segment:lan', toward: [u('x')] }])
  })

  it('lists the entrance with the units a folded redundancy set meets', () => {
    const yaml = `
groups: [{ id: g }]
redundancy: [{ id: gw, nodes: [gw1, gw2] }]
nodes:
  - { id: gw1, group: g }
  - { id: gw2, group: g }
  - { id: x }
  - { id: y }
links:
  - endpoints: [{ node: gw1 }, { node: x }]
  - endpoints: [{ node: gw2 }, { node: y }]
`
    expect(structureOfYaml(yaml).entrances).toEqual([
      { vertex: { unit: 'gw' }, toward: [{ unit: 'x' }, { unit: 'y' }] },
    ])
  })
})

describe('8. trunk', () => {
  it('is the path between two entrances, with the vertices of the blocks on it', () => {
    // a-b-c-d is a line of bridges; e hangs off b and is not on the way.
    const s = stagesOfYaml(
      net({
        links: 'x-a a-b b-c c-d d-y b-e',
        groups: G,
        in: placedIn('g', 'a b c d e'),
      }),
    )
    expect(s.entrances.map((e) => e.vertex)).toEqual([u('a'), u('d')])
    expect(s.trunk?.vertices).toEqual([u('a'), u('b'), u('c'), u('d')])
  })

  it('takes the whole block when the entrances sit in one block', () => {
    const s = stagesOfYaml(
      net({ links: 'x-a a-b b-c c-a c-y c-d', groups: G, in: placedIn('g', 'a b c d') }),
    )
    expect(s.trunk?.vertices).toEqual([u('a'), u('b'), u('c')])
    expect(s.trunk?.blocks).toEqual([[u('a'), u('b'), u('c')]])
  })

  it('is the entrance alone when there is one', () => {
    const s = stagesOfYaml(net({ links: 'x-a a-b b-c c-a', groups: G, in: placedIn('g', 'a b c') }))
    expect(s.trunk).toEqual({ vertices: [u('a')], blocks: [] })
  })

  it('is the ring when there is no entrance, with the bridge between two rings', () => {
    const one = stagesOfYaml(net({ links: 'a-b b-c c-a c-d' }))
    expect(one.trunk?.vertices).toEqual([u('a'), u('b'), u('c')])
    const two = stagesOfYaml(net({ links: 'a-b b-c c-a c-d d-e e-f f-g g-e' }))
    expect(two.trunk?.vertices).toEqual([u('a'), u('b'), u('c'), u('d'), u('e'), u('f'), u('g')])
  })

  it('is nothing when there is neither an entrance nor a ring', () => {
    const s = stagesOfYaml(net({ links: 'a-b b-c b-d' }))
    expect(s.trunk).toBeUndefined()
    expect(s.branches).toEqual([])
    expect(structureOfYaml(net({ links: 'a-b b-c b-d' })).trunk).toBeUndefined()
  })

  it('is found for each connected piece on its own', () => {
    // One piece has an entrance; the other has a ring and no entrance.
    const s = stagesOfYaml(
      net({ links: 'x-a a-b p-q q-r r-p', groups: G, in: placedIn('g', 'a b') }),
    )
    expect(s.trunk?.vertices).toEqual([u('a'), u('p'), u('q'), u('r')])
  })

  it('leaves out the blocks of two vertices from the output', () => {
    const out = structureOfYaml(
      net({ links: 'x-a a-b b-c c-d d-y', groups: G, in: placedIn('g', 'a b c d') }),
    )
    expect(out.trunk?.vertices).toHaveLength(4)
    expect(out.trunk?.blocks).toEqual([])
  })
})

/** The branches as `at>via(order)` with those inside indented. */
function outline(branches: readonly Branch[], depth = 0): string[] {
  return branches.flatMap((b) => {
    const at = 'unit' in b.at ? b.at.unit : '?'
    const via = b.via.map((v) => ('unit' in v ? v.unit : '?')).join(',')
    return [`${' '.repeat(depth * 2)}${at}>${via}(${b.order})`, ...outline(b.branches, depth + 1)]
  })
}

describe('9. branches', () => {
  // gw is the only entrance; everything else hangs off it.
  const hang = (links: string, rest: Parameters<typeof net>[0] = { links: '' }) =>
    structureOfYaml(
      net({
        ...rest,
        links: `x-gw ${links}`,
        groups: G,
        in: placedIn('g', `gw ${links.replace(/-/g, ' ')}`),
      }),
    )

  it('nests a branch at each fork, away from the trunk, named by the fork and via', () => {
    const o = outline(hang('gw-c c-s1 c-s2 s1-a1 s1-a2 s2-a3').branches)
    expect(o).toEqual([
      'gw>c(2)',
      '  c>s1(1)',
      '    s1>a1(1)',
      '    s1>a2(1)',
      '  c>s2(1)',
      '    s2>a3(1)',
      'gw>x(1)',
    ])
  })

  it('takes a block of several vertices as one branch, with its forks nested', () => {
    // c-r1-r2 is a ring hanging off gw through c; r1 has a leaf of its own.
    const o = outline(hang('gw-c c-r1 r1-r2 r2-c r1-l').branches)
    expect(o).toEqual(['gw>c(1)', '  c>r1,r2(1)', '    r1>l(1)', 'gw>x(1)'])
  })
})

describe('10. order and destination', () => {
  const orderOf = (links: string, at: string, via: string) => {
    const out = structureOfYaml(
      net({
        links: `x-gw ${links}`,
        groups: G,
        in: placedIn('g', `gw ${links.replace(/-/g, ' ')}`),
      }),
    )
    const find = (bs: readonly Branch[]): number | undefined => {
      for (const b of bs) {
        const here = 'unit' in b.at && b.at.unit === at
        if (here && b.via.some((v) => 'unit' in v && v.unit === via)) return b.order
        const inner = find(b.branches)
        if (inner !== undefined) return inner
      }
      return undefined
    }
    return find(out.branches)
  }

  it('is 1 for a dead end', () => {
    expect(orderOf('gw-c', 'gw', 'c')).toBe(1)
  })

  it('goes up by one when two onward branches have the same largest order', () => {
    // c has a switch with leaves and a lone switch with a leaf: two branches of order 1.
    expect(orderOf('gw-c c-s1 s1-a1 c-s2 s2-a2 s2-a3', 'gw', 'c')).toBe(2)
  })

  it('does not go up when one onward branch is larger than the rest', () => {
    // c has one deep branch (order 2) and one dead end (order 1): c is 2.
    const links = 'gw-c c-s1 s1-t1 t1-a s1-t2 t2-b c-l'
    expect(orderOf(links, 'gw', 'c')).toBe(2)
    expect(orderOf(links, 'c', 's1')).toBe(2)
    expect(orderOf(links, 'c', 'l')).toBe(1)
  })

  it('counts twins as one flow, so leaves on a switch make 1', () => {
    expect(orderOf('gw-c c-a1 c-a2 c-a3 c-a4', 'gw', 'c')).toBe(1)
  })

  it('reaches 3 only through two branches of 2', () => {
    const links = 'gw-r r-p r-q p-p1 p-p2 q-q1 q-q2 p1-a p1-b p2-c p2-d q1-e q1-f q2-g q2-h'
    expect(orderOf(links, 'gw', 'r')).toBe(3)
    expect(orderOf(links, 'r', 'p')).toBe(2)
  })

  describe('destination', () => {
    const yaml = `
groups:
  - id: site
    groups:
      - { id: floor1 }
      - { id: floor2 }
  - { id: other }
segments:
  - { id: lan, group: floor1 }
  - { id: free, group: other }
nodes:
  - { id: gw, group: site }
  - { id: sw1, group: floor1 }
  - { id: ap1, group: floor1 }
  - { id: sw2, group: floor2 }
  - { id: ap2, group: floor2 }
  - { id: ap3, group: other }
  - { id: o2, group: other }
  - { id: x }
links:
  - endpoints: [{ node: x }, { node: gw }]
  - endpoints: [{ node: gw }, { node: sw1 }]
  - endpoints: [{ node: sw1 }, { node: ap1 }]
  - endpoints: [{ node: sw1 }, { segment: lan }]
  - endpoints: [{ node: gw }, { node: sw2 }]
  - endpoints: [{ node: sw2 }, { node: ap2 }]
  - endpoints: [{ node: sw2 }, { node: ap3 }]
  - endpoints: [{ node: gw }, { node: o2 }]
  - endpoints: [{ node: sw2 }, { segment: free }]
`
    const branches = structureOfYaml(yaml).branches
    const at = (a: string, v: string) =>
      branches.find(
        (b) => 'unit' in b.at && b.at.unit === a && b.via.some((w) => 'unit' in w && w.unit === v),
      )

    it('holds the outermost group that lies wholly inside, and not one that lies partly', () => {
      // floor1 is sw1, ap1 and its segment lan: all inside the branch at gw via sw1.
      expect(at('gw', 'sw1')?.holds).toEqual([{ group: 'floor1' }])
      // floor2 has sw2 and ap2, both inside; `other` has o2 outside the branch.
      const sw2 = at('gw', 'sw2')
      expect(sw2?.holds).toContainEqual({ group: 'floor2' })
      expect(sw2?.holds).not.toContainEqual({ group: 'other' })
      expect(sw2?.holds).not.toContainEqual({ group: 'site' })
    })

    it('holds segments inside it that no held group holds', () => {
      const sw2 = at('gw', 'sw2')
      expect(sw2?.holds).toContainEqual({ segment: 'free' })
      // lan is written in floor1, which the branch holds, so it is not listed on its own.
      expect(at('gw', 'sw1')?.holds).not.toContainEqual({ segment: 'lan' })
    })
  })
})

describe('11. edges of a place', () => {
  it('lists the place beside the group that holds the other end, at the same level', () => {
    const yaml = `
groups:
  - id: venue
    groups:
      - { id: noc }
      - id: hall
        groups:
          - { id: island }
nodes:
  - { id: core, group: noc }
  - { id: agg, group: hall }
  - { id: sw, group: island }
  - { id: ext }
links:
  - endpoints: [{ node: core }, { node: agg }]
  - endpoints: [{ node: agg }, { node: sw }]
  - endpoints: [{ node: core }, { node: ext }]
`
    const edges = structureOfYaml(yaml).edges
    const of = (group: string, unit: string) =>
      edges.find((e) => e.group === group && e.unit === unit)?.toward
    // core leaves noc for the hall (beside noc), and for ext, which has no place.
    expect(of('noc', 'core')).toEqual([{ group: 'hall' }, { unit: 'ext' }])
    // It leaves venue for ext only: the hall is inside venue.
    expect(of('venue', 'core')).toEqual([{ unit: 'ext' }])
    // agg leaves hall for core in noc; sw is inside hall.
    expect(of('hall', 'agg')).toEqual([{ group: 'noc' }])
    // sw leaves island for agg, which lies in a group that holds island, so the unit itself.
    expect(of('island', 'sw')).toEqual([{ unit: 'agg' }])
    // Nothing is listed for a unit whose lines stay inside.
    expect(edges.find((e) => e.group === 'venue' && e.unit === 'agg')).toBeUndefined()
  })

  it('does not count a virtual line', () => {
    const yaml = `
groups: [{ id: a }, { id: b }]
nodes: [{ id: p, group: a }, { id: q, group: b }]
links:
  - endpoints: [{ node: p }, { node: q }]
    virtual: true
`
    expect(structureOfYaml(yaml).edges).toEqual([])
  })

  it('lists, node by node, where the nodes of a redundancy set go when they differ', () => {
    const yaml = `
groups: [{ id: hq }, { id: tyo1 }, { id: tyo2 }]
redundancy: [{ id: hq-fw, nodes: [hq-fw01, hq-fw02] }]
nodes:
  - { id: hq-fw01, group: hq }
  - { id: hq-fw02, group: hq }
  - { id: r1, group: tyo1 }
  - { id: r2, group: tyo2 }
links:
  - endpoints: [{ node: hq-fw01 }, { node: r1 }]
  - endpoints: [{ node: hq-fw02 }, { node: r2 }]
`
    expect(structureOfYaml(yaml).edges.find((e) => e.group === 'hq')).toEqual({
      group: 'hq',
      unit: 'hq-fw',
      toward: [{ group: 'tyo1' }, { group: 'tyo2' }],
      members: [
        { node: 'hq-fw01', toward: [{ group: 'tyo1' }] },
        { node: 'hq-fw02', toward: [{ group: 'tyo2' }] },
      ],
    })
  })

  it('leaves out the members of a redundancy set whose nodes go to the same place', () => {
    const yaml = `
groups: [{ id: hq }, { id: dc }]
redundancy: [{ id: fw, nodes: [fw1, fw2] }]
nodes:
  - { id: fw1, group: hq }
  - { id: fw2, group: hq }
  - { id: r, group: dc }
links:
  - endpoints: [{ node: fw1 }, { node: r }]
  - endpoints: [{ node: fw2 }, { node: r }]
`
    const e = structureOfYaml(yaml).edges.find((x) => x.group === 'hq')
    expect(e).toEqual({ group: 'hq', unit: 'fw', toward: [{ group: 'dc' }] })
  })
})
