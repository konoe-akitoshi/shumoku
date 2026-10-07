// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

import type { Link, Termination } from '@shumoku/core'
import type { MapDrawing, MapOmission, Scene } from '../types'

export const MAP_UNITS_PER_METER = 100
export type Point = { x: number; y: number }
export type RoutePoint = Point & { id: string; afterIndex: number }
export type MapSpan = { from: RoutePoint; to: RoutePoint; omission?: MapOmission }

export function omissionEndId(id: string, side: 'from' | 'to'): string {
  return `omission:${id}:${side}`
}

export function drawingAt(drawings: MapDrawing[], p: Point): MapDrawing | undefined {
  return [...drawings]
    .reverse()
    .find(
      (d) =>
        p.x >= d.position.x &&
        p.y >= d.position.y &&
        p.x <= d.position.x + d.width * d.scale &&
        p.y <= d.position.y + d.height * d.scale,
    )
}

/** Missing placement stays missing: logical layout pixels never become physical coordinates. */
export function routePoints(
  link: Link,
  scene: Scene,
  terms: readonly Termination[],
): RoutePoint[] | null {
  const placements = new Map(scene.nodePlacements.map((p) => [p.nodeId, p.position]))
  const positions = new Map(terms.filter((t) => t.position).map((t) => [t.id, t.position]))
  const ids = [link.from.node, ...(link.via ?? []), link.to.node]
  const result: RoutePoint[] = []
  for (const [index, id] of ids.entries()) {
    const p = placements.get(id) ?? positions.get(id)
    if (!p) return null
    const afterIndex = index - 1
    result.push({ id, ...p, afterIndex })
    if (index === ids.length - 1) continue
    for (const bend of link.bends ?? []) {
      if (bend.afterIndex === afterIndex) result.push({ ...bend, afterIndex })
    }
  }
  return result
}

export function mapSpans(link: Link, scene: Scene, terms: readonly Termination[]): MapSpan[] {
  const points = routePoints(link, scene, terms)
  if (!points) return []
  const spans: MapSpan[] = []
  for (const [index, from] of points.entries()) {
    const to = points[index + 1]
    if (!to) continue
    const omission = scene.map?.omissions.find(
      (o) => o.linkId === link.id && o.afterId === from.id && o.beforeId === to.id,
    )
    if (omission) {
      const a = {
        ...omission.from,
        id: omissionEndId(omission.id, 'from'),
        afterIndex: from.afterIndex,
      }
      const b = {
        ...omission.to,
        id: omissionEndId(omission.id, 'to'),
        afterIndex: from.afterIndex,
      }
      spans.push({ from, to: a }, { from: a, to: b, omission }, { from: b, to })
    } else spans.push({ from, to })
  }
  return spans
}

export function spanMeters(span: MapSpan, scene: Scene): number | null {
  if (span.omission) {
    const m = span.omission.meters
    return m !== undefined && Number.isFinite(m) && m >= 0 ? m : null
  }
  const map = scene.map
  if (!map) return null
  const drawingId = map.pointDrawingIds[span.from.id]
  if (!drawingId || drawingId !== map.pointDrawingIds[span.to.id]) return null
  const drawing = map.drawings.find((d) => d.id === drawingId)
  const ratio = drawing?.calibration?.pxPerMeter
  if (!drawing || !ratio || !Number.isFinite(ratio) || ratio <= 0 || drawing.scale <= 0) return null
  return Math.hypot(span.to.x - span.from.x, span.to.y - span.from.y) / (ratio * drawing.scale)
}

export function mapCableMeters(
  link: Link,
  scene: Scene,
  terms: readonly Termination[],
): number | null {
  const spans = mapSpans(link, scene, terms)
  if (!spans.length) return null
  // Never report a partial route as a complete cable length.
  const active = new Set(spans.flatMap((s) => (s.omission ? [s.omission.id] : [])))
  if (scene.map?.omissions.some((o) => o.linkId === link.id && !active.has(o.id))) return null
  let total = 0
  for (const span of spans) {
    const meters = spanMeters(span, scene)
    if (meters === null) return null
    total += meters
  }
  return total
}

export function transformedPoint(p: Point, old: MapDrawing, next: MapDrawing): Point {
  const ratio = next.scale / old.scale
  return {
    x: next.position.x + (p.x - old.position.x) * ratio,
    y: next.position.y + (p.y - old.position.y) * ratio,
  }
}
