// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { describe, expect, it } from 'vitest'
import { classReservationW, effectivePoeClass, POE_CLASS_RESERVATION_W } from './poe.js'

describe('effectivePoeClass', () => {
  it('returns undefined when PD class unknown', () => {
    expect(effectivePoeClass(undefined, '802.3at')).toBeUndefined()
  })

  it('returns PD class when PSE standard unknown', () => {
    expect(effectivePoeClass(5, undefined)).toBe(5)
    expect(effectivePoeClass(5, 'nonsense')).toBe(5)
  })

  it('downgrades PD when PSE supports only lower standard', () => {
    // Class 5 (bt) PD on an at-only PSE → Class 4
    expect(effectivePoeClass(5, '802.3at')).toBe(4)
    // Class 5 PD on an af-only PSE → Class 3
    expect(effectivePoeClass(5, '802.3af')).toBe(3)
  })

  it('uses PD class when PSE supports higher', () => {
    // Class 3 PD on a bt PSE stays Class 3 (not upgraded)
    expect(effectivePoeClass(3, '802.3bt')).toBe(3)
  })

  it('preserves PD class at the PSE max', () => {
    expect(effectivePoeClass(4, '802.3at')).toBe(4)
    expect(effectivePoeClass(8, '802.3bt')).toBe(8)
  })
})

describe('classReservationW', () => {
  it('returns IEEE reservation for each class', () => {
    expect(classReservationW(0)).toBe(15.4)
    expect(classReservationW(3)).toBe(15.4)
    expect(classReservationW(4)).toBe(30)
    expect(classReservationW(5)).toBe(45)
    expect(classReservationW(8)).toBe(90)
  })

  it('returns undefined for unknown class', () => {
    expect(classReservationW(undefined)).toBeUndefined()
    expect(classReservationW(99)).toBeUndefined()
  })

  it('has a full table from 0 to 8', () => {
    for (let c = 0; c <= 8; c++) {
      expect(POE_CLASS_RESERVATION_W[c]).toBeDefined()
    }
  })
})
