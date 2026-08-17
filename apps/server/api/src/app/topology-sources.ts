import type { NetworkGraph } from '@shumoku/core'
import { parseSyncOptions } from '../plugins/sync-options.js'
import { hasAutoscanCapability, hasTopologyCapability } from '../plugins/types.js'
import type { DataSourceService } from '../services/datasource.js'
import { runDeepRead } from '../services/deep-read-service.js'
import type { ObservationsService } from '../services/observations.js'
import {
  resolveCredentialsForAutoscan,
  resolveSeedsForAutoscan,
} from '../services/sync-scheduler.js'
import type { TopologyService } from '../services/topology.js'
import type { TopologySourcesService } from '../services/topology-sources.js'
import type { TopologySourceApplicationService, TopologySourceMutationResult } from './services.js'

function failure(
  status: 400 | 404 | 409 | 500,
  error: string,
): TopologySourceMutationResult<never> {
  return { ok: false, status, error }
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

export function createTopologySourceApplicationService(dependencies: {
  topologies: TopologyService
  sources: TopologySourcesService
  dataSources: DataSourceService
  observations: ObservationsService
}): TopologySourceApplicationService {
  const { topologies, sources, dataSources, observations } = dependencies
  return {
    list(topologyId) {
      if (!topologies.get(topologyId)) return failure(404, 'Topology not found')
      return {
        ok: true,
        value: sources
          .listByTopology(topologyId)
          .filter((source) => source.dataSourceId !== 'deep-read'),
      }
    },
    async add(topologyId, input) {
      if (!topologies.get(topologyId)) return failure(404, 'Topology not found')
      if (input.type === 'manual') {
        try {
          return {
            ok: true,
            status: 201,
            value: await topologies.attachManualSource(topologyId, input.purpose ?? 'topology'),
          }
        } catch (error) {
          return failure(500, errorMessage(error, 'Failed to attach Manual'))
        }
      }
      if (!input.dataSourceId || !input.purpose) {
        return failure(400, 'dataSourceId and purpose are required')
      }
      if (!dataSources.get(input.dataSourceId)) return failure(404, 'Data source not found')
      if (sources.find(topologyId, input.dataSourceId, input.purpose)) {
        return failure(409, 'This data source is already linked with this purpose')
      }
      try {
        const source = await sources.add(topologyId, input)
        topologies.clearCacheEntry(topologyId)
        return { ok: true, status: 201, value: source }
      } catch (error) {
        return failure(500, errorMessage(error, 'Failed to add data source'))
      }
    },
    update(topologyId, attachmentId, input) {
      if (!topologies.get(topologyId)) return failure(404, 'Topology not found')
      const existing = sources.get(attachmentId)
      if (!existing || existing.topologyId !== topologyId) {
        return failure(404, 'Topology data source not found')
      }
      const updated = sources.update(attachmentId, input)
      if (!updated) return failure(500, 'Failed to update')
      topologies.clearCacheEntry(topologyId)
      return { ok: true, value: updated }
    },
    remove(topologyId, attachmentId) {
      if (!topologies.get(topologyId)) return failure(404, 'Topology not found')
      const existing = sources.get(attachmentId)
      if (!existing || existing.topologyId !== topologyId) {
        return failure(404, 'Topology data source not found')
      }
      if (!sources.remove(attachmentId)) return failure(500, 'Failed to delete')
      if (existing.purpose === 'topology') {
        observations.deleteForSource(topologyId, existing.dataSourceId)
      }
      topologies.clearCacheEntry(topologyId)
      return { ok: true, value: { success: true } }
    },
    clear(topologyId, sourceId) {
      if (!topologies.get(topologyId)) return failure(404, 'Topology not found')
      const deleted = observations.deleteForSource(topologyId, sourceId)
      topologies.clearCacheEntry(topologyId)
      return { ok: true, value: { success: true, deleted } }
    },
    async replace(topologyId, replacements) {
      if (!topologies.get(topologyId)) return failure(404, 'Topology not found')
      for (const source of replacements) {
        if (!source.dataSourceId || !source.purpose) {
          return failure(400, 'Each source must have dataSourceId and purpose')
        }
        if (!dataSources.get(source.dataSourceId)) {
          return failure(404, `Data source ${source.dataSourceId} not found`)
        }
      }
      try {
        const result = await sources.replaceAll(topologyId, replacements)
        topologies.clearCacheEntry(topologyId)
        return { ok: true, value: result }
      } catch (error) {
        return failure(500, errorMessage(error, 'Failed to update sources'))
      }
    },
    async probe(topologyId, seeds) {
      if (!topologies.get(topologyId)) return failure(404, 'Topology not found')
      if (seeds.length === 0) return failure(400, 'Body must include a non-empty `seeds` array')
      try {
        const observation = await runDeepRead(topologyId, seeds, topologies, observations)
        if (!observation) {
          return failure(
            400,
            'No SNMP credential resolved for the given address(es). Add an access:snmp policy first.',
          )
        }
        if (observation.contributionChanged) {
          topologies.clearCacheEntry(topologyId)
          topologies.precompute(topologyId)
        }
        return { ok: true, value: { observation } }
      } catch (error) {
        return failure(500, error instanceof Error ? error.message : String(error))
      }
    },
    async sync(topologyId, sourceId) {
      if (!topologies.get(topologyId)) return failure(404, 'Topology not found')
      const attached = sources.find(topologyId, sourceId, 'topology')
      if (!attached) {
        return failure(404, 'Source is not attached to this topology with topology purpose')
      }
      const plugin = dataSources.getPlugin(sourceId)
      if (!plugin) return failure(404, 'Data source not found')
      const capturedAt = Date.now()
      let graph: NetworkGraph | null = null
      let status: 'ok' | 'partial' | 'failed' | 'empty'
      let statusMessage: string | undefined
      let warnings: string[] | undefined
      try {
        if (hasAutoscanCapability(plugin)) {
          const credentials = await resolveCredentialsForAutoscan(topologyId, topologies)
          const snapshot = await plugin.scan({
            seeds: resolveSeedsForAutoscan(topologyId),
            credentials,
          })
          graph = snapshot.graph
          status = snapshot.status
          statusMessage = snapshot.statusMessage
          warnings = snapshot.warnings
        } else if (hasTopologyCapability(plugin)) {
          graph = await plugin.fetchTopology(parseSyncOptions(plugin.type, attached.optionsJson))
          status = graph?.nodes && graph.nodes.length > 0 ? 'ok' : 'empty'
        } else {
          return failure(
            400,
            `Plugin ${plugin.type} cannot supply topology (no autoscan or topology capability)`,
          )
        }
      } catch (error) {
        status = 'failed'
        statusMessage = error instanceof Error ? error.message : String(error)
      }
      const observation = await observations.record({
        topologyId,
        sourceId,
        capturedAt,
        status,
        statusMessage,
        graph,
      })
      observations.updateHysteresis(
        topologyId,
        sourceId,
        status === 'failed' ? 'failed' : 'ok',
        capturedAt,
      )
      if (observation.contributionChanged) {
        topologies.clearCacheEntry(topologyId)
        topologies.precompute(topologyId)
      }
      sources.updateLastSynced(attached.id)
      return {
        ok: true,
        value: {
          observation,
          snapshot: { status, statusMessage, capturedAt, warnings, graph },
        },
      }
    },
  }
}
