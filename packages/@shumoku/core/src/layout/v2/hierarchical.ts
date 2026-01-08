/**
 * Hierarchical Layout Engine v2
 * Mermaid-style layout with subgraph support
 * Prevents overlapping of nodes and subgraphs
 */

import type {
  NetworkGraphV2,
  Node,
  Link,
  Subgraph,
  LayoutResult,
  LayoutNode,
  LayoutLink,
  LayoutSubgraph,
  Position,
  Bounds,
  LayoutDirection,
} from '../../models/v2'

// ============================================
// Layout Options
// ============================================

export interface HierarchicalLayoutOptions {
  direction?: LayoutDirection
  nodeWidth?: number
  nodeHeight?: number
  nodeSpacing?: number
  rankSpacing?: number
  subgraphPadding?: number
  subgraphLabelHeight?: number
  subgraphSpacing?: number
}

const DEFAULT_OPTIONS: Required<HierarchicalLayoutOptions> = {
  direction: 'TB',
  nodeWidth: 180,
  nodeHeight: 60,
  nodeSpacing: 30,
  rankSpacing: 60,
  subgraphPadding: 25,
  subgraphLabelHeight: 28,
  subgraphSpacing: 40,
}

// ============================================
// Internal Types
// ============================================

interface LayoutItem {
  id: string
  type: 'node' | 'subgraph'
  x: number
  y: number
  width: number
  height: number
  rank: number
  subgraphId?: string
}

interface SubgraphInfo {
  id: string
  subgraph: Subgraph
  nodes: string[]
  childSubgraphs: string[]
  parent?: string
  bounds: Bounds
  depth: number
  direction: LayoutDirection
}

// ============================================
// Layout Engine
// ============================================

export class HierarchicalLayoutV2 {
  private options: Required<HierarchicalLayoutOptions>

  constructor(options?: HierarchicalLayoutOptions) {
    this.options = { ...DEFAULT_OPTIONS, ...options }
  }

  layout(graph: NetworkGraphV2): LayoutResult {
    const startTime = performance.now()
    const direction = graph.settings?.direction || this.options.direction

    // Build node info map
    const nodeInfoMap = new Map<string, LayoutItem>()
    for (const node of graph.nodes) {
      const height = this.calculateNodeHeight(node)
      nodeInfoMap.set(node.id, {
        id: node.id,
        type: 'node',
        x: 0,
        y: 0,
        width: this.options.nodeWidth,
        height,
        rank: 0,
        subgraphId: node.parent,
      })
    }

    // Build subgraph info map
    const subgraphInfoMap = new Map<string, SubgraphInfo>()
    if (graph.subgraphs) {
      for (const sg of graph.subgraphs) {
        subgraphInfoMap.set(sg.id, {
          id: sg.id,
          subgraph: sg,
          nodes: sg.nodes || [],
          childSubgraphs: sg.children || [],
          parent: sg.parent,
          bounds: { x: 0, y: 0, width: 0, height: 0 },
          depth: 0,
          direction: sg.direction || direction,
        })
      }

      // Calculate depths
      this.calculateSubgraphDepths(subgraphInfoMap)

      // Collect nodes into their subgraphs
      for (const node of graph.nodes) {
        if (node.parent && subgraphInfoMap.has(node.parent)) {
          const sg = subgraphInfoMap.get(node.parent)!
          if (!sg.nodes.includes(node.id)) {
            sg.nodes.push(node.id)
          }
        }
      }

      // Collect child subgraphs
      for (const sg of subgraphInfoMap.values()) {
        if (sg.parent && subgraphInfoMap.has(sg.parent)) {
          const parent = subgraphInfoMap.get(sg.parent)!
          if (!parent.childSubgraphs.includes(sg.id)) {
            parent.childSubgraphs.push(sg.id)
          }
        }
      }
    }

    // Assign ranks based on link topology
    this.assignRanks(nodeInfoMap, graph.links)

    // Layout from deepest subgraphs up to root
    const sortedSubgraphs = this.getSortedSubgraphsByDepth(subgraphInfoMap)

    for (const sgId of sortedSubgraphs) {
      const sg = subgraphInfoMap.get(sgId)!
      this.layoutSubgraph(sg, nodeInfoMap, subgraphInfoMap)
    }

    // Layout root-level items (nodes and subgraphs without parents)
    this.layoutRootLevel(nodeInfoMap, subgraphInfoMap, direction)

    // Calculate link paths
    const layoutLinks = this.calculateLinkPaths(graph.links, nodeInfoMap, direction)

    // Build result
    const layoutNodes = new Map<string, LayoutNode>()
    for (const node of graph.nodes) {
      const info = nodeInfoMap.get(node.id)!
      layoutNodes.set(node.id, {
        id: node.id,
        position: { x: info.x, y: info.y },
        size: { width: info.width, height: info.height },
        node,
      })
    }

    const layoutSubgraphs = new Map<string, LayoutSubgraph>()
    for (const [id, sg] of subgraphInfoMap) {
      layoutSubgraphs.set(id, {
        id,
        bounds: sg.bounds,
        subgraph: sg.subgraph,
      })
    }

    const bounds = this.calculateTotalBounds(layoutNodes, layoutSubgraphs)

    return {
      nodes: layoutNodes,
      links: layoutLinks,
      subgraphs: layoutSubgraphs,
      bounds,
      metadata: {
        algorithm: 'hierarchical-v2',
        duration: performance.now() - startTime,
      },
    }
  }

  private calculateNodeHeight(node: Node): number {
    const lines = Array.isArray(node.label) ? node.label.length : 1
    const baseHeight = 40
    const lineHeight = 16
    return Math.max(this.options.nodeHeight, baseHeight + (lines - 1) * lineHeight)
  }

  private calculateSubgraphDepths(subgraphMap: Map<string, SubgraphInfo>): void {
    const calculateDepth = (id: string, visited: Set<string>): number => {
      if (visited.has(id)) return 0
      visited.add(id)

      const sg = subgraphMap.get(id)
      if (!sg) return 0

      if (!sg.parent || !subgraphMap.has(sg.parent)) {
        sg.depth = 0
        return 0
      }

      const parentDepth = calculateDepth(sg.parent, visited)
      sg.depth = parentDepth + 1
      return sg.depth
    }

    for (const id of subgraphMap.keys()) {
      calculateDepth(id, new Set())
    }
  }

  private getSortedSubgraphsByDepth(subgraphMap: Map<string, SubgraphInfo>): string[] {
    return Array.from(subgraphMap.keys()).sort((a, b) => {
      const depthA = subgraphMap.get(a)!.depth
      const depthB = subgraphMap.get(b)!.depth
      return depthB - depthA // Deepest first
    })
  }

  private assignRanks(nodeMap: Map<string, LayoutItem>, links: Link[]): void {
    // Build adjacency
    const outgoing = new Map<string, Set<string>>()
    const incoming = new Map<string, Set<string>>()

    for (const id of nodeMap.keys()) {
      outgoing.set(id, new Set())
      incoming.set(id, new Set())
    }

    for (const link of links) {
      if (nodeMap.has(link.from) && nodeMap.has(link.to)) {
        outgoing.get(link.from)!.add(link.to)
        incoming.get(link.to)!.add(link.from)
      }
    }

    // Find roots (no incoming)
    const roots: string[] = []
    for (const [id, inc] of incoming) {
      if (inc.size === 0) {
        roots.push(id)
      }
    }

    // BFS to assign ranks
    const queue = [...roots]
    const visited = new Set<string>()

    while (queue.length > 0) {
      const nodeId = queue.shift()!
      if (visited.has(nodeId)) continue
      visited.add(nodeId)

      const node = nodeMap.get(nodeId)!
      const targets = outgoing.get(nodeId) || new Set()

      for (const targetId of targets) {
        const target = nodeMap.get(targetId)
        if (target) {
          target.rank = Math.max(target.rank, node.rank + 1)
          queue.push(targetId)
        }
      }
    }
  }

  private layoutSubgraph(
    sg: SubgraphInfo,
    nodeMap: Map<string, LayoutItem>,
    subgraphMap: Map<string, SubgraphInfo>
  ): void {
    const direction = sg.direction
    const isVertical = direction === 'TB' || direction === 'BT'
    const padding = this.options.subgraphPadding
    const labelHeight = this.options.subgraphLabelHeight

    // Get all items in this subgraph (nodes + child subgraphs)
    const items: Array<{ id: string; type: 'node' | 'subgraph'; width: number; height: number; rank: number }> = []

    for (const nodeId of sg.nodes) {
      const node = nodeMap.get(nodeId)
      if (node) {
        items.push({
          id: nodeId,
          type: 'node',
          width: node.width,
          height: node.height,
          rank: node.rank,
        })
      }
    }

    for (const childId of sg.childSubgraphs) {
      const child = subgraphMap.get(childId)
      if (child) {
        items.push({
          id: childId,
          type: 'subgraph',
          width: child.bounds.width,
          height: child.bounds.height,
          rank: 0, // Subgraphs don't have ranks
        })
      }
    }

    if (items.length === 0) {
      // Empty subgraph
      sg.bounds = { x: 0, y: 0, width: 150, height: 80 }
      return
    }

    // Group by rank for nodes, separate subgraphs
    const nodesByRank = new Map<number, typeof items>()
    const childSubgraphItems: typeof items = []

    for (const item of items) {
      if (item.type === 'subgraph') {
        childSubgraphItems.push(item)
      } else {
        const rank = item.rank
        if (!nodesByRank.has(rank)) {
          nodesByRank.set(rank, [])
        }
        nodesByRank.get(rank)!.push(item)
      }
    }

    // Layout nodes by rank
    const ranks = Array.from(nodesByRank.keys()).sort((a, b) => a - b)
    let currentMainPos = padding + labelHeight

    for (const rank of ranks) {
      const rankItems = nodesByRank.get(rank)!
      let currentCrossPos = padding
      let maxMainSize = 0

      for (const item of rankItems) {
        const node = nodeMap.get(item.id)!

        if (isVertical) {
          node.x = currentCrossPos + item.width / 2
          node.y = currentMainPos + item.height / 2
          currentCrossPos += item.width + this.options.nodeSpacing
          maxMainSize = Math.max(maxMainSize, item.height)
        } else {
          node.x = currentMainPos + item.width / 2
          node.y = currentCrossPos + item.height / 2
          currentCrossPos += item.height + this.options.nodeSpacing
          maxMainSize = Math.max(maxMainSize, item.width)
        }
      }

      currentMainPos += maxMainSize + this.options.rankSpacing
    }

    // Layout child subgraphs below/right of nodes
    for (const item of childSubgraphItems) {
      const child = subgraphMap.get(item.id)!

      // Calculate offset from current child position to new position
      let offsetX: number
      let offsetY: number

      if (isVertical) {
        offsetX = padding - child.bounds.x
        offsetY = currentMainPos - child.bounds.y
        currentMainPos += child.bounds.height + this.options.subgraphSpacing
      } else {
        offsetX = currentMainPos - child.bounds.x
        offsetY = padding + labelHeight - child.bounds.y
        currentMainPos += child.bounds.width + this.options.subgraphSpacing
      }

      // Offset the child subgraph and all its contents
      this.offsetSubgraphContents(child, nodeMap, subgraphMap, offsetX, offsetY)
    }

    // Calculate subgraph bounds
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity

    for (const nodeId of sg.nodes) {
      const node = nodeMap.get(nodeId)
      if (node) {
        minX = Math.min(minX, node.x - node.width / 2)
        minY = Math.min(minY, node.y - node.height / 2)
        maxX = Math.max(maxX, node.x + node.width / 2)
        maxY = Math.max(maxY, node.y + node.height / 2)
      }
    }

    for (const childId of sg.childSubgraphs) {
      const child = subgraphMap.get(childId)
      if (child) {
        minX = Math.min(minX, child.bounds.x)
        minY = Math.min(minY, child.bounds.y)
        maxX = Math.max(maxX, child.bounds.x + child.bounds.width)
        maxY = Math.max(maxY, child.bounds.y + child.bounds.height)
      }
    }

    if (minX === Infinity) {
      sg.bounds = { x: 0, y: 0, width: 150, height: 80 }
    } else {
      sg.bounds = {
        x: minX - padding,
        y: minY - padding - labelHeight,
        width: maxX - minX + padding * 2,
        height: maxY - minY + padding * 2 + labelHeight,
      }
    }
  }

  private layoutRootLevel(
    nodeMap: Map<string, LayoutItem>,
    subgraphMap: Map<string, SubgraphInfo>,
    direction: LayoutDirection
  ): void {
    const isVertical = direction === 'TB' || direction === 'BT'

    // Collect root-level items
    const rootNodes: string[] = []
    const rootSubgraphs: string[] = []

    for (const [id, node] of nodeMap) {
      if (!node.subgraphId || !subgraphMap.has(node.subgraphId)) {
        rootNodes.push(id)
      }
    }

    for (const [id, sg] of subgraphMap) {
      if (!sg.parent || !subgraphMap.has(sg.parent)) {
        rootSubgraphs.push(id)
      }
    }

    // Layout root subgraphs in a row/column
    let currentPos = 0

    for (const sgId of rootSubgraphs) {
      const sg = subgraphMap.get(sgId)!

      // Offset all contents of this subgraph
      const offsetX = isVertical ? 0 : currentPos - sg.bounds.x
      const offsetY = isVertical ? currentPos - sg.bounds.y : 0

      this.offsetSubgraphContents(sg, nodeMap, subgraphMap, offsetX, offsetY)

      if (isVertical) {
        currentPos += sg.bounds.height + this.options.subgraphSpacing
      } else {
        currentPos += sg.bounds.width + this.options.subgraphSpacing
      }
    }

    // Layout root nodes after subgraphs
    if (rootNodes.length > 0) {
      let crossPos = 0
      let maxMainSize = 0

      for (const nodeId of rootNodes) {
        const node = nodeMap.get(nodeId)!

        if (isVertical) {
          node.x = crossPos + node.width / 2
          node.y = currentPos + node.height / 2
          crossPos += node.width + this.options.nodeSpacing
          maxMainSize = Math.max(maxMainSize, node.height)
        } else {
          node.x = currentPos + node.width / 2
          node.y = crossPos + node.height / 2
          crossPos += node.height + this.options.nodeSpacing
          maxMainSize = Math.max(maxMainSize, node.width)
        }
      }
    }
  }

  private offsetSubgraphContents(
    sg: SubgraphInfo,
    nodeMap: Map<string, LayoutItem>,
    subgraphMap: Map<string, SubgraphInfo>,
    offsetX: number,
    offsetY: number
  ): void {
    // Offset bounds
    sg.bounds.x += offsetX
    sg.bounds.y += offsetY

    // Offset nodes
    for (const nodeId of sg.nodes) {
      const node = nodeMap.get(nodeId)
      if (node) {
        node.x += offsetX
        node.y += offsetY
      }
    }

    // Offset child subgraphs recursively
    for (const childId of sg.childSubgraphs) {
      const child = subgraphMap.get(childId)
      if (child) {
        this.offsetSubgraphContents(child, nodeMap, subgraphMap, offsetX, offsetY)
      }
    }
  }

  private calculateLinkPaths(
    links: Link[],
    nodeMap: Map<string, LayoutItem>,
    direction: LayoutDirection
  ): Map<string, LayoutLink> {
    const result = new Map<string, LayoutLink>()
    const isVertical = direction === 'TB' || direction === 'BT'

    links.forEach((link, index) => {
      const from = nodeMap.get(link.from)
      const to = nodeMap.get(link.to)

      if (!from || !to) return

      const id = link.id || `link-${index}`
      const points = this.calculateBezierPath(from, to, isVertical)

      result.set(id, {
        id,
        from: link.from,
        to: link.to,
        points,
        link,
      })
    })

    return result
  }

  private calculateBezierPath(
    from: LayoutItem,
    to: LayoutItem,
    isVertical: boolean
  ): Position[] {
    let fromPoint: Position
    let toPoint: Position

    if (isVertical) {
      if (from.y < to.y) {
        fromPoint = { x: from.x, y: from.y + from.height / 2 }
        toPoint = { x: to.x, y: to.y - to.height / 2 }
      } else {
        fromPoint = { x: from.x, y: from.y - from.height / 2 }
        toPoint = { x: to.x, y: to.y + to.height / 2 }
      }
    } else {
      if (from.x < to.x) {
        fromPoint = { x: from.x + from.width / 2, y: from.y }
        toPoint = { x: to.x - to.width / 2, y: to.y }
      } else {
        fromPoint = { x: from.x - from.width / 2, y: from.y }
        toPoint = { x: to.x + to.width / 2, y: to.y }
      }
    }

    const dx = toPoint.x - fromPoint.x
    const dy = toPoint.y - fromPoint.y

    let ctrl1: Position
    let ctrl2: Position

    if (isVertical) {
      const ctrlDist = Math.abs(dy) * 0.4
      ctrl1 = { x: fromPoint.x, y: fromPoint.y + Math.sign(dy) * ctrlDist }
      ctrl2 = { x: toPoint.x, y: toPoint.y - Math.sign(dy) * ctrlDist }
    } else {
      const ctrlDist = Math.abs(dx) * 0.4
      ctrl1 = { x: fromPoint.x + Math.sign(dx) * ctrlDist, y: fromPoint.y }
      ctrl2 = { x: toPoint.x - Math.sign(dx) * ctrlDist, y: toPoint.y }
    }

    return [fromPoint, ctrl1, ctrl2, toPoint]
  }

  private calculateTotalBounds(
    nodes: Map<string, LayoutNode>,
    subgraphs: Map<string, LayoutSubgraph>
  ): Bounds {
    let minX = Infinity, minY = Infinity
    let maxX = -Infinity, maxY = -Infinity

    nodes.forEach((node) => {
      minX = Math.min(minX, node.position.x - node.size.width / 2)
      minY = Math.min(minY, node.position.y - node.size.height / 2)
      maxX = Math.max(maxX, node.position.x + node.size.width / 2)
      maxY = Math.max(maxY, node.position.y + node.size.height / 2)
    })

    subgraphs.forEach((sg) => {
      minX = Math.min(minX, sg.bounds.x)
      minY = Math.min(minY, sg.bounds.y)
      maxX = Math.max(maxX, sg.bounds.x + sg.bounds.width)
      maxY = Math.max(maxY, sg.bounds.y + sg.bounds.height)
    })

    const padding = 50

    if (minX === Infinity) {
      return { x: 0, y: 0, width: 400, height: 300 }
    }

    return {
      x: minX - padding,
      y: minY - padding,
      width: maxX - minX + padding * 2,
      height: maxY - minY + padding * 2,
    }
  }
}

// Default export
export const hierarchicalLayoutV2 = new HierarchicalLayoutV2()
