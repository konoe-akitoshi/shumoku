// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { describe, expect, it } from 'vitest'
import type { Node } from '../models/types.js'
import type { PluginConfigSchema } from '../plugin-types.js'
import {
  type AlertmanagerAlert,
  buildAlertTitle,
  buildIdentity,
  filterAlertLabels,
  flattenObject,
  mapAlertmanagerSeverity,
  mapWithConcurrency,
  parseAlertmanagerAlerts,
  severityAtLeast,
  severityRank,
  stampObserved,
  validateAgainstSchema,
} from './index.js'

describe('severity', () => {
  it('ranks the neutral scale ascending', () => {
    expect(severityRank('ok')).toBeLessThan(severityRank('info'))
    expect(severityRank('low')).toBeLessThan(severityRank('critical'))
    expect(severityAtLeast('high', 'medium')).toBe(true)
    expect(severityAtLeast('low', 'high')).toBe(false)
    expect(severityAtLeast('critical', 'critical')).toBe(true)
  })

  it('maps Alertmanager dialects to the neutral scale', () => {
    expect(mapAlertmanagerSeverity('critical')).toBe('critical')
    expect(mapAlertmanagerSeverity('disaster')).toBe('critical')
    expect(mapAlertmanagerSeverity('Warning')).toBe('low') // case-insensitive
    expect(mapAlertmanagerSeverity('none')).toBe('ok')
    expect(mapAlertmanagerSeverity('totally-unknown')).toBe('info')
    expect(mapAlertmanagerSeverity(undefined)).toBe('info')
  })
})

describe('parseAlertmanagerAlerts', () => {
  const NOW = 1_700_000_000_000
  const mk = (over: Partial<AlertmanagerAlert>): AlertmanagerAlert => ({
    fingerprint: 'fp',
    labels: { alertname: 'X', severity: 'critical' },
    startsAt: new Date(NOW - 60_000).toISOString(),
    status: { state: 'active' },
    ...over,
  })

  it('keeps active alerts and maps fields', () => {
    const [a] = parseAlertmanagerAlerts(
      [
        mk({
          fingerprint: 'abc',
          labels: { alertname: 'HighCPU', severity: 'warning', instance: 'host-1', __tmp: 'x' },
          annotations: { summary: 'cpu hot' },
          generatorURL: 'http://g/1',
        }),
      ],
      { source: 'prometheus', now: NOW },
    )
    expect(a?.id).toBe('abc')
    expect(a?.severity).toBe('low') // warning → low
    expect(a?.title).toBe('HighCPU - host-1')
    expect(a?.host).toBe('host-1')
    expect(a?.description).toBe('cpu hot')
    expect(a?.status).toBe('active')
    expect(a?.source).toBe('prometheus')
    expect(a?.url).toBe('http://g/1')
    expect(a?.labels?.__tmp).toBeUndefined() // internal labels stripped
    expect(a?.labels?.alertname).toBe('HighCPU')
  })

  it('drops resolved alerts older than timeRange but keeps recent ones', () => {
    const old = mk({
      fingerprint: 'old',
      status: { state: 'suppressed' },
      startsAt: new Date(NOW - 10 * 3600_000).toISOString(),
    })
    const recent = mk({
      fingerprint: 'recent',
      status: { state: 'suppressed' },
      startsAt: new Date(NOW - 60_000).toISOString(),
    })
    const out = parseAlertmanagerAlerts([old, recent], { source: 's', now: NOW })
    expect(out.map((a) => a.id)).toEqual(['recent'])
    expect(out[0]?.status).toBe('resolved')
  })

  it('honors activeOnly', () => {
    const out = parseAlertmanagerAlerts([mk({ status: { state: 'suppressed' } })], {
      source: 's',
      now: NOW,
      query: { activeOnly: true },
    })
    expect(out).toHaveLength(0)
  })

  it('filters by minSeverity', () => {
    const out = parseAlertmanagerAlerts(
      [
        mk({ fingerprint: 'lo', labels: { alertname: 'a', severity: 'warning' } }),
        mk({ fingerprint: 'hi', labels: { alertname: 'b', severity: 'critical' } }),
      ],
      { source: 's', now: NOW, query: { minSeverity: 'high' } },
    )
    expect(out.map((a) => a.id)).toEqual(['hi'])
  })

  it('handles a missing endsAt without a bogus epoch end time', () => {
    const [a] = parseAlertmanagerAlerts([mk({})], { source: 's', now: NOW })
    expect(a?.endTime).toBeUndefined()
    const [b] = parseAlertmanagerAlerts([mk({ endsAt: new Date(NOW).toISOString() })], {
      source: 's',
      now: NOW,
    })
    expect(b?.endTime).toBe(NOW)
  })

  it('builds a title without a host when no host label', () => {
    expect(buildAlertTitle({ alertname: 'Solo' })).toBe('Solo')
    expect(filterAlertLabels({ __x: '1', keep: '2' })).toEqual({ keep: '2' })
  })
})

describe('flattenObject', () => {
  it('joins nested keys, counts arrays, and skips noise', () => {
    const out = flattenObject(
      {
        model: 'AP25',
        empty: '',
        notFinite: Number.POSITIVE_INFINITY,
        nested: { radios: 2 },
        tags: ['a', 'b'],
        ports: [{ state: 'up' }, { state: 'down' }],
        nothing: null,
      },
      'aruba',
    )
    const byName = new Map(out.map((m) => [m.name, m.value]))
    expect(byName.get('aruba_model')).toBe('AP25')
    expect(byName.get('aruba_nested_radios')).toBe(2)
    expect(byName.get('aruba_tags_count')).toBe(2)
    expect(byName.get('aruba_ports_count')).toBe(2)
    expect(byName.has('aruba_empty')).toBe(false)
    expect(byName.has('aruba_notFinite')).toBe(false)
    expect(byName.has('aruba_nothing')).toBe(false)
    // array-of-objects expands with an index label
    const portStates = out.filter((m) => m.name === 'aruba_ports_state')
    expect(portStates).toHaveLength(2)
    expect(portStates[0]?.labels.ports_index).toBe('0')
  })
})

describe('mapWithConcurrency', () => {
  it('preserves order and caps concurrency', async () => {
    let inFlight = 0
    let peak = 0
    const items = Array.from({ length: 12 }, (_, i) => i)
    const out = await mapWithConcurrency(items, 3, async (x) => {
      inFlight++
      peak = Math.max(peak, inFlight)
      await new Promise((r) => setTimeout(r, 3))
      inFlight--
      return x * 2
    })
    expect(out).toEqual(items.map((x) => x * 2))
    expect(peak).toBeLessThanOrEqual(3)
    expect(peak).toBeGreaterThan(1)
  })

  it('handles empty input and a limit larger than the list', async () => {
    expect(await mapWithConcurrency([], 4, async () => 1)).toEqual([])
    expect(await mapWithConcurrency([1, 2], 10, async (x) => x + 1)).toEqual([2, 3])
  })

  it('propagates a rejection', async () => {
    await expect(
      mapWithConcurrency([1, 2, 3], 2, async (x) => {
        if (x === 2) throw new Error('boom')
        return x
      }),
    ).rejects.toThrow('boom')
  })
})

describe('buildIdentity / stampObserved', () => {
  it('drops empty identity parts and vendorId values', () => {
    expect(buildIdentity({ mgmtIp: '', sysName: undefined })).toBeUndefined()
    expect(
      buildIdentity({ mgmtIp: '10.0.0.1', vendorIds: { 'netbox-id': '', keep: '7' } }),
    ).toEqual({
      mgmtIp: '10.0.0.1',
      vendorIds: { keep: '7' },
    })
  })

  it('stamps provenance/identity/metadata without mutating the input', () => {
    const node: Node = { id: 'n1', label: 'Core', metadata: { existing: true } }
    const out = stampObserved(node, {
      source: 'netbox-1',
      observedAt: 42,
      identity: { mgmtIp: '10.0.0.1' },
      syncState: 'synced',
      readVia: 'netbox',
    })
    expect(out.provenance).toEqual({ source: 'netbox-1', observedAt: 42 })
    expect(out.identity).toEqual({ mgmtIp: '10.0.0.1' })
    expect(out.metadata).toEqual({ existing: true, syncState: 'synced', readVia: 'netbox' })
    // input untouched
    expect(node.provenance).toBeUndefined()
    expect(node.metadata).toEqual({ existing: true })
  })
})

describe('validateAgainstSchema', () => {
  const zabbix: PluginConfigSchema = {
    type: 'object',
    required: ['url', 'token'],
    properties: {
      url: { type: 'string', format: 'uri' },
      token: { type: 'string', format: 'password' },
      pollInterval: {
        type: 'number',
        oneOf: [
          { const: 5000, title: '5s' },
          { const: 60000, title: '1m' },
        ],
      },
    },
  }

  it('accepts a valid config and ignores unknown keys', () => {
    expect(
      validateAgainstSchema(zabbix, {
        url: 'https://z',
        token: 't',
        pollInterval: 60000,
        extra: 'kept',
      }),
    ).toEqual({ ok: true })
  })

  it('flags missing required, bad uri, and out-of-set enum', () => {
    const r = validateAgainstSchema(zabbix, { url: 'ftp://z', pollInterval: 999 })
    expect(r.ok).toBe(false)
    if (r.ok) return
    const paths = r.errors.map((e) => e.path)
    expect(paths).toContain('token') // required missing
    expect(paths).toContain('url') // not http(s)
    expect(paths).toContain('pollInterval') // not in oneOf
  })

  const prometheus: PluginConfigSchema = {
    type: 'object',
    required: ['url', 'preset'],
    properties: {
      url: { type: 'string', format: 'uri' },
      preset: {
        type: 'string',
        oneOf: [
          { const: 'snmp', title: 'SNMP' },
          { const: 'custom', title: 'Custom' },
        ],
      },
      customMetrics: {
        type: 'object',
        visibleWhen: { field: 'preset', equals: 'custom' },
        requiredWhen: { field: 'preset', equals: 'custom' },
        required: ['inOctets', 'outOctets', 'interfaceLabel'],
        properties: {
          inOctets: { type: 'string' },
          outOctets: { type: 'string' },
          interfaceLabel: { type: 'string' },
          upMetric: { type: 'string' },
        },
      },
    },
  }

  it('skips a hidden conditional field (preset != custom)', () => {
    expect(validateAgainstSchema(prometheus, { url: 'https://p', preset: 'snmp' })).toEqual({
      ok: true,
    })
  })

  it('requires the conditional object and its children when visible', () => {
    const missing = validateAgainstSchema(prometheus, { url: 'https://p', preset: 'custom' })
    expect(missing.ok).toBe(false)
    if (missing.ok) return
    expect(missing.errors.map((e) => e.path)).toContain('customMetrics') // requiredWhen fired

    const partial = validateAgainstSchema(prometheus, {
      url: 'https://p',
      preset: 'custom',
      customMetrics: { inOctets: 'a' },
    })
    expect(partial.ok).toBe(false)
    if (partial.ok) return
    expect(partial.errors.map((e) => e.path)).toContain('customMetrics.outOctets')
  })

  it('validates array item types', () => {
    const schema: PluginConfigSchema = {
      type: 'object',
      properties: { targets: { type: 'array', items: { type: 'string' } } },
    }
    expect(validateAgainstSchema(schema, { targets: ['10.0.0.1', '10.0.0.2'] })).toEqual({
      ok: true,
    })
    const bad = validateAgainstSchema(schema, { targets: ['ok', 5] })
    expect(bad.ok).toBe(false)
    if (bad.ok) return
    expect(bad.errors[0]?.path).toBe('targets[1]')
  })
})

describe('validateTopologyIdentityContract — store-fallback parity', () => {
  // Mirrors the server's portIdentityWithIfNameFallback exactly: a port with
  // an ABSENT identity and one with an EMPTY identity object are equivalent
  // (both get ifName = port.id stamped on ingest), so neither may be flagged.
  it('treats an empty identity object like an absent one (fallback-eligible)', async () => {
    const { validateTopologyIdentityContract } = await import('./topology-identity-contract.js')
    const graph = {
      name: 't',
      nodes: [
        {
          id: 'sw1',
          label: 'sw1',
          identity: { sysName: 'sw1' },
          ports: [
            { id: 'ge-0/0/1' }, // absent identity → fallback
            { id: 'ge-0/0/2', identity: {} }, // EMPTY identity → same fallback
            { id: 'ge-0/0/3', identity: { ifIndex: 7 } }, // port key w/o ifName → weak, flagged
          ],
        },
      ],
      links: [],
    }
    // biome-ignore lint/suspicious/noExplicitAny: minimal structural fixture
    const result = validateTopologyIdentityContract(graph as any)
    expect(result.nodesMissingIdentity).toEqual([])
    expect(result.portsMissingIfName).toEqual(['ge-0/0/3'])
  })
})
