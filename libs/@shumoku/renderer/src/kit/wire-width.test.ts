// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import type { Link } from '@shumoku/core'
import { describe, expect, it } from 'vitest'
import { createKit } from './measure'
import { medianWireWidth, wireWidth } from './wire-width'

const kit = createKit()
const { stroke } = kit.tokens

const link = (extra: Partial<Link> = {}, standard?: string, other?: string): Link => ({
  id: 'l',
  from: { node: 'a', port: 'p', plug: standard ? { module: { standard } } : undefined },
  to: { node: 'b', port: 'q', plug: other ? { module: { standard: other } } : undefined },
  ...extra,
})

describe('wire width', () => {
  it('is a stroke at the slowest standard and a stroke more per decade', () => {
    expect(wireWidth(link({}, '10BASE-T'), kit, 99)).toBeCloseTo(stroke)
    expect(wireWidth(link({}, '1000BASE-T'), kit, 99)).toBeCloseTo(3 * stroke)
    expect(wireWidth(link({}, '10GBASE-T'), kit, 99)).toBeCloseTo(4 * stroke)
    expect(wireWidth(link({}, '100GBASE-SR4'), kit, 99)).toBeCloseTo(5 * stroke)
  })

  it('goes by the slower end', () => {
    expect(wireWidth(link({}, '10GBASE-T', '1000BASE-T'), kit, 99)).toBeCloseTo(3 * stroke)
  })

  it('reads the rate the model gave when no end names a standard', () => {
    expect(wireWidth(link({ speedBps: 1e9 }), kit, 99)).toBeCloseTo(3 * stroke)
  })

  it('takes the fallback where no speed is known, and what the user wrote over any speed', () => {
    expect(wireWidth(link(), kit, 4.4)).toBe(4.4)
    expect(wireWidth(link({ style: { strokeWidth: 7 } }, '10GBASE-T'), kit, 4.4)).toBe(7)
  })

  it('takes the outer band for a double line', () => {
    expect(wireWidth(link({ type: 'double' }, '1000BASE-T'), kit, 99)).toBeCloseTo(
      3 * stroke * kit.tokens.wire.double.outer,
    )
  })

  it('has the median of the known widths as the fallback, and a bold line when none is known', () => {
    const links = [link({}, '10BASE-T'), link({}, '1000BASE-T'), link({}, '100GBASE-SR4'), link()]
    expect(medianWireWidth(links, kit)).toBeCloseTo(3 * stroke)
    expect(medianWireWidth([link()], kit)).toBe(kit.tokens.line.bold)
  })
})
