import { ROOT_FRAME } from '@shumoku/core'
import type { Scene } from '@shumoku/renderer'
import { expect, test } from 'vitest'
import { liveOrder, readDrop } from './order-hints'

const box = (x: number, y: number, width = 100, height = 60) => ({ x, y, width, height })

/** Two groups side by side, each with two nodes, and a node at the top level. */
const scene = {
  nodes: [
    { node: { id: 'a', parent: 'g1' }, box: box(10, 10) },
    { node: { id: 'b', parent: 'g1' }, box: box(130, 10) },
    { node: { id: 'c', parent: 'g2' }, box: box(410, 10) },
    { node: { id: 'd', parent: 'g2' }, box: box(530, 10) },
    { node: { id: 'top' }, box: box(250, 400) },
    { node: { id: 'wp', parent: 'g1', termination: { role: 'eps' } }, box: box(0, 0) },
  ],
  groups: [
    { group: { id: 'g1' }, box: box(0, 0, 260, 100) },
    { group: { id: 'g2' }, box: box(400, 0, 260, 100) },
  ],
  wires: [],
  bounds: box(0, 0, 700, 500),
} as unknown as Scene

test('a drop within the group reorders its siblings left to right', () => {
  const r = readDrop(scene, undefined, { id: 'a', type: 'node', box: box(200, 10) })
  expect(r.parent).toBe('g1')
  expect(r.order).toEqual({ g1: ['b', 'a'] })
})

test('a drop into another group changes its membership and orders both frames', () => {
  const r = readDrop(scene, undefined, { id: 'a', type: 'node', box: box(480, 10) })
  expect(r.parent).toBe('g2')
  expect(Object.keys(r.order)).toEqual(['g2'])
  expect(r.order.g2).toEqual(['c', 'a', 'd'])
})

test('a drop outside every group goes to the top level', () => {
  const r = readDrop(scene, undefined, { id: 'a', type: 'node', box: box(0, 300) })
  expect(r.parent).toBeUndefined()
  expect(r.order[ROOT_FRAME]).toEqual(['a', 'g1', 'top', 'g2'])
})

test('a group cannot be dropped into itself, and keeps untouched frames', () => {
  const r = readDrop(
    scene,
    { g2: ['d', 'c'] },
    { id: 'g1', type: 'subgraph', box: box(20, 10, 260, 100) },
  )
  expect(r.parent).toBeUndefined()
  expect(r.order.g2).toEqual(['d', 'c'])
})

test('hints naming nothing that remains are dropped', () => {
  expect(
    liveOrder({ g1: ['a', 'x'], gone: ['a', 'b'], '': ['a', 'g1'] }, new Set(['a', 'g1'])),
  ).toEqual({
    '': ['a', 'g1'],
  })
  expect(liveOrder(undefined, new Set())).toBeUndefined()
})
