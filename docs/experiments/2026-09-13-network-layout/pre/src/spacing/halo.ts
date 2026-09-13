import { LayoutError } from '../errors'
import { sideOfBoundaryPoint } from '../geometry/box'
import type { Box, PerSide, Point, Side } from '../geometry/types'
import { SIDES } from '../geometry/types'
import type { LayoutModel } from '../model'
import type { LayoutSettings } from '../options'
import { itemAt, range } from '../utils/collections'

/**
 * Halos are the clearance bands around devices and frames.
 *
 * A connection-free box gets a uniform band whose area is `haloAreaRatio` × its painted area. Each
 * attached link raises the target area by the factor `sqrt(1 + connections)`, and only that surplus is
 * spread over the sides in proportion to connections per edge length. Busy sides therefore get more
 * room while quiet sides keep the base band.
 */

export type SideCounts = PerSide<number>

export interface LinkEndpoints {
  readonly source: Point
  readonly target: Point
}

export interface TerminalSide {
  readonly group: number
  readonly side: Side
}

/** Where every link attaches: node endpoints per link, and the frame side of every boundary terminal. */
export interface AttachmentGeometry {
  readonly endpoints: readonly LinkEndpoints[]
  readonly terminals: readonly TerminalSide[]
}

export interface AreaHalo {
  readonly thickness: number
  readonly bandArea: number
  readonly expandedWidth: number
  readonly expandedHeight: number
}

export interface DirectionalHalo {
  readonly sides: PerSide<number>
  /** The painted box grown by the halo on each side. */
  readonly box: Box
  readonly bandArea: number
  readonly baseThickness: number
  readonly effectiveRatio: number
  readonly connectionCount: number
}

export interface HaloSet {
  readonly nodes: readonly DirectionalHalo[]
  readonly groups: readonly DirectionalHalo[]
}

/** Solves (W + 2d)(H + 2d) − WH = ratio · WH for d, stroke included in W and H. */
export function areaHalo(size: Pick<Box, 'w' | 'h'>, strokeWidth: number, ratio: number): AreaHalo {
  const validSize = [size.w, size.h].every((value) => Number.isFinite(value) && value > 0)
  if (!validSize || !Number.isFinite(strokeWidth) || strokeWidth < 0)
    throw new LayoutError('Halo requires a positive size and a non-negative stroke')
  if (!Number.isFinite(ratio) || ratio < 0)
    throw new LayoutError('Halo area ratio must be non-negative')
  const w = size.w + strokeWidth
  const h = size.h + strokeWidth
  const perimeterHalf = w + h
  // Rationalized root avoids cancellation for small ratios.
  const thickness =
    (ratio * w * h) / (Math.sqrt(perimeterHalf * perimeterHalf + 4 * ratio * w * h) + perimeterHalf)
  return {
    thickness,
    bandArea: ratio * w * h,
    expandedWidth: w + 2 * thickness,
    expandedHeight: h + 2 * thickness,
  }
}

export function directionalHalo(
  box: Box,
  strokeWidth: number,
  ratio: number,
  counts: SideCounts,
): DirectionalHalo {
  const base = areaHalo(box, strokeWidth, ratio)
  if (!SIDES.every((side) => Number.isInteger(counts[side]) && counts[side] >= 0))
    throw new LayoutError('Connection counts must be non-negative integers')
  const connectionCount = counts.left + counts.right + counts.top + counts.bottom
  const effectiveRatio = ratio * Math.sqrt(1 + connectionCount)
  const w = box.w + strokeWidth
  const h = box.h + strokeWidth
  const bandArea = effectiveRatio * w * h
  const surplusArea = bandArea - base.bandArea

  const weights: SideCounts = {
    left: counts.left / h,
    right: counts.right / h,
    top: counts.top / w,
    bottom: counts.bottom / w,
  }
  const horizontalWeight = weights.left + weights.right
  const verticalWeight = weights.top + weights.bottom
  // Growing each side by `scale · weight` on top of the base band adds exactly `surplusArea`,
  // corners included: linear · scale + quadratic · scale² = surplusArea.
  const linear = base.expandedHeight * horizontalWeight + base.expandedWidth * verticalWeight
  const quadratic = horizontalWeight * verticalWeight
  const scale =
    surplusArea > 0 && linear > 0
      ? (2 * surplusArea) / (Math.sqrt(linear * linear + 4 * quadratic * surplusArea) + linear)
      : 0
  const sides: PerSide<number> = {
    left: base.thickness + scale * weights.left,
    right: base.thickness + scale * weights.right,
    top: base.thickness + scale * weights.top,
    bottom: base.thickness + scale * weights.bottom,
  }
  return {
    sides,
    box: expandBox(box, strokeWidth, sides),
    bandArea,
    baseThickness: base.thickness,
    effectiveRatio,
    connectionCount,
  }
}

/** Grows a painted box by its stroke and by a band of the given thickness on each side. */
export function expandBox(box: Box, strokeWidth: number, sides: PerSide<number>): Box {
  return {
    x: box.x + (sides.right - sides.left) / 2,
    y: box.y + (sides.bottom - sides.top) / 2,
    w: box.w + strokeWidth + sides.left + sides.right,
    h: box.h + strokeWidth + sides.top + sides.bottom,
  }
}

/** Counts attachments per side: link endpoints on nodes and boundary terminals on frames. */
export function countAttachments(
  model: LayoutModel,
  nodes: readonly Box[],
  groupCount: number,
  geometry: AttachmentGeometry,
): { readonly nodes: SideCounts[]; readonly groups: SideCounts[] } {
  const nodeCounts = nodes.map(emptyCounts)
  const groupCounts = range(groupCount).map(emptyCounts)
  for (const [linkIndex, link] of model.links.entries()) {
    const { source, target } = itemAt(geometry.endpoints, linkIndex)
    itemAt(nodeCounts, link.source)[sideOfBoundaryPoint(itemAt(nodes, link.source), source)] += 1
    itemAt(nodeCounts, link.target)[sideOfBoundaryPoint(itemAt(nodes, link.target), target)] += 1
  }
  for (const terminal of geometry.terminals) itemAt(groupCounts, terminal.group)[terminal.side] += 1
  return { nodes: nodeCounts, groups: groupCounts }
}

/** The halos every node and frame needs for the given attachments. */
export function requiredHalos(
  model: LayoutModel,
  nodes: readonly Box[],
  frames: readonly Box[],
  geometry: AttachmentGeometry,
  settings: LayoutSettings,
): HaloSet {
  const counts = countAttachments(model, nodes, frames.length, geometry)
  return {
    nodes: nodes.map((node, index) =>
      directionalHalo(
        node,
        settings.nodeStrokeWidth,
        settings.haloAreaRatio,
        itemAt(counts.nodes, index),
      ),
    ),
    groups: frames.map((frame, index) =>
      directionalHalo(
        frame,
        settings.frameStrokeWidth,
        settings.haloAreaRatio,
        itemAt(counts.groups, index),
      ),
    ),
  }
}

function emptyCounts(): Record<Side, number> {
  return { left: 0, right: 0, top: 0, bottom: 0 }
}
