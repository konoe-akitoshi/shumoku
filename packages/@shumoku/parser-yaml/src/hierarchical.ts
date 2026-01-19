/**
 * Hierarchical YAML Parser
 * Resolves file references and builds a complete hierarchical graph
 */

import type {
  HierarchicalNetworkGraph,
  Link,
  NetworkGraph,
  Node,
  Subgraph,
} from '@shumoku/core/models'
import { type ParseResult, type ParseWarning, YamlParser } from './parser.js'

// ============================================
// Constants
// ============================================

/** Prefix for virtual export connector nodes */
const EXPORT_NODE_PREFIX = '__export_'
/** Prefix for virtual export connector links */
const EXPORT_LINK_PREFIX = '__export_link_'

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
export function isExportLink(linkId: string | undefined): boolean {
  return linkId?.startsWith(EXPORT_LINK_PREFIX) ?? false
}

// ============================================
// Interfaces
// ============================================

/**
 * File resolver interface for loading external YAML files
 */
export interface FileResolver {
  /** Read file contents by path */
  read(path: string): Promise<string>
  /** Resolve relative path from base path */
  resolve(basePath: string, relativePath: string): string
}

/**
 * Result of hierarchical parsing
 */
export interface HierarchicalParseResult extends ParseResult {
  /** The resolved hierarchical graph */
  graph: HierarchicalNetworkGraph
  /** Map of sheet ID to their resolved NetworkGraph */
  sheets: Map<string, NetworkGraph>
}

/**
 * Cross-subgraph link info for export connector generation
 */
interface CrossSubgraphLink {
  link: Link
  fromSubgraph: string
  fromSubgraphLabel: string
  fromDevice: string
  fromPort?: string
  toSubgraph: string
  toSubgraphLabel: string
  toDevice: string
  toPort?: string
}

/**
 * Export point for generating export connectors
 * Multiple connections to the same destination are grouped into one export point
 */
interface ExportPoint {
  subgraphId: string
  destSubgraphId: string
  destSubgraphLabel: string
  isSource: boolean
  /** All device connections for this export point */
  connections: Array<{
    device: string
    port?: string
    destDevice: string
    destPort?: string
  }>
}

// ============================================
// HierarchicalParser Class
// ============================================

/**
 * Hierarchical parser that resolves file references
 */
export class HierarchicalParser {
  private parser: YamlParser
  private resolver: FileResolver
  private loadedFiles: Set<string> = new Set()

  constructor(resolver: FileResolver) {
    this.parser = new YamlParser()
    this.resolver = resolver
  }

  /**
   * Parse YAML with file reference resolution
   */
  async parse(input: string, basePath: string): Promise<HierarchicalParseResult> {
    const warnings: ParseWarning[] = []
    const sheets = new Map<string, NetworkGraph>()
    const deviceToSubgraph = new Map<string, string>()

    // Parse the main file
    const result = this.parser.parse(input)
    if (result.warnings) {
      warnings.push(...result.warnings)
    }

    const graph = result.graph as HierarchicalNetworkGraph
    graph.sheets = sheets
    graph.breadcrumb = ['root']

    // Process subgraphs with file references
    if (graph.subgraphs) {
      for (const subgraph of graph.subgraphs) {
        if (subgraph.file) {
          const fileWarnings = await this.processSubgraphFile(
            subgraph,
            basePath,
            graph,
            sheets,
            deviceToSubgraph,
          )
          warnings.push(...fileWarnings)
        }
      }
    }

    // Build subgraph label map and generate export connectors
    const subgraphLabels = this.buildSubgraphLabelMap(graph.subgraphs)
    const crossLinks = this.detectCrossSubgraphLinks(graph.links, deviceToSubgraph, subgraphLabels)
    this.generateExportConnectors(crossLinks, sheets)

    return {
      graph,
      sheets,
      warnings: warnings.length > 0 ? warnings : undefined,
    }
  }

  /**
   * Process a subgraph with file reference
   */
  private async processSubgraphFile(
    subgraph: Subgraph,
    basePath: string,
    graph: HierarchicalNetworkGraph,
    sheets: Map<string, NetworkGraph>,
    deviceToSubgraph: Map<string, string>,
  ): Promise<ParseWarning[]> {
    const warnings: ParseWarning[] = []

    try {
      const filePath = this.resolver.resolve(basePath, subgraph.file!)

      // Check for circular references
      if (this.loadedFiles.has(filePath)) {
        warnings.push({
          code: 'CIRCULAR_REFERENCE',
          message: `Circular file reference detected: ${filePath}`,
          severity: 'error',
        })
        return warnings
      }

      this.loadedFiles.add(filePath)

      // Load and parse the child file
      const fileContent = await this.resolver.read(filePath)
      const childResult = await this.parseChild(fileContent, filePath, subgraph.id)

      if (childResult.warnings) {
        warnings.push(...childResult.warnings)
      }

      // Store the child graph for sheet navigation
      sheets.set(subgraph.id, structuredClone(childResult.graph))

      // Merge child sheets with prefixed paths
      for (const [id, sheet] of childResult.sheets) {
        sheets.set(`${subgraph.id}/${id}`, sheet)
      }

      // Merge child content into parent graph
      this.mergeChildNodes(childResult.graph.nodes, subgraph.id, graph, deviceToSubgraph)
      this.mergeChildSubgraphs(childResult.graph.subgraphs, subgraph.id, graph)
      this.mergeChildLinks(childResult.graph.links, subgraph.id, graph)
    } catch (error) {
      warnings.push({
        code: 'FILE_LOAD_ERROR',
        message: `Failed to load ${subgraph.file}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'error',
      })
    }

    return warnings
  }

  /**
   * Merge child nodes into parent graph
   */
  private mergeChildNodes(
    childNodes: Node[],
    subgraphId: string,
    graph: HierarchicalNetworkGraph,
    deviceToSubgraph: Map<string, string>,
  ): void {
    for (const childNode of childNodes) {
      // Skip virtual export connector nodes
      if (isExportNode(childNode.id)) continue

      // Track which subgraph this device belongs to
      deviceToSubgraph.set(childNode.id, subgraphId)

      // Set parent reference
      graph.nodes.push({
        ...childNode,
        parent: childNode.parent ? `${subgraphId}/${childNode.parent}` : subgraphId,
      })
    }
  }

  /**
   * Merge child subgraphs into parent graph
   */
  private mergeChildSubgraphs(
    childSubgraphs: Subgraph[] | undefined,
    subgraphId: string,
    graph: HierarchicalNetworkGraph,
  ): void {
    if (!childSubgraphs) return

    for (const childSg of childSubgraphs) {
      graph.subgraphs ??= []
      graph.subgraphs.push({
        ...childSg,
        id: `${subgraphId}/${childSg.id}`,
        parent: childSg.parent ? `${subgraphId}/${childSg.parent}` : subgraphId,
      })
    }
  }

  /**
   * Merge child links into parent graph
   */
  private mergeChildLinks(
    childLinks: Link[],
    subgraphId: string,
    graph: HierarchicalNetworkGraph,
  ): void {
    for (const childLink of childLinks) {
      // Skip virtual export connector links
      if (isExportLink(childLink.id)) continue

      graph.links.push({
        ...childLink,
        id: childLink.id ? `${subgraphId}/${childLink.id}` : undefined,
        from: this.cloneEndpoint(childLink.from),
        to: this.cloneEndpoint(childLink.to),
      })
    }
  }

  /**
   * Build a map of subgraph ID to label
   */
  private buildSubgraphLabelMap(subgraphs: Subgraph[] | undefined): Map<string, string> {
    const map = new Map<string, string>()
    if (subgraphs) {
      for (const sg of subgraphs) {
        map.set(sg.id, sg.label)
      }
    }
    return map
  }

  /**
   * Detect links that cross subgraph boundaries
   */
  private detectCrossSubgraphLinks(
    links: Link[],
    deviceToSubgraph: Map<string, string>,
    subgraphLabels: Map<string, string>,
  ): CrossSubgraphLink[] {
    const crossLinks: CrossSubgraphLink[] = []

    for (const link of links) {
      const from = typeof link.from === 'string' ? { node: link.from } : link.from
      const to = typeof link.to === 'string' ? { node: link.to } : link.to

      const fromSubgraph = deviceToSubgraph.get(from.node)
      const toSubgraph = deviceToSubgraph.get(to.node)

      // Check if this link crosses subgraph boundaries
      if (fromSubgraph && toSubgraph && fromSubgraph !== toSubgraph) {
        crossLinks.push({
          link,
          fromSubgraph,
          fromSubgraphLabel: subgraphLabels.get(fromSubgraph) || fromSubgraph,
          fromDevice: from.node,
          fromPort: from.port,
          toSubgraph,
          toSubgraphLabel: subgraphLabels.get(toSubgraph) || toSubgraph,
          toDevice: to.node,
          toPort: to.port,
        })
      }
    }

    return crossLinks
  }

  /**
   * Generate export connector nodes/links in child sheets
   */
  private generateExportConnectors(
    crossLinks: CrossSubgraphLink[],
    sheets: Map<string, NetworkGraph>,
  ): void {
    const exportPoints = this.collectExportPoints(crossLinks)

    for (const [key, exportPoint] of exportPoints) {
      const sheetGraph = sheets.get(exportPoint.subgraphId)
      if (!sheetGraph) continue

      const exportId = key.replace(/:/g, '_')
      this.addExportConnectorNode(sheetGraph, exportId, exportPoint)
      this.addExportConnectorLink(sheetGraph, exportId, exportPoint)
    }
  }

  /**
   * Collect export points from cross-subgraph links
   * Groups multiple connections to the same destination into one export point
   */
  private collectExportPoints(crossLinks: CrossSubgraphLink[]): Map<string, ExportPoint> {
    const exportPoints = new Map<string, ExportPoint>()

    for (const crossLink of crossLinks) {
      // Source side (from) - grouped by destination subgraph
      const fromKey = `${crossLink.fromSubgraph}:to:${crossLink.toSubgraph}`
      if (!exportPoints.has(fromKey)) {
        exportPoints.set(fromKey, {
          subgraphId: crossLink.fromSubgraph,
          destSubgraphId: crossLink.toSubgraph,
          destSubgraphLabel: crossLink.toSubgraphLabel,
          isSource: true,
          connections: [],
        })
      }
      exportPoints.get(fromKey)!.connections.push({
        device: crossLink.fromDevice,
        port: crossLink.fromPort,
        destDevice: crossLink.toDevice,
        destPort: crossLink.toPort,
      })

      // Destination side (to) - grouped by source subgraph
      const toKey = `${crossLink.toSubgraph}:from:${crossLink.fromSubgraph}`
      if (!exportPoints.has(toKey)) {
        exportPoints.set(toKey, {
          subgraphId: crossLink.toSubgraph,
          destSubgraphId: crossLink.fromSubgraph,
          destSubgraphLabel: crossLink.fromSubgraphLabel,
          isSource: false,
          connections: [],
        })
      }
      exportPoints.get(toKey)!.connections.push({
        device: crossLink.toDevice,
        port: crossLink.toPort,
        destDevice: crossLink.fromDevice,
        destPort: crossLink.fromPort,
      })
    }

    return exportPoints
  }

  /**
   * Add export connector node to sheet
   */
  private addExportConnectorNode(
    sheetGraph: NetworkGraph,
    exportId: string,
    exportPoint: ExportPoint,
  ): void {
    sheetGraph.nodes.push({
      id: `${EXPORT_NODE_PREFIX}${exportId}`,
      label: exportPoint.destSubgraphLabel,
      shape: 'stadium',
      type: 'connector' as Node['type'],
      metadata: {
        _isExport: true,
        _destSubgraph: exportPoint.destSubgraphLabel,
        _destSubgraphId: exportPoint.destSubgraphId,
        _isSource: exportPoint.isSource,
        _connectionCount: exportPoint.connections.length,
      },
    })
  }

  /**
   * Add export connector links to sheet (one link per connection)
   */
  private addExportConnectorLink(
    sheetGraph: NetworkGraph,
    exportId: string,
    exportPoint: ExportPoint,
  ): void {
    const exportNodeId = `${EXPORT_NODE_PREFIX}${exportId}`

    for (let i = 0; i < exportPoint.connections.length; i++) {
      const conn = exportPoint.connections[i]
      const deviceEndpoint = conn.port ? { node: conn.device, port: conn.port } : conn.device
      const linkId = `${EXPORT_LINK_PREFIX}${exportId}_${i}`

      sheetGraph.links.push({
        id: linkId,
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

  /**
   * Clone endpoint for merged child links
   */
  private cloneEndpoint(
    endpoint: string | { node: string; port?: string; ip?: string },
  ): string | { node: string; port?: string; ip?: string } {
    return typeof endpoint === 'string' ? endpoint : { ...endpoint }
  }

  /**
   * Parse a child file with its own context
   */
  private async parseChild(
    input: string,
    basePath: string,
    parentId: string,
  ): Promise<HierarchicalParseResult> {
    const childParser = new HierarchicalParser(this.resolver)
    childParser.loadedFiles = this.loadedFiles

    const result = await childParser.parse(input, basePath)
    result.graph.parentSheet = parentId
    result.graph.breadcrumb = ['root', parentId]

    return result
  }

  /**
   * Reset the loaded files set (for reusing the parser)
   */
  reset(): void {
    this.loadedFiles.clear()
  }
}

// ============================================
// File Resolver Implementations
// ============================================

/**
 * Node.js file resolver implementation
 */
export function createNodeFileResolver(): FileResolver {
  return {
    async read(path: string): Promise<string> {
      const fs = await import('node:fs/promises')
      return fs.readFile(path, 'utf-8')
    },

    resolve(basePath: string, relativePath: string): string {
      const path = require('node:path')
      return path.resolve(path.dirname(basePath), relativePath)
    },
  }
}

/**
 * Browser/in-memory file resolver for testing
 */
export function createMemoryFileResolver(files: Map<string, string>, basePath = '/'): FileResolver {
  return {
    async read(path: string): Promise<string> {
      const content = files.get(path)
      if (content === undefined) {
        throw new Error(`File not found: ${path}`)
      }
      return content
    },

    resolve(_basePath: string, relativePath: string): string {
      if (relativePath.startsWith('./')) {
        return basePath + relativePath.slice(2)
      }
      if (relativePath.startsWith('/')) {
        return relativePath
      }
      return basePath + relativePath
    },
  }
}
