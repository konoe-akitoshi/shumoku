/**
 * Hierarchical Layout Engine
 * Uses ELK.js for advanced graph layout with proper edge routing
 */

import ELK, {
  type ElkExtendedEdge,
  type ElkNode,
  type LayoutOptions,
} from 'elkjs/lib/elk.bundled.js'
import {
  CHAR_WIDTH_RATIO,
  DEFAULT_ICON_SIZE,
  ESTIMATED_CHAR_WIDTH,
  ICON_LABEL_GAP,
  LABEL_LINE_HEIGHT,
  MIN_PORT_SPACING,
  NODE_HORIZONTAL_PADDING,
  NODE_VERTICAL_PADDING,
  PORT_LABEL_FONT_SIZE,
  PORT_LABEL_PADDING,
} from '../constants.js'
import { getDeviceIcon } from '../icons/index.js'
import {
  type Bounds,
  type EdgeStyle,
  getNodeId,
  type IconDimensions,
  type LayoutDirection,
  type LayoutLink,
  type LayoutNode,
  type LayoutResult,
  type LayoutSubgraph,
  type LinkEndpoint,
  type NetworkGraph,
  type Node,
  type Position,
  type SplineMode,
  type Subgraph,
} from '../models/index.js'

// ============================================
// Types
// ============================================

/** ELK edge section for edge routing */
interface ElkEdgeSection {
  startPoint: { x: number; y: number }
  endPoint: { x: number; y: number }
  bendPoints?: Array<{ x: number; y: number }>
}

/** Extended ELK edge with sections */
interface ElkEdgeWithSections {
  id: string
  sections?: ElkEdgeSection[]
}

/** Port info for a node */
interface NodePortInfo {
  all: Set<string>
  top: Set<string>
  bottom: Set<string>
  left: Set<string>
  right: Set<string>
}

// ============================================
// Helper Functions
// ============================================

function toEndpoint(endpoint: string | LinkEndpoint): LinkEndpoint {
  if (typeof endpoint === 'string') {
    return { node: endpoint }
  }
  // Convert pin to port for subgraph boundary connections
  if ('pin' in endpoint && endpoint.pin) {
    return {
      node: endpoint.node,
      port: endpoint.pin, // Use pin as port
      ip: endpoint.ip,
    }
  }
  return endpoint
}

function getBandwidthStrokeWidth(bandwidth?: string): number {
  switch (bandwidth) {
    case '1G':
      return 6
    case '10G':
      return 10
    case '25G':
      return 14
    case '40G':
      return 18
    case '100G':
      return 24
    default:
      return 0
  }
}

function getLinkTypeStrokeWidth(type?: string): number {
  switch (type) {
    case 'thick':
      return 3
    case 'double':
      return 2
    default:
      return 2
  }
}

function getLinkStrokeWidthForLayout(link: { bandwidth?: string; type?: string; style?: { strokeWidth?: number } }): number {
  const styleWidth = link.style?.strokeWidth ?? 0
  const bandwidthWidth = getBandwidthStrokeWidth(link.bandwidth)
  const typeWidth = getLinkTypeStrokeWidth(link.type)
  return Math.max(2, styleWidth, bandwidthWidth, typeWidth)
}

function getLayoutSpacingConstraints(graph: NetworkGraph): {
  minEdgeGap: number
  maxLinkStrokeWidth: number
  portSpacingMin: number
} {
  const maxLinkStrokeWidth = graph.links.reduce(
    (max, link) => Math.max(max, getLinkStrokeWidthForLayout(link)),
    0,
  )

  // Minimum desired clearance between link outer edges.
  // Keep this centralized so future label-based clearance can be added here.
  const minEdgeGap = 16

  // Port spacing should respect both label width and link clearance.
  const portSpacingMin = Math.max(MIN_PORT_SPACING, Math.round(maxLinkStrokeWidth + minEdgeGap))

  return { minEdgeGap, maxLinkStrokeWidth, portSpacingMin }
}

function getEdgeSpacing(
  options: Pick<Required<HierarchicalLayoutOptions>, 'nodeSpacing'>,
  spacing: { minEdgeGap: number; maxLinkStrokeWidth: number },
): { edgeNodeSpacing: number; edgeEdgeSpacing: number } {
  const edgeNodeSpacing = Math.max(10, Math.round(options.nodeSpacing * 0.4))
  const edgeEdgeSpacing = Math.max(
    8,
    Math.round(options.nodeSpacing * 0.25),
    Math.round(spacing.maxLinkStrokeWidth + spacing.minEdgeGap),
  )
  return { edgeNodeSpacing, edgeEdgeSpacing }
}

/** Resolve rank to a numeric partition value, or undefined if invalid */
function resolvePartition(rank: number | string | undefined): number | undefined {
  if (rank === undefined) return undefined
  const n = typeof rank === 'string' ? parseInt(rank, 10) : rank
  return Number.isNaN(n) ? undefined : n
}

/** Collect ports for each node from links */
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

  // Check if link is between HA pair nodes
  const isHALink = (fromNode: string, toNode: string): boolean => {
    const key = [fromNode, toNode].sort().join(':')
    return haPairSet.has(key)
  }

  for (const link of graph.links) {
    const from = toEndpoint(link.from)
    const to = toEndpoint(link.to)

    if (link.redundancy && isHALink(from.node, to.node)) {
      // HA links: create side ports (left/right)
      const fromPortName = from.port || 'ha'
      const toPortName = to.port || 'ha'

      const fromInfo = getOrCreate(from.node)
      fromInfo.all.add(fromPortName)
      fromInfo.right.add(fromPortName)

      const toInfo = getOrCreate(to.node)
      toInfo.all.add(toPortName)
      toInfo.left.add(toPortName)
    } else {
      // Normal links: ports on top/bottom
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
  /** Edge routing style */
  edgeStyle?: EdgeStyle
  /** Spline routing mode (only used when edgeStyle is 'splines') */
  splineMode?: SplineMode
  /** Pre-resolved icon dimensions for CDN icons (URL -> dimensions) */
  iconDimensions?: Map<string, IconDimensions>
  /** Custom ELK instance (for Bun compatibility) */
  elk?: InstanceType<typeof ELK>
}

const DEFAULT_OPTIONS: Omit<Omit<Required<HierarchicalLayoutOptions>, 'elk'>, 'elk'> = {
  direction: 'TB',
  nodeWidth: 180,
  nodeHeight: 60,
  nodeSpacing: 40,
  rankSpacing: 60,
  subgraphPadding: 24,
  subgraphLabelHeight: 24,
  edgeStyle: 'orthogonal',
  splineMode: 'sloppy',
  iconDimensions: new Map(),
}

// ============================================
// Layout Engine
// ============================================

export class HierarchicalLayout {
  private options: Omit<Omit<Required<HierarchicalLayoutOptions>, 'elk'>, 'elk'>
  private elk: InstanceType<typeof ELK>

  constructor(options?: HierarchicalLayoutOptions) {
    const { elk, ...rest } = options ?? {}
    this.options = { ...DEFAULT_OPTIONS, ...rest }
    this.elk = elk ?? new ELK()
  }

  /**
   * Calculate dynamic spacing based on graph complexity
   */
  private calculateDynamicSpacing(graph: NetworkGraph): {
    nodeSpacing: number
    rankSpacing: number
    subgraphPadding: number
  } {
    const nodeCount = graph.nodes.length
    const linkCount = graph.links.length
    const subgraphCount = graph.subgraphs?.length || 0

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
    const complexity = nodeCount * 1.0 + linkCount * 0.8 + portCount * 0.3 + subgraphCount * 2
    const portDensityFactor = Math.min(1.5, 1 + avgPortsPerNode * 0.1)
    const rawSpacing = Math.max(20, Math.min(60, 80 - complexity * 1.2))
    const baseSpacing = rawSpacing * portDensityFactor

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

  private getEffectiveOptions(
    graph: NetworkGraph,
  ): Omit<Required<HierarchicalLayoutOptions>, 'elk'> {
    const settings = graph.settings
    const dynamicSpacing = this.calculateDynamicSpacing(graph)

    return {
      ...this.options,
      direction: settings?.direction || this.options.direction,
      edgeStyle: settings?.edgeStyle || this.options.edgeStyle,
      splineMode: settings?.splineMode || this.options.splineMode,
      nodeSpacing: settings?.nodeSpacing || dynamicSpacing.nodeSpacing,
      rankSpacing: settings?.rankSpacing || dynamicSpacing.rankSpacing,
      subgraphPadding: settings?.subgraphPadding || dynamicSpacing.subgraphPadding,
    }
  }

  async layoutAsync(graph: NetworkGraph): Promise<LayoutResult> {
    const startTime = performance.now()
    const options = this.getEffectiveOptions(graph)

    // Detect HA pairs first (needed for port assignment)
    const haPairs = this.detectHAPairs(graph)
    const haPairSet = new Set<string>()
    for (const pair of haPairs) {
      haPairSet.add([pair.nodeA, pair.nodeB].sort().join(':'))
    }

    const spacing = getLayoutSpacingConstraints(graph)
    const nodePorts = collectNodePorts(graph, haPairSet)

    // Build ELK graph
    const elkGraph = this.buildElkGraph(graph, options, nodePorts, haPairs, spacing)

    // Run ELK layout
    const layoutedGraph = await this.runElkLayout(elkGraph)

    // Extract results using ELK's positions and edge routes
    const result = this.extractLayoutResult(graph, layoutedGraph, nodePorts, options)

    const edgeSpacing = getEdgeSpacing(options, spacing)
    result.metadata = {
      algorithm: 'elk-layered',
      duration: performance.now() - startTime,
      spacing: {
        minEdgeGap: spacing.minEdgeGap,
        maxLinkStrokeWidth: spacing.maxLinkStrokeWidth,
        portSpacingMin: spacing.portSpacingMin,
        edgeNodeSpacing: edgeSpacing.edgeNodeSpacing,
        edgeEdgeSpacing: edgeSpacing.edgeEdgeSpacing,
      },
    }

    return result
  }

  /**
   * Build ELK graph - uses container nodes for HA pairs
   */
  /**
   * Run ELK layout with automatic retry on known ELK bugs.
   * Falls back to layout without post-compaction when ELK's scanline
   * constraint calculation fails on certain graph topologies.
   */
  private async runElkLayout(elkGraph: ElkNode): Promise<ElkNode> {
    try {
      return await this.elk.layout(elkGraph)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (!message.includes('Invalid hitboxes for scanline constraint calculation')) {
        throw err
      }
      this.setLayoutOptionRecursive(
        elkGraph,
        'elk.layered.compaction.postCompaction.strategy',
        'NONE',
      )
      return await this.elk.layout(elkGraph)
    }
  }

  private setLayoutOptionRecursive(node: ElkNode, key: string, value: string): void {
    if (node.layoutOptions) {
      node.layoutOptions[key] = value
    }
    for (const child of node.children ?? []) {
      this.setLayoutOptionRecursive(child, key, value)
    }
  }

  private buildElkGraph(
    graph: NetworkGraph,
    options: Omit<Required<HierarchicalLayoutOptions>, 'elk'>,
    nodePorts: Map<string, NodePortInfo>,
    haPairs: { nodeA: string; nodeB: string }[],
    spacing: { minEdgeGap: number; maxLinkStrokeWidth: number; portSpacingMin: number },
  ): ElkNode {
    const elkDirection = this.toElkDirection(options.direction)

    // Build subgraph map
    const subgraphMap = new Map<string, Subgraph>()
    if (graph.subgraphs) {
      for (const sg of graph.subgraphs) {
        subgraphMap.set(sg.id, sg)
      }
    }

    // Check if any node has a rank value (enables ELK partitioning)
    const hasRankedNodes = graph.nodes.some((n) => n.rank !== undefined)

    // Build HA container map: node ID -> container ID
    const nodeToHAContainer = new Map<string, string>()
    const haPairMap = new Map<string, { nodeA: string; nodeB: string }>()
    for (const [idx, pair] of haPairs.entries()) {
      const containerId = `__ha_container_${idx}`
      nodeToHAContainer.set(pair.nodeA, containerId)
      nodeToHAContainer.set(pair.nodeB, containerId)
      haPairMap.set(containerId, pair)
    }

    // Create ELK node
    const createElkNode = (node: Node): ElkNode => {
      const portInfo = nodePorts.get(node.id)
      const portCount = portInfo?.all.size || 0
      const height = this.calculateNodeHeight(node, portCount)
      const width = this.calculateNodeWidth(node, portInfo, spacing.portSpacingMin)

      const elkNode: ElkNode = {
        id: node.id,
        width,
        height,
        labels: [{ text: Array.isArray(node.label) ? node.label.join('\n') : node.label }],
      }

      // Assign partition from rank for layer control
      const partition = resolvePartition(node.rank)
      if (hasRankedNodes && partition !== undefined) {
        elkNode.layoutOptions = { 'elk.partitioning.partition': String(partition) }
      }

      // Add ports
      if (portInfo && portInfo.all.size > 0) {
        elkNode.ports = []

        // Calculate port spacing based on label width
        const portSpacing = this.calculatePortSpacing(portInfo.all, spacing.portSpacingMin)

        // Helper to calculate port positions centered in the node
        const calcPortPositions = (count: number, totalWidth: number): number[] => {
          if (count === 0) return []
          if (count === 1) return [totalWidth / 2]
          const totalSpan = (count - 1) * portSpacing
          const startX = (totalWidth - totalSpan) / 2
          return Array.from({ length: count }, (_, i) => startX + i * portSpacing)
        }

        // Top ports (incoming)
        const topPorts = Array.from(portInfo.top)
        const topPositions = calcPortPositions(topPorts.length, width)
        for (const [i, portName] of topPorts.entries()) {
          elkNode.ports!.push({
            id: `${node.id}:${portName}`,
            width: PORT_WIDTH,
            height: PORT_HEIGHT,
            x: topPositions[i] - PORT_WIDTH / 2,
            y: 0,
            labels: [{ text: portName }],
            layoutOptions: { 'elk.port.side': 'NORTH' },
          })
        }

        // Bottom ports (outgoing)
        const bottomPorts = Array.from(portInfo.bottom)
        const bottomPositions = calcPortPositions(bottomPorts.length, width)
        for (const [i, portName] of bottomPorts.entries()) {
          elkNode.ports!.push({
            id: `${node.id}:${portName}`,
            width: PORT_WIDTH,
            height: PORT_HEIGHT,
            x: bottomPositions[i] - PORT_WIDTH / 2,
            y: height - PORT_HEIGHT,
            labels: [{ text: portName }],
            layoutOptions: { 'elk.port.side': 'SOUTH' },
          })
        }

        // Left ports (HA)
        const leftPorts = Array.from(portInfo.left)
        const leftPositions = calcPortPositions(leftPorts.length, height)
        for (const [i, portName] of leftPorts.entries()) {
          elkNode.ports!.push({
            id: `${node.id}:${portName}`,
            width: PORT_WIDTH,
            height: PORT_HEIGHT,
            x: 0,
            y: leftPositions[i] - PORT_HEIGHT / 2,
            labels: [{ text: portName }],
            layoutOptions: { 'elk.port.side': 'WEST' },
          })
        }

        // Right ports (HA)
        const rightPorts = Array.from(portInfo.right)
        const rightPositions = calcPortPositions(rightPorts.length, height)
        for (const [i, portName] of rightPorts.entries()) {
          elkNode.ports!.push({
            id: `${node.id}:${portName}`,
            width: PORT_WIDTH,
            height: PORT_HEIGHT,
            x: width - PORT_WIDTH,
            y: rightPositions[i] - PORT_HEIGHT / 2,
            labels: [{ text: portName }],
            layoutOptions: { 'elk.port.side': 'EAST' },
          })
        }

        elkNode.layoutOptions = {
          ...elkNode.layoutOptions,
          'elk.portConstraints': 'FIXED_POS',
          'elk.spacing.portPort': String(spacing.portSpacingMin),
        }
      }

      return elkNode
    }

    // Create HA container node
    const createHAContainerNode = (
      containerId: string,
      pair: { nodeA: string; nodeB: string },
    ): ElkNode | null => {
      const nodeA = graph.nodes.find((n) => n.id === pair.nodeA)
      const nodeB = graph.nodes.find((n) => n.id === pair.nodeB)
      if (!nodeA || !nodeB) return null

      const childA = createElkNode(nodeA)
      const childB = createElkNode(nodeB)

      // Find HA link
      const haLink = graph.links.find((link) => {
        if (!link.redundancy) return false
        const from = toEndpoint(link.from)
        const to = toEndpoint(link.to)
        const key = [from.node, to.node].sort().join(':')
        const pairKey = [pair.nodeA, pair.nodeB].sort().join(':')
        return key === pairKey
      })

      // Create internal HA edge
      const haEdges: ElkExtendedEdge[] = []
      if (haLink) {
        const from = toEndpoint(haLink.from)
        const to = toEndpoint(haLink.to)
        const fromPortName = from.port || 'ha'
        const toPortName = to.port || 'ha'
        haEdges.push({
          id: haLink.id || `ha-edge-${containerId}`,
          sources: [`${from.node}:${fromPortName}`],
          targets: [`${to.node}:${toPortName}`],
        })
      }

      return {
        id: containerId,
        children: [childA, childB],
        edges: haEdges,
        layoutOptions: {
          'elk.algorithm': 'layered',
          'elk.direction': 'RIGHT',
          'elk.spacing.nodeNode': '40',
          'elk.padding': '[top=0,left=0,bottom=0,right=0]',
          'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
          'elk.edgeRouting': 'POLYLINE',
          'org.eclipse.elk.json.edgeCoords': 'ROOT',
          'org.eclipse.elk.json.shapeCoords': 'ROOT',
        },
      }
    }

    // Track added HA containers
    const addedHAContainers = new Set<string>()

    // Create ELK subgraph node recursively
    const createSubgraphNode = (
      subgraph: Subgraph,
      edgesByContainer: Map<string, ElkExtendedEdge[]>,
    ): ElkNode => {
      const childNodes: ElkNode[] = []

      for (const childSg of subgraphMap.values()) {
        if (childSg.parent === subgraph.id) {
          childNodes.push(createSubgraphNode(childSg, edgesByContainer))
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
                const containerNode = createHAContainerNode(containerId, pair)
                if (containerNode) childNodes.push(containerNode)
              }
            }
          } else {
            childNodes.push(createElkNode(node))
          }
        }
      }

      const sgPadding = subgraph.style?.padding ?? options.subgraphPadding
      const sgEdges = edgesByContainer.get(subgraph.id) || []

      // Set minimum size for empty subgraphs (e.g., those with file references)
      const hasFileRef = !!subgraph.file
      const minWidth = hasFileRef && childNodes.length === 0 ? 200 : undefined
      const minHeight = hasFileRef && childNodes.length === 0 ? 100 : undefined

      // Subgraph-specific direction (can override parent)
      const sgDirection = subgraph.direction
        ? this.toElkDirection(subgraph.direction)
        : elkDirection

      const elkEdgeRouting = this.toElkEdgeRouting(options.edgeStyle)
      const elkLayoutOptions: LayoutOptions = {
        'elk.algorithm': 'layered',
        'elk.direction': sgDirection,
        'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
        'elk.padding': `[top=${sgPadding + options.subgraphLabelHeight},left=${sgPadding},bottom=${sgPadding},right=${sgPadding}]`,
        'elk.spacing.nodeNode': String(options.nodeSpacing),
        'elk.layered.spacing.nodeNodeBetweenLayers': String(options.rankSpacing),
        'elk.spacing.edgeNode': String(edgeNodeSpacing),
        'elk.spacing.edgeEdge': String(edgeEdgeSpacing),
        'elk.layered.spacing.edgeEdge': String(edgeEdgeSpacing),
        'elk.layered.spacing.edgeEdgeBetweenLayers': String(edgeEdgeSpacing),
        'elk.edgeRouting': elkEdgeRouting,
        ...(hasRankedNodes && { 'elk.partitioning.activate': 'true' }),
        // Use ROOT coordinate system for consistent edge/shape positioning
        'org.eclipse.elk.json.edgeCoords': 'ROOT',
        'org.eclipse.elk.json.shapeCoords': 'ROOT',
      }

      // Add spline mode if using splines
      if (options.edgeStyle === 'splines') {
        elkLayoutOptions['elk.layered.edgeRouting.splines.mode'] = this.toElkSplineMode(
          options.splineMode,
        )
      }

      const elkNode: ElkNode = {
        id: subgraph.id,
        labels: [{ text: subgraph.label }],
        children: childNodes,
        edges: sgEdges,
        layoutOptions: elkLayoutOptions,
      }

      // Note: Subgraph pins are resolved to device:port in parser
      // ELK handles cross-hierarchy edges directly with INCLUDE_CHILDREN

      if (minWidth) elkNode.width = minWidth
      if (minHeight) elkNode.height = minHeight

      return elkNode
    }

    // Build root children
    const buildRootChildren = (edgesByContainer: Map<string, ElkExtendedEdge[]>): ElkNode[] => {
      const children: ElkNode[] = []

      for (const sg of subgraphMap.values()) {
        if (!sg.parent || !subgraphMap.has(sg.parent)) {
          children.push(createSubgraphNode(sg, edgesByContainer))
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
                const containerNode = createHAContainerNode(containerId, pair)
                if (containerNode) children.push(containerNode)
              }
            }
          } else {
            children.push(createElkNode(node))
          }
        }
      }

      return children
    }

    // Build node to parent map (includes both nodes and subgraphs)
    const nodeParentMap = new Map<string, string | undefined>()
    for (const node of graph.nodes) {
      nodeParentMap.set(node.id, node.parent)
    }
    // Add subgraphs to parent map for LCA calculation
    for (const sg of subgraphMap.values()) {
      nodeParentMap.set(sg.id, sg.parent)
    }

    // Find LCA (Lowest Common Ancestor) of two nodes
    const findLCA = (nodeA: string, nodeB: string): string | undefined => {
      const ancestorsA = new Set<string | undefined>()
      let current: string | undefined = nodeA
      while (current) {
        ancestorsA.add(current)
        current = nodeParentMap.get(current)
      }
      ancestorsA.add(undefined) // root

      current = nodeB
      while (current !== undefined) {
        if (ancestorsA.has(current)) {
          return current
        }
        current = nodeParentMap.get(current)
      }
      return undefined // root
    }

    // Build HA pair set for quick lookup
    const haPairSet = new Set<string>()
    for (const pair of haPairs) {
      haPairSet.add([pair.nodeA, pair.nodeB].sort().join(':'))
    }

    const isHALink = (fromNode: string, toNode: string): boolean => {
      const key = [fromNode, toNode].sort().join(':')
      return haPairSet.has(key)
    }

    // Group edges by their LCA container (skip HA links - they're in containers)
    const edgesByContainer = new Map<string, ElkExtendedEdge[]>()
    edgesByContainer.set('root', [])

    for (const sg of subgraphMap.values()) {
      edgesByContainer.set(sg.id, [])
    }

    for (const [index, link] of graph.links.entries()) {
      const from = toEndpoint(link.from)
      const to = toEndpoint(link.to)

      // Skip HA links (they're inside HA containers)
      if (link.redundancy && isHALink(from.node, to.node)) {
        continue
      }

      // ELK port reference format: nodeId:portId in sources/targets
      // Note: Pin references are already resolved to device:port in parser
      const sourceId = from.port ? `${from.node}:${from.port}` : from.node
      const targetId = to.port ? `${to.node}:${to.port}` : to.node

      const edge: ElkExtendedEdge = {
        id: link.id || `edge-${index}`,
        sources: [sourceId],
        targets: [targetId],
      }

      // Add label
      const labelParts: string[] = []
      if (link.label) {
        labelParts.push(Array.isArray(link.label) ? link.label.join(' / ') : link.label)
      }
      if (from.ip) labelParts.push(from.ip)
      if (to.ip) labelParts.push(to.ip)

      if (labelParts.length > 0) {
        edge.labels = [
          {
            text: labelParts.join('\n'),
            layoutOptions: { 'elk.edgeLabels.placement': 'CENTER' },
          },
        ]
      }

      // Determine edge container using LCA (Lowest Common Ancestor)
      // All pin references are already resolved to actual devices in parser
      const lca = findLCA(from.node, to.node)
      let container = lca
      if (container === from.node || container === to.node) {
        container = nodeParentMap.get(container)
      }
      const containerId = container && subgraphMap.has(container) ? container : 'root'

      if (!edgesByContainer.has(containerId)) {
        edgesByContainer.set(containerId, [])
      }
      edgesByContainer.get(containerId)!.push(edge)
    }

    // Dynamic edge spacing (account for thick/bandwidth-based strokes)
    const { edgeNodeSpacing, edgeEdgeSpacing } = getEdgeSpacing(options, spacing)

    // Root layout options
    // Convert edge style to ELK routing option
    const elkEdgeRouting = this.toElkEdgeRouting(options.edgeStyle)

    const rootLayoutOptions: LayoutOptions = {
      'elk.algorithm': 'layered',
      'elk.direction': elkDirection,
      'elk.spacing.nodeNode': String(options.nodeSpacing),
      'elk.layered.spacing.nodeNodeBetweenLayers': String(options.rankSpacing),
      'elk.spacing.edgeNode': String(edgeNodeSpacing),
      'elk.spacing.edgeEdge': String(edgeEdgeSpacing),
      'elk.layered.spacing.edgeEdge': String(edgeEdgeSpacing),
      'elk.layered.spacing.edgeEdgeBetweenLayers': String(edgeEdgeSpacing),
      'elk.layered.compaction.postCompaction.strategy': 'EDGE_LENGTH',
      'elk.layered.compaction.connectedComponents': 'true',
      'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
      'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
      'elk.edgeRouting': elkEdgeRouting,
      'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
      // Partition nodes by rank when rank values are present
      ...(hasRankedNodes && { 'elk.partitioning.activate': 'true' }),
      // Use ROOT coordinate system
      'org.eclipse.elk.json.edgeCoords': 'ROOT',
      'org.eclipse.elk.json.shapeCoords': 'ROOT',
    }

    // Add spline mode if using splines
    if (options.edgeStyle === 'splines') {
      rootLayoutOptions['elk.layered.edgeRouting.splines.mode'] = this.toElkSplineMode(
        options.splineMode,
      )
    }

    // Build the graph with edges in correct containers
    const rootChildren = buildRootChildren(edgesByContainer)
    const rootEdges = edgesByContainer.get('root') || []

    return {
      id: 'root',
      children: rootChildren,
      edges: rootEdges,
      layoutOptions: rootLayoutOptions,
    }
  }

  /**
   * Extract layout result from ELK output - uses ELK's edge routing directly
   */
  private extractLayoutResult(
    graph: NetworkGraph,
    elkGraph: ElkNode,
    nodePorts: Map<string, NodePortInfo>,
    _options: Omit<Required<HierarchicalLayoutOptions>, 'elk'>,
  ): LayoutResult {
    const layoutNodes = new Map<string, LayoutNode>()
    const layoutSubgraphs = new Map<string, LayoutSubgraph>()
    const layoutLinks = new Map<string, LayoutLink>()

    // Build maps
    const subgraphMap = new Map<string, Subgraph>()
    if (graph.subgraphs) {
      for (const sg of graph.subgraphs) {
        subgraphMap.set(sg.id, sg)
      }
    }

    const nodeMap = new Map<string, Node>()
    for (const node of graph.nodes) {
      nodeMap.set(node.id, node)
    }

    // Process ELK nodes recursively
    // With shapeCoords=ROOT, all coordinates are absolute (no offset needed)
    const processElkNode = (elkNode: ElkNode) => {
      const x = elkNode.x || 0
      const y = elkNode.y || 0
      const width = elkNode.width || 0
      const height = elkNode.height || 0

      if (subgraphMap.has(elkNode.id)) {
        // Subgraph
        const sg = subgraphMap.get(elkNode.id)!
        const layoutSg: LayoutSubgraph = {
          id: elkNode.id,
          bounds: { x, y, width, height },
          subgraph: sg,
        }

        layoutSubgraphs.set(elkNode.id, layoutSg)

        if (elkNode.children) {
          for (const child of elkNode.children) {
            processElkNode(child)
          }
        }
      } else if (elkNode.id.startsWith('__ha_container_')) {
        // HA container - process children
        if (elkNode.children) {
          for (const child of elkNode.children) {
            processElkNode(child)
          }
        }
      } else if (nodeMap.has(elkNode.id)) {
        // Regular node
        const node = nodeMap.get(elkNode.id)!
        const portInfo = nodePorts.get(node.id)
        const nodeHeight = this.calculateNodeHeight(node, portInfo?.all.size || 0)

        const layoutNode: LayoutNode = {
          id: elkNode.id,
          position: { x: x + width / 2, y: y + nodeHeight / 2 },
          size: { width, height: nodeHeight },
          node,
        }

        // Extract port positions from ELK
        if (elkNode.ports && elkNode.ports.length > 0) {
          layoutNode.ports = new Map()
          const nodeCenterX = x + width / 2
          const nodeCenterY = y + nodeHeight / 2

          for (const elkPort of elkNode.ports) {
            const portX = elkPort.x ?? 0
            const portY = elkPort.y ?? 0
            const portW = elkPort.width ?? PORT_WIDTH
            const portH = elkPort.height ?? PORT_HEIGHT

            const portCenterX = portX + portW / 2
            const portCenterY = portY + portH / 2

            const relX = portCenterX - nodeCenterX
            const relY = portCenterY - nodeCenterY

            // Determine side based on which edge the port is closest to
            // Use node boundaries, not relative distance from center
            const distToTop = Math.abs(portCenterY - y)
            const distToBottom = Math.abs(portCenterY - (y + nodeHeight))
            const distToLeft = Math.abs(portCenterX - x)
            const distToRight = Math.abs(portCenterX - (x + width))

            const minDist = Math.min(distToTop, distToBottom, distToLeft, distToRight)
            let side: 'top' | 'bottom' | 'left' | 'right' = 'bottom'
            if (minDist === distToTop) {
              side = 'top'
            } else if (minDist === distToBottom) {
              side = 'bottom'
            } else if (minDist === distToLeft) {
              side = 'left'
            } else {
              side = 'right'
            }

            const portName = elkPort.id.includes(':')
              ? elkPort.id.split(':').slice(1).join(':')
              : elkPort.id

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

    // Process root children (coordinates are absolute with shapeCoords=ROOT)
    if (elkGraph.children) {
      for (const child of elkGraph.children) {
        processElkNode(child)
      }
    }

    // Build link map for ID matching
    const linkById = new Map<string, { link: (typeof graph.links)[0]; index: number }>()
    for (const [index, link] of graph.links.entries()) {
      linkById.set(link.id || `edge-${index}`, { link, index })
    }

    // Track processed edges to prevent duplicates
    const processedEdgeIds = new Set<string>()

    // Check if container is an HA container
    const isHAContainer = (id: string) => id.startsWith('__ha_container_')

    // Process edges from a container
    // With edgeCoords=ROOT, all edge coordinates are absolute (no offset needed)
    const processEdgesInContainer = (container: ElkNode) => {
      const elkEdges = container.edges as ElkEdgeWithSections[] | undefined
      if (elkEdges) {
        for (const elkEdge of elkEdges) {
          // Skip if already processed
          if (processedEdgeIds.has(elkEdge.id)) continue
          processedEdgeIds.add(elkEdge.id)

          const entry = linkById.get(elkEdge.id)
          if (!entry) continue

          const { link, index } = entry
          const id = link.id || `link-${index}`
          const fromEndpoint = toEndpoint(link.from)
          const toEndpoint_ = toEndpoint(link.to)

          // Get layout info for endpoints (can be nodes or subgraphs)
          const fromNode = layoutNodes.get(fromEndpoint.node)
          const toNode = layoutNodes.get(toEndpoint_.node)
          const fromSubgraph = layoutSubgraphs.get(fromEndpoint.node)
          const toSubgraph = layoutSubgraphs.get(toEndpoint_.node)

          // Get position and size for from/to (either node or subgraph)
          // LayoutSubgraph uses bounds {x, y, width, height}, convert to position/size format
          const fromLayout =
            fromNode ||
            (fromSubgraph
              ? {
                  position: {
                    x: fromSubgraph.bounds.x + fromSubgraph.bounds.width / 2,
                    y: fromSubgraph.bounds.y + fromSubgraph.bounds.height / 2,
                  },
                  size: { width: fromSubgraph.bounds.width, height: fromSubgraph.bounds.height },
                }
              : null)
          const toLayout =
            toNode ||
            (toSubgraph
              ? {
                  position: {
                    x: toSubgraph.bounds.x + toSubgraph.bounds.width / 2,
                    y: toSubgraph.bounds.y + toSubgraph.bounds.height / 2,
                  },
                  size: { width: toSubgraph.bounds.width, height: toSubgraph.bounds.height },
                }
              : null)

          if (!fromLayout || !toLayout) continue

          let points: Position[] = []

          // Check if this is a subgraph-to-subgraph edge
          const isSubgraphEdge = fromSubgraph || toSubgraph

          // HA edges inside HA containers: use ELK's edge routing directly
          if (isHAContainer(container.id) && elkEdge.sections && elkEdge.sections.length > 0) {
            const section = elkEdge.sections[0]
            points.push({ x: section.startPoint.x, y: section.startPoint.y })
            if (section.bendPoints) {
              for (const bp of section.bendPoints) {
                points.push({ x: bp.x, y: bp.y })
              }
            }
            points.push({ x: section.endPoint.x, y: section.endPoint.y })
          } else if (isSubgraphEdge) {
            // Subgraph edges: use ELK's coordinates directly
            if (elkEdge.sections && elkEdge.sections.length > 0) {
              const section = elkEdge.sections[0]
              points.push({ x: section.startPoint.x, y: section.startPoint.y })
              if (section.bendPoints) {
                for (const bp of section.bendPoints) {
                  points.push({ x: bp.x, y: bp.y })
                }
              }
              points.push({ x: section.endPoint.x, y: section.endPoint.y })
            } else {
              // Fallback: simple line between centers
              points = [
                { x: fromLayout.position.x, y: fromLayout.position.y + fromLayout.size.height / 2 },
                { x: toLayout.position.x, y: toLayout.position.y - toLayout.size.height / 2 },
              ]
            }
          } else if (!isHAContainer(container.id)) {
            // Check if this is a cross-subgraph edge
            const fromParent = graph.nodes.find((n) => n.id === fromEndpoint.node)?.parent
            const toParent = graph.nodes.find((n) => n.id === toEndpoint_.node)?.parent
            const isCrossSubgraph = fromParent !== toParent

            if (elkEdge.sections && elkEdge.sections.length > 0) {
              const section = elkEdge.sections[0]

              if (isCrossSubgraph) {
                // Cross-subgraph edges: use ELK's coordinates directly
                points.push({ x: section.startPoint.x, y: section.startPoint.y })
                if (section.bendPoints) {
                  for (const bp of section.bendPoints) {
                    points.push({ x: bp.x, y: bp.y })
                  }
                }
                points.push({ x: section.endPoint.x, y: section.endPoint.y })
              } else {
                // Same-subgraph edges: snap to node boundaries for cleaner look
                const fromBottomY = fromLayout.position.y + fromLayout.size.height / 2
                const toTopY = toLayout.position.y - toLayout.size.height / 2

                points.push({
                  x: section.startPoint.x,
                  y: fromBottomY,
                })

                if (section.bendPoints) {
                  for (const bp of section.bendPoints) {
                    points.push({ x: bp.x, y: bp.y })
                  }
                }

                points.push({
                  x: section.endPoint.x,
                  y: toTopY,
                })
              }
            } else {
              const fromBottomY = fromLayout.position.y + fromLayout.size.height / 2
              const toTopY = toLayout.position.y - toLayout.size.height / 2
              points = this.generateOrthogonalPath(
                { x: fromLayout.position.x, y: fromBottomY },
                { x: toLayout.position.x, y: toTopY },
              )
            }
          } else {
            // HA edge fallback: simple horizontal line
            const leftLayout = fromLayout.position.x < toLayout.position.x ? fromLayout : toLayout
            const rightLayout = fromLayout.position.x < toLayout.position.x ? toLayout : fromLayout
            const y = (leftLayout.position.y + rightLayout.position.y) / 2
            points = [
              { x: leftLayout.position.x + leftLayout.size.width / 2, y },
              { x: rightLayout.position.x - rightLayout.size.width / 2, y },
            ]
          }

          layoutLinks.set(id, {
            id,
            from: fromEndpoint.node,
            to: toEndpoint_.node,
            fromEndpoint,
            toEndpoint: toEndpoint_,
            points,
            link,
          })
        }
      }

      // Recursively process child containers (subgraphs and HA containers)
      if (container.children) {
        for (const child of container.children) {
          if (subgraphMap.has(child.id) || child.id.startsWith('__ha_container_')) {
            processEdgesInContainer(child)
          }
        }
      }
    }

    // Process all edges (coordinates are absolute with edgeCoords=ROOT)
    processEdgesInContainer(elkGraph)

    // Fallback for any missing links
    for (const [index, link] of graph.links.entries()) {
      const id = link.id || `link-${index}`
      if (layoutLinks.has(id)) continue

      const fromEndpoint = toEndpoint(link.from)
      const toEndpoint_ = toEndpoint(link.to)
      const fromNode = layoutNodes.get(fromEndpoint.node)
      const toNode = layoutNodes.get(toEndpoint_.node)
      if (!fromNode || !toNode) continue

      const startY = fromNode.position.y + fromNode.size.height / 2
      const endY = toNode.position.y - toNode.size.height / 2
      const points = this.generateOrthogonalPath(
        { x: fromNode.position.x, y: startY },
        { x: toNode.position.x, y: endY },
      )

      layoutLinks.set(id, {
        id,
        from: fromEndpoint.node,
        to: toEndpoint_.node,
        fromEndpoint,
        toEndpoint: toEndpoint_,
        points,
        link,
      })
    }

    // Calculate bounds
    const bounds = this.calculateTotalBounds(layoutNodes, layoutSubgraphs)

    return {
      nodes: layoutNodes,
      links: layoutLinks,
      subgraphs: layoutSubgraphs,
      bounds,
    }
  }

  // Synchronous wrapper
  layout(graph: NetworkGraph): LayoutResult {
    const options = this.getEffectiveOptions(graph)
    const result = this.calculateFallbackLayout(graph, options.direction)

    // Start async layout
    this.layoutAsync(graph)
      .then((asyncResult) => {
        Object.assign(result, asyncResult)
      })
      .catch(() => {})

    return result
  }

  private toElkDirection(direction: LayoutDirection): string {
    switch (direction) {
      case 'TB':
        return 'DOWN'
      case 'BT':
        return 'UP'
      case 'LR':
        return 'RIGHT'
      case 'RL':
        return 'LEFT'
      default:
        return 'DOWN'
    }
  }

  /**
   * Convert EdgeStyle to ELK edgeRouting option
   * Note: 'straight' is handled by the renderer, not ELK
   */
  private toElkEdgeRouting(edgeStyle: EdgeStyle): string {
    switch (edgeStyle) {
      case 'polyline':
        return 'POLYLINE'
      case 'orthogonal':
        return 'ORTHOGONAL'
      case 'splines':
        return 'SPLINES'
      case 'straight':
        // For straight lines, we still need ELK to compute routes
        // The renderer will ignore bend points and draw direct lines
        return 'POLYLINE'
      default:
        return 'ORTHOGONAL'
    }
  }

  /**
   * Convert SplineMode to ELK spline mode option
   */
  private toElkSplineMode(splineMode: SplineMode): string {
    switch (splineMode) {
      case 'sloppy':
        return 'SLOPPY'
      case 'conservative':
        return 'CONSERVATIVE'
      case 'conservative_soft':
        return 'CONSERVATIVE_SOFT'
      default:
        return 'SLOPPY'
    }
  }

  /**
   * Get icon key for a node (service/resource or service or model)
   */
  private getIconKey(node: Node): string | undefined {
    if (node.service && node.resource) {
      return `${node.service}/${node.resource}`
    }
    return node.service || node.model
  }

  /**
   * Get icon aspect ratio for a node
   * Returns null if no CDN icon dimensions available
   */
  private getIconAspectRatio(node: Node): number | null {
    const iconKey = this.getIconKey(node)
    if (!node.vendor || !iconKey) return null

    // Use pre-resolved CDN icon dimensions
    const dimensionKey = `${node.vendor.toLowerCase()}/${iconKey.toLowerCase().replace(/\//g, '-')}`
    const cdnDims = this.options.iconDimensions?.get(dimensionKey)
    if (cdnDims) {
      return cdnDims.width / cdnDims.height
    }

    return null
  }

  private calculateNodeHeight(node: Node, _portCount = 0): number {
    const lines = Array.isArray(node.label) ? node.label.length : 1
    const labelHeight = lines * LABEL_LINE_HEIGHT

    // Calculate icon height (fixed at DEFAULT_ICON_SIZE for CDN icons)
    let iconHeight = 0
    const aspectRatio = this.getIconAspectRatio(node)
    if (aspectRatio !== null) {
      iconHeight = DEFAULT_ICON_SIZE
    } else if (node.type && getDeviceIcon(node.type)) {
      iconHeight = DEFAULT_ICON_SIZE
    }

    const gap = iconHeight > 0 ? ICON_LABEL_GAP : 0
    const contentHeight = iconHeight + gap + labelHeight
    return Math.max(this.options.nodeHeight, contentHeight + NODE_VERTICAL_PADDING)
  }

  private calculatePortSpacing(
    portNames: Set<string> | undefined,
    minSpacing: number,
  ): number {
    if (!portNames || portNames.size === 0) return minSpacing

    let maxLabelLength = 0
    for (const name of portNames) {
      maxLabelLength = Math.max(maxLabelLength, name.length)
    }

    const charWidth = PORT_LABEL_FONT_SIZE * CHAR_WIDTH_RATIO
    const maxLabelWidth = maxLabelLength * charWidth
    const spacingFromLabel = maxLabelWidth + PORT_LABEL_PADDING
    return Math.max(minSpacing, spacingFromLabel)
  }

  private calculateNodeWidth(
    node: Node,
    portInfo: NodePortInfo | undefined,
    portSpacingMin: number,
  ): number {
    const labels = Array.isArray(node.label) ? node.label : [node.label]
    const maxLabelLength = Math.max(...labels.map((l) => l.length))
    const labelWidth = maxLabelLength * ESTIMATED_CHAR_WIDTH

    const topCount = portInfo?.top.size || 0
    const bottomCount = portInfo?.bottom.size || 0
    const maxPortsPerSide = Math.max(topCount, bottomCount)

    const portSpacing = this.calculatePortSpacing(portInfo?.all, portSpacingMin)
    const edgeMargin = Math.round(portSpacingMin / 2)
    const portWidth = maxPortsPerSide > 0 ? (maxPortsPerSide - 1) * portSpacing + edgeMargin * 2 : 0

    // Calculate icon width based on aspect ratio
    let iconWidth = DEFAULT_ICON_SIZE
    const aspectRatio = this.getIconAspectRatio(node)
    if (aspectRatio !== null) {
      iconWidth = Math.round(DEFAULT_ICON_SIZE * aspectRatio)
    }

    const paddedContentWidth = Math.max(labelWidth, 0) + NODE_HORIZONTAL_PADDING
    const paddedIconLabelWidth = Math.max(iconWidth, labelWidth) + NODE_HORIZONTAL_PADDING
    return Math.max(paddedIconLabelWidth, portWidth, paddedContentWidth)
  }

  private calculateTotalBounds(
    nodes: Map<string, LayoutNode>,
    subgraphs: Map<string, LayoutSubgraph>,
  ): Bounds {
    let minX = Number.POSITIVE_INFINITY
    let minY = Number.POSITIVE_INFINITY
    let maxX = Number.NEGATIVE_INFINITY
    let maxY = Number.NEGATIVE_INFINITY

    for (const node of nodes.values()) {
      let left = node.position.x - node.size.width / 2
      let right = node.position.x + node.size.width / 2
      let top = node.position.y - node.size.height / 2
      let bottom = node.position.y + node.size.height / 2

      if (node.ports) {
        for (const port of node.ports.values()) {
          const portX = node.position.x + port.position.x
          const portY = node.position.y + port.position.y
          left = Math.min(left, portX - port.size.width / 2)
          right = Math.max(right, portX + port.size.width / 2)
          top = Math.min(top, portY - port.size.height / 2)
          bottom = Math.max(bottom, portY + port.size.height / 2)
        }
      }

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

    if (minX === Number.POSITIVE_INFINITY) {
      return { x: 0, y: 0, width: 400, height: 300 }
    }

    return {
      x: minX - padding,
      y: minY - padding,
      width: maxX - minX + padding * 2,
      height: maxY - minY + padding * 2,
    }
  }

  private calculateFallbackLayout(graph: NetworkGraph, _direction: LayoutDirection): LayoutResult {
    const spacing = getLayoutSpacingConstraints(graph)
    const layoutNodes = new Map<string, LayoutNode>()
    const layoutSubgraphs = new Map<string, LayoutSubgraph>()
    const layoutLinks = new Map<string, LayoutLink>()

    // Detect HA pairs for port assignment
    const haPairs = this.detectHAPairs(graph)
    const haPairSet = new Set<string>()
    for (const pair of haPairs) {
      haPairSet.add([pair.nodeA, pair.nodeB].sort().join(':'))
    }
    const nodePorts = collectNodePorts(graph, haPairSet)

    let x = 100
    let y = 100
    let col = 0
    const maxCols = 4
    const rowHeight = this.options.nodeHeight + this.options.rankSpacing

    for (const node of graph.nodes) {
      const portInfo = nodePorts.get(node.id)
      const portCount = portInfo?.all.size || 0
      const height = this.calculateNodeHeight(node, portCount)
      const width = this.calculateNodeWidth(node, portInfo, spacing.portSpacingMin)
      const colWidth = width + this.options.nodeSpacing

      layoutNodes.set(node.id, {
        id: node.id,
        position: { x: x + width / 2, y: y + height / 2 },
        size: { width, height },
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

    for (const [index, link] of graph.links.entries()) {
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
    }

    const bounds = this.calculateTotalBounds(layoutNodes, layoutSubgraphs)

    return {
      nodes: layoutNodes,
      links: layoutLinks,
      subgraphs: layoutSubgraphs,
      bounds,
      metadata: { algorithm: 'fallback-grid', duration: 0 },
    }
  }

  /** Detect HA pairs from redundancy links */
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

  /** Generate orthogonal path between two points */
  private generateOrthogonalPath(start: Position, end: Position): Position[] {
    const dx = end.x - start.x
    const dy = end.y - start.y

    // If points are nearly aligned, use direct line
    if (Math.abs(dx) < 5) {
      return [start, end]
    }
    if (Math.abs(dy) < 5) {
      return [start, end]
    }

    // Use midpoint for orthogonal routing
    const midY = start.y + dy / 2

    return [start, { x: start.x, y: midY }, { x: end.x, y: midY }, end]
  }
}

// Default instance
