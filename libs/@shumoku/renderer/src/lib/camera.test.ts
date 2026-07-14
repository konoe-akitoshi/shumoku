// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { describe, expect, it } from 'vitest'
import { deriveMaxScale } from './camera'

describe('deriveMaxScale', () => {
  it('raises the max for content larger than the viewport (big graph)', () => {
    // 40000-wide layout in a 1280px viewport → ~31× natural, ×1.5 overzoom
    const max = deriveMaxScale(40000, 24000, 1280, 800, 10)
    expect(max).toBeGreaterThan(10)
    expect(max).toBeCloseTo((40000 / 1280) * 1.5, 1)
  })

  it('floors at the fixed default for content smaller than the viewport (small graph)', () => {
    // natural ratio < 1 → floored at the fixed default
    expect(deriveMaxScale(500, 300, 1280, 800, 10)).toBe(10)
  })

  it('uses the larger of the width / height ratio', () => {
    // tall + skinny: the height ratio dominates
    expect(deriveMaxScale(1000, 16000, 1280, 800, 10)).toBeCloseTo((16000 / 800) * 1.5, 1)
  })

  it('returns the fixed default when measurements are not ready (any zero)', () => {
    expect(deriveMaxScale(0, 0, 0, 0, 10)).toBe(10)
    expect(deriveMaxScale(40000, 24000, 0, 800, 10)).toBe(10)
    expect(deriveMaxScale(40000, 0, 1280, 800, 10)).toBe(10)
  })

  it('honors a custom overzoom factor', () => {
    expect(deriveMaxScale(40000, 24000, 1280, 800, 10, 2)).toBeCloseTo((40000 / 1280) * 2, 1)
  })
})
