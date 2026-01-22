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

interface ExportPoint {
  subgraphId: string
  device: string
  port?: string
  destSubgraphLabel: string
  destDevice: string
  destPort?: string
  isSource: boolean
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

  // Mark top-level subgraphs as clickable
  for (const sg of topLevelSubgraphs) {
    sg.file = sg.id
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
    subgraphs: transformedSubgraphs && transformedSubgraphs.length > 0 ? transformedSubgraphs : undefined,
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

  // Find boundary links
  for (const link of rootGraph.links) {
    const fromNode = typeof link.from === 'string' ? link.from : link.from.node
    const toNode = typeof link.to === 'string' ? link.to : link.to.node
    const fromPort = typeof link.from === 'object' ? link.from.port : undefined
    const toPort = typeof link.to === 'object' ? link.to.port : undefined

    const fromInside = childNodeIds.has(fromNode)
    const toInside = childNodeIds.has(toNode)

    if (fromInside && !toInside) {
      // Outgoing connection
      const key = `${subgraphId}:${fromNode}:${fromPort || ''}`
      if (!exportPoints.has(key)) {
        const destSubgraph = findNodeSubgraph(rootGraph, toNode)
        exportPoints.set(key, {
          subgraphId,
          device: fromNode,
          port: fromPort,
          destSubgraphLabel: destSubgraph?.label || toNode,
          destDevice: toNode,
          destPort: toPort,
          isSource: true,
        })
      }
    } else if (!fromInside && toInside) {
      // Incoming connection
      const key = `${subgraphId}:${toNode}:${toPort || ''}`
      if (!exportPoints.has(key)) {
        const destSubgraph = findNodeSubgraph(rootGraph, fromNode)
        exportPoints.set(key, {
          subgraphId,
          device: toNode,
          port: toPort,
          destSubgraphLabel: destSubgraph?.label || fromNode,
          destDevice: fromNode,
          destPort: fromPort,
          isSource: false,
        })
      }
    }
  }

  // Create export nodes and links
  for (const [key, exportPoint] of exportPoints) {
    const exportId = key.replace(/:/g, '_')

    // Export node
    exportNodes.push({
      id: `${EXPORT_NODE_PREFIX}${exportId}`,
      label: exportPoint.destSubgraphLabel,
      shape: 'stadium',
      metadata: {
        _isExport: true,
        _destSubgraph: exportPoint.destSubgraphLabel,
        _destDevice: exportPoint.destDevice,
        _destPort: exportPoint.destPort,
        _isSource: exportPoint.isSource,
      },
    })

    // Export link
    const exportNodeId = `${EXPORT_NODE_PREFIX}${exportId}`
    const deviceEndpoint = exportPoint.port
      ? { node: exportPoint.device, port: exportPoint.port }
      : exportPoint.device

    exportLinks.push({
      id: `${EXPORT_LINK_PREFIX}${exportId}`,
      from: exportPoint.isSource ? deviceEndpoint : exportNodeId,
      to: exportPoint.isSource ? exportNodeId : deviceEndpoint,
      type: 'dashed',
      arrow: 'forward',
      metadata: {
        _destSubgraphLabel: exportPoint.destSubgraphLabel,
        _destDevice: exportPoint.destDevice,
        _destPort: exportPoint.destPort,
      },
    })
  }

  return { exportNodes, exportLinks }
}

function findNodeSubgraph(graph: NetworkGraph, nodeId: string): Subgraph | undefined {
  const node = graph.nodes.find((n) => n.id === nodeId)
  if (!node?.parent) return undefined
  return graph.subgraphs?.find((s) => s.id === node.parent)
}
