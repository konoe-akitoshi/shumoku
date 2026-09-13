import { LayoutError } from './errors'

export interface LayoutOptions {
  /** Outline width of device rectangles (px). */
  readonly nodeStrokeWidth: number
  /** Outline width of group frames (px). */
  readonly frameStrokeWidth: number
  /** Stroke width of drawn links (px). */
  readonly wireWidth: number
  /** Halo band area of a connection-free box, as a fraction of its painted area. */
  readonly haloAreaRatio: number
  /** Scales the clearance on both sides of a wire lane and between ports on one side. */
  readonly wireClearanceScale: number
  /** Upper bound on sweeps when pushing overlapping group halos apart. */
  readonly maxSeparationPasses: number
  readonly solverMaxIterations: number
  /** Primal residual and update size below which the spring solver has converged. */
  readonly solverTolerance: number
}

/** Values of the accepted experiment checkpoint (dependency-y with upstream detection). */
export const DEFAULT_LAYOUT_OPTIONS: LayoutOptions = {
  nodeStrokeWidth: 1,
  frameStrokeWidth: 1.5,
  wireWidth: 1.6,
  haloAreaRatio: 0.15,
  wireClearanceScale: 1.5,
  maxSeparationPasses: 128,
  solverMaxIterations: 20000,
  solverTolerance: 1e-7,
}

/** Options plus the spacing quantities derived from them. */
export interface LayoutSettings extends LayoutOptions {
  /** Gap kept between a wire and an unrelated outline: half of node stroke plus wire width. */
  readonly clearance: number
  /** Width a wire reserves when it crosses a device row. */
  readonly transitWidth: number
  /** Center distance between parallel wire lanes, and between ports sharing a side. */
  readonly lanePitch: number
}

export function resolveLayoutSettings(overrides: Partial<LayoutOptions> = {}): LayoutSettings {
  const options: LayoutOptions = { ...DEFAULT_LAYOUT_OPTIONS, ...overrides }
  requireAtLeast(options.nodeStrokeWidth, 0, 'nodeStrokeWidth')
  requireAtLeast(options.frameStrokeWidth, 0, 'frameStrokeWidth')
  requirePositive(options.wireWidth, 'wireWidth')
  requireAtLeast(options.haloAreaRatio, 0, 'haloAreaRatio')
  requirePositive(options.wireClearanceScale, 'wireClearanceScale')
  requirePositiveInteger(options.maxSeparationPasses, 'maxSeparationPasses')
  requirePositiveInteger(options.solverMaxIterations, 'solverMaxIterations')
  requirePositive(options.solverTolerance, 'solverTolerance')
  const clearance = (options.nodeStrokeWidth + options.wireWidth) / 2
  return {
    ...options,
    clearance,
    transitWidth: options.wireWidth + 2 * clearance,
    lanePitch: options.wireWidth + 2 * clearance * options.wireClearanceScale,
  }
}

function requireAtLeast(value: number, minimum: number, name: string): void {
  if (!Number.isFinite(value) || value < minimum)
    throw new LayoutError(`${name} must be a finite number ≥ ${minimum}`)
}

function requirePositive(value: number, name: string): void {
  if (!Number.isFinite(value) || value <= 0)
    throw new LayoutError(`${name} must be a positive number`)
}

function requirePositiveInteger(value: number, name: string): void {
  if (!Number.isInteger(value) || value < 1)
    throw new LayoutError(`${name} must be a positive integer`)
}
