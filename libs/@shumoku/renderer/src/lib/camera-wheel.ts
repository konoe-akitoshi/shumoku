// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * What a wheel event means for the camera, free of the DOM. A page cannot tell a mouse wheel from
 * a trackpad: browsers hand both over as `wheel` events, and the deltas differ by OS, browser,
 * driver and settings. So the guess is made per burst of events from evidence (a notch's exact
 * values, a trackpad's fine and diagonal ones, their rate), leans to panning when unsure (a wrong
 * pan is milder than a wrong zoom), and can always be overridden: Ctrl/⌘ + wheel and pinch zoom,
 * Alt + wheel does the other thing, and `wheelBehavior` turns the guess off.
 *
 * The evidence follows MapLibre's scroll handler (notch values, `|d| < 4`, `|dt · d| < 200`, a
 * 400 ms gap) and normalize-wheel (a line is 40 px, a page 800 px).
 */

export type WheelKind = 'wheel' | 'trackpad'
export type WheelBehavior = 'auto' | 'zoom' | 'pan'

export interface WheelSample {
  /** `event.timeStamp`, ms. */
  t: number
  /** CSS px; Shift turns a vertical wheel horizontal. */
  dx: number
  dy: number
  /** The event's own `deltaMode` and deltas. */
  mode: number
  rawX: number
  rawY: number
  /** Ctrl or ⌘: an explicit zoom (and how browsers deliver a trackpad pinch). */
  ctrl: boolean
  alt: boolean
  dpr: number
}

/**
 * The event's deltas in CSS px. `deltaMode` is read first: Firefox hands out lines only to a page
 * that asks for the mode before the deltas.
 */
export function normalizeWheel(
  e: Pick<
    WheelEvent,
    'deltaMode' | 'deltaX' | 'deltaY' | 'timeStamp' | 'ctrlKey' | 'metaKey' | 'shiftKey' | 'altKey'
  >,
  dpr = 1,
): WheelSample {
  const mode = e.deltaMode
  const rawX = e.deltaX
  const rawY = e.deltaY
  const unit = mode === 1 ? 40 : mode === 2 ? 800 : 1
  let dx = rawX * unit
  let dy = rawY * unit
  // Windows and Linux leave Shift + wheel vertical; macOS has already swapped it.
  if (e.shiftKey && dx === 0) {
    dx = dy
    dy = 0
  }
  return {
    t: e.timeStamp,
    dx,
    dy,
    mode,
    rawX,
    rawY,
    ctrl: e.ctrlKey || e.metaKey,
    alt: e.altKey,
    dpr: dpr > 0 ? dpr : 1,
  }
}

/** Notch sizes browsers report: Chrome and Edge (100), Windows' 120, Chrome per line (100/3). */
const NOTCHES = [100, 120, 100 / 3]
/** A slow macOS mouse notch as Chrome and Safari report it (MapLibre). */
const MAC_NOTCH = 4.000244140625

/** Whether `v` is a whole number of some notch size. */
export function isNotch(v: number): boolean {
  if (v < 30) return false
  return NOTCHES.some((n) => {
    const k = Math.round(v / n)
    return k >= 1 && Math.abs(v - k * n) < 0.05
  })
}

function isMacNotch(v: number): boolean {
  const k = Math.round(v / MAC_NOTCH)
  return k >= 1 && Math.abs(v - k * MAC_NOTCH) < 0.01
}

export interface ClassifierState {
  /** What a burst without evidence is taken for; changes after two events say otherwise. */
  prior: WheelKind
  /** This burst's kind. */
  burst: WheelKind
  /** Whether the burst's kind came from evidence (else from `prior`, and evidence may still set it). */
  confident: boolean
  lastT: number
  lastA: number
  repeat: number
  opposite: number
}

export function initialClassifier(): ClassifierState {
  return {
    prior: 'trackpad',
    burst: 'trackpad',
    confident: false,
    lastT: Number.NEGATIVE_INFINITY,
    lastA: 0,
    repeat: 0,
    opposite: 0,
  }
}

/** A pause this long starts a new burst. */
export const BURST_GAP = 400

/** What this event says about the device, if anything. */
export function evidenceOf(
  s: WheelSample,
  state: ClassifierState,
  isMac: boolean,
): WheelKind | undefined {
  const a = Math.max(Math.abs(s.dx), Math.abs(s.dy))
  const dt = s.t - state.lastT
  const sameBurst = dt < BURST_GAP
  const repeat = sameBurst && a >= 16 && a === state.lastA ? state.repeat + 1 : 0
  const whole = Number.isInteger(s.rawX) && Number.isInteger(s.rawY)
  const vertical = s.dx === 0
  if (s.mode !== 0 && whole) return 'wheel'
  if (vertical && (isNotch(a) || isNotch(a * s.dpr) || isNotch(a / s.dpr))) return 'wheel'
  if (isMac && vertical && isMacNotch(a)) return 'wheel'
  if (vertical && repeat >= 2) return 'wheel'
  if (s.dx !== 0 && s.dy !== 0) return 'trackpad'
  if (a > 0 && a < 4) return 'trackpad'
  if (s.mode === 1 && !whole) return 'trackpad'
  if (sameBurst && a * dt < 200) return 'trackpad'
  return undefined
}

/**
 * The kind of device this event comes from, and the classifier's next state. A burst keeps the
 * kind its first evidence gave it, so a pan does not turn into a zoom half way.
 */
export function classify(
  s: WheelSample,
  state: ClassifierState,
  isMac: boolean,
): { kind: WheelKind; state: ClassifierState } {
  const a = Math.max(Math.abs(s.dx), Math.abs(s.dy))
  const sameBurst = s.t - state.lastT < BURST_GAP
  const evidence = evidenceOf(s, state, isMac)
  const repeat = sameBurst && a >= 16 && a === state.lastA ? state.repeat + 1 : 0

  let { prior, opposite } = state
  if (evidence && evidence !== prior) {
    opposite += 1
    if (opposite >= 2) {
      prior = evidence
      opposite = 0
    }
  } else if (evidence) {
    opposite = 0
  }

  let burst = state.burst
  let confident = state.confident
  if (!sameBurst) {
    burst = evidence ?? prior
    confident = evidence !== undefined
  } else if (!confident && evidence) {
    // A burst begun on the prior and now settled by evidence: the prior was wrong for this device.
    burst = evidence
    confident = true
    prior = evidence
    opposite = 0
  }

  return {
    kind: burst,
    state: { prior, burst, confident, lastT: s.t, lastA: a, repeat, opposite },
  }
}

export interface WheelRates {
  /** ln of the zoom per CSS px of a wheel notch (default 0.0018: a 100 px notch is ×1.2). */
  wheel: number
  /** ln of the zoom per CSS px of a pinch (default 0.01: one to one with a macOS pinch). */
  pinch: number
}

export type WheelIntent =
  | { type: 'pan'; dx: number; dy: number }
  /** `smooth`: eased toward (a wheel notch), else applied at once (a pinch). ln of the factor. */
  | { type: 'zoom'; dln: number; smooth: boolean }

const clamp = (v: number, limit: number) => Math.max(-limit, Math.min(limit, v))

/** What the event asks of the camera, given the device it is taken to come from. */
export function wheelIntent(
  s: WheelSample,
  kind: WheelKind,
  behavior: WheelBehavior,
  rates: WheelRates,
): WheelIntent {
  if (s.ctrl) {
    return kind === 'wheel'
      ? { type: 'zoom', dln: -clamp(s.dy, 300) * rates.wheel, smooth: true }
      : { type: 'zoom', dln: -clamp(s.dy, 40) * rates.pinch, smooth: false }
  }
  let as: WheelKind = behavior === 'zoom' ? 'wheel' : behavior === 'pan' ? 'trackpad' : kind
  if (s.alt) as = as === 'wheel' ? 'trackpad' : 'wheel'
  if (s.dy === 0 || as === 'trackpad') return { type: 'pan', dx: s.dx, dy: s.dy }
  return { type: 'zoom', dln: -clamp(s.dy, 300) * rates.wheel, smooth: true }
}
