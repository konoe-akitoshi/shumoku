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

describe('7. orientation', () => {
  const stagesOf = (yaml: string) => stagesOfYaml(yaml)
  const side = (yaml: string, s: 'physical' | 'virtual', plane = 'default') =>
    stagesOf(yaml).orientations.find((o) => o.plane === plane && o.side === s)

  it('takes as boundary points the vertices with lines on both sides', () => {
    const yaml = net({ links: 'x-a a-b b-c', virtual: ['x-a'] })
    expect(stagesOf(yaml).boundary).toEqual([u('a')])
  })

  it('lists each line nearer end first, each side measured from the boundary points', () => {
    const yaml = net({ links: 'x-a a-b b-c x-y', virtual: ['x-a', 'x-y'] })
    expect(side(yaml, 'physical')?.flows).toEqual([
      [u('a'), u('b')],
      [u('b'), u('c')],
    ])
    expect(side(yaml, 'virtual')?.flows).toEqual([
      [u('a'), u('x')],
      [u('x'), u('y')],
    ])
  })

  it('calls a line even when its ends are as near the boundary points as each other', () => {
    const o = side(net({ links: 'x-a a-b a-c b-c', virtual: ['x-a'] }), 'physical')
    expect(o?.even).toEqual([[u('b'), u('c')]])
    expect(o?.flows).toEqual([
      [u('a'), u('b')],
      [u('a'), u('c')],
    ])
  })

  it('measures the physical side by cables only, so a tunnel does not shorten it', () => {
    // d is three cables from a; the tunnel from x to d makes d a boundary point of its own.
    const yaml = net({ links: 'x-a a-b b-c c-d x-d', virtual: ['x-a', 'x-d'] })
    expect(stagesOf(yaml).boundary).toEqual([u('a'), u('d')])
    const o = side(yaml, 'physical')
    expect(o?.flows).toEqual([
      [u('a'), u('b')],
      [u('d'), u('c')],
    ])
    expect(o?.even).toEqual([[u('b'), u('c')]])
  })

  it('measures every plane of a side together', () => {
    const yaml = `
routingDomains: [{ id: wan }]
nodes:
  - { id: x }
  - { id: a }
  - { id: b }
links:
  - { endpoints: [{ node: x }, { node: b }], virtual: true }
  - endpoints: [{ node: b }, { node: a }]
  - endpoints: [{ node: a }, { routingDomain: wan }]
`
    expect(side(yaml, 'physical', 'wan')?.flows).toEqual([[u('a'), 'routingDomain:wan']])
  })

  it('lists nothing when no vertex has lines on both sides', () => {
    const yaml = net({ links: 'a-b b-c' })
    expect(stagesOf(yaml).boundary).toEqual([])
    expect(side(yaml, 'physical')?.flows).toEqual([])
    expect(side(yaml, 'physical')?.even).toEqual([])
  })

  it('names the vertices by the units, so a folded pair counts as one', () => {
    const yaml = `${net({ links: 'x-f1 x-f2 f1-s f2-s', virtual: ['x-f1', 'x-f2'] })}
redundancy:
  - { id: fw, nodes: [f1, f2] }
`
    expect(side(yaml, 'physical')?.flows).toEqual([[u('fw'), u('s')]])
    expect(side(yaml, 'virtual')?.flows).toEqual([[u('fw'), u('x')]])
  })

  it('reaches the structure with the side and the boundary points', () => {
    const s = structureOfYaml(net({ links: 'x-a a-b', virtual: ['x-a'] }))
    expect(s.boundary).toEqual([{ unit: 'a' }])
    expect(s.planes.map((p) => [p.plane, p.side, p.flows])).toEqual([
      ['default', 'physical', [[{ unit: 'a' }, { unit: 'b' }]]],
      ['default', 'virtual', [[{ unit: 'a' }, { unit: 'x' }]]],
    ])
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
