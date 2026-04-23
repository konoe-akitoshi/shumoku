// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Hierarchical sheet generation utilities
 * Shared logic for building child sheets with export connectors
 */

import type { ResolvedLayout } from './layout/resolved-types.js'
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
  resolved?: ResolvedLayout
}

export interface LayoutEngine {
  layoutAsync(graph: NetworkGraph): Promise<LayoutResult>
  /** If available, return ResolvedLayout alongside LayoutResult */
  layoutWithResolved?(
    graph: NetworkGraph,
  ): Promise<{ layout: LayoutResult; resolved: ResolvedLayout }>
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

/**
 * Build a sub-sheet `NetworkGraph` for the given subgraph id — the
 * filtered nodes/subgraphs/links plus export-connector nodes that
 * represent cross-boundary links.
 *
 * This is the layout-free half of what `buildHierarchicalSheets`
 * does per subgraph. Callers that want to run their own layout
 * engine (e.g. the interactive editor, which already owns a
 * `computeNetworkLayout` path) can use this directly and skip the
 * `LayoutEngine` indirection.
 *
 * Returns `null` when the requested subgraph isn't in `rootGraph`.
 */
export function buildChildSheetGraph(
  rootGraph: NetworkGraph,
  subgraphId: string,
): NetworkGraph | null {
  const subgraph = rootGraph.subgraphs?.find((s) => s.id === subgraphId)
  if (!subgraph) return null

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
    if (newParent?.startsWith(`${subgraph.id}/`)) {
      newParent = newParent.slice(subgraph.id.length + 1)
    } else if (newParent === subgraph.id) {
      newParent = undefined
    }
    // Clear the cached position so the caller's layout engine is free
    // to place the node at the sheet's local origin — the root
    // coordinate makes no sense inside a child sheet.
    return { ...n, parent: newParent, position: undefined }
  })

  // Transform nested subgraph IDs: remove the parent prefix
  const transformedSubgraphs = nestedSubgraphs?.map((sg) => ({
    ...sg,
    id: sg.id.slice(subgraph.id.length + 1),
    parent: sg.parent?.startsWith(`${subgraph.id}/`)
      ? sg.parent.slice(subgraph.id.length + 1)
      : undefined,
    bounds: undefined,
  }))

  return {
    ...rootGraph,
    name: subgraph.label,
    nodes: [...transformedNodes, ...exportNodes],
    links: [...childLinks, ...exportLinks],
    subgraphs:
      transformedSubgraphs && transformedSubgraphs.length > 0 ? transformedSubgraphs : undefined,
  }
}

async function buildChildSheet(
  rootGraph: NetworkGraph,
  subgraph: Subgraph,
  layoutEngine: LayoutEngine,
): Promise<SheetData> {
  const childGraph = buildChildSheetGraph(rootGraph, subgraph.id)
  // `buildHierarchicalSheets` already filtered to a known subgraph, so
  // this null-check is defensive — only reached if someone called
  // buildChildSheet directly with a bogus subgraph.
  if (!childGraph) throw new Error(`Subgraph not found: ${subgraph.id}`)

  // Layout child sheet (use resolved path if available)
  if (layoutEngine.layoutWithResolved) {
    const { layout, resolved } = await layoutEngine.layoutWithResolved(childGraph)
    return { graph: childGraph, layout, resolved }
  }
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

      const point: ExportPoint = exportPoints.get(key) ?? {
        subgraphId,
        destSubgraphId,
        destSubgraphLabel: destSubgraph?.label || toNode,
        isSource: true,
        connections: [],
      }

      point.connections.push({
        device: fromNode,
        port: fromPort,
        destDevice: toNode,
        destPort: toPort,
      })

      exportPoints.set(key, point)
    } else if (!fromInside && toInside) {
      // Incoming connection - group by source subgraph
      const srcSubgraph = findNodeSubgraph(rootGraph, fromNode)
      const srcSubgraphId = srcSubgraph?.id || '__external__'
      const key = `${subgraphId}:from:${srcSubgraphId}`

      const point = exportPoints.get(key) ?? {
        subgraphId,
        destSubgraphId: srcSubgraphId,
        destSubgraphLabel: srcSubgraph?.label || fromNode,
        isSource: false,
        connections: [],
      }

      point.connections.push({
        device: toNode,
        port: toPort,
        destDevice: fromNode,
        destPort: fromPort,
      })

      exportPoints.set(key, point)
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
    for (const [i, conn] of exportPoint.connections.entries()) {
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
