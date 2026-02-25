/**
 * NetworkGraph Merge Utilities
 *
 * Functions for merging multiple NetworkGraphs from different data sources.
 * Supports configurable match strategies, merge strategies, and unmatched node handling.
 */

import type { Link, NetworkGraph, Node, Subgraph } from './models/types.js'

// ============================================
// Match Strategies
// ============================================

/**
 * Strategy for identifying the same node across different sources
 */
export type MatchStrategy =
  | 'id' // Match by exact node ID
  | 'name' // Match by node name or label
  | 'attribute' // Match by specific attribute path
  | 'manual' // Use explicit mapping table

/**
 * Strategy for merging matched nodes
 */
export type MergeStrategy =
  | 'merge-properties' // Merge properties (overlay wins on conflict)
  | 'keep-base' // Keep base node, ignore overlay
  | 'keep-overlay' // Replace with overlay node

/**
 * Strategy for handling unmatched nodes from overlay sources
 */
export type UnmatchedStrategy =
  | 'add-to-root' // Add directly to main graph
  | 'add-to-subgraph' // Add to source-named subgraph
  | 'ignore' // Don't include unmatched nodes

/**
 * Configuration for a single overlay source
 */
export interface OverlayConfig {
  /** Source identifier */
  sourceId: string
  /** How to match nodes from this source to base */
  match: MatchStrategy
  /** Attribute path for 'attribute' match strategy (e.g., 'metadata.serialNumber') */
  matchAttribute?: string
  /** Manual ID mapping for 'manual' match strategy: overlayId -> baseId */
  idMapping?: Record<string, string>
  /** What to do when nodes match */
  onMatch: MergeStrategy
  /** What to do with unmatched nodes */
  onUnmatched: UnmatchedStrategy
  /** Custom subgraph name (defaults to sourceId) */
  subgraphName?: string
}

// ============================================
// Legacy Types (for backwards compatibility)
// ============================================

/**
 * Strategy for handling node ID conflicts when merging graphs
 * @deprecated Use MatchStrategy and MergeStrategy instead
 */
export type NodeIdConflictStrategy =
  | 'keep-first' // Keep node from first graph, ignore duplicates
  | 'keep-last' // Keep node from last graph, overwrite previous
  | 'prefix-source' // Prefix node ID with source ID (e.g., "netbox:router1")
  | 'error' // Throw error on conflict

/**
 * Options for merging NetworkGraphs
 */
export interface MergeOptions {
  /**
   * Strategy for handling node ID conflicts (legacy)
   * @default 'keep-first'
   */
  nodeIdConflict?: NodeIdConflictStrategy

  /**
   * Explicit ID mapping: sourceId -> oldId -> newId (legacy)
   * Use overlays[].idMapping instead
   */
  idMapping?: Map<string, Map<string, string>>

  /**
   * Source identifiers for each graph
   */
  sourceIds?: string[]

  /**
   * Merge node metadata from multiple sources instead of replacing
   * @default false
   */
  mergeMetadata?: boolean

  // ============================================
  // New configurable merge options
  // ============================================

  /**
   * Base source index (first graph by default)
   * @default 0
   */
  baseIndex?: number

  /**
   * Configuration for overlay sources
   * If not provided, uses legacy nodeIdConflict behavior
   */
  overlays?: OverlayConfig[]
}

/**
 * Result of a merge operation
 */
export interface MergeResult {
  /** The merged NetworkGraph */
  graph: NetworkGraph

  /** Number of nodes from each source */
  nodeCountBySource: Map<string, number>

  /** Number of links from each source */
  linkCountBySource: Map<string, number>

  /** Nodes that were skipped due to conflicts (with keep-first/keep-last) */
  skippedNodes: Array<{ sourceId: string; nodeId: string; reason: string }>

  /** Links that were skipped (e.g., referencing non-existent nodes) */
  skippedLinks: Array<{ sourceId: string; linkId: string; reason: string }>

  /** ID remapping that was applied (oldId -> newId) */
  appliedIdMappings: Map<string, string>
}

// ============================================
// Helper Functions
// ============================================

/**
 * Get node ID from link endpoint
 */
function getEndpointNodeId(endpoint: string | { node: string }): string {
  return typeof endpoint === 'string' ? endpoint : endpoint.node
}

/**
 * Update endpoint with new node ID
 */
function updateEndpoint(
  endpoint: string | { node: string; port?: string; ip?: string; pin?: string },
  newNodeId: string,
): string | { node: string; port?: string; ip?: string; pin?: string } {
  if (typeof endpoint === 'string') {
    return newNodeId
  }
  return { ...endpoint, node: newNodeId }
}

/**
 * Generate unique link ID
 */
function generateLinkId(from: string, to: string, index: number): string {
  return `${from}--${to}-${index}`
}

/**
 * Get node name for matching
 */
function getNodeName(node: Node): string {
  if (node.label) {
    // Handle array labels
    if (Array.isArray(node.label)) {
      // Strip HTML tags and get first meaningful part
      const firstLabel = node.label[0]
      if (typeof firstLabel === 'string') {
        return firstLabel.replace(/<[^>]*>/g, '').trim()
      }
    }
    if (typeof node.label === 'string') {
      return node.label.replace(/<[^>]*>/g, '').trim()
    }
  }
  return node.id
}

/**
 * Get attribute value by path (e.g., 'metadata.serialNumber')
 */
function getAttributeByPath(node: Node, path: string): string | undefined {
  const parts = path.split('.')
  let current: unknown = node
  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = (current as Record<string, unknown>)[part]
    } else {
      return undefined
    }
  }
  return typeof current === 'string' ? current : String(current)
}

/**
 * Find matching base node for an overlay node
 */
function findMatchingNode(
  overlayNode: Node,
  baseNodes: Map<string, Node>,
  config: OverlayConfig,
  baseNodesByName?: Map<string, Node>,
  baseNodesByAttribute?: Map<string, Node>,
): Node | undefined {
  switch (config.match) {
    case 'id':
      return baseNodes.get(overlayNode.id)

    case 'name': {
      const name = getNodeName(overlayNode)
      return baseNodesByName?.get(name)
    }

    case 'attribute': {
      if (!config.matchAttribute) return undefined
      const value = getAttributeByPath(overlayNode, config.matchAttribute)
      if (!value) return undefined
      return baseNodesByAttribute?.get(value)
    }

    case 'manual': {
      if (!config.idMapping) return undefined
      const mappedId = config.idMapping[overlayNode.id]
      if (!mappedId) return undefined
      return baseNodes.get(mappedId)
    }

    default:
      return undefined
  }
}

/**
 * Merge two nodes according to strategy
 */
function mergeNodes(base: Node, overlay: Node, strategy: MergeStrategy): Node {
  switch (strategy) {
    case 'keep-base':
      return base

    case 'keep-overlay':
      return { ...overlay, id: base.id }

    case 'merge-properties':
      return {
        ...base,
        ...overlay,
        id: base.id, // Always keep base ID
        metadata: { ...base.metadata, ...overlay.metadata },
        // Keep base parent if overlay doesn't have one
        parent: overlay.parent ?? base.parent,
      }

    default:
      return base
  }
}

// ============================================
// Main Merge Function
// ============================================

/**
 * Merge multiple NetworkGraphs into a single graph
 *
 * @param graphs - Array of NetworkGraphs to merge
 * @param options - Merge options
 * @returns MergeResult with merged graph and statistics
 *
 * @example
 * ```typescript
 * const netboxGraph = await fetchFromNetBox()
 * const ocxGraph = await fetchFromOCX()
 *
 * const result = mergeNetworkGraphs(
 *   [netboxGraph, ocxGraph],
 *   {
 *     nodeIdConflict: 'prefix-source',
 *     sourceIds: ['netbox', 'ocx']
 *   }
 * )
 *
 * console.log(`Merged ${result.graph.nodes.length} nodes`)
 * ```
 */
export function mergeNetworkGraphs(
  graphs: NetworkGraph[],
  options?: Partial<MergeOptions>,
): MergeResult {
  const opts: MergeOptions = {
    nodeIdConflict: options?.nodeIdConflict ?? 'keep-first',
    idMapping: options?.idMapping,
    sourceIds: options?.sourceIds,
    mergeMetadata: options?.mergeMetadata ?? false,
  }

  // Result tracking
  const nodeCountBySource = new Map<string, number>()
  const linkCountBySource = new Map<string, number>()
  const skippedNodes: MergeResult['skippedNodes'] = []
  const skippedLinks: MergeResult['skippedLinks'] = []
  const appliedIdMappings = new Map<string, string>()

  // Merged collections
  const mergedNodes = new Map<string, Node>()
  const mergedLinks: Link[] = []
  const mergedSubgraphs = new Map<string, Subgraph>()

  // Track which source each node came from (for conflict detection)
  const nodeSourceMap = new Map<string, string>()

  // Process each graph
  for (let graphIndex = 0; graphIndex < graphs.length; graphIndex++) {
    const graph = graphs[graphIndex]
    const sourceId = opts.sourceIds?.[graphIndex] ?? `source-${graphIndex}`

    // Get ID mapping for this source
    const sourceIdMapping = opts.idMapping?.get(sourceId)

    // Track counts
    let nodeCount = 0
    let linkCount = 0

    // Local ID remapping for this source (used with prefix-source)
    const localIdRemap = new Map<string, string>()

    // Process nodes
    for (const node of graph.nodes) {
      let nodeId = node.id

      // Apply explicit ID mapping if provided
      if (sourceIdMapping?.has(nodeId)) {
        const mappedId = sourceIdMapping.get(nodeId)!
        appliedIdMappings.set(`${sourceId}:${nodeId}`, mappedId)
        nodeId = mappedId
      }

      // Check for conflicts
      if (mergedNodes.has(nodeId)) {
        switch (opts.nodeIdConflict) {
          case 'keep-first':
            skippedNodes.push({
              sourceId,
              nodeId: node.id,
              reason: `Conflict with existing node from ${nodeSourceMap.get(nodeId)}`,
            })
            // Map to existing ID for link resolution
            localIdRemap.set(node.id, nodeId)
            continue

          case 'keep-last':
            // Replace existing node
            if (opts.mergeMetadata) {
              const existing = mergedNodes.get(nodeId)!
              const mergedMeta = { ...existing.metadata, ...node.metadata }
              mergedNodes.set(nodeId, { ...node, id: nodeId, metadata: mergedMeta })
            } else {
              mergedNodes.set(nodeId, { ...node, id: nodeId })
            }
            nodeSourceMap.set(nodeId, sourceId)
            nodeCount++
            continue

          case 'prefix-source': {
            // Create new ID with source prefix
            const newId = `${sourceId}:${nodeId}`
            localIdRemap.set(node.id, newId)
            appliedIdMappings.set(`${sourceId}:${node.id}`, newId)
            mergedNodes.set(newId, { ...node, id: newId })
            nodeSourceMap.set(newId, sourceId)
            nodeCount++
            continue
          }

          case 'error':
            throw new Error(
              `Node ID conflict: "${nodeId}" exists in both ${nodeSourceMap.get(nodeId)} and ${sourceId}`,
            )
        }
      }

      // No conflict - add node
      const finalId = localIdRemap.get(node.id) ?? nodeId
      localIdRemap.set(node.id, finalId)
      mergedNodes.set(finalId, { ...node, id: finalId })
      nodeSourceMap.set(finalId, sourceId)
      nodeCount++
    }

    // Process links
    for (let linkIndex = 0; linkIndex < graph.links.length; linkIndex++) {
      const link = graph.links[linkIndex]

      // Resolve node IDs through mappings
      const fromNodeId = getEndpointNodeId(link.from)
      const toNodeId = getEndpointNodeId(link.to)

      const resolvedFromId = localIdRemap.get(fromNodeId) ?? fromNodeId
      const resolvedToId = localIdRemap.get(toNodeId) ?? toNodeId

      // Validate that both endpoints exist
      if (!mergedNodes.has(resolvedFromId)) {
        skippedLinks.push({
          sourceId,
          linkId: link.id ?? `link-${linkIndex}`,
          reason: `Source node "${fromNodeId}" not found (resolved to "${resolvedFromId}")`,
        })
        continue
      }

      if (!mergedNodes.has(resolvedToId)) {
        skippedLinks.push({
          sourceId,
          linkId: link.id ?? `link-${linkIndex}`,
          reason: `Target node "${toNodeId}" not found (resolved to "${resolvedToId}")`,
        })
        continue
      }

      // Create merged link with resolved endpoints
      const mergedLink: Link = {
        ...link,
        id: link.id ?? generateLinkId(resolvedFromId, resolvedToId, mergedLinks.length),
        from: updateEndpoint(link.from, resolvedFromId),
        to: updateEndpoint(link.to, resolvedToId),
      }

      mergedLinks.push(mergedLink)
      linkCount++
    }

    // Process subgraphs
    for (const subgraph of graph.subgraphs ?? []) {
      let subgraphId = subgraph.id

      // Apply prefix if using prefix-source strategy
      if (opts.nodeIdConflict === 'prefix-source' && mergedSubgraphs.has(subgraphId)) {
        subgraphId = `${sourceId}:${subgraphId}`
      }

      // Update children references if they were remapped
      const updatedChildren = subgraph.children?.map((childId) => localIdRemap.get(childId) ?? childId)

      mergedSubgraphs.set(subgraphId, {
        ...subgraph,
        id: subgraphId,
        children: updatedChildren,
      })
    }

    nodeCountBySource.set(sourceId, nodeCount)
    linkCountBySource.set(sourceId, linkCount)
  }

  // Build merged graph
  // Use first graph's settings as base, but combine names
  const firstGraph = graphs[0]
  const mergedGraph: NetworkGraph = {
    version: firstGraph?.version ?? '1.0',
    name: graphs.map((g) => g.name).filter(Boolean).join(' + ') || 'Merged Network',
    description: graphs.map((g) => g.description).filter(Boolean).join('\n\n') || undefined,
    nodes: Array.from(mergedNodes.values()),
    links: mergedLinks,
    subgraphs: mergedSubgraphs.size > 0 ? Array.from(mergedSubgraphs.values()) : undefined,
    settings: firstGraph?.settings,
  }

  return {
    graph: mergedGraph,
    nodeCountBySource,
    linkCountBySource,
    skippedNodes,
    skippedLinks,
    appliedIdMappings,
  }
}

/**
 * Simple merge that combines graphs with keep-first strategy
 * Convenience function for common use case
 */
export function simpleMerge(...graphs: NetworkGraph[]): NetworkGraph {
  return mergeNetworkGraphs(graphs, { nodeIdConflict: 'keep-first' }).graph
}

// ============================================
// Configurable Merge (New API)
// ============================================

/**
 * Merge graphs with configurable overlay settings
 *
 * This is the recommended API for merging topologies from multiple sources
 * with fine-grained control over matching and merging behavior.
 *
 * @example
 * ```typescript
 * const result = mergeWithOverlays(
 *   [netboxGraph, ocxGraph],
 *   ['netbox-ds-1', 'ocx-ds-1'],
 *   {
 *     baseIndex: 0, // netbox is base
 *     overlays: [{
 *       sourceId: 'ocx-ds-1',
 *       match: 'name',
 *       onMatch: 'merge-properties',
 *       onUnmatched: 'add-to-subgraph',
 *       subgraphName: 'OCX'
 *     }]
 *   }
 * )
 * ```
 */
export function mergeWithOverlays(
  graphs: NetworkGraph[],
  sourceIds: string[],
  config: {
    baseIndex?: number
    overlays: OverlayConfig[]
  },
): MergeResult {
  const baseIndex = config.baseIndex ?? 0
  const baseGraph = graphs[baseIndex]
  const baseSourceId = sourceIds[baseIndex]

  if (!baseGraph) {
    throw new Error('Base graph not found')
  }

  // Result tracking
  const nodeCountBySource = new Map<string, number>()
  const linkCountBySource = new Map<string, number>()
  const skippedNodes: MergeResult['skippedNodes'] = []
  const skippedLinks: MergeResult['skippedLinks'] = []
  const appliedIdMappings = new Map<string, string>()

  // Initialize with base graph
  const mergedNodes = new Map<string, Node>()
  const mergedLinks: Link[] = []
  const mergedSubgraphs = new Map<string, Subgraph>()

  // Build lookup indexes for base nodes
  const baseNodesByName = new Map<string, Node>()

  // Index base nodes
  for (const node of baseGraph.nodes) {
    mergedNodes.set(node.id, { ...node })
    baseNodesByName.set(getNodeName(node), node)
  }
  nodeCountBySource.set(baseSourceId, baseGraph.nodes.length)

  // Add base links
  for (const link of baseGraph.links) {
    mergedLinks.push({ ...link })
  }
  linkCountBySource.set(baseSourceId, baseGraph.links.length)

  // Add base subgraphs
  for (const sg of baseGraph.subgraphs ?? []) {
    mergedSubgraphs.set(sg.id, { ...sg })
  }

  // ID remapping for overlay nodes (overlayId -> baseId or newId)
  const globalIdRemap = new Map<string, string>()

  // Process each overlay
  for (let i = 0; i < graphs.length; i++) {
    if (i === baseIndex) continue

    const overlayGraph = graphs[i]
    const overlaySourceId = sourceIds[i]
    const overlayConfig = config.overlays.find((o) => o.sourceId === overlaySourceId)

    if (!overlayConfig) {
      console.warn(`[merge] No overlay config for source ${overlaySourceId}, skipping`)
      continue
    }

    // Build attribute index if needed
    let baseNodesByAttr: Map<string, Node> | undefined
    if (overlayConfig.match === 'attribute' && overlayConfig.matchAttribute) {
      baseNodesByAttr = new Map()
      for (const node of baseGraph.nodes) {
        const value = getAttributeByPath(node, overlayConfig.matchAttribute)
        if (value) {
          baseNodesByAttr.set(value, node)
        }
      }
    }

    // Track nodes for this overlay
    let nodeCount = 0
    let linkCount = 0
    const unmatchedNodes: Node[] = []

    // Process overlay nodes
    for (const overlayNode of overlayGraph.nodes) {
      const matchedBase = findMatchingNode(
        overlayNode,
        mergedNodes,
        overlayConfig,
        baseNodesByName,
        baseNodesByAttr,
      )

      if (matchedBase) {
        // Node matches - merge according to strategy
        const merged = mergeNodes(matchedBase, overlayNode, overlayConfig.onMatch)
        mergedNodes.set(matchedBase.id, merged)
        globalIdRemap.set(overlayNode.id, matchedBase.id)
        appliedIdMappings.set(`${overlaySourceId}:${overlayNode.id}`, matchedBase.id)
        nodeCount++
      } else {
        // No match - handle according to unmatched strategy
        switch (overlayConfig.onUnmatched) {
          case 'add-to-root':
            mergedNodes.set(overlayNode.id, { ...overlayNode })
            globalIdRemap.set(overlayNode.id, overlayNode.id)
            nodeCount++
            break

          case 'add-to-subgraph':
            unmatchedNodes.push(overlayNode)
            globalIdRemap.set(overlayNode.id, overlayNode.id)
            nodeCount++
            break

          case 'ignore':
            skippedNodes.push({
              sourceId: overlaySourceId,
              nodeId: overlayNode.id,
              reason: 'No match found and unmatched strategy is ignore',
            })
            break
        }
      }
    }

    // Create subgraph for unmatched nodes if needed
    if (unmatchedNodes.length > 0 && overlayConfig.onUnmatched === 'add-to-subgraph') {
      const subgraphId = overlayConfig.subgraphName ?? overlaySourceId
      const subgraphChildren: string[] = []

      for (const node of unmatchedNodes) {
        const nodeWithParent = { ...node, parent: subgraphId }
        mergedNodes.set(node.id, nodeWithParent)
        subgraphChildren.push(node.id)
      }

      // Create or update subgraph
      const existingSubgraph = mergedSubgraphs.get(subgraphId)
      if (existingSubgraph) {
        mergedSubgraphs.set(subgraphId, {
          ...existingSubgraph,
          children: [...(existingSubgraph.children ?? []), ...subgraphChildren],
        })
      } else {
        mergedSubgraphs.set(subgraphId, {
          id: subgraphId,
          label: overlayConfig.subgraphName ?? overlaySourceId,
          children: subgraphChildren,
        })
      }
    }

    // Process overlay links
    for (let linkIndex = 0; linkIndex < overlayGraph.links.length; linkIndex++) {
      const link = overlayGraph.links[linkIndex]

      const fromNodeId = getEndpointNodeId(link.from)
      const toNodeId = getEndpointNodeId(link.to)

      const resolvedFromId = globalIdRemap.get(fromNodeId) ?? fromNodeId
      const resolvedToId = globalIdRemap.get(toNodeId) ?? toNodeId

      // Validate endpoints exist
      if (!mergedNodes.has(resolvedFromId)) {
        skippedLinks.push({
          sourceId: overlaySourceId,
          linkId: link.id ?? `link-${linkIndex}`,
          reason: `Source node "${fromNodeId}" not found`,
        })
        continue
      }

      if (!mergedNodes.has(resolvedToId)) {
        skippedLinks.push({
          sourceId: overlaySourceId,
          linkId: link.id ?? `link-${linkIndex}`,
          reason: `Target node "${toNodeId}" not found`,
        })
        continue
      }

      // Add link with resolved IDs
      mergedLinks.push({
        ...link,
        id: link.id ?? generateLinkId(resolvedFromId, resolvedToId, mergedLinks.length),
        from: updateEndpoint(link.from, resolvedFromId),
        to: updateEndpoint(link.to, resolvedToId),
      })
      linkCount++
    }

    nodeCountBySource.set(overlaySourceId, nodeCount)
    linkCountBySource.set(overlaySourceId, linkCount)
  }

  // Build final graph
  const mergedGraph: NetworkGraph = {
    version: baseGraph.version ?? '1.0',
    name: baseGraph.name || 'Merged Network',
    description: baseGraph.description,
    nodes: Array.from(mergedNodes.values()),
    links: mergedLinks,
    subgraphs: mergedSubgraphs.size > 0 ? Array.from(mergedSubgraphs.values()) : undefined,
    settings: baseGraph.settings,
  }

  return {
    graph: mergedGraph,
    nodeCountBySource,
    linkCountBySource,
    skippedNodes,
    skippedLinks,
    appliedIdMappings,
  }
}
