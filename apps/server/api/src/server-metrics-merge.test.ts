import { describe, expect, it } from 'vitest'
import { aggregateMetricsData, type MetricsSourcePoll } from './services/metrics-merge.js'

function poll(id: string, name: string, data: MetricsSourcePoll['data']): MetricsSourcePoll {
  return { source: { id, name, type: 'test' }, data }
}

describe('aggregateMetricsData', () => {
  it('keeps complementary fields and every source observation', () => {
    const merged = aggregateMetricsData([
      poll('a', 'SNMP', {
        nodes: { n1: { status: 'up', monitoring: 'healthy' } },
        links: { l1: { status: 'up', inBps: 100 } },
        timestamp: 10,
      }),
      poll('b', 'Telemetry', {
        nodes: { n1: { status: 'up', monitoring: 'healthy', cpu: 42 } },
        links: { l1: { status: 'up', utilization: 7, outBps: 200 } },
        timestamp: 20,
      }),
    ])

    expect(merged.nodes.n1).toMatchObject({
      status: 'up',
      monitoring: 'healthy',
      cpu: 42,
      redundancy: {
        totalSources: 2,
        healthySources: 2,
        agreement: 'confirmed',
      },
    })
    expect(merged.nodes.n1?.observations?.map((item) => item.source.id)).toEqual(['a', 'b'])
    expect(merged.links.l1).toMatchObject({
      status: 'up',
      inBps: 100,
      outBps: 200,
      utilization: 7,
    })
    expect(merged.timestamp).toBe(20)
  })

  it('uses redundancy when one monitoring path fails', () => {
    const merged = aggregateMetricsData([
      poll('a', 'CV-CUE', {
        nodes: { n1: { status: 'up', monitoring: 'healthy' } },
        links: {},
        timestamp: 10,
      }),
      poll('b', 'Prometheus SNMP', {
        nodes: {
          n1: {
            status: 'unknown',
            monitoring: 'failing',
            monitoringError: 'SNMP scrape failed',
          },
        },
        links: {},
        timestamp: 11,
      }),
    ])

    expect(merged.nodes.n1).toMatchObject({
      status: 'up',
      monitoring: 'degraded',
      monitoringError: 'Prometheus SNMP: SNMP scrape failed',
      redundancy: {
        totalSources: 2,
        reportingSources: 2,
        healthySources: 1,
        failingSources: 1,
        agreement: 'degraded',
      },
    })
  })

  it('surfaces conflicting device observations without discarding the positive evidence', () => {
    const merged = aggregateMetricsData([
      poll('a', 'Source A', {
        nodes: { n1: { status: 'up' } },
        links: {},
        timestamp: 10,
      }),
      poll('b', 'Source B', {
        nodes: { n1: { status: 'down' } },
        links: {},
        timestamp: 10,
      }),
    ])

    expect(merged.nodes.n1?.status).toBe('up')
    expect(merged.nodes.n1?.redundancy?.agreement).toBe('conflicting')
  })

  it('is independent of datasource order and uses a median for repeated measurements', () => {
    const polls = [
      poll('c', 'C', { nodes: { n1: { status: 'up', cpu: 90 } }, links: {}, timestamp: 3 }),
      poll('a', 'A', { nodes: { n1: { status: 'up', cpu: 10 } }, links: {}, timestamp: 1 }),
      poll('b', 'B', { nodes: { n1: { status: 'up', cpu: 40 } }, links: {}, timestamp: 2 }),
    ]

    expect(aggregateMetricsData(polls)).toEqual(aggregateMetricsData([...polls].reverse()))
    expect(aggregateMetricsData(polls).nodes.n1?.cpu).toBe(40)
  })
})
