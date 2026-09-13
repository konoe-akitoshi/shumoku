import { LayoutError, LayoutInvariantError } from '../errors'
import { sideOfBoundaryPoint } from '../geometry/box'
import { samePoint, toPoint } from '../geometry/point'
import { segmentEntersInterior } from '../geometry/segment'
import { GEOMETRY_EPSILON } from '../geometry/tolerance'
import type { Bounds, Box, Point, Side } from '../geometry/types'
import { runsHorizontally } from '../geometry/types'
import type { LayoutModel, LinkEnd, ModelLink } from '../model'
import { endNode, LINK_ENDS, linkEndKey, oppositeEnd } from '../model'
import type { LayoutSettings } from '../options'
import { interiorRoute, memberObstacles } from '../routing/interior'
import type { Route } from '../state'
import { routeEndpoint } from '../state'
import { firstItem, itemAt, lastItem, mapValue, range } from '../utils/collections'
import type { RowPackingResult } from './row-packing'

/**
 * Stage 2 — port distribution.
 *
 * Links that share a node side leave from distinct points one lane pitch apart, centered on the side
 * midpoint and ordered by the direction toward the peer node. The first straight run of each wire
 * moves with its port; a segment that would then clip a device is rerouted around it.
 */

export interface NodePort extends Point {
  readonly link: number
  readonly end: LinkEnd
  readonly node: number
  readonly side: Side
  /** Position among the ports of this side, from the most negative direction. */
  readonly rank: number
  readonly count: number
  /** Offset from the side midpoint along the side. */
  readonly offset: number
  /** Angle toward the peer node, measured along the side. */
  readonly direction: number
}

export interface PortDistributionResult extends RowPackingResult {
  readonly ports: readonly NodePort[]
  /** Wire segments that had to be rerouted after their port moved. */
  readonly portRepairs: number
}

type PortDraft = Omit<NodePort, 'x' | 'y' | 'rank' | 'count' | 'offset'>

export function assignNodePorts(
  model: LayoutModel,
  nodes: readonly Box[],
  routes: readonly Route[],
  pitch: number,
): NodePort[] {
  if (!Number.isFinite(pitch) || pitch <= 0) throw new LayoutError('Port pitch must be positive')
  const bySide = new Map<string, PortDraft[]>()
  for (const [linkIndex, link] of model.links.entries())
    for (const end of LINK_ENDS) {
      const node = endNode(link, end)
      const box = itemAt(nodes, node)
      const peer = itemAt(nodes, endNode(link, oppositeEnd(end)))
      const side = sideOfBoundaryPoint(box, routeEndpoint(itemAt(routes, linkIndex), end))
      const alongSide = runsHorizontally(side) ? peer.x - box.x : peer.y - box.y
      const acrossSide = runsHorizontally(side) ? peer.y - box.y : peer.x - box.x
      const key = `${node}:${side}`
      const drafts = bySide.get(key) ?? []
      drafts.push({
        link: linkIndex,
        end,
        node,
        side,
        direction: Math.atan2(alongSide, Math.abs(acrossSide)),
      })
      bySide.set(key, drafts)
    }

  return [...bySide.values()].flatMap((drafts) => {
    const { node, side } = firstItem(drafts)
    const box = itemAt(nodes, node)
    const horizontal = runsHorizontally(side)
    const sideLength = horizontal ? box.w : box.h
    if (drafts.length * pitch > sideLength + GEOMETRY_EPSILON)
      throw new LayoutError(
        `Not enough room for ${drafts.length} ports on the ${side} side of ${itemAt(model.nodes, node).id}`,
      )
    return [...drafts]
      .sort(
        (a, b) =>
          a.direction - b.direction ||
          itemAt(model.links, a.link).id.localeCompare(itemAt(model.links, b.link).id) ||
          a.end.localeCompare(b.end),
      )
      .map((draft, rank): NodePort => {
        const offset = (rank - (drafts.length - 1) / 2) * pitch
        return {
          ...draft,
          rank,
          count: drafts.length,
          offset,
          x: box.x + (horizontal ? offset : side === 'left' ? -box.w / 2 : box.w / 2),
          y: box.y + (horizontal ? (side === 'top' ? -box.h / 2 : box.h / 2) : offset),
        }
      })
  })
}

export function distributePorts(
  model: LayoutModel,
  state: RowPackingResult,
  settings: LayoutSettings,
): PortDistributionResult {
  const ports = assignNodePorts(model, state.nodes, state.routes, settings.lanePitch)
  const portOf = new Map(ports.map((port) => [linkEndKey(port.link, port.end), port]))
  let portRepairs = 0
  const routes = model.links.map((link, linkIndex) => {
    const result = respreadRoute(model, state, link, linkIndex, {
      source: mapValue(portOf, linkEndKey(linkIndex, 'source')),
      target: mapValue(portOf, linkEndKey(linkIndex, 'target')),
      clearance: settings.clearance,
    })
    portRepairs += result.repairs
    return result.route
  })
  return { ...state, routes, ports, portRepairs }
}

function respreadRoute(
  model: LayoutModel,
  state: RowPackingResult,
  link: ModelLink,
  linkIndex: number,
  { source, target, clearance }: { source: NodePort; target: NodePort; clearance: number },
): { readonly route: Route; readonly repairs: number } {
  const route = itemAt(state.routes, linkIndex)
  const owners = new Set([link.source, link.target])
  const obstacles = new Map<number, Bounds[]>()
  const obstaclesIn = (group: number): Bounds[] => {
    const cached = obstacles.get(group)
    if (cached) return cached
    const created = memberObstacles(
      state.nodes,
      itemAt(model.groups, group).members,
      owners,
      clearance,
    )
    obstacles.set(group, created)
    return created
  }
  const isClear = (a: Point, b: Point, group: number) =>
    !obstaclesIn(group).some((obstacle) => segmentEntersInterior(a, b, obstacle))

  const transits = state.transits.filter((transit) => transit.link === linkIndex)
  if (
    route.kind === 'internal' &&
    transits.length === 0 &&
    isStraight(route.points) &&
    isClear(source, target, link.sourceGroup)
  )
    return { route: { kind: 'internal', points: [toPoint(source), toPoint(target)] }, repairs: 0 }

  const pinned: Point[] = [
    ...(route.kind === 'cross-group' ? [route.exit, route.entry] : []),
    ...transits.flatMap((transit) =>
      transit.kind === 'row-transit'
        ? [
            { x: transit.x, y: transit.y - transit.h / 2 },
            { x: transit.x, y: transit.y + transit.h / 2 },
          ]
        : [toPoint(transit)],
    ),
  ]
  const shifted = shiftStems(route.points, source, target, pinned)

  let repairs = 0
  const repair = (points: readonly Point[], group: number): Point[] => {
    const repaired: Point[] = [firstItem(points)]
    for (const [index, point] of points.entries()) {
      if (index === 0) continue
      const previous = itemAt(points, index - 1)
      if (isClear(previous, point, group)) repaired.push(point)
      else {
        repairs += 1
        repaired.push(
          ...interiorRoute(previous, point, obstaclesIn(group), itemAt(state.frames, group)).slice(
            1,
          ),
        )
      }
    }
    return repaired
  }

  if (route.kind === 'internal')
    return { route: { kind: 'internal', points: repair(shifted, link.sourceGroup) }, repairs }
  const exitIndex = shifted.findIndex((point) => samePoint(point, route.exit))
  const entryIndex = shifted.findIndex((point) => samePoint(point, route.entry))
  if (exitIndex < 0 || entryIndex <= exitIndex)
    throw new LayoutInvariantError('Port distribution lost the frame crossings of a route')
  const points = [
    ...repair(shifted.slice(0, exitIndex + 1), link.sourceGroup),
    ...shifted.slice(exitIndex + 1, entryIndex),
    ...repair(shifted.slice(entryIndex), link.targetGroup),
  ]
  return { route: { ...route, points }, repairs }
}

/**
 * Moves each port and the straight run leading away from it by the port's offset. A run stops at a
 * bend or at a pinned point (terminal or transit slot). If both ends want to move the same point
 * differently, it stays put.
 */
function shiftStems(
  points: readonly Point[],
  source: NodePort,
  target: NodePort,
  pinned: readonly Point[],
): Point[] {
  const proposals = new Map<number, Point>()
  for (const port of [source, target]) {
    const original = port.end === 'source' ? firstItem(points) : lastItem(points)
    const axis = runsHorizontally(port.side) ? 'x' : 'y'
    const shift = port[axis] - original[axis]
    const walk = range(points.length)
    if (port.end === 'target') walk.reverse()
    for (const [step, index] of walk.entries()) {
      if (step === walk.length - 1) break
      const point = itemAt(points, index)
      const leavesRun =
        step > 0 &&
        (Math.abs(point[axis] - original[axis]) > GEOMETRY_EPSILON ||
          pinned.some((pin) => samePoint(point, pin)))
      if (leavesRun) break
      const moved =
        axis === 'x' ? { x: point.x + shift, y: point.y } : { x: point.x, y: point.y + shift }
      const earlier = proposals.get(index)
      proposals.set(index, earlier && !samePoint(earlier, moved) ? point : moved)
    }
  }
  const shifted = points.map((point, index) => proposals.get(index) ?? toPoint(point))
  shifted[0] = toPoint(source)
  shifted[shifted.length - 1] = toPoint(target)
  return shifted
}

function isStraight(points: readonly Point[]): boolean {
  const first = firstItem(points)
  const last = lastItem(points)
  return points.every(
    (point) =>
      Math.abs(
        (last.x - first.x) * (point.y - first.y) - (last.y - first.y) * (point.x - first.x),
      ) < GEOMETRY_EPSILON,
  )
}
