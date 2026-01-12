/**
 * Hierarchical Layout Engine
 * Uses ELK.js for advanced graph layout with proper edge routing
 */

import ELK, { type ElkNode, type ElkExtendedEdge, type LayoutOptions } from 'elkjs/lib/elk.bundled.js'
import {
  type NetworkGraph,
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
} from '../models/index.js'
import { getVendorIconEntry, getDeviceIcon } from '../icons/index.js'
import {
  DEFAULT_ICON_SIZE,
  ICON_LABEL_GAP,
  LABEL_LINE_HEIGHT,
  NODE_VERTICAL_PADDING,
  NODE_HORIZONTAL_PADDING,
  MIN_PORT_SPACING,
  PORT_LABEL_FONT_SIZE,
  CHAR_WIDTH_RATIO,
  PORT_LABEL_PADDING,
  ESTIMATED_CHAR_WIDTH,
  MAX_ICON_WIDTH_RATIO,
} from '../constants.js'

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
  return endpoint
}

/** Collect ports for each node from links */
function collectNodePorts(
  graph: NetworkGraph,
  haPairSet: Set<string>
): Map<string, NodePortInfo> {
  const nodePorts = new Map<string, NodePortInfo>()

  const getOrCreate = (nodeId: string): NodePortInfo => {
    if (!nodePorts.has(nodeId)) {
      nodePorts.set(nodeId, { all: new Set(), top: new Set(), bottom: new Set(), left: new Set(), right: new Set() })
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
}

const DEFAULT_OPTIONS: Required<HierarchicalLayoutOptions> = {
  direction: 'TB',
  nodeWidth: 180,
  nodeHeight: 60,
  nodeSpacing: 40,
  rankSpacing: 60,
  subgraphPadding: 24,
  subgraphLabelHeight: 24,
}

// ============================================
// Layout Engine
// ============================================

export class HierarchicalLayout {
  private options: Required<HierarchicalLayoutOptions>
  private elk: InstanceType<typeof ELK>

  constructor(options?: HierarchicalLayoutOptions) {
    this.options = { ...DEFAULT_OPTIONS, ...options }
    this.elk = new ELK()
  }

  /**
   * Calculate dynamic spacing based on graph complexity
   */
  private calculateDynamicSpacing(graph: NetworkGraph): { nodeSpacing: number; rankSpacing: number; subgraphPadding: number } {
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

  private getEffectiveOptions(graph: NetworkGraph): Required<HierarchicalLayoutOptions> {
    const settings = graph.settings
    const dynamicSpacing = this.calculateDynamicSpacing(graph)

    return {
      ...this.options,
      direction: settings?.direction || this.options.direction,
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

    const nodePorts = collectNodePorts(graph, haPairSet)

    // Build ELK graph
    const elkGraph = this.buildElkGraph(graph, options, nodePorts, haPairs)

    // Run ELK layout
    const layoutedGraph = await this.elk.layout(elkGraph)

    // Extract results using ELK's positions and edge routes
    const result = this.extractLayoutResult(graph, layoutedGraph, nodePorts, options)

    result.metadata = {
      algorithm: 'elk-layered',
      duration: performance.now() - startTime,
    }

    return result
  }

  /**
   * Build ELK graph - uses container nodes for HA pairs
   */
  private buildElkGraph(
    graph: NetworkGraph,
    options: Required<HierarchicalLayoutOptions>,
    nodePorts: Map<string, NodePortInfo>,
    haPairs: { nodeA: string; nodeB: string }[]
  ): ElkNode {
    const elkDirection = this.toElkDirection(options.direction)

    // Build subgraph map
    const subgraphMap = new Map<string, Subgraph>()
    if (graph.subgraphs) {
      for (const sg of graph.subgraphs) {
        subgraphMap.set(sg.id, sg)
      }
    }

    // Build HA container map: node ID -> container ID
    const nodeToHAContainer = new Map<string, string>()
    const haPairMap = new Map<string, { nodeA: string; nodeB: string }>()
    haPairs.forEach((pair, idx) => {
      const containerId = `__ha_container_${idx}`
      nodeToHAContainer.set(pair.nodeA, containerId)
      nodeToHAContainer.set(pair.nodeB, containerId)
      haPairMap.set(containerId, pair)
    })

    // Create ELK node
    const createElkNode = (node: Node): ElkNode => {
      const portInfo = nodePorts.get(node.id)
      const portCount = portInfo?.all.size || 0
      const height = this.calculateNodeHeight(node, portCount)
      const width = this.calculateNodeWidth(node, portInfo)

      const elkNode: ElkNode = {
        id: node.id,
        width,
        height,
        labels: [{ text: Array.isArray(node.label) ? node.label.join('\n') : node.label }],
      }

      // Add ports
      if (portInfo && portInfo.all.size > 0) {
        elkNode.ports = []

        // Top ports (incoming)
        const topPorts = Array.from(portInfo.top)
        topPorts.forEach((portName, i) => {
          const portX = (width / (topPorts.length + 1)) * (i + 1)
          elkNode.ports!.push({
            id: `${node.id}:${portName}`,
            width: PORT_WIDTH,
            height: PORT_HEIGHT,
            x: portX - PORT_WIDTH / 2,
            y: 0,
            labels: [{ text: portName }],
            layoutOptions: { 'elk.port.side': 'NORTH' },
          })
        })

        // Bottom ports (outgoing)
        const bottomPorts = Array.from(portInfo.bottom)
        bottomPorts.forEach((portName, i) => {
          const portX = (width / (bottomPorts.length + 1)) * (i + 1)
          elkNode.ports!.push({
            id: `${node.id}:${portName}`,
            width: PORT_WIDTH,
            height: PORT_HEIGHT,
            x: portX - PORT_WIDTH / 2,
            y: height - PORT_HEIGHT,
            labels: [{ text: portName }],
            layoutOptions: { 'elk.port.side': 'SOUTH' },
          })
        })

        // Left ports (HA)
        const leftPorts = Array.from(portInfo.left)
        leftPorts.forEach((portName, i) => {
          const portY = (height / (leftPorts.length + 1)) * (i + 1)
          elkNode.ports!.push({
            id: `${node.id}:${portName}`,
            width: PORT_WIDTH,
            height: PORT_HEIGHT,
            x: 0,
            y: portY - PORT_HEIGHT / 2,
            labels: [{ text: portName }],
            layoutOptions: { 'elk.port.side': 'WEST' },
          })
        })

        // Right ports (HA)
        const rightPorts = Array.from(portInfo.right)
        rightPorts.forEach((portName, i) => {
          const portY = (height / (rightPorts.length + 1)) * (i + 1)
          elkNode.ports!.push({
            id: `${node.id}:${portName}`,
            width: PORT_WIDTH,
            height: PORT_HEIGHT,
            x: width - PORT_WIDTH,
            y: portY - PORT_HEIGHT / 2,
            labels: [{ text: portName }],
            layoutOptions: { 'elk.port.side': 'EAST' },
          })
        })

        elkNode.layoutOptions = { 'elk.portConstraints': 'FIXED_SIDE' }
      }

      return elkNode
    }

    // Create HA container node
    const createHAContainerNode = (containerId: string, pair: { nodeA: string; nodeB: string }): ElkNode | null => {
      const nodeA = graph.nodes.find(n => n.id === pair.nodeA)
      const nodeB = graph.nodes.find(n => n.id === pair.nodeB)
      if (!nodeA || !nodeB) return null

      const childA = createElkNode(nodeA)
      const childB = createElkNode(nodeB)

      // Find HA link
      const haLink = graph.links.find(link => {
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
    const createSubgraphNode = (subgraph: Subgraph, edgesByContainer: Map<string, ElkExtendedEdge[]>): ElkNode => {
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

      return {
        id: subgraph.id,
        labels: [{ text: subgraph.label }],
        children: childNodes,
        edges: sgEdges,
        layoutOptions: {
          'elk.padding': `[top=${sgPadding + options.subgraphLabelHeight},left=${sgPadding},bottom=${sgPadding},right=${sgPadding}]`,
        },
      }
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

    // Build node to parent map
    const nodeParentMap = new Map<string, string | undefined>()
    for (const node of graph.nodes) {
      nodeParentMap.set(node.id, node.parent)
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

    graph.links.forEach((link, index) => {
      const from = toEndpoint(link.from)
      const to = toEndpoint(link.to)

      // Skip HA links (they're inside HA containers)
      if (link.redundancy && isHALink(from.node, to.node)) {
        return
      }

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
        edge.labels = [{
          text: labelParts.join('\n'),
          layoutOptions: { 'elk.edgeLabels.placement': 'CENTER' }
        }]
      }

      // Find LCA and place edge in appropriate container
      const lca = findLCA(from.node, to.node)
      let container = lca
      if (container === from.node || container === to.node) {
        container = nodeParentMap.get(container)
      }

      const containerId = container && subgraphMap.has(container) ? container : 'root'
      edgesByContainer.get(containerId)!.push(edge)
    })

    // Dynamic edge spacing
    const edgeNodeSpacing = Math.max(10, Math.round(options.nodeSpacing * 0.4))
    const edgeEdgeSpacing = Math.max(8, Math.round(options.nodeSpacing * 0.25))

    // Root layout options
    const rootLayoutOptions: LayoutOptions = {
      'elk.algorithm': 'layered',
      'elk.direction': elkDirection,
      'elk.spacing.nodeNode': String(options.nodeSpacing),
      'elk.layered.spacing.nodeNodeBetweenLayers': String(options.rankSpacing),
      'elk.spacing.edgeNode': String(edgeNodeSpacing),
      'elk.spacing.edgeEdge': String(edgeEdgeSpacing),
      'elk.layered.compaction.postCompaction.strategy': 'EDGE_LENGTH',
      'elk.layered.compaction.connectedComponents': 'true',
      'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
      'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
      'elk.edgeRouting': 'ORTHOGONAL',
      'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
      // Use ROOT coordinate system
      'org.eclipse.elk.json.edgeCoords': 'ROOT',
      'org.eclipse.elk.json.shapeCoords': 'ROOT',
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
    _options: Required<HierarchicalLayoutOptions>
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
        layoutSubgraphs.set(elkNode.id, {
          id: elkNode.id,
          bounds: { x, y, width, height },
          subgraph: sg,
        })

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

            // Determine side based on relative position
            let side: 'top' | 'bottom' | 'left' | 'right' = 'bottom'
            const absRelX = Math.abs(relX)
            const absRelY = Math.abs(relY)
            if (absRelX > absRelY) {
              side = relX < 0 ? 'left' : 'right'
            } else {
              side = relY < 0 ? 'top' : 'bottom'
            }

            const portName = elkPort.id.includes(':') ? elkPort.id.split(':').slice(1).join(':') : elkPort.id

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
    const linkById = new Map<string, { link: typeof graph.links[0]; index: number }>()
    graph.links.forEach((link, index) => {
      linkById.set(link.id || `edge-${index}`, { link, index })
    })

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

          const fromNode = layoutNodes.get(fromEndpoint.node)
          const toNode = layoutNodes.get(toEndpoint_.node)
          if (!fromNode || !toNode) continue

          let points: Position[] = []

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
          } else if (!isHAContainer(container.id)) {
            // Normal vertical edges
            const fromBottomY = fromNode.position.y + fromNode.size.height / 2
            const toTopY = toNode.position.y - toNode.size.height / 2

            if (elkEdge.sections && elkEdge.sections.length > 0) {
              const section = elkEdge.sections[0]

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
            } else {
              points = this.generateOrthogonalPath(
                { x: fromNode.position.x, y: fromBottomY },
                { x: toNode.position.x, y: toTopY }
              )
            }
          } else {
            // HA edge fallback: simple horizontal line
            const leftNode = fromNode.position.x < toNode.position.x ? fromNode : toNode
            const rightNode = fromNode.position.x < toNode.position.x ? toNode : fromNode
            const y = (leftNode.position.y + rightNode.position.y) / 2
            points = [
              { x: leftNode.position.x + leftNode.size.width / 2, y },
              { x: rightNode.position.x - rightNode.size.width / 2, y },
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
    graph.links.forEach((link, index) => {
      const id = link.id || `link-${index}`
      if (layoutLinks.has(id)) return

      const fromEndpoint = toEndpoint(link.from)
      const toEndpoint_ = toEndpoint(link.to)
      const fromNode = layoutNodes.get(fromEndpoint.node)
      const toNode = layoutNodes.get(toEndpoint_.node)
      if (!fromNode || !toNode) return

      const startY = fromNode.position.y + fromNode.size.height / 2
      const endY = toNode.position.y - toNode.size.height / 2
      const points = this.generateOrthogonalPath(
        { x: fromNode.position.x, y: startY },
        { x: toNode.position.x, y: endY }
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
    })

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
    this.layoutAsync(graph).then((asyncResult) => {
      Object.assign(result, asyncResult)
    }).catch(() => {})

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

  private calculateNodeHeight(node: Node, portCount: number = 0): number {
    const lines = Array.isArray(node.label) ? node.label.length : 1
    const labelHeight = lines * LABEL_LINE_HEIGHT

    const labels = Array.isArray(node.label) ? node.label : [node.label]
    const maxLabelLength = Math.max(...labels.map(l => l.length))
    const labelWidth = maxLabelLength * ESTIMATED_CHAR_WIDTH
    const portWidth = portCount > 0 ? (portCount + 1) * MIN_PORT_SPACING : 0
    const baseContentWidth = Math.max(labelWidth, portWidth)
    const baseNodeWidth = Math.max(this.options.nodeWidth, baseContentWidth + NODE_HORIZONTAL_PADDING)
    const maxIconWidth = Math.round(baseNodeWidth * MAX_ICON_WIDTH_RATIO)

    let iconHeight = 0
    const iconKey = node.service || node.model
    if (node.vendor && iconKey) {
      const iconEntry = getVendorIconEntry(node.vendor, iconKey, node.resource)
      if (iconEntry) {
        const vendorIcon = iconEntry.default
        const viewBox = iconEntry.viewBox || '0 0 48 48'

        if (vendorIcon.startsWith('<svg')) {
          const viewBoxMatch = vendorIcon.match(/viewBox="0 0 (\d+) (\d+)"/)
          if (viewBoxMatch) {
            const vbWidth = parseInt(viewBoxMatch[1])
            const vbHeight = parseInt(viewBoxMatch[2])
            const aspectRatio = vbWidth / vbHeight
            let iconWidth = Math.round(DEFAULT_ICON_SIZE * aspectRatio)
            iconHeight = DEFAULT_ICON_SIZE
            if (iconWidth > maxIconWidth) {
              iconHeight = Math.round(maxIconWidth / aspectRatio)
            }
          } else {
            iconHeight = DEFAULT_ICON_SIZE
          }
        } else {
          const vbMatch = viewBox.match(/(\d+)\s+(\d+)\s+(\d+)\s+(\d+)/)
          if (vbMatch) {
            const vbWidth = parseInt(vbMatch[3])
            const vbHeight = parseInt(vbMatch[4])
            const aspectRatio = vbWidth / vbHeight
            let iconWidth = Math.round(DEFAULT_ICON_SIZE * aspectRatio)
            iconHeight = DEFAULT_ICON_SIZE
            if (iconWidth > maxIconWidth) {
              iconHeight = Math.round(maxIconWidth / aspectRatio)
            }
          } else {
            iconHeight = DEFAULT_ICON_SIZE
          }
        }
      }
    }

    if (iconHeight === 0 && node.type && getDeviceIcon(node.type)) {
      iconHeight = DEFAULT_ICON_SIZE
    }

    const gap = iconHeight > 0 ? ICON_LABEL_GAP : 0
    const contentHeight = iconHeight + gap + labelHeight
    return Math.max(this.options.nodeHeight, contentHeight + NODE_VERTICAL_PADDING)
  }

  private calculatePortSpacing(portNames: Set<string> | undefined): number {
    if (!portNames || portNames.size === 0) return MIN_PORT_SPACING

    let maxLabelLength = 0
    for (const name of portNames) {
      maxLabelLength = Math.max(maxLabelLength, name.length)
    }

    const charWidth = PORT_LABEL_FONT_SIZE * CHAR_WIDTH_RATIO
    const maxLabelWidth = maxLabelLength * charWidth
    const spacingFromLabel = maxLabelWidth + PORT_LABEL_PADDING
    return Math.max(MIN_PORT_SPACING, spacingFromLabel)
  }

  private calculateNodeWidth(node: Node, portInfo: NodePortInfo | undefined): number {
    const labels = Array.isArray(node.label) ? node.label : [node.label]
    const maxLabelLength = Math.max(...labels.map(l => l.length))
    const labelWidth = maxLabelLength * ESTIMATED_CHAR_WIDTH

    const topCount = portInfo?.top.size || 0
    const bottomCount = portInfo?.bottom.size || 0
    const maxPortsPerSide = Math.max(topCount, bottomCount)

    const portSpacing = this.calculatePortSpacing(portInfo?.all)
    const edgeMargin = Math.round(MIN_PORT_SPACING / 2)
    const portWidth = maxPortsPerSide > 0 ? (maxPortsPerSide - 1) * portSpacing + edgeMargin * 2 : 0

    const paddedContentWidth = Math.max(labelWidth, 0) + NODE_HORIZONTAL_PADDING
    const baseNodeWidth = Math.max(paddedContentWidth, portWidth)

    const maxIconWidth = Math.round(baseNodeWidth * MAX_ICON_WIDTH_RATIO)
    let iconWidth = DEFAULT_ICON_SIZE
    const iconKey = node.service || node.model
    if (node.vendor && iconKey) {
      const iconEntry = getVendorIconEntry(node.vendor, iconKey, node.resource)
      if (iconEntry) {
        const vendorIcon = iconEntry.default
        const viewBox = iconEntry.viewBox || '0 0 48 48'

        if (vendorIcon.startsWith('<svg')) {
          const viewBoxMatch = vendorIcon.match(/viewBox="0 0 (\d+) (\d+)"/)
          if (viewBoxMatch) {
            const vbWidth = parseInt(viewBoxMatch[1])
            const vbHeight = parseInt(viewBoxMatch[2])
            const aspectRatio = vbWidth / vbHeight
            iconWidth = Math.min(Math.round(DEFAULT_ICON_SIZE * aspectRatio), maxIconWidth)
          }
        } else {
          const vbMatch = viewBox.match(/(\d+)\s+(\d+)\s+(\d+)\s+(\d+)/)
          if (vbMatch) {
            const vbWidth = parseInt(vbMatch[3])
            const vbHeight = parseInt(vbMatch[4])
            const aspectRatio = vbWidth / vbHeight
            iconWidth = Math.min(Math.round(DEFAULT_ICON_SIZE * aspectRatio), maxIconWidth)
          }
        }
      }
    }

    const paddedIconLabelWidth = Math.max(iconWidth, labelWidth) + NODE_HORIZONTAL_PADDING
    return Math.max(paddedIconLabelWidth, portWidth)
  }

  private calculateTotalBounds(
    nodes: Map<string, LayoutNode>,
    subgraphs: Map<string, LayoutSubgraph>
  ): Bounds {
    let minX = Infinity, minY = Infinity
    let maxX = -Infinity, maxY = -Infinity

    nodes.forEach((node) => {
      let left = node.position.x - node.size.width / 2
      let right = node.position.x + node.size.width / 2
      let top = node.position.y - node.size.height / 2
      let bottom = node.position.y + node.size.height / 2

      if (node.ports) {
        node.ports.forEach((port) => {
          const portX = node.position.x + port.position.x
          const portY = node.position.y + port.position.y
          left = Math.min(left, portX - port.size.width / 2)
          right = Math.max(right, portX + port.size.width / 2)
          top = Math.min(top, portY - port.size.height / 2)
          bottom = Math.max(bottom, portY + port.size.height / 2)
        })
      }

      minX = Math.min(minX, left)
      minY = Math.min(minY, top)
      maxX = Math.max(maxX, right)
      maxY = Math.max(maxY, bottom)
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

  private calculateFallbackLayout(graph: NetworkGraph, _direction: LayoutDirection): LayoutResult {
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

    let x = 100, y = 100, col = 0
    const maxCols = 4
    const rowHeight = this.options.nodeHeight + this.options.rankSpacing

    for (const node of graph.nodes) {
      const portInfo = nodePorts.get(node.id)
      const portCount = portInfo?.all.size || 0
      const height = this.calculateNodeHeight(node, portCount)
      const width = this.calculateNodeWidth(node, portInfo)
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

    return [
      start,
      { x: start.x, y: midY },
      { x: end.x, y: midY },
      end,
    ]
  }
}

// Default instance
export const hierarchicalLayout = new HierarchicalLayout()
