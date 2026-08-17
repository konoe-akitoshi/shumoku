import type {
  ConfigOption,
  ConnectionInfoItem,
  ConnectionResult,
  DataSourceCapability,
  PluginConfigSchema,
} from '@shumoku/core'
import type { BuildInfo, SystemInfo } from '../services/system-info.js'
import type { DataSource, DataSourceInput, Topology, TopologyInput } from '../types.js'

export interface DataSourceCrudService {
  list(): DataSource[]
  get(id: string): DataSource | null
  create(input: DataSourceInput): Promise<DataSource>
  update(id: string, input: Partial<DataSourceInput>): Promise<DataSource | null>
  delete(id: string): boolean
}

export interface DataSourcePluginView {
  type: string
  displayName: string
  capabilities: readonly DataSourceCapability[]
  configSchema?: PluginConfigSchema
  optionsSchema?: PluginConfigSchema
}

export interface AttachedTopologyView {
  topologyId: string
  name: string
}

export interface DataSourceOperationsService {
  listByCapability(capability: 'topology' | 'metrics' | 'alerts'): DataSource[]
  listPluginTypes(): DataSourcePluginView[]
  getConfigOptions(id: string, key: string): Promise<ConfigOption[] | null>
  getConnectionInfo(id: string, serverOrigin: string): ConnectionInfoItem[]
  listAttachedTopologies(id: string): AttachedTopologyView[] | null
  testConnection(id: string): Promise<ConnectionResult>
}

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
  dataSources: DataSourceCrudService
  dataSourceOperations: DataSourceOperationsService
  topologies: TopologyCrudService
}
