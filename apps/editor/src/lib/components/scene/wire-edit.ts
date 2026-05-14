// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

import { diagramState } from '$lib/context.svelte'

export type Waypoint = { x: number; y: number }

/**
 * Build the SVG `d` for a polyline through the given points with
 * rounded corners — each interior waypoint becomes a quadratic
 * Bezier with the corner radius capped at half the adjacent segment
 * length so short segments don't overshoot.
 */
export function polylinePath(points: Waypoint[], radius = 12): string {
  if (points.length === 0) return ''
  const first = points[0]
  if (!first) return ''
  if (points.length === 1) return `M ${first.x} ${first.y}`
  if (points.length === 2) {
    const last = points[1]
    if (!last) return `M ${first.x} ${first.y}`
    return `M ${first.x} ${first.y} L ${last.x} ${last.y}`
  }

  let d = `M ${first.x} ${first.y}`
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1]
    const curr = points[i]
    const next = points[i + 1]
    if (!prev || !curr || !next) continue
    const v1x = curr.x - prev.x
    const v1y = curr.y - prev.y
    const v2x = next.x - curr.x
    const v2y = next.y - curr.y
    const l1 = Math.hypot(v1x, v1y) || 1
    const l2 = Math.hypot(v2x, v2y) || 1
    const r = Math.min(radius, l1 / 2, l2 / 2)
    const ax = curr.x - (v1x / l1) * r
    const ay = curr.y - (v1y / l1) * r
    const bx = curr.x + (v2x / l2) * r
    const by = curr.y + (v2y / l2) * r
    d += ` L ${ax} ${ay} Q ${curr.x} ${curr.y}, ${bx} ${by}`
  }
  const last = points[points.length - 1]
  if (last) d += ` L ${last.x} ${last.y}`
  return d
}

/**
 * Drag-to-bend: pointerdown on a wire's hit path. Creates a bend
 * Node in the link's `via` chain at the right insertion index,
 * then drags its scene placement until pointerup. Snap-to-existing
 * grabs an already-placed bend within `snapTol` flow units instead
 * of spawning a duplicate.
 *
 * Each Svelte Flow edge in the scene corresponds to a single
 * visible cable segment — `points` is that segment's polyline and
 * `viaOffset` is the global via index of its left endpoint
 * (source-rooted segment = 0; post-EPS segment = `viaIndex(head) + 1`).
 * Local nearest-segment-index + offset = global insertion index.
 */
export function bendOnDrag(args: {
  sceneId: string
  linkId: string
  /** This segment's polyline, in flow coordinates. */
  points: Waypoint[]
  /** Global via offset for this segment. */
  viaOffset: number
  startClient: { x: number; y: number }
  toFlow: (clientX: number, clientY: number) => Waypoint
  threshold?: number
  snapTol?: number
}) {
  const {
    sceneId,
    linkId,
    points,
    viaOffset,
    startClient,
    toFlow,
    threshold = 4,
    snapTol = 18,
  } = args
  let dragBendId: string | null = null
  let txOpen = false

  function nearestExistingBend(at: Waypoint): { id: string; dist: number } | null {
    const link = diagramState.links.find((l) => l.id === linkId)
    const bends = link?.bends ?? []
    let bestId: string | null = null
    let bestDist = Infinity
    for (const b of bends) {
      const dist = Math.hypot(b.x - at.x, b.y - at.y)
      if (dist < bestDist) {
        bestDist = dist
        bestId = b.id
      }
    }
    return bestId ? { id: bestId, dist: bestDist } : null
  }

  const onMove = (ev: PointerEvent) => {
    if (dragBendId === null) {
      const moved = Math.hypot(ev.clientX - startClient.x, ev.clientY - startClient.y)
      if (moved < threshold) return
      const flowStart = toFlow(startClient.x, startClient.y)

      const near = nearestExistingBend(flowStart)
      if (near && near.dist <= snapTol) {
        diagramState.beginTx('Adjust wire')
        txOpen = true
        dragBendId = near.id
      } else {
        // New bend: stamp `afterIndex` to the segment's leading via
        // slot. `viaOffset` is the via index AFTER which this
        // segment lives (source-rooted = 0, post-EPS = via index of
        // the EPS at segment head + 1), so `viaOffset - 1` is the
        // slot for any bend inside this segment.
        //
        // Limitation: when a segment crosses multiple non-EPS
        // terminations (e.g. switch → outletA → outletB → to),
        // clicks at different positions all land in the leading
        // slot, so a bend dragged past a via boundary won't relayer
        // visually. Acceptable for the common single-slot segment.
        const afterIndex = viaOffset - 1
        // addLinkBend wraps create in its own commit; the subsequent
        // drag moves get their own tx below.
        dragBendId = diagramState.addLinkBend(linkId, flowStart, afterIndex) || null
        diagramState.beginTx('Adjust wire')
        txOpen = true
      }
    }
    const fp = toFlow(ev.clientX, ev.clientY)
    if (dragBendId) diagramState.updateLinkBend(linkId, dragBendId, fp)
  }
  const onUp = () => {
    document.removeEventListener('pointermove', onMove)
    document.removeEventListener('pointerup', onUp)
    if (txOpen) diagramState.endTx()
  }
  document.addEventListener('pointermove', onMove)
  document.addEventListener('pointerup', onUp)
}
