import type { MetricsMapping } from '@shumoku/core'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ZabbixPlugin } from './plugin.js'

/**
 * pollMetrics is the hot path — it runs every poll cycle for every attached
 * topology. These tests pin the API-call budget the batching + itemid cache
 * are meant to deliver:
 *
 *  - cycle 1 (cold): ONE bulk `item.get` search to resolve interface→itemid
 *    for every host, then ONE `item.get` for the values of all links' items.
 *  - cycle 2 (warm): ZERO resolution calls (cache hit) and still ONE value call.
 *  - a cached itemid the value fetch stops returning is evicted, so the host
 *    re-resolves on the following cycle.
 *
 * We intercept the private `apiRequest` (the single JSON-RPC chokepoint) and
 * classify calls by shape: an `item.get` with `search` is a resolution, one
 * with `itemids` is a value fetch. Node-health calls (`host.get` + an
 * `item.get` with neither) are left to return empty and are not counted.
 */

interface FakeItem {
  itemid: string
  hostid: string
  name: string
  key_: string
  lastvalue: string
  lastclock: string
}

function mkTraffic(itemid: string, hostid: string, key: string, name: string): FakeItem {
  return { itemid, hostid, key_: key, name, lastvalue: '', lastclock: '' }
}

// hostid → its traffic items (Agent-style `net.if.{in,out}[<if>]` keys).
const TRAFFIC_ITEMS: Record<string, FakeItem[]> = {
  '10': [
    mkTraffic('100', '10', 'net.if.in[eth0]', 'Interface eth0: Bits received'),
    mkTraffic('101', '10', 'net.if.out[eth0]', 'Interface eth0: Bits sent'),
  ],
  '20': [
    mkTraffic('200', '20', 'net.if.in[eth1]', 'Interface eth1: Bits received'),
    mkTraffic('201', '20', 'net.if.out[eth1]', 'Interface eth1: Bits sent'),
  ],
}

// itemid → its current value + owning host, for the value `item.get`.
const VALUES: Record<string, { hostid: string; lastvalue: string }> = {
  '100': { hostid: '10', lastvalue: '100000000' }, // 100 Mbps in on 1G link → 10%
  '101': { hostid: '10', lastvalue: '50000000' }, //   50 Mbps out            →  5%
  '200': { hostid: '20', lastvalue: '0' },
  '201': { hostid: '20', lastvalue: '0' },
}

// Freshness window is 300s; a clock at "now" is always fresh within a test run.
const NOW_CLOCK = String(Math.floor(Date.now() / 1000))

const MAPPING: MetricsMapping = {
  nodes: {
    nodeA: { hostId: '10' },
    nodeB: { hostId: '20' },
  },
  links: {
    linkA: { monitoredNodeId: 'nodeA', interface: 'eth0', bandwidth: 1_000_000_000 },
    linkB: { monitoredNodeId: 'nodeB', interface: 'eth1', bandwidth: 1_000_000_000 },
  },
}

describe('ZabbixPlugin.pollMetrics link batching + itemid cache', () => {
  let plugin: ZabbixPlugin
  let apiRequest: ReturnType<typeof vi.fn>
  // Item ids the value fetch should pretend no longer exist (simulates a
  // deleted/disabled item), driving the self-heal eviction test.
  let missingItemIds: Set<string>

  beforeEach(() => {
    missingItemIds = new Set<string>()
    apiRequest = vi.fn(async (method: string, params: Record<string, unknown> = {}) => {
      if (method === 'item.get') {
        if (Array.isArray(params.itemids)) {
          // Value fetch: return each requested item unless it's been "deleted".
          const out: FakeItem[] = []
          for (const id of params.itemids as string[]) {
            if (missingItemIds.has(id)) continue
            const v = VALUES[id]
            if (!v) continue
            out.push({
              itemid: id,
              hostid: v.hostid,
              name: '',
              key_: '',
              lastvalue: v.lastvalue,
              lastclock: NOW_CLOCK,
            })
          }
          return out
        }
        if (params.search) {
          // Resolution search: traffic items for exactly the requested hosts.
          const out: FakeItem[] = []
          for (const h of (params.hostids as string[]) ?? []) {
            const items = TRAFFIC_ITEMS[h]
            if (items) out.push(...items)
          }
          return out
        }
        // Node-health item.get (hostids + filter, no search/itemids).
        return []
      }
      // host.get (node-health meta) and anything else.
      return []
    })

    plugin = new ZabbixPlugin()
    plugin.initialize({ url: 'http://zabbix.test', token: 'tok' })
    // Replace the single JSON-RPC chokepoint with the fake. An own property
    // shadows the prototype method, so every internal `this.apiRequest(...)`
    // routes here.
    ;(plugin as unknown as { apiRequest: typeof apiRequest }).apiRequest = apiRequest
  })

  /** `item.get` calls that carry a `search` param — interface resolutions. */
  const resolutionCalls = () =>
    apiRequest.mock.calls.filter(
      (args) => args[0] === 'item.get' && !!args[1] && 'search' in args[1],
    )

  /** `item.get` calls that carry `itemids` — value fetches. */
  const valueCalls = () =>
    apiRequest.mock.calls.filter(
      (args) => args[0] === 'item.get' && !!args[1] && 'itemids' in args[1],
    )

  it('cold cycle: one bulk resolution + one value fetch, correct utilization', async () => {
    const data = await plugin.pollMetrics(MAPPING)

    // Both hosts fit one batch → a single resolution search, a single value get.
    expect(resolutionCalls()).toHaveLength(1)
    expect(valueCalls()).toHaveLength(1)

    expect(data.links.linkA).toEqual({
      status: 'up',
      utilization: 10,
      inUtilization: 10,
      outUtilization: 5,
      inBps: 100_000_000,
      outBps: 50_000_000,
    })
    // Fresh but idle link → explicit `unknown` with zeroed utilization.
    expect(data.links.linkB).toEqual({
      status: 'unknown',
      utilization: 0,
      inUtilization: 0,
      outUtilization: 0,
      inBps: 0,
      outBps: 0,
    })
  })

  it('warm cycle: zero resolution calls, exactly one value call, identical values', async () => {
    const first = await plugin.pollMetrics(MAPPING)

    apiRequest.mockClear()
    const second = await plugin.pollMetrics(MAPPING)

    expect(resolutionCalls()).toHaveLength(0) // served entirely from the cache
    expect(valueCalls()).toHaveLength(1)
    expect(second.links).toEqual(first.links) // semantics unchanged cycle-to-cycle
  })

  it('evicts a vanished cached itemid and re-resolves that host next cycle', async () => {
    await plugin.pollMetrics(MAPPING) // warm the cache (1 resolution)

    // Item 100 (host 10, eth0 in) disappears from Zabbix.
    missingItemIds.add('100')
    apiRequest.mockClear()
    await plugin.pollMetrics(MAPPING)
    // The ids still came from cache this cycle, so no resolution yet — but the
    // missing id must have triggered an eviction of the `10|eth0` entry.
    expect(resolutionCalls()).toHaveLength(0)
    expect(valueCalls()).toHaveLength(1)

    // Item comes back. Only host 10 was evicted, so exactly one host re-resolves.
    missingItemIds.delete('100')
    apiRequest.mockClear()
    const healed = await plugin.pollMetrics(MAPPING)
    expect(resolutionCalls()).toHaveLength(1)
    expect(valueCalls()).toHaveLength(1)
    // ...and linkA is whole again with the same utilization as the cold cycle.
    expect(healed.links.linkA).toEqual({
      status: 'up',
      utilization: 10,
      inUtilization: 10,
      outUtilization: 5,
      inBps: 100_000_000,
      outBps: 50_000_000,
    })
  })

  it('caches directly-stored item ids are not needed — resolves purely by cache key', async () => {
    // A second warm poll must not re-hit resolution even as new link entries
    // referencing an already-resolved host+interface appear.
    await plugin.pollMetrics(MAPPING)
    apiRequest.mockClear()

    const extended: MetricsMapping = {
      nodes: MAPPING.nodes,
      links: {
        ...MAPPING.links,
        // Same host+interface as linkA → should resolve from cache, no new call.
        linkC: { monitoredNodeId: 'nodeA', interface: 'eth0', bandwidth: 1_000_000_000 },
      },
    }
    const data = await plugin.pollMetrics(extended)
    expect(resolutionCalls()).toHaveLength(0)
    expect(valueCalls()).toHaveLength(1)
    expect(data.links.linkC).toEqual(data.links.linkA)
  })
})
