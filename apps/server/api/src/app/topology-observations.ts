import type { ObservationsService } from '../services/observations.js'
import type { TopologyService } from '../services/topology.js'
import type { TopologyObservationApplicationService } from './services.js'

export function createTopologyObservationApplicationService(
  observations: ObservationsService,
  topologies: TopologyService,
): TopologyObservationApplicationService {
  return {
    list(topologyId, limit) {
      return observations.listForTopology(topologyId, limit).map((observation) => ({
        id: observation.id,
        topologyId: observation.topologyId,
        sourceId: observation.sourceId,
        capturedAt: observation.capturedAt,
        status: observation.status,
        statusMessage: observation.statusMessage,
        nodeCount: observation.nodeCount,
        linkCount: observation.linkCount,
        portCount: observation.portCount,
        createdAt: observation.createdAt,
      }))
    },
    get: (observationId) => observations.get(observationId),
    latest: (topologyId, sourceId) =>
      observations.latestPerSource(topologyId).find((item) => item.sourceId === sourceId) ?? null,
    async record(topologyId, sourceId, source, status) {
      const observation = await observations.record({
        topologyId,
        sourceId,
        capturedAt: Date.now(),
        status,
        source,
      })
      if (observation.contributionChanged) {
        topologies.clearCacheEntry(topologyId)
        topologies.precompute(topologyId)
      }
      return observation
    },
    async resolved(topologyId) {
      const parsed = await topologies.getParsed(topologyId)
      if (!parsed) return null
      const snapshotCount = observations
        .latestPerSource(topologyId)
        .filter((item) => item.source !== null).length
      return { graph: parsed.graph, snapshotCount }
    },
    getDisplaySettings(topologyId) {
      return { hideDisconnected: topologies.getHideDisconnected(topologyId) }
    },
    async updateDisplaySettings(topologyId, patch) {
      if (patch.hideDisconnected !== undefined) {
        topologies.setHideDisconnected(topologyId, patch.hideDisconnected)
      }
      return { ok: true }
    },
  }
}
