// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

import type { Link, Node } from '@shumoku/core'
import type { Scene } from '../types'

/**
 * Endpoint position in a scene. Order:
 *   1. explicit placement (user dragged the pin somewhere)
 *   2. Node.position fallback (auto-layout coords)
 *
 * The fallback isn't physically accurate when scenes use different
 * coordinate systems (separate floor plans), but that case requires
 * explicit placements anyway. For the common case (single scene, or
 * root scene with no per-scene calibration mismatch), the fallback
 * lets length compute the moment a scene is calibrated — without
 * forcing the user to drag every pin first.
 */
function endpointPos(
  scene: Scene,
  nodeId: string,
  nodes: Map<string, Node>,
): { x: number; y: number } | null {
  const placement = scene.nodePlacements.find((p) => p.nodeId === nodeId)
  if (placement) return placement.position
  return nodes.get(nodeId)?.position ?? null
}

/**
 * Length in pixels of one segment (a, b) within a scene. Uses the
 * link's wireRoute controlPoints only when this segment is the entire
 * link (via-less) — controlPoints aren't keyed per-segment, so they
 * can't be split across via hops without ambiguity.
 */
function segmentPx(
  scene: Scene,
  link: Link,
  aId: string,
  bId: string,
  nodes: Map<string, Node>,
  isOnlySegment: boolean,
): number | null {
  const a = endpointPos(scene, aId, nodes)
  const b = endpointPos(scene, bId, nodes)
  if (!a || !b) return null
  if (!isOnlySegment) return Math.hypot(b.x - a.x, b.y - a.y)
  const route = link.id ? scene.wireRoutes.find((w) => w.linkId === link.id) : undefined
  const points = [a, ...(route?.controlPoints ?? []), b]
  let len = 0
  for (let i = 0; i < points.length - 1; i++) {
    const p = points[i]
    const q = points[i + 1]
    if (!p || !q) continue
    len += Math.hypot(q.x - p.x, q.y - p.y)
  }
  return len
}

/**
 * Effective real-world cable length for a link.
 *
 * Aggregates per-segment over [from, ...via, to]: each adjacent pair
 * is one cable segment. For each segment, find the first calibrated
 * scene where both endpoints resolve and add `px / pxPerMeter` to the
 * total. Different segments can come from different scenes — e.g. an
 * EPS-bridged cable contributes its floor-A side from scene-A and its
 * floor-B side from scene-B, summed.
 *
 * Falls back to stored `link.cable.length_m` when no segment finds a
 * scene contribution.
 */
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
export function visibleCableSegments(link: Link, nodes: Map<string, Node>): string[][] {
  const sequence = [link.from.node, ...(link.via ?? []), link.to.node]
  const segments: string[][] = []
  let current: string[] = []
  for (const id of sequence) {
    const n = nodes.get(id)
    if (n?.termination?.role === 'eps') {
      current.push(id)
      segments.push(current)
      current = []
    } else {
      current.push(id)
    }
  }
  segments.push(current)
  return segments.filter((s) => s.length >= 2)
}

export function cableLengthMeters(
  link: Link,
  scenes: Scene[],
  nodes: Map<string, Node>,
): { meters: number; source: 'scene' | 'stored' } | null {
  // Length follows what's drawn: sum the visible segments. EPS internal
  // (chase-internal) length isn't modeled here.
  const segments = visibleCableSegments(link, nodes)
  if (segments.length === 0) {
    const stored = link.cable?.length_m
    if (stored !== undefined && Number.isFinite(stored)) {
      return { meters: stored, source: 'stored' }
    }
    return null
  }
  const isOnlySegment = segments.length === 1 && segments[0]?.length === 2
  let total = 0
  let any = false
  for (const seg of segments) {
    for (let i = 0; i < seg.length - 1; i++) {
      const aId = seg[i]
      const bId = seg[i + 1]
      if (!aId || !bId) continue
      for (const scene of scenes) {
        const ratio = scene.calibration?.pxPerMeter
        if (!ratio || ratio <= 0) continue
        const px = segmentPx(scene, link, aId, bId, nodes, isOnlySegment)
        if (px === null) continue
        total += px / ratio
        any = true
        break
      }
    }
  }
  if (any) return { meters: total, source: 'scene' }
  const stored = link.cable?.length_m
  if (stored !== undefined && Number.isFinite(stored)) {
    return { meters: stored, source: 'stored' }
  }
  return null
}
