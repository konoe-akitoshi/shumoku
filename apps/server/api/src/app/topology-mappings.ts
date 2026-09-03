import type { MetricsMapping } from '@shumoku/core'
import type { DataSourceService } from '../services/datasource.js'
import type { TopologyService } from '../services/topology.js'
import type { TopologySourcesService } from '../services/topology-sources.js'
import type { TopologyDataSource } from '../types.js'
import type {
  SourceMetricsMappingView,
  TopologyMappingApplicationService,
  TopologyMappingResult,
} from './services.js'

export function buildSourceMetricsMappingView(
  sources: TopologyDataSource[],
  mappings: ReadonlyMap<string, MetricsMapping>,
): SourceMetricsMappingView[] {
  return sources.map((source) => ({
    sourceId: source.dataSourceId,
    sourceName: source.dataSource?.name ?? source.dataSourceId,
    priority: source.priority,
    mapping: mappings.get(source.dataSourceId) ?? { nodes: {}, links: {} },
  }))
}

function failure(status: 400 | 404 | 409 | 422 | 500, error: string): TopologyMappingResult<never> {
  return { ok: false, status, error }
}

function sourceError(
  error?: 'invalidSource' | 'noMetricsSource',
): TopologyMappingResult<never> | null {
  if (error === 'invalidSource') {
    return failure(400, 'sourceId is not an attached metrics source for this topology')
  }
  if (error === 'noMetricsSource') {
    return failure(409, 'no metrics source attached to this topology — attach one before mapping')
  }
  return null
}

export function createTopologyMappingApplicationService(dependencies: {
  topologies: TopologyService
  sources: TopologySourcesService
  dataSources: DataSourceService
}): TopologyMappingApplicationService {
  const { topologies, sources, dataSources } = dependencies
  return {
    async get(id, sourceId) {
      try {
        const parsed = await topologies.getParsed(id)
        if (!parsed) return failure(404, 'Topology not found')
        if (sourceId) {
          const attached = sources.listByPurpose(id, 'metrics')
          if (!attached.some((source) => source.dataSourceId === sourceId)) {
            return failure(400, 'sourceId is not an attached metrics source for this topology')
          }
          return {
            ok: true,
            value: topologies.buildMappingsBySource(id, parsed.graph).get(sourceId) ?? {
              nodes: {},
              links: {},
            },
          }
        }
        return { ok: true, value: parsed.mapping ?? { nodes: {}, links: {} } }
      } catch (error) {
        return failure(400, error instanceof Error ? error.message : String(error))
      }
    },
    async listSources(id) {
      try {
        const parsed = await topologies.getParsed(id)
        if (!parsed) return failure(404, 'Topology not found')
        const mappings = topologies.buildMappingsBySource(id, parsed.graph)
        return {
          ok: true,
          value: buildSourceMetricsMappingView(sources.listByPurpose(id, 'metrics'), mappings),
        }
      } catch (error) {
        return failure(400, error instanceof Error ? error.message : String(error))
      }
    },
    async listOrphans(id) {
      try {
        if (!topologies.get(id)) return failure(404, 'Topology not found')
        return { ok: true, value: { orphans: await topologies.mappingOrphans(id) } }
      } catch (error) {
        return failure(400, error instanceof Error ? error.message : String(error))
      }
    },
    async reassignOrphan(id, entityId, toEntityId) {
      if (!topologies.get(id)) return failure(404, 'Topology not found')
      const result = await topologies.reassignOrphan(id, entityId, toEntityId)
      return result.ok
        ? { ok: true, value: { success: true } }
        : failure(400, result.error ?? 'Unable to reassign orphan')
    },
    discardOrphan(id, entityId) {
      if (!topologies.get(id)) return failure(404, 'Topology not found')
      return topologies.discardOrphan(id, entityId)
        ? { ok: true, value: { success: true } }
        : failure(404, 'Orphan not found')
    },
    resetRegistry(id) {
      if (!topologies.get(id)) return failure(404, 'Topology not found')
      try {
        topologies.resetRegistry(id)
        return { ok: true, value: { success: true } }
      } catch (error) {
        return failure(500, error instanceof Error ? error.message : String(error))
      }
    },
    async replace(id, mapping, sourceId) {
      try {
        const result = await topologies.updateMapping(id, mapping, { sourceId })
        const invalid = sourceError(result.error)
        if (invalid) return invalid
        if (!result.topology) return failure(404, 'Topology not found')
        return { ok: true, value: { ...result.topology, skipped: result.skipped } }
      } catch (error) {
        return failure(400, error instanceof Error ? error.message : String(error))
      }
    },
    async patchNode(id, nodeId, input) {
      try {
        if (!topologies.get(id)) return failure(404, 'Topology not found')
        const parsed = await topologies.getParsed(id)
        if (!parsed) {
          return failure(
            409,
            'cannot resolve current mapping; refusing to patch (would drop entries)',
          )
        }
        const targetSourceId = input.sourceId ?? parsed.metricsSourceId
        const sourceMapping = targetSourceId
          ? topologies.buildMappingsBySource(id, parsed.graph).get(targetSourceId)
          : undefined
        const mapping: MetricsMapping = {
          nodes: { ...(sourceMapping?.nodes ?? {}) },
          links: { ...(sourceMapping?.links ?? {}) },
        }
        if (input.hostId || input.hostName) {
          mapping.nodes[nodeId] = { hostId: input.hostId, hostName: input.hostName }
        } else {
          delete mapping.nodes[nodeId]
        }
        const result = await topologies.updateMapping(id, mapping, { sourceId: targetSourceId })
        const invalid = sourceError(result.error)
        if (invalid) return invalid
        if (!result.topology) return failure(404, 'Topology not found')
        return {
          ok: true,
          value: {
            success: true,
            topology: result.topology,
            nodeMapping: mapping.nodes[nodeId] ?? null,
          },
        }
      } catch (error) {
        return failure(400, error instanceof Error ? error.message : String(error))
      }
    },
    async patchLink(id, linkId, input) {
      try {
        if (!topologies.get(id)) return failure(404, 'Topology not found')
        const parsed = await topologies.getParsed(id)
        if (!parsed) {
          return failure(
            409,
            'cannot resolve current mapping; refusing to patch (would drop entries)',
          )
        }
        const linkKeys = new Set(
          parsed.graph.links.map((link, index) => link.id || `link-${index}`),
        )
        if (!linkKeys.has(linkId)) {
          return failure(404, `Link '${linkId}' not found in current resolved graph`)
        }
        const result = await topologies.patchLinkMapping(
          id,
          linkId,
          input,
          input?.sourceId ? { sourceId: input.sourceId } : undefined,
        )
        const invalid = sourceError(result.error)
        if (invalid) return invalid
        if (!result.topology) return failure(404, 'Topology not found')
        if (result.skipped.nodes + result.skipped.links > 0) {
          return failure(
            422,
            'mapping not persisted: the link or its monitored node has no stable entity id (the source may not provide identity)',
          )
        }
        return {
          ok: true,
          value: {
            success: true,
            topology: result.topology,
            linkMapping: result.linkMapping ?? null,
          },
        }
      } catch (error) {
        return failure(400, error instanceof Error ? error.message : String(error))
      }
    },
    clear(id, kind, sourceId) {
      if (!topologies.get(id)) return failure(404, 'Topology not found')
      const result = topologies.deleteMappingByKind(id, kind, sourceId ? { sourceId } : undefined)
      const invalid = sourceError(result.error)
      return invalid ?? { ok: true, value: { deleted: result.deleted } }
    },
    async autoMapLinks(id, input) {
      try {
        if (!topologies.get(id)) return failure(404, 'Topology not found')
        const result = await topologies.autoMapLinks(id, dataSources, input)
        const invalid = sourceError(result.error)
        return invalid ?? { ok: true, value: result }
      } catch (error) {
        return failure(400, error instanceof Error ? error.message : String(error))
      }
    },
  }
}
