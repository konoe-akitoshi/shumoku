// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, test } from 'vitest'
import { sceneInteractionScale, sceneWireWidth } from './node-geometry'

describe('sceneInteractionScale', () => {
  test('keeps interaction targets usable at every zoom', () => {
    for (const zoom of [0.1, 0.25, 0.5, 1, 1.5, 2, 3, 4]) {
      expect(12 * sceneInteractionScale(zoom) * zoom).toBeCloseTo(12)
      expect(4 * sceneInteractionScale(zoom) * zoom).toBeCloseTo(4)
    }
  })

  test('falls back safely for invalid zoom', () => {
    for (const zoom of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(sceneInteractionScale(zoom)).toBe(1)
    }
  })
})

describe('sceneWireWidth', () => {
  test('respects authored cable widths', () => {
    expect(sceneWireWidth(0.1)).toBe(0.2)
    expect(sceneWireWidth(1)).toBe(2)
    expect(sceneWireWidth(2)).toBe(4)
    expect(sceneWireWidth(100)).toBe(200)
  })
  test('rejects invalid authored scales', () => {
    for (const scale of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(sceneWireWidth(scale)).toBe(2)
    }
  })
})
