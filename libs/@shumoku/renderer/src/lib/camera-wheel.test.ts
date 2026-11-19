// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { describe, expect, it } from 'vitest'
import { normalizeWheel, type WheelSample, wheelIntent } from './camera-wheel.js'

const rates = { wheel: 0.0018, pinch: 0.01 }

const sample = (over: Partial<WheelSample>): WheelSample => ({
  dx: 0,
  dy: 0,
  ctrl: false,
  alt: false,
  ...over,
})

describe('normalizeWheel', () => {
  const event = (over: Partial<WheelEvent>) =>
    ({
      deltaMode: 0,
      deltaX: 0,
      deltaY: 0,
      ctrlKey: false,
      metaKey: false,
      shiftKey: false,
      altKey: false,
      ...over,
    }) as WheelEvent

  it('turns lines and pages into CSS px', () => {
    expect(normalizeWheel(event({ deltaMode: 1, deltaY: 3 })).dy).toBe(120)
    expect(normalizeWheel(event({ deltaMode: 2, deltaY: 1 })).dy).toBe(800)
  })

  it('turns Shift + a vertical wheel horizontal (Windows, Linux)', () => {
    const s = normalizeWheel(event({ deltaY: 100, shiftKey: true }))
    expect(s.dx).toBe(100)
    expect(s.dy).toBe(0)
  })

  it('takes ⌘ as Ctrl', () => {
    expect(normalizeWheel(event({ metaKey: true })).ctrl).toBe(true)
  })
})

describe('wheelIntent', () => {
  it('scrolls the view by default, whatever the device', () => {
    expect(wheelIntent(sample({ dy: 120 }), 'pan', rates)).toEqual({ type: 'pan', dx: 0, dy: 120 })
    expect(wheelIntent(sample({ dx: 3, dy: 7 }), 'pan', rates)).toEqual({
      type: 'pan',
      dx: 3,
      dy: 7,
    })
  })

  it('zooms with Ctrl / ⌘ and a pinch under every behaviour', () => {
    for (const behavior of ['pan', 'zoom', 'cooperative'] as const) {
      expect(wheelIntent(sample({ dy: -5, ctrl: true }), behavior, rates).type).toBe('zoom')
    }
  })

  it('eases a notch and applies a pinch at once (smoothing only)', () => {
    expect(wheelIntent(sample({ dy: 100, ctrl: true }), 'pan', rates)).toEqual({
      type: 'zoom',
      dln: -0.18,
      smooth: true,
    })
    expect(wheelIntent(sample({ dy: -5, ctrl: true }), 'pan', rates)).toEqual({
      type: 'zoom',
      dln: 0.05,
      smooth: false,
    })
  })

  it('zooms a plain wheel under `zoom`, and still scrolls sideways', () => {
    expect(wheelIntent(sample({ dy: 100 }), 'zoom', rates).type).toBe('zoom')
    expect(wheelIntent(sample({ dx: 100 }), 'zoom', rates)).toEqual({ type: 'pan', dx: 100, dy: 0 })
  })

  it('does the other of scroll and zoom with Alt', () => {
    expect(wheelIntent(sample({ dy: 100, alt: true }), 'pan', rates).type).toBe('zoom')
    expect(wheelIntent(sample({ dy: 100, alt: true }), 'zoom', rates).type).toBe('pan')
  })

  it('leaves a plain wheel to the page under `cooperative`', () => {
    expect(wheelIntent(sample({ dy: 100 }), 'cooperative', rates)).toEqual({ type: 'page' })
    expect(wheelIntent(sample({ dy: 100, alt: true }), 'cooperative', rates)).toEqual({
      type: 'page',
    })
  })

  it('caps one step', () => {
    const big = wheelIntent(sample({ dy: 5000 }), 'zoom', rates)
    expect(big).toEqual({ type: 'zoom', dln: -300 * 0.0018, smooth: true })
  })
})
