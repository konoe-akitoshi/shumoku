/** Raised when a seed cannot be laid out: invalid input or unsatisfiable spacing. */
export class LayoutError extends Error {
  override readonly name: string = 'LayoutError'
}

/** Raised when an internal assumption breaks. Indicates a bug rather than bad input. */
export class LayoutInvariantError extends Error {
  override readonly name: string = 'LayoutInvariantError'
}
