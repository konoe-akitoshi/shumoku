/**
 * API Client
 * Handles all communication with the Shumoku server API
 */

import type { NetworkGraph } from '@shumoku/core'
import type {
  Alert,
  AlertQueryOptions,
  ConnectionResult,
  Dashboard,
  DashboardInput,
  DataSource,
  DataSourceInput,
  LinkContribution,
  MetricsMapping,
  NodeContribution,
  ScopeFilter,
  ScopeMode,
  SyncMode,
  Topology,
  TopologyContext,
  TopologyDataSource,
  TopologyDataSourceInput,
  TopologyInput,
} from './types'

const BASE_URL = '/api'

/**
 * Shared-dashboard view context. When a shared dashboard is open (no auth
 * cookie), its widgets must read topology/datasource data through the
 * token-scoped `/share/dashboards/:token/*` endpoints instead of the
 * management endpoints (which 401 for anonymous viewers). The share page sets
 * this on mount and clears it on destroy; widgets consult `isSharedView()` to
 * skip selector-list calls that only make sense while editing.
 */
let shareDashboardToken: string | null = null

export function setShareDashboardToken(token: string | null): void {
  shareDashboardToken = token
}

export function isSharedView(): boolean {
  return shareDashboardToken !== null
}

/** Prefix a widget read path with the active share scope, when in a shared view. */
function scoped(managementPath: string, sharePath: string): string {
  return shareDashboardToken
    ? `/share/dashboards/${shareDashboardToken}${sharePath}`
    : managementPath
}

/**
 * Full URL for a widget read that uses raw `fetch` rather than the typed
 * client, applying the active share scope. `suffix` is a management-style path
 * (e.g. `/topologies/abc/context`); in a shared view it's rewritten to the
 * token-scoped equivalent.
 */
export function apiUrl(suffix: string): string {
  return `${BASE_URL}${scoped(suffix, suffix)}`
}

class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${BASE_URL}${path}`

  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  })

  if (!response.ok) {
    let message = `HTTP error ${response.status}`
    try {
      const data = await response.json()
      if (data.error) {
        message = data.error
      }
    } catch {
      // Ignore JSON parsing error
    }
    throw new ApiError(message, response.status)
  }

  return response.json()
}

import type {
  DataSourceCapability,
  DataSourcePluginInfo,
  DiscoveredMetric,
  Host,
  HostItem,
  InterfaceNeighbor,
} from './types'

// Data Sources API
export const dataSources = {
  list: () => request<DataSource[]>('/datasources'),

  listByCapability: (capability: DataSourceCapability) =>
    request<DataSource[]>(`/datasources/by-capability/${capability}`),

  getPluginTypes: () => request<DataSourcePluginInfo[]>('/datasources/types'),

  /** Dynamic candidates for an `optionsSource` schema field (connection-backed). */
  getConfigOptions: (id: string, key: string) =>
    request<{ options: { value: string; label: string }[] }>(
      `/datasources/${id}/config-options/${key}`,
    ),

  /** Derived, display-only connection info (e.g. webhook URL). Generic across plugins. */
  getConnectionInfo: (id: string, origin: string) =>
    request<{ items: { label: string; value: string; copyable?: boolean }[] }>(
      `/datasources/${id}/connection-info?origin=${encodeURIComponent(origin)}`,
    ),

  get: (id: string) => request<DataSource>(`/datasources/${id}`),

  create: (input: DataSourceInput) =>
    request<DataSource>('/datasources', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  update: (id: string, input: Partial<DataSourceInput>) =>
    request<DataSource>(`/datasources/${id}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    }),

  delete: (id: string) =>
    request<{ success: boolean }>(`/datasources/${id}`, {
      method: 'DELETE',
    }),

  test: (id: string) =>
    request<ConnectionResult>(`/datasources/${id}/test`, {
      method: 'POST',
    }),

  /** Topologies this data source is currently attached to. */
  listAttachedTopologies: (id: string) =>
    request<{ topologyId: string; name: string }[]>(`/datasources/${id}/topologies`),

  getHosts: (id: string) => request<Host[]>(`/datasources/${id}/hosts`),

  getHostItems: (id: string, hostId: string) =>
    request<HostItem[]>(`/datasources/${id}/hosts/${hostId}/items`),

  getInterfaceNeighbors: (id: string, hostId: string) =>
    request<InterfaceNeighbor[]>(`/datasources/${id}/hosts/${hostId}/neighbors`),

  discoverMetrics: (id: string, hostId: string) =>
    request<DiscoveredMetric[]>(`/datasources/${id}/hosts/${hostId}/metrics`),

  getAlerts: (id: string, options?: AlertQueryOptions) => {
    const params = new URLSearchParams()
    if (options?.timeRange) {
      params.set('timeRange', options.timeRange.toString())
    }
    if (options?.activeOnly) {
      params.set('activeOnly', 'true')
    }
    if (options?.minSeverity) {
      params.set('minSeverity', options.minSeverity)
    }
    const queryString = params.toString()
    const suffix = `/datasources/${id}/alerts${queryString ? `?${queryString}` : ''}`
    return request<Alert[]>(scoped(suffix, suffix))
  },

  getFilterOptions: (id: string) =>
    request<{ sites: { slug: string; name: string }[]; tags: { slug: string; name: string }[] }>(
      `/datasources/${id}/filter-options`,
    ),

  /**
   * Trigger an ad-hoc autoscan. If `topologyId` is provided the snapshot
   * is persisted to `topology_observations`; otherwise it 's returned but
   * not stored (useful for "test scan" previews).
   */
  scan: (id: string, body?: { topologyId?: string; seeds?: string[] }) =>
    request<{
      snapshot: {
        status: 'ok' | 'partial' | 'failed' | 'empty'
        statusMessage?: string
        capturedAt: number
        graph: NetworkGraph | null
        warnings?: string[]
      }
      observation?: {
        id: string
        nodeCount: number
        linkCount: number
        portCount: number
      }
    }>(`/datasources/${id}/scan`, {
      method: 'POST',
      body: JSON.stringify(body ?? {}),
    }),
}

// Topologies API
export const topologies = {
  list: () => request<Topology[]>('/topologies'),

  get: (id: string) => request<Topology>(scoped(`/topologies/${id}`, `/topologies/${id}`)),

  create: (input: TopologyInput) =>
    request<Topology>('/topologies', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  update: (id: string, input: Partial<TopologyInput>) =>
    request<Topology>(`/topologies/${id}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    }),

  delete: (id: string) =>
    request<{ success: boolean }>(`/topologies/${id}`, {
      method: 'DELETE',
    }),

  // The resolved mapping (metrics-binding attachments ∪ residual mapping_json).
  // Hydrate the mapping UI from this, NOT topology.mappingJson — the latter
  // misses node bindings stored as attachments.
  getMapping: (id: string) => request<MetricsMapping>(`/topologies/${id}/mapping`),

  updateMapping: (id: string, mapping: MetricsMapping) =>
    request<Topology>(`/topologies/${id}/mapping`, {
      method: 'PUT',
      body: JSON.stringify(mapping),
    }),

  updateNodeMapping: (
    topologyId: string,
    nodeId: string,
    mapping: { hostId?: string; hostName?: string },
  ) =>
    request<{
      success: boolean
      topology: Topology
      nodeMapping: { hostId?: string; hostName?: string } | null
    }>(`/topologies/${topologyId}/mapping/nodes/${nodeId}`, {
      method: 'PATCH',
      body: JSON.stringify(mapping),
    }),

  syncFromSource: (id: string) =>
    request<{ success: boolean; topology: Topology; nodeCount: number; linkCount: number }>(
      `/topologies/${id}/sync-from-source`,
      { method: 'POST' },
    ),

  renderSvg: async (id: string): Promise<string> => {
    const response = await fetch(`${BASE_URL}/topologies/${id}/render`)
    if (!response.ok) {
      throw new ApiError('Failed to render topology', response.status)
    }
    return response.text()
  },

  getGraph: (id: string) =>
    request<{ id: string; name: string; graph: NetworkGraph }>(
      scoped(`/topologies/${id}/graph`, `/topologies/${id}/graph`),
    ),

  /** Resolved graph = project overlay folded with each attached source's contribution. */
  getResolved: (id: string) =>
    request<{ graph: NetworkGraph; snapshotCount: number }>(`/topologies/${id}/resolved`),

  /** Recent observation snapshots for this topology (counters only). */
  listObservations: (id: string, limit?: number) => {
    const params = limit ? `?limit=${limit}` : ''
    return request<
      {
        id: string
        topologyId: string
        sourceId: string
        capturedAt: number
        status: 'ok' | 'partial' | 'failed' | 'empty'
        statusMessage?: string
        nodeCount: number
        linkCount: number
        portCount: number
        createdAt: number
      }[]
    >(`/topologies/${id}/observations${params}`)
  },

  getObservation: (id: string, obsId: string) =>
    request<{
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
    }>(`/topologies/${id}/observations/${obsId}`),

  getContext: (id: string, theme?: 'light' | 'dark') => {
    const params = theme ? `?theme=${theme}` : ''
    return request<TopologyContext>(
      scoped(`/topologies/${id}/context${params}`, `/topologies/${id}/context${params}`),
    )
  },

  // Sharing
  share: (id: string) =>
    request<{ shareToken: string }>(`/topologies/${id}/share`, {
      method: 'POST',
    }),

  unshare: (id: string) =>
    request<{ success: boolean }>(`/topologies/${id}/share`, {
      method: 'DELETE',
    }),

  // Topology-level scope (composition). Single per-topology decision: `scope` is
  // the common include/exclude criteria the resolver enforces post-merge.
  composition: {
    get: (id: string) =>
      request<{ scopeMode: ScopeMode; scopeSourceId?: string; scope: ScopeFilter }>(
        `/topologies/${id}/composition`,
      ),

    set: (
      id: string,
      body: { scopeMode?: ScopeMode; scopeSourceId?: string | null; scope?: ScopeFilter },
    ) =>
      request<{ scopeMode: ScopeMode; scopeSourceId?: string; scope: ScopeFilter }>(
        `/topologies/${id}/composition`,
        {
          method: 'PUT',
          body: JSON.stringify(body),
        },
      ),
  },

  // Topology Data Sources (many-to-many)
  sources: {
    list: (topologyId: string) =>
      request<TopologyDataSource[]>(`/topologies/${topologyId}/sources`),

    add: (topologyId: string, input: TopologyDataSourceInput) =>
      request<TopologyDataSource>(`/topologies/${topologyId}/sources`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),

    update: (
      topologyId: string,
      sourceId: string,
      updates: {
        syncMode?: SyncMode
        priority?: number
        optionsJson?: string
        nodeContribution?: NodeContribution
        linkContribution?: LinkContribution
      },
    ) =>
      request<TopologyDataSource>(`/topologies/${topologyId}/sources/${sourceId}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      }),

    remove: (topologyId: string, sourceId: string) =>
      request<{ success: boolean }>(`/topologies/${topologyId}/sources/${sourceId}`, {
        method: 'DELETE',
      }),

    replaceAll: (topologyId: string, sources: TopologyDataSourceInput[]) =>
      request<TopologyDataSource[]>(`/topologies/${topologyId}/sources`, {
        method: 'PUT',
        body: JSON.stringify({ sources }),
      }),

    sync: (topologyId: string, sourceId: string) =>
      request<{ topology: Topology; nodeCount: number; linkCount: number }>(
        `/topologies/${topologyId}/sources/${sourceId}/sync`,
        { method: 'POST' },
      ),

    syncAll: (topologyId: string) =>
      request<{ topology: Topology; nodeCount: number; linkCount: number }>(
        `/topologies/${topologyId}/sync-from-source`,
        { method: 'POST' },
      ),

    /**
     * Sync exactly one attached topology source. Dispatches by
     * capability server-side (autoscan → scan, otherwise fetchTopology)
     * and records the result as an observation snapshot.
     */
    syncOne: (topologyId: string, sourceId: string) =>
      request<{
        snapshot: {
          status: 'ok' | 'partial' | 'failed' | 'empty'
          statusMessage?: string
          capturedAt: number
          warnings?: string[]
          graph: NetworkGraph | null
        }
        observation: {
          id: string
          nodeCount: number
          linkCount: number
          portCount: number
        }
      }>(`/topologies/${topologyId}/sources/${sourceId}/sync`, { method: 'POST' }).catch((err) => {
        throw err
      }),

    /** Clear a source's contribution (delete its observations); attachment stays. */
    clear: (topologyId: string, sourceId: string) =>
      request<{ success: boolean; deleted: number }>(
        `/topologies/${topologyId}/sources/${sourceId}/clear`,
        { method: 'POST' },
      ),

    /**
     * Targeted probe of an attached source. Semantically distinct
     * from `syncOne` — probe re-checks the named seeds only, not the
     * source 's whole configured scope. Used by the Discovery tab 's
     * per-node card to re-poke a single device.
     */
    probe: (topologyId: string, sourceId: string, seeds: string[]) =>
      request<{
        snapshot: {
          status: 'ok' | 'partial' | 'failed' | 'empty'
          statusMessage?: string
          capturedAt: number
          warnings?: string[]
          graph: NetworkGraph | null
        }
        observation: { id: string; nodeCount: number; linkCount: number; portCount: number }
      }>(`/topologies/${topologyId}/sources/${sourceId}/probe`, {
        method: 'POST',
        body: JSON.stringify({ seeds }),
      }),

    /**
     * Latest observation graph for a specific source attached to this
     * topology. `graph` is null when the source has no observation yet
     * (e.g. a freshly-attached source). This is what the Manual editor
     * loads — explicitly the *source 's* snapshot, not the resolved
     * project graph.
     */
    latestSnapshot: (topologyId: string, sourceId: string) =>
      request<{
        graph: NetworkGraph | null
        capturedAt: number | null
        status?: 'ok' | 'partial' | 'failed' | 'empty'
        observationId?: string
      }>(`/topologies/${topologyId}/sources/${sourceId}/latest-snapshot`),

    /**
     * Record a new observation against a specific source. Manual
     * editor save goes through this; any caller pushing a snapshot
     * (e.g. webhook receivers) can use it too.
     */
    recordObservation: (
      topologyId: string,
      sourceId: string,
      graph: NetworkGraph,
      status?: 'ok' | 'partial' | 'failed' | 'empty',
    ) =>
      request<{ observation: { id: string } }>(
        `/topologies/${topologyId}/sources/${sourceId}/observation`,
        {
          method: 'POST',
          body: JSON.stringify({ graph, status: status ?? 'ok' }),
        },
      ),

    /** Create-and-attach a new Manual source to a topology (no cardinality limit). */
    attachManual: (topologyId: string) =>
      request<{ dataSourceId: string }>(`/topologies/${topologyId}/sources`, {
        method: 'POST',
        body: JSON.stringify({ type: 'manual', purpose: 'topology' }),
      }),
  },

  /**
   * Topology display settings (edge style / spline mode). Project-level
   * presentation prefs stored on the project overlay — NOT a Manual source.
   */
  displaySettings: {
    get: (id: string) =>
      request<{ edgeStyle: string; splineMode: string; hideDisconnected: boolean }>(
        `/topologies/${id}/display-settings`,
      ),
    set: (
      id: string,
      body: { edgeStyle?: string; splineMode?: string; hideDisconnected?: boolean },
    ) =>
      request<{ ok: boolean }>(`/topologies/${id}/display-settings`, {
        method: 'PUT',
        body: JSON.stringify(body),
      }),
  },

  /**
   * Discovery policy — per-node / per-subgraph / topology-default
   * overrides for what the scheduler does (auto / observe / disabled)
   * and how often. The server folds the inheritance chain and returns
   * the *effective* policy for every entity; the UI just renders it.
   * See `apps/server/api/src/api/discovery-policy.ts` for the route.
   */
  discoveryPolicy: {
    get: (topologyId: string) =>
      request<{
        topologyDefault: Attachment[] | null
        runtimeDefault: { mode: DiscoveryMode; intervalMs: number }
        nodes: Record<string, EffectivePolicy>
        subgraphs: Record<string, EffectivePolicy>
      }>(`/topologies/${topologyId}/discovery-policy`),

    /**
     * Replace a scope's attachments wholesale (`null`/`[]` clears), set a
     * node's name override (`label`; `null`/'' reverts to the observed name),
     * and/or set a node's `suppressedAttachments` (keys the human removed;
     * `null`/`[]` clears). For node scope each field is applied only when
     * present, so a label edit never wipes the access/policy a node carries.
     */
    patch: (
      topologyId: string,
      body:
        | { scope: 'topology'; attachments: Attachment[] | null }
        | { scope: 'subgraph'; id: string; attachments: Attachment[] | null }
        | {
            scope: 'node'
            id: string
            attachments?: Attachment[] | null
            label?: string | null
            suppressedAttachments?: string[] | null
          },
    ) =>
      request<{ effective: EffectivePolicy }>(`/topologies/${topologyId}/discovery-policy`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),

    /** Hide a node (identity-keyed exclusion). resolve() drops matching clusters. */
    hide: (topologyId: string, identity: NodeExclusion) =>
      request<{ exclusions: NodeExclusion[] }>(
        `/topologies/${topologyId}/discovery-policy/exclusions`,
        { method: 'POST', body: JSON.stringify(identity) },
      ),

    /** Unhide a previously hidden node. */
    unhide: (topologyId: string, identity: NodeExclusion) =>
      request<{ exclusions: NodeExclusion[] }>(
        `/topologies/${topologyId}/discovery-policy/exclusions`,
        { method: 'DELETE', body: JSON.stringify(identity) },
      ),

    /** Rebuild: discard the whole authored overlay (attachments + exclusions). */
    rebuild: (topologyId: string) =>
      request<{ cleared: boolean; reason?: string }>(
        `/topologies/${topologyId}/discovery-policy/rebuild`,
        { method: 'POST' },
      ),
  },
}

/** Identity used to hide/unhide a node. Mirrors `@shumoku/core`'s NodeExclusion. */
export interface NodeExclusion {
  mgmtIp?: string
  chassisId?: string
  sysName?: string
}

export type DiscoveryMode = 'auto' | 'observe' | 'disabled'

/** Where a resolved attachment's value came from. Mirrors `@shumoku/core`'s
 *  `Provenance`. `source === 'intrinsic'` marks a project-owned (your own) value;
 *  any other source is the value a discovery source supplied. The UI uses this as
 *  an annotation ("your value" vs "from <source>"), NOT as a read-only gate —
 *  every value is editable. resolve() stamps it; freshly-authored local
 *  attachments omit it until the next round-trip. */
export interface Provenance {
  source: string
  state?: 'confirmed' | 'intrinsic-only' | 'discovered-only' | 'conflicting'
  observedAt?: number
}

/** A unit of authored intent attached to a node / subgraph / topology.
 *  Mirrors `@shumoku/core`'s `Attachment` (incl. the resolve-stamped
 *  `provenance`). */
export type Attachment = (
  | { kind: 'policy'; mode?: DiscoveryMode; intervalMs?: number }
  | { kind: 'access'; protocol: 'snmp'; community?: string; version?: '2c' | '3' }
  | { kind: 'access'; protocol: 'ssh'; username?: string; port?: number }
  | { kind: 'access'; protocol: 'netconf' | 'http' }
) & { provenance?: Provenance }
export interface EffectivePolicy {
  mode: DiscoveryMode
  intervalMs: number
  community?: string
  source: {
    mode: 'node' | 'subgraph' | 'topology' | 'default'
    intervalMs: 'node' | 'subgraph' | 'topology' | 'default'
    community: 'node' | 'subgraph' | 'topology' | 'default'
  }
}

// Settings API
export const settings = {
  get: () => request<Record<string, string>>('/settings'),

  update: (settings: Record<string, string>) =>
    request<{ success: boolean }>('/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    }),

  getValue: (key: string) => request<{ key: string; value: string }>(`/settings/${key}`),

  setValue: (key: string, value: string) =>
    request<{ key: string; value: string }>(`/settings/${key}`, {
      method: 'PUT',
      body: JSON.stringify({ value }),
    }),
}

// Dashboards API
export const dashboards = {
  list: () => request<Dashboard[]>('/dashboards'),

  get: (id: string) => request<Dashboard>(`/dashboards/${id}`),

  create: (input: DashboardInput) =>
    request<Dashboard>('/dashboards', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  update: (id: string, input: Partial<DashboardInput>) =>
    request<Dashboard>(`/dashboards/${id}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    }),

  delete: (id: string) =>
    request<{ success: boolean }>(`/dashboards/${id}`, {
      method: 'DELETE',
    }),

  share: (id: string) =>
    request<{ shareToken: string }>(`/dashboards/${id}/share`, {
      method: 'POST',
    }),

  unshare: (id: string) =>
    request<{ success: boolean }>(`/dashboards/${id}/share`, {
      method: 'DELETE',
    }),
}

// Health check
export const health = {
  check: () => request<{ status: string; timestamp: number }>('/health'),
}

// Plugin types for UI
export interface PluginInfo {
  id: string
  name: string
  version: string
  path: string
  capabilities: string[]
  configSchema?: {
    type: 'object'
    required?: string[]
    properties: Record<
      string,
      {
        type: string
        title?: string
        description?: string
        format?: string
        default?: unknown
      }
    >
  }
  enabled: boolean
  bundled: boolean
  error?: string
}

// Plugins API
export const plugins = {
  list: () => request<PluginInfo[]>('/plugins'),

  getManifest: (id: string) =>
    request<{
      id: string
      name: string
      version: string
      capabilities: string[]
      configSchema?: PluginInfo['configSchema']
    }>(`/plugins/${id}/manifest`),

  addByPath: (path: string) =>
    request<PluginInfo>('/plugins', {
      method: 'POST',
      body: JSON.stringify({ path }),
    }),

  addByUrl: (url: string, subdirectory?: string) =>
    request<PluginInfo>('/plugins', {
      method: 'POST',
      body: JSON.stringify({ url, subdirectory }),
    }),

  uploadZip: async (file: File, subdirectory?: string): Promise<PluginInfo> => {
    const formData = new FormData()
    formData.append('file', file)
    if (subdirectory) {
      formData.append('subdirectory', subdirectory)
    }

    const response = await fetch(`${BASE_URL}/plugins`, {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      let message = `HTTP error ${response.status}`
      try {
        const data = await response.json()
        if (data.error) message = data.error
      } catch {
        /* ignore */
      }
      throw new ApiError(message, response.status)
    }

    return response.json()
  },

  setEnabled: (id: string, enabled: boolean) =>
    request<{ success: boolean }>(`/plugins/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ enabled }),
    }),

  remove: (id: string, deleteFiles = false) =>
    request<{ success: boolean }>(`/plugins/${id}?deleteFiles=${deleteFiles}`, {
      method: 'DELETE',
    }),

  reload: () =>
    request<{ success: boolean; plugins: PluginInfo[]; count: number }>('/plugins/reload', {
      method: 'POST',
    }),
}

// Auth API
export interface AuthStatus {
  setupComplete: boolean
  authenticated: boolean
}

export const auth = {
  status: () => request<AuthStatus>('/auth/status'),

  setup: (password: string) =>
    request<{ success: boolean }>('/auth/setup', {
      method: 'POST',
      body: JSON.stringify({ password }),
    }),

  login: (password: string) =>
    request<{ success: boolean }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ password }),
    }),

  logout: () =>
    request<{ success: boolean }>('/auth/logout', {
      method: 'POST',
    }),

  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ success: boolean }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    }),
}

// Combined API export
export const api = {
  dashboards,
  dataSources,
  plugins,
  topologies,
  settings,
  health,
  auth,
}
