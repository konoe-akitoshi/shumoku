// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * The order of lines, lower lane first, that crosses least: the sum of `cost(a, b)` over every
 * pair with `a` below `b`. Up to eight lines every order is weighed, by a search over the
 * subsets that goes through the lines in the order given, so that equal costs keep that order.
 * Beyond that the lines are put in one at a time, each where it adds least; `exact` says which.
 */
export function laneOrder(
  lines: readonly string[],
  cost: (a: string, b: string) => number,
): { order: string[]; exact: boolean } {
  const n = lines.length
  if (n > 8) {
    const order: string[] = []
    for (const line of lines) {
      // Each place for the line is weighed from the one before it: moving it up past a line
      // changes only the cost of that pair.
      let sum = 0
      for (const other of order) sum += cost(line, other)
      let bestAt = 0
      let bestCost = sum
      for (const [slot, other] of order.entries()) {
        sum += cost(other, line) - cost(line, other)
        if (sum < bestCost) {
          bestCost = sum
          bestAt = slot + 1
        }
      }
      order.splice(bestAt, 0, line)
    }
    return { order, exact: false }
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
  const order: string[] = []
  for (let rest = (1 << n) - 1; rest !== 0; ) {
    const target = f(rest)
    for (let r = 0; r < n; r++) {
      if ((rest & (1 << r)) === 0) continue
      const without = rest & ~(1 << r)
      if (below(r, rest) + f(without) === target) {
        order.push(lines[r] ?? '')
        rest = without
        break
      }
    }
  }
  return { order, exact: true }
}
