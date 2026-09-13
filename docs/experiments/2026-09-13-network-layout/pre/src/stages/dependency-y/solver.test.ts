import { expect, test } from 'bun:test'
import type { DifferenceConstraint, Spring } from './solver'
import { GROUND, solveSpringSystem } from './solver'

const options = { maxIterations: 20000, tolerance: 1e-7 }
const anchor: DifferenceConstraint = { from: GROUND, to: 0, min: 0, max: 0, kind: 'anchor' }
const children: Spring[] = [1, 2].map((to) => ({
  from: 0,
  to,
  target: 70,
  weight: 1,
  kind: 'dependency',
}))

test('equal dependencies yield equal Y without any sibling alignment term', () => {
  const result = solveSpringSystem([0, -240, 330], children, [anchor], options)
  expect(result.values[0]).toBeCloseTo(0, 6)
  expect(result.values[1]).toBeCloseTo(70, 6)
  expect(result.values[2]).toBeCloseTo(70, 6)
  expect(result.energyAfter).toBeLessThan(1e-10)
})

test('an extra wire spring moves only the child it acts on', () => {
  const wire: Spring = { from: GROUND, to: 2, target: 100, weight: 1, kind: 'wire' }
  const result = solveSpringSystem([0, 70, 70], [...children, wire], [anchor], options)
  expect(result.values[1]).toBeCloseTo(70, 6)
  expect(result.values[2]).toBeCloseTo(85, 6)
})

test('a lane clearance pushes one child without dragging its sibling', () => {
  const wire: Spring = { from: GROUND, to: 3, target: 60, weight: 1, kind: 'wire' }
  const clearance: DifferenceConstraint = { from: 3, to: 2, min: 30, kind: 'lane-node' }
  const result = solveSpringSystem(
    [0, 70, 70, 30],
    [...children, wire],
    [anchor, clearance],
    options,
  )
  expect(result.values[1]).toBeCloseTo(70, 5)
  expect(result.values[2]).toBeCloseTo(80, 5)
  expect(result.values[3]).toBeCloseTo(50, 5)
  expect(solveSpringSystem([4], [], [anchor], options).values[0]).toBeCloseTo(0, 6)
})

test('an unanchored free variable is rejected', () => {
  expect(() => solveSpringSystem([0, 5], [], [anchor], options)).toThrow('without an anchor')
})
