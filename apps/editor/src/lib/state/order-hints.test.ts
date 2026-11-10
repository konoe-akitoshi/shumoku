import type { Arrangement } from '@shumoku/core'
import type { Scene } from '@shumoku/renderer'
import { expect, test } from 'vitest'
import { readDrop, slotAt } from './order-hints'

const box = (x: number, y: number, width = 100, height = 60) => ({ x, y, width, height })

/**
 * Two groups side by side. g1 holds a over b and c (two rows), and a node that sits on no flow;
 * g2 holds c2 and d. A lone node stands at the top level, and a unit of two members in g2.
 */
const scene = {
  nodes: [
    { node: { id: 'a', parent: 'g1' }, box: box(60, 10) },
    { node: { id: 'b', parent: 'g1' }, box: box(10, 110) },
    { node: { id: 'c', parent: 'g1' }, box: box(130, 110) },
    { node: { id: 'lonely', parent: 'g1' }, box: box(250, 110) },
    { node: { id: 'c2', parent: 'g2' }, box: box(410, 10) },
    { node: { id: 'd', parent: 'g2' }, box: box(530, 10) },
    { node: { id: 'u1', parent: 'g2' }, box: box(410, 110) },
    { node: { id: 'u2', parent: 'g2' }, box: box(520, 110) },
    { node: { id: 'top' }, box: box(250, 400) },
    { node: { id: 'wp', parent: 'g1', termination: { role: 'eps' } }, box: box(0, 0) },
  ],
  groups: [
    { group: { id: 'g1' }, box: box(0, 0, 380, 200) },
    { group: { id: 'g2' }, box: box(400, 0, 260, 200) },
  ],
  wires: [],
  bounds: box(0, 0, 700, 500),
} as unknown as Scene

const arrangement: Arrangement = {
  frames: {
    '': [
      { id: 'g1', kind: 'group', rows: [0, 1], movable: true },
      { id: 'top', kind: 'node', rows: [2, 2], movable: true },
      { id: 'g2', kind: 'group', rows: [0, 1], movable: true },
    ],
    g1: [
      { id: 'b', kind: 'node', rows: [1, 1], movable: true },
      { id: 'a', kind: 'node', rows: [0, 0], movable: true },
      { id: 'c', kind: 'node', rows: [1, 1], movable: true },
      { id: 'lonely', kind: 'node', rows: [1, 1], movable: false },
    ],
    g2: [
      { id: 'c2', kind: 'node', rows: [0, 0], movable: true },
      { id: 'set', kind: 'unit', rows: [1, 1], movable: true, members: ['u1', 'u2'] },
      { id: 'd', kind: 'node', rows: [0, 0], movable: true },
    ],
  },
  unmet: {},
}

const drop = (id: string, x: number, y: number, type: 'node' | 'subgraph' = 'node') => ({
  id,
  type,
  box: type === 'node' ? box(x, y) : box(x, y, 260, 200),
})

test('a drop in the original slot writes nothing', () => {
  expect(readDrop(arrangement, scene, undefined, drop('c', 135, 112))).toBeUndefined()
  // dragged up and down within its own row, still between the same neighbours
  expect(readDrop(arrangement, scene, { g1: ['b', 'c'] }, drop('c', 140, 90))).toBeUndefined()
})

test('a drop elsewhere in the row writes the order of that frame alone, sparsely', () => {
  const change = readDrop(arrangement, scene, undefined, drop('c', -20, 110))
  expect(change).toEqual({ order: { g1: ['c', 'b'] } })
  expect(change?.parent).toBeUndefined()
})

test('a drop in another row reads the neighbours of that row, not every sibling by x', () => {
  // a comes down beside b and c: after b, before c, in the frame's one order
  const change = readDrop(arrangement, scene, undefined, drop('a', 70, 110))
  expect(change).toEqual({ order: { g1: ['b', 'a', 'c'] } })
})

test('the merge keeps what the list already says, ids that are gone included', () => {
  const change = readDrop(arrangement, scene, { g1: ['gone', 'b', 'c'] }, drop('a', 70, 110))
  expect(change?.order).toEqual({ g1: ['gone', 'b', 'a', 'c'] })
  // a frame the drop did not touch keeps its list as it is
  const other = readDrop(arrangement, scene, { g2: ['d', 'c2'] }, drop('c', -20, 110))
  expect(other?.order).toEqual({ g2: ['d', 'c2'], g1: ['c', 'b'] })
})

test('a drop into another group is a change of parent, and the old frame lets the id go', () => {
  const change = readDrop(arrangement, scene, { g1: ['a', 'c'] }, drop('a', 470, 10))
  expect(change?.parent).toEqual({ to: 'g2' })
  expect(change?.order).toEqual({ g2: ['c2', 'a', 'd'] })
  // the top level is a parent too
  expect(readDrop(arrangement, scene, undefined, drop('a', 0, 300))?.parent).toEqual({
    to: undefined,
  })
})

test('what the structure places takes no order, only a parent', () => {
  expect(readDrop(arrangement, scene, undefined, drop('lonely', -20, 110))).toBeUndefined()
  expect(readDrop(arrangement, scene, undefined, drop('lonely', 470, 10))).toEqual({
    parent: { to: 'g2' },
  })
})

test('a unit is ordered by its set when a member is dragged', () => {
  const change = readDrop(arrangement, scene, undefined, drop('u1', 600, 10))
  expect(change?.order).toEqual({ g2: ['d', 'set'] })
})

test('a group cannot be dropped into itself, and finds its slot among its parent’s children', () => {
  const change = readDrop(arrangement, scene, undefined, drop('g1', 700, 0, 'subgraph'))
  expect(change?.parent).toBeUndefined()
  expect(change?.order).toEqual({ '': ['g2', 'g1'] })
  // over another group it becomes that group's child
  expect(readDrop(arrangement, scene, undefined, drop('g1', 450, 0, 'subgraph'))?.parent).toEqual({
    to: 'g2',
  })
})

test('the slot a pointer is over, for the one that reads it', () => {
  expect(slotAt(arrangement, scene, { id: 'a', type: 'node' }, { x: 120, y: 140 })).toEqual({
    frame: 'g1',
    row: 1,
    after: 'b',
    before: 'c',
  })
  // what the structure places is no neighbour: to the right of lonely is still after c
  expect(slotAt(arrangement, scene, { id: 'a', type: 'node' }, { x: 340, y: 140 })).toEqual({
    frame: 'g1',
    row: 1,
    after: 'c',
    before: undefined,
  })
})
