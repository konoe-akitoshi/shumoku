import { canPullTopology } from '../plugins/types.js'
import type { DataSourceService } from '../services/datasource.js'
import type { ObservationsService } from '../services/observations.js'
import { cancelSyncJob, getSyncJob, startSyncJob, syncJobView } from '../services/sync-job.js'
import type { TopologyService } from '../services/topology.js'
import type { TopologySourcesService } from '../services/topology-sources.js'
import type { TopologySyncApplicationService, TopologySyncResult } from './services.js'

function failure(status: 400 | 404 | 500, error: string): TopologySyncResult<never> {
  return { ok: false, status, error }
}

export function createTopologySyncApplicationService(dependencies: {
  topologies: TopologyService
  sources: TopologySourcesService
  dataSources: DataSourceService
  observations: ObservationsService
}): TopologySyncApplicationService {
  const { topologies, sources, dataSources, observations } = dependencies
  return {
    async start(id, rebuild) {
      if (!topologies.get(id)) return failure(404, 'Topology not found')
      const running = getSyncJob(id)
      if (running?.state === 'running') {
        return { ok: true, status: 409, value: { job: syncJobView(running) } }
      }
      const attached = sources.listByPurpose(id, 'topology')
      if (rebuild) {
        const refetchable = attached.filter((source) => {
          const plugin = dataSources.getPlugin(source.dataSourceId)
          return !plugin || canPullTopology(plugin)
        })
        for (const source of refetchable) {
          observations.deleteForSource(id, source.dataSourceId)
        }
        topologies.clearCacheEntry(id)
      }
      const job = startSyncJob(id, attached, {
        topologyService: topologies,
        topologySourcesService: sources,
        dataSourceService: dataSources,
        observationsService: observations,
      })
      return job
        ? { ok: true, status: 202, value: { job: syncJobView(job) } }
        : failure(400, 'No topology sources attached')
    },
    getJob(id) {
      if (!topologies.get(id)) return failure(404, 'Topology not found')
      const job = getSyncJob(id)
      return { ok: true, value: { job: job ? syncJobView(job) : null } }
    },
    cancel(id) {
      if (!topologies.get(id)) return failure(404, 'Topology not found')
      const job = cancelSyncJob(id)
      return { ok: true, value: { job: job ? syncJobView(job) : null } }
    },
    async share(id) {
      const token = await topologies.share(id)
      return token ? { ok: true, value: { shareToken: token } } : failure(404, 'Topology not found')
    },
    unshare(id) {
      return topologies.unshare(id)
        ? { ok: true, value: { success: true } }
        : failure(404, 'Topology not found')
    },
  }
}
