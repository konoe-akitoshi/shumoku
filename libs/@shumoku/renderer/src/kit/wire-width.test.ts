// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import type { Link } from '@shumoku/core'
import { describe, expect, it } from 'vitest'
import { createKit } from './measure.js'
import { lineWidth, medianWireWidth } from './wire-width.js'

const kit = createKit()
const { stroke } = kit.tokens
const widthOf = (l: Link, unnamed = 99) => lineWidth(l, kit, unnamed)

const link = (extra: Partial<Link> = {}, standard?: string, other?: string): Link => ({
  id: 'l',
  from: { node: 'a', port: 'p', plug: standard ? { module: { standard } } : undefined },
  to: { node: 'b', port: 'q', plug: other ? { module: { standard: other } } : undefined },
  ...extra,
})

describe('wire width', () => {
  it('is four strokes at 1G and seven and a half more per decade', () => {
    expect(widthOf(link({}, '1000BASE-T'))).toBeCloseTo(4 * stroke)
    expect(widthOf(link({}, '10GBASE-T'))).toBeCloseTo(11.5 * stroke)
    expect(widthOf(link({}, '100GBASE-SR4'))).toBeCloseTo(19 * stroke)
    expect(widthOf(link({ speedBps: 25e9 }))).toBeCloseTo((4 + 7.5 * Math.log10(25)) * stroke)
  })

  it('goes by the slower end', () => {
    expect(widthOf(link({}, '10GBASE-T', '1000BASE-T'))).toBeCloseTo(4 * stroke)
  })

  it('reads the rate the model gave when no end names a standard', () => {
    expect(widthOf(link({ speedBps: 1e9 }))).toBeCloseTo(4 * stroke)
  })

  it('takes the fallback where no speed is known', () => {
    expect(widthOf(link(), 4.4)).toBe(4.4)
  })

  it('never goes under two strokes, however slow the speed', () => {
    expect(widthOf(link({}, '100BASE-TX'))).toBe(2 * stroke)
    expect(widthOf(link({}, '10BASE-T'))).toBe(2 * stroke)
    expect(widthOf(link({ speedBps: 1e5 }))).toBe(2 * stroke)
  })

  it('has the median of the known widths as the fallback, and a 1G line when none is known', () => {
    const links = [link({}, '10BASE-T'), link({}, '1000BASE-T'), link({}, '100GBASE-SR4'), link()]
    expect(medianWireWidth(links, kit)).toBeCloseTo(4 * stroke)
    // an even number of known widths takes the middle two
    expect(medianWireWidth([link({}, '1000BASE-T'), link({}, '10GBASE-T')], kit)).toBeCloseTo(
      7.75 * stroke,
    )
    expect(medianWireWidth([link()], kit)).toBe(4 * stroke)
  })
})
