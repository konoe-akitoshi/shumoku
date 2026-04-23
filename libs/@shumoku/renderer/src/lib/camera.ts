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
   * Trackpad two-finger scroll pans (deltaX !== 0), pure vertical wheel
   * zooms at cursor. Pinch (ctrl/meta + wheel) always zooms.
   */
  | 'pan-and-zoom'
  /** Every wheel tick zooms at cursor. */
  | 'zoom'
  /** Every wheel tick pans. */
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
  /** Wheel behaviour when no modifier is held. Default: 'pan-and-zoom'. */
  wheelMode?: WheelMode
  /** Zoom step factor per wheel tick. Default 1.1. */
  wheelZoomStep?: number
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
export function attachCamera(svg: SVGSVGElement, options: CameraOptions = {}): Camera {
  const {
    scaleExtent = [0.2, 10],
    panFilter = DEFAULT_PAN_FILTER,
    wheelMode = 'pan-and-zoom',
    wheelZoomStep = 1.1,
  } = options

  const viewportEl = svg.querySelector<SVGGElement>('.viewport')
  if (!viewportEl) {
    throw new Error(
      '[attachCamera] no `.viewport` <g> found in svg — ShumokuRenderer always produces one; was this called on the wrong element?',
    )
  }

  const svgSel = select(svg)
  const zoomBehavior: ZoomBehavior<SVGSVGElement, unknown> = zoom<SVGSVGElement, unknown>()
    .scaleExtent(scaleExtent)
    .filter((e) => {
      if (e.type === 'wheel') {
        return (e as WheelEvent).ctrlKey || (e as WheelEvent).metaKey
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
  // Prevent default context menu on the svg background (d3-zoom installs
  // its own; we want that suppressed so right-click falls through to
  // oncontextmenu handlers on specific elements).
  svgSel.on('contextmenu.zoom', null)

  const handleWheel = (e: WheelEvent) => {
    if (e.ctrlKey || e.metaKey) return // pinch — d3-zoom handles via its filter
    e.preventDefault()
    switch (wheelMode) {
      case 'zoom': {
        const factor = e.deltaY < 0 ? wheelZoomStep : 1 / wheelZoomStep
        const rect = svg.getBoundingClientRect()
        zoomBehavior.scaleBy(svgSel, factor, [e.clientX - rect.left, e.clientY - rect.top])
        break
      }
      case 'pan':
        zoomBehavior.translateBy(svgSel, -e.deltaX, -e.deltaY)
        break
      case 'pan-and-zoom':
        if (e.deltaX !== 0) {
          zoomBehavior.translateBy(svgSel, -e.deltaX, -e.deltaY)
        } else {
          const factor = e.deltaY < 0 ? wheelZoomStep : 1 / wheelZoomStep
          const rect = svg.getBoundingClientRect()
          zoomBehavior.scaleBy(svgSel, factor, [e.clientX - rect.left, e.clientY - rect.top])
        }
        break
    }
  }
  svg.addEventListener('wheel', handleWheel, { passive: false })

  return {
    getTransform() {
      const t = zoomTransform(svg)
      return { x: t.x, y: t.y, k: t.k }
    },

    zoomBy(factor: number) {
      const rect = svg.getBoundingClientRect()
      zoomBehavior.scaleBy(svgSel, factor, [rect.width / 2, rect.height / 2])
    },

    zoomTo(scale: number, point?: [number, number]) {
      zoomBehavior.scaleTo(svgSel, scale, point)
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

      const svgRect = svg.getBoundingClientRect()
      const nodeRect = node.getBoundingClientRect()
      const current = zoomTransform(svg)

      // Target scale so node ≈ sqrt(areaRatio) * viewport-dim on the larger axis.
      const targetK = Math.max(
        scaleExtent[0],
        Math.min(
          scaleExtent[1],
          current.k *
            Math.sqrt(
              (svgRect.width * svgRect.height * areaRatio) / (nodeRect.width * nodeRect.height),
            ),
        ),
      )

      // Node centre in the screen-space of the svg, then in content-space.
      const screenCx = nodeRect.left + nodeRect.width / 2 - svgRect.left
      const screenCy = nodeRect.top + nodeRect.height / 2 - svgRect.top
      const contentCx = (screenCx - current.x) / current.k
      const contentCy = (screenCy - current.y) / current.k

      // Translate so (contentCx, contentCy) lands at the svg centre under targetK.
      const tx = svgRect.width / 2 - contentCx * targetK
      const ty = svgRect.height / 2 - contentCy * targetK

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
