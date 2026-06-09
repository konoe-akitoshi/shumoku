// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { describe, expect, it } from 'vitest'
import type { Link } from '../models/types.js'
import { bpsToLinkWidthMode, getLinkWidthForMode } from './link-utils.js'

describe('bpsToLinkWidthMode', () => {
  it('log mode matches the legacy anchored curve', () => {
    expect(bpsToLinkWidthMode(10e9, 'log')).toBeCloseTo(14)
    expect(bpsToLinkWidthMode(100e9, 'log')).toBeCloseTo(34)
  })

  it('linear mode is proportional with a visibility floor and a cap', () => {
    expect(bpsToLinkWidthMode(400e9, 'linear')).toBeCloseTo(16)
    expect(bpsToLinkWidthMode(100e9, 'linear')).toBeCloseTo(4)
    expect(bpsToLinkWidthMode(10e9, 'linear')).toBeCloseTo(0.4) // floored
    // proportion holds where the floor doesn't bite: 400G is 4× 100G
    expect(bpsToLinkWidthMode(400e9, 'linear') / bpsToLinkWidthMode(100e9, 'linear')).toBeCloseTo(4)
    expect(bpsToLinkWidthMode(10e12, 'linear')).toBe(64) // capped
  })

  it('class mode snaps to discrete road classes', () => {
    expect(bpsToLinkWidthMode(400e9, 'class')).toBe(6.5)
    expect(bpsToLinkWidthMode(200e9, 'class')).toBe(4)
    expect(bpsToLinkWidthMode(25e9, 'class')).toBe(2.6)
    expect(bpsToLinkWidthMode(10e9, 'class')).toBe(1.7)
    expect(bpsToLinkWidthMode(1e9, 'class')).toBe(1.1)
  })

  it('returns 0 for unknown bandwidth in every mode', () => {
    expect(bpsToLinkWidthMode(undefined, 'log')).toBe(0)
    expect(bpsToLinkWidthMode(undefined, 'linear')).toBe(0)
    expect(bpsToLinkWidthMode(undefined, 'class')).toBe(0)
  })
})

describe('getLinkWidthForMode', () => {
  const link = (rateBps?: number): Link => ({
    from: { node: 'a' },
    to: { node: 'b' },
    ...(rateBps !== undefined ? { rateBps } : {}),
  })

  it('explicit style overrides the mode', () => {
    const styled: Link = { ...link(100e9), style: { strokeWidth: 9 } }
    expect(getLinkWidthForMode(styled, 'linear')).toBe(9)
  })

  it('falls back to type/default when bandwidth is unknown', () => {
    expect(getLinkWidthForMode({ ...link(), type: 'thick' }, 'linear')).toBe(4)
    expect(getLinkWidthForMode(link(), 'log')).toBe(3)
    expect(getLinkWidthForMode(link(), 'linear')).toBe(1.5)
  })

  it('uses the selected mode for bandwidth-derived widths', () => {
    expect(getLinkWidthForMode(link(400e9), 'linear')).toBeCloseTo(16)
    expect(getLinkWidthForMode(link(400e9), 'class')).toBe(6.5)
  })
})
