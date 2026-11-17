import { afterEach, describe, expect, it, vi } from 'vitest'
import { linkStatusFromOperStatus, PrometheusPlugin } from './plugin.js'

function vector(value?: string): Response {
  const result = value === undefined ? [] : [{ metric: {}, value: [1, value] }]
  return new Response(
    JSON.stringify({ status: 'success', data: { resultType: 'vector', result } }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )
}

/** Answer each PromQL query by the metric name it starts with. */
function stubPrometheus(answers: { traffic?: string; oper?: string }): string[] {
  const queries: string[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL | Request) => {
      const query = new URL(String(input)).searchParams.get('query') ?? ''
      queries.push(query)
      if (query.startsWith('ifOperStatus')) return vector(answers.oper)
      if (query.includes('Octets')) return vector(answers.traffic)
      return vector()
    }),
  )
  return queries
}

const mapping = {
  nodes: { sw: { hostId: '172.21.0.4' } },
  links: { primary: { monitoredNodeId: 'sw', interface: 'Gi0/5' } },
}

function snmpPlugin(): PrometheusPlugin {
  const plugin = new PrometheusPlugin()
  plugin.initialize({ url: 'http://prometheus.test', preset: 'snmp', jobFilter: 'snmp' })
  return plugin
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('linkStatusFromOperStatus', () => {
  it('maps IF-MIB ifOperStatus values', () => {
    expect(linkStatusFromOperStatus('1')).toBe('up')
    expect(linkStatusFromOperStatus('2')).toBe('down')
    expect(linkStatusFromOperStatus('7')).toBe('down')
    expect(linkStatusFromOperStatus('3')).toBe('unknown')
    expect(linkStatusFromOperStatus('5')).toBe('unknown')
    expect(linkStatusFromOperStatus(undefined)).toBe('unknown')
    expect(linkStatusFromOperStatus('NaN')).toBe('unknown')
  })
})

describe('PrometheusPlugin link status', () => {
  it('reports a link whose port is operationally down as down', async () => {
    const queries = stubPrometheus({ traffic: '125000', oper: '2' })

    const metrics = await snmpPlugin().pollMetrics(mapping)

    expect(metrics.links['primary']?.status).toBe('down')
    expect(metrics.links['primary']?.inBps).toBe(1_000_000)
    expect(queries).toContain('ifOperStatus{instance="172.21.0.4",ifName="Gi0/5",job="snmp"}')
  })

  it('reports a down port even when its traffic series is gone', async () => {
    stubPrometheus({ oper: '2' })

    const metrics = await snmpPlugin().pollMetrics(mapping)

    expect(metrics.links['primary']).toEqual({ status: 'down' })
  })

  it('reports an operationally up port as up', async () => {
    stubPrometheus({ traffic: '0', oper: '1' })

    const metrics = await snmpPlugin().pollMetrics(mapping)

    expect(metrics.links['primary']?.status).toBe('up')
  })

  it('keeps reading traffic data as up when no operational status is scraped', async () => {
    stubPrometheus({ traffic: '125000' })

    const metrics = await snmpPlugin().pollMetrics(mapping)

    expect(metrics.links['primary']?.status).toBe('up')
  })

  it('leaves a link silent when neither traffic nor status has samples', async () => {
    stubPrometheus({})

    const metrics = await snmpPlugin().pollMetrics(mapping)

    expect(metrics.links['primary']).toBeUndefined()
  })

  it('does not query operational status for a custom preset without operStatus', async () => {
    const queries = stubPrometheus({ traffic: '125000', oper: '2' })
    const plugin = new PrometheusPlugin()
    plugin.initialize({
      url: 'http://prometheus.test',
      preset: 'custom',
      jobFilter: 'snmp',
      customMetrics: {
        inOctets: 'ifHCInOctets',
        outOctets: 'ifHCOutOctets',
        interfaceLabel: 'ifName',
      },
    })

    const metrics = await plugin.pollMetrics(mapping)

    expect(metrics.links['primary']?.status).toBe('up')
    expect(queries.some((q) => q.startsWith('ifOperStatus'))).toBe(false)
  })
})
