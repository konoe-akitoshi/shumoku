/**
 * How a dashboard's widgets read: from the workspace when signed in, or through a shared
 * dashboard's token. The dashboard gives its widgets a reader (`DashboardGrid` puts it in the
 * dashboard context), and a widget never learns which it has beyond `shared` (which hides what
 * only an editor can use), so no widget branches on where it is shown.
 */

import { api, sharedDashboardStreamUrl } from '$lib/api'
import type { LiveSource } from '$lib/stores/live.svelte'
import type { Alert, AlertQueryOptions, Topology, TopologyContext } from '$lib/types'

export type DashboardScope = { kind: 'workspace' } | { kind: 'shared'; token: string }

/** A topology's monitored hosts: host name → the node ids it is bound to. */
export type HostNodes = ReadonlyMap<string, readonly string[]>

export interface DashboardReader {
  /** Read through a shared dashboard's token: no editing, no lists of what else exists. */
  readonly shared: boolean
  topology(id: string): Promise<Topology>
  view(id: string): ReturnType<typeof api.topologies.getView>
  context(id: string): Promise<TopologyContext>
  /** Which node each monitored host is drawn as, from the topology's resolved mapping. */
  hostNodes(id: string): Promise<HostNodes>
  alerts(dataSourceId: string, options?: AlertQueryOptions): Promise<Alert[]>
  liveSource(topologyId: string): LiveSource
}

/** host → node ids, from a resolved mapping's `nodes` (node id → `{ hostName }`). */
export function hostNodesOf(
  nodes: Record<string, { hostName?: string } | undefined> | null | undefined,
): HostNodes {
  const out = new Map<string, string[]>()
  for (const [nodeId, info] of Object.entries(nodes ?? {})) {
    const host = info?.hostName
    if (!host) continue
    const ids = out.get(host)
    if (ids) ids.push(nodeId)
    else out.set(host, [nodeId])
  }
  return out
}

function parseMappingNodes(mappingJson: string | undefined) {
  if (!mappingJson) return null
  try {
    return (JSON.parse(mappingJson) as { nodes?: Record<string, { hostName?: string }> }).nodes
  } catch {
    return null
  }
}

export function readerFor(scope: DashboardScope): DashboardReader {
  if (scope.kind === 'workspace') {
    return {
      shared: false,
      topology: (id) => api.topologies.get(id),
      view: (id) => api.topologies.getView(id),
      context: (id) => api.topologies.getContext(id),
      // The resolved mapping: metrics-binding attachments as well as the stored mapping.
      hostNodes: async (id) => hostNodesOf((await api.topologies.getMapping(id)).nodes),
      alerts: (id, options) => api.dataSources.getAlerts(id, options),
      liveSource: (topologyId) => ({ kind: 'ws', topologyId }),
    }
  }
  const { token } = scope
  return {
    shared: true,
    topology: (id) => api.shared.dashboard.topology(token, id),
    view: (id) => api.shared.dashboard.view(token, id),
    context: (id) => api.shared.dashboard.context(token, id),
    // A shared topology already carries the resolved mapping (the server's public projection).
    hostNodes: async (id) =>
      hostNodesOf(parseMappingNodes((await api.shared.dashboard.topology(token, id)).mappingJson)),
    alerts: (id, options) => api.shared.dashboard.alerts(token, id, options),
    liveSource: (topologyId) => ({ kind: 'sse', url: sharedDashboardStreamUrl(token, topologyId) }),
  }
}
