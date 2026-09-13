import { LayoutError } from '../../errors'
import { itemAt, range } from '../../utils/collections'

/** Variable index standing for the fixed origin (value 0). */
export const GROUND = -1

export type SpringKind = 'dependency' | 'wire'
export type ConstraintKind =
  | 'node-band'
  | 'lane-node'
  | 'lane-lane'
  | 'anchor'
  | 'translation-gauge'

/** Prefers `value[to] − value[from] = target`, with energy `weight · (difference − target)²`. */
export interface Spring {
  readonly from: number
  readonly to: number
  readonly target: number
  readonly weight: number
  readonly kind: SpringKind
}

/** Requires `min ≤ value[to] − value[from] ≤ max`. */
export interface DifferenceConstraint {
  readonly from: number
  readonly to: number
  readonly min?: number
  readonly max?: number
  readonly kind: ConstraintKind
}

export interface SolverOptions {
  readonly maxIterations: number
  readonly tolerance: number
}

export interface SpringSolution {
  readonly values: readonly number[]
  readonly iterations: number
  readonly residual: number
  readonly change: number
  readonly energyBefore: number
  readonly energyAfter: number
}

type Term = Pick<Spring, 'from' | 'to'>

export function springEnergy(values: ArrayLike<number>, springs: readonly Spring[]): number {
  return springs.reduce(
    (total, spring) => total + spring.weight * (differenceOf(values, spring) - spring.target) ** 2,
    0,
  )
}

/**
 * Minimizes the spring energy subject to difference constraints with ADMM.
 *
 * The x-update solves the springs plus a quadratic pull toward the split variables with one Cholesky
 * factorization reused for every iteration; the split variables are the constraint differences
 * clamped into their intervals. The problem is convex, so the result does not depend on `initial`
 * (which only seeds the iteration). A component of variables connected to neither ground nor any
 * grounded term has no unique solution and is rejected.
 */
export function solveSpringSystem(
  initial: readonly number[],
  springs: readonly Spring[],
  constraints: readonly DifferenceConstraint[],
  options: SolverOptions,
): SpringSolution {
  const size = initial.length
  for (const term of [...springs, ...constraints]) validateTerm(term, size)
  const rho =
    springs.length > 0
      ? springs.reduce((total, spring) => total + spring.weight, 0) / springs.length
      : 1

  const normal = new SquareMatrix(size)
  const linear = new Float64Array(size)
  for (const spring of springs)
    for (const [row, rowCoefficient] of coefficientsOf(spring)) {
      linear[row] = entry(linear, row) + spring.weight * spring.target * rowCoefficient
      for (const [column, columnCoefficient] of coefficientsOf(spring))
        normal.add(row, column, spring.weight * rowCoefficient * columnCoefficient)
    }
  for (const constraint of constraints)
    for (const [row, rowCoefficient] of coefficientsOf(constraint))
      for (const [column, columnCoefficient] of coefficientsOf(constraint))
        normal.add(row, column, rho * rowCoefficient * columnCoefficient)
  const factor = choleskyFactor(normal)

  let values = [...initial]
  let split = constraints.map((constraint) => clampTo(differenceOf(values, constraint), constraint))
  const scaledDual = constraints.map(() => 0)
  let iterations = 0
  let residual = Number.POSITIVE_INFINITY
  let change = Number.POSITIVE_INFINITY
  for (const step of range(options.maxIterations)) {
    const rhs = Float64Array.from(linear)
    for (const [index, constraint] of constraints.entries())
      for (const [row, coefficient] of coefficientsOf(constraint))
        rhs[row] =
          entry(rhs, row) + rho * coefficient * (itemAt(split, index) - itemAt(scaledDual, index))
    const next = solveFactored(factor, rhs)
    change = Math.max(...next.map((value, index) => Math.abs(value - itemAt(values, index))))
    values = next

    const previousSplit = split
    split = constraints.map((constraint, index) =>
      clampTo(differenceOf(values, constraint) + itemAt(scaledDual, index), constraint),
    )
    residual = 0
    for (const [index, constraint] of constraints.entries()) {
      const primal = differenceOf(values, constraint) - itemAt(split, index)
      scaledDual[index] = itemAt(scaledDual, index) + primal
      residual = Math.max(
        residual,
        Math.abs(primal),
        Math.abs(itemAt(split, index) - itemAt(previousSplit, index)),
      )
    }
    iterations = step + 1
    if (residual < options.tolerance && change < options.tolerance) break
  }
  if (residual >= options.tolerance || change >= options.tolerance)
    throw new LayoutError(`Spring system did not converge: residual=${residual}, change=${change}`)
  return {
    values,
    iterations,
    residual,
    change,
    energyBefore: springEnergy(initial, springs),
    energyAfter: springEnergy(values, springs),
  }
}

export function differenceOf(values: ArrayLike<number>, term: Term): number {
  return variableValue(values, term.to) - variableValue(values, term.from)
}

function variableValue(values: ArrayLike<number>, variable: number): number {
  return variable === GROUND ? 0 : entry(values, variable)
}

/** Indices were validated up front, so a missing entry cannot occur. */
function entry(values: ArrayLike<number>, index: number): number {
  return values[index] ?? 0
}

function validateTerm(term: Term, size: number): void {
  for (const variable of [term.from, term.to])
    if (variable !== GROUND && !(Number.isInteger(variable) && variable >= 0 && variable < size))
      throw new LayoutError(`Spring system references unknown variable ${variable}`)
}

function coefficientsOf(term: Term): [variable: number, coefficient: number][] {
  const coefficients: [number, number][] = []
  if (term.from !== GROUND) coefficients.push([term.from, -1])
  if (term.to !== GROUND) coefficients.push([term.to, 1])
  return coefficients
}

function clampTo(value: number, constraint: DifferenceConstraint): number {
  return Math.max(
    constraint.min ?? Number.NEGATIVE_INFINITY,
    Math.min(constraint.max ?? Number.POSITIVE_INFINITY, value),
  )
}

class SquareMatrix {
  readonly size: number
  private readonly cells: Float64Array

  constructor(size: number) {
    this.size = size
    this.cells = new Float64Array(size * size)
  }

  get(row: number, column: number): number {
    return this.cells[row * this.size + column] ?? 0
  }

  set(row: number, column: number, value: number): void {
    this.cells[row * this.size + column] = value
  }

  add(row: number, column: number, value: number): void {
    this.set(row, column, this.get(row, column) + value)
  }
}

function choleskyFactor(matrix: SquareMatrix): SquareMatrix {
  const lower = new SquareMatrix(matrix.size)
  for (const row of range(matrix.size))
    for (const column of range(row + 1)) {
      let value = matrix.get(row, column)
      for (const k of range(column)) value -= lower.get(row, k) * lower.get(column, k)
      if (row === column && value <= 0)
        throw new LayoutError('Spring system has a component without an anchor')
      lower.set(row, column, row === column ? Math.sqrt(value) : value / lower.get(column, column))
    }
  return lower
}

function solveFactored(lower: SquareMatrix, rhs: Float64Array): number[] {
  const size = lower.size
  const forward = new Float64Array(size)
  const solution = new Float64Array(size)
  for (const row of range(size)) {
    let value = entry(rhs, row)
    for (const column of range(row)) value -= lower.get(row, column) * entry(forward, column)
    forward[row] = value / lower.get(row, row)
  }
  for (const row of range(size).reverse()) {
    let value = entry(forward, row)
    for (const column of range(size).slice(row + 1))
      value -= lower.get(column, row) * entry(solution, column)
    solution[row] = value / lower.get(row, row)
  }
  return [...solution]
}
