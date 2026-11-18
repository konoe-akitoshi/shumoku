// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { describe, expect, it } from 'vitest'
import {
  type ClassifierState,
  classify,
  initialClassifier,
  isNotch,
  normalizeWheel,
  type WheelKind,
  type WheelSample,
  wheelIntent,
} from './camera-wheel.js'

const rates = { wheel: 0.0018, pinch: 0.01 }

const sample = (over: Partial<WheelSample>): WheelSample => ({
  t: 0,
  dx: 0,
  dy: 0,
  mode: 0,
  rawX: over.dx ?? 0,
  rawY: over.dy ?? 0,
  ctrl: false,
  alt: false,
  dpr: 1,
  ...over,
})

/** Classify a run of events in order; the kinds they were taken for. */
function run(
  events: Partial<WheelSample>[],
  isMac = false,
  start: ClassifierState = initialClassifier(),
): { kinds: WheelKind[]; state: ClassifierState } {
  let state = start
  const kinds: WheelKind[] = []
  for (const e of events) {
    const r = classify(sample(e), state, isMac)
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

describe('isNotch', () => {
  it.each([100, 200, 120, 240, 100 / 3, 200 / 3])('%s is a notch', (v) => {
    expect(isNotch(v)).toBe(true)
  })
  it.each([3, 17, 51.7, 87.2, 101.3])('%s is not', (v) => {
    expect(isNotch(v)).toBe(false)
  })
})

describe('classify', () => {
  it('takes a Chrome / Edge notch (±100) for a wheel', () => {
    expect(run([{ dy: 100 }]).kinds).toEqual(['wheel'])
  })

  it('takes a Firefox line notch for a wheel', () => {
    expect(run([{ mode: 1, dy: 120, rawY: 3 }]).kinds).toEqual(['wheel'])
  })

  it('takes a notch scaled by the display (125 %) for a wheel', () => {
    expect(run([{ dy: 80, dpr: 1.25 }]).kinds).toEqual(['wheel'])
  })

  it('takes a slow macOS mouse notch for a wheel on a Mac only', () => {
    expect(run([{ dy: 4.000244140625 }], true).kinds).toEqual(['wheel'])
    expect(run([{ dy: 4.000244140625 }], false).kinds).toEqual(['trackpad'])
  })

  it('takes fine, frequent deltas for a trackpad', () => {
    const events = [1, 3, 6, 9, 7].map((dy, i) => ({ t: i * 16, dy }))
    expect(run(events).kinds).toEqual(Array(5).fill('trackpad'))
  })

  it('takes diagonal deltas for a trackpad', () => {
    expect(run([{ dx: 7, dy: 12 }]).kinds).toEqual(['trackpad'])
  })

  it('takes a fractional Firefox line delta (X11 touchpad) for a trackpad', () => {
    expect(run([{ mode: 1, dy: 20, rawY: 0.5 }]).kinds).toEqual(['trackpad'])
  })

  it('pans when unsure: the first burst without evidence is a trackpad', () => {
    expect(run([{ dy: 47 }]).kinds).toEqual(['trackpad'])
  })

  it('learns a wheel from a value repeated three times, and keeps it for later bursts', () => {
    const burst = (t0: number) => [0, 60, 120].map((t) => ({ t: t0 + t, dy: 47 }))
    const first = run(burst(0))
    expect(first.kinds).toEqual(['trackpad', 'trackpad', 'wheel'])
    const second = run(burst(1000), false, first.state)
    expect(second.kinds).toEqual(['wheel', 'wheel', 'wheel'])
  })

  it('keeps a burst that started on evidence: a pan does not turn into a zoom', () => {
    const { kinds } = run([
      { t: 0, dy: 2 },
      { t: 16, dy: 100 },
    ])
    expect(kinds).toEqual(['trackpad', 'trackpad'])
  })

  it('lets evidence settle a burst begun on the prior', () => {
    const wheelPrior = { ...initialClassifier(), prior: 'wheel' as const, burst: 'wheel' as const }
    const { kinds } = run(
      [
        { t: 0, dy: 47 },
        { t: 16, dy: 2.5 },
      ],
      false,
      wheelPrior,
    )
    expect(kinds).toEqual(['wheel', 'trackpad'])
  })

  it('starts a new burst after a pause', () => {
    const { kinds } = run([
      { t: 0, dy: 2 },
      { t: 900, dy: 100 },
    ])
    expect(kinds).toEqual(['trackpad', 'wheel'])
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
