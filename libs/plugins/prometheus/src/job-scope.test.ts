import { afterEach, describe, expect, it, vi } from 'vitest'
import { PrometheusPlugin } from './plugin.js'

function prometheusResponse(data: unknown): Response {
  return new Response(JSON.stringify({ status: 'success', data }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('PrometheusPlugin job scoping', () => {
  it('fails connection validation when the mandatory job scope is missing', async () => {
    const requests: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request) => {
        const url = new URL(String(input))
        requests.push(url.pathname)
        if (url.pathname === '/-/healthy') return new Response('Prometheus is Healthy.')
        return prometheusResponse({ version: '3.5.0' })
      }),
    )
    const plugin = new PrometheusPlugin()
    plugin.initialize({ url: 'http://prometheus.test', preset: 'snmp' })

    const result = await plugin.testConnection()

    expect(result.success).toBe(false)
    expect(result.message).toContain('Job filter is required')
    expect(requests).toEqual(['/-/healthy', '/api/v1/status/buildinfo'])
  })

  it('uses an explicit regex scope for host discovery', async () => {
    const requests: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request) => {
        requests.push(String(input))
        return prometheusResponse({
          resultType: 'vector',
          result: [{ metric: { instance: '192.168.10.7' }, value: [1, '0'] }],
        })
      }),
    )
    const plugin = new PrometheusPlugin()
    plugin.initialize({
      url: 'http://prometheus.test',
      preset: 'snmp',
      jobFilter: 'snmp-.*',
      jobFilterMode: 'regex',
    })

    const hosts = await plugin.getHosts()

    expect(hosts.map((host) => host.id)).toEqual(['192.168.10.7'])
    expect(requests).toHaveLength(1)
    const url = new URL(requests[0] ?? '')
    expect(url.searchParams.get('query')).toBe('up{job=~"snmp-.*"}')
  })

  it('does not query Prometheus when the mandatory job scope is missing', async () => {
    const requests: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request) => {
        requests.push(String(input))
        return prometheusResponse([])
      }),
    )
    const plugin = new PrometheusPlugin()
    plugin.initialize({ url: 'http://prometheus.test', preset: 'node_exporter' })

    const metrics = await plugin.pollMetrics({
      nodes: { node1: { hostId: '192.168.10.7' } },
      links: {},
    })

    expect(metrics.nodes).toEqual({})
    expect(metrics.warnings).toBeUndefined()
    expect(requests).toHaveLength(0)
  })

  it('reports a failed scrape on the node monitoring path without declaring the device down', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        prometheusResponse({
          resultType: 'vector',
          result: [{ metric: { instance: '192.168.10.7' }, value: [1, '0'] }],
        }),
      ),
    )
    const plugin = new PrometheusPlugin()
    plugin.initialize({
      url: 'http://prometheus.test',
      preset: 'node_exporter',
      jobFilter: 'node',
    })

    const metrics = await plugin.pollMetrics({
      nodes: { node1: { hostId: '192.168.10.7' } },
      links: {},
    })

    expect(metrics.nodes.node1).toEqual({
      status: 'unknown',
      monitoring: 'failing',
      monitoringError: 'Prometheus scrape failed (up=0)',
      lastSeen: undefined,
    })
    expect(metrics.warnings).toBeUndefined()
  })
})
