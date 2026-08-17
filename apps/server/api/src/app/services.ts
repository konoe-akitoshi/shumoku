import type {
  ConfigOption,
  ConnectionInfoItem,
  ConnectionResult,
  DataSourceCapability,
  DiscoveredMetric,
  EdgeStyle,
  Host,
  HostItem,
  Identity,
  InterfaceNeighbor,
  MetricsData,
  MetricsMapping,
  NetworkGraph,
  PluginConfigSchema,
  PluginManifest,
  ScopeFilter,
  Snapshot,
  SplineMode,
} from '@shumoku/core'
import type { Alert, AlertQueryOptions } from '../plugins/types.js'
import type { BuildInfo, SystemInfo } from '../services/system-info.js'
import type {
  CompositionMode,
  Dashboard,
  DashboardInput,
  DataSource,
  DataSourceInput,
  ScopeMode,
  Topology,
  TopologyDataSource,
  TopologyDataSourceInput,
  TopologyInput,
} from '../types.js'

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
  getHosts(id: string): Promise<Host[]>
  getHostItems(id: string, hostId: string): Promise<HostItem[]>
  getInterfaceNeighbors(id: string, hostId: string): Promise<InterfaceNeighbor[]>
  discoverMetrics(id: string, hostId: string): Promise<DiscoveredMetric[]>
  getFilterOptions(id: string): Promise<{
    sites: { slug: string; name: string }[]
    tags: { slug: string; name: string }[]
  } | null>
  getAlerts(id: string, options: AlertQueryOptions): Promise<Alert[] | null>
  callNative(
    id: string,
    method: string,
    params: Record<string, unknown>,
  ): Promise<{ ok: true; result: unknown } | { ok: false; status: 400 | 404; error: string }>
}

export interface DataSourceServices {
  crud: DataSourceCrudService
  operations: DataSourceOperationsService
  scan: DataSourceScanService
}

export interface DataSourceScanService {
  scan(
    id: string,
    input: { topologyId?: string; seeds?: string[] },
  ): Promise<
    | { ok: true; snapshot: Snapshot; observation?: TopologyObservationView }
    | { ok: false; status: 400 | 404; error: string }
  >
}

export interface TopologyObservationView {
  id: string
  topologyId: string
  sourceId: string
  capturedAt: number
  status: 'ok' | 'partial' | 'failed' | 'empty'
  statusMessage?: string
  graph: NetworkGraph | null
  nodeCount: number
  linkCount: number
  portCount: number
  createdAt: number
  contributionChanged?: boolean
}

export interface TopologyCrudService {
  list(): Topology[]
  get(id: string): Topology | null
  create(input: TopologyInput): Promise<Topology>
  update(id: string, input: Partial<TopologyInput>): Promise<Topology | null>
  delete(id: string): boolean
}

export interface DashboardApplicationService {
  list(): Dashboard[]
  get(id: string): Dashboard | null
  create(input: { name: string; layoutJson?: string }): Promise<Dashboard>
  update(id: string, input: Partial<DashboardInput>): Dashboard | null
  delete(id: string): boolean
  share(id: string): Promise<string | null>
  unshare(id: string): boolean
}

export interface SettingsApplicationService {
  list(): Record<string, string>
  get(key: string): string | null
  setMany(settings: Record<string, string>): void
  set(key: string, value: string): void
  delete(key: string): boolean
}

export interface AuthApplicationService {
  isSetupComplete(): boolean
  validateSession(token: string): boolean
  setPassword(password: string): Promise<void>
  verifyPassword(password: string): Promise<boolean>
  createSession(): string
  deleteSession(token: string): void
  checkRateLimit(clientId: string): number
  recordFailedAttempt(clientId: string): void
  clearAttempts(clientId: string): void
}

export interface PluginInfoView {
  id: string
  name: string
  version: string
  path: string
  capabilities: string[]
  configSchema?: PluginConfigSchema
  optionsSchema?: PluginConfigSchema
  enabled: boolean
  bundled: boolean
  error?: string
}

export type PluginMutationResult<T> =
  | { ok: true; value: T }
  | { ok: false; status: 400 | 404 | 500; error: string }

export interface PluginApplicationService {
  list(): PluginInfoView[]
  getManifest(id: string): Promise<PluginMutationResult<PluginManifest>>
  installFromPath(path: string): Promise<PluginMutationResult<PluginInfoView>>
  installFromUrl(url: string, subdirectory?: string): Promise<PluginMutationResult<PluginInfoView>>
  installFromZip(
    bytes: Uint8Array,
    subdirectory?: string,
  ): Promise<PluginMutationResult<PluginInfoView>>
  setEnabled(id: string, enabled: boolean): Promise<PluginMutationResult<{ success: true }>>
  remove(id: string, deleteFiles: boolean): Promise<PluginMutationResult<{ success: true }>>
  reload(): Promise<
    PluginMutationResult<{ success: true; plugins: PluginInfoView[]; count: number }>
  >
}

export interface ObservationSummaryView {
  id: string
  topologyId: string
  sourceId: string
  capturedAt: number
  status: TopologyObservationView['status']
  statusMessage?: string
  nodeCount: number
  linkCount: number
  portCount: number
  createdAt: number
}

export interface DisplaySettingsView {
  edgeStyle: EdgeStyle
  splineMode: SplineMode
  hideDisconnected: boolean
}

export interface TopologyObservationApplicationService {
  list(topologyId: string, limit: number): ObservationSummaryView[]
  get(observationId: string): TopologyObservationView | null
  latest(topologyId: string, sourceId: string): TopologyObservationView | null
  record(
    topologyId: string,
    sourceId: string,
    graph: NetworkGraph,
    status: TopologyObservationView['status'],
  ): Promise<TopologyObservationView>
  resolved(topologyId: string): Promise<{ graph: NetworkGraph; snapshotCount: number } | null>
  getDisplaySettings(topologyId: string): DisplaySettingsView
  updateDisplaySettings(
    topologyId: string,
    patch: Partial<DisplaySettingsView>,
  ): Promise<{ ok: true }>
}

export type TopologySourceMutationResult<T> =
  | { ok: true; value: T; status?: 200 | 201 }
  | { ok: false; status: 400 | 404 | 409 | 500; error: string }

export interface TopologySourceApplicationService {
  list(topologyId: string): TopologySourceMutationResult<TopologyDataSource[]>
  add(
    topologyId: string,
    input: TopologyDataSourceInput & { type?: string },
  ): Promise<TopologySourceMutationResult<TopologyDataSource | { dataSourceId: string }>>
  update(
    topologyId: string,
    attachmentId: string,
    input: Partial<TopologyDataSourceInput>,
  ): TopologySourceMutationResult<TopologyDataSource>
  remove(topologyId: string, attachmentId: string): TopologySourceMutationResult<{ success: true }>
  clear(
    topologyId: string,
    sourceId: string,
  ): TopologySourceMutationResult<{ success: true; deleted: number }>
  replace(
    topologyId: string,
    sources: TopologyDataSourceInput[],
  ): Promise<TopologySourceMutationResult<TopologyDataSource[]>>
  probe(
    topologyId: string,
    seeds: string[],
  ): Promise<TopologySourceMutationResult<{ observation: TopologyObservationView }>>
  sync(
    topologyId: string,
    sourceId: string,
  ): Promise<
    TopologySourceMutationResult<{
      observation: TopologyObservationView
      snapshot: {
        status: TopologyObservationView['status']
        statusMessage?: string
        capturedAt: number
        warnings?: string[]
        graph: NetworkGraph | null
      }
    }>
  >
}

export interface ParsedTopologyView {
  id: string
  name: string
  graph: NetworkGraph
  layout: {
    nodes: Record<string, { x: number; y: number }>
    bounds: { x: number; y: number; width: number; height: number }
  }
  metrics: MetricsData
  metricsSourceId?: string
  mapping?: MetricsMapping
  stale: boolean
}

export interface TopologyGraphView {
  id: string
  name: string
  graph: NetworkGraph
  stale: boolean
}

export type TopologyRenderView =
  | {
      id: string
      name: string
      hierarchical: false
      svg: string
      css: string
      viewBox: { x: number; y: number; width: number; height: number }
      nodeCount: number
      edgeCount: number
    }
  | {
      id: string
      name: string
      hierarchical: true
      sheets: Record<
        string,
        {
          svg: string
          css: string
          viewBox: { x: number; y: number; width: number; height: number }
          label: string
          parentId: string | null
        }
      >
      rootSheetId: string
      nodeCount: number
      edgeCount: number
    }

export interface TopologyContextView {
  id: string
  name: string
  nodes: Array<{ id: string; label: string; type: string; identity?: Identity }>
  edges: Array<{
    id: string
    from: { nodeId: string; port?: string; portInfo?: Record<string, unknown> }
    to: { nodeId: string; port?: string; portInfo?: Record<string, unknown> }
    standard?: string
  }>
  subgraphs: NetworkGraph['subgraphs']
  metrics: MetricsData
  metricsSourceId?: string
  mapping?: MetricsMapping
}

export interface TopologyCompositionView {
  scopeMode: ScopeMode
  scopeSourceId?: string
  scope: ScopeFilter
  compositionMode: CompositionMode
}

export type TopologyReadResult<T> =
  | { kind: 'ready'; value: T }
  | { kind: 'deriving' }
  | {
      kind: 'error'
      status: 400 | 404 | 422 | 500
      error: string
      errorPhase?: 'parse' | 'layout'
    }

export type TopologyImmediateResult<T> =
  | { kind: 'ready'; value: T }
  | { kind: 'error'; status: 400 | 404; error: string }

export interface TopologyQueryApplicationService {
  parsed(id: string): Promise<TopologyReadResult<ParsedTopologyView>>
  graph(id: string): Promise<TopologyReadResult<TopologyGraphView>>
  serializedView(id: string): Promise<TopologyReadResult<string>>
  render(id: string): Promise<TopologyReadResult<TopologyRenderView>>
  context(id: string): Promise<TopologyReadResult<TopologyContextView>>
  getComposition(id: string): TopologyImmediateResult<TopologyCompositionView>
  updateComposition(
    id: string,
    input: Partial<{
      scopeMode: ScopeMode
      scopeSourceId: string | null
      scope: ScopeFilter
      compositionMode: CompositionMode
    }>,
  ): TopologyImmediateResult<TopologyCompositionView>
}

export interface SourceMetricsMappingView {
  sourceId: string
  sourceName: string
  priority: number
  mapping: MetricsMapping
}

export interface MappingOrphanView {
  entityId: string
  kind: string
  sourceId: string
  payload: unknown
}

export type TopologyMappingResult<T> =
  | { ok: true; value: T }
  | { ok: false; status: 400 | 404 | 409 | 422 | 500; error: string }

export interface TopologyMappingApplicationService {
  get(id: string, sourceId?: string): Promise<TopologyMappingResult<MetricsMapping>>
  listSources(id: string): Promise<TopologyMappingResult<SourceMetricsMappingView[]>>
  listOrphans(id: string): Promise<TopologyMappingResult<{ orphans: MappingOrphanView[] }>>
  reassignOrphan(
    id: string,
    entityId: string,
    toEntityId: string,
  ): Promise<TopologyMappingResult<{ success: true }>>
  discardOrphan(id: string, entityId: string): TopologyMappingResult<{ success: true }>
  resetRegistry(id: string): TopologyMappingResult<{ success: true }>
  replace(
    id: string,
    mapping: MetricsMapping,
    sourceId?: string,
  ): Promise<TopologyMappingResult<Topology & { skipped: { nodes: number; links: number } }>>
  patchNode(
    id: string,
    nodeId: string,
    input: { hostId?: string; hostName?: string; sourceId?: string },
  ): Promise<
    TopologyMappingResult<{
      success: true
      topology: Topology
      nodeMapping: { hostId?: string; hostName?: string } | null
    }>
  >
  patchLink(
    id: string,
    linkId: string,
    input: {
      monitoredNodeId?: string
      interface?: string
      bandwidth?: number
      sourceId?: string
    } | null,
  ): Promise<
    TopologyMappingResult<{
      success: true
      topology: Topology
      linkMapping: { monitoredNodeId?: string; interface?: string; bandwidth?: number } | null
    }>
  >
  clear(
    id: string,
    kind: 'node' | 'link',
    sourceId?: string,
  ): TopologyMappingResult<{ deleted: number }>
  autoMapLinks(
    id: string,
    input: { overwrite?: boolean; sourceId?: string },
  ): Promise<TopologyMappingResult<{ matched: number; total: number; skipped: number }>>
}

export interface SyncJobStepView {
  key: string
  label: string
  status: 'pending' | 'running' | 'done' | 'failed' | 'skipped'
  message?: string
  nodeCount?: number
  linkCount?: number
  stage?: string
}

export interface SyncJobView {
  id: string
  topologyId: string
  state: 'running' | 'done' | 'failed' | 'cancelled'
  startedAt: number
  finishedAt?: number
  steps: SyncJobStepView[]
  cancelRequested: boolean
}

export type TopologySyncResult<T> =
  | { ok: true; value: T; status?: 200 | 202 | 409 }
  | { ok: false; status: 400 | 404 | 500; error: string }

export interface TopologySyncApplicationService {
  start(id: string, rebuild: boolean): Promise<TopologySyncResult<{ job: SyncJobView }>>
  getJob(id: string): TopologySyncResult<{ job: SyncJobView | null }>
  cancel(id: string): TopologySyncResult<{ job: SyncJobView | null }>
  share(id: string): Promise<TopologySyncResult<{ shareToken: string }>>
  unshare(id: string): TopologySyncResult<{ success: true }>
}

export interface DeepReadConfigView {
  entityId: string
  community?: string
  mode?: 'auto' | 'observe' | 'disabled'
  intervalMs?: number
}

export interface DeepReadConfigPatchView {
  community?: string | null
  mode?: 'auto' | 'observe' | 'disabled' | null
  intervalMs?: number | null
}

export interface DiscoveryPolicyApplicationService {
  getTopology(id: string): Topology | null
  getParsedGraph(id: string): Promise<NetworkGraph | null>
  clearCache(id: string): void
  readOverlay(id: string): NetworkGraph | null
  writeOverlay(id: string, graph: NetworkGraph): Promise<void>
  listConfigs(id: string): Map<string, DeepReadConfigView>
  bulkSetConfig(id: string, patch: DeepReadConfigPatchView): void
  upsertConfig(
    topologyId: string,
    entityId: string,
    patch: DeepReadConfigPatchView,
  ): DeepReadConfigView | null | 'not-a-node'
}

export type ShareReadResult<T> =
  | { ok: true; value: T }
  | { ok: false; status: 400 | 404 | 422 | 500; error: string }

export interface ShareApplicationService {
  topology(
    token: string,
    resource: 'context' | 'graph' | 'view' | 'render',
  ): Promise<ShareReadResult<unknown>>
  dashboard(token: string): ShareReadResult<{ id: string; name: string; layoutJson: string }>
  dashboardTopology(
    token: string,
    id: string,
    resource: 'metadata' | 'graph' | 'context',
  ): Promise<ShareReadResult<unknown>>
  dashboardAlerts(
    token: string,
    id: string,
    options: AlertQueryOptions,
  ): Promise<ShareReadResult<unknown[]>>
  topologyStreamId(token: string): string | null
  dashboardTopologyStreamId(token: string, id: string): string | null
  liveSubscriberCount(): number
  latestMetrics(topologyId: string): MetricsData | null
  subscribeMetrics(topologyId: string, listener: (metrics: MetricsData) => void): () => void
  servedRevision(topologyId: string): number
  mappingVersion(topologyId: string): number
}

export type WebhookResult =
  | {
      ok: true
      value:
        | { success: true; topologyId: string; nodeCount: number; linkCount: number }
        | { success: true; alertCount: number }
    }
  | { ok: false; status: 400 | 401 | 404 | 500; error: string }

export interface WebhookApplicationService {
  handle(type: string, id: string, secret: string | null, payload: unknown): Promise<WebhookResult>
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
    total: number
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
  auth: AuthApplicationService
  dataSources: DataSourceServices
  dashboards: DashboardApplicationService
  settings: SettingsApplicationService
  plugins: PluginApplicationService
  observations: TopologyObservationApplicationService
  topologySources: TopologySourceApplicationService
  topologyQueries: TopologyQueryApplicationService
  topologyMappings: TopologyMappingApplicationService
  topologySync: TopologySyncApplicationService
  discoveryPolicy: DiscoveryPolicyApplicationService
  share: ShareApplicationService
  webhooks: WebhookApplicationService
  topologies: TopologyCrudService
}
