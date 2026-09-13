import { LayoutError } from '../errors'
import { translate } from '../geometry/box'
import { samePoint, withoutRepeatedPoints } from '../geometry/point'
import { GEOMETRY_EPSILON } from '../geometry/tolerance'
import type { Box, Point } from '../geometry/types'
import { assertDrawable, measureLayout } from '../metrics/layout-metrics'
import type { LayoutModel } from '../model'
import type { LayoutSettings } from '../options'
import { createExteriorRouter } from '../routing/exterior'
import { separateGroups } from '../spacing/separation'
import type { LayoutState, Route } from '../state'
import { interiorParts } from '../state'
import { firstItem, itemAt, lastItem, mapValue, range } from '../utils/collections'
import type { PortDistributionResult } from './port-distribution'

/**
 * Stage 3 — wire channels.
 *
 * Each wire piece running through the gap between two device rows (or between a row and the frame)
 * requests a lane. Pieces whose horizontal spans overlap need separate lanes; disjoint pieces share
 * one. Gaps that are too thin grow just enough while rows move rigidly, groups are separated again,
 * and pieces that compete for space are rerouted onto their lanes.
 */

/** Which in-group part of a link a piece belongs to. */
export type RoutePart = 'internal' | 'source' | 'target'

export interface SpanRequest {
  readonly id: string
  readonly link: number
  readonly part: RoutePart
  readonly left: number
  readonly right: number
}

export interface AllocatedSpan extends SpanRequest {
  readonly lane: number
  /** `lane` when another span competes for the space; `preserved` keeps the original path. */
  readonly routing: 'lane' | 'preserved'
}

export interface LaneAllocation {
  readonly spans: readonly AllocatedSpan[]
  readonly laneCount: number
  readonly requiredHeight: number
}

export interface VerticalBand {
  readonly top: number
  readonly bottom: number
}

export interface PathPiece {
  /** Index of the gap the piece lies in, or -1 inside a device row. */
  readonly gap: number
  readonly points: readonly Point[]
}

/** An allocated span placed on its lane. */
export interface WireSpan extends AllocatedSpan {
  readonly group: number
  readonly y: number
}

export interface WireChannelResult extends PortDistributionResult {
  readonly spans: readonly WireSpan[]
}

/** Interval partitioning: first free lane in order of left edge. Lanes are one pitch wide. */
export function allocateLanes(requests: readonly SpanRequest[], pitch: number): LaneAllocation {
  const occupiedUntil: number[] = []
  const assigned: (SpanRequest & { readonly lane: number })[] = []
  const ordered = [...requests].sort(
    (a, b) => a.left - b.left || a.right - b.right || a.id.localeCompare(b.id),
  )
  for (const request of ordered) {
    const freeLane = occupiedUntil.findIndex(
      (right) => right <= request.left - pitch / 2 + GEOMETRY_EPSILON,
    )
    const lane = freeLane < 0 ? occupiedUntil.length : freeLane
    occupiedUntil[lane] = request.right + pitch / 2
    assigned.push({ ...request, lane })
  }
  const competes = (a: SpanRequest, b: SpanRequest) =>
    a.id !== b.id &&
    a.left < b.right + pitch - GEOMETRY_EPSILON &&
    b.left < a.right + pitch - GEOMETRY_EPSILON
  return {
    spans: assigned.map((span) => ({
      ...span,
      routing: assigned.some((other) => competes(span, other)) ? 'lane' : 'preserved',
    })),
    laneCount: occupiedUntil.length,
    requiredHeight: occupiedUntil.length * pitch,
  }
}

/** Cuts a path at every gap boundary and labels each piece with the gap it lies in. */
export function splitAtRowGaps(
  points: readonly Point[],
  gaps: readonly VerticalBand[],
): PathPiece[] {
  const cuts = [...new Set(gaps.flatMap((gap) => [gap.top, gap.bottom]))]
  const pieces: { readonly gap: number; readonly points: Point[] }[] = []
  for (const [index, end] of points.entries()) {
    if (index === 0) continue
    const start = itemAt(points, index - 1)
    const dy = end.y - start.y
    const at = (t: number): Point => ({
      x: start.x + (end.x - start.x) * t,
      y: start.y + dy * t,
    })
    const parameters = [
      0,
      1,
      ...cuts.flatMap((y) => {
        const t = Math.abs(dy) > GEOMETRY_EPSILON ? (y - start.y) / dy : -1
        return t > GEOMETRY_EPSILON && t < 1 - GEOMETRY_EPSILON ? [t] : []
      }),
    ].sort((a, b) => a - b)
    for (const [k, t] of parameters.entries()) {
      if (k === 0) continue
      const previousT = itemAt(parameters, k - 1)
      if (t - previousT < GEOMETRY_EPSILON) continue
      const from = at(previousT)
      const to = at(t)
      const middle = (from.y + to.y) / 2
      const gap = gaps.findIndex(
        (band) => middle >= band.top - GEOMETRY_EPSILON && middle <= band.bottom + GEOMETRY_EPSILON,
      )
      const previous = pieces.at(-1)
      if (previous && previous.gap === gap && samePoint(lastItem(previous.points), from))
        previous.points.push(to)
      else pieces.push({ gap, points: [from, to] })
    }
  }
  return pieces
}

interface GapAllocation extends VerticalBand, LaneAllocation {
  readonly originalHeight: number
  readonly height: number
}

interface SplitPath {
  readonly link: number
  readonly group: number
  readonly part: RoutePart
  readonly pieces: readonly (PathPiece & { readonly requestId: string | null })[]
}

/** Maps Y through a group whose gaps have grown. */
interface GapStretch {
  readonly extra: number
  readonly map: (y: number) => number
}

export function allocateWireChannels(
  model: LayoutModel,
  state: PortDistributionResult,
  anchor: number,
  settings: LayoutSettings,
): WireChannelResult {
  const pitch = settings.lanePitch
  const gaps = model.groups.map((_, group) => rowGapsOf(state, group))
  const requests = gaps.map((groupGaps) => groupGaps.map((): SpanRequest[] => []))
  const paths: SplitPath[] = []
  const splitPath = (link: number, group: number, part: RoutePart, points: readonly Point[]) => {
    const pieces = splitAtRowGaps(points, itemAt(gaps, group)).map((piece, index) => {
      const start = firstItem(piece.points)
      const end = lastItem(piece.points)
      if (piece.gap < 0 || Math.abs(start.x - end.x) < GEOMETRY_EPSILON)
        return { ...piece, requestId: null }
      const id = `${link}:${part}:${index}`
      itemAt(itemAt(requests, group), piece.gap).push({
        id,
        link,
        part,
        left: Math.min(start.x, end.x),
        right: Math.max(start.x, end.x),
      })
      return { ...piece, requestId: id }
    })
    paths.push({ link, group, part, pieces })
  }
  for (const [linkIndex, link] of model.links.entries()) {
    const route = itemAt(state.routes, linkIndex)
    if (route.kind === 'internal') splitPath(linkIndex, link.sourceGroup, 'internal', route.points)
    else {
      const parts = interiorParts(route)
      splitPath(linkIndex, link.sourceGroup, 'source', parts.source)
      splitPath(linkIndex, link.targetGroup, 'target', parts.target)
    }
  }

  const allocations = gaps.map((groupGaps, group) =>
    groupGaps.map((gap, index): GapAllocation => {
      const originalHeight = gap.bottom - gap.top
      if (originalHeight <= GEOMETRY_EPSILON)
        throw new LayoutError('Wire lanes need vertically separated device rows')
      const allocation = allocateLanes(itemAt(itemAt(requests, group), index), pitch)
      return {
        top: gap.top,
        bottom: gap.bottom,
        ...allocation,
        originalHeight,
        height: Math.max(originalHeight, allocation.requiredHeight),
      }
    }),
  )

  const anchorGroup = itemAt(model.nodes, anchor).group
  const stretches = allocations.map((groupGaps, group) =>
    createGapStretch(groupGaps, group === anchorGroup ? itemAt(state.nodes, anchor).y : null),
  )
  const stretchY = (group: number, y: number) => itemAt(stretches, group).map(y)
  const stretchedNodes = state.nodes.map((node, index) => ({
    ...node,
    y: stretchY(itemAt(model.nodes, index).group, node.y),
  }))
  const stretchedFrames = state.frames.map((frame, group) => ({
    ...frame,
    y: (stretchY(group, frame.y - frame.h / 2) + stretchY(group, frame.y + frame.h / 2)) / 2,
    h: frame.h + itemAt(stretches, group).extra,
  }))
  const stretchedTerminals = state.terminals.map((terminal) => ({
    ...terminal,
    y: stretchY(terminal.group, terminal.y),
  }))

  const offsetOf = (nodes: readonly Box[], group: number): Point => {
    const member = firstItem(itemAt(model.groups, group).members)
    const now = itemAt(nodes, member)
    const stretched = itemAt(stretchedNodes, member)
    return { x: now.x - stretched.x, y: now.y - stretched.y }
  }
  /** Where a pre-stretch point of `group` ends up once the group has moved with `nodes`. */
  const place = (point: Point, group: number, nodes: readonly Box[]): Point => {
    const offset = offsetOf(nodes, group)
    return { x: point.x + offset.x, y: stretchY(group, point.y) + offset.y }
  }
  const terminalsAt = (nodes: readonly Box[]) =>
    stretchedTerminals.map((terminal) => {
      const offset = offsetOf(nodes, terminal.group)
      return translate(terminal, offset.x, offset.y)
    })

  const separated = separateGroups({
    model,
    nodes: stretchedNodes,
    anchor,
    settings,
    fitFrames: (nodes) =>
      stretchedFrames.map((frame, group) => {
        const offset = offsetOf(nodes, group)
        return translate(frame, offset.x, offset.y)
      }),
    attachmentsFor: (nodes) => ({
      terminals: terminalsAt(nodes),
      endpoints: model.links.map((link, index) => {
        const route = itemAt(state.routes, index)
        return {
          source: place(firstItem(route.points), link.sourceGroup, nodes),
          target: place(lastItem(route.points), link.targetGroup, nodes),
        }
      }),
    }),
  })

  const { nodes, frames } = separated
  const terminals = terminalsAt(nodes)
  const routeExterior = createExteriorRouter(frames, terminals)
  const spans = allocations.flatMap((groupGaps, group) => {
    const offset = offsetOf(nodes, group)
    return groupGaps.flatMap((gap) => {
      const firstLaneTop =
        stretchY(group, gap.top) + offset.y + (gap.height - gap.requiredHeight) / 2
      return gap.spans.map(
        (span): WireSpan => ({
          ...span,
          group,
          left: span.left + offset.x,
          right: span.right + offset.x,
          y: firstLaneTop + (span.lane + 0.5) * pitch,
        }),
      )
    })
  })

  const spanById = new Map(spans.map((span) => [span.id, span]))
  const routedParts = new Map(
    paths.map((path) => [
      `${path.link}:${path.part}`,
      withoutRepeatedPoints(
        path.pieces.flatMap((piece) => {
          const moved = piece.points.map((point) => place(point, path.group, nodes))
          const span = piece.requestId === null ? undefined : spanById.get(piece.requestId)
          if (span === undefined || span.routing === 'preserved') return moved
          const start = firstItem(moved)
          const end = lastItem(moved)
          return [start, { x: start.x, y: span.y }, { x: end.x, y: span.y }, end]
        }),
      ),
    ]),
  )
  const routes = model.links.map((_, index): Route => {
    if (itemAt(state.routes, index).kind === 'internal')
      return { kind: 'internal', points: mapValue(routedParts, `${index}:internal`) }
    const source = mapValue(routedParts, `${index}:source`)
    const target = mapValue(routedParts, `${index}:target`)
    return {
      kind: 'cross-group',
      points: withoutRepeatedPoints([
        ...source,
        ...routeExterior(index).slice(1),
        ...target.slice(1),
      ]),
      exit: lastItem(source),
      entry: firstItem(target),
    }
  })

  assertDrawable(
    measureLayout(model, { nodes, frames, routes, terminals }, settings),
    'Wire channel allocation',
  )
  return {
    ...state,
    nodes,
    frames,
    terminals,
    routes,
    rows: state.rows.map((groupRows, group) =>
      groupRows.map((row) => ({ ...row, y: place({ x: 0, y: row.y }, group, nodes).y })),
    ),
    transits: state.transits.map((transit) => ({
      ...transit,
      ...place(transit, transit.group, nodes),
    })),
    spans,
  }
}

/** Gaps above, between and below the device rows of a group. */
function rowGapsOf(state: LayoutState, group: number): VerticalBand[] {
  const frame = itemAt(state.frames, group)
  const bands = itemAt(state.rows, group).map((row) => ({
    top: Math.min(
      ...row.members.map((member) => {
        const node = itemAt(state.nodes, member)
        return node.y - node.h / 2
      }),
    ),
    bottom: Math.max(
      ...row.members.map((member) => {
        const node = itemAt(state.nodes, member)
        return node.y + node.h / 2
      }),
    ),
  }))
  return range(bands.length + 1).map((index) => ({
    top: index > 0 ? itemAt(bands, index - 1).bottom : frame.y - frame.h / 2,
    bottom: index < bands.length ? itemAt(bands, index).top : frame.y + frame.h / 2,
  }))
}

/**
 * Piecewise-affine vertical map: points inside a gap scale with the gap, points inside a row
 * translate rigidly. The group grows symmetrically around its center, except that the anchor's
 * group is pinned so the anchor keeps its Y.
 */
function createGapStretch(
  allocations: readonly GapAllocation[],
  anchorY: number | null,
): GapStretch {
  const extra = allocations.reduce((total, gap) => total + gap.height - gap.originalHeight, 0)
  const stretch = (y: number): number => {
    let shift = -extra / 2
    for (const gap of allocations) {
      if (y < gap.top) break
      if (y <= gap.bottom)
        return gap.top + shift + ((y - gap.top) * gap.height) / gap.originalHeight
      shift += gap.height - gap.originalHeight
    }
    return y + shift
  }
  const pin = anchorY === null ? 0 : anchorY - stretch(anchorY)
  return { extra, map: (y) => stretch(y) + pin }
}
