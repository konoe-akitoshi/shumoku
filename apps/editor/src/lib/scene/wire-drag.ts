// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

import type { Link } from '@shumoku/core'

export type Bend = NonNullable<Link['bends']>[number]
export type WirePoint = { x: number; y: number; bendId?: string; afterIndex?: number }
export type WireDragPlan = {
  bends: Bend[]
  movingIds: string[]
  start: WirePoint
  normal?: WirePoint
}

/** Freeze the target at pointerdown. Picking tolerance is measured in screen pixels. */
export function planWireDrag(
  points: WirePoint[],
  bends: Bend[],
  start: WirePoint,
  zoom: number,
  addBend: boolean,
  createId: () => string,
): WireDragPlan | null {
  const safeZoom = Number.isFinite(zoom) && zoom > 0 ? zoom : 1
  if (!addBend) {
    let nearest: WirePoint | undefined
    let distance = 8 / safeZoom
    for (const point of points) {
      if (!point.bendId) continue
      const d = Math.hypot(point.x - start.x, point.y - start.y)
      if (d <= distance) {
        nearest = point
        distance = d
      }
    }
    if (nearest?.bendId) {
      return { bends: bends.map((b) => ({ ...b })), movingIds: [nearest.bendId], start }
    }
  }

  let best:
    | { left: WirePoint; right: WirePoint; projected: WirePoint; distance: number }
    | undefined
  for (const [i, left] of points.entries()) {
    const right = points[i + 1]
    if (!right) continue
    const dx = right.x - left.x
    const dy = right.y - left.y
    const length2 = dx * dx + dy * dy
    if (length2 === 0) continue
    const t = Math.max(
      0,
      Math.min(1, ((start.x - left.x) * dx + (start.y - left.y) * dy) / length2),
    )
    const projected = { x: left.x + t * dx, y: left.y + t * dy }
    const distance = Math.hypot(start.x - projected.x, start.y - projected.y)
    if (!best || distance < best.distance) best = { left, right, projected, distance }
  }
  if (!best) return null
  const { left, right, projected } = best
  const slot = left.afterIndex ?? -1
  const next = bends.map((bend) => ({ ...bend }))
  let insertAt = right.bendId ? next.findIndex((b) => b.id === right.bendId) : -1
  if (insertAt < 0 && left.bendId) insertAt = next.findIndex((b) => b.id === left.bendId) + 1
  if (insertAt < 0) insertAt = next.findIndex((b) => b.afterIndex > slot)
  if (insertAt < 0) insertAt = next.length
  const inserted: Bend[] = []
  function movable(point: WirePoint): string {
    if (point.bendId) return point.bendId
    const id = createId()
    inserted.push({ id, x: point.x, y: point.y, afterIndex: slot })
    return id
  }
  const movingIds = addBend ? [movable(projected)] : [movable(left), movable(right)]
  next.splice(insertAt, 0, ...inserted)
  const length = Math.hypot(right.x - left.x, right.y - left.y)
  return {
    bends: next,
    movingIds,
    start,
    normal: addBend
      ? undefined
      : { x: -(right.y - left.y) / length, y: (right.x - left.x) / length },
  }
}

/** Original coordinates + pointer delta: grabbing beside a vertex cannot make it jump. */
export function moveWireDrag(plan: WireDragPlan, pointer: WirePoint): Bend[] {
  let dx = pointer.x - plan.start.x
  let dy = pointer.y - plan.start.y
  if (plan.normal) {
    const distance = dx * plan.normal.x + dy * plan.normal.y
    dx = distance * plan.normal.x
    dy = distance * plan.normal.y
  }
  return plan.bends.map((bend) =>
    plan.movingIds.includes(bend.id) ? { ...bend, x: bend.x + dx, y: bend.y + dy } : { ...bend },
  )
}
