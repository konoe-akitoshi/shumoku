// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

import type { Link, Node, Termination } from '@shumoku/core'
import type { Scene } from '../types'
import { nodeCenterFromTopLeft } from './node-geometry'
import { viaLookup } from './via-lookup'

/**
 * Single source of truth for cable length number formatting:
 * one decimal under 10m, rounded above. Callers append the "m"
 * suffix if they want it (lets layouts style the unit separately).
 */
export function formatMeters(m: number): string {
  return m < 10 ? m.toFixed(1) : String(Math.round(m))
}

/**
 * Endpoint position in a scene as the **icon center** — matches
 * exactly where SceneCanvas anchors wires. Without the center
 * offset, two different-sized nodes would have their length-math
 * endpoints at mismatched corners, putting the reported cable length
 * out of sync with the polyline that's actually drawn.
 *
 * Top-left priority:
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
  const node = nodes.get(nodeId)
  const placement = scene.nodePlacements.find((p) => p.nodeId === nodeId)
  const tl = placement?.position ?? node?.position
  if (!tl) return null
  return nodeCenterFromTopLeft(scene, node, tl)
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
export function visibleCableSegments(
  link: Link,
  nodes: Map<string, Node>,
  terminations: readonly Termination[] = [],
): string[][] {
  const lookup = terminations.length > 0 ? viaLookup(nodes, terminations) : nodes
  const sequence = [link.from.node, ...(link.via ?? []), link.to.node]
  const segments: string[][] = []
  let current: string[] = []
  for (const id of sequence) {
    const n = lookup.get(id)
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

/**
 * Waypoint kinds used when summing the polyline that's actually
 * rendered on the canvas. Both `node` (icon center) and `bend` (raw
 * x/y) waypoints contribute to length.
 */
type Waypoint = { kind: 'node'; nodeId: string } | { kind: 'bend'; x: number; y: number }

/**
 * Walk the link's full visible polyline as an ordered list of
 * waypoints, interleaving `link.bends` at their `afterIndex` slots.
 *
 *   [from] → bends(afterIndex=-1) → via[0] → bends(0) → ... → [to]
 */
function linkPolylineWaypoints(link: Link): Waypoint[] {
  const out: Waypoint[] = []
  const via = link.via ?? []
  const bends = link.bends ?? []
  const bendsAfter = (i: number): Waypoint[] =>
    bends.filter((b) => b.afterIndex === i).map((b) => ({ kind: 'bend', x: b.x, y: b.y }))
  out.push({ kind: 'node', nodeId: link.from.node })
  out.push(...bendsAfter(-1))
  for (let i = 0; i < via.length; i++) {
    const id = via[i]
    if (id) out.push({ kind: 'node', nodeId: id })
    out.push(...bendsAfter(i))
  }
  out.push({ kind: 'node', nodeId: link.to.node })
  return out
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
  scenes: Scene[],
  nodes: Map<string, Node>,
  terminations: readonly Termination[] = [],
): Array<{ fromId: string; toId: string; meters: number }> {
  // Walk the full polyline (nodes interleaved with bends), splitting
  // into visible cable segments at every EPS waypoint — the cable
  // physically enters the chase there and starts again on the other
  // side. Bends inside a segment contribute straight-line distance
  // between adjacent waypoints, matching the curved polyline the
  // canvas draws.
  const lookup = terminations.length > 0 ? viaLookup(nodes, terminations) : nodes
  const polyline = linkPolylineWaypoints(link)
  if (polyline.length < 2) return []

  // Group the polyline into per-segment runs split at every EPS
  // waypoint. EPS membership belongs to the segment it closes; the
  // next segment starts after it (the cable physically ends at the
  // EPS panel and a fresh cable starts on the other side).
  const segmentRuns: Waypoint[][] = []
  let run: Waypoint[] = []
  for (const w of polyline) {
    run.push(w)
    if (w.kind === 'node' && lookup.get(w.nodeId)?.termination?.role === 'eps') {
      segmentRuns.push(run)
      run = []
    }
  }
  if (run.length > 0) segmentRuns.push(run)

  function resolve(w: Waypoint, scene: Scene): { x: number; y: number } | null {
    if (w.kind === 'bend') return { x: w.x, y: w.y }
    return endpointPos(scene, w.nodeId, lookup)
  }

  function pixelLengthAcrossScenes(seg: Waypoint[], sceneList: Scene[]): number | null {
    let total = 0
    let any = false
    for (let i = 0; i < seg.length - 1; i++) {
      const a = seg[i]
      const b = seg[i + 1]
      if (!a || !b) continue
      for (const sc of sceneList) {
        const ratio = sc.calibration?.pxPerMeter
        if (!ratio || ratio <= 0) continue
        const pa = resolve(a, sc)
        const pb = resolve(b, sc)
        if (!pa || !pb) continue
        total += Math.hypot(pb.x - pa.x, pb.y - pa.y) / ratio
        any = true
        break
      }
    }
    return any ? total : null
  }

  // First and last *node* of a run — bends can't serve as the
  // segment's reported endpoint id (BOM groups by node).
  function bookendNodes(seg: Waypoint[]): { fromId: string; toId: string } | null {
    let fromId: string | null = null
    let toId: string | null = null
    for (const w of seg) {
      if (w.kind === 'node') {
        if (fromId === null) fromId = w.nodeId
        toId = w.nodeId
      }
    }
    if (!fromId || !toId || fromId === toId) return null
    return { fromId, toId }
  }

  const out: Array<{ fromId: string; toId: string; meters: number }> = []
  for (const seg of segmentRuns) {
    const ends = bookendNodes(seg)
    if (!ends) continue
    const meters = pixelLengthAcrossScenes(seg, scenes)
    if (meters === null) continue
    out.push({ fromId: ends.fromId, toId: ends.toId, meters })
  }
  return out
}

export function cableLengthMeters(
  link: Link,
  scenes: Scene[],
  nodes: Map<string, Node>,
  terminations: readonly Termination[] = [],
): { meters: number; source: 'scene' | 'stored' } | null {
  // Length follows what's drawn: sum the visible segments. EPS internal
  // (chase-internal) length isn't modeled here.
  const parts = cableSegmentLengths(link, scenes, nodes, terminations)
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
