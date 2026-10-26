// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Variable placement with separation constraints (VPSC): the positions x that minimise
 * sum w_i (x_i - desired_i)^2 subject to constraints x_right - x_left >= gap. After Dwyer,
 * Marriott and Stuckey, "Fast node overlap removal" (2005). Variables that must touch are kept
 * in a block that moves as one; `satisfy` merges blocks until no constraint is violated, and
 * the solver then splits a block at an active constraint that pulls the wrong way (a negative
 * Lagrange multiplier) and satisfies again, until none does.
 */

/** x[right] - x[left] >= gap. */
export interface Separation {
  readonly left: number
  readonly right: number
  readonly gap: number
}

export interface VpscInput {
  /** Where each variable would like to be. */
  readonly desired: readonly number[]
  /** How much each variable minds being away from it; positive. Every variable weighs 1 when absent. */
  readonly weight?: readonly number[]
  readonly separations: readonly Separation[]
}

interface Variable {
  readonly index: number
  readonly desired: number
  readonly weight: number
  block: Block
  /** Position relative to its block. */
  offset: number
}

interface Block {
  vars: Variable[]
  position: number
}

interface Constraint extends Separation {
  active: boolean
  l: Variable
  r: Variable
}

const SLACK_TOLERANCE = 1e-9
const MULTIPLIER_TOLERANCE = 1e-9

/** Thrown when the separations contradict each other: they form a cycle. */
export class InfeasibleError extends Error {}

/** The optimal positions. Throws `InfeasibleError` when the separations form a cycle. */
export function solveVpsc(input: VpscInput): number[] {
  const { desired, separations } = input
  const vars: Variable[] = desired.map((d, index) => {
    const block: Block = { vars: [], position: d }
    const variable: Variable = {
      index,
      desired: d,
      weight: input.weight?.[index] ?? 1,
      block,
      offset: 0,
    }
    block.vars.push(variable)
    return variable
  })
  const constraints: Constraint[] = separations.map((s) => {
    const l = vars[s.left]
    const r = vars[s.right]
    if (!l || !r) throw new RangeError('a separation names a variable that does not exist')
    return { ...s, active: false, l, r }
  })
  const incoming: Constraint[][] = vars.map(() => [])
  for (const c of constraints) incoming[c.right]?.push(c)
  const order = topologicalOrder(vars, constraints)

  const positionOf = (v: Variable) => v.block.position + v.offset
  const slack = (c: Constraint) => positionOf(c.r) - c.gap - positionOf(c.l)

  /** A block sits where the weighted mean of what its variables want, less their offsets, is. */
  const settle = (block: Block) => {
    let weight = 0
    let moment = 0
    for (const v of block.vars) {
      weight += v.weight
      moment += v.weight * (v.desired - v.offset)
    }
    block.position = moment / weight
  }

  /** Joins the blocks across the most violated constraint into one, until none is violated. */
  const mergeInto = (start: Variable) => {
    let block = start.block
    for (;;) {
      let worst: Constraint | undefined
      let worstSlack = -SLACK_TOLERANCE
      for (const v of block.vars) {
        for (const c of incoming[v.index] ?? []) {
          if (c.l.block === block) continue
          const s = slack(c)
          if (s < worstSlack) {
            worst = c
            worstSlack = s
          }
        }
      }
      if (!worst) return
      const c = worst
      // Make the constraint tight inside the larger block's frame.
      const [keep, move, delta] =
        c.l.block.vars.length >= c.r.block.vars.length
          ? [c.l.block, c.r.block, c.l.offset + c.gap - c.r.offset]
          : [c.r.block, c.l.block, c.r.offset - c.gap - c.l.offset]
      for (const v of move.vars) {
        v.offset += delta
        v.block = keep
        keep.vars.push(v)
      }
      c.active = true
      settle(keep)
      block = keep
    }
  }

  const satisfy = () => {
    for (const v of order) mergeInto(v)
  }

  /** Splits every block that has an active constraint pulling the wrong way; false if none. */
  const refine = (): boolean => {
    let split = false
    for (const block of new Set(vars.map((v) => v.block))) {
      const found = mostNegativeMultiplier(block, constraints)
      if (!found) continue
      found.constraint.active = false
      for (const side of found.sides) {
        const part: Block = { vars: side, position: 0 }
        for (const v of side) v.block = part
        settle(part)
      }
      split = true
    }
    return split
  }

  satisfy()
  for (let pass = 0; pass < 4 * vars.length + 8 && refine(); pass++) satisfy()
  for (const c of constraints) {
    if (slack(c) < -1e-6) throw new InfeasibleError('the separations cannot all be met')
  }
  return vars.map(positionOf)
}

/**
 * The active constraint of a block whose multiplier is most negative, with the two sides of the
 * block when it is removed. The active constraints of a block form a tree. A constraint's
 * multiplier is the pull on the variables on its right side, sum w_v (x_v - desired_v): the
 * pulls inside a side cancel against each other, and the pulls of the whole block add up to
 * nothing because the block sits at the weighted mean.
 */
function mostNegativeMultiplier(
  block: Block,
  constraints: readonly Constraint[],
): { constraint: Constraint; sides: [Variable[], Variable[]] } | undefined {
  const root = block.vars[0]
  if (!root || block.vars.length < 2) return undefined
  const inBlock = new Set(block.vars)
  const adjacent = new Map<Variable, { to: Variable; c: Constraint }[]>(
    block.vars.map((v) => [v, []]),
  )
  for (const c of constraints) {
    if (!c.active || !inBlock.has(c.l) || !inBlock.has(c.r)) continue
    adjacent.get(c.l)?.push({ to: c.r, c })
    adjacent.get(c.r)?.push({ to: c.l, c })
  }
  const parent = new Map<Variable, { from: Variable; c: Constraint } | undefined>([
    [root, undefined],
  ])
  const visited: Variable[] = []
  const stack = [root]
  for (let v = stack.pop(); v !== undefined; v = stack.pop()) {
    visited.push(v)
    for (const { to, c } of adjacent.get(v) ?? []) {
      if (parent.has(to)) continue
      parent.set(to, { from: v, c })
      stack.push(to)
    }
  }
  const pull = new Map<Variable, number>(
    visited.map((v) => [v, v.weight * (v.block.position + v.offset - v.desired)]),
  )
  let worst: { constraint: Constraint; multiplier: number; below: Variable } | undefined
  for (const v of [...visited].reverse()) {
    const up = parent.get(v)
    if (!up) continue
    const total = pull.get(v) ?? 0
    pull.set(up.from, (pull.get(up.from) ?? 0) + total)
    // The subtree under v is the constraint's right side when v is its right end.
    const multiplier = up.c.r === v ? total : -total
    if (multiplier < -MULTIPLIER_TOLERANCE && (!worst || multiplier < worst.multiplier)) {
      worst = { constraint: up.c, multiplier, below: v }
    }
  }
  if (!worst) return undefined
  const under = new Set<Variable>()
  for (const v of visited) {
    for (let w: Variable | undefined = v; w !== undefined; w = parent.get(w)?.from) {
      if (w === worst.below) {
        under.add(v)
        break
      }
    }
  }
  return {
    constraint: worst.constraint,
    sides: [block.vars.filter((v) => under.has(v)), block.vars.filter((v) => !under.has(v))],
  }
}

function topologicalOrder(vars: readonly Variable[], constraints: readonly Constraint[]) {
  const into = vars.map(() => 0)
  const out: Constraint[][] = vars.map(() => [])
  for (const c of constraints) {
    into[c.right] = (into[c.right] ?? 0) + 1
    out[c.left]?.push(c)
  }
  const order = vars.filter((v) => into[v.index] === 0)
  for (const v of order) {
    for (const c of out[v.index] ?? []) {
      into[c.right] = (into[c.right] ?? 0) - 1
      if (into[c.right] === 0) order.push(c.r)
    }
  }
  if (order.length < vars.length) throw new InfeasibleError('the separations form a cycle')
  return order
}
