import { describe, expect, it } from 'vitest'
import { AristaCvCuePlugin, eventToAlert, mapEventSeverity, uplinkToLinkMetrics } from './plugin.js'

describe('mapEventSeverity', () => {
  it('translates CV-CUE tokens to the neutral scale', () => {
    expect(mapEventSeverity('CRITICAL')).toBe('critical')
    expect(mapEventSeverity('HIGH')).toBe('high')
    expect(mapEventSeverity('MEDIUM')).toBe('medium')
    expect(mapEventSeverity('LOW')).toBe('low')
    expect(mapEventSeverity('INFO')).toBe('info')
    expect(mapEventSeverity('OK')).toBe('ok')
  })

  it('is case-insensitive and defaults unknown tokens to info', () => {
    expect(mapEventSeverity('high')).toBe('high')
    expect(mapEventSeverity('weird')).toBe('info')
    expect(mapEventSeverity(undefined)).toBe('info')
  })
})

describe('eventToAlert', () => {
  it('maps LIVE events to active and EXPIRED/INSTANTANEOUS to resolved', () => {
    expect(
      eventToAlert({ id: 1, activityStatus: 'LIVE', eventSeverity: 'HIGH', startTime: 1000 })
        .status,
    ).toBe('active')
    expect(
      eventToAlert({ id: 2, activityStatus: 'EXPIRED', startTime: 1, stopTime: 9 }).status,
    ).toBe('resolved')
    expect(eventToAlert({ id: 3, activityStatus: 'INSTANTANEOUS', startTime: 5 }).status).toBe(
      'resolved',
    )
  })

  it('carries title, severity, source and category label', () => {
    const a = eventToAlert({
      id: 11,
      activityStatus: 'INSTANTANEOUS',
      eventSeverity: 'HIGH',
      summary: 'Authentication failed',
      startTime: 42,
      category: 71,
    })
    expect(a).toMatchObject({
      id: '11',
      severity: 'high',
      title: 'Authentication failed',
      source: 'arista-cv-cue',
      startTime: 42,
      labels: { category: '71' },
    })
  })
})

describe('uplinkToLinkMetrics', () => {
  const uplink = { name: 'eth0', linkStatus: 1, linkSpeed: 1000, switchChassisId: 'aa' }

  it('derives in/out throughput from radios (down→in, up→out)', () => {
    const m = uplinkToLinkMetrics({
      uplinkWiredInterfacesInfo: { lan1Data: uplink },
      radios: [
        { downstreamUsage: 400, upstreamUsage: 100 },
        { downstreamUsage: 100, upstreamUsage: 50 },
      ],
    })
    expect(m).toMatchObject({ status: 'up', inBps: 500, outBps: 150 })
    // 500 bps over a 1000 Mbps link → ~0%
    expect(m.utilization).toBeCloseTo((500 / 1_000_000_000) * 100)
  })

  it('emits status only for an idle AP (no fake zero throughput)', () => {
    const m = uplinkToLinkMetrics({
      uplinkWiredInterfacesInfo: { lan1Data: uplink },
      radios: [{ downstreamUsage: 0, upstreamUsage: 0 }],
    })
    expect(m).toEqual({ status: 'up' })
    expect(m.inBps).toBeUndefined()
  })

  it('reports link down from linkStatus', () => {
    const m = uplinkToLinkMetrics({
      uplinkWiredInterfacesInfo: { lan1Data: { ...uplink, linkStatus: 0 } },
      radios: [],
    })
    expect(m.status).toBe('down')
  })
})

describe('AristaCvCuePlugin', () => {
  it('advertises topology/hosts/metrics/alerts and its type', () => {
    const p = new AristaCvCuePlugin()
    expect(p.type).toBe('arista-cv-cue')
    expect([...p.capabilities].sort()).toEqual(['alerts', 'hosts', 'metrics', 'topology'])
  })

  it('requires baseUrl, keyId and keyValue', () => {
    const p = new AristaCvCuePlugin()
    expect(() => p.initialize({ baseUrl: 'https://x/wifi/api' })).toThrow(/keyId/)
    expect(() =>
      p.initialize({ baseUrl: 'https://x/wifi/api', keyId: 'k', keyValue: 'v' }),
    ).not.toThrow()
  })

  it('rejects a non-https base URL at construction', () => {
    const p = new AristaCvCuePlugin()
    expect(() =>
      p.initialize({ baseUrl: 'http://insecure/wifi/api', keyId: 'k', keyValue: 'v' }),
    ).toThrow(/https/)
  })

  it('returns empty metrics without a live API when nothing is mapped', async () => {
    const p = new AristaCvCuePlugin()
    p.initialize({ baseUrl: 'https://x/wifi/api', keyId: 'k', keyValue: 'v' })
    const m = await p.pollMetrics({ nodes: {}, links: {} })
    expect(m.nodes).toEqual({})
    expect(m.links).toEqual({})
  })
})
