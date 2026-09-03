import type { EdgeStyle, NetworkGraph, SplineMode } from '@shumoku/core'
import type { ObservationsService } from '../services/observations.js'
import type { TopologyService } from '../services/topology.js'
import type { DisplaySettingsView, TopologyObservationApplicationService } from './services.js'

const DEFAULT_DISPLAY_SETTINGS: DisplaySettingsView = {
  edgeStyle: 'orthogonal',
  splineMode: 'sloppy',
  hideDisconnected: false,
}

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
    async record(topologyId, sourceId, graph, status) {
      const observation = await observations.record({
        topologyId,
        sourceId,
        capturedAt: Date.now(),
        status,
        graph,
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
        .filter((item) => item.graph !== null).length
      return { graph: parsed.graph, snapshotCount }
    },
    getDisplaySettings(topologyId) {
      const settings = topologies.readProjectOverlay(topologyId)?.settings
      return {
        edgeStyle:
          (settings?.edgeStyle as EdgeStyle | undefined) ?? DEFAULT_DISPLAY_SETTINGS.edgeStyle,
        splineMode:
          (settings?.splineMode as SplineMode | undefined) ?? DEFAULT_DISPLAY_SETTINGS.splineMode,
        hideDisconnected: settings?.hideDisconnected ?? DEFAULT_DISPLAY_SETTINGS.hideDisconnected,
      }
    },
    async updateDisplaySettings(topologyId, patch) {
      const overlay: NetworkGraph = topologies.readProjectOverlay(topologyId) ?? {
        version: '1',
        nodes: [],
        links: [],
      }
      const settings = { ...(overlay.settings ?? {}) }
      if (patch.edgeStyle !== undefined) settings.edgeStyle = patch.edgeStyle
      if (patch.edgeStyle === 'splines') settings.splineMode = patch.splineMode ?? 'sloppy'
      else if (patch.edgeStyle !== undefined) delete settings.splineMode
      if (patch.hideDisconnected !== undefined) settings.hideDisconnected = patch.hideDisconnected
      await topologies.writeProjectOverlay(topologyId, { ...overlay, settings })
      return { ok: true }
    },
  }
}
