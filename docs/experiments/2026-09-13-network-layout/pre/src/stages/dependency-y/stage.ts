import { boundsOf } from '../../geometry/box'
import { fitFrameAround } from '../../geometry/frame'
import { toPoint } from '../../geometry/point'
import { GEOMETRY_EPSILON } from '../../geometry/tolerance'
import type { Box, Point } from '../../geometry/types'
import type { LayoutMetrics } from '../../metrics/layout-metrics'
import { assertDrawable, measureLayout } from '../../metrics/layout-metrics'
import type { LayoutModel, LinkEnd } from '../../model'
import { endNode, linkEndKey } from '../../model'
import type { LayoutSettings } from '../../options'
import { createExteriorRouter } from '../../routing/exterior'
import { memberObstacles, routeThroughWaypoints } from '../../routing/interior'
import { requiredHalos } from '../../spacing/halo'
import { separateGroups } from '../../spacing/separation'
import type { LayoutState, Route } from '../../state'
import { attachmentGeometryOf, routeEndpoint } from '../../state'
import { firstItem, itemAt, lastItem, mapValue } from '../../utils/collections'
import type { NodePort } from '../port-distribution'
import type { WireChannelResult, WireSpan } from '../wire-channels'
import type { GroupProblem, WirePathPlan } from './problem'
import { buildGroupProblem, planWirePaths } from './problem'
import type { SpringSolution } from './solver'
import { solveSpringSystem } from './solver'

/**
 * Stage 4 — dependency-driven Y.
 *
 * Replaces "same depth, same row" with independent Y variables for every device and lane, found by a
 * convex spring system per group (see {@link GroupProblem}). X positions, sides and route topology
 * from the previous stages stay. Frames are refitted, whole groups are separated again, and all
 * interior and exterior paths are rebuilt through the moved lanes.
 */

export interface GroupSolve {
  readonly problem: GroupProblem
  readonly solution: SpringSolution
}

/** How far the devices of a former row drifted apart vertically. */
export interface RowSpread {
  readonly group: number
  readonly rank: number
  readonly members: readonly number[]
  readonly meanY: number
  readonly spread: number
}

export interface DependencyYResult extends LayoutState {
  readonly ports: readonly NodePort[]
  readonly lanes: readonly WireSpan[]
  readonly solves: readonly GroupSolve[]
  readonly rowSpreads: readonly RowSpread[]
  readonly metrics: LayoutMetrics
}

export function optimizeDependencyY(
  model: LayoutModel,
  state: WireChannelResult,
  distances: readonly (number | null)[],
  anchor: number,
  settings: LayoutSettings,
): DependencyYResult {
  const pitch = settings.lanePitch
  const lanes = state.spans.filter((span) => span.routing === 'lane')
  const plans = planWirePaths(model, state, lanes)
  const context = {
    model,
    state,
    lanes,
    plans,
    halos: requiredHalos(
      model,
      state.nodes,
      state.frames,
      attachmentGeometryOf(state.routes, state.terminals),
      settings,
    ),
    distances,
    anchor,
    settings,
  }
  const solves = model.groups.map((_, group): GroupSolve => {
    const problem = buildGroupProblem(context, group)
    const solution = solveSpringSystem(problem.initial, problem.springs, problem.constraints, {
      maxIterations: settings.solverMaxIterations,
      tolerance: settings.solverTolerance,
    })
    return { problem, solution }
  })

  const { solvedNodes, solvedLanes } = applySolutions(model, state, lanes, solves, anchor)
  const offsetOf = (nodes: readonly Box[], group: number): Point => {
    const member = firstItem(itemAt(model.groups, group).members)
    const now = itemAt(nodes, member)
    const solved = itemAt(solvedNodes, member)
    return { x: now.x - solved.x, y: now.y - solved.y }
  }
  const lanesAt = (nodes: readonly Box[]): WireSpan[] =>
    solvedLanes.map((lane) => {
      const offset = offsetOf(nodes, lane.group)
      return {
        ...lane,
        left: lane.left + offset.x,
        right: lane.right + offset.x,
        y: lane.y + offset.y,
      }
    })
  const terminalsAt = (frames: readonly Box[]) =>
    state.terminals.map((terminal) => {
      const before = itemAt(state.frames, terminal.group)
      const after = itemAt(frames, terminal.group)
      return {
        ...terminal,
        x: after.x + ((terminal.x - before.x) * after.w) / before.w,
        y: after.y + ((terminal.y - before.y) * after.h) / before.h,
      }
    })
  /** A port keeps its offset from its node while the node moves. */
  const endpointAt = (nodes: readonly Box[], link: number, end: LinkEnd): Point => {
    const point = routeEndpoint(itemAt(state.routes, link), end)
    const node = endNode(itemAt(model.links, link), end)
    return {
      x: point.x + itemAt(nodes, node).x - itemAt(state.nodes, node).x,
      y: point.y + itemAt(nodes, node).y - itemAt(state.nodes, node).y,
    }
  }

  const separated = separateGroups({
    model,
    nodes: solvedNodes,
    anchor,
    settings,
    fitFrames: (nodes) => {
      const placedLanes = lanesAt(nodes)
      return model.groups.map((group, index) =>
        fitFrameAround(
          [
            ...group.members.map((member) => boundsOf(itemAt(nodes, member))),
            ...placedLanes
              .filter((lane) => lane.group === index)
              .map((lane) => ({
                left: lane.left - pitch / 2,
                right: lane.right + pitch / 2,
                top: lane.y - pitch / 2,
                bottom: lane.y + pitch / 2,
              })),
          ],
          group.padding,
        ),
      )
    },
    attachmentsFor: (nodes, frames) => ({
      terminals: terminalsAt(frames),
      endpoints: model.links.map((_, index) => ({
        source: endpointAt(nodes, index, 'source'),
        target: endpointAt(nodes, index, 'target'),
      })),
    }),
  })

  const { nodes, frames } = separated
  const terminals = terminalsAt(frames)
  const terminalOf = new Map(terminals.map((t) => [linkEndKey(t.link, t.end), t]))
  const finalLanes = lanesAt(nodes)
  const laneById = new Map(finalLanes.map((lane) => [lane.id, lane]))
  const routeExterior = createExteriorRouter(frames, terminals)

  const routePlan = (plan: WirePathPlan): Point[] => {
    const link = itemAt(model.links, plan.link)
    const waypoints: Point[] = [endpointAt(nodes, plan.link, plan.startEnd)]
    for (const visit of plan.visits) {
      const lane = mapValue(laneById, visit.lane)
      waypoints.push(
        { x: visit.forward ? lane.left : lane.right, y: lane.y },
        { x: visit.forward ? lane.right : lane.left, y: lane.y },
      )
    }
    waypoints.push(
      plan.finish.kind === 'terminal'
        ? toPoint(mapValue(terminalOf, linkEndKey(plan.link, plan.startEnd)))
        : endpointAt(nodes, plan.link, 'target'),
    )
    return routeThroughWaypoints(
      waypoints,
      memberObstacles(
        nodes,
        itemAt(model.groups, plan.group).members,
        new Set([link.source, link.target]),
        settings.clearance,
      ),
      itemAt(frames, plan.group),
      GEOMETRY_EPSILON,
    )
  }
  const interiorPaths = new Map(
    plans.map((plan) => [linkEndKey(plan.link, plan.startEnd), routePlan(plan)]),
  )
  const routes = model.links.map((link, index): Route => {
    const source = mapValue(interiorPaths, linkEndKey(index, 'source'))
    if (!link.crossGroup) return { kind: 'internal', points: source }
    const target = [...mapValue(interiorPaths, linkEndKey(index, 'target'))].reverse()
    return {
      kind: 'cross-group',
      points: [...source, ...routeExterior(index).slice(1), ...target.slice(1)],
      exit: lastItem(source),
      entry: firstItem(target),
    }
  })

  const metrics = measureLayout(model, { nodes, frames, routes, terminals }, settings)
  assertDrawable(metrics, 'Dependency Y optimization')
  const rowSpreads = rowSpreadsOf(state, nodes)
  return {
    nodes,
    frames,
    terminals,
    routes,
    rows: state.rows.map((groupRows, group) =>
      groupRows.map((row, rank) => ({
        ...row,
        y: itemAt(
          rowSpreads.filter((spread) => spread.group === group),
          rank,
        ).meanY,
      })),
    ),
    ports: state.ports.map((port) => ({
      ...port,
      ...routeEndpoint(itemAt(routes, port.link), port.end),
    })),
    lanes: finalLanes,
    solves,
    rowSpreads,
    metrics,
  }
}

/** Writes solved Y back, then shifts the anchor's group so the anchor sits exactly where it was. */
function applySolutions(
  model: LayoutModel,
  state: LayoutState,
  lanes: readonly WireSpan[],
  solves: readonly GroupSolve[],
  anchor: number,
): { readonly solvedNodes: Box[]; readonly solvedLanes: WireSpan[] } {
  const nodeY = new Map<number, number>()
  const laneY = new Map<string, number>()
  for (const [group, { problem, solution }] of solves.entries()) {
    const frameY = itemAt(state.frames, group).y
    for (const [node, variable] of problem.nodeVariables)
      nodeY.set(node, frameY + itemAt(solution.values, variable))
    for (const [lane, variable] of problem.laneVariables)
      laneY.set(lane, frameY + itemAt(solution.values, variable))
  }
  const anchorGroup = itemAt(model.nodes, anchor).group
  const correction = itemAt(state.nodes, anchor).y - mapValue(nodeY, anchor)
  const corrected = (y: number, group: number) => (group === anchorGroup ? y + correction : y)
  return {
    solvedNodes: state.nodes.map((node, index) => ({
      ...node,
      y: corrected(mapValue(nodeY, index), itemAt(model.nodes, index).group),
    })),
    solvedLanes: lanes.map((lane) => ({
      ...lane,
      y: corrected(mapValue(laneY, lane.id), lane.group),
    })),
  }
}

function rowSpreadsOf(state: LayoutState, nodes: readonly Box[]): RowSpread[] {
  return state.rows.flatMap((groupRows, group) =>
    groupRows.map((row) => {
      const ys = row.members.map((member) => itemAt(nodes, member).y)
      return {
        group,
        rank: row.rank,
        members: row.members,
        meanY: ys.reduce((total, y) => total + y, 0) / ys.length,
        spread: Math.max(...ys) - Math.min(...ys),
      }
    }),
  )
}
