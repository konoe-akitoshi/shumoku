import { expect, test } from 'bun:test'
import type { LayoutSeed } from './model'
import { createLayoutModel } from './model'

const valid: LayoutSeed = {
  nodes: ['a', 'b', 'c'].map((id, index) => ({
    id,
    width: 80,
    height: 40,
    position: { x: index * 100, y: 0 },
    preferredOffsetX: index * 100,
  })),
  groups: [
    {
      id: 'left',
      nodeIds: ['a', 'b'],
      frame: { x: 50, y: 0, w: 300, h: 200 },
      padding: { left: 24, right: 24, top: 44, bottom: 24 },
    },
    {
      id: 'right',
      nodeIds: ['c'],
      frame: { x: 200, y: 0, w: 200, h: 200 },
      padding: { left: 24, right: 24, top: 44, bottom: 24 },
    },
  ],
  links: [
    { id: 'ab', source: 'a', target: 'b' },
    { id: 'bc', source: 'b', target: 'c' },
  ],
}

test('indexes nodes, groups and links and marks cross-group links', () => {
  const model = createLayoutModel(valid)
  expect(model.nodes.map((node) => node.group)).toEqual([0, 0, 1])
  expect(model.groups.map((group) => group.members)).toEqual([[0, 1], [2]])
  expect(model.links.map((link) => [link.source, link.target, link.crossGroup])).toEqual([
    [0, 1, false],
    [1, 2, true],
  ])
})

test('rejects inconsistent seeds', () => {
  const [first, second] = valid.groups
  if (!first || !second) throw new Error('fixture')
  expect(() =>
    createLayoutModel({ ...valid, nodes: [...valid.nodes, ...valid.nodes.slice(0, 1)] }),
  ).toThrow('Duplicate node id a')
  expect(() => createLayoutModel({ ...valid, groups: [first] })).toThrow('belongs to no group')
  expect(() =>
    createLayoutModel({ ...valid, groups: [first, { ...second, nodeIds: ['c', 'a'] }] }),
  ).toThrow('more than one group')
  expect(() =>
    createLayoutModel({ ...valid, links: [{ id: 'loop', source: 'a', target: 'a' }] }),
  ).toThrow('self-loop')
  expect(() =>
    createLayoutModel({ ...valid, links: [{ id: 'x', source: 'a', target: 'missing' }] }),
  ).toThrow('Unknown node missing')
})
