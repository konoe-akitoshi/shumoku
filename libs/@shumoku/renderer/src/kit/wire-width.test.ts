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
  it('is a step (a stroke and a half) at the slowest standard and a step more per decade', () => {
    expect(widthOf(link({}, '10BASE-T'))).toBeCloseTo(1.5 * stroke)
    expect(widthOf(link({}, '1000BASE-T'))).toBeCloseTo(4.5 * stroke)
    expect(widthOf(link({}, '10GBASE-T'))).toBeCloseTo(6 * stroke)
    expect(widthOf(link({}, '100GBASE-SR4'))).toBeCloseTo(7.5 * stroke)
  })

  it('goes by the slower end', () => {
    expect(widthOf(link({}, '10GBASE-T', '1000BASE-T'))).toBeCloseTo(4.5 * stroke)
  })

  it('reads the rate the model gave when no end names a standard', () => {
    expect(widthOf(link({ speedBps: 1e9 }))).toBeCloseTo(4.5 * stroke)
  })

  it('takes the fallback where no speed is known, and what the user wrote over any speed', () => {
    expect(widthOf(link(), 4.4)).toBe(4.4)
    expect(widthOf(link({ style: { strokeWidth: 7 } }, '10GBASE-T'), 4.4)).toBe(7)
  })

  it('never goes under a stroke, however slow the speed', () => {
    expect(widthOf(link({ speedBps: 1e6 }))).toBe(stroke)
    expect(widthOf(link({ speedBps: 1e5 }))).toBe(stroke)
  })

  it('has the median of the known widths as the fallback, and a bold line when none is known', () => {
    const links = [link({}, '10BASE-T'), link({}, '1000BASE-T'), link({}, '100GBASE-SR4'), link()]
    expect(medianWireWidth(links, kit)).toBeCloseTo(4.5 * stroke)
    // an even number of known widths takes the middle two
    expect(medianWireWidth([link({}, '10BASE-T'), link({}, '1000BASE-T')], kit)).toBeCloseTo(
      3 * stroke,
    )
    expect(medianWireWidth([link()], kit)).toBe(1.5 * kit.tokens.line.bold)
  })
})
