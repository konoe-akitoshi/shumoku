// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * What a wheel event means for the camera, free of the DOM. A page cannot tell a mouse wheel from
 * a trackpad: browsers hand both over as `wheel` events. The guess is MapLibre's (`scroll_zoom.ts`;
 * OpenLayers' `MouseWheelZoom` decides the same way): a multiple of 4.000244140625 is a wheel, a
 * delta under 4 px a trackpad, and otherwise the first event after a 400 ms pause waits 40 ms:
 * alone it was a wheel notch, followed it is a trackpad when the two are small and quick
 * (`|dt · d| < 200`). The kind then holds until the next pause. A wrong guess is always undone:
 * Ctrl/⌘ + wheel and pinch zoom, Alt + wheel does the other thing, `wheelBehavior` turns it off.
 *
 * Units follow normalize-wheel and MapLibre: a line is 40 px, a page 800 px.
 */

export type WheelKind = 'wheel' | 'trackpad'
export type WheelBehavior = 'auto' | 'zoom' | 'pan'

export interface WheelSample {
  /** `event.timeStamp`, ms. */
  t: number
  /** CSS px; Shift turns a vertical wheel horizontal. */
  dx: number
  dy: number
  /** Ctrl or ⌘: an explicit zoom (and how browsers deliver a trackpad pinch). */
  ctrl: boolean
  alt: boolean
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
): WheelSample {
  const unit = e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? 800 : 1
  let dx = e.deltaX * unit
  let dy = e.deltaY * unit
  // Windows and Linux leave Shift + wheel vertical; macOS has already swapped it.
  if (e.shiftKey && dx === 0) {
    dx = dy
    dy = 0
  }
  return { t: e.timeStamp, dx, dy, ctrl: e.ctrlKey || e.metaKey, alt: e.altKey }
}

/** A mouse wheel notch as Chrome and Safari on macOS report it (MapLibre's `wheelZoomDelta`). */
export const WHEEL_NOTCH = 4.000244140625
/** A pause this long starts a new gesture, whose kind is decided afresh. */
export const GESTURE_GAP = 400
/** How long the first event of a gesture waits for a second before it is taken for a wheel. */
export const SETTLE_WAIT = 40

export interface ClassifierState {
  /** This gesture's kind; `undefined` while its first event waits. */
  kind: WheelKind | undefined
  lastT: number
}

export const initialClassifier = (): ClassifierState => ({
  kind: undefined,
  lastT: Number.NEGATIVE_INFINITY,
})

/**
 * The kind of device this event comes from, or `undefined`: wait `SETTLE_WAIT` for the next event
 * (then `classify` it) or, if none comes, `settle` the gesture as a wheel. A kind found while an
 * event waits is that event's kind too.
 */
export function classify(
  s: WheelSample,
  state: ClassifierState,
): { kind: WheelKind | undefined; state: ClassifierState } {
  const v = s.dy
  const dt = s.t - state.lastT
  let kind = state.kind
  if (v !== 0 && v % WHEEL_NOTCH === 0) kind = 'wheel'
  else if (v !== 0 && Math.abs(v) < 4) kind = 'trackpad'
  else if (dt > GESTURE_GAP) kind = undefined
  else if (kind === undefined) kind = Math.abs(dt * v) < 200 ? 'trackpad' : 'wheel'
  return { kind, state: { kind, lastT: s.t } }
}

/** No second event came: the gesture was a wheel. */
export const settle = (state: ClassifierState): ClassifierState => ({ ...state, kind: 'wheel' })

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
