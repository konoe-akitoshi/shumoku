/**
 * API Client
 * Handles all communication with the Shumoku server API
 */

import type {
  Dashboard,
  DashboardInput,
  DataSource,
  DataSourceInput,
  Topology,
  TopologyInput,
  TopologyContext,
  MetricsMapping,
  ConnectionTestResult,
  TopologyDataSource,
  TopologyDataSourceInput,
  SyncMode,
  Alert,
  AlertQueryOptions,
} from './types'

const BASE_URL = '/api'

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
  Host,
  HostItem,
  DiscoveredMetric,
} from './types'

// Data Sources API
export const dataSources = {
  list: () => request<DataSource[]>('/datasources'),

  listByCapability: (capability: DataSourceCapability) =>
    request<DataSource[]>(`/datasources/by-capability/${capability}`),

  getPluginTypes: () => request<DataSourcePluginInfo[]>('/datasources/types'),

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
    request<ConnectionTestResult>(`/datasources/${id}/test`, {
      method: 'POST',
    }),

  getHosts: (id: string) => request<Host[]>(`/datasources/${id}/hosts`),

  getHostItems: (id: string, hostId: string) =>
    request<HostItem[]>(`/datasources/${id}/hosts/${hostId}/items`),

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
    const url = `/datasources/${id}/alerts${queryString ? `?${queryString}` : ''}`
    return request<Alert[]>(url)
  },

  getWebhookUrl: (id: string) =>
    request<{ webhookPath: string }>(`/datasources/${id}/webhook-url`),

  getFilterOptions: (id: string) =>
    request<{ sites: { slug: string; name: string }[]; tags: { slug: string; name: string }[] }>(
      `/datasources/${id}/filter-options`,
    ),
}

// Topologies API
export const topologies = {
  list: () => request<Topology[]>('/topologies'),

  get: (id: string) => request<Topology>(`/topologies/${id}`),

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

  getContext: (id: string, theme?: 'light' | 'dark') => {
    const params = theme ? `?theme=${theme}` : ''
    return request<TopologyContext>(`/topologies/${id}/context${params}`)
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
      updates: { syncMode?: SyncMode; priority?: number },
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
  },
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
    properties: Record<string, {
      type: string
      title?: string
      description?: string
      format?: string
      default?: unknown
    }>
  }
  enabled: boolean
  builtin: boolean
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
      } catch { /* ignore */ }
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
