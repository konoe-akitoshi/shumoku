// bezier-path lateralOffset coverage. The path generator should:
//   - leave the existing (no-offset) shape unchanged when offset is 0
//   - shift the source endpoint perpendicular to the port's outward
//     normal when fromLateralOffset is set; same for the target
//   - leave the SOURCE x intact when only `to.lateralOffset` is set
//     (i.e. offsets are scoped to their own endpoint)
//   - produce two distinct paths for two lanes at the same port

import { expect, test } from 'vitest'
import { bezierEdgePath } from './bezier-path.js'

function parseSvgPath(d: string): number[] {
  // "M x y C cx1 cy1 cx2 cy2 ex ey" → [x, y, cx1, cy1, cx2, cy2, ex, ey]
  return d
    .replace(/[MC]/g, '')
    .trim()
    .split(/\s+/)
    .map(Number)
}

test('lateralOffset=0 matches the no-offset path verbatim', () => {
  const a = { absolutePosition: { x: 0, y: 0 }, side: 'bottom' as const }
  const b = { absolutePosition: { x: 0, y: 100 }, side: 'top' as const }
  expect(bezierEdgePath({ ...a, lateralOffset: 0 }, b)).toBe(bezierEdgePath(a, b))
})

test('positive fromLateralOffset on a bottom port shifts the source rightward', () => {
  const a = { absolutePosition: { x: 0, y: 0 }, side: 'bottom' as const }
  const b = { absolutePosition: { x: 0, y: 100 }, side: 'top' as const }
  const base = parseSvgPath(bezierEdgePath(a, b))
  const shifted = parseSvgPath(bezierEdgePath({ ...a, lateralOffset: 5 }, b))
  // Source moved right by 5; target x unchanged.
  expect(shifted[0]).toBeCloseTo((base[0] ?? 0) + 5, 5)
  expect(shifted[6]).toBeCloseTo(base[6] ?? 0, 5)
})

test('toLateralOffset on a top port shifts the target without moving the source', () => {
  const a = { absolutePosition: { x: 0, y: 0 }, side: 'bottom' as const }
  const b = { absolutePosition: { x: 0, y: 100 }, side: 'top' as const }
  const base = parseSvgPath(bezierEdgePath(a, b))
  const shifted = parseSvgPath(bezierEdgePath(a, { ...b, lateralOffset: 7 }))
  // For top ports the lateral axis is also x; sign convention keeps
  // positive offset = right-of-normal. The renderer doesn't care about
  // the absolute sign so long as adjacent lanes spread apart — assert
  // magnitude and that source x stayed put.
  expect(shifted[0]).toBeCloseTo(base[0] ?? 0, 5)
  expect(Math.abs((shifted[6] ?? 0) - (base[6] ?? 0))).toBeCloseTo(7, 5)
})

test('two opposite-sign offsets at the same port produce distinct paths', () => {
  const a = { absolutePosition: { x: 50, y: 0 }, side: 'bottom' as const }
  const b1 = { absolutePosition: { x: 0, y: 100 }, side: 'top' as const }
  const b2 = { absolutePosition: { x: 100, y: 100 }, side: 'top' as const }
  const left = bezierEdgePath({ ...a, lateralOffset: -8 }, b1)
  const right = bezierEdgePath({ ...a, lateralOffset: 8 }, b2)
  expect(left).not.toBe(right)
  const leftPts = parseSvgPath(left)
  const rightPts = parseSvgPath(right)
  expect(leftPts[0]).toBeLessThan(rightPts[0] ?? 0)
})

test('lateralOffset on a left/right port shifts perpendicular (vertical)', () => {
  const a = { absolutePosition: { x: 0, y: 50 }, side: 'right' as const }
  const b = { absolutePosition: { x: 100, y: 50 }, side: 'left' as const }
  const base = parseSvgPath(bezierEdgePath(a, b))
  const shifted = parseSvgPath(bezierEdgePath({ ...a, lateralOffset: 6 }, b))
  // x stays, y moves.
  expect(shifted[0]).toBeCloseTo(base[0] ?? 0, 5)
  expect(Math.abs((shifted[1] ?? 0) - (base[1] ?? 0))).toBeCloseTo(6, 5)
})
