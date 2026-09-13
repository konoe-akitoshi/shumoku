import { expect, test } from 'bun:test'
import { loadTest6Seed } from '../test/test6'
import type { UpstreamGraph } from './upstream'
import { detectUpstream } from './upstream'

function graphOf(
  edges: readonly (readonly [string, string])[],
  isolated: readonly string[] = [],
): UpstreamGraph {
  return {
    nodes: [...new Set([...edges.flat(), ...isolated])].map((id) => ({ id })),
    links: edges.map(([source, target]) => ({ source, target })),
  }
}

const redundantCore: readonly (readonly [string, string])[] = [
  ['a', 'h'],
  ['b', 'h'],
  ['h', 'x'],
  ['h', 'y'],
  ['x', 'r1'],
  ['y', 'r1'],
  ['x', 'r2'],
  ['y', 'r2'],
]

test('all top-voted candidates become roots with multi-source distances', () => {
  const result = detectUpstream(graphOf(redundantCore))
  expect(result.roots).toEqual(['r1', 'r2'])
  expect(result.distances).toEqual({ a: 3, b: 3, h: 2, x: 1, y: 1, r1: 0, r2: 0 })
  expect(result.unresolved).toEqual([])
})

test('link direction, duplicates and input order do not change the result', () => {
  const shuffled = graphOf(
    [...redundantCore, itemOf(redundantCore, 0)]
      .reverse()
      .map(([source, target]) => [target, source] as const),
  )
  expect(detectUpstream({ ...shuffled, nodes: [...shuffled.nodes].reverse() })).toEqual(
    detectUpstream(graphOf(redundantCore)),
  )
})

test('components are analyzed separately and isolated nodes stay unresolved', () => {
  const copy = redundantCore.map(([source, target]) => [`z-${source}`, `z-${target}`] as const)
  expect(detectUpstream(graphOf([...redundantCore, ...copy])).roots).toEqual([
    'r1',
    'r2',
    'z-r1',
    'z-r2',
  ])
  const withIsolated = detectUpstream(graphOf(redundantCore, ['isolated']))
  expect(withIsolated.unresolved).toHaveLength(1)
  expect(withIsolated.unresolved[0]?.unresolvedReason).toBe('no-endpoints')
  expect(withIsolated.distances['isolated']).toBeNull()
})

test('a leafless ring has no endpoints and therefore no root', () => {
  const ring = detectUpstream(
    graphOf([
      ['a', 'b'],
      ['b', 'c'],
      ['c', 'a'],
    ]),
  )
  expect(ring.roots).toEqual([])
  expect(ring.components[0]?.unresolvedReason).toBe('no-endpoints')
})

test('more endpoints on one attachment do not add votes', () => {
  const original = detectUpstream(graphOf(redundantCore))
  const fanned = detectUpstream(
    graphOf([
      ...redundantCore,
      ...Array.from({ length: 100 }, (_, index) => [`leaf-${index}`, 'h'] as const),
    ]),
  )
  expect(fanned.roots).toEqual(original.roots)
  expect(fanned.components[0]?.candidates).toEqual(original.components[0]?.candidates)
  expect(fanned.components[0]?.attachments).toHaveLength(1)
})

test('zero votes never promote a central node', () => {
  const star = detectUpstream(
    graphOf([
      ['a', 'h'],
      ['b', 'h'],
    ]),
  )
  expect(star.roots).toEqual([])
  expect(star.components[0]?.unresolvedReason).toBe('no-positive-votes')
})

test('unknown link endpoints are rejected', () => {
  expect(() =>
    detectUpstream({ nodes: [{ id: 'a' }], links: [{ source: 'a', target: 'missing' }] }),
  ).toThrow('Unknown link endpoint')
})

test('test6: Internet is found by structure; without it the ISPs tie with a core switch', async () => {
  const seed = await loadTest6Seed()
  const graph: UpstreamGraph = { nodes: seed.nodes, links: seed.links }
  expect(detectUpstream(graph).roots).toEqual(['test:internet'])

  const removed = detectUpstream({
    nodes: seed.nodes.filter((node) => node.id !== 'test:internet'),
    links: seed.links.filter(
      (link) => link.source !== 'test:internet' && link.target !== 'test:internet',
    ),
  })
  expect(removed.roots).toEqual(['discovered:43', 'test:isp-a', 'test:isp-b'])
  expect(removed.components[0]?.attachments).toHaveLength(9)
  expect(
    removed.components[0]?.candidates.slice(0, 3).map(({ votes, total }) => [votes, total]),
  ).toEqual([
    [8, 9],
    [8, 9],
    [8, 9],
  ])
})

function itemOf<T>(items: readonly T[], index: number): T {
  const item = items[index]
  if (item === undefined) throw new Error(`Missing item ${index}`)
  return item
}
