export interface Point {
  readonly x: number
  readonly y: number
}

/** Axis-aligned rectangle given by its center (`x`, `y`) and full width `w` / height `h`. */
export interface Box extends Point {
  readonly w: number
  readonly h: number
}

/** Axis-aligned rectangle given by its edge coordinates. */
export interface Bounds {
  readonly left: number
  readonly right: number
  readonly top: number
  readonly bottom: number
}

export interface HorizontalExtent {
  readonly left: number
  readonly right: number
}

export type Side = 'left' | 'right' | 'top' | 'bottom'

/** Canonical side order. Every loop over sides uses it so results stay deterministic. */
export const SIDES: readonly Side[] = ['left', 'right', 'top', 'bottom']

export type PerSide<T> = { readonly [S in Side]: T }

/** Distance from a frame edge to its content. */
export type Insets = PerSide<number>

/** Top and bottom edges run horizontally, so positions along them vary in X. */
export function runsHorizontally(side: Side): boolean {
  return side === 'top' || side === 'bottom'
}
