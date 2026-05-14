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

/** Index of the polyline segment closest to `p`. */
function nearestSegmentIndex(points: Waypoint[], p: Waypoint): number {
  let best = 0
  let bestDist = Infinity
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]
    const b = points[i + 1]
    if (!a || !b) continue
    const dx = b.x - a.x
    const dy = b.y - a.y
    const len2 = dx * dx + dy * dy
    const t =
      len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2))
    const px = a.x + t * dx
    const py = a.y + t * dy
    const d = (p.x - px) ** 2 + (p.y - py) ** 2
    if (d < bestDist) {
      bestDist = d
      best = i
    }
  }
  return best
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
        // New bend: `viaOffset + localIdx - 1` is the `afterIndex`
        // slot inside the (terminations-only) via chain. The segment
        // index from this edge already references via positions.
        const localIdx = nearestSegmentIndex(points, flowStart)
        const afterIndex = viaOffset + localIdx - 1
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
