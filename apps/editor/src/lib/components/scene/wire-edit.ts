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
 * Index of the polyline segment closest to `p` and the squared
 * perpendicular distance to it. The squared distance lets callers
 * pick between multiple polylines (e.g. EPS-split visible
 * segments) without needing a sqrt.
 */
function nearestSegment(points: Waypoint[], p: Waypoint): { index: number; distSq: number } {
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
  return { index: best, distSq: bestDist }
}

/**
 * Drag-to-bend: pointerdown on the line body. Creates a bend Node in
 * the link's `via` chain at the right insertion index, then drags
 * its scene placement until pointerup. Snap-to-existing grabs an
 * already-placed bend (within `snapTol` flow units) instead of
 * spawning a duplicate.
 *
 * `segmentIndex` identifies which visible polyline the user
 * clicked. SceneEdge knows this from pixel-level hit testing
 * (each polyline has its own hit path), so bendOnDrag doesn't try
 * to re-infer it geometrically — that previously misfired on
 * EPS-split wires when one polyline was perpendicular-closer to
 * the click than the one actually under the cursor. The matching
 * `BendDragSegment` carries its own `viaOffset`, so:
 *   global segIdx = viaOffset + nearestSegment(local).index
 * inside the polyline picks where in the link's via the new bend
 * lands.
 */
export interface BendDragSegment {
  points: Waypoint[]
  viaOffset: number
}

export function bendOnDrag(args: {
  sceneId: string
  linkId: string
  startClient: { x: number; y: number }
  segments: BendDragSegment[]
  segmentIndex: number
  toFlow: (clientX: number, clientY: number) => Waypoint
  threshold?: number
  snapTol?: number
}) {
  const {
    sceneId,
    linkId,
    startClient,
    segments,
    segmentIndex,
    toFlow,
    threshold = 4,
    snapTol = 18,
  } = args
  let dragNodeId: string | null = null
  let txOpen = false

  function nearestExistingBend(at: Waypoint): { id: string; dist: number } | null {
    const link = diagramState.links.find((l) => l.id === linkId)
    const via = link?.via ?? []
    const scene = diagramState.scenes.find((s) => s.id === sceneId)
    let bestId: string | null = null
    let bestDist = Infinity
    for (const id of via) {
      const node = diagramState.nodes.get(id)
      if (node?.termination?.role !== 'bend') continue
      const placement =
        scene?.nodePlacements.find((p) => p.nodeId === id)?.position ?? node.position
      if (!placement) continue
      const dist = Math.hypot(placement.x - at.x, placement.y - at.y)
      if (dist < bestDist) {
        bestDist = dist
        bestId = id
      }
    }
    return bestId ? { id: bestId, dist: bestDist } : null
  }

  const onMove = (ev: PointerEvent) => {
    if (dragNodeId === null) {
      const moved = Math.hypot(ev.clientX - startClient.x, ev.clientY - startClient.y)
      if (moved < threshold) return
      const flowStart = toFlow(startClient.x, startClient.y)

      const near = nearestExistingBend(flowStart)
      if (near && near.dist <= snapTol) {
        diagramState.beginTx('Adjust wire')
        txOpen = true
        dragNodeId = near.id
      } else {
        // Use the segment SceneEdge told us was clicked (pixel-
        // level hit test) — only resolve the *line within that
        // polyline* geometrically. This avoids the
        // EPS-split footgun where two polylines were both fed to
        // a global nearestSegment loop and a perpendicular-closer
        // line on the other polyline could win.
        const seg = segments[segmentIndex] ?? segments[0]
        if (!seg) return
        const { index: localIdx } = nearestSegment(seg.points, flowStart)
        const segIdx = seg.viaOffset + localIdx
        // insertBendInLink wraps the create + via splice in its own
        // commit, so we don't double-wrap with our drag tx.
        dragNodeId = diagramState.insertBendInLink(sceneId, linkId, flowStart, segIdx)
        diagramState.beginTx('Adjust wire')
        txOpen = true
      }
    }
    const fp = toFlow(ev.clientX, ev.clientY)
    if (dragNodeId) diagramState.placeNodeInScene(sceneId, dragNodeId, fp)
  }
  const onUp = () => {
    document.removeEventListener('pointermove', onMove)
    document.removeEventListener('pointerup', onUp)
    if (txOpen) diagramState.endTx()
  }
  document.addEventListener('pointermove', onMove)
  document.addEventListener('pointerup', onUp)
}
