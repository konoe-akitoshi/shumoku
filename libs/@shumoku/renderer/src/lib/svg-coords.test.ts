import { describe, expect, it } from 'vitest'
import { offsetPolyline, polylineOffsetPath } from './svg-coords.js'

describe('offsetPolyline', () => {
  it('shifts a horizontal segment to its right-hand side (downward on screen)', () => {
    const moved = offsetPolyline(
      [
        { x: 0, y: 50 },
        { x: 100, y: 50 },
      ],
      8,
    )
    expect(moved).toEqual([
      { x: 0, y: 58 },
      { x: 100, y: 58 },
    ])
  })

  it('is mirrored by the opposite offset', () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
    ]
    const plus = offsetPolyline(pts, 10)
    const minus = offsetPolyline(pts, -10)
    expect(plus[1]?.x).toBeCloseTo(90, 6)
    expect(plus[1]?.y).toBeCloseTo(10, 6)
    expect(minus[1]?.x).toBeCloseTo(110, 6)
    expect(minus[1]?.y).toBeCloseTo(-10, 6)
  })

  it('returns the points as they are for no offset, a non-finite one, or one point', () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 5, y: 0 },
    ]
    expect(offsetPolyline(pts, 0)).toEqual(pts)
    expect(offsetPolyline(pts, Number.NaN)).toEqual(pts)
    expect(offsetPolyline([{ x: 1, y: 1 }], 4)).toEqual([{ x: 1, y: 1 }])
  })

  it('does not throw for two identical points', () => {
    const p = { x: 50, y: 50 }
    expect(() => offsetPolyline([p, p], 5)).not.toThrow()
  })
})

describe('polylineOffsetPath', () => {
  const corner = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 100 },
  ]

  it('bends tighter on the side the line turns toward and wider on the other', () => {
    // Heading east then south is a right turn: the right-hand lane (+) is inside.
    const inside = polylineOffsetPath(corner, [0, 20, 0], 8)
    const outside = polylineOffsetPath(corner, [0, 20, 0], -8)
    expect(inside).toMatch(/A 12 12 /)
    expect(outside).toMatch(/A 28 28 /)
  })

  it('keeps a lane on a straight wire straight', () => {
    const d = polylineOffsetPath(
      [
        { x: 0, y: 0 },
        { x: 200, y: 0 },
      ],
      [0, 0],
      1.5,
    )
    expect(d).toBe('M 0 1.5 L 200 1.5')
  })
})
