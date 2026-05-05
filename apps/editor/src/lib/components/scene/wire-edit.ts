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

/** Midpoint of each consecutive pair of points (for "+" insert handles). */
export function segmentMidpoints(points: Waypoint[]): Waypoint[] {
  return points.slice(0, -1).map((p, i) => {
    const q = points[i + 1]
    if (!q) return { x: p.x, y: p.y }
    return { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 }
  })
}

/**
 * Index of the polyline segment closest to `p`. Used by drag-to-bend
 * to decide where in the waypoints array a new bend should land.
 */
export function nearestSegmentIndex(points: Waypoint[], p: Waypoint): number {
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

/** Read the latest waypoints for a wire from the source-of-truth store. */
function currentWaypoints(sceneId: string, linkId: string): Waypoint[] {
  const route = diagramState.scenes
    .find((s) => s.id === sceneId)
    ?.wireRoutes.find((w) => w.linkId === linkId)
  return route?.controlPoints ?? []
}

/** Commit a new waypoints list back to the scene store. */
export function writeWaypoints(sceneId: string, linkId: string, waypoints: Waypoint[]) {
  diagramState.setWireRoute(sceneId, {
    linkId,
    pathStyle: waypoints.length > 0 ? 'free' : 'orthogonal',
    controlPoints: waypoints,
  })
}

/**
 * Drag a single waypoint to follow the cursor. Re-reads the live
 * waypoints array on every move so the write-back doesn't clobber
 * concurrent edits.
 */
export function dragWaypoint(args: {
  sceneId: string
  linkId: string
  index: number
  initialPointerFlow: Waypoint
  initialWaypoint: Waypoint
  toFlow: (clientX: number, clientY: number) => Waypoint
  label: string
}) {
  const { sceneId, linkId, index, initialPointerFlow, initialWaypoint, toFlow, label } = args
  const offsetX = initialPointerFlow.x - initialWaypoint.x
  const offsetY = initialPointerFlow.y - initialWaypoint.y

  diagramState.beginTx(label)
  const onMove = (ev: PointerEvent) => {
    const fp = toFlow(ev.clientX, ev.clientY)
    const cur = currentWaypoints(sceneId, linkId)
    const next = [...cur]
    next[index] = { x: fp.x - offsetX, y: fp.y - offsetY }
    writeWaypoints(sceneId, linkId, next)
  }
  const onUp = () => {
    document.removeEventListener('pointermove', onMove)
    document.removeEventListener('pointerup', onUp)
    diagramState.endTx()
  }
  document.addEventListener('pointermove', onMove)
  document.addEventListener('pointerup', onUp)
}

/**
 * Drag-to-bend: pointerdown on the line body. Does nothing until the
 * cursor moves past `threshold` pixels, then inserts a waypoint at
 * the original click and starts dragging it. Tap (no drag) falls
 * through so the framework's selection can fire.
 */
export function bendOnDrag(args: {
  sceneId: string
  linkId: string
  startClient: { x: number; y: number }
  initialWaypoints: Waypoint[]
  pointsForSegmentSearch: Waypoint[]
  toFlow: (clientX: number, clientY: number) => Waypoint
  threshold?: number
}) {
  const {
    sceneId,
    linkId,
    startClient,
    initialWaypoints,
    pointsForSegmentSearch,
    toFlow,
    threshold = 4,
  } = args
  let dragIdx: number | null = null

  const onMove = (ev: PointerEvent) => {
    if (dragIdx === null) {
      const moved = Math.hypot(ev.clientX - startClient.x, ev.clientY - startClient.y)
      if (moved < threshold) return
      const flowStart = toFlow(startClient.x, startClient.y)
      const segIdx = nearestSegmentIndex(pointsForSegmentSearch, flowStart)
      const inserted = [...initialWaypoints]
      inserted.splice(segIdx, 0, flowStart)
      diagramState.beginTx('Bend wire')
      writeWaypoints(sceneId, linkId, inserted)
      dragIdx = segIdx
    }
    const fp = toFlow(ev.clientX, ev.clientY)
    const cur = currentWaypoints(sceneId, linkId)
    const upd = [...cur]
    if (dragIdx === null) return
    upd[dragIdx] = { x: fp.x, y: fp.y }
    writeWaypoints(sceneId, linkId, upd)
  }
  const onUp = () => {
    document.removeEventListener('pointermove', onMove)
    document.removeEventListener('pointerup', onUp)
    if (dragIdx !== null) diagramState.endTx()
  }
  document.addEventListener('pointermove', onMove)
  document.addEventListener('pointerup', onUp)
}
