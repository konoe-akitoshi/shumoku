import { describe, expect, it } from 'vitest'
import { stagesOfYaml, structureOfYaml } from './fixtures.js'

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

describe('7. orientation', () => {
  const orientation = (yaml: string, plane = 'default') =>
    stagesOfYaml(yaml).orientations.find((o) => o.plane === plane)

  it('runs each line away from the vertices with no place', () => {
    const o = orientation(net({ links: 'x-a a-b b-c', groups: G, in: placedIn('g', 'a b c') }))
    expect(o?.outside).toEqual([u('x')])
    expect(o?.above).toEqual([
      [u('a'), u('b')],
      [u('x'), u('a')],
      [u('b'), u('c')],
    ])
    expect(o?.beside).toEqual([])
  })

  it('puts a line beside when its ends are as far from the outside as each other', () => {
    const o = orientation(
      net({ links: 'x-a x-b a-b a-c b-c', groups: G, in: placedIn('g', 'a b c') }),
    )
    expect(o?.beside).toEqual([[u('a'), u('b')]])
    expect(o?.above).toContainEqual([u('a'), u('c')])
    expect(o?.above).toContainEqual([u('b'), u('c')])
  })

  it('counts a virtual line as longer than any way over cables', () => {
    // c is reached from x by a tunnel and by three cables; the cables decide.
    const o = orientation(
      net({
        links: 'x-a a-b b-c x-c',
        groups: G,
        in: placedIn('g', 'a b c'),
        virtual: ['x-c'],
      }),
    )
    expect(o?.above).toContainEqual([u('b'), u('c')])
    expect(o?.above).toContainEqual([u('x'), u('c')])
  })

  it('takes a routing domain as outside', () => {
    const yaml = `
groups: [{ id: g }]
routingDomains: [{ id: wan }]
nodes:
  - { id: a, group: g }
  - { id: b, group: g }
links:
  - endpoints: [{ node: a }, { routingDomain: wan }]
  - endpoints: [{ node: a }, { node: b }]
`
    expect(orientation(yaml, 'wan')?.above).toEqual([['routingDomain:wan', u('a')]])
  })

  it("enters a plane with no outside of its own where it meets another plane's outside", () => {
    const yaml = `
groups: [{ id: g }]
routingDomains: [{ id: wan }]
nodes:
  - { id: a, group: g }
  - { id: b, group: g }
links:
  - endpoints: [{ node: a }, { routingDomain: wan }]
  - endpoints: [{ node: a }, { node: b }]
`
    const o = orientation(yaml)
    expect(o?.outside).toEqual([u('a')])
    expect(o?.above).toEqual([[u('a'), u('b')]])
  })

  it('keeps each plane to its own lines, so a shortcut in another plane does not count', () => {
    // b is two cables below the edge in the default plane, though one line from wan.
    const yaml = `
groups: [{ id: g }]
routingDomains: [{ id: wan }]
nodes:
  - { id: x }
  - { id: a, group: g }
  - { id: b, group: g }
links:
  - endpoints: [{ node: x }, { node: a }]
  - endpoints: [{ node: a }, { node: b }]
  - endpoints: [{ node: b }, { routingDomain: wan }]
`
    expect(orientation(yaml)?.above).toEqual([
      [u('a'), u('b')],
      [u('x'), u('a')],
    ])
  })

  it('leaves out the lines the outside does not reach', () => {
    const o = orientation(net({ links: 'a-b b-c', groups: G, in: placedIn('g', 'a b c') }))
    expect(o?.outside).toEqual([])
    expect(o?.above).toEqual([])
    expect(o?.beside).toEqual([])
  })

  it('names the vertices by the units, so a folded pair runs as one', () => {
    const yaml = `${net({ links: 'x-f1 x-f2 f1-s f2-s', groups: G, in: placedIn('g', 'f1 f2 s') })}
redundancy:
  - { id: fw, nodes: [f1, f2] }
`
    expect(orientation(yaml)?.above).toEqual([
      [u('fw'), u('s')],
      [u('x'), u('fw')],
    ])
  })

  it('reaches the structure as pairs of vertices', () => {
    const p = structureOfYaml(net({ links: 'x-a x-b a-b', groups: G, in: placedIn('g', 'a b') }))
      .planes[0]
    expect(p?.above).toEqual([
      [{ unit: 'x' }, { unit: 'a' }],
      [{ unit: 'x' }, { unit: 'b' }],
    ])
    expect(p?.beside).toEqual([[{ unit: 'a' }, { unit: 'b' }]])
  })
})

describe('8. edges of a place', () => {
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
