import { afterEach, describe, expect, it, vi } from 'vitest'
import { NetBoxClient, resolveNetboxAuth } from './client.js'
import { convertToSourceNetwork } from './converter.js'
import { fictionalCorp, fixtureFetch } from './fixtures/load.js'

// Synthetic fixtures with the documented v1/v2 shapes, never live credentials.
const V1 = 'a'.repeat(40)
const V2 = `nbt_testkey.${'b'.repeat(40)}`

describe('resolveNetboxAuth', () => {
  it('uses the Token scheme for a bare v1 token', () => {
    expect(resolveNetboxAuth(V1)).toEqual({ token: V1, scheme: 'Token' })
  })

  it('uses the Bearer scheme for a v2 token (nbt_<id>.<secret>)', () => {
    expect(resolveNetboxAuth(V2)).toEqual({ token: V2, scheme: 'Bearer' })
  })

  it('strips a copied "Token " prefix (NetBox UI example usage)', () => {
    expect(resolveNetboxAuth(`Token ${V1}`)).toEqual({ token: V1, scheme: 'Token' })
  })

  it('strips a copied "Bearer " prefix for a v2 token', () => {
    expect(resolveNetboxAuth(`Bearer ${V2}`)).toEqual({ token: V2, scheme: 'Bearer' })
  })

  it('is case-insensitive about the pasted scheme', () => {
    expect(resolveNetboxAuth(`token ${V1}`)).toEqual({ token: V1, scheme: 'Token' })
  })

  it('self-corrects a wrongly-copied scheme by re-detecting from the credential', () => {
    // "Token nbt_…" (wrong scheme copied) → strip → detect v2 → Bearer
    expect(resolveNetboxAuth(`Token ${V2}`).scheme).toBe('Bearer')
  })

  it('treats nbt_ without a dot as v1 (Token)', () => {
    expect(resolveNetboxAuth('nbt_nodotsuffix')).toEqual({
      token: 'nbt_nodotsuffix',
      scheme: 'Token',
    })
  })

  it('trims surrounding whitespace', () => {
    expect(resolveNetboxAuth('  abc123  ')).toEqual({ token: 'abc123', scheme: 'Token' })
  })

  it('handles an empty or undefined token', () => {
    expect(resolveNetboxAuth('')).toEqual({ token: '', scheme: 'Token' })
    expect(resolveNetboxAuth(undefined)).toEqual({ token: '', scheme: 'Token' })
  })
})

describe('NetBoxClient Authorization header', () => {
  afterEach(() => vi.unstubAllGlobals())

  it.each([
    { name: 'bare v1', input: V1, expected: `Token ${V1}` },
    { name: 'pasted v1', input: `Token ${V1}`, expected: `Token ${V1}` },
    { name: 'bare v2', input: V2, expected: `Bearer ${V2}` },
    { name: 'wrong pasted scheme', input: `Token ${V2}`, expected: `Bearer ${V2}` },
  ])('passes the normalized $name header through the shared SDK', async ({ input, expected }) => {
    let authorization: string | null = null
    const fetchMock = vi.fn(async (_url: unknown, init?: RequestInit) => {
      authorization = new Headers(init?.headers).get('Authorization')
      return Response.json({ count: 0, next: null, previous: null, results: [] })
    })
    vi.stubGlobal('fetch', fetchMock)
    const client = new NetBoxClient({ url: 'https://netbox.invalid/api', token: input })
    await expect(client.fetchDevices()).resolves.toEqual([])
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(authorization).toBe(expected)
  })
})

// ---------------------------------------------------------------------------
// The whole fetch, answered from the recorded responses

const OPTIONS = {
  cloudClusterTypes: ['aws'],
  roleTypes: { hypervisor: 'server', 'wireless-bridge': 'access-point', 'vpn-gateway': 'router' },
  groupDepth: 'location' as const,
}

function client(): NetBoxClient {
  return new NetBoxClient({ url: 'https://netbox.invalid', token: V1 })
}

function urlOf(input: Parameters<typeof fetch>[0]): URL {
  return new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
}

describe('NetBoxClient.fetchTopologyData', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('fetches what the converter maps: the same network as the recorded lists give', async () => {
    vi.stubGlobal('fetch', fixtureFetch())
    const data = await client().fetchTopologyData()
    expect(convertToSourceNetwork(data, OPTIONS)).toEqual(
      convertToSourceNetwork(fictionalCorp(), OPTIONS),
    )
  })

  it('asks for the facts the mapping reads, with only the fields it needs', async () => {
    const requests: URL[] = []
    vi.stubGlobal('fetch', fixtureFetch(requests))
    await client().fetchTopologyData()
    const paths = new Set(requests.map((u) => u.pathname))
    for (const path of [
      '/api/dcim/devices/',
      '/api/dcim/interfaces/',
      '/api/dcim/cables/',
      '/api/dcim/sites/',
      '/api/dcim/locations/',
      '/api/dcim/virtual-chassis/',
      '/api/virtualization/clusters/',
      '/api/virtualization/virtual-machines/',
      '/api/virtualization/interfaces/',
      '/api/ipam/vlans/',
      '/api/ipam/vrfs/',
      '/api/ipam/prefixes/',
      '/api/ipam/ip-addresses/',
      '/api/ipam/asns/',
      '/api/ipam/fhrp-groups/',
      '/api/ipam/fhrp-group-assignments/',
      '/api/circuits/providers/',
      '/api/circuits/provider-networks/',
      '/api/circuits/circuits/',
      '/api/circuits/circuit-terminations/',
      '/api/circuits/virtual-circuits/',
      '/api/circuits/virtual-circuit-terminations/',
      '/api/vpn/tunnel-groups/',
      '/api/vpn/tunnels/',
      '/api/vpn/tunnel-terminations/',
      '/api/vpn/l2vpns/',
      '/api/vpn/l2vpn-terminations/',
      '/api/wireless/wireless-links/',
    ]) {
      expect(paths, path).toContain(path)
    }
    for (const url of requests) {
      expect(url.searchParams.get('brief'), url.pathname).toBeNull()
      expect(url.searchParams.get('fields'), url.pathname).toBeTruthy()
    }
    const get = (path: string) => requests.find((u) => u.pathname === path)
    expect(get('/api/dcim/interfaces/')?.searchParams.get('fields')).toContain(
      'connected_endpoints',
    )
    expect(get('/api/ipam/prefixes/')?.searchParams.get('status__n')).toBe('deprecated')
    expect(get('/api/ipam/ip-addresses/')?.searchParams.get('assigned_to_interface')).toBe('true')
  })

  it('reads a cable only for a path that is that one cable', async () => {
    const requests: URL[] = []
    vi.stubGlobal('fetch', fixtureFetch(requests))
    await client().fetchTopologyData()
    const cables = requests.filter((u) => u.pathname === '/api/dcim/cables/')
    // Cables 1-8 join interface to interface; 9-15 end at a circuit or a patch panel.
    const asked = cables.flatMap((u) => u.searchParams.getAll('id')).map(Number)
    expect(asked.sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
  })

  it('narrows interfaces to the fetched devices when a filter is set', async () => {
    const requests: URL[] = []
    vi.stubGlobal('fetch', fixtureFetch(requests))
    await client().fetchTopologyData({ site: ['hq'], excludeRole: ['patch-panel'] })
    const devices = requests.find((u) => u.pathname === '/api/dcim/devices/')
    expect(devices?.searchParams.getAll('site')).toEqual(['hq'])
    expect(devices?.searchParams.getAll('role__n')).toEqual(['patch-panel'])
    const interfaces = requests.find((u) => u.pathname === '/api/dcim/interfaces/')
    expect(interfaces?.searchParams.getAll('device_id')).toHaveLength(12)
    expect(interfaces?.searchParams.get('site')).toBeNull()
  })

  it('does not filter by status, so a device left out is known to be left out', async () => {
    const requests: URL[] = []
    vi.stubGlobal('fetch', fixtureFetch(requests))
    await client().fetchTopologyData()
    for (const url of requests) expect(url.searchParams.get('status'), url.pathname).toBeNull()
  })

  it('drops a family the instance lacks, once, and goes on', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const base = fixtureFetch()
    vi.stubGlobal('fetch', async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
      const { pathname } = urlOf(input)
      if (pathname.startsWith('/api/vpn/') || pathname.startsWith('/api/wireless/')) {
        return new Response('{"detail":"Not found."}', { status: 404 })
      }
      if (pathname.startsWith('/api/circuits/')) {
        return new Response('{"detail":"forbidden"}', { status: 403 })
      }
      return base(input, init)
    })
    const data = await client().fetchTopologyData()
    expect(data.tunnels).toEqual([])
    expect(data.wirelessLinks).toEqual([])
    expect(data.circuits).toEqual([])
    expect(data.devices.length).toBeGreaterThan(0)
    const source = convertToSourceNetwork(data, OPTIONS)
    expect(source.network.nodes.some((n) => n.id === 'hq-rt1')).toBe(true)
    expect(source.network.nodes.some((n) => n.type === 'external')).toBe(false)
    // Each family is reported once.
    const reported = warn.mock.calls.map((c) => String(c[0]))
    expect(reported.length).toBeGreaterThan(0)
    expect(new Set(reported).size).toBe(reported.length)
  })

  it('fails when a family fails for another reason', async () => {
    const base = fixtureFetch()
    vi.stubGlobal('fetch', async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
      if (urlOf(input).pathname === '/api/vpn/tunnels/')
        return new Response('boom', { status: 500 })
      return base(input, init)
    })
    await expect(client().fetchTopologyData()).rejects.toThrow(/500/)
  })

  it('fails when devices cannot be read', async () => {
    vi.stubGlobal('fetch', async () => new Response('no', { status: 403 }))
    await expect(client().fetchTopologyData()).rejects.toThrow(/403/)
  })
})
