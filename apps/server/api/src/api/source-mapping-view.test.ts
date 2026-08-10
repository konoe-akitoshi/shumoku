import type { MetricsMapping } from '@shumoku/core'
import { describe, expect, it } from 'vitest'
import type { TopologyDataSource } from '../types.js'
import { buildSourceMetricsMappingView } from './source-mapping-view.js'

function source(dataSourceId: string, priority: number): TopologyDataSource {
  return {
    id: `attachment-${dataSourceId}`,
    topologyId: 'topology-1',
    dataSourceId,
    purpose: 'metrics',
    syncMode: 'manual',
    priority,
    nodeContribution: 'scoop',
    linkContribution: 'add',
    createdAt: 1,
    updatedAt: 1,
  }
}

describe('buildSourceMetricsMappingView', () => {
  it('preserves attached-source order and provenance', () => {
    const mapping: MetricsMapping = {
      nodes: { router: { hostId: 'host-1' } },
      links: {},
    }
    const result = buildSourceMetricsMappingView(
      [source('primary', 0), source('secondary', 1)],
      new Map([['primary', mapping]]),
    )

    expect(result).toEqual([
      {
        sourceId: 'primary',
        sourceName: 'primary',
        priority: 0,
        mapping,
      },
      {
        sourceId: 'secondary',
        sourceName: 'secondary',
        priority: 1,
        mapping: { nodes: {}, links: {} },
      },
    ])
  })
})
