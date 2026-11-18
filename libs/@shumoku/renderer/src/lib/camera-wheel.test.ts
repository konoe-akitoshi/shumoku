// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { describe, expect, it } from 'vitest'
import {
  type ClassifierState,
  classify,
  initialClassifier,
  normalizeWheel,
  settle,
  WHEEL_NOTCH,
  type WheelKind,
  type WheelSample,
  wheelIntent,
} from './camera-wheel.js'

const rates = { wheel: 0.0018, pinch: 0.01 }

const sample = (over: Partial<WheelSample>): WheelSample => ({
  t: 1000,
  dx: 0,
  dy: 0,
  ctrl: false,
  alt: false,
  ...over,
})

/** Classify a run of events in order; the kinds they were taken for (`undefined`: waits). */
function run(
  events: Partial<WheelSample>[],
  start: ClassifierState = initialClassifier(),
): { kinds: (WheelKind | undefined)[]; state: ClassifierState } {
  let state = start
  const kinds: (WheelKind | undefined)[] = []
  for (const e of events) {
    const r = classify(sample(e), state)
    kinds.push(r.kind)
    state = r.state
  }
  return { kinds, state }
}

describe('normalizeWheel', () => {
  const event = (over: Partial<WheelEvent>) =>
    ({
      deltaMode: 0,
      deltaX: 0,
      deltaY: 0,
      timeStamp: 5,
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

describe('classify (MapLibre)', () => {
  it('takes a multiple of the macOS notch for a wheel at once', () => {
    expect(run([{ dy: WHEEL_NOTCH }]).kinds).toEqual(['wheel'])
    expect(run([{ dy: -3 * WHEEL_NOTCH }]).kinds).toEqual(['wheel'])
  })

  it('takes a delta under 4 px for a trackpad at once', () => {
    expect(run([{ dy: 2.5 }]).kinds).toEqual(['trackpad'])
  })

  it('holds the first event of a gesture otherwise', () => {
    expect(run([{ dy: 120 }]).kinds).toEqual([undefined])
  })

  it('takes a lone first event for a wheel notch', () => {
    const { state } = run([{ dy: 120 }])
    expect(settle(state).kind).toBe('wheel')
  })

  it('takes small, quick events for a trackpad (|dt · d| < 200)', () => {
    const events = [10, 8, 12, 9].map((dy, i) => ({ t: 1000 + i * 16, dy }))
    expect(run(events).kinds).toEqual([undefined, 'trackpad', 'trackpad', 'trackpad'])
  })

  it('takes a fast spin of large notches for a wheel', () => {
    const events = [0, 16, 32].map((t) => ({ t: 1000 + t, dy: 120 }))
    expect(run(events).kinds).toEqual([undefined, 'wheel', 'wheel'])
  })

  it('holds a kind for the gesture: a trackpad flick does not turn into a zoom', () => {
    const events = [
      { t: 1000, dy: 10 },
      { t: 1016, dy: 9 },
      { t: 1032, dy: 120 },
    ]
    expect(run(events).kinds).toEqual([undefined, 'trackpad', 'trackpad'])
  })

  it('decides afresh after a 400 ms pause', () => {
    const first = run([
      { t: 1000, dy: 10 },
      { t: 1016, dy: 9 },
    ])
    expect(run([{ t: 2000, dy: 120 }], first.state).kinds).toEqual([undefined])
  })
})

describe('wheelIntent', () => {
  it('zooms with Ctrl / ⌘ or a pinch, whatever the setting', () => {
    const pinch = wheelIntent(sample({ dy: -5, ctrl: true }), 'trackpad', 'pan', rates)
    expect(pinch).toEqual({ type: 'zoom', dln: 0.05, smooth: false })
    const ctrlWheel = wheelIntent(sample({ dy: 100, ctrl: true }), 'wheel', 'pan', rates)
    expect(ctrlWheel).toEqual({ type: 'zoom', dln: -0.18, smooth: true })
  })

  it('zooms with a wheel and pans with a trackpad under Auto', () => {
    expect(wheelIntent(sample({ dy: 100 }), 'wheel', 'auto', rates).type).toBe('zoom')
    expect(wheelIntent(sample({ dy: 10 }), 'trackpad', 'auto', rates)).toEqual({
      type: 'pan',
      dx: 0,
      dy: 10,
    })
  })

  it('follows the setting over the guess', () => {
    expect(wheelIntent(sample({ dy: 100 }), 'wheel', 'pan', rates).type).toBe('pan')
    expect(wheelIntent(sample({ dy: 10 }), 'trackpad', 'zoom', rates).type).toBe('zoom')
  })

  it('does the other thing with Alt', () => {
    expect(wheelIntent(sample({ dy: 100, alt: true }), 'wheel', 'auto', rates).type).toBe('pan')
    expect(wheelIntent(sample({ dy: 10, alt: true }), 'trackpad', 'auto', rates).type).toBe('zoom')
  })

  it('always scrolls sideways for a horizontal-only delta (tilt wheel, Shift)', () => {
    expect(wheelIntent(sample({ dx: 100 }), 'wheel', 'zoom', rates)).toEqual({
      type: 'pan',
      dx: 100,
      dy: 0,
    })
  })

  it('caps one event', () => {
    const big = wheelIntent(sample({ dy: 5000 }), 'wheel', 'auto', rates)
    expect(big).toEqual({ type: 'zoom', dln: -300 * 0.0018, smooth: true })
  })
})
