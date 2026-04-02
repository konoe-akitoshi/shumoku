/**
 * Cytoscape Converter - Transform NetworkGraph to Cytoscape elements
 * Handles hierarchical structures with compound nodes
 */

import type { EdgeDataDefinition, ElementDefinition, NodeDataDefinition } from 'cytoscape'
import type { ParsedTopologyResponse } from '../types'
import { getCDNIconUrl } from './icons'
import { getUtilizationColor } from './theme'

export interface CytoscapeElements {
  nodes: ElementDefinition[]
  edges: ElementDefinition[]
}

/**
 * Convert parsed topology response to Cytoscape elements
 */
export function convertToCytoscapeElements(data: ParsedTopologyResponse): CytoscapeElements {
  const nodes: ElementDefinition[] = []
  const edges: ElementDefinition[] = []
  const nodePositions = new Map<string, { x: number; y: number }>()

  // Build position map from layout
  if (data.layout?.nodes) {
    for (const [id, pos] of Object.entries(data.layout.nodes)) {
      nodePositions.set(id, pos as { x: number; y: number })
    }
  }

  // Convert subgraphs to compound nodes first
  if (data.graph.subgraphs) {
    for (const subgraph of data.graph.subgraphs) {
      const nodeData: NodeDataDefinition = {
        id: subgraph.id,
        label: subgraph.label || subgraph.id,
        isSubgraph: 'true',
      }

      // Parent reference for nested subgraphs
      if (subgraph.parent) {
        nodeData.parent = subgraph.parent
      }

      // Custom styling
      if (subgraph.style?.fill) {
        nodeData.subgraphFill = subgraph.style.fill
      }
      if (subgraph.style?.stroke) {
        nodeData.subgraphStroke = subgraph.style.stroke
      }

      // File reference (for drill-down navigation)
      if (subgraph.file) {
        nodeData.hasFile = 'true'
        nodeData.file = subgraph.file
      }

      // Icon for subgraph (e.g., AWS VPC icon)
      if (subgraph.vendor && subgraph.service && subgraph.resource) {
        nodeData.iconUrl = getCDNIconUrl(
          subgraph.vendor,
          `${subgraph.service}/${subgraph.resource}`,
        )
      }

      nodes.push({ data: nodeData })
    }
  }

  // Convert nodes
  for (const node of data.graph.nodes) {
    const pos = nodePositions.get(node.id) || { x: 0, y: 0 }

    const nodeData: NodeDataDefinition = {
      id: node.id,
      label: formatLabel(node.label || node.id),
      type: node.type || 'generic',
    }

    // Parent reference (for compound nodes)
    if (node.parent) {
      nodeData.parent = node.parent
    }

    // Vendor icon
    if (node.vendor && node.model) {
      nodeData.iconUrl = getCDNIconUrl(node.vendor, node.model)
    } else if (node.icon) {
      nodeData.iconUrl = node.icon
    }

    // Export connector check
    if (node.id.startsWith('__export_')) {
      nodeData.isExport = 'true'
      if (node.metadata?._destSubgraphId) {
        nodeData.destSubgraphId = node.metadata._destSubgraphId
      }
    }

    // Store original metadata
    if (node.metadata) {
      nodeData.metadata = node.metadata
    }

    nodes.push({
      data: nodeData,
      position: pos,
    })
  }

  // Convert links to edges
  for (let i = 0; i < data.graph.links.length; i++) {
    const link = data.graph.links[i]
    const linkId = link.id || `link-${i}`

    // Parse endpoints
    const fromNode = typeof link.from === 'string' ? link.from : link.from.node
    const toNode = typeof link.to === 'string' ? link.to : link.to.node
    const fromPort = typeof link.from === 'object' ? link.from.port : undefined
    const toPort = typeof link.to === 'object' ? link.to.port : undefined

    const edgeData: EdgeDataDefinition = {
      id: linkId,
      source: fromNode,
      target: toNode,
    }

    // Label with bandwidth or custom label
    if (link.label) {
      edgeData.label = link.label
    } else if (link.bandwidth) {
      edgeData.label = link.bandwidth
    }

    // Port info
    if (fromPort) edgeData.sourcePort = fromPort
    if (toPort) edgeData.targetPort = toPort

    // Line style
    if (link.type === 'dashed') {
      edgeData.lineStyle = 'dashed'
    }

    // Arrow
    if (link.arrow) {
      edgeData.arrow = link.arrow
    }

    // VLAN
    if (link.vlan) {
      edgeData.vlan = Array.isArray(link.vlan) ? link.vlan.join(',') : link.vlan
    }

    // Redundancy type
    if (link.redundancy) {
      edgeData.redundancy = link.redundancy
    }

    edges.push({ data: edgeData })
  }

  return { nodes, edges }
}

/**
 * Format multi-line label for Cytoscape
 * Cytoscape supports \n for line breaks
 */
function formatLabel(label: string | string[]): string {
  if (Array.isArray(label)) {
    // Remove HTML tags and join with newlines
    return label
      .map((line) => line.replace(/<[^>]+>/g, '').trim())
      .filter((line) => line && line !== '---')
      .join('\n')
  }
  return label
}

/**
 * Apply metrics data to Cytoscape instance
 */
export function applyMetricsToCytoscape(
  cy: cytoscape.Core,
  metrics: {
    nodes?: Record<string, { status: string }>
    links?: Record<string, { status: string; utilization?: number }>
  },
): void {
  // Apply node status
  if (metrics.nodes) {
    for (const [nodeId, nodeMetrics] of Object.entries(metrics.nodes)) {
      const node = cy.getElementById(nodeId)
      if (node.length) {
        node.data('status', nodeMetrics.status)
      }
    }
  }

  // Apply link status and utilization
  if (metrics.links) {
    for (const [linkId, linkMetrics] of Object.entries(metrics.links)) {
      const edge = cy.getElementById(linkId)
      if (edge.length) {
        edge.data('status', linkMetrics.status)
        if (linkMetrics.utilization !== undefined) {
          edge.data('utilization', linkMetrics.utilization)
          // Update edge color based on utilization
          const color = getUtilizationColor(linkMetrics.utilization)
          edge.style('line-color', color)
          edge.style('target-arrow-color', color)
        }
      }
    }
  }
}
