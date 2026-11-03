// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { describe, expect, it } from 'vitest'
import { linkSpeedBps, standardSpeedBps } from './link-speed.js'
import type { Link, LinkPlug } from './types.js'

const plug = (standard: string): LinkPlug => ({ module: { standard } }) as unknown as LinkPlug
const link = (from?: LinkPlug, to?: LinkPlug, speedBps?: number): Link =>
  ({
    from: { node: 'a', ...(from && { plug: from }) },
    to: { node: 'b', ...(to && { plug: to }) },
    ...(speedBps !== undefined && { speedBps }),
  }) as Link

describe('linkSpeedBps', () => {
  it('is the slower of the two standards when the ends differ', () => {
    expect(linkSpeedBps(link(plug('10GBASE-T'), plug('1000BASE-T')))).toBe(1e9)
  })

  it('is the one standard that names a speed', () => {
    expect(linkSpeedBps(link(plug('10GBASE-T'), undefined))).toBe(10e9)
  })

  it('prefers the standards to the speed the link carries', () => {
    expect(linkSpeedBps(link(plug('1000BASE-T'), undefined, 40e9))).toBe(1e9)
  })

  it('falls back to the speed the link carries', () => {
    expect(linkSpeedBps(link(undefined, undefined, 25e9))).toBe(25e9)
  })

  it('names nothing for no speed, zero, or a number that is not one', () => {
    expect(linkSpeedBps(link())).toBeUndefined()
    expect(linkSpeedBps(link(undefined, undefined, 0))).toBeUndefined()
    expect(linkSpeedBps(link(undefined, undefined, Number.NaN))).toBeUndefined()
    expect(linkSpeedBps(undefined)).toBeUndefined()
  })
})

describe('standardSpeedBps', () => {
  it('names nothing when no plug has a standard', () => {
    expect(standardSpeedBps([undefined, {}])).toBeUndefined()
  })
})
