/**
 * API Client
 * Handles all communication with the Shumoku server API
 */

import type { NetworkGraph, ResolvedLayout } from '@shumoku/core'
import { parseWithMaps } from '@shumoku/core'
import createClient from 'openapi-fetch'
import type { components, paths } from './api.generated'
import type {
  Alert,
  AlertQueryOptions,
  CompositionMode,
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
  SourceMetricsMapping,
  SyncJob,
  SyncMode,
  SystemInfo,
  Topology,
  TopologyContext,
  TopologyDataSource,
  TopologyDataSourceInput,
  TopologyInput,
} from './types'

const BASE_URL = '/api'
const contractClient = createClient<paths>({ baseUrl: BASE_URL })
type ApiNetworkGraph = components['schemas']['NetworkGraph']

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

class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

function contractError(error: unknown, response: Response): never {
  let message = `HTTP error ${response.status}`
  if (
    typeof error === 'object' &&
    error !== null &&
    'error' in error &&
    typeof error.error === 'string'
  ) {
    message = error.error
  }
  throw new ApiError(message, response.status)
}

import type { DataSourcePluginInfo } from './types'

// Data Sources API
export const dataSources = {
  list: async (): Promise<DataSource[]> => {
    const { data, error, response } = await contractClient.GET('/datasources')
    if (!data) return contractError(error, response)
    return data
  },

  listByCapability: async (
    capability: 'topology' | 'metrics' | 'alerts',
  ): Promise<DataSource[]> => {
    const { data, error, response } = await contractClient.GET(
      '/datasources/by-capability/{capability}',
      { params: { path: { capability } } },
    )
    if (!data) return contractError(error, response)
    return data
  },

  getPluginTypes: async (): Promise<DataSourcePluginInfo[]> => {
    const { data, error, response } = await contractClient.GET('/datasources/types')
    if (!data) return contractError(error, response)
    return data
  },

  /** Dynamic candidates for an `optionsSource` schema field (connection-backed). */
  getConfigOptions: async (id: string, key: string) => {
    const { data, error, response } = await contractClient.GET(
      '/datasources/{id}/config-options/{key}',
      { params: { path: { id, key } } },
    )
    if (!data) return contractError(error, response)
    return data
  },

  /** Derived, display-only connection info (e.g. webhook URL). Generic across plugins. */
  getConnectionInfo: async (id: string, origin: string) => {
    const { data, error, response } = await contractClient.GET(
      '/datasources/{id}/connection-info',
      { params: { path: { id }, query: { origin } } },
    )
    if (!data) return contractError(error, response)
    return data
  },

  get: async (id: string): Promise<DataSource> => {
    const { data, error, response } = await contractClient.GET('/datasources/{id}', {
      params: { path: { id } },
    })
    if (!data) return contractError(error, response)
    return data
  },

  create: async (input: DataSourceInput): Promise<DataSource> => {
    const { data, error, response } = await contractClient.POST('/datasources', { body: input })
    if (!data) return contractError(error, response)
    return data
  },

  update: async (id: string, input: Partial<DataSourceInput>): Promise<DataSource> => {
    const { data, error, response } = await contractClient.PUT('/datasources/{id}', {
      params: { path: { id } },
      body: input,
    })
    if (!data) return contractError(error, response)
    return data
  },

  delete: async (id: string): Promise<{ success: boolean }> => {
    const { data, error, response } = await contractClient.DELETE('/datasources/{id}', {
      params: { path: { id } },
    })
    if (!data) return contractError(error, response)
    return data
  },

  test: async (id: string): Promise<ConnectionResult> => {
    const { data, error, response } = await contractClient.POST('/datasources/{id}/test', {
      params: { path: { id } },
    })
    if (!data) return contractError(error, response)
    return data
  },

  /** Topologies this data source is currently attached to. */
  listAttachedTopologies: async (id: string) => {
    const { data, error, response } = await contractClient.GET('/datasources/{id}/topologies', {
      params: { path: { id } },
    })
    if (!data) return contractError(error, response)
    return data
  },

  getHosts: async (id: string) => {
    const { data, error, response } = await contractClient.GET('/datasources/{id}/hosts', {
      params: { path: { id } },
    })
    if (!data) return contractError(error, response)
    return data
  },

  getHostItems: async (id: string, hostId: string) => {
    const { data, error, response } = await contractClient.GET(
      '/datasources/{id}/hosts/{hostId}/items',
      { params: { path: { id, hostId } } },
    )
    if (!data) return contractError(error, response)
    return data
  },

  getInterfaceNeighbors: async (id: string, hostId: string) => {
    const { data, error, response } = await contractClient.GET(
      '/datasources/{id}/hosts/{hostId}/neighbors',
      { params: { path: { id, hostId } } },
    )
    if (!data) return contractError(error, response)
    return data
  },

  discoverMetrics: async (id: string, hostId: string) => {
    const { data, error, response } = await contractClient.GET(
      '/datasources/{id}/hosts/{hostId}/metrics',
      { params: { path: { id, hostId } } },
    )
    if (!data) return contractError(error, response)
    return data
  },

  getAlerts: (id: string, options?: AlertQueryOptions): Promise<Alert[]> => {
    if (!shareDashboardToken) {
      return contractClient
        .GET('/datasources/{id}/alerts', {
          params: {
            path: { id },
            query: {
              timeRange: options?.timeRange,
              activeOnly:
                options?.activeOnly === undefined ? undefined : String(options.activeOnly),
              minSeverity: options?.minSeverity,
            },
          },
        })
        .then(({ data, error, response }) => data ?? contractError(error, response))
    }
    return contractClient
      .GET('/share/dashboards/{token}/datasources/{id}/alerts', {
        params: {
          path: { token: shareDashboardToken, id },
          query: {
            timeRange: options?.timeRange,
            activeOnly: options?.activeOnly === undefined ? undefined : String(options.activeOnly),
            minSeverity: options?.minSeverity,
          },
        },
      })
      .then(({ data, error, response }) => {
        if (!data) return contractError(error, response)
        return data.map((alert) => ({ ...alert, source: 'shared' }))
      })
  },

  getFilterOptions: async (id: string) => {
    const { data, error, response } = await contractClient.GET('/datasources/{id}/filter-options', {
      params: { path: { id } },
    })
    if (!data) return contractError(error, response)
    return data
  },

  /**
   * Trigger an ad-hoc autoscan. If `topologyId` is provided the snapshot
   * is persisted to `topology_observations`; otherwise it 's returned but
   * not stored (useful for "test scan" previews).
   */
  scan: async (id: string, body?: { topologyId?: string; seeds?: string[] }) => {
    const { data, error, response } = await contractClient.POST('/datasources/{id}/scan', {
      params: { path: { id } },
      body: body ?? {},
    })
    if (!data) return contractError(error, response)
    return data
  },
}

// Topologies API
export const topologies = {
  list: async (): Promise<Topology[]> => {
    const { data, error, response } = await contractClient.GET('/topologies')
    if (!data) return contractError(error, response)
    return data
  },

  get: async (id: string): Promise<Topology> => {
    if (shareDashboardToken) {
      const { data, error, response } = await contractClient.GET(
        '/share/dashboards/{token}/topologies/{id}',
        { params: { path: { token: shareDashboardToken, id } } },
      )
      if (!data) return contractError(error, response)
      return data as unknown as Topology
    }
    const { data, error, response } = await contractClient.GET('/topologies/{id}', {
      params: { path: { id } },
    })
    if (!data) return contractError(error, response)
    return data
  },

  create: async (input: TopologyInput): Promise<Topology> => {
    const { data, error, response } = await contractClient.POST('/topologies', { body: input })
    if (!data) return contractError(error, response)
    return data
  },

  update: async (id: string, input: Partial<TopologyInput>): Promise<Topology> => {
    const { data, error, response } = await contractClient.PUT('/topologies/{id}', {
      params: { path: { id } },
      body: input,
    })
    if (!data) return contractError(error, response)
    return data
  },

  delete: async (id: string): Promise<{ success: boolean }> => {
    const { data, error, response } = await contractClient.DELETE('/topologies/{id}', {
      params: { path: { id } },
    })
    if (!data) return contractError(error, response)
    return data
  },

  // The resolved mapping (metrics-binding attachments ∪ residual mapping_json).
  // Hydrate the mapping UI from this, NOT topology.mappingJson — the latter
  // misses node bindings stored as attachments.
  getMapping: async (id: string, opts?: { sourceId?: string }) => {
    const { data, error, response } = await contractClient.GET('/topologies/{id}/mapping', {
      params: { path: { id }, query: { sourceId: opts?.sourceId } },
    })
    if (!data) return contractError(error, response)
    return data
  },

  getSourceMappings: async (id: string): Promise<SourceMetricsMapping[]> => {
    const { data, error, response } = await contractClient.GET('/topologies/{id}/mapping/sources', {
      params: { path: { id } },
    })
    if (!data) return contractError(error, response)
    return data
  },

  // Orphaned mapping rows (Phase 4): entities no longer present in the current
  // resolved graph (a mapping pointing at a retired / disappeared element).
  getOrphans: async (id: string) => {
    const { data, error, response } = await contractClient.GET('/topologies/{id}/mapping/orphans', {
      params: { path: { id } },
    })
    if (!data) return contractError(error, response)
    return {
      orphans: data.orphans.map((orphan) => ({ ...orphan, payload: orphan.payload })),
    }
  },

  // Reassign an orphaned mapping to a live entity.
  reassignOrphan: async (id: string, entityId: string, toEntityId: string) => {
    const { data, error, response } = await contractClient.POST(
      '/topologies/{id}/mapping/orphans/{entityId}/reassign',
      { params: { path: { id, entityId } }, body: { toEntityId } },
    )
    if (!data) return contractError(error, response)
    return data
  },

  // Discard an orphaned mapping row.
  discardOrphan: async (id: string, entityId: string) => {
    const { data, error, response } = await contractClient.DELETE(
      '/topologies/{id}/mapping/orphans/{entityId}',
      { params: { path: { id, entityId } } },
    )
    if (!data) return contractError(error, response)
    return data
  },

  // Full registry reset: discard all stable entity ids and mapping rows.
  // DESTRUCTIVE — guard with a confirm dialog before calling.
  resetRegistry: async (id: string) => {
    const { data, error, response } = await contractClient.POST('/topologies/{id}/registry/reset', {
      params: { path: { id } },
    })
    if (!data) return contractError(error, response)
    return data
  },

  // Response is the topology PLUS `skipped`: node/link bindings the server could
  // not persist because the source didn't provide identity to anchor them.
  // Wave B-3 (#569): pass `sourceId` to write under a specific metrics source.
  // GET /mapping stays priority-merged by default; sourceId selects the
  // lossless per-source view used by auto-map and polling edits.
  updateMapping: async (id: string, mapping: MetricsMapping, opts?: { sourceId?: string }) => {
    const { data, error, response } = await contractClient.PUT('/topologies/{id}/mapping', {
      params: { path: { id } },
      body: { mapping, sourceId: opts?.sourceId },
    })
    if (!data) return contractError(error, response)
    return data
  },

  updateNodeMapping: async (
    topologyId: string,
    nodeId: string,
    mapping: { hostId?: string; hostName?: string },
    opts?: { sourceId?: string },
  ): Promise<{
    success: boolean
    topology: Topology
    nodeMapping: { hostId?: string; hostName?: string } | null
  }> => {
    const body = {
      ...mapping,
      ...(opts?.sourceId ? { sourceId: opts.sourceId } : {}),
    }
    const { data, error, response } = await contractClient.PATCH(
      '/topologies/{id}/mapping/nodes/{nodeId}',
      { params: { path: { id: topologyId, nodeId } }, body },
    )
    if (!data) return contractError(error, response)
    return data
  },

  updateLinkMapping: async (
    topologyId: string,
    linkId: string,
    mapping: { monitoredNodeId?: string; interface?: string; bandwidth?: number } | null,
    opts?: { sourceId?: string },
  ): Promise<{
    success: boolean
    topology: Topology
    linkMapping: { monitoredNodeId?: string; interface?: string; bandwidth?: number } | null
  }> => {
    const body = {
      ...(mapping ?? {}),
      ...(opts?.sourceId ? { sourceId: opts.sourceId } : {}),
    }
    const { data, error, response } = await contractClient.PATCH(
      '/topologies/{id}/mapping/links/{linkId}',
      { params: { path: { id: topologyId, linkId } }, body },
    )
    if (!data) return contractError(error, response)
    return data
  },

  clearNodeMappings: async (id: string, opts?: { sourceId?: string }) => {
    const { data, error, response } = await contractClient.DELETE(
      '/topologies/{id}/mapping/nodes',
      { params: { path: { id }, query: { sourceId: opts?.sourceId } } },
    )
    if (!data) return contractError(error, response)
    return data
  },

  clearLinkMappings: async (id: string, opts?: { sourceId?: string }) => {
    const { data, error, response } = await contractClient.DELETE(
      '/topologies/{id}/mapping/links',
      { params: { path: { id }, query: { sourceId: opts?.sourceId } } },
    )
    if (!data) return contractError(error, response)
    return data
  },

  // Wave B-3 (#569): pass `sourceId` to auto-map under a specific metrics source.
  autoMapLinks: async (id: string, body?: { overwrite?: boolean; sourceId?: string }) => {
    const { data, error, response } = await contractClient.POST(
      '/topologies/{id}/mapping/auto-map-links',
      { params: { path: { id } }, body: body ?? {} },
    )
    if (!data) return contractError(error, response)
    return data
  },

  getRender: async (
    id: string,
  ): Promise<{ nodeCount: number; edgeCount: number } | { deriving: true }> => {
    const { data, error, response } = await contractClient.GET('/topologies/{id}/render', {
      params: { path: { id } },
    })
    if (!data) return contractError(error, response)
    return data
  },

  getGraph: async (
    id: string,
  ): Promise<{
    id?: string
    name?: string
    graph?: NetworkGraph
    /** Last-good diagram served while a background bake runs. */
    stale?: boolean
    /** 202 — first bake still running, nothing to serve yet. */
    deriving?: boolean
  }> => {
    if (shareDashboardToken) {
      const { data, error, response } = await contractClient.GET(
        '/share/dashboards/{token}/topologies/{id}/graph',
        { params: { path: { token: shareDashboardToken, id } } },
      )
      if (!data) return contractError(error, response)
      return data as unknown as {
        id?: string
        name?: string
        graph?: NetworkGraph
        stale?: boolean
      }
    }
    const { data, error, response } = await contractClient.GET('/topologies/{id}/graph', {
      params: { path: { id } },
    })
    if (!data) return contractError(error, response)
    return data as { id?: string; name?: string; graph?: NetworkGraph; stale?: boolean }
  },

  /**
   * Graph + the SERVER-BAKED ResolvedLayout in one consistent snapshot.
   * The interactive viewer uses this so it never recomputes a large layout
   * on the browser main thread. Maps arrive tagged — parsed here.
   */
  getView: async (
    id: string,
  ): Promise<{
    id?: string
    name?: string
    graph?: NetworkGraph
    resolved?: ResolvedLayout
    stale?: boolean
    deriving?: boolean
  }> => {
    const path = scoped(`/topologies/${id}/view`, `/topologies/${id}/view`)
    const response = await fetch(`${BASE_URL}${path}`)
    if (response.status === 202) return { deriving: true }
    if (!response.ok) {
      let message = `HTTP error ${response.status}`
      try {
        const data = (await response.json()) as { error?: string }
        if (data.error) message = data.error
      } catch {
        // Ignore JSON parsing error
      }
      throw new ApiError(message, response.status)
    }
    return parseWithMaps(await response.text())
  },

  /** Resolved graph = project overlay folded with each attached source's contribution. */
  getResolved: async (id: string) => {
    const { data, error, response } = await contractClient.GET('/topologies/{id}/resolved', {
      params: { path: { id } },
    })
    if (!data) return contractError(error, response)
    return data as unknown as { graph: NetworkGraph; snapshotCount: number }
  },

  /** Recent observation snapshots for this topology (counters only). */
  listObservations: async (id: string, limit?: number) => {
    const { data, error, response } = await contractClient.GET('/topologies/{id}/observations', {
      params: { path: { id }, query: { limit } },
    })
    if (!data) return contractError(error, response)
    return data
  },

  getObservation: async (id: string, obsId: string) => {
    const { data, error, response } = await contractClient.GET(
      '/topologies/{id}/observations/{obsId}',
      { params: { path: { id, obsId } } },
    )
    if (!data) return contractError(error, response)
    return data as typeof data & { graph: NetworkGraph | null }
  },

  getContext: async (id: string, _theme?: 'light' | 'dark'): Promise<TopologyContext> => {
    if (shareDashboardToken) {
      const { data, error, response } = await contractClient.GET(
        '/share/dashboards/{token}/topologies/{id}/context',
        { params: { path: { token: shareDashboardToken, id } } },
      )
      if (!data) return contractError(error, response)
      return data as unknown as TopologyContext
    }
    const { data, error, response } = await contractClient.GET('/topologies/{id}/context', {
      params: { path: { id } },
    })
    if (!data) return contractError(error, response)
    return data as unknown as TopologyContext
  },

  // Sharing
  share: async (id: string) => {
    const { data, error, response } = await contractClient.POST('/topologies/{id}/share', {
      params: { path: { id } },
    })
    if (!data) return contractError(error, response)
    return data
  },

  unshare: async (id: string) => {
    const { data, error, response } = await contractClient.DELETE('/topologies/{id}/share', {
      params: { path: { id } },
    })
    if (!data) return contractError(error, response)
    return data
  },

  // Topology-level scope (composition). Single per-topology decision: `scope` is
  // the common include/exclude criteria the resolver enforces post-merge.
  composition: {
    get: async (
      id: string,
    ): Promise<{
      scopeMode: ScopeMode
      scopeSourceId?: string
      scope: ScopeFilter
      compositionMode: CompositionMode
    }> => {
      const { data, error, response } = await contractClient.GET('/topologies/{id}/composition', {
        params: { path: { id } },
      })
      if (!data) return contractError(error, response)
      return data
    },

    set: async (
      id: string,
      body: {
        scopeMode?: ScopeMode
        scopeSourceId?: string | null
        scope?: ScopeFilter
        compositionMode?: CompositionMode
      },
    ): Promise<{
      scopeMode: ScopeMode
      scopeSourceId?: string
      scope: ScopeFilter
      compositionMode: CompositionMode
    }> => {
      const { data, error, response } = await contractClient.PUT('/topologies/{id}/composition', {
        params: { path: { id } },
        body,
      })
      if (!data) return contractError(error, response)
      return data
    },
  },

  // Topology Data Sources (many-to-many)
  sources: {
    list: async (topologyId: string): Promise<TopologyDataSource[]> => {
      const { data, error, response } = await contractClient.GET(
        '/topologies/{topologyId}/sources',
        { params: { path: { topologyId } } },
      )
      if (!data) return contractError(error, response)
      return data
    },

    add: async (
      topologyId: string,
      input: TopologyDataSourceInput,
    ): Promise<TopologyDataSource | { dataSourceId: string }> => {
      const { data, error, response } = await contractClient.POST(
        '/topologies/{topologyId}/sources',
        { params: { path: { topologyId } }, body: input },
      )
      if (!data) return contractError(error, response)
      return data
    },

    update: async (
      topologyId: string,
      sourceId: string,
      updates: {
        syncMode?: SyncMode
        priority?: number
        optionsJson?: string
        nodeContribution?: NodeContribution
        linkContribution?: LinkContribution
      },
    ): Promise<TopologyDataSource> => {
      const { data, error, response } = await contractClient.PUT(
        '/topologies/{topologyId}/sources/{sourceId}',
        { params: { path: { topologyId, sourceId } }, body: updates },
      )
      if (!data) return contractError(error, response)
      return data
    },

    remove: async (topologyId: string, sourceId: string) => {
      const { data, error, response } = await contractClient.DELETE(
        '/topologies/{topologyId}/sources/{sourceId}',
        { params: { path: { topologyId, sourceId } } },
      )
      if (!data) return contractError(error, response)
      return data
    },

    replaceAll: async (topologyId: string, sources: TopologyDataSourceInput[]) => {
      const { data, error, response } = await contractClient.PUT(
        '/topologies/{topologyId}/sources',
        { params: { path: { topologyId } }, body: { sources } },
      )
      if (!data) return contractError(error, response)
      return data
    },

    /** Start a tracked Sync-all job (202). 409 = one is already running — attach via getSyncJob. */
    syncAll: async (id: string): Promise<{ job: SyncJob }> => {
      const { data, error, response } = await contractClient.POST(
        '/topologies/{id}/sync-from-source',
        { params: { path: { id } } },
      )
      if (!data) return contractError(error, response)
      return data
    },

    /**
     * Rebuild = blank then re-sync: delete all observed source data + the cached
     * layout, then run a Sync-all so the diagram is re-derived from scratch.
     * Same tracked job + progress modal as syncAll (202; 409 = one running).
     */
    rebuild: async (id: string): Promise<{ job: SyncJob }> => {
      const { data, error, response } = await contractClient.POST('/topologies/{id}/rebuild', {
        params: { path: { id } },
      })
      if (!data) return contractError(error, response)
      return data
    },

    /** Current (or last finished) sync job — drives the progress modal + reload re-attach. */
    getSyncJob: async (id: string): Promise<{ job: SyncJob | null }> => {
      const { data, error, response } = await contractClient.GET('/topologies/{id}/sync-job', {
        params: { path: { id } },
      })
      if (!data) return contractError(error, response)
      return data
    },

    /** Cancel the in-flight sync job (fetches discarded, layout Worker terminated). */
    cancelSync: async (id: string): Promise<{ job: SyncJob | null }> => {
      const { data, error, response } = await contractClient.POST(
        '/topologies/{id}/sync-job/cancel',
        { params: { path: { id } } },
      )
      if (!data) return contractError(error, response)
      return data
    },

    /**
     * Sync exactly one attached topology source. Dispatches by
     * capability server-side (autoscan → scan, otherwise fetchTopology)
     * and records the result as an observation snapshot.
     */
    syncOne: async (topologyId: string, sourceId: string) => {
      const { data, error, response } = await contractClient.POST(
        '/topologies/{topologyId}/sources/{sourceId}/sync',
        { params: { path: { topologyId, sourceId } } },
      )
      if (!data) return contractError(error, response)
      return data as unknown as typeof data & { snapshot: { graph: NetworkGraph | null } }
    },

    /** Clear a source's contribution (delete its observations); attachment stays. */
    clear: async (topologyId: string, sourceId: string) => {
      const { data, error, response } = await contractClient.POST(
        '/topologies/{topologyId}/sources/{sourceId}/clear',
        { params: { path: { topologyId, sourceId } } },
      )
      if (!data) return contractError(error, response)
      return data
    },

    /**
     * Targeted probe of an attached source. Semantically distinct
     * from `syncOne` — probe re-checks the named seeds only, not the
     * source 's whole configured scope. Used by the Discovery tab 's
     * per-node card to re-poke a single device.
     */
    probe: async (topologyId: string, sourceId: string, seeds: string[]) => {
      const { data, error, response } = await contractClient.POST(
        '/topologies/{topologyId}/sources/{sourceId}/probe',
        { params: { path: { topologyId, sourceId } }, body: { seeds } },
      )
      if (!data) return contractError(error, response)
      return data
    },

    /**
     * Latest observation graph for a specific source attached to this
     * topology. `graph` is null when the source has no observation yet
     * (e.g. a freshly-attached source). This is what the Manual editor
     * loads — explicitly the *source 's* snapshot, not the resolved
     * project graph.
     */
    latestSnapshot: async (topologyId: string, sourceId: string) => {
      const { data, error, response } = await contractClient.GET(
        '/topologies/{topologyId}/sources/{sourceId}/latest-snapshot',
        { params: { path: { topologyId, sourceId } } },
      )
      if (!data) return contractError(error, response)
      return data as unknown as typeof data & { graph: NetworkGraph | null }
    },

    /**
     * Record a new observation against a specific source. Manual
     * editor save goes through this; any caller pushing a snapshot
     * (e.g. webhook receivers) can use it too.
     */
    recordObservation: async (
      topologyId: string,
      sourceId: string,
      graph: NetworkGraph,
      status?: 'ok' | 'partial' | 'failed' | 'empty',
    ): Promise<{ observation: { id: string } }> => {
      const { data, error, response } = await contractClient.POST(
        '/topologies/{topologyId}/sources/{sourceId}/observation',
        {
          params: { path: { topologyId, sourceId } },
          body: { graph: graph as unknown as ApiNetworkGraph, status: status ?? 'ok' },
        },
      )
      if (!data) return contractError(error, response)
      return data
    },

    /** Create-and-attach a new Manual source to a topology (no cardinality limit). */
    attachManual: async (topologyId: string): Promise<{ dataSourceId: string }> => {
      const { data, error, response } = await contractClient.POST(
        '/topologies/{topologyId}/sources',
        {
          params: { path: { topologyId } },
          body: { type: 'manual', purpose: 'topology' },
        },
      )
      if (!data) return contractError(error, response)
      if (!('dataSourceId' in data)) throw new ApiError('Invalid Manual source response', 500)
      return { dataSourceId: data.dataSourceId }
    },
  },

  /**
   * Topology display settings (edge style / spline mode). Project-level
   * presentation prefs stored on the project overlay — NOT a Manual source.
   */
  displaySettings: {
    get: async (id: string) => {
      const { data, error, response } = await contractClient.GET(
        '/topologies/{id}/display-settings',
        { params: { path: { id } } },
      )
      if (!data) return contractError(error, response)
      return data
    },
    set: async (
      id: string,
      body: { edgeStyle?: string; splineMode?: string; hideDisconnected?: boolean },
    ) => {
      const { data, error, response } = await contractClient.PUT(
        '/topologies/{id}/display-settings',
        {
          params: { path: { id } },
          body: body as components['schemas']['UpdateTopologyDisplaySettings'],
        },
      )
      if (!data) return contractError(error, response)
      return data
    },
  },

  /**
   * Discovery policy — per-node Discovery settings (SNMP access + scheduler
   * mode/interval), stored in the server's `discovery_config` table (one row
   * per node entity, no inheritance). `nodes` is the effective policy per
   * node; `configs` is the raw per-node config, attachment-shaped for the
   * edit panel (absent = no row). Scope 'topology' bulk-applies to every
   * node. See `apps/server/api/src/modules/discovery-policy/routes.ts`.
   */
  discoveryPolicy: {
    get: async (
      id: string,
    ): Promise<{
      topologyDefault: Attachment[] | null
      runtimeDefault: { mode: DiscoveryMode; intervalMs: number }
      nodes: Record<string, EffectivePolicy>
      configs: Record<string, Attachment[]>
      subgraphs: Record<string, EffectivePolicy>
    }> => {
      const { data, error, response } = await contractClient.GET(
        '/topologies/{id}/discovery-policy',
        { params: { path: { id } } },
      )
      if (!data) return contractError(error, response)
      return data as unknown as {
        topologyDefault: Attachment[] | null
        runtimeDefault: { mode: DiscoveryMode; intervalMs: number }
        nodes: Record<string, EffectivePolicy>
        configs: Record<string, Attachment[]>
        subgraphs: Record<string, EffectivePolicy>
      }
    },

    /**
     * Replace a node's Discovery config (`attachments`; `null`/`[]` clears),
     * set a node's name override (`label`; `null`/'' reverts to the observed
     * name), and/or set `suppressedAttachments`. Each field is applied only
     * when present. Scope 'topology' bulk-applies the config to all nodes.
     */
    patch: async (
      id: string,
      body:
        | { scope: 'topology'; attachments: Attachment[] | null }
        | {
            scope: 'node'
            id: string
            attachments?: Attachment[] | null
            label?: string | null
            suppressedAttachments?: string[] | null
          },
    ): Promise<{ effective: EffectivePolicy }> => {
      const { data, error, response } = await contractClient.PATCH(
        '/topologies/{id}/discovery-policy',
        {
          params: { path: { id } },
          body: body as unknown as NonNullable<
            paths['/topologies/{id}/discovery-policy']['patch']['requestBody']
          >['content']['application/json'],
        },
      )
      if (!data) return contractError(error, response)
      return data
    },

    /** Hide a node (identity-keyed exclusion). resolve() drops matching clusters. */
    hide: async (id: string, identity: NodeExclusion) => {
      const { data, error, response } = await contractClient.POST(
        '/topologies/{id}/discovery-policy/exclusions',
        { params: { path: { id } }, body: identity },
      )
      if (!data) return contractError(error, response)
      return data
    },

    /** Unhide a previously hidden node. */
    unhide: async (id: string, identity: NodeExclusion) => {
      const { data, error, response } = await contractClient.DELETE(
        '/topologies/{id}/discovery-policy/exclusions',
        { params: { path: { id } }, body: identity },
      )
      if (!data) return contractError(error, response)
      return data
    },
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
  get: async () => {
    const { data, error, response } = await contractClient.GET('/settings')
    if (!data) return contractError(error, response)
    return data
  },

  update: async (settings: Record<string, string>) => {
    const { data, error, response } = await contractClient.PUT('/settings', { body: settings })
    if (!data) return contractError(error, response)
    return data
  },

  getValue: async (key: string) => {
    const { data, error, response } = await contractClient.GET('/settings/{key}', {
      params: { path: { key } },
    })
    if (!data) return contractError(error, response)
    return data
  },

  setValue: async (key: string, value: string) => {
    const { data, error, response } = await contractClient.PUT('/settings/{key}', {
      params: { path: { key } },
      body: { value },
    })
    if (!data) return contractError(error, response)
    return data
  },
}

// Dashboards API
export const dashboards = {
  list: async (): Promise<Dashboard[]> => {
    const { data, error, response } = await contractClient.GET('/dashboards')
    if (!data) return contractError(error, response)
    return data
  },

  get: async (id: string): Promise<Dashboard> => {
    const { data, error, response } = await contractClient.GET('/dashboards/{id}', {
      params: { path: { id } },
    })
    if (!data) return contractError(error, response)
    return data
  },

  create: async (input: DashboardInput): Promise<Dashboard> => {
    const { data, error, response } = await contractClient.POST('/dashboards', { body: input })
    if (!data) return contractError(error, response)
    return data
  },

  update: async (id: string, input: Partial<DashboardInput>): Promise<Dashboard> => {
    const { data, error, response } = await contractClient.PUT('/dashboards/{id}', {
      params: { path: { id } },
      body: input,
    })
    if (!data) return contractError(error, response)
    return data
  },

  delete: async (id: string) => {
    const { data, error, response } = await contractClient.DELETE('/dashboards/{id}', {
      params: { path: { id } },
    })
    if (!data) return contractError(error, response)
    return data
  },

  share: async (id: string) => {
    const { data, error, response } = await contractClient.POST('/dashboards/{id}/share', {
      params: { path: { id } },
    })
    if (!data) return contractError(error, response)
    return data
  },

  unshare: async (id: string) => {
    const { data, error, response } = await contractClient.DELETE('/dashboards/{id}/share', {
      params: { path: { id } },
    })
    if (!data) return contractError(error, response)
    return data
  },
}

// Health check
export const health = {
  check: async () => {
    const { data, error, response } = await contractClient.GET('/health')
    if (!data) return contractError(error, response)
    return data
  },
}

export const system = {
  get: async (refresh = false): Promise<SystemInfo> => {
    const { data, error, response } = await contractClient.GET('/system', {
      params: { query: { refresh: refresh ? 'true' : 'false' } },
    })
    if (!data) return contractError(error, response)
    return data
  },
}

// Plugin types for UI
export type PluginInfo = components['schemas']['PluginInfo']

// Plugins API
export const plugins = {
  list: async () => {
    const { data, error, response } = await contractClient.GET('/plugins')
    if (!data) return contractError(error, response)
    return data
  },

  getManifest: async (id: string) => {
    const { data, error, response } = await contractClient.GET('/plugins/{id}/manifest', {
      params: { path: { id } },
    })
    if (!data) return contractError(error, response)
    return data
  },

  addByPath: async (path: string) => {
    const { data, error, response } = await contractClient.POST('/plugins', { body: { path } })
    if (!data) return contractError(error, response)
    return data
  },

  addByUrl: async (url: string, subdirectory?: string) => {
    const { data, error, response } = await contractClient.POST('/plugins', {
      body: { url, subdirectory },
    })
    if (!data) return contractError(error, response)
    return data
  },

  uploadZip: async (file: File, subdirectory?: string): Promise<PluginInfo> => {
    const formData = new FormData()
    formData.append('file', file)
    if (subdirectory) {
      formData.append('subdirectory', subdirectory)
    }

    const response = await fetch(`${BASE_URL}/plugins/upload`, {
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

  setEnabled: async (id: string, enabled: boolean) => {
    const { data, error, response } = await contractClient.PATCH('/plugins/{id}', {
      params: { path: { id } },
      body: { enabled },
    })
    if (!data) return contractError(error, response)
    return data
  },

  remove: async (id: string, deleteFiles = false) => {
    const { data, error, response } = await contractClient.DELETE('/plugins/{id}', {
      params: { path: { id }, query: { deleteFiles: String(deleteFiles) } },
    })
    if (!data) return contractError(error, response)
    return data
  },

  reload: async () => {
    const { data, error, response } = await contractClient.POST('/plugins/reload')
    if (!data) return contractError(error, response)
    return data
  },
}

export const auth = {
  status: async () => {
    const { data, error, response } = await contractClient.GET('/auth/status')
    if (!data) return contractError(error, response)
    return data
  },

  setup: async (password: string) => {
    const { data, error, response } = await contractClient.POST('/auth/setup', {
      body: { password },
    })
    if (!data) return contractError(error, response)
    return data
  },

  login: async (password: string) => {
    const { data, error, response } = await contractClient.POST('/auth/login', {
      body: { password },
    })
    if (!data) return contractError(error, response)
    return data
  },

  logout: async () => {
    const { data, error, response } = await contractClient.POST('/auth/logout')
    if (!data) return contractError(error, response)
    return data
  },

  changePassword: async (currentPassword: string, newPassword: string) => {
    const { data, error, response } = await contractClient.POST('/auth/change-password', {
      body: { currentPassword, newPassword },
    })
    if (!data) return contractError(error, response)
    return data
  },
}

export const shared = {
  getDashboard: async (token: string) => {
    const { data, error, response } = await contractClient.GET('/share/dashboards/{token}', {
      params: { path: { token } },
    })
    if (!data) return contractError(error, response)
    return data
  },

  getTopology: async (token: string) => {
    const { data, error, response } = await contractClient.GET('/share/topologies/{token}', {
      params: { path: { token } },
    })
    if (!data) return contractError(error, response)
    return data
  },
}

// Combined API export
export const api = {
  dashboards,
  dataSources,
  plugins,
  topologies,
  settings,
  health,
  system,
  auth,
  shared,
}
