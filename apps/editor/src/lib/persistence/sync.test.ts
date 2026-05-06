// Diff-based sync tests. Asserts that the snapshot diff produces
// the right upserts/deletes per kind so commit-time IDB writes are
// scoped to actually-changed entities.

import type { Link, Node, Subgraph } from '@shumoku/core'
import { expect, test } from 'vitest'
import type { Product, Scene } from '../types'
import type { ProjectSnapshot } from '../undo.svelte'
import { diffSize, diffSnapshots } from './sync'

function snap(parts: Partial<ProjectSnapshot> = {}): ProjectSnapshot {
  return {
    nodes: parts.nodes ?? [],
    subgraphs: parts.subgraphs ?? [],
    links: parts.links ?? [],
    products: parts.products ?? [],
    scenes: parts.scenes ?? [],
  }
}

const node = (id: string, label = id): Node => ({ id, label }) as Node
const link = (id: string): Link => ({ id, from: { node: 'a' }, to: { node: 'b' } }) as Link
const sg = (id: string): Subgraph => ({ id, label: id }) as Subgraph
const product = (id: string): Product =>
  ({ id, kind: 'device', spec: { kind: 'hardware' } }) as Product
const scene = (id: string): Scene => ({ id, name: id, nodePlacements: [], wireRoutes: [] })

test('empty diff is a no-op', () => {
  expect(diffSize(diffSnapshots(snap(), snap()))).toBe(0)
})

test('detects upserts of newly-added entities across all kinds', () => {
  const before = snap()
  const after = snap({
    nodes: [['n1', node('n1')]],
    subgraphs: [['sg1', sg('sg1')]],
    links: [link('l1')],
    products: [product('p1')],
    scenes: [scene('s1')],
  })
  const d = diffSnapshots(before, after)
  expect(d.nodes.upserts.map((u) => u.id)).toEqual(['n1'])
  expect(d.subgraphs.upserts.map((u) => u.id)).toEqual(['sg1'])
  expect(d.links.upserts.map((u) => u.id)).toEqual(['l1'])
  expect(d.products.upserts.map((u) => u.id)).toEqual(['p1'])
  expect(d.scenes.upserts.map((u) => u.id)).toEqual(['s1'])
})

test('reference-equal entities are not re-upserted', () => {
  const n = node('n1')
  const before = snap({ nodes: [['n1', n]] })
  const after = snap({ nodes: [['n1', n]] })
  const d = diffSnapshots(before, after)
  expect(d.nodes.upserts).toEqual([])
  expect(d.nodes.deletes).toEqual([])
})

test('changed entity content (new reference) is upserted', () => {
  const before = snap({ nodes: [['n1', node('n1', 'old')]] })
  const after = snap({ nodes: [['n1', node('n1', 'new')]] })
  const d = diffSnapshots(before, after)
  expect(d.nodes.upserts.map((u) => u.id)).toEqual(['n1'])
  expect(d.nodes.deletes).toEqual([])
})

test('removed entities are deleted', () => {
  const before = snap({ nodes: [['n1', node('n1')]], links: [link('l1')] })
  const after = snap()
  const d = diffSnapshots(before, after)
  expect(d.nodes.deletes).toEqual(['n1'])
  expect(d.links.deletes).toEqual(['l1'])
})

test('upsert + delete in one pass', () => {
  const before = snap({ nodes: [['n1', node('n1')]] })
  const after = snap({ nodes: [['n2', node('n2')]] })
  const d = diffSnapshots(before, after)
  expect(d.nodes.upserts.map((u) => u.id)).toEqual(['n2'])
  expect(d.nodes.deletes).toEqual(['n1'])
  expect(diffSize(d)).toBe(2)
})
