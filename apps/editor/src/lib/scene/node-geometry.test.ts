// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, test } from 'vitest'
import { mapMarkerFlowScale, sceneLabelFlowScale, sceneWireScreenWidth } from './node-geometry'

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

describe('sceneLabelFlowScale', () => {
  test('keeps text and label decorations the same screen size at every zoom', () => {
    for (const zoom of [0.1, 0.25, 0.5, 1, 1.5, 2, 3, 4]) {
      expect(12 * sceneLabelFlowScale(zoom) * zoom).toBeCloseTo(12)
      expect(4 * sceneLabelFlowScale(zoom) * zoom).toBeCloseTo(4)
    }
  })

  test('falls back safely for invalid zoom', () => {
    for (const zoom of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(sceneLabelFlowScale(zoom)).toBe(1)
    }
  })
})

describe('sceneWireScreenWidth', () => {
  test('keeps thin cables visible and bounds heavy cables', () => {
    expect(sceneWireScreenWidth(0.1)).toBe(1.5)
    expect(sceneWireScreenWidth(1)).toBe(2)
    expect(sceneWireScreenWidth(2)).toBe(4)
    expect(sceneWireScreenWidth(100)).toBe(6)
    expect(sceneWireScreenWidth(1, true)).toBe(3)
  })
  test('rejects invalid authored scales', () => {
    for (const scale of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(sceneWireScreenWidth(scale)).toBe(2)
    }
  })
})
