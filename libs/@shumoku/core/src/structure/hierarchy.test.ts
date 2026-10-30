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

describe('4. orientation', () => {
  const side = (yaml: string, boundary: string[], s: 'physical' | 'virtual', plane = 'default') =>
    stagesOfYaml(yaml, { boundary }).orientations.find((o) => o.plane === plane && o.side === s)

  it('offers as candidates the vertices with lines on both sides', () => {
    const yaml = net({ links: 'x-a a-b b-c b-y', virtual: ['x-a', 'b-y'] })
    expect(stagesOfYaml(yaml).candidates).toEqual([u('a'), u('b')])
  })

  it('measures nothing from the boundary when none is given', () => {
    const yaml = net({ links: 'x-a a-b b-c', virtual: ['x-a'] })
    expect(stagesOfYaml(yaml).boundary).toEqual([])
    expect(side(yaml, [], 'physical')?.flows).toEqual([])
    // Only the line from the ground a out to the space x: it does not start at a boundary point.
    expect(side(yaml, [], 'virtual')?.flows).toEqual([[u('a'), u('x')]])
    const laid = net({ links: 'a-b b-c a-c', virtual: ['a-c'] })
    expect(side(laid, [], 'virtual')?.flows).toEqual([])
  })

  it('lists each line nearer end first, each side measured from the given boundary', () => {
    const yaml = net({ links: 'x-a a-b b-c x-y', virtual: ['x-a', 'x-y'] })
    expect(side(yaml, ['a'], 'physical')?.flows).toEqual([
      [u('a'), u('b')],
      [u('b'), u('c')],
    ])
    expect(side(yaml, ['a'], 'virtual')?.flows).toEqual([
      [u('a'), u('x')],
      [u('x'), u('y')],
    ])
  })

  it('calls a line even when its ends are as near the boundary as each other', () => {
    const o = side(net({ links: 'x-a a-b a-c b-c', virtual: ['x-a'] }), ['a'], 'physical')
    expect(o?.even).toEqual([[u('b'), u('c')]])
    expect(o?.flows).toEqual([
      [u('a'), u('b')],
      [u('a'), u('c')],
    ])
  })

  it('leaves out a virtual line laid over the network: its far end has cables and is not given', () => {
    // x is beyond the boundary at a; the tunnel from c to x rides over the cables a-b-c.
    const yaml = net({ links: 'x-a a-b b-c c-x', virtual: ['x-a', 'c-x'] })
    expect(stagesOfYaml(yaml).candidates).toEqual([u('a'), u('c')])
    expect(side(yaml, ['a'], 'virtual')?.flows).toEqual([[u('a'), u('x')]])
    expect(side(yaml, ['a'], 'physical')?.flows).toEqual([
      [u('a'), u('b')],
      [u('b'), u('c')],
    ])
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
    expect(side(yaml, ['b'], 'physical', 'wan')?.flows).toEqual([[u('a'), 'routingDomain:wan']])
  })

  it('takes a node by its unit, a segment or a routing domain, and refuses an unknown id', () => {
    const yaml = `${net({ links: 'x-f1 x-f2 f1-s f2-s', virtual: ['x-f1', 'x-f2'] })}
redundancy:
  - { id: fw, nodes: [f1, f2] }
`
    expect(stagesOfYaml(yaml, { boundary: ['f1'] }).boundary).toEqual([u('fw')])
    expect(side(yaml, ['f2'], 'physical')?.flows).toEqual([[u('fw'), u('s')]])
    expect(side(yaml, ['f2'], 'virtual')?.flows).toEqual([[u('fw'), u('x')]])
    expect(() => stagesOfYaml(yaml, { boundary: ['nope'] })).toThrow(/nope/)
  })

  it('reaches the structure with the candidates, the boundary and the sides', () => {
    const s = structureOfYaml(net({ links: 'x-a a-b', virtual: ['x-a'] }), { boundary: ['a'] })
    expect(s.candidates).toEqual([{ unit: 'a' }])
    expect(s.boundary).toEqual([{ unit: 'a' }])
    expect(s.planes.map((p) => [p.plane, p.side, p.flows])).toEqual([
      ['default', 'physical', [[{ unit: 'a' }, { unit: 'b' }]]],
      ['default', 'virtual', [[{ unit: 'a' }, { unit: 'x' }]]],
    ])
  })
})

describe('4. orientation, beyond the boundary', () => {
  const side = (yaml: string, boundary: string[], s: 'physical' | 'virtual') =>
    stagesOfYaml(yaml, { boundary }).orientations.find((o) => o.plane === 'default' && o.side === s)

  it('puts a space that only a ground leaves beyond that ground', () => {
    // g is the boundary's neighbour, x hangs off g by a virtual line and has no cable.
    const yaml = net({ links: 'b-g x-g', virtual: ['x-g'] })
    expect(side(yaml, ['b'], 'virtual')?.flows).toEqual([[u('g'), u('x')]])
    expect(side(yaml, ['b'], 'virtual')?.even).toEqual([])
  })

  it('measures a chain of spaces outward from the ground', () => {
    const yaml = net({ links: 'b-g g-x x-y', virtual: ['g-x', 'x-y'] })
    expect(side(yaml, ['b'], 'virtual')?.flows).toEqual([
      [u('g'), u('x')],
      [u('x'), u('y')],
    ])
  })

  it('takes the nearest ground when a space joins two', () => {
    const yaml = net({ links: 'b-g1 b-g2 g1-x g2-x', virtual: ['g1-x', 'g2-x'] })
    expect(side(yaml, ['b'], 'virtual')?.flows).toEqual([
      [u('g1'), u('x')],
      [u('g2'), u('x')],
    ])
  })

  it('leaves a virtual line between two grounds out, as a line laid over the cables', () => {
    const yaml = net({ links: 'b-g1 g1-g2 g2-g3 g1-g3', virtual: ['g1-g3'] })
    expect(side(yaml, ['b'], 'virtual')?.flows).toEqual([])
    expect(side(yaml, ['b'], 'virtual')?.even).toEqual([])
  })

  it('does not put two grounds that leave for the same space at the same height', () => {
    // g1 and g2 both stand at 0 against x, but the line between them is a cable, not virtual.
    const yaml = net({ links: 'b-g1 g1-g2 g2-x', virtual: ['g2-x'] })
    expect(side(yaml, ['b'], 'virtual')?.flows).toEqual([[u('g2'), u('x')]])
  })

  it('leaves spaces that no ground joins without a distance', () => {
    const yaml = net({ links: 'b-g p-q', virtual: ['p-q'] })
    expect(side(yaml, ['b'], 'virtual')?.flows).toEqual([])
    expect(side(yaml, ['b'], 'virtual')?.even).toEqual([])
  })

  it('does not change what the boundary points already reach', () => {
    // x is reached from the boundary a, so the line from the ground c to x is still laid over.
    const yaml = net({ links: 'x-a a-b b-c c-x', virtual: ['x-a', 'c-x'] })
    expect(side(yaml, ['a'], 'virtual')?.flows).toEqual([[u('a'), u('x')]])
  })

  it('only adds lines to the physical side and the lines already listed', () => {
    const yaml = net({ links: 'b-g x-g y-g', virtual: ['x-g', 'y-g'] })
    const before = stagesOfYaml(yaml, { boundary: ['b'] }).orientations
    expect(before.find((o) => o.side === 'physical')?.flows).toEqual([[u('b'), u('g')]])
  })
})
