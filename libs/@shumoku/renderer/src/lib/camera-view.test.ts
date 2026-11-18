// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { describe, expect, it } from 'vitest'
import {
  centreOn,
  type Frame,
  fitView,
  fromTransform,
  isUsable,
  keepInView,
  toTransform,
  zoomAround,
} from './camera-view.js'

/** A 3000 × 1000 drawing in a 1000 × 500 container: one world unit is a third of a CSS px. */
const frame: Frame = { vbX: -20, vbY: -20, vbW: 3000, vbH: 1000, cw: 1000, ch: 500 }

const screenOf = (v: { x: number; y: number; z: number }, wx: number, wy: number) => ({
  x: wx * v.z + v.x,
  y: wy * v.z + v.y,
})

describe('the view and the viewport transform', () => {
  it('fits the drawing as the bare svg does: the identity transform', () => {
    const t = toTransform(fitView(frame), frame)
    expect(t.k).toBeCloseTo(1)
    expect(t.tx).toBeCloseTo(0)
    expect(t.ty).toBeCloseTo(0)
  })

  it('round-trips a transform', () => {
    const t = { k: 2.5, tx: -340, ty: 120 }
    const back = toTransform(fromTransform(t, frame), frame)
    expect(back.k).toBeCloseTo(t.k)
    expect(back.tx).toBeCloseTo(t.tx)
    expect(back.ty).toBeCloseTo(t.ty)
  })

  it('pans in CSS px: one pixel of view is one pixel on screen, whatever the viewBox', () => {
    const v = fitView(frame)
    const before = screenOf(v, 500, 300)
    const after = screenOf({ ...v, x: v.x + 10 }, 500, 300)
    expect(after.x - before.x).toBeCloseTo(10)
  })

  it('keeps pointing at the same place when the drawing grows', () => {
    const v = { x: 100, y: 50, z: 0.5 }
    const bigger = { ...frame, vbX: -500, vbW: 6000 }
    // The same view, written for the new viewBox, puts a world point at the same screen point.
    const t1 = toTransform(v, frame)
    const t2 = toTransform(v, bigger)
    const screen = (t: typeof t1, f: Frame, wx: number) => {
      const s = Math.min(f.cw / f.vbW, f.ch / f.vbH)
      const ox = (f.cw - f.vbW * s) / 2
      return (wx * t.k + t.tx - f.vbX) * s + ox
    }
    expect(screen(t2, bigger, 700)).toBeCloseTo(screen(t1, frame, 700))
  })

  it('treats a container not laid out yet as unusable', () => {
    expect(isUsable(frame)).toBe(true)
    expect(isUsable({ ...frame, cw: 0 })).toBe(false)
    expect(isUsable({ ...frame, vbW: Number.NaN })).toBe(false)
  })
})

describe('zoomAround', () => {
  it('keeps the anchor still', () => {
    const v = { x: 30, y: -40, z: 0.4 }
    const world = { x: (250 - v.x) / v.z, y: (180 - v.y) / v.z }
    const next = zoomAround(v, 1.7, 250, 180, 0.01, 100)
    const s = screenOf(next, world.x, world.y)
    expect(s.x).toBeCloseTo(250)
    expect(s.y).toBeCloseTo(180)
    expect(next.z).toBeCloseTo(0.68)
  })

  it('stops at the limits, still about the anchor', () => {
    const v = { x: 0, y: 0, z: 1 }
    const next = zoomAround(v, 10, 100, 100, 0.1, 2)
    expect(next.z).toBe(2)
    expect(next.x).toBeCloseTo(-100)
  })
})

describe('keepInView', () => {
  it('leaves a view that shows the drawing alone', () => {
    const v = fitView(frame)
    expect(keepInView(v, frame)).toBe(v)
  })

  it('pulls the drawing back when it is panned off the left edge', () => {
    const v = { x: -5000, y: 0, z: 1 / 3 }
    const kept = keepInView(v, frame)
    const right = (frame.vbX + frame.vbW) * kept.z + kept.x
    expect(right).toBeCloseTo(80)
  })

  it('pulls the drawing back when it is panned off the bottom edge', () => {
    const v = { x: 0, y: 5000, z: 1 / 3 }
    const kept = keepInView(v, frame)
    const top = frame.vbY * kept.z + kept.y
    expect(top).toBeCloseTo(frame.ch - 80)
  })
})

describe('centreOn', () => {
  it('puts the box in the middle of the container', () => {
    const v = centreOn({ x: 100, y: 100, width: 40, height: 20 }, 2, frame)
    const s = screenOf(v, 120, 110)
    expect(s.x).toBeCloseTo(500)
    expect(s.y).toBeCloseTo(250)
  })
})
