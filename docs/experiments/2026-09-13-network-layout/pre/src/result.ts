import { toPoint } from './geometry/point'
import type { Box, Point, Side } from './geometry/types'
import type { LayoutMetrics } from './metrics/layout-metrics'
import type { LayoutSeed, LinkEnd } from './model'
import type { LayoutOptions } from './options'
import type { LayoutStages } from './pipeline'
import { runLayoutStages } from './pipeline'
import type { UpstreamAnalysis } from './upstream'
import { itemAt, mapValue } from './utils/collections'

export interface PlacedNode extends Box {
  readonly id: string
  readonly groupId: string
  /** Row of the node inside its group before dependency optimization, from the top. */
  readonly rowRank: number
  readonly upstreamDistance: number | null
}

export interface PlacedGroup extends Box {
  readonly id: string
  readonly nodeIds: readonly string[]
}

export interface PlacedLink {
  readonly id: string
  readonly source: string
  readonly target: string
  readonly points: readonly Point[]
  /** Frame crossings of a cross-group link; `null` for links inside one group. */
  readonly boundary: { readonly exit: Point; readonly entry: Point } | null
  readonly laneIds: readonly string[]
}

export interface PlacedPort extends Point {
  readonly linkId: string
  readonly end: LinkEnd
  readonly nodeId: string
  readonly side: Side
  readonly rank: number
  readonly count: number
}

export interface PlacedTerminal extends Point {
  readonly linkId: string
  readonly end: LinkEnd
  readonly groupId: string
  readonly nodeId: string
  readonly side: Side
}

export interface PlacedLane {
  readonly id: string
  readonly linkId: string
  readonly groupId: string
  readonly left: number
  readonly right: number
  readonly y: number
}

export interface GroupSolveSummary {
  readonly groupId: string
  readonly variables: number
  readonly springs: number
  readonly constraints: number
  readonly iterations: number
  readonly residual: number
  readonly energyBefore: number
  readonly energyAfter: number
  readonly dependencies: readonly {
    readonly parentId: string
    readonly childId: string
    readonly distance: number
  }[]
}

export interface LayoutDiagnostics {
  readonly metrics: LayoutMetrics
  readonly portRepairs: number
  readonly groupSolves: readonly GroupSolveSummary[]
  readonly rowSpreads: readonly {
    readonly groupId: string
    readonly rank: number
    readonly nodeIds: readonly string[]
    readonly meanY: number
    readonly spread: number
  }[]
}

export interface NetworkLayout {
  readonly nodes: readonly PlacedNode[]
  readonly groups: readonly PlacedGroup[]
  readonly links: readonly PlacedLink[]
  readonly ports: readonly PlacedPort[]
  readonly terminals: readonly PlacedTerminal[]
  readonly lanes: readonly PlacedLane[]
  readonly upstream: UpstreamAnalysis
  /** Id of the node whose absolute position was preserved. */
  readonly translationGaugeId: string
  readonly diagnostics: LayoutDiagnostics
}

export function layoutNetwork(
  seed: LayoutSeed,
  options: Partial<LayoutOptions> = {},
): NetworkLayout {
  return presentLayout(runLayoutStages(seed, options))
}

/** Converts index-based stage output into an id-based result. */
export function presentLayout(stages: LayoutStages): NetworkLayout {
  const { model, dependencyY: final } = stages
  const nodeId = (index: number) => itemAt(model.nodes, index).id
  const groupId = (index: number) => itemAt(model.groups, index).id
  const linkId = (index: number) => itemAt(model.links, index).id
  const rankOf = new Map(
    stages.rowPacking.rows.flatMap((groupRows) =>
      groupRows.flatMap((row) => row.members.map((member) => [member, row.rank] as const)),
    ),
  )

  return {
    nodes: final.nodes.map((box, index) => ({
      id: nodeId(index),
      groupId: groupId(itemAt(model.nodes, index).group),
      x: box.x,
      y: box.y,
      w: box.w,
      h: box.h,
      rowRank: mapValue(rankOf, index),
      upstreamDistance: itemAt(stages.distances, index),
    })),
    groups: final.frames.map((frame, index) => ({
      id: groupId(index),
      nodeIds: itemAt(model.groups, index).members.map(nodeId),
      x: frame.x,
      y: frame.y,
      w: frame.w,
      h: frame.h,
    })),
    links: final.routes.map((route, index) => {
      const link = itemAt(model.links, index)
      return {
        id: link.id,
        source: nodeId(link.source),
        target: nodeId(link.target),
        points: route.points.map(toPoint),
        boundary:
          route.kind === 'cross-group'
            ? { exit: toPoint(route.exit), entry: toPoint(route.entry) }
            : null,
        laneIds: final.lanes.filter((lane) => lane.link === index).map((lane) => lane.id),
      }
    }),
    ports: final.ports.map((port) => ({
      linkId: linkId(port.link),
      end: port.end,
      nodeId: nodeId(port.node),
      side: port.side,
      rank: port.rank,
      count: port.count,
      x: port.x,
      y: port.y,
    })),
    terminals: final.terminals.map((terminal) => ({
      linkId: linkId(terminal.link),
      end: terminal.end,
      groupId: groupId(terminal.group),
      nodeId: nodeId(terminal.node),
      side: terminal.side,
      x: terminal.x,
      y: terminal.y,
    })),
    lanes: final.lanes.map((lane) => ({
      id: lane.id,
      linkId: linkId(lane.link),
      groupId: groupId(lane.group),
      left: lane.left,
      right: lane.right,
      y: lane.y,
    })),
    upstream: stages.upstream,
    translationGaugeId: nodeId(stages.anchor),
    diagnostics: {
      metrics: final.metrics,
      portRepairs: stages.portDistribution.portRepairs,
      groupSolves: final.solves.map(({ problem, solution }) => ({
        groupId: groupId(problem.group),
        variables: problem.initial.length,
        springs: problem.springs.length,
        constraints: problem.constraints.length,
        iterations: solution.iterations,
        residual: solution.residual,
        energyBefore: solution.energyBefore,
        energyAfter: solution.energyAfter,
        dependencies: problem.dependencies.map((dependency) => ({
          parentId: nodeId(dependency.parent),
          childId: nodeId(dependency.child),
          distance: dependency.distance,
        })),
      })),
      rowSpreads: final.rowSpreads.map((spread) => ({
        groupId: groupId(spread.group),
        rank: spread.rank,
        nodeIds: spread.members.map(nodeId),
        meanY: spread.meanY,
        spread: spread.spread,
      })),
    },
  }
}
