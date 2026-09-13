import { expect, test } from 'bun:test'
import { allocateLanes, splitAtRowGaps } from './wire-channels'

const span = (id: string, left: number, right: number) => ({
  id,
  link: 0,
  part: 'internal' as const,
  left,
  right,
})

test('disjoint spans share one lane and keep their original paths', () => {
  const requests = [span('a', 0, 10), span('b', 20, 30), span('c', 40, 50)]
  const untouched = structuredClone(requests)
  const allocation = allocateLanes(requests, 4)
  expect(allocation.laneCount).toBe(1)
  expect(allocation.requiredHeight).toBe(4)
  expect(allocation.spans.every((s) => s.routing === 'preserved')).toBe(true)
  expect(requests).toEqual(untouched)
})

test('overlapping spans need one lane each and are routed onto them', () => {
  const allocation = allocateLanes([span('a', 0, 10), span('b', 0, 10), span('c', 0, 10)], 4)
  expect(allocation.laneCount).toBe(3)
  expect(allocation.requiredHeight).toBe(12)
  expect(allocation.spans.map((s) => s.lane)).toEqual([0, 1, 2])
  expect(allocation.spans.every((s) => s.routing === 'lane')).toBe(true)
  expect(allocateLanes([], 4).requiredHeight).toBe(0)
})

test('spans closer than one pitch get separate lanes even without overlapping', () => {
  const close = allocateLanes([span('a', 0, 10), span('b', 13, 20)], 4)
  expect(close.laneCount).toBe(2)
  expect(close.spans.every((s) => s.routing === 'lane')).toBe(true)

  const apart = allocateLanes([span('a', 0, 10), span('b', 14, 20)], 4)
  expect(apart.laneCount).toBe(1)
  expect(apart.spans.every((s) => s.routing === 'preserved')).toBe(true)
})

test('paths are cut exactly at gap boundaries; row portions are labeled -1', () => {
  const path = [
    { x: 0, y: 0 },
    { x: 20, y: 20 },
  ]
  const pieces = splitAtRowGaps(path, [{ top: 5, bottom: 15 }])
  expect(pieces.map((piece) => piece.gap)).toEqual([-1, 0, -1])
  expect(pieces[1]?.points).toEqual([
    { x: 5, y: 5 },
    { x: 15, y: 15 },
  ])
})

test('consecutive segments inside one gap merge into one piece', () => {
  const path = [
    { x: 0, y: 6 },
    { x: 10, y: 6 },
    { x: 10, y: 8 },
  ]
  const pieces = splitAtRowGaps(path, [{ top: 5, bottom: 15 }])
  expect(pieces).toEqual([{ gap: 0, points: path }])
})
