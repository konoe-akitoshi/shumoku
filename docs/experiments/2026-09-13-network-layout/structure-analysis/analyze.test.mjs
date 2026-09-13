import { expect, test } from 'bun:test'
import { analyze } from './analyze.mjs'

function graph(edges, extra = []) {
  return {
    nodes: [...new Set([...edges.flat(), ...extra])].map((id) => ({ id })),
    links: edges.map(([a, b]) => ({ from: { node: a }, to: { node: b } })),
  }
}

test('parallel links and input direction do not alter neighbor structure', () => {
  const a = analyze(
    graph([
      ['a', 'b'],
      ['b', 'c'],
    ]),
  )
  const b = analyze(
    graph([
      ['b', 'a'],
      ['c', 'b'],
      ['b', 'a'],
    ]),
  )
  expect(a.rows).toEqual(b.rows)
  expect(a.regions).toEqual(b.regions)
})

test('a chain middle lies on the leaf pair shortest path and disconnects it', () => {
  const result = analyze(
    graph([
      ['a', 'b'],
      ['b', 'c'],
    ]),
  )
  expect(result.rows.find((row) => row.id === 'b').shortestLeafPairsThrough).toBe(1)
  expect(result.regions[0].disconnectedLeafPairs).toBe(1)
})

test('leafless components do not create vacuous upstream candidates', () => {
  const result = analyze(
    graph(
      [
        ['a', 'b'],
        ['b', 'c'],
        ['c', 'a'],
      ],
      ['isolated'],
    ),
  )
  expect(result.leaves).toEqual([])
  expect(result.rows.every((row) => row.sources === 0)).toBe(true)
  expect(result.components.length).toBe(2)
})

test('disconnected components use only reachable leaves', () => {
  const result = analyze(
    graph([
      ['a', 'b'],
      ['c', 'd'],
    ]),
  )
  expect(result.connectedLeafPairs).toBe(2)
  expect(result.rows.every((row) => row.sources === 2)).toBe(true)
})

test('fixture reproduces Internet detection and its removal counterexample', async () => {
  const raw = await Bun.file(
    new URL('../archive/tmp-test6-complete-upstream-to-ap.json', import.meta.url),
  ).json()
  const snapshot = JSON.stringify(raw)
  const original = analyze(raw)
  expect(original.rows.filter((row) => row.strict === 30).map((row) => row.id)).toEqual([
    'test:internet',
  ])
  const removed = analyze({
    nodes: raw.nodes.filter((n) => n.id !== 'test:internet'),
    links: raw.links.filter(
      (l) => l.from.node !== 'test:internet' && l.to.node !== 'test:internet',
    ),
  })
  expect(removed.rows.filter((row) => row.strict === 30)).toEqual([])
  for (const id of ['test:isp-a', 'test:isp-b']) {
    const row = removed.rows.find((item) => item.id === id)
    expect(row.strict).toBe(28)
    expect(row.shortestLeafPairsThrough).toBe(0)
  }
  expect(JSON.stringify(raw)).toBe(snapshot)
})

test('relabeling and role changes have no influence', () => {
  const raw = graph([
    ['a', 'b'],
    ['b', 'c'],
  ])
  const decorated = {
    ...raw,
    nodes: raw.nodes.map((node) => ({
      ...node,
      label: 'Internet',
      metadata: { topologyRole: 'internet' },
      x: 999,
    })),
  }
  expect(analyze(raw)).toEqual(analyze(decorated))
})
