// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * ELK Placement Engine
 *
 * Uses ELK.js (layered algorithm) for node placement only.
 * Edge routing is deliberately discarded - use a RoutingEngine instead.
 *
 * This adapter extracts node/subgraph positions from ELK output
 * and produces a PlacementResult that any RoutingEngine can consume.
 */

import ELK, {
  type ElkExtendedEdge,
  type ElkNode,
} from 'elkjs/lib/elk.bundled.js'
import {
  CHAR_WIDTH_RATIO,
  DEFAULT_ICON_SIZE,
  ESTIMATED_CHAR_WIDTH,
  getDeviceIcon,
  ICON_LABEL_GAP,
  LABEL_LINE_HEIGHT,
  MIN_PORT_SPACING,
  NODE_HORIZONTAL_PADDING,
  NODE_VERTICAL_PADDING,
  PORT_LABEL_FONT_SIZE,
  PORT_LABEL_PADDING,
  type IconDimensions,
  type LayoutDirection,
  type Link,
  type LinkEndpoint,
  type NetworkGraph,
  type Node,
  type Subgraph,
} from '@shumoku/core'
import type {
  PlacedNode,
  PlacedPort,
  PlacedSubgraph,
  PlacementEngine,
  PlacementOptions,
  PlacementResult,
} from '../types.js'

// ============================================
// Constants
// ============================================

const PORT_WIDTH = 8
const PORT_HEIGHT = 8

const DEFAULT_NODE_HEIGHT = 60
const DEFAULT_SUBGRAPH_LABEL_HEIGHT = 24

// ============================================
// Helpers
// ============================================

function toEndpoint(endpoint: string | LinkEndpoint): LinkEndpoint {
  if (typeof endpoint === 'string') return { node: endpoint }
  if ('pin' in endpoint && endpoint.pin) {
    return { node: endpoint.node, port: endpoint.pin, ip: endpoint.ip }
  }
  return endpoint
}

function getNodeId(endpoint: string | LinkEndpoint): string {
  return typeof endpoint === 'string' ? endpoint : endpoint.node
}

function resolvePartition(rank: number | string | undefined): number | undefined {
  if (rank === undefined) return undefined
  const n = typeof rank === 'string' ? Number.parseInt(rank, 10) : rank
  return Number.isNaN(n) ? undefined : n
}

interface NodePortInfo {
  all: Set<string>
  top: Set<string>
  bottom: Set<string>
  left: Set<string>
  right: Set<string>
}

function collectNodePorts(graph: NetworkGraph, haPairSet: Set<string>): Map<string, NodePortInfo> {
  const nodePorts = new Map<string, NodePortInfo>()

  const getOrCreate = (nodeId: string): NodePortInfo => {
    if (!nodePorts.has(nodeId)) {
      nodePorts.set(nodeId, {
        all: new Set(),
        top: new Set(),
        bottom: new Set(),
        left: new Set(),
        right: new Set(),
      })
    }
    return nodePorts.get(nodeId)!
  }

  const isHALink = (fromNode: string, toNode: string): boolean => {
    const key = [fromNode, toNode].sort().join(':')
    return haPairSet.has(key)
  }

  for (const link of graph.links) {
    const from = toEndpoint(link.from)
    const to = toEndpoint(link.to)

    if (link.redundancy && isHALink(from.node, to.node)) {
      const fromPortName = from.port || 'ha'
      const toPortName = to.port || 'ha'
      const fromInfo = getOrCreate(from.node)
      fromInfo.all.add(fromPortName)
      fromInfo.right.add(fromPortName)
      const toInfo = getOrCreate(to.node)
      toInfo.all.add(toPortName)
      toInfo.left.add(toPortName)
    } else {
      if (from.port) {
        const info = getOrCreate(from.node)
        info.all.add(from.port)
        info.bottom.add(from.port)
      }
      if (to.port) {
        const info = getOrCreate(to.node)
        info.all.add(to.port)
        info.top.add(to.port)
      }
    }
  }

  return nodePorts
}

function getBandwidthStrokeWidth(bandwidth?: string): number {
  switch (bandwidth) {
    case '1G': return 6
    case '10G': return 10
    case '25G': return 14
    case '40G': return 18
    case '100G': return 24
    default: return 0
  }
}

function getLinkStrokeWidthForLayout(link: Link): number {
  const styleWidth = link.style?.strokeWidth ?? 0
  const bandwidthWidth = getBandwidthStrokeWidth(link.bandwidth)
  const typeWidth = link.type === 'thick' ? 3 : link.type === 'double' ? 2 : 2
  return Math.max(2, styleWidth, bandwidthWidth, typeWidth)
}

// ============================================
// ELK Placement Engine
// ============================================

export class ElkPlacement implements PlacementEngine {
  private elk: InstanceType<typeof ELK>
  private iconDimensions: Map<string, IconDimensions>

  constructor(options?: { elk?: InstanceType<typeof ELK> }) {
    this.elk = options?.elk ?? new ELK()
    this.iconDimensions = new Map()
  }

  async place(graph: NetworkGraph, options?: PlacementOptions): Promise<PlacementResult> {
    const startTime = performance.now()

    this.iconDimensions = options?.iconDimensions ?? new Map()

    const direction = options?.direction ?? graph.settings?.direction ?? 'TB'
    const nodeSpacing = options?.nodeSpacing ?? this.calculateDynamicSpacing(graph).nodeSpacing
    const rankSpacing = options?.rankSpacing ?? this.calculateDynamicSpacing(graph).rankSpacing
    const subgraphPadding = options?.subgraphPadding ?? this.calculateDynamicSpacing(graph).subgraphPadding

    // Detect HA pairs
    const haPairs = this.detectHAPairs(graph)
    const haPairSet = new Set<string>()
    for (const pair of haPairs) {
      haPairSet.add([pair.nodeA, pair.nodeB].sort().join(':'))
    }

    const nodePorts = collectNodePorts(graph, haPairSet)
    const spacing = this.getSpacingConstraints(graph)

    // Build ELK graph (with ORTHOGONAL routing - best for node placement)
    const elkGraph = this.buildElkGraph(graph, {
      direction,
      nodeSpacing,
      rankSpacing,
      subgraphPadding,
      nodePorts,
      haPairs,
      spacing,
      fixedPositions: options?.fixedPositions,
    })

    // Run ELK
    const layouted = await this.runElkLayout(elkGraph)

    // Extract only positions (discard edge routing)
    const result = this.extractPlacement(graph, layouted, nodePorts)

    result.metadata = {
      algorithm: 'elk-layered',
      duration: performance.now() - startTime,
    }

    return result
  }

  // ============================================
  // ELK Graph Building
  // ============================================

  private buildElkGraph(
    graph: NetworkGraph,
    ctx: {
      direction: LayoutDirection
      nodeSpacing: number
      rankSpacing: number
      subgraphPadding: number
      nodePorts: Map<string, NodePortInfo>
      haPairs: { nodeA: string; nodeB: string }[]
      spacing: { minEdgeGap: number; maxLinkStrokeWidth: number; portSpacingMin: number }
      fixedPositions?: Map<string, { x: number; y: number }>
    },
  ): ElkNode {
    const elkDirection = toElkDirection(ctx.direction)
    const hasRankedNodes = graph.nodes.some((n) => n.rank !== undefined)

    const subgraphMap = new Map<string, Subgraph>()
    for (const sg of graph.subgraphs ?? []) {
      subgraphMap.set(sg.id, sg)
    }

    // HA container tracking
    const nodeToHAContainer = new Map<string, string>()
    const haPairMap = new Map<string, { nodeA: string; nodeB: string }>()
    for (const [idx, pair] of ctx.haPairs.entries()) {
      const containerId = `__ha_container_${idx}`
      nodeToHAContainer.set(pair.nodeA, containerId)
      nodeToHAContainer.set(pair.nodeB, containerId)
      haPairMap.set(containerId, pair)
    }

    const haPairSet = new Set<string>()
    for (const pair of ctx.haPairs) {
      haPairSet.add([pair.nodeA, pair.nodeB].sort().join(':'))
    }

    const addedHAContainers = new Set<string>()

    // Create ELK node from graph node
    const createElkNode = (node: Node): ElkNode => {
      const portInfo = ctx.nodePorts.get(node.id)
      const height = this.calculateNodeHeight(node, portInfo?.all.size ?? 0)
      const width = this.calculateNodeWidth(node, portInfo, ctx.spacing.portSpacingMin)

      const elkNode: ElkNode = {
        id: node.id,
        width,
        height,
        labels: [{ text: Array.isArray(node.label) ? node.label.join('\n') : node.label }],
      }

      // Fixed position
      if (ctx.fixedPositions?.has(node.id)) {
        const pos = ctx.fixedPositions.get(node.id)!
        elkNode.x = pos.x - width / 2
        elkNode.y = pos.y - height / 2
        elkNode.layoutOptions = {
          ...elkNode.layoutOptions,
          'elk.position': `(${elkNode.x},${elkNode.y})`,
          'elk.nodeSize.constraints': 'PORTS NODE_LABELS MINIMUM_SIZE',
        }
      }

      // Rank partitioning
      const partition = resolvePartition(node.rank)
      if (hasRankedNodes && partition !== undefined) {
        elkNode.layoutOptions = {
          ...elkNode.layoutOptions,
          'elk.partitioning.partition': String(partition),
        }
      }

      // Add ports
      if (portInfo && portInfo.all.size > 0) {
        elkNode.ports = this.buildElkPorts(portInfo, width, height, node.id, ctx.spacing.portSpacingMin)
        elkNode.layoutOptions = {
          ...elkNode.layoutOptions,
          'elk.portConstraints': 'FIXED_POS',
          'elk.spacing.portPort': String(ctx.spacing.portSpacingMin),
        }
      }

      return elkNode
    }

    // Create HA container
    const createHAContainer = (containerId: string, pair: { nodeA: string; nodeB: string }): ElkNode | null => {
      const nodeA = graph.nodes.find((n) => n.id === pair.nodeA)
      const nodeB = graph.nodes.find((n) => n.id === pair.nodeB)
      if (!nodeA || !nodeB) return null

      const haLink = graph.links.find((link) => {
        if (!link.redundancy) return false
        const from = toEndpoint(link.from)
        const to = toEndpoint(link.to)
        return [from.node, to.node].sort().join(':') === [pair.nodeA, pair.nodeB].sort().join(':')
      })

      const haEdges: ElkExtendedEdge[] = []
      if (haLink) {
        const from = toEndpoint(haLink.from)
        const to = toEndpoint(haLink.to)
        haEdges.push({
          id: haLink.id || `ha-edge-${containerId}`,
          sources: [`${from.node}:${from.port || 'ha'}`],
          targets: [`${to.node}:${to.port || 'ha'}`],
        })
      }

      return {
        id: containerId,
        children: [createElkNode(nodeA), createElkNode(nodeB)],
        edges: haEdges,
        layoutOptions: {
          'elk.algorithm': 'layered',
          'elk.direction': 'RIGHT',
          'elk.spacing.nodeNode': '40',
          'elk.padding': '[top=0,left=0,bottom=0,right=0]',
          'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
          'elk.edgeRouting': 'POLYLINE',
          'org.eclipse.elk.json.shapeCoords': 'ROOT',
        },
      }
    }

    // Edge spacing
    const edgeNodeSpacing = Math.max(10, Math.round(ctx.nodeSpacing * 0.4))
    const edgeEdgeSpacing = Math.max(
      8,
      Math.round(ctx.nodeSpacing * 0.25),
      Math.round(ctx.spacing.maxLinkStrokeWidth + ctx.spacing.minEdgeGap),
    )

    // Build subgraph nodes recursively
    const createSubgraphNode = (
      subgraph: Subgraph,
      edgesByContainer: Map<string, ElkExtendedEdge[]>,
    ): ElkNode => {
      const children: ElkNode[] = []

      for (const childSg of subgraphMap.values()) {
        if (childSg.parent === subgraph.id) {
          children.push(createSubgraphNode(childSg, edgesByContainer))
        }
      }

      for (const node of graph.nodes) {
        if (node.parent === subgraph.id) {
          const containerId = nodeToHAContainer.get(node.id)
          if (containerId) {
            if (!addedHAContainers.has(containerId)) {
              addedHAContainers.add(containerId)
              const pair = haPairMap.get(containerId)
              if (pair) {
                const container = createHAContainer(containerId, pair)
                if (container) children.push(container)
              }
            }
          } else {
            children.push(createElkNode(node))
          }
        }
      }

      const sgPadding = subgraph.style?.padding ?? ctx.subgraphPadding
      const sgDirection = subgraph.direction ? toElkDirection(subgraph.direction) : elkDirection
      const hasFileRef = !!subgraph.file

      const elkNode: ElkNode = {
        id: subgraph.id,
        labels: [{ text: subgraph.label }],
        children,
        edges: edgesByContainer.get(subgraph.id) ?? [],
        layoutOptions: {
          'elk.algorithm': 'layered',
          'elk.direction': sgDirection,
          'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
          'elk.padding': `[top=${sgPadding + DEFAULT_SUBGRAPH_LABEL_HEIGHT},left=${sgPadding},bottom=${sgPadding},right=${sgPadding}]`,
          'elk.spacing.nodeNode': String(ctx.nodeSpacing),
          'elk.layered.spacing.nodeNodeBetweenLayers': String(ctx.rankSpacing),
          'elk.spacing.edgeNode': String(edgeNodeSpacing),
          'elk.spacing.edgeEdge': String(edgeEdgeSpacing),
          // Always use ORTHOGONAL for best node placement
          'elk.edgeRouting': 'ORTHOGONAL',
          ...(hasRankedNodes && { 'elk.partitioning.activate': 'true' }),
          'org.eclipse.elk.json.shapeCoords': 'ROOT',
        },
      }

      if (hasFileRef && children.length === 0) {
        elkNode.width = 200
        elkNode.height = 100
      }

      return elkNode
    }

    // Build node parent map for LCA
    const nodeParentMap = new Map<string, string | undefined>()
    for (const node of graph.nodes) {
      nodeParentMap.set(node.id, node.parent)
    }
    for (const sg of subgraphMap.values()) {
      nodeParentMap.set(sg.id, sg.parent)
    }

    const findLCA = (nodeA: string, nodeB: string): string | undefined => {
      const ancestorsA = new Set<string | undefined>()
      let current: string | undefined = nodeA
      while (current) {
        ancestorsA.add(current)
        current = nodeParentMap.get(current)
      }
      ancestorsA.add(undefined)

      current = nodeB
      while (current !== undefined) {
        if (ancestorsA.has(current)) return current
        current = nodeParentMap.get(current)
      }
      return undefined
    }

    // Group edges by LCA container
    const edgesByContainer = new Map<string, ElkExtendedEdge[]>()
    edgesByContainer.set('root', [])
    for (const sg of subgraphMap.values()) {
      edgesByContainer.set(sg.id, [])
    }

    for (const [index, link] of graph.links.entries()) {
      const from = toEndpoint(link.from)
      const to = toEndpoint(link.to)

      if (link.redundancy && haPairSet.has([from.node, to.node].sort().join(':'))) continue

      const sourceId = from.port ? `${from.node}:${from.port}` : from.node
      const targetId = to.port ? `${to.node}:${to.port}` : to.node

      const edge: ElkExtendedEdge = {
        id: link.id || `edge-${index}`,
        sources: [sourceId],
        targets: [targetId],
      }

      const lca = findLCA(from.node, to.node)
      let container = lca
      if (container === from.node || container === to.node) {
        container = nodeParentMap.get(container)
      }
      const containerId = container && subgraphMap.has(container) ? container : 'root'

      if (!edgesByContainer.has(containerId)) edgesByContainer.set(containerId, [])
      edgesByContainer.get(containerId)!.push(edge)
    }

    // Build root children
    const rootChildren: ElkNode[] = []

    for (const sg of subgraphMap.values()) {
      if (!sg.parent || !subgraphMap.has(sg.parent)) {
        rootChildren.push(createSubgraphNode(sg, edgesByContainer))
      }
    }

    for (const node of graph.nodes) {
      if (!node.parent || !subgraphMap.has(node.parent)) {
        const containerId = nodeToHAContainer.get(node.id)
        if (containerId) {
          if (!addedHAContainers.has(containerId)) {
            addedHAContainers.add(containerId)
            const pair = haPairMap.get(containerId)
            if (pair) {
              const container = createHAContainer(containerId, pair)
              if (container) rootChildren.push(container)
            }
          }
        } else {
          rootChildren.push(createElkNode(node))
        }
      }
    }

    return {
      id: 'root',
      children: rootChildren,
      edges: edgesByContainer.get('root') ?? [],
      layoutOptions: {
        'elk.algorithm': 'layered',
        'elk.direction': elkDirection,
        'elk.spacing.nodeNode': String(ctx.nodeSpacing),
        'elk.layered.spacing.nodeNodeBetweenLayers': String(ctx.rankSpacing),
        'elk.spacing.edgeNode': String(edgeNodeSpacing),
        'elk.spacing.edgeEdge': String(edgeEdgeSpacing),
        'elk.layered.compaction.postCompaction.strategy': 'EDGE_LENGTH',
        'elk.layered.compaction.connectedComponents': 'true',
        'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
        'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
        // Always ORTHOGONAL - we only want good node positions
        'elk.edgeRouting': 'ORTHOGONAL',
        'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
        ...(hasRankedNodes && { 'elk.partitioning.activate': 'true' }),
        'org.eclipse.elk.json.shapeCoords': 'ROOT',
      },
    }
  }

  // ============================================
  // ELK Output Extraction (positions only)
  // ============================================

  private extractPlacement(
    graph: NetworkGraph,
    elkGraph: ElkNode,
    nodePorts: Map<string, NodePortInfo>,
  ): PlacementResult {
    const nodes = new Map<string, PlacedNode>()
    const subgraphs = new Map<string, PlacedSubgraph>()

    const subgraphMap = new Map<string, Subgraph>()
    for (const sg of graph.subgraphs ?? []) {
      subgraphMap.set(sg.id, sg)
    }

    const nodeMap = new Map<string, Node>()
    for (const node of graph.nodes) {
      nodeMap.set(node.id, node)
    }

    const processElkNode = (elkNode: ElkNode): void => {
      const x = elkNode.x ?? 0
      const y = elkNode.y ?? 0
      const width = elkNode.width ?? 0
      const height = elkNode.height ?? 0

      if (subgraphMap.has(elkNode.id)) {
        subgraphs.set(elkNode.id, {
          id: elkNode.id,
          bounds: { x, y, width, height },
          subgraph: subgraphMap.get(elkNode.id)!,
          ports: new Map(),
        })
        for (const child of elkNode.children ?? []) {
          processElkNode(child)
        }
      } else if (elkNode.id.startsWith('__ha_container_')) {
        for (const child of elkNode.children ?? []) {
          processElkNode(child)
        }
      } else if (nodeMap.has(elkNode.id)) {
        const node = nodeMap.get(elkNode.id)!
        const portInfo = nodePorts.get(node.id)
        const nodeHeight = this.calculateNodeHeight(node, portInfo?.all.size ?? 0)

        // Position is center of node
        const position = { x: x + width / 2, y: y + nodeHeight / 2 }

        const ports = new Map<string, PlacedPort>()
        if (elkNode.ports) {
          for (const elkPort of elkNode.ports) {
            const portX = elkPort.x ?? 0
            const portY = elkPort.y ?? 0
            const portW = elkPort.width ?? PORT_WIDTH
            const portH = elkPort.height ?? PORT_HEIGHT

            // Absolute port center
            const absCenterX = x + portX + portW / 2
            const absCenterY = y + portY + portH / 2

            // Determine side
            const distToTop = Math.abs(absCenterY - y)
            const distToBottom = Math.abs(absCenterY - (y + nodeHeight))
            const distToLeft = Math.abs(absCenterX - x)
            const distToRight = Math.abs(absCenterX - (x + width))
            const minDist = Math.min(distToTop, distToBottom, distToLeft, distToRight)
            let side: PlacedPort['side'] = 'bottom'
            if (minDist === distToTop) side = 'top'
            else if (minDist === distToBottom) side = 'bottom'
            else if (minDist === distToLeft) side = 'left'
            else side = 'right'

            const portName = elkPort.id.includes(':')
              ? elkPort.id.split(':').slice(1).join(':')
              : elkPort.id

            ports.set(elkPort.id, {
              id: elkPort.id,
              label: portName,
              position: { x: absCenterX, y: absCenterY },
              size: { width: portW, height: portH },
              side,
            })
          }
        }

        nodes.set(elkNode.id, {
          id: elkNode.id,
          position,
          size: { width, height: nodeHeight },
          node,
          ports,
        })
      }
    }

    for (const child of elkGraph.children ?? []) {
      processElkNode(child)
    }

    const bounds = this.calculateBounds(nodes, subgraphs)

    return { nodes, subgraphs, bounds }
  }

  // ============================================
  // Node Sizing
  // ============================================

  private getIconAspectRatio(node: Node): number | null {
    const iconKey = node.service && node.resource
      ? `${node.service}/${node.resource}`
      : node.service || node.model
    if (!node.vendor || !iconKey) return null

    const dimensionKey = `${node.vendor.toLowerCase()}/${iconKey.toLowerCase().replace(/\//g, '-')}`
    const dims = this.iconDimensions.get(dimensionKey)
    return dims ? dims.width / dims.height : null
  }

  private calculateNodeHeight(node: Node, _portCount: number): number {
    const lines = Array.isArray(node.label) ? node.label.length : 1
    const labelHeight = lines * LABEL_LINE_HEIGHT

    let iconHeight = 0
    if (this.getIconAspectRatio(node) !== null) {
      iconHeight = DEFAULT_ICON_SIZE
    } else if (node.type && getDeviceIcon(node.type)) {
      iconHeight = DEFAULT_ICON_SIZE
    }

    const gap = iconHeight > 0 ? ICON_LABEL_GAP : 0
    return Math.max(DEFAULT_NODE_HEIGHT, iconHeight + gap + labelHeight + NODE_VERTICAL_PADDING)
  }

  private calculateNodeWidth(
    node: Node,
    portInfo: NodePortInfo | undefined,
    portSpacingMin: number,
  ): number {
    const labels = Array.isArray(node.label) ? node.label : [node.label]
    const maxLabelLen = Math.max(...labels.map((l) => l.length))
    const labelWidth = maxLabelLen * ESTIMATED_CHAR_WIDTH

    const topCount = portInfo?.top.size ?? 0
    const bottomCount = portInfo?.bottom.size ?? 0
    const maxPortsPerSide = Math.max(topCount, bottomCount)

    const portSpacing = this.calculatePortSpacing(portInfo?.all, portSpacingMin)
    const edgeMargin = Math.round(portSpacingMin / 2)
    const portWidth = maxPortsPerSide > 0 ? (maxPortsPerSide - 1) * portSpacing + edgeMargin * 2 : 0

    let iconWidth = DEFAULT_ICON_SIZE
    const aspectRatio = this.getIconAspectRatio(node)
    if (aspectRatio !== null) {
      iconWidth = Math.round(DEFAULT_ICON_SIZE * aspectRatio)
    }

    return Math.max(
      Math.max(iconWidth, labelWidth) + NODE_HORIZONTAL_PADDING,
      portWidth,
      labelWidth + NODE_HORIZONTAL_PADDING,
    )
  }

  private calculatePortSpacing(portNames: Set<string> | undefined, minSpacing: number): number {
    if (!portNames?.size) return minSpacing
    let maxLen = 0
    for (const name of portNames) {
      maxLen = Math.max(maxLen, name.length)
    }
    return Math.max(minSpacing, maxLen * PORT_LABEL_FONT_SIZE * CHAR_WIDTH_RATIO + PORT_LABEL_PADDING)
  }

  private buildElkPorts(
    portInfo: NodePortInfo,
    width: number,
    height: number,
    nodeId: string,
    portSpacingMin: number,
  ): ElkNode['ports'] {
    const ports: NonNullable<ElkNode['ports']> = []
    const portSpacing = this.calculatePortSpacing(portInfo.all, portSpacingMin)

    const calcPositions = (count: number, total: number): number[] => {
      if (count === 0) return []
      if (count === 1) return [total / 2]
      const span = (count - 1) * portSpacing
      const start = (total - span) / 2
      return Array.from({ length: count }, (_, i) => start + i * portSpacing)
    }

    for (const [i, portName] of [...portInfo.top].entries()) {
      const positions = calcPositions(portInfo.top.size, width)
      ports.push({
        id: `${nodeId}:${portName}`,
        width: PORT_WIDTH,
        height: PORT_HEIGHT,
        x: positions[i] - PORT_WIDTH / 2,
        y: 0,
        labels: [{ text: portName }],
        layoutOptions: { 'elk.port.side': 'NORTH' },
      })
    }

    for (const [i, portName] of [...portInfo.bottom].entries()) {
      const positions = calcPositions(portInfo.bottom.size, width)
      ports.push({
        id: `${nodeId}:${portName}`,
        width: PORT_WIDTH,
        height: PORT_HEIGHT,
        x: positions[i] - PORT_WIDTH / 2,
        y: height - PORT_HEIGHT,
        labels: [{ text: portName }],
        layoutOptions: { 'elk.port.side': 'SOUTH' },
      })
    }

    for (const [i, portName] of [...portInfo.left].entries()) {
      const positions = calcPositions(portInfo.left.size, height)
      ports.push({
        id: `${nodeId}:${portName}`,
        width: PORT_WIDTH,
        height: PORT_HEIGHT,
        x: 0,
        y: positions[i] - PORT_HEIGHT / 2,
        labels: [{ text: portName }],
        layoutOptions: { 'elk.port.side': 'WEST' },
      })
    }

    for (const [i, portName] of [...portInfo.right].entries()) {
      const positions = calcPositions(portInfo.right.size, height)
      ports.push({
        id: `${nodeId}:${portName}`,
        width: PORT_WIDTH,
        height: PORT_HEIGHT,
        x: width - PORT_WIDTH,
        y: positions[i] - PORT_HEIGHT / 2,
        labels: [{ text: portName }],
        layoutOptions: { 'elk.port.side': 'EAST' },
      })
    }

    return ports
  }

  // ============================================
  // Spacing & Bounds
  // ============================================

  private calculateDynamicSpacing(graph: NetworkGraph) {
    const nodeCount = graph.nodes.length
    const linkCount = graph.links.length
    const subgraphCount = graph.subgraphs?.length ?? 0

    let portCount = 0
    let maxPortLabelLength = 0
    for (const link of graph.links) {
      if (typeof link.from !== 'string' && link.from.port) {
        portCount++
        maxPortLabelLength = Math.max(maxPortLabelLength, link.from.port.length)
      }
      if (typeof link.to !== 'string' && link.to.port) {
        portCount++
        maxPortLabelLength = Math.max(maxPortLabelLength, link.to.port.length)
      }
    }

    const avgPortsPerNode = nodeCount > 0 ? portCount / nodeCount : 0
    const complexity = nodeCount + linkCount * 0.8 + portCount * 0.3 + subgraphCount * 2
    const portDensityFactor = Math.min(1.5, 1 + avgPortsPerNode * 0.1)
    const baseSpacing = Math.max(20, Math.min(60, 80 - complexity * 1.2)) * portDensityFactor

    const portLabelProtrusion = portCount > 0 ? 28 : 0
    const portLabelWidth = maxPortLabelLength * PORT_LABEL_FONT_SIZE * CHAR_WIDTH_RATIO
    const minRankSpacing = Math.max(portLabelWidth, portLabelProtrusion) + 16
    const minSubgraphPadding = portLabelProtrusion + 8

    return {
      nodeSpacing: Math.round(baseSpacing),
      rankSpacing: Math.round(Math.max(baseSpacing * 1.5, minRankSpacing)),
      subgraphPadding: Math.round(Math.max(baseSpacing * 0.6, minSubgraphPadding)),
    }
  }

  private getSpacingConstraints(graph: NetworkGraph) {
    const maxLinkStrokeWidth = graph.links.reduce(
      (max, link) => Math.max(max, getLinkStrokeWidthForLayout(link)),
      0,
    )
    const minEdgeGap = 16
    const portSpacingMin = Math.max(MIN_PORT_SPACING, Math.round(maxLinkStrokeWidth + minEdgeGap))
    return { minEdgeGap, maxLinkStrokeWidth, portSpacingMin }
  }

  private calculateBounds(
    nodes: Map<string, PlacedNode>,
    subgraphs: Map<string, PlacedSubgraph>,
  ) {
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity

    for (const node of nodes.values()) {
      const left = node.position.x - node.size.width / 2
      const right = node.position.x + node.size.width / 2
      const top = node.position.y - node.size.height / 2
      const bottom = node.position.y + node.size.height / 2
      minX = Math.min(minX, left)
      minY = Math.min(minY, top)
      maxX = Math.max(maxX, right)
      maxY = Math.max(maxY, bottom)
    }

    for (const sg of subgraphs.values()) {
      minX = Math.min(minX, sg.bounds.x)
      minY = Math.min(minY, sg.bounds.y)
      maxX = Math.max(maxX, sg.bounds.x + sg.bounds.width)
      maxY = Math.max(maxY, sg.bounds.y + sg.bounds.height)
    }

    const padding = 50
    if (minX === Infinity) return { x: 0, y: 0, width: 400, height: 300 }

    return {
      x: minX - padding,
      y: minY - padding,
      width: maxX - minX + padding * 2,
      height: maxY - minY + padding * 2,
    }
  }

  private async runElkLayout(elkGraph: ElkNode): Promise<ElkNode> {
    try {
      return await this.elk.layout(elkGraph)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (!message.includes('Invalid hitboxes for scanline constraint calculation')) throw err
      this.setOption(elkGraph, 'elk.layered.compaction.postCompaction.strategy', 'NONE')
      return await this.elk.layout(elkGraph)
    }
  }

  private setOption(node: ElkNode, key: string, value: string): void {
    if (node.layoutOptions) node.layoutOptions[key] = value
    for (const child of node.children ?? []) {
      this.setOption(child, key, value)
    }
  }

  private detectHAPairs(graph: NetworkGraph): { nodeA: string; nodeB: string }[] {
    const pairs: { nodeA: string; nodeB: string }[] = []
    const processed = new Set<string>()
    for (const link of graph.links) {
      if (!link.redundancy) continue
      const fromId = getNodeId(link.from)
      const toId = getNodeId(link.to)
      const key = [fromId, toId].sort().join(':')
      if (processed.has(key)) continue
      pairs.push({ nodeA: fromId, nodeB: toId })
      processed.add(key)
    }
    return pairs
  }
}

// ============================================
// Helpers
// ============================================

function toElkDirection(direction: LayoutDirection): string {
  switch (direction) {
    case 'TB': return 'DOWN'
    case 'BT': return 'UP'
    case 'LR': return 'RIGHT'
    case 'RL': return 'LEFT'
    default: return 'DOWN'
  }
}
