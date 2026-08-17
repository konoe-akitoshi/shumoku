import { stringifyWithMaps } from '@shumoku/core'
import {
  publicAlert,
  publicDashboardLayout,
  publicTopology,
  publicTopologyContext,
  publicTopologyGraph,
} from '../modules/share/projections.js'
import type { DashboardService } from '../services/dashboard.js'
import type { DataSourceService } from '../services/datasource.js'
import { getLatestMetrics, liveSubscriberCount, subscribeMetrics } from '../services/metrics-hub.js'
import type { TopologyService } from '../services/topology.js'
import type { ShareApplicationService, ShareReadResult } from './services.js'
import { buildRenderOutput } from './topology-queries.js'

interface ReachableSet {
  topologyIds: Set<string>
  dataSourceIds: Set<string>
}

function referencedIds(layoutJson: string): ReachableSet {
  const topologyIds = new Set<string>()
  const dataSourceIds = new Set<string>()
  try {
    const layout = JSON.parse(layoutJson) as { widgets?: { config?: Record<string, unknown> }[] }
    for (const widget of layout.widgets ?? []) {
      const topologyId = widget.config?.['topologyId']
      if (typeof topologyId === 'string') topologyIds.add(topologyId)
      const dataSourceId = widget.config?.['dataSourceId']
      if (typeof dataSourceId === 'string') dataSourceIds.add(dataSourceId)
    }
  } catch {
    // A malformed layout grants access to nothing.
  }
  return { topologyIds, dataSourceIds }
}

function failure(status: 400 | 404 | 422 | 500, error: string): ShareReadResult<never> {
  return { ok: false, status, error }
}

async function parsedOrError(topologies: TopologyService, id: string) {
  const parsed = await topologies.getParsed(id)
  if (parsed) return { ok: true as const, parsed }
  if (topologies.getParseError(id)) {
    return { ok: false as const, result: failure(422, 'Topology is currently unavailable') }
  }
  return { ok: false as const, result: failure(500, 'Failed to parse topology') }
}

export function createShareApplicationService(dependencies: {
  topologies: TopologyService
  dashboards: DashboardService
  dataSources: DataSourceService
}): ShareApplicationService {
  const { topologies, dashboards, dataSources } = dependencies
  const dashboardGrant = (token: string): ReachableSet | null => {
    const dashboard = dashboards.getByShareToken(token)
    return dashboard ? referencedIds(dashboard.layoutJson) : null
  }
  return {
    async topology(token, resource) {
      const topology = topologies.getByShareToken(token)
      if (!topology) return failure(404, 'Not found')
      try {
        const resolved = await parsedOrError(topologies, topology.id)
        if (!resolved.ok) return resolved.result
        if (resource === 'context') {
          return { ok: true, value: publicTopologyContext(resolved.parsed) }
        }
        if (resource === 'graph') return { ok: true, value: publicTopologyGraph(resolved.parsed) }
        if (resource === 'render') {
          return { ok: true, value: await buildRenderOutput(resolved.parsed) }
        }
        return {
          ok: true,
          value: JSON.parse(
            stringifyWithMaps({
              ...publicTopologyGraph(resolved.parsed),
              resolved: resolved.parsed.resolved,
              stale: resolved.parsed.stale ?? false,
            }),
          ),
        }
      } catch (error) {
        return failure(500, error instanceof Error ? error.message : String(error))
      }
    },
    dashboard(token) {
      const dashboard = dashboards.getByShareToken(token)
      return dashboard
        ? {
            ok: true,
            value: {
              id: dashboard.id,
              name: dashboard.name,
              layoutJson: publicDashboardLayout(dashboard.layoutJson),
            },
          }
        : failure(404, 'Not found')
    },
    async dashboardTopology(token, id, resource) {
      const grant = dashboardGrant(token)
      if (!grant?.topologyIds.has(id)) return failure(404, 'Not found')
      const topology = topologies.get(id)
      if (!topology) return failure(404, 'Not found')
      try {
        const resolved = await parsedOrError(topologies, id)
        if (!resolved.ok) return resolved.result
        if (resource === 'metadata') {
          return { ok: true, value: publicTopology(topology, resolved.parsed.mapping) }
        }
        return {
          ok: true,
          value:
            resource === 'graph'
              ? publicTopologyGraph(resolved.parsed)
              : publicTopologyContext(resolved.parsed),
        }
      } catch (error) {
        return failure(500, error instanceof Error ? error.message : String(error))
      }
    },
    async dashboardAlerts(token, id, options) {
      const grant = dashboardGrant(token)
      if (!grant?.dataSourceIds.has(id)) return failure(404, 'Not found')
      if (!dataSources.hasAlertsCapability(id)) {
        return failure(400, 'Data source does not support alerts')
      }
      try {
        return { ok: true, value: (await dataSources.getAlerts(id, options)).map(publicAlert) }
      } catch (error) {
        return failure(500, error instanceof Error ? error.message : String(error))
      }
    },
    topologyStreamId: (token) => topologies.getByShareToken(token)?.id ?? null,
    dashboardTopologyStreamId(token, id) {
      return dashboardGrant(token)?.topologyIds.has(id) ? id : null
    },
    liveSubscriberCount,
    latestMetrics: (id) => getLatestMetrics(id) ?? null,
    subscribeMetrics,
    servedRevision: (id) => topologies.servedRevisionOf(id),
    mappingVersion: (id) => topologies.mappingVersionOf(id),
  }
}
