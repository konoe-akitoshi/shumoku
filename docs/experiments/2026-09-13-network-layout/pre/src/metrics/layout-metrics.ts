import { LayoutError } from '../errors'
import type { Box } from '../geometry/types'
import type { LayoutModel } from '../model'
import type { LayoutSettings } from '../options'
import type { BoundaryTerminal } from '../routing/boundary-terminals'
import { requiredHalos } from '../spacing/halo'
import type { Route } from '../state'
import { attachmentGeometryOf } from '../state'
import { measureHaloSpacing } from './halo-spacing'
import { measureLineAvoidance } from './line-avoidance'
import { measureWires } from './wires'

export interface LayoutMetrics {
  readonly lineHits: number
  readonly lineNearPairs: number
  readonly crossings: number
  readonly overlapLength: number
  readonly length: number
  readonly nodeHaloOverlaps: number
  readonly groupHaloOverlaps: number
  readonly nodeContacts: number
  readonly groupContacts: number
  readonly nodeMinVisibleGap: number | null
  readonly groupMinVisibleGap: number | null
}

export interface DrawnLayout {
  readonly nodes: readonly Box[]
  readonly frames: readonly Box[]
  readonly routes: readonly Route[]
  readonly terminals: readonly BoundaryTerminal[]
}

export function measureLayout(
  model: LayoutModel,
  drawn: DrawnLayout,
  settings: LayoutSettings,
): LayoutMetrics {
  const lines = measureLineAvoidance(model, drawn.nodes, drawn.routes, settings.clearance)
  const wires = measureWires(drawn.routes)
  const halos = requiredHalos(
    model,
    drawn.nodes,
    drawn.frames,
    attachmentGeometryOf(drawn.routes, drawn.terminals),
    settings,
  )
  const nodes = measureHaloSpacing(
    drawn.nodes,
    settings.nodeStrokeWidth,
    halos.nodes,
    settings.haloAreaRatio,
  )
  const groups = measureHaloSpacing(
    drawn.frames,
    settings.frameStrokeWidth,
    halos.groups,
    settings.haloAreaRatio,
  )
  return {
    lineHits: lines.hits,
    lineNearPairs: lines.nearPairs,
    crossings: wires.crossings,
    overlapLength: wires.overlapLength,
    length: wires.length,
    nodeHaloOverlaps: nodes.overlapPairs,
    groupHaloOverlaps: groups.overlapPairs,
    nodeContacts: nodes.contactPairs,
    groupContacts: groups.contactPairs,
    nodeMinVisibleGap: nodes.minVisibleGap,
    groupMinVisibleGap: groups.minVisibleGap,
  }
}

/**
 * A stage result is only accepted when no wire enters or grazes an unrelated device and no required
 * halo overlaps. A worse-looking but valid drawing is never traded for an invalid one.
 */
export function assertDrawable(metrics: LayoutMetrics, stage: string): void {
  const violations = {
    lineHits: metrics.lineHits,
    lineNearPairs: metrics.lineNearPairs,
    nodeHaloOverlaps: metrics.nodeHaloOverlaps,
    groupHaloOverlaps: metrics.groupHaloOverlaps,
  }
  if (Object.values(violations).some((count) => count > 0))
    throw new LayoutError(`${stage} produced an invalid drawing: ${JSON.stringify(violations)}`)
}
