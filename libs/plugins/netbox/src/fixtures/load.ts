/**
 * Test support: the responses recorded from the seeded `fictional-corp` NetBox
 * (`live/README.md`), as the lists the converter reads and as a `fetch` that answers the
 * client's calls from them.
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { emptyNetBoxData, type NetBoxData } from '../types.js'

const DIR = join(dirname(fileURLToPath(import.meta.url)), 'fictional-corp')

/** The recorded list for `<app>/<endpoint>`, e.g. `dcim/devices`. */
export function recorded(endpoint: string): unknown[] {
  const file = join(DIR, `${endpoint.replace('/', '-')}.json`)
  const page = JSON.parse(readFileSync(file, 'utf8')) as { results: unknown[] }
  return page.results
}

/** The fixture key for each field of {@link NetBoxData}. */
const ENDPOINTS: Record<keyof NetBoxData, string> = {
  devices: 'dcim/devices',
  interfaces: 'dcim/interfaces',
  cables: 'dcim/cables',
  sites: 'dcim/sites',
  locations: 'dcim/locations',
  virtualChassis: 'dcim/virtual-chassis',
  clusters: 'virtualization/clusters',
  virtualMachines: 'virtualization/virtual-machines',
  vmInterfaces: 'virtualization/interfaces',
  vlans: 'ipam/vlans',
  vrfs: 'ipam/vrfs',
  prefixes: 'ipam/prefixes',
  ipAddresses: 'ipam/ip-addresses',
  asns: 'ipam/asns',
  fhrpGroups: 'ipam/fhrp-groups',
  fhrpAssignments: 'ipam/fhrp-group-assignments',
  providers: 'circuits/providers',
  providerNetworks: 'circuits/provider-networks',
  circuits: 'circuits/circuits',
  circuitTerminations: 'circuits/circuit-terminations',
  virtualCircuits: 'circuits/virtual-circuits',
  virtualCircuitTerminations: 'circuits/virtual-circuit-terminations',
  tunnelGroups: 'vpn/tunnel-groups',
  tunnels: 'vpn/tunnels',
  tunnelTerminations: 'vpn/tunnel-terminations',
  l2vpns: 'vpn/l2vpns',
  l2vpnTerminations: 'vpn/l2vpn-terminations',
  wirelessLinks: 'wireless/wireless-links',
}

/** Everything recorded, as the converter's input. A deep copy: tests may change it freely. */
export function fictionalCorp(): NetBoxData {
  const data: Record<string, unknown> = { ...emptyNetBoxData() }
  for (const [key, endpoint] of Object.entries(ENDPOINTS)) data[key] = recorded(endpoint)
  return data as unknown as NetBoxData
}

/**
 * A `fetch` that answers `GET /api/<app>/<endpoint>/` with the recorded list, whatever the
 * filters, and records what was asked. Endpoints with no recording answer 404.
 */
export function fixtureFetch(requests: URL[] = []): typeof fetch {
  return async (input) => {
    const url = new URL(
      typeof input === 'string' ? input : input instanceof URL ? input.href : input.url,
    )
    requests.push(url)
    const endpoint = url.pathname.replace(/^\/api\//, '').replace(/\/$/, '')
    let results: unknown[]
    try {
      results = recorded(endpoint)
    } catch {
      return new Response('{"detail":"Not found."}', { status: 404 })
    }
    return Response.json({ count: results.length, next: null, previous: null, results })
  }
}
