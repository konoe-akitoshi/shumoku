import type { SourceMetricsMapping } from '$lib/types'

export interface NodeMetricsTarget {
  sourceId: string
  sourceName: string
  hostId: string
}

/**
 * Resolve the exact plugin + host pair behind the compatibility mapping shown
 * by the UI. Source mappings arrive in priority order; matching the merged
 * host id keeps this aligned with the server's highest-priority-wins view while
 * preserving source provenance (including colliding plugin host-id namespaces).
 */
export function resolveNodeMetricsTarget(
  sourceMappings: SourceMetricsMapping[],
  nodeId: string | undefined,
  mergedHostId: string | undefined,
): NodeMetricsTarget | undefined {
  if (!nodeId || !mergedHostId) return undefined

  for (const source of sourceMappings) {
    if (source.mapping.nodes[nodeId]?.hostId === mergedHostId) {
      return {
        sourceId: source.sourceId,
        sourceName: source.sourceName,
        hostId: mergedHostId,
      }
    }
  }
  return undefined
}
