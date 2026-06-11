// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Exact-equivalence guards for the spatial-grid acceleration (the layout
 * scoring optimization must NOT change any result — speed only).
 *
 * - BBoxGrid: candidate pairs are a SUPERSET of every bbox-overlapping pair
 *   and each pair is reported once.
 * - findCollinearOverlaps / findPortClutter: grid-accelerated results equal
 *   the original O(n²) reference (copied verbatim below) on seeded-random
 *   inputs shaped like real routed layouts.
 */

import { describe, expect, test } from 'bun:test'
import type { Bounds, Position } from '../models/types.js'
import {
  type CollinearOverlap,
  findCollinearOverlaps,
  findPortClutter,
  type PolylineSpec,
} from './invariants.js'
import { portBox, portLabelBox } from './port-geometry.js'
import type { ResolvedPort } from './resolved-types.js'
import { BBoxGrid } from './spatial-grid.js'

/** Deterministic PRNG (mulberry32) — property tests must be reproducible. */
function rng(seed: number): () => number {
  let s = seed
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

describe('BBoxGrid', () => {
  test('candidate pairs cover every overlapping pair, each reported once', () => {
    const rand = rng(42)
    const rects: Array<{ x1: number; y1: number; x2: number; y2: number }> = []
    for (let i = 0; i < 300; i++) {
      const x = rand() * 4000 - 2000
      const y = rand() * 2000 - 1000
      const w = rand() * 300
      const h = rand() * 120
      rects.push({ x1: x, y1: y, x2: x + w, y2: y + h })
    }
    const grid = new BBoxGrid(160)
    for (const [i, r] of rects.entries()) grid.insert(i, r.x1, r.y1, r.x2, r.y2)
    const seen = new Set<string>()
    grid.forEachCandidatePair((i, j) => {
      const key = `${i}|${j}`
      expect(seen.has(key)).toBe(false)
      seen.add(key)
    })
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i]
        const b = rects[j]
        if (!a || !b) continue
        const overlap = a.x1 <= b.x2 && a.x2 >= b.x1 && a.y1 <= b.y2 && a.y2 >= b.y1
        if (overlap) expect(seen.has(`${i}|${j}`)).toBe(true)
      }
    }
  })
})

// --- original O(n²) reference implementations (pre-optimization, verbatim) ---

function referenceCollinear(
  lines: readonly PolylineSpec[],
  minSeg = 13,
  minShared = 12,
  clearance = 0.5,
): CollinearOverlap[] {
  const maxSharedRun = (
    ptsA: readonly Position[],
    ptsB: readonly Position[],
    gap: number,
  ): number => {
    let best = 0
    for (let s = 1; s < ptsA.length; s++) {
      const a1 = ptsA[s - 1]
      const a2 = ptsA[s]
      if (!a1 || !a2) continue
      const vax = a2.x - a1.x
      const vay = a2.y - a1.y
      const lenA = Math.hypot(vax, vay)
      if (lenA < minSeg) continue
      for (let t = 1; t < ptsB.length; t++) {
        const b1 = ptsB[t - 1]
        const b2 = ptsB[t]
        if (!b1 || !b2) continue
        const vbx = b2.x - b1.x
        const vby = b2.y - b1.y
        const lenB = Math.hypot(vbx, vby)
        if (lenB < minSeg) continue
        if (Math.abs(vax * vby - vay * vbx) / (lenA * lenB) > 0.02) continue
        const dx = b1.x - a1.x
        const dy = b1.y - a1.y
        if (Math.abs(dx * vay - dy * vax) / lenA > gap) continue
        const t1 = (dx * vax + dy * vay) / lenA
        const t2 = ((b2.x - a1.x) * vax + (b2.y - a1.y) * vay) / lenA
        const lo = Math.max(0, Math.min(t1, t2))
        const hi = Math.min(lenA, Math.max(t1, t2))
        if (hi - lo > best) best = hi - lo
      }
    }
    return best
  }
  const out: CollinearOverlap[] = []
  for (let i = 0; i < lines.length; i++) {
    const la = lines[i]
    if (!la) continue
    for (let j = i + 1; j < lines.length; j++) {
      const lb = lines[j]
      if (!lb) continue
      const gap = (la.halfWidth ?? 1) + (lb.halfWidth ?? 1) + clearance
      const shared = maxSharedRun(la.points, lb.points, gap)
      if (shared <= minShared) continue
      out.push({ a: la.id, b: lb.id, sharedLength: shared })
    }
  }
  return out
}

function referencePortClutter(
  ports: readonly ResolvedPort[],
  nodeBoxes: readonly { id: string; x: number; y: number; width: number; height: number }[],
) {
  const rectsOverlap = (a: Bounds, b: Bounds): boolean =>
    a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
  const out: Array<{ kind: string; a: string; b: string }> = []
  const boxes = ports.map((p) => ({ port: p, box: portBox(p), label: portLabelBox(p) }))
  for (let i = 0; i < boxes.length; i++) {
    const a = boxes[i]
    if (!a) continue
    for (let j = i + 1; j < boxes.length; j++) {
      const b = boxes[j]
      if (!b) continue
      if (rectsOverlap(a.box, b.box)) out.push({ kind: 'port-port', a: a.port.id, b: b.port.id })
      if (a.label && b.label && rectsOverlap(a.label, b.label)) {
        out.push({ kind: 'label-label', a: a.port.id, b: b.port.id })
      }
    }
    if (a.label) {
      for (const node of nodeBoxes) {
        if (node.id === a.port.nodeId) continue
        const rect: Bounds = {
          x: node.x - node.width / 2,
          y: node.y - node.height / 2,
          width: node.width,
          height: node.height,
        }
        if (rectsOverlap(a.label, rect)) out.push({ kind: 'label-node', a: a.port.id, b: node.id })
      }
    }
  }
  return out
}

const sortKey = (e: { kind?: string; a: string; b: string; sharedLength?: number }) =>
  `${e.kind ?? ''}|${e.a}|${e.b}`

describe('grid-accelerated invariants equal the O(n²) reference', () => {
  test('findCollinearOverlaps — random octilinear polylines', () => {
    const rand = rng(7)
    for (let round = 0; round < 5; round++) {
      const lines: PolylineSpec[] = []
      for (let i = 0; i < 120; i++) {
        // octilinear-ish 2-4 segment polylines on a coarse lattice so
        // parallel near-tracks actually occur
        const pts: Position[] = []
        let x = Math.round(rand() * 60) * 20
        let y = Math.round(rand() * 30) * 20
        pts.push({ x, y })
        const segCount = 2 + Math.floor(rand() * 3)
        for (let s = 0; s < segCount; s++) {
          const dir = Math.floor(rand() * 4)
          const len = 20 + Math.round(rand() * 8) * 20
          if (dir === 0) x += len
          else if (dir === 1) x -= len
          else if (dir === 2) y += len
          else y -= len
          // a small fraction of tracks land 1px off to exercise the gap test
          pts.push({ x: x + (rand() < 0.2 ? 1 : 0), y })
        }
        lines.push({ id: `e${i}`, points: pts, halfWidth: 0.5 + rand() * 3 })
      }
      const expected = referenceCollinear(lines)
      const actual = findCollinearOverlaps(lines)
      const norm = (list: CollinearOverlap[]) =>
        [...list]
          .sort((p, q) => (sortKey(p) < sortKey(q) ? -1 : 1))
          .map((e) => `${e.a}|${e.b}|${e.sharedLength.toFixed(6)}`)
      expect(norm(actual)).toEqual(norm(expected))
    }
  })

  test('findPortClutter — random dense ports', () => {
    const rand = rng(13)
    for (let round = 0; round < 5; round++) {
      const ports: ResolvedPort[] = []
      for (let i = 0; i < 150; i++) {
        const sides = ['top', 'bottom', 'left', 'right'] as const
        ports.push({
          id: `p${i}`,
          nodeId: `n${i % 40}`,
          label: rand() < 0.7 ? `Gi0/${i}` : '',
          absolutePosition: { x: rand() * 1500, y: rand() * 800 },
          side: sides[Math.floor(rand() * 4)] ?? 'top',
          size: { width: 8, height: 8 },
        })
      }
      const nodeBoxes = Array.from({ length: 40 }, (_, i) => ({
        id: `n${i}`,
        x: rand() * 1500,
        y: rand() * 800,
        width: 60 + rand() * 100,
        height: 40 + rand() * 40,
      }))
      const expected = referencePortClutter(ports, nodeBoxes)
      const actual = findPortClutter(ports, nodeBoxes)
      const norm = (list: Array<{ kind: string; a: string; b: string }>) => list.map(sortKey).sort()
      expect(norm(actual)).toEqual(norm(expected))
    }
  })
})
