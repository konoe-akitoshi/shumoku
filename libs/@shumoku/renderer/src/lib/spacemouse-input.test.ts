// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { describe, expect, it } from 'vitest'
import { pickCamera } from './spacemouse-input.js'

const cam = (over = false) => ({ isPointerOver: () => over })

describe('pickCamera', () => {
  it('drives the diagram under the pointer', () => {
    const a = cam()
    const b = cam(true)
    expect(pickCamera([a, b], a)).toBe(b)
  })

  it('keeps driving the last one when the pointer leaves the diagrams', () => {
    const a = cam()
    const b = cam()
    expect(pickCamera([a, b], a)).toBe(a)
  })

  it('falls back to the one attached last', () => {
    const a = cam()
    const b = cam()
    expect(pickCamera([a, b], null)).toBe(b)
    expect(pickCamera([a], b)).toBe(a)
  })

  it('has nothing to drive without a camera', () => {
    expect(pickCamera([], null)).toBeNull()
  })
})
