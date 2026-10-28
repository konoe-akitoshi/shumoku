// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import type { Box } from './metrics.js'
import { type PortPlan, round } from './ports.js'
import { type FrameId, frameKey, type Geometry, type Problem, ROOT } from './problem.js'

/** Where lines may run: the coordinates they may turn at, and which steps are shut or in a frame. */
export interface Grid {
  xs: number[]
  ys: number[]
  nx: number
  ny: number
  /** A step from `(ix, iy)` to `(ix + 1, iy)` is at index `iy * nx + ix`; vertical likewise. */
  blockedH: Uint8Array
  blockedV: Uint8Array
  /** Bit `i` of chunk `i >> 5` is set for a step inside the `i`th frame. */
  frameH: Uint32Array[]
  frameV: Uint32Array[]
  frames: FrameId[]
  /**
   * How many lines a step has room for between the cards on either side of it; a step with no
   * card on one side, the ring around the drawing included, has room for any number.
   */
  capH: Uint16Array
  capV: Uint16Array
}

/** The room of a step that is bounded by nothing. */
export const UNBOUNDED = 0xffff

const EPS = 1e-3

function lowerBound(a: readonly number[], v: number): number {
  let lo = 0
  let hi = a.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if ((a[mid] ?? 0) < v) lo = mid + 1
    else hi = mid
  }
  return lo
}

/**
 * The grid the lines are routed on: the edges of every box that must be avoided (kept a pitch
 * clear), the ports and where lines first turn, and the middle of each gap between them, which
 * is where a corridor's lines run. A card is an obstacle; a frame is not, but a step inside
 * one is marked so that a line that has no business there can be charged for it. A ring runs
 * around everything, far enough out for every line laid over the drawing to run side by side
 * on it, so that those lines have somewhere to go when the corridors between the boxes are full.
 */
export function buildGrid(problem: Problem, geometry: Geometry, plans: readonly PortPlan[]): Grid {
  const { pitch } = problem.metrics
  const obstacles: Box[] = []
  for (const item of problem.items) {
    const boxes =
      item.kind === 'unit'
        ? (item.members ?? []).map((m) => geometry.boxes.get(m.node.id))
        : [geometry.boxes.get(item.id)]
    for (const b of boxes) {
      if (b)
        obstacles.push({
          x: b.x - pitch,
          y: b.y - pitch,
          width: b.width + 2 * pitch,
          height: b.height + 2 * pitch,
        })
    }
  }

  const overlays = problem.lines.filter((l) => l.role === 'overlay').length
  const everything: Box[] = [...obstacles]
  for (const f of problem.frames) {
    const b = f.id === ROOT ? undefined : geometry.boxes.get(frameKey(f.id))
    if (b) everything.push(b)
  }
  // The ring's lines are spread about its middle, so half their width plus a lead-out keeps
  // the innermost clear of what is inside.
  const ring = problem.metrics.leadOut + (overlays * pitch) / 2

  const axis = (
    low: (b: Box) => number,
    high: (b: Box) => number,
    ports: (p: PortPlan) => number[],
  ) => {
    const raw = new Set<number>()
    if (overlays > 0 && everything.length > 0) {
      raw.add(round(Math.min(...everything.map(low)) - ring))
      raw.add(round(Math.max(...everything.map(high)) + ring))
    }
    for (const b of obstacles) {
      raw.add(round(low(b)))
      raw.add(round(high(b)))
    }
    for (const p of plans) for (const v of ports(p)) raw.add(round(v))
    const base = [...raw].sort((a, b) => a - b)
    const all = new Set(base)
    for (const [i, v] of base.entries()) {
      const next = base[i + 1]
      if (next !== undefined && next - v >= 2 * pitch) all.add(round((v + next) / 2))
    }
    return [...all].sort((a, b) => a - b)
  }
  const xs = axis(
    (b) => b.x,
    (b) => b.x + b.width,
    (p) => [p.at.x, p.lead.x],
  )
  const ys = axis(
    (b) => b.y,
    (b) => b.y + b.height,
    (p) => [p.at.y, p.lead.y],
  )
  const nx = xs.length
  const ny = ys.length

  const blockedH = new Uint8Array(nx * ny)
  const blockedV = new Uint8Array(nx * ny)
  /** Calls `mark` for every step strictly inside the box, horizontal and vertical. */
  const eachStep = (box: Box, mark: (h: number | undefined, v: number | undefined) => void) => {
    const x0 = box.x
    const x1 = box.x + box.width
    const y0 = box.y
    const y1 = box.y + box.height
    for (let iy = lowerBound(ys, y0 + EPS); iy < ny && (ys[iy] ?? 0) < y1 - EPS; iy++) {
      for (let ix = lowerBound(xs, x0 - EPS); ix + 1 < nx && (xs[ix + 1] ?? 0) <= x1 + EPS; ix++) {
        mark(iy * nx + ix, undefined)
      }
    }
    for (let ix = lowerBound(xs, x0 + EPS); ix < nx && (xs[ix] ?? 0) < x1 - EPS; ix++) {
      for (let iy = lowerBound(ys, y0 - EPS); iy + 1 < ny && (ys[iy + 1] ?? 0) <= y1 + EPS; iy++) {
        mark(undefined, iy * nx + ix)
      }
    }
  }
  for (const b of obstacles) {
    eachStep(b, (h, v) => {
      if (h !== undefined) blockedH[h] = 1
      if (v !== undefined) blockedV[v] = 1
    })
  }

  const frames = problem.frames.filter((f) => f.id !== ROOT).map((f) => f.id)
  const chunks = Math.ceil(frames.length / 32)
  const frameH = Array.from({ length: chunks }, () => new Uint32Array(nx * ny))
  const frameV = Array.from({ length: chunks }, () => new Uint32Array(nx * ny))
  for (const [i, id] of frames.entries()) {
    const box = geometry.boxes.get(frameKey(id))
    const h = frameH[i >> 5]
    const v = frameV[i >> 5]
    if (!box || !h || !v) continue
    const bit = 1 << (i & 31)
    eachStep(box, (hi, vi) => {
      if (hi !== undefined) h[hi] = (h[hi] ?? 0) | bit
      if (vi !== undefined) v[vi] = (v[vi] ?? 0) | bit
    })
  }

  // A step's room is the width of the corridor it runs along: the distance between the nearest
  // closed steps on either side, which are inside the cards (kept a pitch clear of them).
  const capH = new Uint16Array(nx * ny)
  const capV = new Uint16Array(nx * ny)
  const room = (between: number) =>
    Math.min(
      UNBOUNDED - 1,
      Math.max(0, Math.floor((between + 2 * pitch - 2 * problem.metrics.leadOut) / pitch) + 1),
    )
  for (let ix = 0; ix + 1 < nx; ix++) {
    const above = new Int32Array(ny).fill(-1)
    let edge = -1
    for (let iy = 0; iy < ny; iy++) {
      if (blockedH[iy * nx + ix]) edge = iy + 1
      above[iy] = edge
    }
    let below = -1
    for (let iy = ny - 1; iy >= 0; iy--) {
      if (blockedH[iy * nx + ix]) below = iy - 1
      const up = above[iy] ?? -1
      capH[iy * nx + ix] = up < 0 || below < 0 ? UNBOUNDED : room((ys[below] ?? 0) - (ys[up] ?? 0))
    }
  }
  for (let iy = 0; iy + 1 < ny; iy++) {
    const left = new Int32Array(nx).fill(-1)
    let edge = -1
    for (let ix = 0; ix < nx; ix++) {
      if (blockedV[iy * nx + ix]) edge = ix + 1
      left[ix] = edge
    }
    let right = -1
    for (let ix = nx - 1; ix >= 0; ix--) {
      if (blockedV[iy * nx + ix]) right = ix - 1
      const l = left[ix] ?? -1
      capV[iy * nx + ix] = l < 0 || right < 0 ? UNBOUNDED : room((xs[right] ?? 0) - (xs[l] ?? 0))
    }
  }
  return { xs, ys, nx, ny, blockedH, blockedV, frameH, frameV, frames, capH, capV }
}
