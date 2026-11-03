// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * The order of lines, lower lane first, that crosses least: the sum of `cost(a, b)` over every
 * pair with `a` below `b`. Up to eight lines every order is weighed, by a search over the
 * subsets that goes through the lines in the order given, so that equal costs keep that order.
 * Beyond that the lines are put in one at a time, each where it adds least, and then each line in
 * turn is taken out and put back where it adds least, for as long as that lowers the sum: an order
 * is only ever replaced by one that crosses less, so this stops by itself. `exact` says whether the
 * order is known to be the best: always for the full search, and otherwise when the sum is the
 * least that each pair can cost on its own (no order can cost less than that).
 */
export function laneOrder<L extends string>(
  lines: readonly L[],
  cost: (a: L, b: L) => number,
): { order: L[]; exact: boolean } {
  const n = lines.length
  if (n > 8) {
    const order: L[] = []
    for (const line of lines) {
      // Each place for the line is weighed from the one before it: moving it up past a line
      // changes only the cost of that pair.
      let sum = 0
      for (const other of order) sum += cost(line, other)
      // where several places add the same, the last: lines in the order given stay in it
      let bestAt = 0
      let bestCost = sum
      for (const [slot, other] of order.entries()) {
        sum += cost(other, line) - cost(line, other)
        if (sum <= bestCost) {
          bestCost = sum
          bestAt = slot + 1
        }
      }
      order.splice(bestAt, 0, line)
    }
    // Each line moved to where it adds least, the others kept as they are.
    const place = (line: L) => {
      const from = order.indexOf(line)
      order.splice(from, 1)
      let sum = 0
      for (const other of order) sum += cost(line, other)
      let now = 0
      for (const [slot, other] of order.entries()) {
        now += slot < from ? cost(other, line) : cost(line, other)
      }
      let bestAt = 0
      let bestCost = sum
      for (const [slot, other] of order.entries()) {
        sum += cost(other, line) - cost(line, other)
        if (sum <= bestCost) {
          bestCost = sum
          bestAt = slot + 1
        }
      }
      const at = bestCost < now ? bestAt : from
      order.splice(at, 0, line)
      return at !== from
    }
    for (let moved = true; moved; ) {
      moved = false
      for (const line of lines) if (place(line)) moved = true
    }
    let sum = 0
    let least = 0
    for (const [i, a] of order.entries()) {
      for (const b of order.slice(i + 1)) {
        sum += cost(a, b)
        least += Math.min(cost(a, b), cost(b, a))
      }
    }
    return { order, exact: sum === least }
  }
  const c = lines.map((a) => lines.map((b) => cost(a, b)))
  /** What putting line `r` below all of `rest` that remains adds. */
  const below = (r: number, rest: number): number => {
    let sum = 0
    for (let s = 0; s < n; s++) if (s !== r && (rest & (1 << s)) !== 0) sum += c[r]?.[s] ?? 0
    return sum
  }
  const best = new Map<number, number>()
  const f = (rest: number): number => {
    if (rest === 0) return 0
    const known = best.get(rest)
    if (known !== undefined) return known
    let min = Number.POSITIVE_INFINITY
    for (let r = 0; r < n; r++) {
      if ((rest & (1 << r)) === 0) continue
      min = Math.min(min, below(r, rest) + f(rest & ~(1 << r)))
    }
    best.set(rest, min)
    return min
  }
  const order: L[] = []
  for (let rest = (1 << n) - 1; rest !== 0; ) {
    const target = f(rest)
    for (let r = 0; r < n; r++) {
      if ((rest & (1 << r)) === 0) continue
      const without = rest & ~(1 << r)
      if (below(r, rest) + f(without) === target) {
        const line = lines[r]
        if (line === undefined) throw new Error(`no line ${r} among ${n} to order`)
        order.push(line)
        rest = without
        break
      }
    }
  }
  return { order, exact: true }
}
