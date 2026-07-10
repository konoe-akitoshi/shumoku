// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from 'vitest'
import { computeLaneGeometry, flowLevel, LANE_SPLIT_MIN_WIDTH } from './index'

describe('computeLaneGeometry — lanes partition the base width', () => {
  // The load-bearing invariant: the two lanes together span exactly the base
  // stroke, so a lane's outer edge lands ON the link edge — never outside it.
  // This is the guard against the class of bug this replaced (the old formula
  // pushed the gap OUTWARD, leaking the animation past the line).
  it('outer edge lands exactly on the base edge for every width', () => {
    for (let w = LANE_SPLIT_MIN_WIDTH; w <= 200; w += 0.5) {
      const { laneWidth, laneOffset } = computeLaneGeometry(w)
      const outerEdge = laneOffset + laneWidth / 2
      expect(outerEdge).toBeCloseTo(w / 2, 6)
    }
  })

  it('opens the gap in the CENTER, never past the outer edge', () => {
    for (const w of [4, 8, 14, 20, 34, 80]) {
      const { laneWidth, laneOffset, gap } = computeLaneGeometry(w)
      const innerEdge = laneOffset - laneWidth / 2
      const outerEdge = laneOffset + laneWidth / 2
      // Inner edges sit gap/2 off center (a gap of `gap` between the two lanes).
      expect(innerEdge).toBeCloseTo(gap / 2, 6)
      // Outer edge is within (never beyond) the base half-width.
      expect(outerEdge).toBeLessThanOrEqual(w / 2 + 1e-6)
    }
  })

  it('keeps the center gap proportional (bounded)', () => {
    // Thin and thick links get a gap in the same visual ballpark, not a fixed
    // 1px that reads as huge on thin lines and invisible on thick ones.
    expect(computeLaneGeometry(10).gap).toBeGreaterThanOrEqual(0.5)
    expect(computeLaneGeometry(10).gap).toBeLessThanOrEqual(2)
    expect(computeLaneGeometry(100).gap).toBeLessThanOrEqual(2) // clamped
    expect(computeLaneGeometry(14).gap).toBeCloseTo(14 * 0.08, 6)
  })

  it('flags the single-lane fallback below the split threshold', () => {
    expect(computeLaneGeometry(2).canSplit).toBe(false)
    expect(computeLaneGeometry(LANE_SPLIT_MIN_WIDTH).canSplit).toBe(true)
    expect(computeLaneGeometry(20).canSplit).toBe(true)
  })

  it('never produces a non-positive lane width, even for degenerate input', () => {
    for (const w of [0, -5, Number.NaN, 0.1, 1]) {
      const g = computeLaneGeometry(w)
      expect(g.laneWidth).toBeGreaterThan(0)
      expect(g.combinedWidth).toBeGreaterThan(0)
    }
  })
})

describe('flowLevel — throughput intensity in 0..1', () => {
  it('is 0 for no traffic and rises with bps', () => {
    expect(flowLevel(0, 0)).toBe(0)
    expect(flowLevel(1_000_000, 0)).toBeGreaterThan(0)
    expect(flowLevel(100_000_000_000, 0)).toBeGreaterThan(flowLevel(1_000_000, 0))
  })

  it('stays within [0, 1]', () => {
    for (const bps of [0, 1, 1e6, 1e9, 1e11, 1e15]) {
      const v = flowLevel(bps, 0)
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(1)
    }
  })

  it('falls back to utilization% when bps is absent', () => {
    expect(flowLevel(0, 50)).toBeCloseTo(0.5, 6)
    expect(flowLevel(0, 200)).toBe(1) // clamped
  })

  it('treats non-finite input as no flow', () => {
    expect(flowLevel(Number.NaN, Number.NaN)).toBe(0)
  })
})
