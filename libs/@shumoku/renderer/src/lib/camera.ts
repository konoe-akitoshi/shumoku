// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Camera (pan + zoom) attachment utility for Shumoku's rendered SVG.
 *
 * Intentionally NOT bundled into `<ShumokuRenderer>` itself — camera
 * requirements differ per host app (Miro-style for the editor, plain
 * left-drag for dashboards, read-only for share pages, etc.). Consumers
 * call `attachCamera(svg, options)` on the rendered svg element when
 * they want pan/zoom, and pass in a policy that fits their UX.
 *
 * Attaches d3-zoom to the svg; transforms the child `<g class="viewport">`
 * produced by ShumokuRenderer.
 */

import { select } from 'd3-selection'
import { type D3ZoomEvent, type ZoomBehavior, zoom, zoomIdentity, zoomTransform } from 'd3-zoom'

export type PanFilter = (event: PointerEvent | MouseEvent) => boolean

export type WheelMode =
  /**
   * Every wheel event zooms at the cursor (mouse-wheel-friendly).
   * Trackpad pinch still zooms independently via ctrl/meta detection.
   */
  | 'zoom'
  /**
   * Every wheel event pans (trackpad-friendly; two-finger scroll pans
   * the canvas in both axes). Pinch (ctrl/meta + wheel) zooms.
   */
  | 'pan'

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
   * What the mouse wheel does when no modifier is held. No default —
   * caller must pick `'zoom'` (mouse-centric apps) or `'pan'`
   * (trackpad-centric / infinite-canvas apps). Pinch (ctrl/meta +
   * wheel) always zooms regardless of `wheelMode`.
   */
  wheelMode: WheelMode
  /**
   * Zoom sensitivity exponent. The per-event scale factor is
   * `Math.pow(wheelZoomSensitivity, -deltaY)`. Higher = faster zoom.
   * Default 1.0015 — tuned so one mouse-wheel tick (`deltaY ≈ 100`)
   * ≈ 14% zoom, and trackpad pinches (`deltaY ≈ 3–5`) feel smooth.
   */
  wheelZoomSensitivity?: number
}

export interface Camera {
  /** The current transform applied to the viewport. */
  getTransform(): { x: number; y: number; k: number }
  /** Scale by a factor, centred on the svg. */
  zoomBy(factor: number): void
  /** Set the absolute scale, optionally focused on a screen-space point. */
  zoomTo(scale: number, point?: [number, number]): void
  /** Set the absolute translation (viewport-space). */
  panTo(x: number, y: number): void
  /**
   * Pan+zoom so a node with `data-id=nodeId` fills roughly `areaRatio` of
   * the viewport (default 5%). Returns true if the node was found.
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
 * Attach a pan+zoom camera to an svg with a `<g class="viewport">` child.
 * Returns a handle with imperative controls + a `detach()` cleanup.
 */
export function attachCamera(svg: SVGSVGElement, options: CameraOptions): Camera {
  const {
    scaleExtent = [0.2, 10],
    panFilter = DEFAULT_PAN_FILTER,
    wheelMode,
    wheelZoomSensitivity = 1.0015,
  } = options

  const viewportEl = svg.querySelector<SVGGElement>('.viewport')
  if (!viewportEl) {
    throw new Error(
      '[attachCamera] no `.viewport` <g> found in svg — ShumokuRenderer always produces one; was this called on the wrong element?',
    )
  }

  // The renderer uses a viewBox sized to the layout bounds; the svg
  // element itself is CSS-sized 100% of its container. That means the
  // viewBox user-space unit is NOT one CSS pixel: content inside the
  // svg (and our `.viewport` <g>) lives in user-space coordinates.
  // d3-zoom stores its transform in whatever coordinate system we feed
  // it, and applies that transform as an SVG `transform` attribute on
  // the viewport <g> — which is interpreted in user-space. So we
  // standardise everything in user-space: set the zoom's `extent` to
  // the viewBox bounds, and convert wheel-event cursor positions from
  // screen pixels to user-space before passing to d3-zoom.
  //
  // Without this, the "fixed point" d3-zoom is asked to preserve during
  // a scale operation is in a different coordinate system than the
  // transform actually applied, so the cursor drifts away from the
  // zoom focus by a factor of viewBoxScale.

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
      // When no viewBox is set, fall back to clientSize (pixel-equivalent).
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
      if (e.type === 'wheel') {
        // d3-zoom's own wheel handling is disabled — we drive it via
        // the custom wheel listener below to route cursor points
        // through user-space coords.
        return false
      }
      if (e.type === 'mousedown' || e.type === 'pointerdown') {
        return panFilter(e as PointerEvent | MouseEvent)
      }
      return false
    })
    .on('zoom', (e: D3ZoomEvent<SVGSVGElement, unknown>) => {
      viewportEl.setAttribute('transform', e.transform.toString())
    })

  svgSel.call(zoomBehavior)
  // Suppress d3-zoom's default contextmenu handler so element-level
  // oncontextmenu handlers can fire.
  svgSel.on('contextmenu.zoom', null)

  const handleWheel = (e: WheelEvent) => {
    e.preventDefault()
    const point = cursorToUserCoords(e.clientX, e.clientY)
    if (!point) return

    // Pinch (ctrl/meta + wheel) always zooms, regardless of wheelMode.
    // Browsers synthesise ctrlKey=true on trackpad pinch, so this
    // handles both explicit ctrl+wheel and pinch gestures.
    if (e.ctrlKey || e.metaKey || wheelMode === 'zoom') {
      const factor = wheelZoomSensitivity ** -e.deltaY
      zoomBehavior.scaleBy(svgSel, factor, point)
      return
    }
    // wheelMode === 'pan' — pan both axes as emitted. Two-finger
    // trackpad scroll works naturally; mouse wheel pans vertically.
    // Pan uses user-space units too (consistent with extent).
    const current = zoomTransform(svg)
    zoomBehavior.translateBy(svgSel, -e.deltaX / current.k, -e.deltaY / current.k)
  }
  svg.addEventListener('wheel', handleWheel, { passive: false })

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

      // Work entirely in user-space: use getBBox() for node bounds in
      // the viewport's local coords, then translate to put its centre
      // at the viewBox centre under the target scale.
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
      svgSel.on('.zoom', null)
      svg.removeEventListener('wheel', handleWheel)
      viewportEl.removeAttribute('transform')
    },
  }
}
