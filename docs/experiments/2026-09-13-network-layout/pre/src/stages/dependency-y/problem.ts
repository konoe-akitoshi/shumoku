import { horizontalExtentOf, horizontalOverlap } from '../../geometry/box'
import { GEOMETRY_EPSILON } from '../../geometry/tolerance'
import type { HorizontalExtent, Point } from '../../geometry/types'
import type { LayoutModel, LinkEnd } from '../../model'
import { linkEndKey } from '../../model'
import type { LayoutSettings } from '../../options'
import type { BoundaryTerminal } from '../../routing/boundary-terminals'
import type { HaloSet } from '../../spacing/halo'
import type { LayoutState } from '../../state'
import { interiorParts } from '../../state'
import { firstItem, itemAt, lastItem, mapValue, range } from '../../utils/collections'
import type { WireSpan } from '../wire-channels'
import type { DifferenceConstraint, Spring, SpringKind } from './solver'
import { GROUND } from './solver'

export interface LaneVisit {
  readonly lane: string
  /** True when the path runs along the lane from left to right. */
  readonly forward: boolean
}

/**
 * One in-group part of a link, oriented away from its node: a whole internal link, or one side of a
 * cross-group link up to its boundary terminal.
 */
export interface WirePathPlan {
  readonly link: number
  readonly group: number
  readonly startEnd: LinkEnd
  readonly startNode: number
  readonly finish:
    | { readonly kind: 'node'; readonly node: number }
    | { readonly kind: 'terminal'; readonly terminal: BoundaryTerminal }
  /** Lanes the part runs along, in path order. */
  readonly visits: readonly LaneVisit[]
}

/** A link whose endpoints lie at different upstream distances: the nearer node is the parent. */
export interface Dependency {
  readonly parent: number
  readonly child: number
  /** Preferred vertical distance: both half heights, both facing halo bands and one lane pitch. */
  readonly distance: number
}

/**
 * The vertical layout of one group as a spring system. Variables are the Y of every member device and
 * every lane, relative to the frame center. There is no row target, no pull toward the current Y and
 * no term aligning siblings; similar Y values emerge only from similar dependencies.
 */
export interface GroupProblem {
  readonly group: number
  readonly nodeVariables: ReadonlyMap<number, number>
  readonly laneVariables: ReadonlyMap<string, number>
  readonly initial: readonly number[]
  readonly springs: readonly Spring[]
  readonly constraints: readonly DifferenceConstraint[]
  readonly dependencies: readonly Dependency[]
}

export interface ProblemContext {
  readonly model: LayoutModel
  readonly state: LayoutState
  /** Lane-routed wire spans only. */
  readonly lanes: readonly WireSpan[]
  readonly plans: readonly WirePathPlan[]
  readonly halos: HaloSet
  readonly distances: readonly (number | null)[]
  readonly anchor: number
  readonly settings: LayoutSettings
}

export function planWirePaths(
  model: LayoutModel,
  state: Pick<LayoutState, 'routes' | 'terminals'>,
  lanes: readonly WireSpan[],
): WirePathPlan[] {
  const terminalOf = new Map(state.terminals.map((t) => [linkEndKey(t.link, t.end), t]))
  return model.links.flatMap((link, linkIndex): WirePathPlan[] => {
    const route = itemAt(state.routes, linkIndex)
    const lanesIn = (group: number) =>
      lanes.filter((lane) => lane.link === linkIndex && lane.group === group)
    if (route.kind === 'internal')
      return [
        {
          link: linkIndex,
          group: link.sourceGroup,
          startEnd: 'source',
          startNode: link.source,
          finish: { kind: 'node', node: link.target },
          visits: lanesVisited(route.points, lanesIn(link.sourceGroup)),
        },
      ]
    const parts = interiorParts(route)
    return [
      {
        link: linkIndex,
        group: link.sourceGroup,
        startEnd: 'source',
        startNode: link.source,
        finish: {
          kind: 'terminal',
          terminal: mapValue(terminalOf, linkEndKey(linkIndex, 'source')),
        },
        visits: lanesVisited(parts.source, lanesIn(link.sourceGroup)),
      },
      {
        link: linkIndex,
        group: link.targetGroup,
        startEnd: 'target',
        startNode: link.target,
        finish: {
          kind: 'terminal',
          terminal: mapValue(terminalOf, linkEndKey(linkIndex, 'target')),
        },
        visits: lanesVisited([...parts.target].reverse(), lanesIn(link.targetGroup)),
      },
    ]
  })
}

function lanesVisited(points: readonly Point[], lanes: readonly WireSpan[]): LaneVisit[] {
  return lanes
    .flatMap((lane) => {
      const index = points.findIndex((point, pointIndex) => {
        if (pointIndex === 0) return false
        const previous = itemAt(points, pointIndex - 1)
        return (
          Math.abs(point.y - lane.y) < GEOMETRY_EPSILON &&
          Math.abs(previous.y - lane.y) < GEOMETRY_EPSILON &&
          Math.min(point.x, previous.x) <= lane.left + GEOMETRY_EPSILON &&
          Math.max(point.x, previous.x) >= lane.right - GEOMETRY_EPSILON
        )
      })
      if (index < 0) return []
      const forward = itemAt(points, index).x > itemAt(points, index - 1).x
      return [{ lane: lane.id, index, forward }]
    })
    .sort((a, b) => a.index - b.index)
    .map(({ lane, forward }) => ({ lane, forward }))
}

export function buildGroupProblem(context: ProblemContext, group: number): GroupProblem {
  const { model, state, settings } = context
  const frame = itemAt(state.frames, group)
  const members = itemAt(model.groups, group).members
  const lanes = context.lanes.filter((lane) => lane.group === group)
  const nodeVariables = new Map(members.map((member, index) => [member, index]))
  const laneVariables = new Map(lanes.map((lane, index) => [lane.id, members.length + index]))
  const initial = [
    ...members.map((member) => itemAt(state.nodes, member).y - frame.y),
    ...lanes.map((lane) => lane.y - frame.y),
  ]
  const { springs: dependencySprings, dependencies } = dependencySpringsOf(
    context,
    group,
    nodeVariables,
  )
  const springs = [
    ...dependencySprings,
    ...wireSpringsOf(context, group, nodeVariables, laneVariables),
  ]
  const clearances = [
    ...nodeBandConstraints(context, members, nodeVariables),
    ...laneNodeConstraints(context, lanes, members, nodeVariables, laneVariables),
    ...laneLaneConstraints(lanes, laneVariables, settings.lanePitch),
  ]
  const anchorVariable = nodeVariables.get(context.anchor)
  const anchorConstraints: DifferenceConstraint[] =
    anchorVariable === undefined
      ? []
      : [
          {
            from: GROUND,
            to: anchorVariable,
            min: itemAt(initial, anchorVariable),
            max: itemAt(initial, anchorVariable),
            kind: 'anchor',
          },
        ]
  const constraints = [...clearances, ...anchorConstraints]
  return {
    group,
    nodeVariables,
    laneVariables,
    initial,
    springs,
    constraints: [...constraints, ...translationGauges(initial, [...springs, ...constraints])],
    dependencies,
  }
}

function spring(from: number, to: number, target: number, scale: number, kind: SpringKind): Spring {
  return { from, to, target, weight: 1 / scale ** 2, kind }
}

/** Each internal link between different upstream distances prefers the child one step below. */
function dependencySpringsOf(
  context: ProblemContext,
  group: number,
  nodeVariables: ReadonlyMap<number, number>,
): { readonly springs: Spring[]; readonly dependencies: Dependency[] } {
  const { model, state, halos, settings } = context
  const springs: Spring[] = []
  const dependencies: Dependency[] = []
  for (const link of model.links) {
    if (link.sourceGroup !== group || link.targetGroup !== group) continue
    const sourceDistance = itemAt(context.distances, link.source)
    const targetDistance = itemAt(context.distances, link.target)
    // Without upstream distances there is no up or down; wire springs and clearances still apply.
    if (sourceDistance === null || targetDistance === null || sourceDistance === targetDistance)
      continue
    const parent = sourceDistance < targetDistance ? link.source : link.target
    const child = parent === link.source ? link.target : link.source
    const distance =
      itemAt(state.nodes, parent).h / 2 +
      itemAt(state.nodes, child).h / 2 +
      settings.nodeStrokeWidth +
      itemAt(halos.nodes, parent).sides.bottom +
      itemAt(halos.nodes, child).sides.top +
      settings.lanePitch
    springs.push(
      spring(
        mapValue(nodeVariables, parent),
        mapValue(nodeVariables, child),
        distance,
        distance,
        'dependency',
      ),
    )
    dependencies.push({ parent, child, distance })
  }
  return { springs, dependencies }
}

interface WireSymbol {
  readonly variable: number
  readonly x: number
  /** Y of the path point relative to its variable. */
  readonly offset: number
}

/**
 * Consecutive points of a wire path (port, lane ends, terminal) prefer equal Y. Softer over long
 * horizontal runs, so a wire may slope across a wide gap rather than drag its endpoints together.
 */
function wireSpringsOf(
  context: ProblemContext,
  group: number,
  nodeVariables: ReadonlyMap<number, number>,
  laneVariables: ReadonlyMap<string, number>,
): Spring[] {
  const { model, state, settings } = context
  const frame = itemAt(state.frames, group)
  const laneById = new Map(context.lanes.map((lane) => [lane.id, lane]))
  const springs: Spring[] = []
  for (const plan of context.plans) {
    if (plan.group !== group) continue
    const link = itemAt(model.links, plan.link)
    const route = itemAt(state.routes, plan.link)
    const portSymbol = (node: number): WireSymbol => {
      const point = node === link.source ? firstItem(route.points) : lastItem(route.points)
      return {
        variable: mapValue(nodeVariables, node),
        x: point.x,
        offset: point.y - itemAt(state.nodes, node).y,
      }
    }
    const symbols: WireSymbol[] = [portSymbol(plan.startNode)]
    for (const visit of plan.visits) {
      const lane = mapValue(laneById, visit.lane)
      const variable = mapValue(laneVariables, lane.id)
      symbols.push(
        { variable, x: visit.forward ? lane.left : lane.right, offset: 0 },
        { variable, x: visit.forward ? lane.right : lane.left, offset: 0 },
      )
    }
    symbols.push(
      plan.finish.kind === 'node'
        ? portSymbol(plan.finish.node)
        : {
            variable: GROUND,
            x: plan.finish.terminal.x,
            offset: plan.finish.terminal.y - frame.y,
          },
    )
    const startHeight = itemAt(state.nodes, plan.startNode).h
    for (const [index, symbol] of symbols.entries()) {
      if (index === 0) continue
      const previous = itemAt(symbols, index - 1)
      if (previous.variable === symbol.variable) continue
      const scale = Math.hypot(symbol.x - previous.x, startHeight + settings.lanePitch)
      springs.push(
        spring(previous.variable, symbol.variable, previous.offset - symbol.offset, scale, 'wire'),
      )
    }
  }
  return springs
}

/** Devices whose halos share X keep their vertical order with both halo bands between them. */
function nodeBandConstraints(
  context: ProblemContext,
  members: readonly number[],
  nodeVariables: ReadonlyMap<number, number>,
): DifferenceConstraint[] {
  const { state, halos, settings } = context
  const constraints: DifferenceConstraint[] = []
  for (const [index, a] of members.entries())
    for (const b of members.slice(index + 1)) {
      const overlap = horizontalOverlap(
        horizontalExtentOf(itemAt(halos.nodes, a).box),
        horizontalExtentOf(itemAt(halos.nodes, b).box),
      )
      if (overlap <= GEOMETRY_EPSILON) continue
      const upper = itemAt(state.nodes, a).y < itemAt(state.nodes, b).y ? a : b
      const lower = upper === a ? b : a
      constraints.push({
        from: mapValue(nodeVariables, upper),
        to: mapValue(nodeVariables, lower),
        min:
          itemAt(state.nodes, upper).h / 2 +
          itemAt(state.nodes, lower).h / 2 +
          settings.nodeStrokeWidth +
          itemAt(halos.nodes, upper).sides.bottom +
          itemAt(halos.nodes, lower).sides.top,
        kind: 'node-band',
      })
    }
  return constraints
}

/** A lane stays clear of every device below or above it that shares its X range. */
function laneNodeConstraints(
  context: ProblemContext,
  lanes: readonly WireSpan[],
  members: readonly number[],
  nodeVariables: ReadonlyMap<number, number>,
  laneVariables: ReadonlyMap<string, number>,
): DifferenceConstraint[] {
  const { state, settings } = context
  const pitch = settings.lanePitch
  const constraints: DifferenceConstraint[] = []
  for (const lane of lanes) {
    const laneVariable = mapValue(laneVariables, lane.id)
    const extent = paddedLaneExtent(lane, pitch)
    for (const member of members) {
      const node = itemAt(state.nodes, member)
      if (horizontalOverlap(extent, horizontalExtentOf(node)) <= GEOMETRY_EPSILON) continue
      const nodeVariable = mapValue(nodeVariables, member)
      const laneAbove = lane.y < node.y
      constraints.push({
        from: laneAbove ? laneVariable : nodeVariable,
        to: laneAbove ? nodeVariable : laneVariable,
        min: node.h / 2 + pitch / 2,
        kind: 'lane-node',
      })
    }
  }
  return constraints
}

/** Lanes sharing X keep their order, one pitch apart. */
function laneLaneConstraints(
  lanes: readonly WireSpan[],
  laneVariables: ReadonlyMap<string, number>,
  pitch: number,
): DifferenceConstraint[] {
  const constraints: DifferenceConstraint[] = []
  for (const [index, a] of lanes.entries())
    for (const b of lanes.slice(index + 1)) {
      const overlap = horizontalOverlap(paddedLaneExtent(a, pitch), paddedLaneExtent(b, pitch))
      if (overlap <= GEOMETRY_EPSILON) continue
      const [upper, lower] = a.y < b.y ? [a, b] : [b, a]
      constraints.push({
        from: mapValue(laneVariables, upper.id),
        to: mapValue(laneVariables, lower.id),
        min: pitch,
        kind: 'lane-lane',
      })
    }
  return constraints
}

function paddedLaneExtent(lane: WireSpan, pitch: number): HorizontalExtent {
  return { left: lane.left - pitch / 2, right: lane.right + pitch / 2 }
}

/**
 * A set of variables linked to each other but to nothing grounded may translate freely. Fixing its
 * lowest variable at the current value removes only that translation, not any shape preference.
 */
function translationGauges(
  initial: readonly number[],
  terms: readonly Pick<Spring, 'from' | 'to'>[],
): DifferenceConstraint[] {
  const neighbors = initial.map(() => new Set<number>())
  const grounded = new Set<number>()
  for (const { from, to } of terms) {
    if (from === GROUND) grounded.add(to)
    else if (to === GROUND) grounded.add(from)
    else {
      itemAt(neighbors, from).add(to)
      itemAt(neighbors, to).add(from)
    }
  }
  const visited = new Set<number>()
  const gauges: DifferenceConstraint[] = []
  for (const start of range(initial.length)) {
    if (visited.has(start)) continue
    visited.add(start)
    const component = [start]
    for (const variable of component)
      for (const peer of itemAt(neighbors, variable))
        if (!visited.has(peer)) {
          visited.add(peer)
          component.push(peer)
        }
    if (!component.some((variable) => grounded.has(variable)))
      gauges.push({
        from: GROUND,
        to: start,
        min: itemAt(initial, start),
        max: itemAt(initial, start),
        kind: 'translation-gauge',
      })
  }
  return gauges
}
