import { LayoutError } from './errors'
import type { Box, Insets, Point } from './geometry/types'
import { SIDES } from './geometry/types'
import { itemAt } from './utils/collections'

export type LinkEnd = 'source' | 'target'
export const LINK_ENDS: readonly LinkEnd[] = ['source', 'target']

/** A device as supplied by the caller. All coordinates are drawing units (px). */
export interface SeedNode {
  readonly id: string
  readonly width: number
  readonly height: number
  /** Coarse center from an earlier placement. Anchors the drawing and picks initial frame exits. */
  readonly position: Point
  /** Preferred X relative to the seed frame center of the node's group. Orders nodes in a row. */
  readonly preferredOffsetX: number
}

export interface SeedGroup {
  readonly id: string
  readonly nodeIds: readonly string[]
  /** Coarse frame placement from an earlier macro layout. */
  readonly frame: Box
  /** Space between the frame and its content; the top inset holds the title. */
  readonly padding: Insets
}

/** An undirected connection. Parallel links are kept as separate records. */
export interface SeedLink {
  readonly id: string
  readonly source: string
  readonly target: string
}

export interface LayoutSeed {
  readonly nodes: readonly SeedNode[]
  readonly groups: readonly SeedGroup[]
  readonly links: readonly SeedLink[]
}

export interface ModelNode {
  readonly id: string
  readonly w: number
  readonly h: number
  readonly seedPosition: Point
  readonly preferredOffsetX: number
  readonly group: number
}

export interface ModelGroup {
  readonly id: string
  readonly members: readonly number[]
  readonly seedFrame: Box
  readonly padding: Insets
}

export interface ModelLink {
  readonly id: string
  readonly source: number
  readonly target: number
  readonly sourceGroup: number
  readonly targetGroup: number
  readonly crossGroup: boolean
}

/** A validated seed whose cross references are array indices. */
export interface LayoutModel {
  readonly nodes: readonly ModelNode[]
  readonly groups: readonly ModelGroup[]
  readonly links: readonly ModelLink[]
}

export function createLayoutModel(seed: LayoutSeed): LayoutModel {
  const nodeIndex = indexById(seed.nodes, 'node')
  indexById(seed.groups, 'group')
  indexById(seed.links, 'link')
  const groupOfNode = assignGroups(seed.groups, nodeIndex)

  const nodes = seed.nodes.map((node, index): ModelNode => {
    requirePositive(node.width, `Width of node ${node.id}`)
    requirePositive(node.height, `Height of node ${node.id}`)
    requireFinite(node.position.x, `X of node ${node.id}`)
    requireFinite(node.position.y, `Y of node ${node.id}`)
    requireFinite(node.preferredOffsetX, `Preferred offset of node ${node.id}`)
    const group = groupOfNode.get(index)
    if (group === undefined) throw new LayoutError(`Node ${node.id} belongs to no group`)
    return {
      id: node.id,
      w: node.width,
      h: node.height,
      seedPosition: { x: node.position.x, y: node.position.y },
      preferredOffsetX: node.preferredOffsetX,
      group,
    }
  })

  const groups = seed.groups.map((group): ModelGroup => {
    requireFinite(group.frame.x, `Frame X of group ${group.id}`)
    requireFinite(group.frame.y, `Frame Y of group ${group.id}`)
    requirePositive(group.frame.w, `Frame width of group ${group.id}`)
    requirePositive(group.frame.h, `Frame height of group ${group.id}`)
    for (const side of SIDES) requireFinite(group.padding[side], `Padding of group ${group.id}`)
    return {
      id: group.id,
      members: group.nodeIds.map((id) => lookupNode(nodeIndex, id, `group ${group.id}`)),
      seedFrame: { x: group.frame.x, y: group.frame.y, w: group.frame.w, h: group.frame.h },
      padding: { ...group.padding },
    }
  })

  const links = seed.links.map((link): ModelLink => {
    const source = lookupNode(nodeIndex, link.source, `link ${link.id}`)
    const target = lookupNode(nodeIndex, link.target, `link ${link.id}`)
    if (source === target) throw new LayoutError(`Link ${link.id} is a self-loop`)
    const sourceGroup = itemAt(nodes, source).group
    const targetGroup = itemAt(nodes, target).group
    return {
      id: link.id,
      source,
      target,
      sourceGroup,
      targetGroup,
      crossGroup: sourceGroup !== targetGroup,
    }
  })

  return { nodes, groups, links }
}

export function endNode(link: ModelLink, end: LinkEnd): number {
  return end === 'source' ? link.source : link.target
}

export function endGroup(link: ModelLink, end: LinkEnd): number {
  return end === 'source' ? link.sourceGroup : link.targetGroup
}

export function oppositeEnd(end: LinkEnd): LinkEnd {
  return end === 'source' ? 'target' : 'source'
}

/** Stable key for "this end of this link" lookups. */
export function linkEndKey(link: number, end: LinkEnd): string {
  return `${link}:${end}`
}

function indexById(items: readonly { readonly id: string }[], kind: string): Map<string, number> {
  const index = new Map<string, number>()
  for (const [position, item] of items.entries()) {
    if (index.has(item.id)) throw new LayoutError(`Duplicate ${kind} id ${item.id}`)
    index.set(item.id, position)
  }
  return index
}

function assignGroups(
  groups: readonly SeedGroup[],
  nodeIndex: ReadonlyMap<string, number>,
): Map<number, number> {
  const groupOfNode = new Map<number, number>()
  for (const [groupIndex, group] of groups.entries()) {
    if (group.nodeIds.length === 0) throw new LayoutError(`Group ${group.id} has no nodes`)
    for (const nodeId of group.nodeIds) {
      const node = lookupNode(nodeIndex, nodeId, `group ${group.id}`)
      if (groupOfNode.has(node))
        throw new LayoutError(`Node ${nodeId} belongs to more than one group`)
      groupOfNode.set(node, groupIndex)
    }
  }
  return groupOfNode
}

function lookupNode(nodeIndex: ReadonlyMap<string, number>, id: string, owner: string): number {
  const index = nodeIndex.get(id)
  if (index === undefined) throw new LayoutError(`Unknown node ${id} in ${owner}`)
  return index
}

function requireFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) throw new LayoutError(`${label} must be a finite number`)
}

function requirePositive(value: number, label: string): void {
  if (!Number.isFinite(value) || value <= 0)
    throw new LayoutError(`${label} must be a positive number`)
}
