/**
 * Mock Metrics Provider
 * Generates simulated metrics for development and testing
 */

import type { Link, NetworkGraph } from '@shumoku/core'
import type { MetricsData } from './types.js'
import { getBandwidthCapacity } from './bandwidth.js'

/**
 * Extract node ID from a link endpoint (can be string or object)
 */
function getNodeId(endpoint: Link['from'] | Link['to']): string {
  if (typeof endpoint === 'string') {
    return endpoint.split(':')[0]
  }
  return endpoint.node
}

export class MockMetricsProvider {
  private lastValues: Map<string, number> = new Map()

  /**
   * Generate mock metrics for a network graph
   */
  generateMetrics(graph: NetworkGraph): MetricsData {
    const nodes: MetricsData['nodes'] = {}
    const links: MetricsData['links'] = {}

    // Generate node metrics
    for (const node of graph.nodes) {
      // 95% chance of being up
      const status = Math.random() > 0.05 ? 'up' : 'down'
      nodes[node.id] = {
        status,
        cpu:
          status === 'up' ? this.generateSmoothValue(`node:${node.id}:cpu`, 5, 80, 5) : undefined,
        memory:
          status === 'up' ? this.generateSmoothValue(`node:${node.id}:mem`, 20, 90, 3) : undefined,
        lastSeen: status === 'up' ? Date.now() : Date.now() - 60000,
      }
    }

    // Generate link metrics
    for (let i = 0; i < graph.links.length; i++) {
      const link = graph.links[i]
      const linkId = link.id || `link-${i}`
      const fromNode = nodes[getNodeId(link.from)]
      const toNode = nodes[getNodeId(link.to)]

      // Link is down if either node is down
      const status = fromNode?.status === 'up' && toNode?.status === 'up' ? 'up' : 'down'

      // Generate separate utilization for each direction (0-100)
      const inUtilization =
        status === 'up' ? this.generateSmoothValue(`link:${linkId}:in`, 0, 95, 10) : 0
      const outUtilization =
        status === 'up' ? this.generateSmoothValue(`link:${linkId}:out`, 0, 95, 10) : 0

      // Calculate bandwidth in bps based on link bandwidth setting
      const capacity = getBandwidthCapacity(link.bandwidth)
      const inBps = status === 'up' ? Math.round((inUtilization / 100) * capacity) : 0
      const outBps = status === 'up' ? Math.round((outUtilization / 100) * capacity) : 0

      // Legacy utilization is max of both directions
      const utilization = Math.max(inUtilization, outUtilization)

      links[linkId] = {
        status,
        utilization: Math.round(utilization * 10) / 10,
        inUtilization: Math.round(inUtilization * 10) / 10,
        outUtilization: Math.round(outUtilization * 10) / 10,
        inBps,
        outBps,
      }
    }

    return {
      nodes,
      links,
      timestamp: Date.now(),
    }
  }

  /**
   * Generate a smoothly varying value (random walk)
   */
  private generateSmoothValue(key: string, min: number, max: number, maxDelta: number): number {
    let current = this.lastValues.get(key)
    if (current === undefined) {
      current = min + Math.random() * (max - min)
    }

    // Random walk with momentum toward middle
    const middle = (min + max) / 2
    const delta = (Math.random() - 0.5) * 2 * maxDelta
    const drift = (middle - current) * 0.05

    current = current + delta + drift
    current = Math.max(min, Math.min(max, current))

    this.lastValues.set(key, current)
    return current
  }

  /**
   * Get bandwidth capacity in bps
   */
}
