import { overlapOf } from '../geometry/box'
import { CONTACT_TOLERANCE, GEOMETRY_EPSILON } from '../geometry/tolerance'
import type { Box } from '../geometry/types'
import type { DirectionalHalo } from '../spacing/halo'
import { itemAt } from '../utils/collections'

export interface HaloSpacing {
  /** Pairs whose halos overlap. A drawable layout has none. */
  readonly overlapPairs: number
  /** Pairs whose painted outlines touch. */
  readonly contactPairs: number
  /** Smallest gap between painted outlines; `null` with fewer than two boxes. */
  readonly minVisibleGap: number | null
  /** Sum of squared halo overlap areas relative to the smaller band area. */
  readonly penalty: number
}

export function measureHaloSpacing(
  boxes: readonly Box[],
  strokeWidth: number,
  halos: readonly DirectionalHalo[],
  ratio: number,
): HaloSpacing {
  let overlapPairs = 0
  let contactPairs = 0
  let penalty = 0
  let minVisibleGap = Number.POSITIVE_INFINITY
  for (const [first, a] of boxes.entries())
    for (const [offset, b] of boxes.slice(first + 1).entries()) {
      const second = first + offset + 1
      const gapX = Math.max(0, Math.abs(a.x - b.x) - (a.w + b.w) / 2 - strokeWidth)
      const gapY = Math.max(0, Math.abs(a.y - b.y) - (a.h + b.h) / 2 - strokeWidth)
      const gap = Math.hypot(gapX, gapY)
      minVisibleGap = Math.min(minVisibleGap, gap)
      if (gap <= CONTACT_TOLERANCE) contactPairs += 1

      const haloA = itemAt(halos, first)
      const haloB = itemAt(halos, second)
      const overlap = overlapOf(haloA.box, haloB.box)
      if (ratio === 0 || overlap.x <= GEOMETRY_EPSILON || overlap.y <= GEOMETRY_EPSILON) continue
      const relativeOverlap = (overlap.x * overlap.y) / Math.min(haloA.bandArea, haloB.bandArea)
      penalty += relativeOverlap ** 2
      overlapPairs += 1
    }
  return {
    overlapPairs,
    contactPairs,
    penalty,
    minVisibleGap: Number.isFinite(minVisibleGap) ? minVisibleGap : null,
  }
}
