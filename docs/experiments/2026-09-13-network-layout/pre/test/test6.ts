import type { Insets, Point } from '../src/geometry/types'
import type { LayoutSeed } from '../src/model'
import { itemAt, mapValue } from '../src/utils/collections'

/**
 * Adapter from the archived experiment reports to a {@link LayoutSeed}.
 *
 * The accepted checkpoint (dependency-y with upstream detection) was produced by the chain
 * hard-halo → virtual-rows (area 15%) → distributed-ports → dependency-y. Its only inputs beyond the
 * topology are the coarse placement of `hard-halo` and the row order and frame padding of
 * `side-centers`, so those two reports fully define the seed.
 */

const ARCHIVE = new URL('../../archive/', import.meta.url)

export interface ReportNode {
  readonly id: string
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
}

export interface ReportGroup extends ReportNode {
  readonly members: readonly number[]
}

export interface ReportLink {
  readonly id: string
  readonly a: number
  readonly b: number
  readonly points: readonly Point[]
  readonly exit?: Point
  readonly entry?: Point
}

export interface PlacementReport {
  readonly nodes: readonly ReportNode[]
  readonly groups: readonly ReportGroup[]
  readonly links: readonly ReportLink[]
}

export interface CheckpointReport extends PlacementReport {
  readonly terminals: readonly {
    readonly li: number
    readonly g: number
    readonly end: 'a' | 'b'
    readonly side: string
    readonly x: number
    readonly y: number
  }[]
  readonly nodePorts: readonly {
    readonly li: number
    readonly end: 'a' | 'b'
    readonly node: number
    readonly side: string
    readonly rank: number
    readonly count: number
    readonly x: number
    readonly y: number
  }[]
  readonly virtualNodes: readonly {
    readonly li: number
    readonly gi: number
    readonly left: number
    readonly right: number
    readonly y: number
  }[]
  readonly upstream: { readonly roots: readonly string[] }
  readonly dependencyOptimization: {
    readonly groups: readonly {
      readonly dependencies: readonly {
        readonly parent: number
        readonly child: number
        readonly distance: number
      }[]
    }[]
  }
  readonly avoidance: {
    readonly after: {
      readonly crossings: number
      readonly overlapLength: number
      readonly length: number
      readonly hits: number
      readonly nearPairs: number
      readonly nodeHaloPairs: number
      readonly groupHaloPairs: number
      readonly nodeMinVisibleGap: number
      readonly groupMinVisibleGap: number
    }
  }
}

export const LINK_END_OF = { a: 'source', b: 'target' } as const

export async function readArchiveReport<T>(name: string): Promise<T> {
  return (await Bun.file(new URL(`tmp-test6-v8-${name}-report.json`, ARCHIVE)).json()) as T
}

export async function loadTest6Seed(): Promise<LayoutSeed> {
  const [placement, display] = await Promise.all([
    readArchiveReport<PlacementReport>('hard-halo'),
    readArchiveReport<PlacementReport>('side-centers'),
  ])
  const groupOf = new Map(
    placement.groups.flatMap((group, index) => group.members.map((member) => [member, index])),
  )
  return {
    nodes: placement.nodes.map((node, index) => {
      const shown = itemAt(display.nodes, index)
      const shownGroup = itemAt(display.groups, mapValue(groupOf, index))
      return {
        id: node.id,
        width: node.w,
        height: node.h,
        position: { x: node.x, y: node.y },
        preferredOffsetX: shown.x - shownGroup.x,
      }
    }),
    groups: placement.groups.map((group, index) => ({
      id: group.id,
      nodeIds: group.members.map((member) => itemAt(placement.nodes, member).id),
      frame: { x: group.x, y: group.y, w: group.w, h: group.h },
      padding: measuredPadding(display, index),
    })),
    links: placement.links.map((link) => ({
      id: link.id,
      source: itemAt(placement.nodes, link.a).id,
      target: itemAt(placement.nodes, link.b).id,
    })),
  }
}

/** Frame chrome as drawn in the display report: frame edge minus content bounds. */
function measuredPadding(report: PlacementReport, groupIndex: number): Insets {
  const group = itemAt(report.groups, groupIndex)
  const members = group.members.map((member) => itemAt(report.nodes, member))
  const left = Math.min(...members.map((node) => node.x - node.w / 2))
  const right = Math.max(...members.map((node) => node.x + node.w / 2))
  const top = Math.min(...members.map((node) => node.y - node.h / 2))
  const bottom = Math.max(...members.map((node) => node.y + node.h / 2))
  return {
    left: left - (group.x - group.w / 2),
    right: group.x + group.w / 2 - right,
    top: top - (group.y - group.h / 2),
    bottom: group.y + group.h / 2 - bottom,
  }
}

/** Largest absolute numeric deviation between two JSON-like values, with the path where it occurs. */
export function largestDeviation(
  actual: unknown,
  expected: unknown,
  path = '$',
): { readonly deviation: number; readonly path: string } {
  if (typeof expected === 'number') {
    if (typeof actual !== 'number') return { deviation: Number.POSITIVE_INFINITY, path }
    const deviation = Math.abs(actual - expected)
    return { deviation: Number.isNaN(deviation) ? Number.POSITIVE_INFINITY : deviation, path }
  }
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual) || actual.length !== expected.length)
      return { deviation: Number.POSITIVE_INFINITY, path: `${path}.length` }
    return expected.reduce<{ deviation: number; path: string }>(
      (worst, item, index) => {
        const next = largestDeviation(actual[index], item, `${path}[${index}]`)
        return next.deviation > worst.deviation ? next : worst
      },
      { deviation: 0, path },
    )
  }
  if (expected !== null && typeof expected === 'object') {
    if (actual === null || typeof actual !== 'object')
      return { deviation: Number.POSITIVE_INFINITY, path }
    return Object.entries(expected).reduce<{ deviation: number; path: string }>(
      (worst, [key, value]) => {
        const next = largestDeviation(
          (actual as Record<string, unknown>)[key],
          value,
          `${path}.${key}`,
        )
        return next.deviation > worst.deviation ? next : worst
      },
      { deviation: 0, path },
    )
  }
  return { deviation: actual === expected ? 0 : Number.POSITIVE_INFINITY, path }
}
