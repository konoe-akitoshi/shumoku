import { LayoutInvariantError } from './errors'
import { samePoint } from './geometry/point'
import type { Box, Point } from './geometry/types'
import type { LinkEnd } from './model'
import type { BoundaryTerminal } from './routing/boundary-terminals'
import type { AttachmentGeometry } from './spacing/halo'
import { firstItem, lastItem } from './utils/collections'

/** A link whose two nodes share a group. */
export interface InternalRoute {
  readonly kind: 'internal'
  readonly points: readonly Point[]
}

/** A link between groups: source interior → exit terminal → exterior → entry terminal → target interior. */
export interface CrossGroupRoute {
  readonly kind: 'cross-group'
  readonly points: readonly Point[]
  readonly exit: Point
  readonly entry: Point
}

export type Route = InternalRoute | CrossGroupRoute

/** Devices of one group that share an upstream distance and therefore a row. */
export interface Row {
  /** Position of the row inside its group, from the top. */
  readonly rank: number
  /** Node indices ordered left to right. */
  readonly members: readonly number[]
  readonly y: number
}

/**
 * Space a wire reserves among devices. A row transit is the slot where a link crosses an intermediate
 * row; a peer lane is the detour above a row that joins two non-adjacent nodes of that row.
 */
export interface TransitSlot extends Box {
  readonly id: string
  readonly kind: 'row-transit' | 'peer-lane'
  readonly link: number
  readonly group: number
}

/** Geometry shared by all stages. Arrays are index-aligned with the {@link LayoutModel}. */
export interface LayoutState {
  readonly nodes: readonly Box[]
  readonly frames: readonly Box[]
  readonly terminals: readonly BoundaryTerminal[]
  readonly routes: readonly Route[]
  readonly rows: readonly (readonly Row[])[]
}

export function routeEndpoint(route: Route, end: LinkEnd): Point {
  return end === 'source' ? firstItem(route.points) : lastItem(route.points)
}

export function attachmentGeometryOf(
  routes: readonly Route[],
  terminals: readonly BoundaryTerminal[],
): AttachmentGeometry {
  return {
    endpoints: routes.map((route) => ({
      source: routeEndpoint(route, 'source'),
      target: routeEndpoint(route, 'target'),
    })),
    terminals,
  }
}

/** The two in-group parts of a cross-group route, each including its terminal. */
export function interiorParts(route: CrossGroupRoute): {
  readonly source: readonly Point[]
  readonly target: readonly Point[]
} {
  const exitIndex = route.points.findIndex((point) => samePoint(point, route.exit))
  const entryIndex = route.points.findIndex((point) => samePoint(point, route.entry))
  if (exitIndex < 0 || entryIndex <= exitIndex)
    throw new LayoutInvariantError('Cross-group route lost its frame crossings')
  return {
    source: route.points.slice(0, exitIndex + 1),
    target: route.points.slice(entryIndex),
  }
}
