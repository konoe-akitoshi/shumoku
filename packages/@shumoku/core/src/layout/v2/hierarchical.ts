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

/**
 * Collect all ports for each node from links
 * @param haNodePairs - Set of "nodeA:nodeB" strings for HA pairs to exclude their ports
 */
function collectNodePorts(
  graph: NetworkGraphV2,
  haNodePairs?: Set<string>
): Map<string, Set<string>> {
  const nodePorts = new Map<string, Set<string>>()

  for (const link of graph.links) {
    const fromEndpoint = toEndpoint(link.from)
    const toEndpoint_ = toEndpoint(link.to)

    // Skip ports for HA links - they will be handled separately
    const pairKey = `${fromEndpoint.node}:${toEndpoint_.node}`
    if (haNodePairs?.has(pairKey)) {
      continue
    }

    if (fromEndpoint.port) {
      if (!nodePorts.has(fromEndpoint.node)) {
        nodePorts.set(fromEndpoint.node, new Set())
      }
      nodePorts.get(fromEndpoint.node)!.add(fromEndpoint.port)
    }

    if (toEndpoint_.port) {
      if (!nodePorts.has(toEndpoint_.node)) {
        nodePorts.set(toEndpoint_.node, new Set())
      }
      nodePorts.get(toEndpoint_.node)!.add(toEndpoint_.port)
    }
  }

  return nodePorts
}

/** Port size constants */
const PORT_WIDTH = 8
const PORT_HEIGHT = 8

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

    // Build ELK graph with HA pairs merged into virtual nodes
    const { elkGraph, haVirtualNodes } = this.buildElkGraphWithHAMerge(
      graph, direction, effectiveOptions, haPairs
    )

    // Run ELK layout
    const layoutedGraph = await this.elk.layout(elkGraph)

    // Extract results and expand HA virtual nodes back to original pairs
    const result = this.extractLayoutResultWithHAExpand(
      graph, layoutedGraph, haVirtualNodes, effectiveOptions
    )

    // Adjust node distances based on link minLength (for non-HA links)
    this.adjustLinkDistances(result, graph, direction)

    // Recalculate subgraph bounds after node adjustments
    this.recalculateSubgraphBounds(result, graph)

    result.metadata = {
      algorithm: 'elk-layered-ha-merge',
      duration: performance.now() - startTime,
    }

    return result
  }

  /**
   * Build ELK graph with HA pairs merged into single virtual nodes
   */
  private buildElkGraphWithHAMerge(
    graph: NetworkGraphV2,
    direction: LayoutDirection,
    options: Required<HierarchicalLayoutOptions>,
    haPairs: { nodeA: string; nodeB: string; minLength?: number }[]
  ): { elkGraph: ElkNode; haVirtualNodes: Map<string, { virtualId: string; nodeA: Node; nodeB: Node; gap: number; widthA: number; widthB: number; height: number }> } {
    const elkDirection = this.toElkDirection(direction)
    const haVirtualNodes = new Map<string, { virtualId: string; nodeA: Node; nodeB: Node; gap: number; widthA: number; widthB: number; height: number }>()

    // Build set of nodes in HA pairs
    const nodesInHAPairs = new Set<string>()
    for (const pair of haPairs) {
      nodesInHAPairs.add(pair.nodeA)
      nodesInHAPairs.add(pair.nodeB)
    }

    // Build node map for quick lookup
    const nodeMap = new Map<string, Node>()
    for (const node of graph.nodes) {
      nodeMap.set(node.id, node)
    }

    // Create virtual nodes for HA pairs
    const gap = 40 // Gap between HA pair nodes
    for (let i = 0; i < haPairs.length; i++) {
      const pair = haPairs[i]
      const nodeA = nodeMap.get(pair.nodeA)
      const nodeB = nodeMap.get(pair.nodeB)
      if (!nodeA || !nodeB) continue

      const virtualId = `__ha_virtual_${i}`
      const widthA = options.nodeWidth
      const widthB = options.nodeWidth
      const heightA = this.calculateNodeHeight(nodeA)
      const heightB = this.calculateNodeHeight(nodeB)

      haVirtualNodes.set(virtualId, {
        virtualId,
        nodeA,
        nodeB,
        gap: pair.minLength ?? gap,
        widthA,
        widthB,
        height: Math.max(heightA, heightB),
      })
    }

    // Build edge redirect map: original node -> virtual node + side (A or B)
    const edgeRedirect = new Map<string, { virtualId: string; side: 'A' | 'B' }>()
    for (const [virtualId, info] of haVirtualNodes) {
      edgeRedirect.set(info.nodeA.id, { virtualId, side: 'A' })
      edgeRedirect.set(info.nodeB.id, { virtualId, side: 'B' })
    }

    // Collect all ports for each node from links
    const nodePorts = collectNodePorts(graph)

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

    // Create ELK node for regular nodes
    const createElkNode_ = (node: Node): ElkNode => {
      const height = this.calculateNodeHeight(node)
      const elkNode: ElkNode = {
        id: node.id,
        width: options.nodeWidth,
        height,
        labels: [{ text: Array.isArray(node.label) ? node.label.join('\n') : node.label }],
      }

      // Add ports if this node has any
      const ports = nodePorts.get(node.id)
      if (ports && ports.size > 0) {
        elkNode.ports = Array.from(ports).map(portName => ({
          id: `${node.id}:${portName}`,
          width: PORT_WIDTH,
          height: PORT_HEIGHT,
          labels: [{ text: portName }],
        }))
        elkNode.layoutOptions = { 'elk.portConstraints': 'FREE' }
      }

      return elkNode
    }

    // Create ELK node for HA virtual node with all ports from both nodes
    const createHAVirtualElkNode = (info: { virtualId: string; nodeA: Node; nodeB: Node; gap: number; widthA: number; widthB: number; height: number }): ElkNode => {
      const totalWidth = info.widthA + info.gap + info.widthB
      const ports: { id: string; width: number; height: number; labels?: { text: string }[] }[] = []

      // Add all ports from nodeA (with prefix to identify them)
      const portsA = nodePorts.get(info.nodeA.id)
      if (portsA) {
        for (const portName of portsA) {
          ports.push({
            id: `${info.virtualId}:A:${portName}`,
            width: PORT_WIDTH,
            height: PORT_HEIGHT,
            labels: [{ text: portName }],
          })
        }
      }

      // Add all ports from nodeB (with prefix to identify them)
      const portsB = nodePorts.get(info.nodeB.id)
      if (portsB) {
        for (const portName of portsB) {
          ports.push({
            id: `${info.virtualId}:B:${portName}`,
            width: PORT_WIDTH,
            height: PORT_HEIGHT,
            labels: [{ text: portName }],
          })
        }
      }

      // Add fallback ports if no specific ports
      if (ports.length === 0) {
        ports.push(
          { id: `${info.virtualId}:A`, width: PORT_WIDTH, height: PORT_HEIGHT },
          { id: `${info.virtualId}:B`, width: PORT_WIDTH, height: PORT_HEIGHT },
        )
      }

      const elkNode: ElkNode = {
        id: info.virtualId,
        width: totalWidth,
        height: info.height,
        labels: [{ text: `${info.nodeA.id} + ${info.nodeB.id}` }],
        ports,
        layoutOptions: { 'elk.portConstraints': 'FREE' },
      }
      return elkNode
    }

    // Determine which subgraph each HA virtual node belongs to
    const virtualNodeParent = new Map<string, string | undefined>()
    for (const [virtualId, info] of haVirtualNodes) {
      // Use nodeA's parent (both should be in same subgraph for HA to make sense)
      virtualNodeParent.set(virtualId, info.nodeA.parent)
    }

    // Create ELK nodes recursively for subgraphs
    const createSubgraphNode = (subgraph: Subgraph): ElkNode => {
      const childNodes: ElkNode[] = []

      // Add child subgraphs
      const childSgIds = subgraphChildren.get(subgraph.id) || []
      for (const childId of childSgIds) {
        const childSg = subgraphMap.get(childId)
        if (childSg) {
          childNodes.push(createSubgraphNode(childSg))
        }
      }

      // Add HA virtual nodes that belong to this subgraph
      for (const [virtualId, info] of haVirtualNodes) {
        if (virtualNodeParent.get(virtualId) === subgraph.id) {
          childNodes.push(createHAVirtualElkNode(info))
        }
      }

      // Add regular nodes in this subgraph (skip nodes in HA pairs)
      for (const node of graph.nodes) {
        if (node.parent === subgraph.id && !nodesInHAPairs.has(node.id)) {
          childNodes.push(createElkNode_(node))
        }
      }

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
    }

    // Build root children
    const rootChildren: ElkNode[] = []

    // Add root-level subgraphs
    for (const sg of subgraphMap.values()) {
      if (!sg.parent || !subgraphMap.has(sg.parent)) {
        rootChildren.push(createSubgraphNode(sg))
      }
    }

    // Add root-level HA virtual nodes
    for (const [virtualId, info] of haVirtualNodes) {
      if (!virtualNodeParent.get(virtualId) || !subgraphMap.has(virtualNodeParent.get(virtualId)!)) {
        rootChildren.push(createHAVirtualElkNode(info))
      }
    }

    // Add root-level nodes (skip nodes in HA pairs)
    for (const node of graph.nodes) {
      if (nodesInHAPairs.has(node.id)) continue
      if (!node.parent || !subgraphMap.has(node.parent)) {
        rootChildren.push(createElkNode_(node))
      }
    }

    // Build edges with redirects for HA nodes
    const edges: ElkExtendedEdge[] = graph.links
      .filter(link => {
        // Skip HA internal links (the link connecting the HA pair nodes themselves)
        const fromId = getNodeId(link.from)
        const toId = getNodeId(link.to)
        for (const pair of haPairs) {
          if ((pair.nodeA === fromId && pair.nodeB === toId) ||
              (pair.nodeA === toId && pair.nodeB === fromId)) {
            return false
          }
        }
        return true
      })
      .map((link, index) => {
        const fromEndpoint = toEndpoint(link.from)
        const toEndpoint_ = toEndpoint(link.to)

        // Redirect endpoints if they're in HA pairs (preserve port names)
        let sourceId: string
        let targetId: string

        const fromRedirect = edgeRedirect.get(fromEndpoint.node)
        const toRedirect = edgeRedirect.get(toEndpoint_.node)

        if (fromRedirect) {
          // Redirect to virtual node, preserving port name if any
          if (fromEndpoint.port) {
            sourceId = `${fromRedirect.virtualId}:${fromRedirect.side}:${fromEndpoint.port}`
          } else {
            sourceId = `${fromRedirect.virtualId}:${fromRedirect.side}`
          }
        } else if (fromEndpoint.port) {
          sourceId = `${fromEndpoint.node}:${fromEndpoint.port}`
        } else {
          sourceId = fromEndpoint.node
        }

        if (toRedirect) {
          // Redirect to virtual node, preserving port name if any
          if (toEndpoint_.port) {
            targetId = `${toRedirect.virtualId}:${toRedirect.side}:${toEndpoint_.port}`
          } else {
            targetId = `${toRedirect.virtualId}:${toRedirect.side}`
          }
        } else if (toEndpoint_.port) {
          targetId = `${toEndpoint_.node}:${toEndpoint_.port}`
        } else {
          targetId = toEndpoint_.node
        }

        const edge: ElkExtendedEdge = {
          id: link.id || `edge-${index}`,
          sources: [sourceId],
          targets: [targetId],
        }

        // Build label
        const labelParts: string[] = []
        if (link.label) {
          labelParts.push(Array.isArray(link.label) ? link.label.join(' / ') : link.label)
        }
        if (fromEndpoint.ip) labelParts.push(fromEndpoint.ip)
        if (toEndpoint_.ip) labelParts.push(toEndpoint_.ip)

        if (labelParts.length > 0) {
          edge.labels = [{
            text: labelParts.join('\n'),
            layoutOptions: { 'elk.edgeLabels.placement': 'CENTER' }
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
      'elk.spacing.edgeNode': '50',
      'elk.spacing.edgeEdge': '20',
      'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
      'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
      'elk.edgeRouting': 'SPLINES',
      'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
    }

    return {
      elkGraph: {
        id: 'root',
        children: rootChildren,
        edges,
        layoutOptions: rootLayoutOptions,
      },
      haVirtualNodes,
    }
  }

  /**
   * Extract layout result and expand HA virtual nodes back to original pairs
   */
  private extractLayoutResultWithHAExpand(
    graph: NetworkGraphV2,
    elkGraph: ElkNode,
    haVirtualNodes: Map<string, { virtualId: string; nodeA: Node; nodeB: Node; gap: number; widthA: number; widthB: number; height: number }>,
    _options: Required<HierarchicalLayoutOptions>
  ): LayoutResult {
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

      // Check if this is an HA virtual node
      const haInfo = haVirtualNodes.get(elkNode.id)
      if (haInfo) {
        // Expand virtual node back to original pair
        // Position nodeA on the left, nodeB on the right
        const heightA = this.calculateNodeHeight(haInfo.nodeA)
        const heightB = this.calculateNodeHeight(haInfo.nodeB)

        const nodeAX = x + haInfo.widthA / 2
        const nodeBX = x + haInfo.widthA + haInfo.gap + haInfo.widthB / 2
        const centerY = y + height / 2

        // Create layout nodes for A and B
        const layoutNodeA: LayoutNode = {
          id: haInfo.nodeA.id,
          position: { x: nodeAX, y: centerY },
          size: { width: haInfo.widthA, height: heightA },
          node: haInfo.nodeA,
        }

        const layoutNodeB: LayoutNode = {
          id: haInfo.nodeB.id,
          position: { x: nodeBX, y: centerY },
          size: { width: haInfo.widthB, height: heightB },
          node: haInfo.nodeB,
        }

        // For HA nodes, calculate port positions ourselves
        // We need to determine which ports are for incoming vs outgoing edges
        // Build maps of ports for each node (A and B), grouped by edge direction
        const portsForATop: { name: string; portW: number; portH: number }[] = []
        const portsForABottom: { name: string; portW: number; portH: number }[] = []
        const portsForARight: { name: string; portW: number; portH: number }[] = []  // For HA link (facing B)
        const portsForBTop: { name: string; portW: number; portH: number }[] = []
        const portsForBBottom: { name: string; portW: number; portH: number }[] = []
        const portsForBLeft: { name: string; portW: number; portH: number }[] = []   // For HA link (facing A)

        // Analyze links to determine port direction
        for (const link of graph.links) {
          const fromEndpoint = toEndpoint(link.from)
          const toEndpoint_ = toEndpoint(link.to)

          // HA internal link - ports go on inner sides (A's right, B's left)
          if (link.redundancy) {
            if (fromEndpoint.node === haInfo.nodeA.id && fromEndpoint.port) {
              portsForARight.push({ name: fromEndpoint.port, portW: PORT_WIDTH, portH: PORT_HEIGHT })
            }
            if (toEndpoint_.node === haInfo.nodeA.id && toEndpoint_.port) {
              portsForARight.push({ name: toEndpoint_.port, portW: PORT_WIDTH, portH: PORT_HEIGHT })
            }
            if (fromEndpoint.node === haInfo.nodeB.id && fromEndpoint.port) {
              portsForBLeft.push({ name: fromEndpoint.port, portW: PORT_WIDTH, portH: PORT_HEIGHT })
            }
            if (toEndpoint_.node === haInfo.nodeB.id && toEndpoint_.port) {
              portsForBLeft.push({ name: toEndpoint_.port, portW: PORT_WIDTH, portH: PORT_HEIGHT })
            }
            continue
          }

          // Check if this link involves nodeA
          if (fromEndpoint.node === haInfo.nodeA.id && fromEndpoint.port) {
            // Outgoing from A → bottom
            portsForABottom.push({ name: fromEndpoint.port, portW: PORT_WIDTH, portH: PORT_HEIGHT })
          }
          if (toEndpoint_.node === haInfo.nodeA.id && toEndpoint_.port) {
            // Incoming to A → top
            portsForATop.push({ name: toEndpoint_.port, portW: PORT_WIDTH, portH: PORT_HEIGHT })
          }

          // Check if this link involves nodeB
          if (fromEndpoint.node === haInfo.nodeB.id && fromEndpoint.port) {
            // Outgoing from B → bottom
            portsForBBottom.push({ name: fromEndpoint.port, portW: PORT_WIDTH, portH: PORT_HEIGHT })
          }
          if (toEndpoint_.node === haInfo.nodeB.id && toEndpoint_.port) {
            // Incoming to B → top
            portsForBTop.push({ name: toEndpoint_.port, portW: PORT_WIDTH, portH: PORT_HEIGHT })
          }
        }

        // Distribute ports on an edge (top/bottom/left/right) - ports placed OUTSIDE the node
        const distributePortsOnEdge = (
          portsList: { name: string; portW: number; portH: number }[],
          nodeWidth: number,
          nodeHeight: number,
          nodeId: string,
          side: 'top' | 'bottom' | 'left' | 'right'
        ): Map<string, { id: string; label: string; position: Position; size: { width: number; height: number }; side: 'top' | 'bottom' | 'left' | 'right' }> => {
          const result = new Map<string, { id: string; label: string; position: Position; size: { width: number; height: number }; side: 'top' | 'bottom' | 'left' | 'right' }>()
          if (portsList.length === 0) return result

          portsList.forEach((p, i) => {
            let relX: number
            let relY: number

            if (side === 'top' || side === 'bottom') {
              // Horizontal distribution along top/bottom edge
              const portSpacing = nodeWidth / (portsList.length + 1)
              relX = portSpacing * (i + 1) - nodeWidth / 2
              // Place port completely outside the node
              relY = side === 'top'
                ? -nodeHeight / 2 - p.portH / 2  // Above the node
                : nodeHeight / 2 + p.portH / 2   // Below the node
            } else {
              // Vertical distribution along left/right edge
              const portSpacing = nodeHeight / (portsList.length + 1)
              relY = portSpacing * (i + 1) - nodeHeight / 2
              // Place port completely outside the node
              relX = side === 'left'
                ? -nodeWidth / 2 - p.portW / 2   // Left of the node
                : nodeWidth / 2 + p.portW / 2    // Right of the node
            }

            const originalPortId = `${nodeId}:${p.name}`
            result.set(originalPortId, {
              id: originalPortId,
              label: p.name,
              position: { x: relX, y: relY },
              size: { width: p.portW, height: p.portH },
              side,
            })
          })
          return result
        }

        // Create port maps for A and B
        // For nodeA (left side of HA pair): ports should be positioned toward the inner side (right)
        // For nodeB (right side of HA pair): ports should be positioned toward the inner side (left)
        // This reduces line crossings when connecting to centered nodes below/above
        const portsMapA = new Map<string, { id: string; label: string; position: Position; size: { width: number; height: number }; side: 'top' | 'bottom' | 'left' | 'right' }>()
        // For nodeA: reverse the port order so inner ports (right side) come first
        const topPortsA = distributePortsOnEdge([...portsForATop].reverse(), haInfo.widthA, heightA, haInfo.nodeA.id, 'top')
        const bottomPortsA = distributePortsOnEdge([...portsForABottom].reverse(), haInfo.widthA, heightA, haInfo.nodeA.id, 'bottom')
        const rightPortsA = distributePortsOnEdge(portsForARight, haInfo.widthA, heightA, haInfo.nodeA.id, 'right')
        for (const [k, v] of topPortsA) portsMapA.set(k, v)
        for (const [k, v] of bottomPortsA) portsMapA.set(k, v)
        for (const [k, v] of rightPortsA) portsMapA.set(k, v)

        const portsMapB = new Map<string, { id: string; label: string; position: Position; size: { width: number; height: number }; side: 'top' | 'bottom' | 'left' | 'right' }>()
        // For nodeB: keep normal order so inner ports (left side) come first
        const topPortsB = distributePortsOnEdge(portsForBTop, haInfo.widthB, heightB, haInfo.nodeB.id, 'top')
        const bottomPortsB = distributePortsOnEdge(portsForBBottom, haInfo.widthB, heightB, haInfo.nodeB.id, 'bottom')
        const leftPortsB = distributePortsOnEdge(portsForBLeft, haInfo.widthB, heightB, haInfo.nodeB.id, 'left')
        for (const [k, v] of topPortsB) portsMapB.set(k, v)
        for (const [k, v] of bottomPortsB) portsMapB.set(k, v)
        for (const [k, v] of leftPortsB) portsMapB.set(k, v)

        if (portsMapA.size > 0) layoutNodeA.ports = portsMapA
        if (portsMapB.size > 0) layoutNodeB.ports = portsMapB

        layoutNodes.set(haInfo.nodeA.id, layoutNodeA)
        layoutNodes.set(haInfo.nodeB.id, layoutNodeB)
      } else if (subgraphMap.has(elkNode.id)) {
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
          const layoutNode: LayoutNode = {
            id: elkNode.id,
            position: { x: x + width / 2, y: y + height / 2 },
            size: { width, height },
            node,
          }

          // Extract port positions if any
          // Note: Ports will be repositioned by reorderPortsByConnectedNodePositions later
          if (elkNode.ports && elkNode.ports.length > 0) {
            layoutNode.ports = new Map()
            for (const elkPort of elkNode.ports) {
              const portX = (elkPort.x ?? 0)
              const portY = (elkPort.y ?? 0)
              const portW = elkPort.width ?? PORT_WIDTH
              const portH = elkPort.height ?? PORT_HEIGHT

              // Determine which side based on ELK position
              let side: 'top' | 'bottom' | 'left' | 'right' = 'bottom'
              if (portY <= portH) side = 'top'
              else if (portY >= height - portH * 2) side = 'bottom'
              else if (portX <= portW) side = 'left'
              else if (portX >= width - portW * 2) side = 'right'

              const portName = elkPort.id.includes(':')
                ? elkPort.id.split(':').slice(1).join(':')
                : elkPort.id

              // Calculate position outside the node edge
              let relX: number
              let relY: number
              if (side === 'top') {
                relX = portX - width / 2 + portW / 2
                relY = -height / 2 - portH / 2
              } else if (side === 'bottom') {
                relX = portX - width / 2 + portW / 2
                relY = height / 2 + portH / 2
              } else if (side === 'left') {
                relX = -width / 2 - portW / 2
                relY = portY - height / 2 + portH / 2
              } else {
                relX = width / 2 + portW / 2
                relY = portY - height / 2 + portH / 2
              }

              layoutNode.ports.set(elkPort.id, {
                id: elkPort.id,
                label: portName,
                position: { x: relX, y: relY },
                size: { width: portW, height: portH },
                side,
              })
            }
          }

          layoutNodes.set(elkNode.id, layoutNode)
        }
      }
    }

    // Process root children
    if (elkGraph.children) {
      for (const child of elkGraph.children) {
        processElkNode(child, 0, 0)
      }
    }

    // Post-process: reorder ports based on connected node positions to minimize crossings
    this.reorderPortsByConnectedNodePositions(graph, layoutNodes)

    // Calculate edges based on extracted node positions
    graph.links.forEach((link, index) => {
      const id = link.id || `link-${index}`
      const fromEndpoint_ = toEndpoint(link.from)
      const toEndpoint_ = toEndpoint(link.to)
      const fromId = fromEndpoint_.node
      const toId = toEndpoint_.node
      const fromNode = layoutNodes.get(fromId)
      const toNode = layoutNodes.get(toId)

      if (!fromNode || !toNode) return

      // Get port positions if specified
      const fromPortId = fromEndpoint_.port ? `${fromId}:${fromEndpoint_.port}` : undefined
      const toPortId = toEndpoint_.port ? `${toId}:${toEndpoint_.port}` : undefined
      const fromPort = fromPortId ? fromNode.ports?.get(fromPortId) : undefined
      const toPort = toPortId ? toNode.ports?.get(toPortId) : undefined

      const points = this.calculateEdgePathWithPorts(fromNode, toNode, fromPort, toPort)

      layoutLinks.set(id, {
        id,
        from: fromId,
        to: toId,
        fromEndpoint: fromEndpoint_,
        toEndpoint: toEndpoint_,
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
   * Reorder ports on each node based on connected node positions to minimize edge crossings
   */
  private reorderPortsByConnectedNodePositions(
    graph: NetworkGraphV2,
    layoutNodes: Map<string, LayoutNode>
  ): void {
    // Build a map of port -> connected node position
    // For each port, find the node it connects to and get that node's position
    const portConnections = new Map<string, { connectedNodeId: string; isOutgoing: boolean }>()

    for (const link of graph.links) {
      const fromEndpoint = toEndpoint(link.from)
      const toEndpoint_ = toEndpoint(link.to)

      // From port connects to "to" node
      if (fromEndpoint.port) {
        const portId = `${fromEndpoint.node}:${fromEndpoint.port}`
        portConnections.set(portId, { connectedNodeId: toEndpoint_.node, isOutgoing: true })
      }

      // To port connects to "from" node
      if (toEndpoint_.port) {
        const portId = `${toEndpoint_.node}:${toEndpoint_.port}`
        portConnections.set(portId, { connectedNodeId: fromEndpoint.node, isOutgoing: false })
      }
    }

    // For each node, reorder its ports based on connected node positions
    layoutNodes.forEach((layoutNode) => {
      if (!layoutNode.ports || layoutNode.ports.size === 0) return

      // Group ports by side
      const portsBySide = new Map<string, { portId: string; port: typeof layoutNode.ports extends Map<string, infer V> ? V : never }[]>()

      layoutNode.ports.forEach((port, portId) => {
        const side = port.side
        if (!portsBySide.has(side)) {
          portsBySide.set(side, [])
        }
        portsBySide.get(side)!.push({ portId, port })
      })

      // Sort and redistribute ports on each side
      portsBySide.forEach((ports, side) => {
        if (ports.length <= 1) return // No need to reorder single port

        // Sort ports by connected node position
        ports.sort((a, b) => {
          const connA = portConnections.get(a.portId)
          const connB = portConnections.get(b.portId)
          if (!connA || !connB) return 0

          const nodeA = layoutNodes.get(connA.connectedNodeId)
          const nodeB = layoutNodes.get(connB.connectedNodeId)
          if (!nodeA || !nodeB) return 0

          // For top/bottom sides, sort by X position (left to right)
          if (side === 'top' || side === 'bottom') {
            return nodeA.position.x - nodeB.position.x
          }
          // For left/right sides, sort by Y position (top to bottom)
          return nodeA.position.y - nodeB.position.y
        })

        // Redistribute port positions along the edge (ports placed OUTSIDE the node)
        const nodeWidth = layoutNode.size.width
        const nodeHeight = layoutNode.size.height

        if (side === 'top' || side === 'bottom') {
          const portSpacing = nodeWidth / (ports.length + 1)
          ports.forEach((p, i) => {
            const relX = portSpacing * (i + 1) - nodeWidth / 2
            // Place port completely outside the node edge
            const relY = side === 'top'
              ? -nodeHeight / 2 - p.port.size.height / 2  // Above the node
              : nodeHeight / 2 + p.port.size.height / 2   // Below the node
            p.port.position = { x: relX, y: relY }
          })
        } else {
          const portSpacing = nodeHeight / (ports.length + 1)
          ports.forEach((p, i) => {
            const relY = portSpacing * (i + 1) - nodeHeight / 2
            // Place port completely outside the node edge
            const relX = side === 'left'
              ? -nodeWidth / 2 - p.port.size.width / 2   // Left of the node
              : nodeWidth / 2 + p.port.size.width / 2    // Right of the node
            p.port.position = { x: relX, y: relY }
          })
        }
      })
    })
  }

  // Synchronous wrapper that runs async internally
  layout(graph: NetworkGraphV2): LayoutResult {
    // For sync compatibility, we need to run layout synchronously
    // This is a simplified version - ideally use layoutAsync for full HA support
    const effectiveOptions = this.getEffectiveOptions(graph)
    const direction = effectiveOptions.direction
    const haPairs = this.detectHAPairs(graph)

    // Build ELK graph with HA merge (same as async)
    const { elkGraph, haVirtualNodes } = this.buildElkGraphWithHAMerge(
      graph, direction, effectiveOptions, haPairs
    )

    // Run synchronous layout using elk's sync API
    let result: LayoutResult

    // Use a workaround: pre-calculate positions based on structure
    result = this.calculateFallbackLayout(graph, direction)

    // Start async layout and update when done (for future renders)
    this.elk.layout(elkGraph).then((layoutedGraph: ElkNode) => {
      // This will be available for next render
      Object.assign(result, this.extractLayoutResultWithHAExpand(
        graph, layoutedGraph, haVirtualNodes, effectiveOptions
      ))
    }).catch(() => {
      // Keep fallback layout
    })

    return result
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

  /**
   * Calculate edge path using port positions when available
   * Port positions are from ELK - lines connect FROM the ports
   */
  private calculateEdgePathWithPorts(
    fromNode: LayoutNode,
    toNode: LayoutNode,
    fromPort?: { position: Position; side: string },
    toPort?: { position: Position; side: string }
  ): Position[] {
    // Use port positions from ELK (lines come FROM ports)
    let fromPoint: Position
    let fromSide: string

    if (fromPort) {
      // Line starts from port position
      fromPoint = {
        x: fromNode.position.x + fromPort.position.x,
        y: fromNode.position.y + fromPort.position.y,
      }
      fromSide = fromPort.side
    } else {
      // No port - calculate edge position based on target node direction
      const dx = toNode.position.x - fromNode.position.x
      const dy = toNode.position.y - fromNode.position.y
      const halfW = fromNode.size.width / 2
      const halfH = fromNode.size.height / 2

      if (Math.abs(dx) > Math.abs(dy) * 0.5) {
        fromSide = dx > 0 ? 'right' : 'left'
        fromPoint = {
          x: fromNode.position.x + (dx > 0 ? halfW : -halfW),
          y: fromNode.position.y,
        }
      } else {
        fromSide = dy > 0 ? 'bottom' : 'top'
        fromPoint = {
          x: fromNode.position.x,
          y: fromNode.position.y + (dy > 0 ? halfH : -halfH),
        }
      }
    }

    let toPoint: Position
    let toSide: string

    if (toPort) {
      // Line ends at port position
      toPoint = {
        x: toNode.position.x + toPort.position.x,
        y: toNode.position.y + toPort.position.y,
      }
      toSide = toPort.side
    } else {
      // No port - calculate edge position based on source node direction
      const dx = fromNode.position.x - toNode.position.x
      const dy = fromNode.position.y - toNode.position.y
      const halfW = toNode.size.width / 2
      const halfH = toNode.size.height / 2

      if (Math.abs(dx) > Math.abs(dy) * 0.5) {
        toSide = dx > 0 ? 'right' : 'left'
        toPoint = {
          x: toNode.position.x + (dx > 0 ? halfW : -halfW),
          y: toNode.position.y,
        }
      } else {
        toSide = dy > 0 ? 'bottom' : 'top'
        toPoint = {
          x: toNode.position.x,
          y: toNode.position.y + (dy > 0 ? halfH : -halfH),
        }
      }
    }

    // Calculate bezier control points based on port sides
    const dx = toPoint.x - fromPoint.x
    const dy = toPoint.y - fromPoint.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    const controlDist = Math.min(dist * 0.4, 80)

    const fromControl = this.getControlPointForSide(fromPoint, fromSide, controlDist)
    const toControl = this.getControlPointForSide(toPoint, toSide, controlDist)

    return [fromPoint, fromControl, toControl, toPoint]
  }

  /**
   * Get control point position based on port side
   */
  private getControlPointForSide(point: Position, side: string, dist: number): Position {
    switch (side) {
      case 'top':
        return { x: point.x, y: point.y - Math.abs(dist) }
      case 'bottom':
        return { x: point.x, y: point.y + Math.abs(dist) }
      case 'left':
        return { x: point.x - Math.abs(dist), y: point.y }
      case 'right':
        return { x: point.x + Math.abs(dist), y: point.y }
      default:
        return { x: point.x, y: point.y + dist }
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

      // Skip HA links (already handled by two-pass layout with layerChoiceConstraint)
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

    // Calculate edge paths with offset - prefer port positions when available
    result.links.forEach((layoutLink, linkId) => {
      const fromNode = result.nodes.get(layoutLink.from)
      const toNode = result.nodes.get(layoutLink.to)

      if (fromNode && toNode) {
        // Check if this link uses ports
        const fromPortId = layoutLink.fromEndpoint.port
          ? `${layoutLink.from}:${layoutLink.fromEndpoint.port}`
          : undefined
        const toPortId = layoutLink.toEndpoint.port
          ? `${layoutLink.to}:${layoutLink.toEndpoint.port}`
          : undefined
        const fromPort = fromPortId ? fromNode.ports?.get(fromPortId) : undefined
        const toPort = toPortId ? toNode.ports?.get(toPortId) : undefined

        if (fromPort || toPort) {
          // Use port-aware edge calculation
          layoutLink.points = this.calculateEdgePathWithPorts(fromNode, toNode, fromPort, toPort)
        } else {
          // No ports - use offset-based calculation
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
