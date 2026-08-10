import type { BuildInfo, SystemInfo } from '../services/system-info.js'
import type { Topology, TopologyInput } from '../types.js'

export interface TopologyCrudService {
  list(): Topology[]
  get(id: string): Topology | null
  create(input: TopologyInput): Promise<Topology>
  update(id: string, input: Partial<TopologyInput>): Promise<Topology | null>
  delete(id: string): boolean
}

export interface PollSchedulerStatusView {
  running: boolean
  activePolls: number
  queuedPolls: number
  topologyCount: number
  watchedTopologies: number
  inFlightTopologies: number
  fastIntervalMs: number
  slowIntervalMs: number
  concurrencyLimit: number
}

export interface DiscoverySchedulerStatusView {
  running: boolean
  tickInFlight: boolean
  tickIntervalMs: number
  minimumSyncIntervalMs: number
}

export interface AdminStatus {
  status: 'ok' | 'degraded'
  timestamp: number
  uptimeSeconds: number
  database: {
    ready: boolean
  }
  topologies: {
    database: number
    legacyFile: number
  }
  plugins: {
    registered: number
  }
  realtime: {
    webSocketClients: number
    sseSubscribers: number
  }
  schedulers: {
    metrics: PollSchedulerStatusView
    discovery: DiscoverySchedulerStatusView
  }
}

/**
 * Explicit application boundary for route dependencies.
 *
 * New route modules receive services through this object instead of importing
 * route-level singletons. Existing routes will move here incrementally.
 */
export interface AppServices {
  system: {
    getBuildInfo(): BuildInfo
    getSystemInfo(force?: boolean): Promise<SystemInfo>
  }
  admin: {
    getStatus(): AdminStatus
  }
  topologies: TopologyCrudService
}
