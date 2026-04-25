// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Camera (pan + zoom) attachment utility for Shumoku's rendered SVG.
 *
 * Intentionally NOT bundled into `<ShumokuRenderer>` itself — camera
 * requirements differ per host app, so apps call `attachCamera(svg)`
 * when they want pan/zoom.
 *
 * Wheel handling delegates to the `wheel-gestures` library. It
 * contributes two things the hand-rolled version couldn't nail:
 *
 * 1. A reliable `isStart` flag for the first event of a gesture. We
 *    use it to pick mouse vs trackpad exactly once per gesture, so
 *    subsequent ambiguous events (fractional deltaY from Chrome's
 *    smooth-scroll, mid-gesture dropped ctrlKey, etc.) can't flip the
 *    verdict.
 * 2. `isMomentum` identifies post-gesture inertia events so we can
 *    ignore them — the biggest source of "zoom flipped to pan
 *    mid-gesture" in the original implementation was a pinch's
 *    momentum tail arriving without ctrlKey.
 *
 * UX policy (Figma/Miro-style, common for canvas editors):
 * - **Mouse wheel** (plain)        → zoom at cursor
 * - **Mouse ctrl+wheel**           → zoom at cursor (explicit)
 * - **Trackpad two-finger**        → pan
 * - **Trackpad pinch**             → zoom at cursor
 *     (browsers synthesise ctrlKey=true on trackpad pinch)
 *
 * Device detection runs at `isStart` only. Once picked, the gesture
 * stays in that mode even if individual events look ambiguous.
 */

import { select } from 'd3-selection'
import { type D3ZoomEvent, type ZoomBehavior, zoom, zoomIdentity, zoomTransform } from 'd3-zoom'
import { type WheelEventState, WheelGestures } from 'wheel-gestures'

export type PanFilter = (event: PointerEvent | MouseEvent) => boolean

export interface CameraOptions {
  /** Zoom scale bounds. Default: [0.2, 10]. */
  scaleExtent?: [number, number]
  /**
   * Predicate: pointer-down events that should start a pan. Default:
   * middle-button or Alt+left-click — leaves plain left-click free for
   * selection handlers in the renderer.
   */
  panFilter?: PanFilter
  /**
   * Zoom sensitivity for mouse wheel and mouse ctrl+wheel (one big
   * discrete deltaY per tick). Default 1.0015 — a typical mouse tick
   * (deltaY ≈ 100) → ~14% zoom.
   */
  wheelZoomSensitivity?: number
  /**
   * Zoom sensitivity for trackpad pinches (many small ctrlKey-wheel
   * events per frame). Default 1.01 — deltaY ≈ 10 → ~10% per event.
   */
  pinchZoomSensitivity?: number
}

export interface Camera {
  /** The current transform applied to the viewport. */
  getTransform(): { x: number; y: number; k: number }
  /** Scale by a factor, centred on the viewBox. */
  zoomBy(factor: number): void
  /** Set the absolute scale, optionally focused on a screen-space point. */
  zoomTo(scale: number, point?: [number, number]): void
  /** Set the absolute translation (viewport-space). */
  panTo(x: number, y: number): void
  /**
   * Pan+zoom so a node with `data-id=nodeId` fills roughly `areaRatio`
   * of the viewport (default 5%). Returns true if the node was found.
   */
  panToNode(nodeId: string, areaRatio?: number): boolean
  /** Reset to identity transform. */
  reset(): void
  /** Detach all listeners. Safe to call multiple times. */
  detach(): void
}

const DEFAULT_PAN_FILTER: PanFilter = (e) =>
  ('button' in e && e.button === 1) || ('altKey' in e && e.altKey === true)

/**
 * Magnitude above which a single wheel event is considered a mouse
 * wheel tick (vs. a trackpad scroll frame). Chrome's smooth-scroll
 * emits fractional deltaY even for mouse ticks, so we can't rely on
 * `Number.isInteger(deltaY)` — magnitude is the practical signal.
 */
const MOUSE_TICK_THRESHOLD = 50

/**
 * Classify the very first event of a gesture. Only called at
 * `state.isStart === true`, so the verdict doesn't flip within the
 * gesture no matter what individual frames look like.
 */
function detectDevice(e: WheelEvent, axisDeltaX: number, axisDeltaY: number): 'mouse' | 'trackpad' {
  // Firefox's LINE/PAGE deltaMode is only ever produced by mouse wheels.
  if (e.deltaMode !== 0) return 'mouse'
  // A trackpad is the only device that routinely emits horizontal
  // scroll on the wheel event stream.
  if (Math.abs(axisDeltaX) > 0) return 'trackpad'
  // Otherwise the only reliable signal left is magnitude: a mouse
  // wheel tick is large (≥ 50 after normalisation), a trackpad frame
  // during an active gesture is small.
  return Math.abs(axisDeltaY) >= MOUSE_TICK_THRESHOLD ? 'mouse' : 'trackpad'
}

/**
 * Attach a pan+zoom camera to an svg with a `<g class="viewport">` child.
 * Returns a handle with imperative controls + a `detach()` cleanup.
 */
export function attachCamera(svg: SVGSVGElement, options: CameraOptions = {}): Camera {
  const {
    scaleExtent = [0.2, 10],
    panFilter = DEFAULT_PAN_FILTER,
    wheelZoomSensitivity = 1.0015,
    pinchZoomSensitivity = 1.01,
  } = options

  const viewportEl = svg.querySelector<SVGGElement>('.viewport')
  if (!viewportEl) {
    throw new Error(
      '[attachCamera] no `.viewport` <g> found in svg — ShumokuRenderer always produces one; was this called on the wrong element?',
    )
  }

  // The renderer uses a viewBox sized to the layout bounds; the svg
  // element itself is CSS-sized 100% of its container. That means the
  // viewBox user-space unit is NOT one CSS pixel. d3-zoom applies its
  // transform as an SVG `transform` attribute on the viewport <g>,
  // which is interpreted in user-space — so we feed d3-zoom user-space
  // everywhere (extent = viewBox, wheel points converted via
  // `svg.getScreenCTM().inverse()`). Otherwise the cursor drifts from
  // the zoom focus by a factor of the viewBox scale.

  const cursorToUserCoords = (clientX: number, clientY: number): [number, number] | null => {
    const ctm = svg.getScreenCTM()?.inverse()
    if (!ctm) return null
    const pt = svg.createSVGPoint()
    pt.x = clientX
    pt.y = clientY
    const p = pt.matrixTransform(ctm)
    return [p.x, p.y]
  }

  const svgSel = select(svg)
  const zoomBehavior: ZoomBehavior<SVGSVGElement, unknown> = zoom<SVGSVGElement, unknown>()
    .scaleExtent(scaleExtent)
    .extent((): [[number, number], [number, number]] => {
      const vb = svg.viewBox.baseVal
      if (vb.width === 0 || vb.height === 0) {
        return [
          [0, 0],
          [svg.clientWidth, svg.clientHeight],
        ]
      }
      return [
        [vb.x, vb.y],
        [vb.x + vb.width, vb.y + vb.height],
      ]
    })
    .filter((e) => {
      // wheel-gestures drives wheel handling; d3-zoom's own wheel
      // path is disabled so the two don't both respond to one event.
      if (e.type === 'wheel') return false
      if (e.type === 'mousedown' || e.type === 'pointerdown') {
        return panFilter(e as PointerEvent | MouseEvent)
      }
      return false
    })
    .on('zoom', (e: D3ZoomEvent<SVGSVGElement, unknown>) => {
      viewportEl.setAttribute('transform', e.transform.toString())
    })

  svgSel.call(zoomBehavior)
  svgSel.on('contextmenu.zoom', null)

  // Sticky per-gesture device verdict — set at `isStart`, read on
  // every subsequent event in the same gesture.
  let gestureDevice: 'mouse' | 'trackpad' = 'mouse'

  const wg = WheelGestures({ preventWheelAction: true })
  const unobserve = wg.observe(svg)
  const offWheel = wg.on('wheel', (state: WheelEventState) => {
    const rawEvent = state.event as WheelEvent

    // Detect device only on the first event of a gesture — `isStart`
    // is reliable thanks to wheel-gestures' momentum tracking.
    if (state.isStart) {
      gestureDevice = detectDevice(rawEvent, rawEvent.deltaX, rawEvent.deltaY)
    }

    const point = cursorToUserCoords(rawEvent.clientX, rawEvent.clientY)
    if (!point) return

    // Zoom: ctrl/meta active + NOT momentum. Skipping momentum here
    // prevents a post-pinch inertia tail from continuing to zoom
    // after the user's fingers have lifted.
    if ((rawEvent.ctrlKey || rawEvent.metaKey) && !state.isMomentum) {
      const sensitivity = gestureDevice === 'mouse' ? wheelZoomSensitivity : pinchZoomSensitivity
      zoomBehavior.scaleBy(svgSel, sensitivity ** -rawEvent.deltaY, point)
      return
    }

    // For mouse wheel (no ctrl): zoom. Mouse wheels don't emit
    // OS-level momentum so `isMomentum` is effectively always false
    // here; guarding on it anyway means if some system does emit
    // momentum-like events, we don't double-fire a zoom step.
    if (gestureDevice === 'mouse') {
      if (state.isMomentum) return
      zoomBehavior.scaleBy(svgSel, wheelZoomSensitivity ** -rawEvent.deltaY, point)
      return
    }

    // Trackpad two-finger → pan. We deliberately do NOT skip momentum
    // here: it's the inertia after a flick, and users expect a
    // trackpad pan to decelerate naturally instead of snapping to a
    // stop. Divide by k so on-screen pan distance matches the wheel
    // delta regardless of current zoom level.
    const current = zoomTransform(svg)
    zoomBehavior.translateBy(svgSel, -rawEvent.deltaX / current.k, -rawEvent.deltaY / current.k)
  })

  const viewBoxCenter = (): [number, number] => {
    const vb = svg.viewBox.baseVal
    if (vb.width === 0 || vb.height === 0) {
      return [svg.clientWidth / 2, svg.clientHeight / 2]
    }
    return [vb.x + vb.width / 2, vb.y + vb.height / 2]
  }

  return {
    getTransform() {
      const t = zoomTransform(svg)
      return { x: t.x, y: t.y, k: t.k }
    },

    zoomBy(factor: number) {
      zoomBehavior.scaleBy(svgSel, factor, viewBoxCenter())
    },

    zoomTo(scale: number, point?: [number, number]) {
      zoomBehavior.scaleTo(svgSel, scale, point ?? viewBoxCenter())
    },

    panTo(x: number, y: number) {
      const current = zoomTransform(svg)
      zoomBehavior.transform(svgSel, zoomIdentity.translate(x, y).scale(current.k))
    },

    panToNode(nodeId: string, areaRatio = 0.05): boolean {
      const cssEscapedId =
        typeof CSS !== 'undefined' && 'escape' in CSS ? CSS.escape(nodeId) : nodeId
      const node = svg.querySelector<SVGGElement>(`g.node[data-id="${cssEscapedId}"]`)
      if (!node) return false

      // Work entirely in user-space: getBBox() returns bounds in the
      // viewport's local coords, then translate to centre it in the
      // viewBox at the target scale.
      const bbox = node.getBBox()
      const vb = svg.viewBox.baseVal
      const vbCx = vb.x + vb.width / 2
      const vbCy = vb.y + vb.height / 2

      const targetK = Math.max(
        scaleExtent[0],
        Math.min(
          scaleExtent[1],
          Math.sqrt((vb.width * vb.height * areaRatio) / (bbox.width * bbox.height)),
        ),
      )

      const nodeCx = bbox.x + bbox.width / 2
      const nodeCy = bbox.y + bbox.height / 2
      const tx = vbCx - nodeCx * targetK
      const ty = vbCy - nodeCy * targetK

      zoomBehavior.transform(svgSel, zoomIdentity.translate(tx, ty).scale(targetK))
      return true
    },

    reset() {
      zoomBehavior.transform(svgSel, zoomIdentity)
    },

    detach() {
      offWheel()
      unobserve()
      svgSel.on('.zoom', null)
      viewportEl.removeAttribute('transform')
    },
  }
}
