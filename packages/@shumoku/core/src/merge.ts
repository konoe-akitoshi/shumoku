/**
 * NetworkGraph Merge Utilities
 *
 * Functions for merging multiple NetworkGraphs from different data sources.
 */

import type { Link, NetworkGraph, Node, Subgraph } from './models/types.js'

// ============================================
// Merge Options
// ============================================

/**
 * Strategy for handling node ID conflicts when merging graphs
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
   * Strategy for handling node ID conflicts
   * @default 'keep-first'
   */
  nodeIdConflict: NodeIdConflictStrategy

  /**
   * Explicit ID mapping: sourceId -> oldId -> newId
   * Used for cross-source identity mapping (e.g., OCX device ID -> NetBox device ID)
   */
  idMapping?: Map<string, Map<string, string>>

  /**
   * Source identifiers for each graph (used for prefix-source strategy)
   */
  sourceIds?: string[]

  /**
   * Merge node metadata from multiple sources instead of replacing
   * @default false
   */
  mergeMetadata?: boolean
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
