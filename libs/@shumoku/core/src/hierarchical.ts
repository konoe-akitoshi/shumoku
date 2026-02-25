/**
 * Hierarchical sheet generation utilities
 * Shared logic for building child sheets with export connectors
 */

import type { LayoutResult, Link, NetworkGraph, Node, Subgraph } from './models/types.js'

// ============================================
// Constants
// ============================================

const EXPORT_NODE_PREFIX = '__export_'
const EXPORT_LINK_PREFIX = '__export_link_'

// ============================================
// Types
// ============================================

export interface SheetData {
  graph: NetworkGraph
  layout: LayoutResult
}

export interface LayoutEngine {
  layoutAsync(graph: NetworkGraph): Promise<LayoutResult>
}

interface ExportConnection {
  device: string
  port?: string
  destDevice: string
  destPort?: string
}

interface ExportPoint {
  subgraphId: string
  destSubgraphId: string
  destSubgraphLabel: string
  isSource: boolean
  connections: ExportConnection[]
}

// ============================================
// Type Guards
// ============================================

/**
 * Check if a node is a virtual export connector
 */
export function isExportNode(nodeId: string): boolean {
  return nodeId.startsWith(EXPORT_NODE_PREFIX)
}

/**
 * Check if a link is a virtual export connector link
 */
export function isExportLink(linkId: string): boolean {
  return linkId.startsWith(EXPORT_LINK_PREFIX)
}

// ============================================
// Main Function
// ============================================

/**
 * Build hierarchical sheets from a root graph
 *
 * Creates child sheets for each subgraph with:
 * - Filtered nodes (only those belonging to the subgraph and descendants)
 * - Internal links (both endpoints in subgraph/descendants)
 * - Nested subgraph definitions
 * - Export connector nodes/links for boundary connections
 *
 * @param graph - Root network graph with subgraphs
 * @param rootLayout - Layout result for the root graph
 * @param layoutEngine - Engine to layout child sheets
 * @returns Map of sheet ID to SheetData (includes 'root')
 */
export async function buildHierarchicalSheets(
  graph: NetworkGraph,
  rootLayout: LayoutResult,
  layoutEngine: LayoutEngine,
): Promise<Map<string, SheetData>> {
  const sheets = new Map<string, SheetData>()

  // Add root sheet
  sheets.set('root', { graph, layout: rootLayout })

  if (!graph.subgraphs || graph.subgraphs.length === 0) {
    return sheets
  }

  // Find top-level subgraphs (those without a parent or with parent not in subgraphs)
  const allSubgraphIds = new Set(graph.subgraphs.map((sg) => sg.id))
  const topLevelSubgraphs = graph.subgraphs.filter(
    (sg) => !sg.parent || !allSubgraphIds.has(sg.parent),
  )

  // Mark top-level subgraphs as clickable (only if not already set)
  for (const sg of topLevelSubgraphs) {
    if (!sg.file) {
      sg.file = sg.id
    }
  }

  // Build child sheets for top-level subgraphs only
  for (const sg of topLevelSubgraphs) {
    const childSheet = await buildChildSheet(graph, sg, layoutEngine)
    sheets.set(sg.id, childSheet)
  }

  return sheets
}

// ============================================
// Internal Functions
// ============================================

async function buildChildSheet(
  rootGraph: NetworkGraph,
  subgraph: Subgraph,
  layoutEngine: LayoutEngine,
): Promise<SheetData> {
  // Get nodes belonging to this subgraph or any descendant
  // A node belongs if its parent is this subgraph or starts with `subgraph.id/`
  const childNodes = rootGraph.nodes.filter((n) => {
    if (!n.parent) return false
    return n.parent === subgraph.id || n.parent.startsWith(`${subgraph.id}/`)
  })
  const childNodeIds = new Set(childNodes.map((n) => n.id))

  // Get nested subgraphs (direct children of this subgraph)
  const nestedSubgraphs = rootGraph.subgraphs?.filter((sg) => {
    // A subgraph is nested if its id starts with `subgraph.id/` but not deeper
    if (!sg.id.startsWith(`${subgraph.id}/`)) return false
    const suffix = sg.id.slice(subgraph.id.length + 1)
    return !suffix.includes('/') // Only direct children, not grandchildren
  })

  // Get internal links (both endpoints in subgraph or descendants)
  const childLinks = rootGraph.links.filter((l) => {
    const fromNode = typeof l.from === 'string' ? l.from : l.from.node
    const toNode = typeof l.to === 'string' ? l.to : l.to.node
    return childNodeIds.has(fromNode) && childNodeIds.has(toNode)
  })

  // Generate export connectors for boundary connections
  const { exportNodes, exportLinks } = generateExportConnectors(
    rootGraph,
    subgraph.id,
    childNodeIds,
  )

  // Transform node parents: remove the subgraph prefix for nested structures
  // e.g., `perimeter/edge` -> `edge`
  const transformedNodes = childNodes.map((n) => {
    let newParent = n.parent
    if (newParent && newParent.startsWith(`${subgraph.id}/`)) {
      newParent = newParent.slice(subgraph.id.length + 1)
    } else if (newParent === subgraph.id) {
      newParent = undefined
    }
    return { ...n, parent: newParent }
  })

  // Transform nested subgraph IDs: remove the parent prefix
  const transformedSubgraphs = nestedSubgraphs?.map((sg) => ({
    ...sg,
    id: sg.id.slice(subgraph.id.length + 1),
    parent: sg.parent?.startsWith(`${subgraph.id}/`)
      ? sg.parent.slice(subgraph.id.length + 1)
      : undefined,
  }))

  // Build child graph
  const childGraph: NetworkGraph = {
    ...rootGraph,
    name: subgraph.label,
    nodes: [...transformedNodes, ...exportNodes],
    links: [...childLinks, ...exportLinks],
    subgraphs:
      transformedSubgraphs && transformedSubgraphs.length > 0 ? transformedSubgraphs : undefined,
  }

  // Layout child sheet
  const childLayout = await layoutEngine.layoutAsync(childGraph)

  return { graph: childGraph, layout: childLayout }
}

function generateExportConnectors(
  rootGraph: NetworkGraph,
  subgraphId: string,
  childNodeIds: Set<string>,
): { exportNodes: Node[]; exportLinks: Link[] } {
  const exportNodes: Node[] = []
  const exportLinks: Link[] = []
  const exportPoints = new Map<string, ExportPoint>()

  // Find boundary links and group by destination subgraph
  for (const link of rootGraph.links) {
    const fromNode = typeof link.from === 'string' ? link.from : link.from.node
    const toNode = typeof link.to === 'string' ? link.to : link.to.node
    const fromPort = typeof link.from === 'object' ? link.from.port : undefined
    const toPort = typeof link.to === 'object' ? link.to.port : undefined

    const fromInside = childNodeIds.has(fromNode)
    const toInside = childNodeIds.has(toNode)

    if (fromInside && !toInside) {
      // Outgoing connection - group by destination subgraph
      const destSubgraph = findNodeSubgraph(rootGraph, toNode)
      const destSubgraphId = destSubgraph?.id || '__external__'
      const key = `${subgraphId}:to:${destSubgraphId}`

      if (!exportPoints.has(key)) {
        exportPoints.set(key, {
          subgraphId,
          destSubgraphId,
          destSubgraphLabel: destSubgraph?.label || toNode,
          isSource: true,
          connections: [],
        })
      }
      exportPoints.get(key)!.connections.push({
        device: fromNode,
        port: fromPort,
        destDevice: toNode,
        destPort: toPort,
      })
    } else if (!fromInside && toInside) {
      // Incoming connection - group by source subgraph
      const srcSubgraph = findNodeSubgraph(rootGraph, fromNode)
      const srcSubgraphId = srcSubgraph?.id || '__external__'
      const key = `${subgraphId}:from:${srcSubgraphId}`

      if (!exportPoints.has(key)) {
        exportPoints.set(key, {
          subgraphId,
          destSubgraphId: srcSubgraphId,
          destSubgraphLabel: srcSubgraph?.label || fromNode,
          isSource: false,
          connections: [],
        })
      }
      exportPoints.get(key)!.connections.push({
        device: toNode,
        port: toPort,
        destDevice: fromNode,
        destPort: fromPort,
      })
    }
  }

  // Create export nodes and links
  for (const [key, exportPoint] of exportPoints) {
    const exportId = key.replace(/:/g, '_')
    const exportNodeId = `${EXPORT_NODE_PREFIX}${exportId}`

    // Export node (one per destination subgraph)
    exportNodes.push({
      id: exportNodeId,
      label: exportPoint.destSubgraphLabel,
      shape: 'stadium',
      metadata: {
        _isExport: true,
        _destSubgraph: exportPoint.destSubgraphLabel,
        _destSubgraphId: exportPoint.destSubgraphId,
        _isSource: exportPoint.isSource,
        _connectionCount: exportPoint.connections.length,
      },
    })

    // Export links (one per connection)
    for (let i = 0; i < exportPoint.connections.length; i++) {
      const conn = exportPoint.connections[i]
      const deviceEndpoint = conn.port ? { node: conn.device, port: conn.port } : conn.device

      exportLinks.push({
        id: `${EXPORT_LINK_PREFIX}${exportId}_${i}`,
        from: exportPoint.isSource ? deviceEndpoint : exportNodeId,
        to: exportPoint.isSource ? exportNodeId : deviceEndpoint,
        type: 'dashed',
        arrow: 'forward',
        metadata: {
          _destSubgraphLabel: exportPoint.destSubgraphLabel,
          _destDevice: conn.destDevice,
          _destPort: conn.destPort,
        },
      })
    }
  }

  return { exportNodes, exportLinks }
}

/**
 * Find the top-level subgraph that a node belongs to
 * For nested subgraphs like 'cloud/aws', returns the 'cloud' subgraph
 */
function findNodeSubgraph(graph: NetworkGraph, nodeId: string): Subgraph | undefined {
  const node = graph.nodes.find((n) => n.id === nodeId)
  if (!node?.parent) return undefined

  // Extract top-level subgraph ID (e.g., 'cloud/aws' → 'cloud')
  const topLevelId = node.parent.split('/')[0]
  return graph.subgraphs?.find((s) => s.id === topLevelId)
}
