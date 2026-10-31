// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Positions along one axis under separation constraints. The vertical and the horizontal layers
 * both ask the same question, "put these values where they are pulled to, but never closer than
 * so much", so one solver answers both and either may be replaced without the other noticing.
 */
export interface AxisInput {
  n: number
  /** `v[j] - v[i] >= d`. */
  sep: { i: number; j: number; d: number }[]
  /** `v[j] - v[i] = d`; the two are one variable from then on. */
  equal: { i: number; j: number; d: number }[]
  /** Minimise `w * (v[i] - t)^2`. */
  pull: { i: number; t: number; w: number }[]
  /** Minimise `w * (v[j] - v[i] - d)^2`. */
  pair: { i: number; j: number; w: number; d: number }[]
  /** The least a value is worth moving; it is what stops the search. */
  tolerance: number
  /**
   * Values that already satisfy every constraint, to improve on. Without them the earliest
   * values are the start, which needs the constraints to be free of cycles.
   */
  start?: Float64Array
  /** The least and the most a value may be, where it is limited; a value with none is free. */
  lower?: readonly number[]
  upper?: readonly number[]
}

interface Edge {
  to: number
  d: number
}
interface Term {
  other: number
  base: number
  w: number
}

/** The values closest to what is pulled, among those that satisfy every constraint. */
export function solveAxis(input: AxisInput): Float64Array {
  const { n, tolerance } = input
  const parent = Array.from({ length: n }, (_, i) => i)
  const shift = new Array<number>(n).fill(0)
  /** The root of a variable and its offset from it, so that v[x] = v[root] + offset. */
  const find = (x: number): { root: number; offset: number } => {
    const p = parent[x] ?? x
    if (p === x) return { root: x, offset: 0 }
    const up = find(p)
    const offset = (shift[x] ?? 0) + up.offset
    parent[x] = up.root
    shift[x] = offset
    return { root: up.root, offset }
  }
  for (const { i, j, d } of input.equal) {
    const a = find(i)
    const b = find(j)
    if (a.root === b.root) continue
    parent[b.root] = a.root
    shift[b.root] = a.offset + d - b.offset
  }

  const classOf = new Array<number>(n)
  const offset = new Array<number>(n)
  const roots: number[] = []
  const index = new Map<number, number>()
  for (let x = 0; x < n; x++) {
    const { root, offset: o } = find(x)
    let c = index.get(root)
    if (c === undefined) {
      c = roots.length
      index.set(root, c)
      roots.push(root)
    }
    classOf[x] = c
    offset[x] = o
  }
  const m = roots.length
  const cls = (x: number) => classOf[x] ?? 0
  const off = (x: number) => offset[x] ?? 0
  /** What bounds a class: the tightest of what bounds its members, moved to the class's own value. */
  const floor = new Float64Array(m).fill(Number.NEGATIVE_INFINITY)
  const ceiling = new Float64Array(m).fill(Number.POSITIVE_INFINITY)
  for (let x = 0; x < n; x++) {
    const c = cls(x)
    floor[c] = Math.max(floor[c] ?? 0, (input.lower?.[x] ?? Number.NEGATIVE_INFINITY) - off(x))
    ceiling[c] = Math.min(ceiling[c] ?? 0, (input.upper?.[x] ?? Number.POSITIVE_INFINITY) - off(x))
  }

  const into: Edge[][] = Array.from({ length: m }, () => [])
  const out: Edge[][] = Array.from({ length: m }, () => [])
  for (const { i, j, d } of input.sep) {
    const a = cls(i)
    const b = cls(j)
    if (a === b) continue
    const dd = d + off(i) - off(j)
    out[a]?.push({ to: b, d: dd })
    into[b]?.push({ to: a, d: dd })
  }

  const value = new Float64Array(m)
  if (input.start) {
    for (const [c, root] of roots.entries()) value[c] = input.start[root] ?? 0
  } else {
    // Each class as early as the classes before it allow. Separations may run both ways between two
    // classes (each reaching past the other), which is no cycle as long as the distances round the
    // ring add up to nothing: only a ring that must grow without end has no place to start.
    for (let c = 0; c < m; c++) value[c] = Math.max(0, floor[c] ?? 0)
    const queue = [...value.keys()]
    const queued = new Array<boolean>(m).fill(true)
    // How many constraints the chain that put each value where it is runs along, and the value
    // before it on the chain: a chain of as many as there are values comes back to one of them,
    // and is a ring that grows without end.
    const links = new Array<number>(m).fill(0)
    const via = new Array<number>(m).fill(-1)
    for (let head = 0; head < queue.length; head++) {
      const c = queue[head] as number
      queued[c] = false
      for (const e of out[c] ?? []) {
        const need = (value[c] ?? 0) + e.d
        if ((value[e.to] ?? 0) >= need) continue
        value[e.to] = need
        links[e.to] = (links[c] ?? 0) + 1
        via[e.to] = c
        if ((links[e.to] ?? 0) >= m) {
          const ring: number[] = []
          for (let x = e.to; !ring.includes(x); x = via[x] ?? x) ring.push(roots[x] ?? x)
          throw new Error(`the constraints contain a cycle, through ${ring.reverse().join(', ')}`)
        }
        if (!queued[e.to]) {
          queued[e.to] = true
          queue.push(e.to)
        }
      }
    }
  }

  const terms: Term[][] = Array.from({ length: m }, () => [])
  for (const { i, t, w } of input.pull) terms[cls(i)]?.push({ other: -1, base: t - off(i), w })
  for (const { i, j, w, d } of input.pair) {
    const a = cls(i)
    const b = cls(j)
    if (a === b) continue
    terms[a]?.push({ other: b, base: off(j) - off(i) - d, w })
    terms[b]?.push({ other: a, base: off(i) - off(j) + d, w })
  }
  const pulled = [...terms.keys()].filter((c) => (terms[c]?.length ?? 0) > 0)

  /**
   * A chain held together by constraints with no room left cannot be moved one variable at a
   * time. Such classes are moved as one block, by the mean of what its members are pulled by,
   * as far as the constraints to the outside allow. Returns the largest move made.
   */
  const shiftBlocks = (): number => {
    const block = Array.from({ length: m }, (_, c) => c)
    const head = (c: number): number => {
      let r = c
      while (block[r] !== r) r = block[r] ?? r
      return r
    }
    const slack = 1e-9
    for (const [c, edges] of out.entries()) {
      for (const e of edges) {
        if ((value[e.to] ?? 0) - (value[c] ?? 0) - e.d <= slack) block[head(e.to)] = head(c)
      }
    }
    const members = new Map<number, number[]>()
    for (let c = 0; c < m; c++) members.set(head(c), [...(members.get(head(c)) ?? []), c])
    let largest = 0
    for (const [root, cs] of members) {
      if (cs.length < 2) continue
      let total = 0
      let weight = 0
      let lo = Number.NEGATIVE_INFINITY
      let hi = Number.POSITIVE_INFINITY
      for (const c of cs) {
        for (const t of terms[c] ?? []) {
          if (t.other >= 0 && head(t.other) === root) continue
          total += t.w * ((t.other < 0 ? 0 : (value[t.other] ?? 0)) + t.base - (value[c] ?? 0))
          weight += t.w
        }
        for (const e of into[c] ?? []) {
          if (head(e.to) !== root) lo = Math.max(lo, (value[e.to] ?? 0) + e.d - (value[c] ?? 0))
        }
        for (const e of out[c] ?? []) {
          if (head(e.to) !== root) hi = Math.min(hi, (value[e.to] ?? 0) - e.d - (value[c] ?? 0))
        }
        lo = Math.max(lo, (floor[c] ?? Number.NEGATIVE_INFINITY) - (value[c] ?? 0))
        hi = Math.min(hi, (ceiling[c] ?? Number.POSITIVE_INFINITY) - (value[c] ?? 0))
      }
      if (weight === 0 || lo > hi) continue
      const delta = Math.min(hi, Math.max(lo, total / weight))
      if (delta === 0) continue
      for (const c of cs) value[c] = (value[c] ?? 0) + delta
      largest = Math.max(largest, Math.abs(delta))
    }
    return largest
  }

  for (let sweep = 0; sweep < Math.max(m, 1) && pulled.length > 0; sweep++) {
    let moved = 0
    const order = sweep % 2 === 0 ? pulled : [...pulled].reverse()
    for (const c of order) {
      let total = 0
      let weight = 0
      for (const t of terms[c] ?? []) {
        total += t.w * ((t.other < 0 ? 0 : (value[t.other] ?? 0)) + t.base)
        weight += t.w
      }
      if (weight === 0) continue
      let lo = Number.NEGATIVE_INFINITY
      let hi = Number.POSITIVE_INFINITY
      for (const e of into[c] ?? []) lo = Math.max(lo, (value[e.to] ?? 0) + e.d)
      for (const e of out[c] ?? []) hi = Math.min(hi, (value[e.to] ?? 0) - e.d)
      lo = Math.max(lo, floor[c] ?? Number.NEGATIVE_INFINITY)
      hi = Math.min(hi, ceiling[c] ?? Number.POSITIVE_INFINITY)
      const here = value[c] ?? 0
      const target = lo <= hi ? Math.min(hi, Math.max(lo, total / weight)) : here
      moved = Math.max(moved, Math.abs(target - here))
      value[c] = target
    }
    moved = Math.max(moved, shiftBlocks())
    if (moved < tolerance) break
  }

  // Float noise and a blocked chain can leave a constraint a hair short; push until it holds.
  for (let pass = 0; pass < m; pass++) {
    let changed = false
    for (const c of [...value.keys()]) {
      for (const e of out[c] ?? []) {
        const need = (value[c] ?? 0) + e.d
        if ((value[e.to] ?? 0) < need) {
          value[e.to] = need
          changed = true
        }
      }
    }
    if (!changed) break
  }

  const result = new Float64Array(n)
  for (let x = 0; x < n; x++) result[x] = (value[cls(x)] ?? 0) + off(x)
  return result
}
