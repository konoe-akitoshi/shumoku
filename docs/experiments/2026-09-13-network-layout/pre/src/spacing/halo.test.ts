import { expect, test } from 'bun:test'
import { SIDES } from '../geometry/types'
import { areaHalo, directionalHalo } from './halo'

const box = { x: 20, y: 30, w: 132, h: 48 }

test('the band area equals ratio × sqrt(1 + connections) × painted area, corners included', () => {
  const painted = 133 * 49
  for (const counts of [
    { left: 0, right: 0, top: 0, bottom: 0 },
    { left: 0, right: 0, top: 0, bottom: 20 },
    { left: 4, right: 8, top: 2, bottom: 10 },
  ])
    for (const ratio of [0, 0.01, 0.1, 1]) {
      const halo = directionalHalo(box, 1, ratio, counts)
      const connections = counts.left + counts.right + counts.top + counts.bottom
      expect(halo.effectiveRatio).toBeCloseTo(ratio * Math.sqrt(1 + connections), 10)
      expect(halo.box.w * halo.box.h - painted).toBeCloseTo(painted * halo.effectiveRatio, 7)
      const base = areaHalo(box, 1, ratio)
      for (const side of SIDES) {
        expect(halo.sides[side]).toBeGreaterThanOrEqual(base.thickness)
        if (counts[side] === 0) expect(halo.sides[side]).toBe(base.thickness)
      }
    }
})

test('the connection surplus follows connections per edge length and scales with the box', () => {
  const counts = { left: 2, right: 4, top: 1, bottom: 3 }
  const halo = directionalHalo(box, 1, 0.1, counts)
  const surplus = (side: 'left' | 'right' | 'top' | 'bottom') =>
    halo.sides[side] - halo.baseThickness
  expect(surplus('right') / surplus('left')).toBeCloseTo(2)
  expect(surplus('bottom') / surplus('top')).toBeCloseTo(3)

  const doubled = directionalHalo({ x: 40, y: 60, w: 264, h: 96 }, 2, 0.1, counts)
  for (const side of SIDES) expect(doubled.sides[side]).toBeCloseTo(halo.sides[side] * 2, 9)
})

test('a busy bottom side shifts the halo box center downward', () => {
  const halo = directionalHalo(box, 1, 0.1, { left: 0, right: 0, top: 0, bottom: 20 })
  expect(halo.sides.bottom).toBeGreaterThan(halo.sides.top)
  expect(halo.box.x).toBe(box.x)
  expect(halo.box.y).toBeGreaterThan(box.y)
})

test('invalid counts and sizes are rejected', () => {
  expect(() => directionalHalo(box, 1, 0.1, { left: -1, right: 0, top: 0, bottom: 0 })).toThrow()
  expect(() => areaHalo({ w: 0, h: 10 }, 1, 0.1)).toThrow()
})
