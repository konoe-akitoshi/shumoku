/**
 * How a dashboard's widgets read: from the workspace when signed in, or through a shared
 * dashboard's token. A dashboard page gives its widgets a reader in their context (`mount`'s
 * `context`, `readerContext`), and a widget asks for it with `useDashboardReader`. A widget never
 * learns which it has beyond `shared` (which hides what only an editor can use), so no widget
 * branches on where it is shown.
 */

import { getContext } from 'svelte'
import { api, sharedDashboardStreamUrl } from '$lib/api'
import type { LiveSource } from '$lib/stores/live.svelte'
import type { Alert, AlertQueryOptions, Topology, TopologyContext } from '$lib/types'

export type DashboardScope = { kind: 'workspace' } | { kind: 'shared'; token: string }

export interface DashboardReader {
  /** Read through a shared dashboard's token: no editing, no lists of what else exists. */
  readonly shared: boolean
  topology(id: string): Promise<Topology>
  view(id: string): ReturnType<typeof api.topologies.getView>
  context(id: string): Promise<TopologyContext>
  alerts(dataSourceId: string, options?: AlertQueryOptions): Promise<Alert[]>
  liveSource(topologyId: string): LiveSource
}

export function readerFor(scope: DashboardScope): DashboardReader {
  if (scope.kind === 'workspace') {
    return {
      shared: false,
      topology: (id) => api.topologies.get(id),
      view: (id) => api.topologies.getView(id),
      context: (id) => api.topologies.getContext(id),
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
    alerts: (id, options) => api.shared.dashboard.alerts(token, id, options),
    liveSource: (topologyId) => ({ kind: 'sse', url: sharedDashboardStreamUrl(token, topologyId) }),
  }
}

const READER = Symbol('dashboard-reader')

/** The context a dashboard mounts its widgets with. */
export function readerContext(scope: DashboardScope): Map<symbol, DashboardReader> {
  return new Map([[READER, readerFor(scope)]])
}

/** This widget's reader; the workspace's when its dashboard gave none. */
export function useDashboardReader(): DashboardReader {
  return getContext<DashboardReader | undefined>(READER) ?? readerFor({ kind: 'workspace' })
}
