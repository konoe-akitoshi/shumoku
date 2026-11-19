// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * The camera's arithmetic, free of the DOM. A view is held in the container's CSS pixels
 * (`screen = world × z + (x, y)`), so a finger's pixel moves the picture one pixel whatever the
 * diagram's size, and a view keeps pointing at the same place when the drawing's bounds change.
 * The viewBox is only met when the view is written as the viewport's transform.
 */

/** Where the world is on screen: `screen = world × z + (x, y)`, in the container's CSS px. */
export interface View {
  x: number
  y: number
  z: number
}

/** The svg's viewBox (world units) and the container's size (CSS px). */
export interface Frame {
  vbX: number
  vbY: number
  vbW: number
  vbH: number
  cw: number
  ch: number
}

/** The viewport transform, in the viewBox's units: `translate(tx, ty) scale(k)`. */
export interface ViewportTransform {
  k: number
  tx: number
  ty: number
}

/** Whether a frame can be drawn into: every length finite and positive. */
export function isUsable(f: Frame): boolean {
  return [f.vbW, f.vbH, f.cw, f.ch].every((v) => Number.isFinite(v) && v > 0)
}

/**
 * How the svg shows its viewBox (`preserveAspectRatio` xMidYMid meet): one world unit is `s` CSS
 * px, and the viewBox's corner lands at `(ox, oy)`.
 */
export function frameScale(f: Frame): { s: number; ox: number; oy: number } {
  const s = Math.min(f.cw / f.vbW, f.ch / f.vbH)
  return { s, ox: (f.cw - f.vbW * s) / 2, oy: (f.ch - f.vbH * s) / 2 }
}

/** The viewport transform that shows `view`. */
export function toTransform(view: View, f: Frame): ViewportTransform {
  const { s, ox, oy } = frameScale(f)
  return { k: view.z / s, tx: (view.x - ox) / s + f.vbX, ty: (view.y - oy) / s + f.vbY }
}

/** The view a viewport transform shows. */
export function fromTransform(t: ViewportTransform, f: Frame): View {
  const { s, ox, oy } = frameScale(f)
  return { x: (t.tx - f.vbX) * s + ox, y: (t.ty - f.vbY) * s + oy, z: t.k * s }
}

/** The whole drawing, as the bare svg shows it. */
export function fitView(f: Frame): View {
  return fromTransform({ k: 1, tx: 0, ty: 0 }, f)
}

/** Scale by `factor` about a screen point, which stays where it is; `z` kept within `[min, max]`. */
export function zoomAround(
  view: View,
  factor: number,
  ax: number,
  ay: number,
  min: number,
  max: number,
): View {
  const z = Math.min(max, Math.max(min, view.z * factor))
  if (!Number.isFinite(z) || z <= 0) return view
  const r = z / view.z
  return { x: ax - (ax - view.x) * r, y: ay - (ay - view.y) * r, z }
}

/**
 * Keep some of the drawing on screen: its box must reach at least `min(80 px, a quarter of the
 * container)` inside each edge, so a pan or a zoom never loses it.
 */
export function keepInView(view: View, f: Frame): View {
  const clampAxis = (pos: number, start: number, size: number, screen: number) => {
    const margin = Math.min(80, screen / 4)
    const lo = start * view.z + pos
    const hi = (start + size) * view.z + pos
    if (hi < margin) return pos + (margin - hi)
    if (lo > screen - margin) return pos - (lo - (screen - margin))
    return pos
  }
  const x = clampAxis(view.x, f.vbX, f.vbW, f.cw)
  const y = clampAxis(view.y, f.vbY, f.vbH, f.ch)
  return x === view.x && y === view.y ? view : { x, y, z: view.z }
}

/**
 * The view that shows a world box whole, with `padding` (a fraction of the box's size) around it,
 * its zoom kept within `[min, max]`.
 */
export function frameBox(
  box: { x: number; y: number; width: number; height: number },
  f: Frame,
  padding: number,
  min: number,
  max: number,
): View {
  const w = Math.max(box.width, 1) * (1 + 2 * padding)
  const h = Math.max(box.height, 1) * (1 + 2 * padding)
  const z = Math.min(max, Math.max(min, Math.min(f.cw / w, f.ch / h)))
  return centreOn(box, z, f)
}

/**
 * A smooth flight from one view to another (van Wijk & Nuij, "Smooth and efficient zooming and
 * panning", 2003: zoom out, pan, zoom in, the path a viewer perceives as shortest; d3's
 * `interpolateZoom`). `at(t)` for `t` in [0, 1]; `length` is the path's length in its own measure,
 * about one per screen of travel, for choosing a duration.
 */
export function flight(from: View, to: View, f: Frame): { at(t: number): View; length: number } {
  const rho = Math.SQRT2
  // A view as the world point at the container's centre and the world width it shows.
  const centre = (v: View): [number, number, number] => [
    (f.cw / 2 - v.x) / v.z,
    (f.ch / 2 - v.y) / v.z,
    f.cw / v.z,
  ]
  const view = (cx: number, cy: number, w: number): View => {
    const z = f.cw / w
    return { x: f.cw / 2 - cx * z, y: f.ch / 2 - cy * z, z }
  }
  const [ux0, uy0, w0] = centre(from)
  const [ux1, uy1, w1] = centre(to)
  const dx = ux1 - ux0
  const dy = uy1 - uy0
  const d2 = dx * dx + dy * dy
  if (d2 < 1e-12) {
    const S = Math.log(w1 / w0) / rho
    return {
      at: (t) => view(ux0 + t * dx, uy0 + t * dy, w0 * Math.exp(rho * t * S)),
      length: Math.abs(S),
    }
  }
  const d1 = Math.sqrt(d2)
  const b0 = (w1 * w1 - w0 * w0 + 4 * d2) / (2 * w0 * 2 * d1)
  const b1 = (w1 * w1 - w0 * w0 - 4 * d2) / (2 * w1 * 2 * d1)
  const r0 = Math.log(Math.sqrt(b0 * b0 + 1) - b0)
  const r1 = Math.log(Math.sqrt(b1 * b1 + 1) - b1)
  const S = (r1 - r0) / rho
  return {
    at: (t) => {
      if (t >= 1) return to
      const s = t * S
      const u = (w0 / (2 * d1)) * (Math.cosh(r0) * Math.tanh(rho * s + r0) - Math.sinh(r0))
      return view(ux0 + u * dx, uy0 + u * dy, (w0 * Math.cosh(r0)) / Math.cosh(rho * s + r0))
    },
    length: Math.abs(S),
  }
}

/** The view that centres a world box at `z`. */
export function centreOn(
  box: { x: number; y: number; width: number; height: number },
  z: number,
  f: Frame,
): View {
  return {
    x: f.cw / 2 - (box.x + box.width / 2) * z,
    y: f.ch / 2 - (box.y + box.height / 2) * z,
    z,
  }
}
