// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { describe, expect, it } from 'vitest'
import { arcsOf } from './arcs.js'
import { sampled } from './turns.js'

const corner = [
  { x: 0, y: 0 },
  { x: 100, y: 0 },
  { x: 100, y: 100 },
]

describe('arcsOf', () => {
  it('rounds a right angle with a quarter circle tangent to both runs', () => {
    const arc = arcsOf(corner, [0, 10, 0])[1]
    expect(arc?.from).toEqual({ x: 90, y: 0 })
    expect(arc?.to.x).toBeCloseTo(100)
    expect(arc?.to.y).toBeCloseTo(10)
    expect(arc?.r).toBeCloseTo(10)
    expect(arc?.centre.x).toBeCloseTo(90)
    expect(arc?.centre.y).toBeCloseTo(10)
    expect(arc?.theta).toBeCloseTo(Math.PI / 2)
    expect(arc?.clockwise).toBe(true)
  })

  it('turns the other way for the other turn', () => {
    const up = arcsOf(
      [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: -100 },
      ],
      [0, 10, 0],
    )[1]
    expect(up?.clockwise).toBe(false)
  })

  it('takes r·tan(θ/2) off each run, at most half of either', () => {
    const chamfer = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 150, y: 50 },
    ]
    expect(arcsOf(chamfer, [0, 10, 0])[1]?.from.x).toBeCloseTo(100 - 10 * Math.tan(Math.PI / 8))
    const short = arcsOf(corner, [0, 1000, 0])[1]
    expect(short?.from.x).toBeCloseTo(50)
    expect(short?.r).toBeCloseTo(50)
  })

  it('has no arc at an end, where no radius is asked, or where the line goes straight on', () => {
    expect(arcsOf(corner, [5, 0, 5])).toEqual([undefined, undefined, undefined])
    const straight = [...corner.slice(0, 1), { x: 50, y: 0 }, { x: 100, y: 0 }]
    expect(arcsOf(straight, [0, 10, 0])[1]).toBeUndefined()
    expect(arcsOf([corner[0] ?? { x: 0, y: 0 }], [])).toEqual([undefined])
  })

  it('is what the sampled wire follows: every sample of the arc lies on its circle', () => {
    const arc = arcsOf(corner, [0, 10, 0])[1]
    if (!arc) throw new Error('no arc')
    const onArc = sampled(corner, [0, 10, 0]).filter((p) => p.x > 90 && p.y < 10 && p.y > 0)
    expect(onArc.length).toBeGreaterThan(0)
    for (const p of onArc) {
      expect(Math.hypot(p.x - arc.centre.x, p.y - arc.centre.y)).toBeCloseTo(arc.r)
    }
  })
})
