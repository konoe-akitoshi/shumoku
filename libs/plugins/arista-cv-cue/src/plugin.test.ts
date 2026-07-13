import { describe, expect, it } from 'vitest'
import { AristaCvCuePlugin, eventToAlert, mapEventSeverity } from './plugin.js'

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

describe('AristaCvCuePlugin', () => {
  it('advertises hosts/metrics/alerts and its type', () => {
    const p = new AristaCvCuePlugin()
    expect(p.type).toBe('arista-cv-cue')
    expect([...p.capabilities].sort()).toEqual(['alerts', 'hosts', 'metrics'])
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
