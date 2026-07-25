// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * HA / stack "glasses" hull geometry.
 *
 * A redundancy group (HA pair, stack, vPC domain …) is drawn as ONE solid
 * silhouette behind its member nodes: a rounded "lens" per member, joined to
 * its neighbour by a bridge with a notch cut out at the seam — the opening the
 * redundancy link (a normal, metrics-capable wire) shows through. Pure
 * geometry: both the Svelte renderer and the static SVG renderer feed member
 * bboxes in and get a single SVG path back, so the two outputs stay in parity.
 *
 * Proportions follow the approved design: uniform padding around the node
 * bbox (port bars deliberately ignored so the outline hugs the CARD), outer
 * corner radius concentric with the node corner (nodeR + pad), and a small
 * concave fillet where the bridge meets each lens.
 */

import type { Bounds } from '../models/types.js'

export interface HaHullOptions {
  /** Uniform padding around each member bbox (node card, ports ignored). */
  pad?: number
  /** Outer corner radius. Concentric default: node corner 10 + pad 10. */
  outerR?: number
  /** Height of the seam opening the redundancy link shows through. */
  notchH?: number
  /** Concave fillet radius where a bridge meets a lens side. */
  filletR?: number
}

export interface HaHullInput {
  /** Member node bboxes. Sorted internally by center x (left → right). */
  members: Bounds[]
  /**
   * Seam centerlines, one per adjacent pair AFTER sorting: `seams[i]` sits
   * between sorted members i and i+1. Typically the redundancy link's y.
   * Missing entries default to the vertical center of the adjacent lenses.
   */
  seams?: Array<{ y: number }>
}

export interface HaHullResult {
  /** SVG path `d` for the whole group (single closed subpath). */
  d: string
  /** Union bounds of all lenses (bbox of the hull). */
  bounds: Bounds
  /**
   * True when the members don't line up as a horizontal chain (vertical
   * overlap too small for a notch, or lenses overlap horizontally) and the
   * hull degraded to a plain rounded rect over the union bbox.
   */
  fallback: boolean
}

const DEFAULTS = { pad: 10, outerR: 20, notchH: 32, filletR: 8 }

/** Minimum seam opening below which the glasses shape stops reading. */
const MIN_NOTCH = 8

interface Lens {
  left: number
  right: number
  top: number
  bottom: number
}

const fmt = (n: number): string => {
  const r = Math.round(n * 100) / 100
  // Normalize -0 so path strings are snapshot-stable.
  return (Object.is(r, -0) ? 0 : r).toString()
}

function roundedRectPath(l: Lens, r: number): string {
  const radius = Math.min(r, (l.right - l.left) / 2, (l.bottom - l.top) / 2)
  const p: string[] = []
  p.push(`M${fmt(l.left + radius)},${fmt(l.top)}`)
  p.push(`H${fmt(l.right - radius)}`)
  p.push(`Q${fmt(l.right)},${fmt(l.top)} ${fmt(l.right)},${fmt(l.top + radius)}`)
  p.push(`V${fmt(l.bottom - radius)}`)
  p.push(`Q${fmt(l.right)},${fmt(l.bottom)} ${fmt(l.right - radius)},${fmt(l.bottom)}`)
  p.push(`H${fmt(l.left + radius)}`)
  p.push(`Q${fmt(l.left)},${fmt(l.bottom)} ${fmt(l.left)},${fmt(l.bottom - radius)}`)
  p.push(`V${fmt(l.top + radius)}`)
  p.push(`Q${fmt(l.left)},${fmt(l.top)} ${fmt(l.left + radius)},${fmt(l.top)}`)
  p.push('Z')
  return p.join(' ')
}

function unionBounds(lenses: Lens[]): Bounds {
  let left = Number.POSITIVE_INFINITY
  let top = Number.POSITIVE_INFINITY
  let right = Number.NEGATIVE_INFINITY
  let bottom = Number.NEGATIVE_INFINITY
  for (const l of lenses) {
    left = Math.min(left, l.left)
    top = Math.min(top, l.top)
    right = Math.max(right, l.right)
    bottom = Math.max(bottom, l.bottom)
  }
  return { x: left, y: top, width: right - left, height: bottom - top }
}

/**
 * Build the glasses hull path for one redundancy group.
 *
 * Falls back to a rounded rect over the union bbox when the chain isn't a
 * clean horizontal row (`fallback: true`), so callers never have to guard —
 * every group gets SOME hull.
 */
export function buildHaHullPath(input: HaHullInput, opts?: HaHullOptions): HaHullResult {
  const { pad, outerR, notchH, filletR } = { ...DEFAULTS, ...opts }

  const members = [...input.members].sort((a, b) => a.x + a.width / 2 - (b.x + b.width / 2))
  const lenses: Lens[] = members.map((m) => ({
    left: m.x - pad,
    right: m.x + m.width + pad,
    top: m.y - pad,
    bottom: m.y + m.height + pad,
  }))
  const bounds = unionBounds(lenses)

  const first = lenses[0]
  if (!first) return { d: '', bounds, fallback: false }
  if (lenses.length === 1) {
    return { d: roundedRectPath(first, outerR), bounds, fallback: false }
  }

  // Per-seam geometry: opening center + effective notch/fillet, or bail out.
  interface Seam {
    y1: number
    y2: number
    fillet: number
  }
  const seamGeo: Seam[] = []
  for (let i = 0; i < lenses.length - 1; i++) {
    const a = lenses[i]
    const b = lenses[i + 1]
    if (!a || !b)
      return { d: roundedRectPath(boundsToLens(bounds), outerR), bounds, fallback: true }

    const gap = b.left - a.right
    if (gap <= 0) {
      return { d: roundedRectPath(boundsToLens(bounds), outerR), bounds, fallback: true }
    }
    const fillet = Math.min(filletR, gap / 2)

    // The notch must fit between the corner arcs of BOTH adjacent lenses.
    const laneTop = Math.max(a.top, b.top) + outerR + fillet
    const laneBottom = Math.min(a.bottom, b.bottom) - outerR - fillet
    const maxNotch = laneBottom - laneTop
    if (maxNotch < MIN_NOTCH) {
      return { d: roundedRectPath(boundsToLens(bounds), outerR), bounds, fallback: true }
    }
    const notch = Math.min(notchH, maxNotch)
    const seamY = input.seams?.[i]?.y ?? (laneTop + laneBottom) / 2
    const cy = Math.min(Math.max(seamY, laneTop + notch / 2), laneBottom - notch / 2)
    seamGeo.push({ y1: cy - notch / 2, y2: cy + notch / 2, fillet })
  }

  // Clockwise, single subpath. Top pass left→right, bottom pass right→left.
  const p: string[] = []
  const rFor = (l: Lens): number => Math.min(outerR, (l.right - l.left) / 2, (l.bottom - l.top) / 2)

  const firstR = rFor(first)
  p.push(`M${fmt(first.left + firstR)},${fmt(first.top)}`)
  for (let i = 0; i < lenses.length; i++) {
    const l = lenses[i]
    if (!l) continue
    const r = rFor(l)
    p.push(`H${fmt(l.right - r)}`)
    p.push(`Q${fmt(l.right)},${fmt(l.top)} ${fmt(l.right)},${fmt(l.top + r)}`)
    const seam = seamGeo[i]
    const next = lenses[i + 1]
    if (seam && next) {
      const nextR = rFor(next)
      p.push(`V${fmt(seam.y1 - seam.fillet)}`)
      p.push(`Q${fmt(l.right)},${fmt(seam.y1)} ${fmt(l.right + seam.fillet)},${fmt(seam.y1)}`)
      p.push(`H${fmt(next.left - seam.fillet)}`)
      p.push(`Q${fmt(next.left)},${fmt(seam.y1)} ${fmt(next.left)},${fmt(seam.y1 - seam.fillet)}`)
      p.push(`V${fmt(next.top + nextR)}`)
      p.push(`Q${fmt(next.left)},${fmt(next.top)} ${fmt(next.left + nextR)},${fmt(next.top)}`)
    }
  }
  const last = lenses[lenses.length - 1]
  if (last) {
    const r = rFor(last)
    p.push(`V${fmt(last.bottom - r)}`)
    p.push(`Q${fmt(last.right)},${fmt(last.bottom)} ${fmt(last.right - r)},${fmt(last.bottom)}`)
  }
  for (let i = lenses.length - 1; i >= 0; i--) {
    const l = lenses[i]
    if (!l) continue
    const r = rFor(l)
    p.push(`H${fmt(l.left + r)}`)
    const seam = seamGeo[i - 1]
    const prev = lenses[i - 1]
    if (seam && prev) {
      const prevR = rFor(prev)
      p.push(`Q${fmt(l.left)},${fmt(l.bottom)} ${fmt(l.left)},${fmt(l.bottom - r)}`)
      p.push(`V${fmt(seam.y2 + seam.fillet)}`)
      p.push(`Q${fmt(l.left)},${fmt(seam.y2)} ${fmt(l.left - seam.fillet)},${fmt(seam.y2)}`)
      p.push(`H${fmt(prev.right + seam.fillet)}`)
      p.push(`Q${fmt(prev.right)},${fmt(seam.y2)} ${fmt(prev.right)},${fmt(seam.y2 + seam.fillet)}`)
      p.push(`V${fmt(prev.bottom - prevR)}`)
      p.push(
        `Q${fmt(prev.right)},${fmt(prev.bottom)} ${fmt(prev.right - prevR)},${fmt(prev.bottom)}`,
      )
    } else {
      p.push(`Q${fmt(l.left)},${fmt(l.bottom)} ${fmt(l.left)},${fmt(l.bottom - r)}`)
      p.push(`V${fmt(l.top + r)}`)
      p.push(`Q${fmt(l.left)},${fmt(l.top)} ${fmt(l.left + r)},${fmt(l.top)}`)
      p.push('Z')
    }
  }
  return { d: p.join(' '), bounds, fallback: false }
}

function boundsToLens(b: Bounds): Lens {
  return { left: b.x, top: b.y, right: b.x + b.width, bottom: b.y + b.height }
}

/**
 * Union-find grouping of coupling pairs into redundancy groups (an N-member
 * stack is a chain of pair links). Generic over ids so both renderers can
 * feed their edge shapes in. `kind` of the group = the first pair's kind.
 */
export function groupCouplingPairs(
  pairs: Array<{ a: string; b: string; kind?: string }>,
): Array<{ members: string[]; kind?: string }> {
  const parent = new Map<string, string>()
  const find = (x: string): string => {
    let root = x
    while ((parent.get(root) ?? root) !== root) root = parent.get(root) ?? root
    // Path compression
    let cur = x
    while (cur !== root) {
      const next = parent.get(cur) ?? root
      parent.set(cur, root)
      cur = next
    }
    return root
  }
  const union = (a: string, b: string): void => {
    const ra = find(a)
    const rb = find(b)
    if (ra !== rb) parent.set(ra, rb)
  }
  for (const { a, b } of pairs) {
    if (!parent.has(a)) parent.set(a, a)
    if (!parent.has(b)) parent.set(b, b)
    union(a, b)
  }
  const groups = new Map<string, { members: string[]; kind?: string }>()
  for (const id of parent.keys()) {
    const root = find(id)
    let g = groups.get(root)
    if (!g) {
      g = { members: [] }
      groups.set(root, g)
    }
    g.members.push(id)
  }
  for (const { a, kind } of pairs) {
    const g = groups.get(find(a))
    if (g && g.kind === undefined) g.kind = kind
  }
  return [...groups.values()]
}
