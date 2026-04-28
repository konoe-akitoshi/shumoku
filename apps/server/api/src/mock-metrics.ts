/**
 * Mock Metrics Provider
 * Generates simulated metrics for development and testing
 */

import { type Link, linkSpeedBps, type NetworkGraph } from '@shumoku/core'
import type { MetricsData } from './types.js'

const DEFAULT_BANDWIDTH_BPS = 1_000_000_000 // 1 Gbps — fallback when link.bandwidth is unset

/**
 * Pick a node status with a realistic distribution that exercises every
 * status the renderer's NodeStatusOverlay knows about. This way DEMO
 * mode actually surfaces warning/degraded/unknown visuals, not just
 * up/down.
 */
function pickNodeStatus(): 'up' | 'down' | 'warning' | 'degraded' | 'unknown' {
  const r = Math.random()
  if (r < 0.85) return 'up' // 85%
  if (r < 0.92) return 'warning' // 7%
  if (r < 0.96) return 'degraded' // 4%
  if (r < 0.99) return 'down' // 3%
  return 'unknown' // 1%
}

function getNodeId(endpoint: Link['from'] | Link['to']): string {
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
      const status = pickNodeStatus()
      const healthy = status === 'up' || status === 'warning' || status === 'degraded'
      nodes[node.id] = {
        status,
        cpu: healthy ? this.generateSmoothValue(`node:${node.id}:cpu`, 5, 80, 5) : undefined,
        memory: healthy ? this.generateSmoothValue(`node:${node.id}:mem`, 20, 90, 3) : undefined,
        lastSeen: healthy ? Date.now() : Date.now() - 60000,
      }
    }

    // Generate link metrics
    for (const [i, link] of graph.links.entries()) {
      const linkId = link.id || `link-${i}`
      const fromNode = nodes[getNodeId(link.from)]
      const toNode = nodes[getNodeId(link.to)]

      // Link is down only if either endpoint is hard-down or unknown.
      // warning/degraded nodes still carry traffic.
      const endpointAlive = (s: string | undefined) =>
        s === 'up' || s === 'warning' || s === 'degraded'
      const status =
        endpointAlive(fromNode?.status) && endpointAlive(toNode?.status) ? 'up' : 'down'

      // Generate separate utilization for each direction (0-100)
      const inUtilization =
        status === 'up' ? this.generateSmoothValue(`link:${linkId}:in`, 0, 95, 10) : 0
      const outUtilization =
        status === 'up' ? this.generateSmoothValue(`link:${linkId}:out`, 0, 95, 10) : 0

      // Capacity from the link's standard (or override rateBps if set).
      const capacity = linkSpeedBps(link) ?? DEFAULT_BANDWIDTH_BPS
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
}
