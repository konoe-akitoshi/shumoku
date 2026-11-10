// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

import type { Link, Termination } from '@shumoku/core'
import type { Scene, WireBend } from '../types'

/**
 * Scene-derived cable length.
 *
 * A link's run is [from, ...via, to]; each adjacent pair is one piece of cable, bent by the
 * bends the scene draws in that slot. A scene gives a piece a length when it is calibrated
 * (`calibration.pxPerMeter`) and places both of the pair's nodes or terminations: then the
 * polyline through that scene's bends, in pixels, over the ratio. Different pieces may come
 * from different scenes — an EPS-bridged cable contributes its floor-A side from scene A and
 * its floor-B side from scene B, summed.
 */

export function formatMeters(m: number): string {
  if (m < 1) return `${(m * 100).toFixed(0)} cm`
  return `${m.toFixed(1)} m`
}

/** Where a node or termination sits in a scene, when placed there. */
function placementOf(scene: Scene, id: string): { x: number; y: number } | null {
  return scene.nodePlacements.find((p) => p.nodeId === id)?.position ?? null
}

/** The bends a scene draws for a link in one slot of its `via` chain, in drawing order. */
function bendsIn(scene: Scene, linkId: string | undefined, afterIndex: number): WireBend[] {
  if (!linkId) return []
  const wire = scene.wires?.find((w) => w.linkId === linkId)
  return (wire?.bends ?? []).filter((b) => b.afterIndex === afterIndex)
}

/** The role of a termination id, if the id names one. */
function roleOf(terminations: readonly Termination[], id: string): Termination['role'] | undefined {
  return terminations.find((t) => t.id === id)?.role
}

/**
 * Split a link's [from, ...via, to] sequence into the visible cable
 * segments. Each EPS in the chain closes the current segment (the
 * cable physically enters the chase there) and breaks visual
 * continuity — what comes out the other side starts a fresh
 * segment at the next outlet. Single-node trailing segments (e.g.
 * trailing EPS with no outlet) are dropped.
 *
 * Example:
 *   from=A, via=[outlet1, eps, outlet2], to=B
 *   → segments: [[A, outlet1, eps], [outlet2, B]]
 */
export function visibleCableSegments(
  link: Link,
  terminations: readonly Termination[] = [],
): string[][] {
  const sequence = [link.from.node, ...(link.via ?? []), link.to.node]
  const segments: string[][] = []
  let current: string[] = []
  for (const id of sequence) {
    current.push(id)
    if (roleOf(terminations, id) === 'eps') {
      segments.push(current)
      current = []
    }
  }
  segments.push(current)
  return segments.filter((s) => s.length >= 2)
}

/**
 * The length in pixels of one piece of the run (two adjacent waypoints of [from, ...via, to],
 * with the scene's bends between them), or null when the scene does not place both.
 */
function piecePixels(
  scene: Scene,
  link: Link,
  fromId: string,
  toId: string,
  afterIndex: number,
): number | null {
  const a = placementOf(scene, fromId)
  const b = placementOf(scene, toId)
  if (!a || !b) return null
  const points = [a, ...bendsIn(scene, link.id, afterIndex), b]
  let total = 0
  for (const [i, p] of points.entries()) {
    const q = points[i + 1]
    if (q) total += Math.hypot(q.x - p.x, q.y - p.y)
  }
  return total
}

/**
 * Per-visible-segment cable lengths. EPS-routed wires return one
 * entry per "side of the chase" — physically you order one cable per
 * segment, so BOM / Connections breakdowns match what the installer
 * actually buys. The endpoint ids are the segment's first and last
 * (e.g. switch + eps for the rack-side run). Returns an empty array
 * when no scene-derived length is available for any segment.
 */
export function cableSegmentLengths(
  link: Link,
  scenes: readonly Scene[],
  terminations: readonly Termination[] = [],
): Array<{ fromId: string; toId: string; meters: number }> {
  const via = link.via ?? []
  // The slot of the piece that starts at a waypoint: -1 at the first end, i at via[i].
  const slotOf = new Map<string, number>([
    [link.from.node, -1],
    ...via.map((id, i): [string, number] => [id, i]),
  ])
  const out: Array<{ fromId: string; toId: string; meters: number }> = []
  for (const segment of visibleCableSegments(link, terminations)) {
    let meters = 0
    let any = false
    for (const [i, fromId] of segment.entries()) {
      const toId = segment[i + 1]
      if (!toId) break
      const afterIndex = slotOf.get(fromId) ?? -1
      for (const scene of scenes) {
        const ratio = scene.calibration?.pxPerMeter
        if (!ratio || ratio <= 0) continue
        const px = piecePixels(scene, link, fromId, toId, afterIndex)
        if (px === null) continue
        meters += px / ratio
        any = true
        break
      }
    }
    const fromId = segment[0]
    const toId = segment[segment.length - 1]
    if (any && fromId && toId && fromId !== toId) out.push({ fromId, toId, meters })
  }
  return out
}

export function cableLengthMeters(
  link: Link,
  scenes: readonly Scene[],
  terminations: readonly Termination[] = [],
): { meters: number; source: 'scene' | 'stored' } | null {
  // Length follows what's drawn: sum the visible segments. EPS internal
  // (chase-internal) length isn't modeled here.
  const parts = cableSegmentLengths(link, scenes, terminations)
  if (parts.length > 0) {
    const total = parts.reduce((s, p) => s + p.meters, 0)
    return { meters: total, source: 'scene' }
  }
  const stored = link.cable?.length_m
  if (stored !== undefined && Number.isFinite(stored)) {
    return { meters: stored, source: 'stored' }
  }
  return null
}
