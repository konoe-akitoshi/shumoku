/**
 * The live metrics of a topology, as the Server sends them. Views read them through
 * `watchTopologyLive` (`./live.svelte.ts`), one feed per topology.
 */

// Types
export type NodeStatus = 'up' | 'down' | 'unknown' | 'warning' | 'degraded'
export type EdgeStatus = 'up' | 'down' | 'unknown' | 'degraded'

/** State of the monitoring path itself — see core plugin-types for details. */
export type MonitoringHealth = 'healthy' | 'degraded' | 'failing' | 'pending' | 'paused'

export interface NodeMetricSample {
  status: NodeStatus
  /** Last time the host was confirmed reachable (epoch ms). */
  lastSeen?: number
  /** Whether monitoring is succeeding (orthogonal to device status). */
  monitoring?: MonitoringHealth
  /** Short reason when monitoring !== 'healthy' (e.g. SNMP timeout text). */
  monitoringError?: string
  cpu?: number
  memory?: number
}

export interface EdgeMetricSample {
  status: EdgeStatus
  utilization?: number // Legacy: max of in/out
  inUtilization?: number // Incoming direction (0-100)
  outUtilization?: number // Outgoing direction (0-100)
  inBps?: number // Incoming traffic in bits per second
  outBps?: number // Outgoing traffic in bits per second
}

export interface MetricsObservationSource {
  id: string
  name: string
  type: string
}

export interface NodeMetricObservation {
  source: MetricsObservationSource
  timestamp: number
  sample: NodeMetricSample
}

export interface EdgeMetricObservation {
  source: MetricsObservationSource
  timestamp: number
  sample: EdgeMetricSample
}

export interface MetricsRedundancy {
  totalSources: number
  reportingSources: number
  healthySources: number
  failingSources: number
  pendingSources: number
  pausedSources: number
  agreement: 'single' | 'confirmed' | 'degraded' | 'conflicting' | 'unknown'
}

export interface NodeMetrics extends NodeMetricSample {
  observations?: NodeMetricObservation[]
  redundancy?: MetricsRedundancy
}

export interface EdgeMetrics extends EdgeMetricSample {
  observations?: EdgeMetricObservation[]
}

export interface MetricsData {
  nodes: Record<string, NodeMetrics>
  links: Record<string, EdgeMetrics>
  timestamp: number
  warnings?: string[]
}
