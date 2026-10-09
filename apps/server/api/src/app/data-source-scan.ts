import { hasAutoscanCapability } from '@shumoku/core'
import type { DataSourceService } from '../services/datasource.js'
import type { ObservationsService } from '../services/observations.js'
import { snapshotGraph } from '../services/source-topology.js'
import type { TopologyService } from '../services/topology.js'
import type { DataSourceScanService } from './services.js'

type PluginSource = Pick<DataSourceService, 'getPlugin'>
type ObservationWriter = Pick<ObservationsService, 'record' | 'updateHysteresis'>
type TopologyProjection = Pick<TopologyService, 'clearCacheEntry' | 'precompute'>

export function createDataSourceScanService(
  dataSources: PluginSource,
  observations: ObservationWriter,
  topologies: TopologyProjection,
): DataSourceScanService {
  return {
    scan: async (id, input) => {
      const plugin = await dataSources.getPlugin(id)
      if (!plugin) return { ok: false, status: 404, error: 'Data source not found' }
      if (!hasAutoscanCapability(plugin)) {
        return { ok: false, status: 400, error: 'Source does not implement autoscan' }
      }

      const { source, ...scanned } = await plugin.scan({ seeds: input.seeds ?? [] })
      // The API reports what was observed as the graph the resolver merges.
      const snapshot = { ...scanned, graph: snapshotGraph({ ...scanned, source }) }
      if (!input.topologyId) return { ok: true, snapshot }

      const observation = await observations.record({
        topologyId: input.topologyId,
        sourceId: id,
        capturedAt: snapshot.capturedAt,
        status: snapshot.status,
        statusMessage: snapshot.statusMessage,
        graph: snapshot.graph,
      })
      observations.updateHysteresis(
        input.topologyId,
        id,
        snapshot.status === 'failed' ? 'failed' : 'ok',
        snapshot.capturedAt,
      )
      if (observation.contributionChanged) {
        topologies.clearCacheEntry(input.topologyId)
        topologies.precompute(input.topologyId)
      }
      return { ok: true, snapshot, observation }
    },
  }
}
