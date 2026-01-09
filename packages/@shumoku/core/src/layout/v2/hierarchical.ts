/**
 * Hierarchical Layout Engine v2
 * Uses ELK.js for advanced graph layout with proper edge routing
 */

import ELK, { type ElkNode, type ElkExtendedEdge, type LayoutOptions } from 'elkjs/lib/elk.bundled.js'
import {
  type NetworkGraphV2,
  type Node,
  type Subgraph,
  type LayoutResult,
  type LayoutNode,
  type LayoutLink,
  type LayoutSubgraph,
  type Position,
  type Bounds,
  type LayoutDirection,
  type LinkEndpoint,
  getNodeId,
} from '../../models/v2'

// ============================================
// Helper Functions
// ============================================

/**
 * Convert endpoint to full LinkEndpoint object
 */
function toEndpoint(endpoint: string | LinkEndpoint): LinkEndpoint {
  if (typeof endpoint === 'string') {
    return { node: endpoint }
  }
  return endpoint
}

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
}

const DEFAULT_OPTIONS: Required<HierarchicalLayoutOptions> = {
  direction: 'TB',
  nodeWidth: 180,
  nodeHeight: 60,
  nodeSpacing: 120,     // Horizontal spacing between nodes
  rankSpacing: 180,     // Vertical spacing between layers
  subgraphPadding: 60,  // Padding inside subgraphs
  subgraphLabelHeight: 28,
}

// ============================================
// Layout Engine
// ============================================

export class HierarchicalLayoutV2 {
  private options: Required<HierarchicalLayoutOptions>
  private elk: InstanceType<typeof ELK>

  constructor(options?: HierarchicalLayoutOptions) {
    this.options = { ...DEFAULT_OPTIONS, ...options }
    this.elk = new ELK()
  }

  /**
   * Get effective options by merging graph settings with defaults
   */
  private getEffectiveOptions(graph: NetworkGraphV2): Required<HierarchicalLayoutOptions> {
    const settings = graph.settings

    return {
      ...this.options,
      direction: settings?.direction || this.options.direction,
      nodeSpacing: settings?.nodeSpacing || this.options.nodeSpacing,
      rankSpacing: settings?.rankSpacing || this.options.rankSpacing,
      subgraphPadding: settings?.subgraphPadding || this.options.subgraphPadding,
    }
  }

  async layoutAsync(graph: NetworkGraphV2): Promise<LayoutResult> {
    const startTime = performance.now()

    // Merge graph settings with default options
    const effectiveOptions = this.getEffectiveOptions(graph)
    const direction = effectiveOptions.direction

    // Detect HA pairs first (before building ELK graph)
    const haPairs = this.detectHAPairs(graph)

    // Build ELK graph
    const elkGraph = this.buildElkGraph(graph, direction, effectiveOptions)

    // Run ELK layout
    const layoutedGraph = await this.elk.layout(elkGraph)

    // Extract results
    const result = this.extractLayoutResult(graph, layoutedGraph)

    // Post-process: adjust positions for HA pairs (same rank nodes)
    this.adjustHAPairPositions(result, haPairs, direction)

    // Adjust node distances based on link minLength
    this.adjustLinkDistances(result, graph, direction)

    // Recalculate subgraph bounds after node adjustments
    this.recalculateSubgraphBounds(result, graph)

    // Note: Canvas scaling is handled by the SVG renderer, not here

    result.metadata = {
      algorithm: 'elk-layered',
      duration: performance.now() - startTime,
    }

    return result
  }

  // Synchronous wrapper that runs async internally
  layout(graph: NetworkGraphV2): LayoutResult {
    // For sync compatibility, we need to run layout synchronously
    // This is a simplified version - ideally use layoutAsync
    const effectiveOptions = this.getEffectiveOptions(graph)
    const direction = effectiveOptions.direction
    const elkGraph = this.buildElkGraph(graph, direction, effectiveOptions)

    // Run synchronous layout using elk's sync API
    let result: LayoutResult

    // Use a workaround: pre-calculate positions based on structure
    result = this.calculateFallbackLayout(graph, direction)

    // Start async layout and update when done (for future renders)
    this.elk.layout(elkGraph).then((layoutedGraph: ElkNode) => {
      // This will be available for next render
      Object.assign(result, this.extractLayoutResult(graph, layoutedGraph))
    }).catch(() => {
      // Keep fallback layout
    })

    return result
  }

  private buildElkGraph(
    graph: NetworkGraphV2,
    direction: LayoutDirection,
    options: Required<HierarchicalLayoutOptions>
  ): ElkNode {
    const elkDirection = this.toElkDirection(direction)

    // Build subgraph map
    const subgraphMap = new Map<string, Subgraph>()
    if (graph.subgraphs) {
      for (const sg of graph.subgraphs) {
        subgraphMap.set(sg.id, sg)
      }
    }

    // Build node to parent map
    const nodeParent = new Map<string, string>()
    for (const node of graph.nodes) {
      if (node.parent) {
        nodeParent.set(node.id, node.parent)
      }
    }

    // Build subgraph children map
    const subgraphChildren = new Map<string, string[]>()
    for (const sg of subgraphMap.values()) {
      subgraphChildren.set(sg.id, [])
    }
    for (const sg of subgraphMap.values()) {
      if (sg.parent && subgraphMap.has(sg.parent)) {
        subgraphChildren.get(sg.parent)!.push(sg.id)
      }
    }

    // Create ELK node
    const createElkNode_ = (node: Node): ElkNode => {
      const height = this.calculateNodeHeight(node)
      return {
        id: node.id,
        width: options.nodeWidth,
        height,
        labels: [{ text: Array.isArray(node.label) ? node.label.join('\n') : node.label }],
      }
    }

    // Create ELK nodes recursively
    const createElkNode = (nodeId: string, isSubgraph: boolean, subgraph?: Subgraph): ElkNode => {
      if (isSubgraph && subgraph) {
        // This is a subgraph (compound node)
        const childNodes: ElkNode[] = []

        // Add child subgraphs
        const childSgIds = subgraphChildren.get(subgraph.id) || []
        for (const childId of childSgIds) {
          const childSg = subgraphMap.get(childId)
          if (childSg) {
            childNodes.push(createElkNode(childId, true, childSg))
          }
        }

        // Add nodes in this subgraph
        for (const node of graph.nodes) {
          if (node.parent === subgraph.id) {
            childNodes.push(createElkNode_(node))
          }
        }

        // Use per-subgraph settings if specified, otherwise fall back to global
        const sgPadding = subgraph.style?.padding ?? options.subgraphPadding
        const sgNodeSpacing = subgraph.style?.nodeSpacing ?? options.nodeSpacing
        const sgRankSpacing = subgraph.style?.rankSpacing ?? options.rankSpacing

        return {
          id: subgraph.id,
          labels: [{ text: subgraph.label }],
          children: childNodes,
          layoutOptions: {
            'elk.padding': `[top=${sgPadding + options.subgraphLabelHeight},left=${sgPadding},bottom=${sgPadding},right=${sgPadding}]`,
            'elk.spacing.nodeNode': String(sgNodeSpacing),
            'elk.layered.spacing.nodeNodeBetweenLayers': String(sgRankSpacing),
          },
        }
      } else {
        // Regular node
        const node = graph.nodes.find(n => n.id === nodeId)
        if (node) {
          return createElkNode_(node)
        }
        const height = options.nodeHeight
        return {
          id: nodeId,
          width: options.nodeWidth,
          height,
        }
      }
    }

    // Build root children
    const rootChildren: ElkNode[] = []

    // Add root-level subgraphs
    for (const sg of subgraphMap.values()) {
      if (!sg.parent || !subgraphMap.has(sg.parent)) {
        rootChildren.push(createElkNode(sg.id, true, sg))
      }
    }

    // Add root-level nodes
    for (const node of graph.nodes) {
      if (!node.parent || !subgraphMap.has(node.parent)) {
        rootChildren.push(createElkNode_(node))
      }
    }

    // Build edges with labels
    const edges: ElkExtendedEdge[] = graph.links.map((link, index) => {
      const edge: ElkExtendedEdge = {
        id: link.id || `edge-${index}`,
        sources: [getNodeId(link.from)],
        targets: [getNodeId(link.to)],
      }
      // Add label if present
      if (link.label) {
        const labelText = Array.isArray(link.label) ? link.label.join(' / ') : link.label
        edge.labels = [{
          text: labelText,
          layoutOptions: {
            'elk.edgeLabels.placement': 'CENTER',
          }
        }]
      }
      return edge
    })

    // Root graph
    const rootLayoutOptions: LayoutOptions = {
      'elk.algorithm': 'layered',
      'elk.direction': elkDirection,
      'elk.spacing.nodeNode': String(options.nodeSpacing),
      'elk.layered.spacing.nodeNodeBetweenLayers': String(options.rankSpacing),
      'elk.spacing.edgeNode': '50',  // Space between edges and nodes
      'elk.spacing.edgeEdge': '20',  // Space between edges
      'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
      'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
      'elk.edgeRouting': 'SPLINES',  // Curved edges
      'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
    }

    return {
      id: 'root',
      children: rootChildren,
      edges,
      layoutOptions: rootLayoutOptions,
    }
  }

  private toElkDirection(direction: LayoutDirection): string {
    switch (direction) {
      case 'TB': return 'DOWN'
      case 'BT': return 'UP'
      case 'LR': return 'RIGHT'
      case 'RL': return 'LEFT'
      default: return 'DOWN'
    }
  }

  private calculateNodeHeight(node: Node): number {
    const lines = Array.isArray(node.label) ? node.label.length : 1
    const baseHeight = 40
    const lineHeight = 16
    // Add extra height for icon if device type or vendor icon is specified
    const hasIcon = node.type || (node.vendor && (node.service || node.model))
    const iconHeight = hasIcon ? 36 : 0
    return Math.max(this.options.nodeHeight, baseHeight + (lines - 1) * lineHeight + iconHeight)
  }

  private extractLayoutResult(graph: NetworkGraphV2, elkGraph: ElkNode): LayoutResult {
    const layoutNodes = new Map<string, LayoutNode>()
    const layoutSubgraphs = new Map<string, LayoutSubgraph>()
    const layoutLinks = new Map<string, LayoutLink>()

    // Build subgraph map for reference
    const subgraphMap = new Map<string, Subgraph>()
    if (graph.subgraphs) {
      for (const sg of graph.subgraphs) {
        subgraphMap.set(sg.id, sg)
      }
    }

    // Extract node and subgraph positions recursively
    const processElkNode = (elkNode: ElkNode, offsetX: number, offsetY: number) => {
      const x = (elkNode.x || 0) + offsetX
      const y = (elkNode.y || 0) + offsetY
      const width = elkNode.width || 0
      const height = elkNode.height || 0

      if (subgraphMap.has(elkNode.id)) {
        // This is a subgraph
        const sg = subgraphMap.get(elkNode.id)!
        layoutSubgraphs.set(elkNode.id, {
          id: elkNode.id,
          bounds: { x, y, width, height },
          subgraph: sg,
        })

        // Process children
        if (elkNode.children) {
          for (const child of elkNode.children) {
            processElkNode(child, x, y)
          }
        }
      } else {
        // This is a regular node
        const node = graph.nodes.find(n => n.id === elkNode.id)
        if (node) {
          layoutNodes.set(elkNode.id, {
            id: elkNode.id,
            position: { x: x + width / 2, y: y + height / 2 },
            size: { width, height },
            node,
          })
        }
      }
    }

    // Process root children
    if (elkGraph.children) {
      for (const child of elkGraph.children) {
        processElkNode(child, 0, 0)
      }
    }

    // Calculate edges based on extracted node positions
    // We calculate our own routing since ELK's edge coordinates don't match our node coordinates
    graph.links.forEach((link, index) => {
      const id = link.id || `link-${index}`
      const fromId = getNodeId(link.from)
      const toId = getNodeId(link.to)
      const fromNode = layoutNodes.get(fromId)
      const toNode = layoutNodes.get(toId)

      if (!fromNode || !toNode) return

      // Calculate connection points on node borders
      const points = this.calculateEdgePath(fromNode, toNode, layoutNodes, layoutSubgraphs)

      layoutLinks.set(id, {
        id,
        from: fromId,
        to: toId,
        fromEndpoint: toEndpoint(link.from),
        toEndpoint: toEndpoint(link.to),
        points,
        link,
      })
    })

    // Calculate total bounds
    const bounds = this.calculateTotalBounds(layoutNodes, layoutSubgraphs)

    return {
      nodes: layoutNodes,
      links: layoutLinks,
      subgraphs: layoutSubgraphs,
      bounds,
    }
  }

  /**
   * Calculate edge path between two nodes as smooth bezier curve
   */
  private calculateEdgePath(
    fromNode: LayoutNode,
    toNode: LayoutNode,
    _allNodes: Map<string, LayoutNode>,
    _allSubgraphs: Map<string, LayoutSubgraph>
  ): Position[] {
    const fromPos = fromNode.position
    const toPos = toNode.position
    const fromSize = fromNode.size
    const toSize = toNode.size

    // Calculate direction from source to target
    const dx = toPos.x - fromPos.x
    const dy = toPos.y - fromPos.y

    // Determine connection points on node borders based on relative position
    let fromPoint: Position
    let toPoint: Position
    let controlDist: number

    // For vertical layouts (TB), prefer top/bottom connections
    if (Math.abs(dy) > Math.abs(dx) * 0.3) {
      // Primarily vertical
      if (dy > 0) {
        fromPoint = { x: fromPos.x, y: fromPos.y + fromSize.height / 2 }
        toPoint = { x: toPos.x, y: toPos.y - toSize.height / 2 }
      } else {
        fromPoint = { x: fromPos.x, y: fromPos.y - fromSize.height / 2 }
        toPoint = { x: toPos.x, y: toPos.y + toSize.height / 2 }
      }
      // Control point distance based on vertical distance
      controlDist = Math.min(Math.abs(toPoint.y - fromPoint.y) * 0.4, 80)

      // Generate bezier curve (4 points: start, control1, control2, end)
      return [
        fromPoint,
        { x: fromPoint.x, y: fromPoint.y + Math.sign(dy) * controlDist },
        { x: toPoint.x, y: toPoint.y - Math.sign(dy) * controlDist },
        toPoint,
      ]
    } else {
      // Primarily horizontal
      if (dx > 0) {
        fromPoint = { x: fromPos.x + fromSize.width / 2, y: fromPos.y }
        toPoint = { x: toPos.x - toSize.width / 2, y: toPos.y }
      } else {
        fromPoint = { x: fromPos.x - fromSize.width / 2, y: fromPos.y }
        toPoint = { x: toPos.x + toSize.width / 2, y: toPos.y }
      }
      // Control point distance based on horizontal distance
      controlDist = Math.min(Math.abs(toPoint.x - fromPoint.x) * 0.4, 80)

      // Generate bezier curve
      return [
        fromPoint,
        { x: fromPoint.x + Math.sign(dx) * controlDist, y: fromPoint.y },
        { x: toPoint.x - Math.sign(dx) * controlDist, y: toPoint.y },
        toPoint,
      ]
    }
  }

  private calculateFallbackLayout(graph: NetworkGraphV2, _direction: LayoutDirection): LayoutResult {
    // Simple fallback layout when async isn't available
    const layoutNodes = new Map<string, LayoutNode>()
    const layoutSubgraphs = new Map<string, LayoutSubgraph>()
    const layoutLinks = new Map<string, LayoutLink>()

    // Simple grid layout for nodes
    let x = 100
    let y = 100
    const rowHeight = this.options.nodeHeight + this.options.rankSpacing
    const colWidth = this.options.nodeWidth + this.options.nodeSpacing
    let col = 0
    const maxCols = 4

    for (const node of graph.nodes) {
      const height = this.calculateNodeHeight(node)
      layoutNodes.set(node.id, {
        id: node.id,
        position: { x: x + this.options.nodeWidth / 2, y: y + height / 2 },
        size: { width: this.options.nodeWidth, height },
        node,
      })

      col++
      if (col >= maxCols) {
        col = 0
        x = 100
        y += rowHeight
      } else {
        x += colWidth
      }
    }

    // Simple links
    graph.links.forEach((link, index) => {
      const fromId = getNodeId(link.from)
      const toId = getNodeId(link.to)
      const from = layoutNodes.get(fromId)
      const to = layoutNodes.get(toId)
      if (from && to) {
        layoutLinks.set(link.id || `link-${index}`, {
          id: link.id || `link-${index}`,
          from: fromId,
          to: toId,
          fromEndpoint: toEndpoint(link.from),
          toEndpoint: toEndpoint(link.to),
          points: [from.position, to.position],
          link,
        })
      }
    })

    const bounds = this.calculateTotalBounds(layoutNodes, layoutSubgraphs)

    return {
      nodes: layoutNodes,
      links: layoutLinks,
      subgraphs: layoutSubgraphs,
      bounds,
      metadata: { algorithm: 'fallback-grid', duration: 0 },
    }
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

  /**
   * Detect redundancy pairs based on link.redundancy property
   * Returns array of [nodeA, nodeB] pairs that should be placed on the same layer
   */
  private detectHAPairs(graph: NetworkGraphV2): { nodeA: string; nodeB: string; minLength?: number }[] {
    const pairs: { nodeA: string; nodeB: string; minLength?: number }[] = []
    const processedPairs = new Set<string>()

    for (const link of graph.links) {
      // Only process links with redundancy property set
      if (!link.redundancy) continue

      const fromId = getNodeId(link.from)
      const toId = getNodeId(link.to)
      const pairKey = [fromId, toId].sort().join(':')
      if (processedPairs.has(pairKey)) continue

      pairs.push({
        nodeA: fromId,
        nodeB: toId,
        minLength: link.style?.minLength,
      })
      processedPairs.add(pairKey)
    }

    return pairs
  }

  /**
   * Adjust positions of HA pairs to be on the same horizontal/vertical level
   */
  private adjustHAPairPositions(
    result: LayoutResult,
    haPairs: { nodeA: string; nodeB: string; minLength?: number }[],
    direction: LayoutDirection
  ): void {
    const adjustedNodes = new Set<string>()

    for (const pair of haPairs) {
      const nodeA = result.nodes.get(pair.nodeA)
      const nodeB = result.nodes.get(pair.nodeB)

      if (!nodeA || !nodeB) continue

      // Use minLength from link if specified, otherwise use default nodeSpacing
      const spacing = pair.minLength ?? this.options.nodeSpacing

      // Calculate the Y offset (how much we're moving the nodes)
      const originalAY = nodeA.position.y
      const originalBY = nodeB.position.y

      if (direction === 'TB' || direction === 'BT') {
        // For top-bottom layout, align Y coordinates (make horizontal)
        const avgY = (nodeA.position.y + nodeB.position.y) / 2
        nodeA.position.y = avgY
        nodeB.position.y = avgY

        // Ensure they are side by side with proper spacing
        const centerX = (nodeA.position.x + nodeB.position.x) / 2
        const halfSpacing = (nodeA.size.width + spacing) / 2

        // Keep left-right order
        if (nodeA.position.x < nodeB.position.x) {
          nodeA.position.x = centerX - halfSpacing
          nodeB.position.x = centerX + halfSpacing
        } else {
          nodeA.position.x = centerX + halfSpacing
          nodeB.position.x = centerX - halfSpacing
        }

        // Also adjust parallel uplink nodes (nodes that connect exclusively to one HA member)
        const offsetA = avgY - originalAY
        const offsetB = avgY - originalBY
        this.adjustParallelNodes(result, pair.nodeA, pair.nodeB, offsetA, offsetB, 'y', adjustedNodes)
      } else {
        // For left-right layout, align X coordinates (make vertical)
        const avgX = (nodeA.position.x + nodeB.position.x) / 2
        nodeA.position.x = avgX
        nodeB.position.x = avgX

        // Ensure they are stacked with proper spacing
        const centerY = (nodeA.position.y + nodeB.position.y) / 2
        const halfSpacing = (nodeA.size.height + spacing) / 2

        if (nodeA.position.y < nodeB.position.y) {
          nodeA.position.y = centerY - halfSpacing
          nodeB.position.y = centerY + halfSpacing
        } else {
          nodeA.position.y = centerY + halfSpacing
          nodeB.position.y = centerY - halfSpacing
        }
      }

      adjustedNodes.add(pair.nodeA)
      adjustedNodes.add(pair.nodeB)
    }

    // Recalculate all edges (since we may have moved multiple nodes)
    this.recalculateAllEdges(result)
  }

  /**
   * Adjust node distances based on link minLength property
   */
  private adjustLinkDistances(
    result: LayoutResult,
    graph: NetworkGraphV2,
    direction: LayoutDirection
  ): void {
    const isVertical = direction === 'TB' || direction === 'BT'
    let adjusted = false

    for (const link of graph.links) {
      const minLength = link.style?.minLength
      if (!minLength) continue

      // Skip HA links (already handled by adjustHAPairPositions)
      if (link.redundancy) continue

      const fromId = getNodeId(link.from)
      const toId = getNodeId(link.to)
      const fromNode = result.nodes.get(fromId)
      const toNode = result.nodes.get(toId)

      if (!fromNode || !toNode) continue

      // Calculate current distance
      const dx = toNode.position.x - fromNode.position.x
      const dy = toNode.position.y - fromNode.position.y
      const currentDist = Math.sqrt(dx * dx + dy * dy)

      if (currentDist >= minLength) continue

      // Need to increase distance
      const scale = minLength / currentDist

      if (isVertical) {
        // For TB/BT layout, primarily adjust Y (move target node down/up)
        const newDy = dy * scale
        const deltaY = newDy - dy
        toNode.position.y += deltaY
      } else {
        // For LR/RL layout, primarily adjust X
        const newDx = dx * scale
        const deltaX = newDx - dx
        toNode.position.x += deltaX
      }

      adjusted = true
    }

    if (adjusted) {
      this.recalculateAllEdges(result)
    }
  }

  /**
   * Adjust nodes that connect exclusively to one member of an HA pair
   */
  private adjustParallelNodes(
    result: LayoutResult,
    nodeAId: string,
    nodeBId: string,
    offsetA: number,
    offsetB: number,
    axis: 'x' | 'y',
    adjustedNodes: Set<string>
  ): void {
    // Find nodes that connect to only nodeA or only nodeB
    const nodeAConnections = new Set<string>()
    const nodeBConnections = new Set<string>()

    result.links.forEach((link) => {
      if (link.from === nodeAId && link.to !== nodeBId) {
        nodeAConnections.add(link.to)
      }
      if (link.to === nodeAId && link.from !== nodeBId) {
        nodeAConnections.add(link.from)
      }
      if (link.from === nodeBId && link.to !== nodeAId) {
        nodeBConnections.add(link.to)
      }
      if (link.to === nodeBId && link.from !== nodeAId) {
        nodeBConnections.add(link.from)
      }
    })

    // Find exclusive connections (connect to A but not B, or vice versa)
    const exclusiveToA = [...nodeAConnections].filter(id => !nodeBConnections.has(id) && !adjustedNodes.has(id))
    const exclusiveToB = [...nodeBConnections].filter(id => !nodeAConnections.has(id) && !adjustedNodes.has(id))

    // Adjust exclusive connections
    for (const nodeId of exclusiveToA) {
      const node = result.nodes.get(nodeId)
      if (node) {
        if (axis === 'y') {
          node.position.y += offsetA
        } else {
          node.position.x += offsetA
        }
        adjustedNodes.add(nodeId)
      }
    }

    for (const nodeId of exclusiveToB) {
      const node = result.nodes.get(nodeId)
      if (node) {
        if (axis === 'y') {
          node.position.y += offsetB
        } else {
          node.position.x += offsetB
        }
        adjustedNodes.add(nodeId)
      }
    }
  }

  /**
   * Calculate edge path with offset for multiple connections
   */
  private calculateEdgePathWithOffset(
    fromNode: LayoutNode,
    toNode: LayoutNode,
    outIndex: number,
    outTotal: number,
    inIndex: number,
    inTotal: number
  ): Position[] {
    const fromPos = fromNode.position
    const toPos = toNode.position
    const fromSize = fromNode.size
    const toSize = toNode.size

    // Calculate direction from source to target
    const dx = toPos.x - fromPos.x
    const dy = toPos.y - fromPos.y

    // Calculate offset for distributing multiple connections
    const portSpacing = 15 // pixels between port connections

    let fromPoint: Position
    let toPoint: Position
    let controlDist: number

    // For vertical layouts (TB), prefer top/bottom connections
    if (Math.abs(dy) > Math.abs(dx) * 0.3) {
      // Primarily vertical
      // Calculate horizontal offset for multiple outgoing/incoming links
      const outOffset = outTotal > 1 ? (outIndex - (outTotal - 1) / 2) * portSpacing : 0
      const inOffset = inTotal > 1 ? (inIndex - (inTotal - 1) / 2) * portSpacing : 0

      if (dy > 0) {
        fromPoint = { x: fromPos.x + outOffset, y: fromPos.y + fromSize.height / 2 }
        toPoint = { x: toPos.x + inOffset, y: toPos.y - toSize.height / 2 }
      } else {
        fromPoint = { x: fromPos.x + outOffset, y: fromPos.y - fromSize.height / 2 }
        toPoint = { x: toPos.x + inOffset, y: toPos.y + toSize.height / 2 }
      }
      controlDist = Math.min(Math.abs(toPoint.y - fromPoint.y) * 0.4, 80)

      return [
        fromPoint,
        { x: fromPoint.x, y: fromPoint.y + Math.sign(dy) * controlDist },
        { x: toPoint.x, y: toPoint.y - Math.sign(dy) * controlDist },
        toPoint,
      ]
    } else {
      // Primarily horizontal
      // Calculate vertical offset for multiple outgoing/incoming links
      const outOffset = outTotal > 1 ? (outIndex - (outTotal - 1) / 2) * portSpacing : 0
      const inOffset = inTotal > 1 ? (inIndex - (inTotal - 1) / 2) * portSpacing : 0

      if (dx > 0) {
        fromPoint = { x: fromPos.x + fromSize.width / 2, y: fromPos.y + outOffset }
        toPoint = { x: toPos.x - toSize.width / 2, y: toPos.y + inOffset }
      } else {
        fromPoint = { x: fromPos.x - fromSize.width / 2, y: fromPos.y + outOffset }
        toPoint = { x: toPos.x + toSize.width / 2, y: toPos.y + inOffset }
      }
      controlDist = Math.min(Math.abs(toPoint.x - fromPoint.x) * 0.4, 80)

      return [
        fromPoint,
        { x: fromPoint.x + Math.sign(dx) * controlDist, y: fromPoint.y },
        { x: toPoint.x - Math.sign(dx) * controlDist, y: toPoint.y },
        toPoint,
      ]
    }
  }

  /**
   * Recalculate all edge paths with port offset distribution
   */
  private recalculateAllEdges(result: LayoutResult): void {
    // Group links by source and target nodes to calculate offsets
    const outgoingLinks = new Map<string, string[]>() // nodeId -> [linkIds]
    const incomingLinks = new Map<string, string[]>() // nodeId -> [linkIds]

    result.links.forEach((layoutLink, linkId) => {
      // Outgoing from source
      if (!outgoingLinks.has(layoutLink.from)) {
        outgoingLinks.set(layoutLink.from, [])
      }
      outgoingLinks.get(layoutLink.from)!.push(linkId)

      // Incoming to target
      if (!incomingLinks.has(layoutLink.to)) {
        incomingLinks.set(layoutLink.to, [])
      }
      incomingLinks.get(layoutLink.to)!.push(linkId)
    })

    // Sort outgoing links by target X position to reduce crossings
    outgoingLinks.forEach((linkIds, _nodeId) => {
      linkIds.sort((a, b) => {
        const linkA = result.links.get(a)
        const linkB = result.links.get(b)
        if (!linkA || !linkB) return 0
        const targetA = result.nodes.get(linkA.to)
        const targetB = result.nodes.get(linkB.to)
        if (!targetA || !targetB) return 0
        return targetA.position.x - targetB.position.x
      })
    })

    // Sort incoming links by source X position to reduce crossings
    incomingLinks.forEach((linkIds, _nodeId) => {
      linkIds.sort((a, b) => {
        const linkA = result.links.get(a)
        const linkB = result.links.get(b)
        if (!linkA || !linkB) return 0
        const sourceA = result.nodes.get(linkA.from)
        const sourceB = result.nodes.get(linkB.from)
        if (!sourceA || !sourceB) return 0
        return sourceA.position.x - sourceB.position.x
      })
    })

    // Calculate edge paths with offset
    result.links.forEach((layoutLink, linkId) => {
      const fromNode = result.nodes.get(layoutLink.from)
      const toNode = result.nodes.get(layoutLink.to)

      if (fromNode && toNode) {
        // Get offset indices for this link
        const outLinks = outgoingLinks.get(layoutLink.from) || []
        const inLinks = incomingLinks.get(layoutLink.to) || []
        const outIndex = outLinks.indexOf(linkId)
        const inIndex = inLinks.indexOf(linkId)

        layoutLink.points = this.calculateEdgePathWithOffset(
          fromNode, toNode,
          outIndex, outLinks.length,
          inIndex, inLinks.length
        )
      }
    })
  }

  /**
   * Recalculate subgraph bounds to contain all child nodes after adjustments
   */
  private recalculateSubgraphBounds(result: LayoutResult, graph: NetworkGraphV2): void {
    if (!graph.subgraphs) return

    const padding = this.options.subgraphPadding
    const labelHeight = this.options.subgraphLabelHeight

    // Build node-to-subgraph mapping
    const nodeToSubgraph = new Map<string, string>()
    for (const node of graph.nodes) {
      if (node.parent) {
        nodeToSubgraph.set(node.id, node.parent)
      }
    }

    // Recalculate bounds for each subgraph
    result.subgraphs.forEach((layoutSubgraph, subgraphId) => {
      const childNodes: LayoutNode[] = []

      // Find all nodes that belong to this subgraph
      result.nodes.forEach((layoutNode, nodeId) => {
        if (nodeToSubgraph.get(nodeId) === subgraphId) {
          childNodes.push(layoutNode)
        }
      })

      if (childNodes.length === 0) return

      // Calculate bounding box of all child nodes
      let minX = Infinity, minY = Infinity
      let maxX = -Infinity, maxY = -Infinity

      for (const node of childNodes) {
        const left = node.position.x - node.size.width / 2
        const right = node.position.x + node.size.width / 2
        const top = node.position.y - node.size.height / 2
        const bottom = node.position.y + node.size.height / 2

        minX = Math.min(minX, left)
        minY = Math.min(minY, top)
        maxX = Math.max(maxX, right)
        maxY = Math.max(maxY, bottom)
      }

      // Apply padding
      layoutSubgraph.bounds = {
        x: minX - padding,
        y: minY - padding - labelHeight,
        width: (maxX - minX) + padding * 2,
        height: (maxY - minY) + padding * 2 + labelHeight,
      }
    })

    // Update overall bounds
    let minX = Infinity, minY = Infinity
    let maxX = -Infinity, maxY = -Infinity

    result.nodes.forEach((node) => {
      const left = node.position.x - node.size.width / 2
      const right = node.position.x + node.size.width / 2
      const top = node.position.y - node.size.height / 2
      const bottom = node.position.y + node.size.height / 2

      minX = Math.min(minX, left)
      minY = Math.min(minY, top)
      maxX = Math.max(maxX, right)
      maxY = Math.max(maxY, bottom)
    })

    result.subgraphs.forEach((sg) => {
      minX = Math.min(minX, sg.bounds.x)
      minY = Math.min(minY, sg.bounds.y)
      maxX = Math.max(maxX, sg.bounds.x + sg.bounds.width)
      maxY = Math.max(maxY, sg.bounds.y + sg.bounds.height)
    })

    const margin = 40
    result.bounds = {
      x: minX - margin,
      y: minY - margin,
      width: (maxX - minX) + margin * 2,
      height: (maxY - minY) + margin * 2,
    }
  }

}

// Default export
export const hierarchicalLayoutV2 = new HierarchicalLayoutV2()
