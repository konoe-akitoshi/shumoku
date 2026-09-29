import { describe, expect, test } from 'vitest'
import { type Bend, moveWireDrag, planWireDrag, type WirePoint } from './wire-drag'

const bends: Bend[] = [
  { id: 'a', x: 20, y: 0, afterIndex: -1 },
  { id: 'b', x: 80, y: 0, afterIndex: -1 },
]
const points: WirePoint[] = [
  { x: 0, y: 0, afterIndex: -1 },
  ...bends.map((b) => ({ ...b, bendId: b.id })),
  { x: 100, y: 0 },
]

describe('precision wire dragging', () => {
  test('picks a vertex within 8 screen pixels at every zoom and preserves grab offset', () => {
    for (const zoom of [0.25, 1, 4]) {
      const start = { x: 20, y: 6 / zoom }
      const plan = planWireDrag(points, bends, start, zoom, false, () => 'new')
      if (!plan) throw new Error('Missing plan')
      expect(plan.movingIds).toEqual(['a'])
      const moved = moveWireDrag(plan, { x: start.x + 0.125, y: start.y + 0.25 })
      expect(moved[0]).toMatchObject({ x: 20.125, y: 0.25 })
      expect(moved[1]).toEqual(bends[1])
      expect(bends[0]).toMatchObject({ x: 20, y: 0 })
    }
  })
  test('moves an existing segment perpendicular to itself without adding bends', () => {
    const plan = planWireDrag(points, bends, { x: 50, y: 2 }, 1, false, () => 'new')
    if (!plan) throw new Error('Missing plan')
    const moved = moveWireDrag(plan, { x: 65, y: 12 })
    expect(moved).toEqual(bends.map((b) => ({ ...b, y: 10 })))
  })
  test('keeps diagonal segments parallel and retains fractional coordinates', () => {
    const route = [
      { x: 0, y: 0 },
      { x: 100, y: 100 },
    ]
    let id = 0
    const plan = planWireDrag(route, [], { x: 50, y: 50 }, 1, false, () => `${++id}`)
    if (!plan) throw new Error('Missing plan')
    const moved = moveWireDrag(plan, { x: 50.5, y: 50 })
    expect(moved[0]?.x).toBeCloseTo(0.25)
    expect(moved[0]?.y).toBeCloseTo(-0.25)
    expect(moved[1]?.x).toBeCloseTo(100.25)
    expect(moved[1]?.y).toBeCloseTo(99.75)
    expect(route).toEqual([
      { x: 0, y: 0 },
      { x: 100, y: 100 },
    ])
  })
  test('explicit insertion lands between existing bends rather than at the end', () => {
    const plan = planWireDrag(points, bends, { x: 50, y: 2 }, 1, true, () => 'inserted')
    if (!plan) throw new Error('Missing plan')
    expect(plan.bends.map((b) => b.id)).toEqual(['a', 'inserted', 'b'])
    expect(moveWireDrag(plan, { x: 50, y: 7 })[1]).toMatchObject({ x: 50, y: 5 })
  })
  test('inserts in the correct via interval and ignores bends on other intervals', () => {
    const existing = [...bends, { id: 'other', x: 201, y: 0, afterIndex: 2 }]
    const plan = planWireDrag(
      [
        { x: 200, y: 0, afterIndex: 1 },
        { x: 300, y: 0 },
      ],
      existing,
      { x: 201, y: 0 },
      1,
      true,
      () => 'new',
    )
    expect(plan?.bends.map((b) => b.id)).toEqual(['a', 'b', 'new', 'other'])
    expect(plan?.bends[2]?.afterIndex).toBe(1)
  })
  test('moving a segment attached to a device adds a bend without moving the device', () => {
    const plan = planWireDrag(points, bends, { x: 10, y: 0 }, 4, false, () => 'new')
    if (!plan) throw new Error('Missing plan')
    expect(plan.bends.map((b) => b.id)).toEqual(['new', 'a', 'b'])
    expect(moveWireDrag(plan, { x: 10, y: 10 }).map((b) => b.y)).toEqual([10, 10, 0])
    expect(points[0]).toEqual({ x: 0, y: 0, afterIndex: -1 })
  })
  test('ignores zero-length segments', () => {
    expect(
      planWireDrag(
        [
          { x: 0, y: 0 },
          { x: 0, y: 0 },
        ],
        [],
        { x: 0, y: 0 },
        1,
        false,
        () => 'new',
      ),
    ).toBeNull()
  })
})
