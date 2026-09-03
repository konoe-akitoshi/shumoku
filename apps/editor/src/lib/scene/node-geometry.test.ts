// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, test } from 'vitest'
import { mapMarkerFlowScale } from './node-geometry'

describe('mapMarkerFlowScale', () => {
  test('keeps screen-space marker scale within the readable range', () => {
    expect(mapMarkerFlowScale(0.1) * 0.1).toBeCloseTo(0.5)
    expect(mapMarkerFlowScale(1) * 1).toBeCloseTo(1)
    expect(mapMarkerFlowScale(4) * 4).toBeCloseTo(1.5)
  })

  test('falls back safely for invalid zoom values', () => {
    expect(mapMarkerFlowScale(0)).toBe(1)
    expect(mapMarkerFlowScale(Number.NaN)).toBe(1)
  })
})
