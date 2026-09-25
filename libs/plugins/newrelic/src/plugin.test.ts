import { DeviceType } from '@shumoku/core'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { NewRelicClient } from './client.js'
import { register } from './index.js'
import { classify, interfaces, normalizeDevices, selectCurrentEntities } from './inventory.js'
import { resolveNeighbors } from './neighbors.js'
import { NewRelicPlugin } from './plugin.js'
import { linkMetrics, nodeMetrics } from './telemetry.js'
import type { Row } from './values.js'

const now = 1_800_000_000_000
const config = {
  includeInfrastructure: false,
  accountId: 123,
  apiKey: 'test-secret',
  region: 'US' as const,
}
function response(value: unknown) {
  return new Response(JSON.stringify(value))
}
function api(override?: (query: string) => Row[] | undefined) {
  return vi.fn(async (_url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body))
    if (body.query.includes('entitySearch'))
      return response({
        data: {
          actor: {
            entitySearch: {
              results: {
                entities: [{ guid: 'g', name: 'router', type: 'ROUTER', tags: [] }],
                nextCursor: null,
              },
            },
          },
        },
      })
    const q: string = body.variables.query ?? ''
    const changed = override?.(q)
    let rows: Row[] = changed ?? []
    if (!changed && q.includes('AS descriptionSeen'))
      rows = [
        {
          facet: 'g',
          name: 'router',
          sysName: 'router',
          ip: '192.0.2.1',
          oid: '.1.3.6.1.4.1.44641',
          description: 'VyOS 1.5',
          seen: now,
        },
      ]
    if (!changed && q.includes('AS alias'))
      rows = [{ facet: ['g', 'eth0'], name: 'eth0', index: 2, seen: now, speed: 1000 }]
    return response({ data: { actor: { account: { name: 'fixture', nrql: { results: rows } } } } })
  })
}
function setup(fetcher = api()) {
  vi.stubGlobal('fetch', fetcher)
  const p = new NewRelicPlugin()
  p.initialize(config)
  return p
}
afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('inventory identities and evidence', () => {
  it('classifies only substantiated types and supplies icon hints', () => {
    expect(
      classify({ oid: '.1.3.6.1.4.1.14823.1.2.102', description: 'AOS-8 (MODEL: 535)' }, false),
    ).toMatchObject({ type: DeviceType.AccessPoint, model: 'aruba-ap-535' })
    expect(classify({ provider: 'kentik-switch', name: 'ap99' }, false)).toBeUndefined()
    expect(
      classify({ oid: '.1.3.6.1.4.1.207.1', description: 'Allied Telesis' }, false)?.icon,
    ).toBeTruthy()
    expect(classify({}, true)?.type).toBe(DeviceType.Server)
  })
  it('replaces old interface indices but preserves distinct ports sharing a MAC', () => {
    const p = interfaces(
      [
        { name: 'eth0', index: 1, seen: now - 1000, mac: 'aa:bb:cc:dd:ee:ff' },
        { name: 'eth0', index: 2, seen: now, mac: 'aa:bb:cc:dd:ee:ff' },
        { name: 'br0', index: 3, seen: now, mac: 'aa:bb:cc:dd:ee:ff' },
      ],
      false,
    )
    expect(p).toHaveLength(2)
    expect(p[0]?.index).toBe(2)
    expect(p.every((x) => !x.port.identity?.mac)).toBe(true)
    expect(p[0]?.port.provenance?.observedAt).toBe(now)
  })
  it('keeps ambiguous devices separate without shared merge keys', () => {
    const inv = normalizeDevices(
      ['a', 'b'].map((id) => ({
        id,
        guid: id,
        name: 'duplicate',
        ip: '192.0.2.1',
        sysName: 'same',
      })),
      new Map(),
      now,
    )
    expect(inv.devices).toHaveLength(2)
    expect(inv.devices.every((d) => !d.host.identity?.mgmtIp && !d.host.identity?.sysName)).toBe(
      true,
    )
    expect(inv.warnings).toHaveLength(2)
  })
  it('suppresses profile aliases only with matching collector and nonoverlapping epochs', () => {
    const old = { id: 'old', name: 'r', ip: '192.0.2.1', collector: 'c', seen: 10 }
    const current = {
      id: 'new',
      name: 'r',
      sysName: 'r',
      ip: '192.0.2.1',
      collector: 'c',
      firstSeen: 11,
      seen: 20,
      oid: 'oid',
    }
    expect(selectCurrentEntities([old, current])).toEqual([current])
    expect(selectCurrentEntities([old, { ...current, firstSeen: 9 }])).toHaveLength(2)
    expect(selectCurrentEntities([old, { ...current, collector: 'other' }])).toHaveLength(2)
    expect(selectCurrentEntities([{ ...old, collector: undefined }, current])).toHaveLength(2)
  })
})

describe('collection health and rates', () => {
  it('does not equate GOOD heartbeat or zero uptime with device health', () => {
    expect(nodeMetrics({ health: 'GOOD', healthSeen: now }, now)).toMatchObject({
      status: 'unknown',
      monitoring: 'pending',
    })
    expect(nodeMetrics({ health: 'GOOD', healthSeen: now, usableSeen: now }, now).monitoring).toBe(
      'healthy',
    )
    expect(
      nodeMetrics({ health: 'BAD', healthSeen: now, reason: 'Poll Timeout' }, now).monitoring,
    ).toBe('failing')
    expect(
      nodeMetrics({ health: 'GOOD', healthSeen: now - 600000, usableSeen: now }, now).monitoring,
    ).toBe('pending')
  })
  it('retains zero, converts speed units and rejects stale samples independently', () => {
    const r = {
      oper: 'up',
      stateSeen: now,
      inSeen: now,
      outSeen: now,
      inBps: 100e6,
      outBps: 0,
      speed: 1000,
    }
    expect(linkMetrics(r, now)).toEqual({
      status: 'up',
      inBps: 100e6,
      outBps: 0,
      inUtilization: 10,
      outUtilization: 0,
    })
    expect(linkMetrics(r, now, 200e6).inUtilization).toBe(50)
    expect(linkMetrics({ ...r, inSeen: now - 600000 }, now).inBps).toBeUndefined()
    expect(linkMetrics({ ...r, stateSeen: now - 600000 }, now)).toEqual({ status: 'unknown' })
  })
})

function neighborFixture() {
  return normalizeDevices(
    ['a', 'b', 'c'].map((id) => ({ id, guid: id, name: id, sysName: id })),
    new Map(['a', 'b', 'c'].map((id) => [id, [{ name: 'eth0', seen: now, speed: 1000 }]])),
    now,
  ).devices
}
const neighbor = {
  guid: 'a',
  localName: 'eth0',
  remoteName: 'b',
  remotePort: 'eth0',
  remotePortSubtype: 'interfaceName',
  seen: now,
}
describe('physical neighbor resolution', () => {
  it('resolves endpoints, bandwidth and reciprocal deduplication', () => {
    const r = resolveNeighbors(
      neighborFixture(),
      [neighbor, { ...neighbor, guid: 'b', remoteName: 'a' }],
      now,
    )
    expect(r.links).toHaveLength(1)
    expect(r.links[0]).toMatchObject({
      from: { node: 'a', port: 'eth0' },
      to: { node: 'b', port: 'eth0' },
      bandwidth: 1e9,
    })
    expect(r.adjacencies).toHaveLength(2)
  })
  it.each([
    { localName: undefined },
    { remotePortSubtype: 'local' },
    { seen: now - 7200001 },
    { remoteName: 'missing' },
    { remotePort: '22' },
  ])('omits unresolved or stale evidence %j', (override) => {
    const r = resolveNeighbors(neighborFixture(), [{ ...neighbor, ...override }], now)
    expect(r.links).toHaveLength(0)
    expect(r.warnings.length).toBeGreaterThan(0)
  })
  it('rejects conflicting cables', () => {
    expect(
      resolveNeighbors(neighborFixture(), [neighbor, { ...neighbor, remoteName: 'c' }], now).links,
    ).toHaveLength(0)
  })
})

describe('real transport shape and lifecycle', () => {
  it('fetches a native topology with ports, caches hosts and refreshes on sync', async () => {
    const f = api()
    const p = setup(f)
    const graph = await p.fetchTopology()
    expect(graph.nodes).toHaveLength(1)
    expect(graph.nodes[0]?.ports).toHaveLength(1)
    expect(graph.links).toEqual([])
    expect(graph.nodes[0]?.metadata?.['sourceDiagnostics']).toContain(
      'No LLDP neighbor observations; physical links cannot be determined',
    )
    const calls = f.mock.calls.length
    await p.getHosts()
    expect(f.mock.calls.length).toBe(calls)
    expect((await p.getHostItems('g')).map((x) => x.id)).toEqual(['eth0:in', 'eth0:out'])
    await p.fetchTopology()
    expect(f.mock.calls.length).toBeGreaterThan(calls)
  })
  it('fails required adjacency without returning a replacement empty graph', async () => {
    const p = setup()
    p.initialize({ ...config, neighborMode: 'required' })
    await expect(p.fetchTopology()).rejects.toThrow('No LLDP')
  })
  it('joins LLDP local table indices explicitly, rather than treating them as ifIndex', async () => {
    const p = setup(
      api((q) =>
        q.includes('lldpRemSysName')
          ? [
              {
                guid: 'g',
                facet: ['g', '0.99.1'],
                remoteName: 'missing',
                remotePort: 'eth0',
                remotePortSubtype: 'interfaceName',
                seen: now,
              },
            ]
          : q.includes('lldpLocPortId')
            ? [{ guid: 'g', facet: ['g', '99'], name: 'eth0', subtype: 'interfaceName', seen: now }]
            : undefined,
      ),
    )
    vi.spyOn(Date, 'now').mockReturnValue(now)
    const g = await p.fetchTopology()
    expect(g.nodes[0]?.metadata?.['sourceDiagnostics']).toContain(
      'Unresolved neighbor for router/eth0',
    )
    vi.restoreAllMocks()
  })
  it('shares concurrent inventory calls and rejects calls after dispose', async () => {
    const f = api()
    const p = setup(f)
    await Promise.all([p.getHosts(), p.getHosts(), p.getHosts()])
    expect(
      f.mock.calls.filter(([, init]) => String(init.body).includes('AS descriptionSeen')),
    ).toHaveLength(1)
    p.dispose()
    await expect(p.getHosts()).rejects.toThrow('not initialized')
  })
  it.each(['US', 'EU', 'JP'] as const)('uses only configured region %s', async (region) => {
    const f = api()
    const p = setup(f)
    p.initialize({ ...config, region })
    await p.testConnection()
    expect(f.mock.calls[0]?.[0]).toBe(
      region === 'US'
        ? 'https://api.newrelic.com/graphql'
        : `https://api.${region.toLowerCase()}.newrelic.com/graphql`,
    )
  })
  it('rejects truncated results and partial GraphQL errors without exposing credentials', async () => {
    const p = setup(api(() => Array.from({ length: 5000 }, (_, i) => ({ facet: String(i) }))))
    await expect(p.getHosts()).rejects.toThrow('5000-result limit')
    const f = vi
      .fn()
      .mockResolvedValue(
        response({ errors: [{ message: 'test-secret' }], data: { actor: { account: {} } } }),
      )
    vi.stubGlobal('fetch', f)
    const c = new NewRelicClient(config)
    const result = await c.testConnection()
    expect(result.success).toBe(false)
    expect(result.message).not.toContain('test-secret')
  })
  it('retries only bounded transient failures', async () => {
    const f = vi.fn().mockResolvedValue(new Response('', { status: 503 }))
    vi.stubGlobal('fetch', f)
    expect((await new NewRelicClient(config).testConnection()).success).toBe(false)
    expect(f).toHaveBeenCalledTimes(3)
  })
  it('batches monitoring queries independently of node IDs', async () => {
    const f = api((q) =>
      q.includes('AS healthSeen')
        ? [{ facet: 'g', health: 'GOOD', healthSeen: Date.now(), usableSeen: Date.now() }]
        : undefined,
    )
    const p = setup(f)
    const result = await p.pollMetrics({
      nodes: { opaque: { hostId: 'g' }, other: { hostId: 'h' } },
      links: {},
    })
    expect(result.nodes['opaque']?.monitoring).toBe('healthy')
    expect(result.nodes['other']?.monitoring).toBe('pending')
    expect(f).toHaveBeenCalledTimes(1)
  })
  it('keeps device and interface detail queries separate and labels observation times', async () => {
    const p = setup(
      api((q) =>
        q.includes('keyset()')
          ? [{ key: 'customValue' }]
          : q.includes('AS value0')
            ? [
                {
                  value0: 'online',
                  seen0: Date.now(),
                  facet: q.includes('FACET') ? 'eth0' : undefined,
                },
              ]
            : undefined,
      ),
    )
    const values = await p.discoverMetrics('g')
    expect(values.some((v) => v.value === 'online' && v.labels?.['scope'] === 'device')).toBe(true)
    expect(values.some((v) => v.value === 'online' && v.labels?.['interfaceName'] === 'eth0')).toBe(
      true,
    )
  })
  it('validates configuration and advertises only implemented capabilities', () => {
    const p = new NewRelicPlugin()
    expect(() => p.initialize({ ...config, accountId: 1.5 })).toThrow()
    expect(() => p.initialize({ ...config, snmpFreshnessSeconds: 0 })).toThrow()
    const registerDescriptor = vi.fn()
    register({ registerDescriptor } as unknown as Parameters<typeof register>[0])
    expect(registerDescriptor.mock.calls[0]?.[0]).toMatchObject({
      capabilities: ['topology', 'hosts', 'metrics', 'alerts'],
      configSchema: { properties: { apiKey: { secret: true } } },
    })
  })
})

it('builds a cable end to end from inventory and explicit local LLDP mappings', async () => {
  vi.spyOn(Date, 'now').mockReturnValue(now)
  const p = setup(
    api((q) => {
      if (q.includes('AS descriptionSeen'))
        return ['g', 'h'].map((guid) => ({ facet: guid, name: guid, sysName: guid, seen: now }))
      if (q.includes('AS alias'))
        return ['g', 'h'].map((guid) => ({
          facet: [guid, 'eth0'],
          name: 'eth0',
          index: 4,
          speed: 1000,
          seen: now,
        }))
      if (q.includes('lldpRemPortId'))
        return [
          {
            guid: 'g',
            facet: ['g', '0.99.1'],
            remoteName: 'h',
            remotePort: 'eth0',
            remotePortSubtype: 'interfaceName',
            seen: now,
          },
        ]
      if (q.includes('lldpLocPortId'))
        return [
          { guid: 'g', facet: ['g', '99'], name: 'eth0', subtype: 'interfaceName', seen: now },
        ]
      return undefined
    }),
  )
  expect((await p.fetchTopology()).links).toHaveLength(1)
  expect((await p.getInterfaceNeighbors('g'))[0]?.localInterface).toBe('eth0')
  vi.restoreAllMocks()
})

it('bounds concurrent queries and aborts the client lifecycle', async () => {
  let active = 0
  let peak = 0
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      active++
      peak = Math.max(peak, active)
      await new Promise<void>((resolve) => setTimeout(resolve, 5))
      active--
      return response({ data: { actor: { account: { name: 'ok' } } } })
    }),
  )
  const c = new NewRelicClient(config)
  await Promise.all(Array.from({ length: 8 }, () => c.testConnection()))
  expect(peak).toBe(2)
  c.dispose()
  expect((await c.testConnection()).success).toBe(false)
})
