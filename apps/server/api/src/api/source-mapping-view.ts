import type { MetricsMapping } from '@shumoku/core'
import type { TopologyDataSource } from '../types.js'

export interface SourceMetricsMappingView {
  sourceId: string
  sourceName: string
  priority: number
  mapping: MetricsMapping
}

/**
 * Preserve metrics-source provenance for UI consumers. `MetricsMapping` remains
 * the source-local plugin contract; this web read model wraps it instead of
 * widening the core type or asking clients to reconstruct provenance from host
 * inventories.
 */
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
