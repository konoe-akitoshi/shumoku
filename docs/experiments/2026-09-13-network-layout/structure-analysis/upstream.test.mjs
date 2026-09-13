import { expect, test } from 'bun:test'
import { dependencyUpstream, detectUpstream } from './upstream.mjs'

const makeGraph = (edges, extra = []) => ({
  nodes: [...new Set([...edges.flat(), ...extra])].map((id) => ({ id })),
  links: edges.map(([a, b]) => ({ from: { node: a }, to: { node: b } })),
})
const edges = [
  ['a', 'h'],
  ['b', 'h'],
  ['h', 'x'],
  ['h', 'y'],
  ['x', 'r1'],
  ['y', 'r1'],
  ['x', 'r2'],
  ['y', 'r2'],
]

test('multiple candidates are all roots with multi-source distances', () => {
  const result = detectUpstream(makeGraph(edges))
  expect(result.roots).toEqual(['r1', 'r2'])
  expect(result.distances).toEqual({ a: 3, b: 3, h: 2, x: 1, y: 1, r1: 0, r2: 0 })
  expect(result.unresolved).toEqual([])
})

test('directions, duplicate edges, roles and ordering do not select a root', () => {
  const raw = makeGraph([...edges, edges[0]].reverse().map(([a, b]) => [b, a]))
  raw.nodes.reverse()
  expect(detectUpstream(raw)).toEqual(detectUpstream(makeGraph(edges)))
})

test('disconnected components and leafless components are reported separately', () => {
  const other = edges.map(([a, b]) => [`z-${a}`, `z-${b}`])
  expect(detectUpstream(makeGraph([...edges, ...other])).roots).toEqual([
    'r1',
    'r2',
    'z-r1',
    'z-r2',
  ])
  const result = detectUpstream(makeGraph(edges, ['isolated']))
  expect(result.unresolved).toHaveLength(1)
  expect(result.distances.isolated).toBeNull()
  expect(
    detectUpstream(
      makeGraph([
        ['a', 'b'],
        ['b', 'c'],
        ['c', 'a'],
      ]),
    ).roots,
  ).toEqual([])
})

test('fixture detects Internet by connections, not its identifier', async () => {
  const raw = await Bun.file(
    new URL('../archive/tmp-test6-complete-upstream-to-ap.json', import.meta.url),
  ).json()
  expect(detectUpstream(raw).roots).toEqual(['test:internet'])
  const rename = (id) => (id === 'test:internet' ? 'anonymous-root' : id)
  const renamed = {
    nodes: raw.nodes.map((n) => ({ id: rename(n.id) })),
    links: raw.links.map((l) => ({
      from: { node: rename(l.from.node) },
      to: { node: rename(l.to.node) },
    })),
  }
  expect(detectUpstream(renamed).roots).toEqual(['anonymous-root'])
  const removed = {
    nodes: raw.nodes.filter((n) => n.id !== 'test:internet'),
    links: raw.links.filter(
      (l) => l.from.node !== 'test:internet' && l.to.node !== 'test:internet',
    ),
  }
  const result = detectUpstream(removed)
  expect(result.roots).toEqual(['discovered:43', 'test:isp-a', 'test:isp-b'])
  expect(result.components[0].sourceGroups).toHaveLength(9)
  expect(
    result.components[0].candidates
      .slice(0, 3)
      .map((candidate) => [candidate.votes, candidate.total]),
  ).toEqual([
    [8, 9],
    [8, 9],
    [8, 9],
  ])
  for (const root of result.roots) expect(result.distances[root]).toBe(0)
  const indices = new Map(removed.nodes.map((node, index) => [node.id, index]))
  expect(
    dependencyUpstream({
      nodes: removed.nodes,
      links: removed.links.map((link) => ({
        a: indices.get(link.from.node),
        b: indices.get(link.to.node),
      })),
    }).roots,
  ).toEqual(result.roots)
})

test('adding sibling endpoints does not multiply the attachment vote', () => {
  const original = detectUpstream(makeGraph(edges))
  const expanded = detectUpstream(
    makeGraph([...edges, ...Array.from({ length: 100 }, (_, i) => [`leaf-${i}`, 'h'])]),
  )
  expect(expanded.roots).toEqual(original.roots)
  expect(expanded.components[0].candidates).toEqual(original.components[0].candidates)
  expect(expanded.components[0].sourceGroups).toHaveLength(1)
})

test('zero scores do not silently select a central node', () => {
  const result = detectUpstream(
    makeGraph([
      ['a', 'h'],
      ['b', 'h'],
    ]),
  )
  expect(result.roots).toEqual([])
  expect(result.components[0].reason).toBe('no-positive-votes')
})

test('layout adapter retains unknown upstream without fabricating roots', () => {
  const result = dependencyUpstream({ nodes: [{ id: 'a' }, { id: 'b' }], links: [{ a: 0, b: 1 }] })
  expect(result.roots).toEqual([])
  expect(result.distances).toEqual({ a: null, b: null })
  expect(result.unresolved).toHaveLength(1)
})

test('invalid link input is still rejected', () => {
  expect(() => dependencyUpstream({ nodes: [{ id: 'a' }], links: [{ a: 0, b: 9 }] })).toThrow(
    'Unknown link endpoint',
  )
})
