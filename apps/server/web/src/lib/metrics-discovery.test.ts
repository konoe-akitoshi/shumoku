import { describe, expect, it } from 'vitest'
import type { SourceMetricsMapping } from '$lib/types'
import { resolveNodeMetricsTarget } from './metrics-discovery'

function source(
  sourceId: string,
  priority: number,
  nodes: SourceMetricsMapping['mapping']['nodes'],
): SourceMetricsMapping {
  return {
    sourceId,
    sourceName: sourceId,
    priority,
    mapping: { nodes, links: {} },
  }
}

describe('resolveNodeMetricsTarget', () => {
  it('uses the source-qualified binding without a host inventory', () => {
    const result = resolveNodeMetricsTarget(
      [source('zabbix', 0, { router: { hostId: '42' } })],
      'router',
      '42',
    )

    expect(result).toEqual({ sourceId: 'zabbix', sourceName: 'zabbix', hostId: '42' })
  })

  it('respects source priority when host-id namespaces collide', () => {
    const result = resolveNodeMetricsTarget(
      [
        source('primary', 0, { ap: { hostId: 'shared-id' } }),
        source('secondary', 1, { ap: { hostId: 'shared-id' } }),
      ],
      'ap',
      'shared-id',
    )

    expect(result?.sourceId).toBe('primary')
  })

  it('does not guess a source from a different binding', () => {
    const result = resolveNodeMetricsTarget(
      [source('prometheus', 0, { router: { hostId: 'prom-router' } })],
      'router',
      'zabbix-router',
    )

    expect(result).toBeUndefined()
  })
})
