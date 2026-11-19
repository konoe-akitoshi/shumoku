// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * What a wheel event means for the camera, free of the DOM.
 *
 * A page cannot tell a mouse wheel from a touchpad: both arrive as `wheel` events, and on some
 * systems (Chrome on X11, legacy Windows touchpad drivers) the browser does not know either. So
 * nothing is guessed. A plain wheel does what `WheelBehavior` says (scroll the view by default, as
 * Figma, tldraw, Excalidraw, Visio and draw.io do); Ctrl/⌘ + wheel always zooms, and so does a
 * touchpad pinch, which browsers deliver as a Ctrl + wheel; Shift + wheel scrolls sideways; Alt +
 * wheel does the other of scroll and zoom.
 *
 * Units follow normalize-wheel: a line is 40 px, a page 800 px.
 */

/** The choice a person makes for their own wheel (a host picks `cooperative` for embedded views). */
export type WheelChoice = Exclude<WheelBehavior, 'cooperative'>

/**
 * What a plain wheel does: `pan` scrolls the view (the default), `zoom` zooms it, `cooperative`
 * leaves it to the page (a diagram inside a page that scrolls, as Google Maps embedded: only Ctrl /
 * ⌘ + wheel and pinch reach the diagram).
 */
export type WheelBehavior = 'pan' | 'zoom' | 'cooperative'

export interface WheelSample {
  /** CSS px; Shift turns a vertical wheel horizontal. */
  dx: number
  dy: number
  /** Ctrl or ⌘: an explicit zoom (and how browsers deliver a touchpad pinch). */
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
    'deltaMode' | 'deltaX' | 'deltaY' | 'ctrlKey' | 'metaKey' | 'shiftKey' | 'altKey'
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
  return { dx, dy, ctrl: e.ctrlKey || e.metaKey, alt: e.altKey }
}

export interface WheelRates {
  /** ln of the zoom per CSS px of a wheel step (0.0018: a 100 px notch is ×1.2). */
  wheel: number
  /** ln of the zoom per CSS px of a pinch (0.01: one to one with a macOS pinch). */
  pinch: number
}

/**
 * A zoom delta this large is a step (a wheel notch, eased toward); smaller ones are a pinch's
 * continuous stream (applied at once). This only sets the smoothing, never what the gesture does.
 */
export const ZOOM_STEP = 40

export type WheelIntent =
  | { type: 'pan'; dx: number; dy: number }
  /** `smooth`: eased toward (a wheel step), else applied at once (a pinch). ln of the factor. */
  | { type: 'zoom'; dln: number; smooth: boolean }
  /** Not the diagram's: the page scrolls (`cooperative`). */
  | { type: 'page' }

const clamp = (v: number, limit: number) => Math.max(-limit, Math.min(limit, v))

function zoomOf(dy: number, rates: WheelRates): WheelIntent {
  return Math.abs(dy) >= ZOOM_STEP
    ? { type: 'zoom', dln: -clamp(dy, 300) * rates.wheel, smooth: true }
    : { type: 'zoom', dln: -dy * rates.pinch, smooth: false }
}

/** What the event asks of the camera. */
export function wheelIntent(
  s: WheelSample,
  behavior: WheelBehavior,
  rates: WheelRates,
): WheelIntent {
  if (s.ctrl) return zoomOf(s.dy, rates)
  if (behavior === 'cooperative') return { type: 'page' }
  const zooms = (behavior === 'zoom') !== s.alt
  if (!zooms || s.dy === 0) return { type: 'pan', dx: s.dx, dy: s.dy }
  return zoomOf(s.dy, rates)
}
