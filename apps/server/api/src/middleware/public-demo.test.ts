import { describe, expect, it } from 'vitest'
import { isViewerRequestAllowed, publicDemoValue } from './public-demo.js'

describe('public demo authorization', () => {
  it('uses an explicit read allow-list', () => {
    expect(isViewerRequestAllowed('GET', '/api/topologies')).toBe(true)
    expect(isViewerRequestAllowed('GET', '/api/dashboards/dashboard-1')).toBe(true)
    expect(isViewerRequestAllowed('GET', '/api/topologies/topology-1/view')).toBe(true)
    expect(isViewerRequestAllowed('GET', '/api/datasources/source-1/alerts')).toBe(true)
    expect(isViewerRequestAllowed('POST', '/api/topologies')).toBe(false)
    expect(isViewerRequestAllowed('HEAD', '/api/topologies')).toBe(false)
    expect(isViewerRequestAllowed('GET', '/api/settings')).toBe(false)
    expect(isViewerRequestAllowed('GET', '/api/topologies/topology-1/mapping')).toBe(false)
    expect(isViewerRequestAllowed('GET', '/api/topologies/topology-1/sources')).toBe(false)
    expect(isViewerRequestAllowed('GET', '/api/datasources/source-1/hosts')).toBe(false)
    expect(isViewerRequestAllowed('GET', '/api/datasources/source-1/config-options/site')).toBe(
      false,
    )
  })

  it('removes credentials and internal identities recursively', () => {
    expect(
      publicDemoValue({
        id: 'source-1',
        configJson: '{"password":"secret"}',
        webhookSecret: 'secret',
        dataSource: {
          statusMessage: 'failed to connect to 10.0.0.1 with token=secret',
          path: '/private/plugin/path',
        },
      }),
    ).toEqual({ id: 'source-1', configJson: '{}', dataSource: {} })
  })

  it('uses the narrow metrics and alert projections', () => {
    expect(
      publicDemoValue({
        nodes: {
          router: { status: 'up', monitoringError: 'secret internal address', cpu: 42 },
        },
        links: { uplink: { status: 'up', inBps: 12, outBps: 34 } },
        timestamp: 123,
        warnings: ['internal parser error'],
      }),
    ).toEqual({
      nodes: { router: { status: 'up' } },
      links: { uplink: { status: 'up', inBps: 12, outBps: 34 } },
      timestamp: 123,
    })

    expect(
      publicDemoValue({
        id: 'alert-1',
        severity: 'high',
        status: 'firing',
        title: 'Router down',
        startTime: 123,
        description: 'query with secret',
        hostId: 'internal-host-id',
        url: 'http://internal.example',
      }),
    ).toEqual({
      id: 'alert-1',
      severity: 'high',
      status: 'firing',
      title: 'Router down',
      startTime: 123,
    })
  })
})
