/**
 * Records the REST responses of a seeded NetBox as test fixtures for the Shumoku NetBox plugin.
 *
 * Every endpoint the mapping design (`docs/plugins/netbox-mapping.md`, "REST calls") and the
 * current client (`src/client.ts`) read is fetched in full (`limit=1000`, following `next`) and
 * written to `src/fixtures/fictional-corp/<app>-<endpoint>.json` as
 * `{ count, next: null, previous: null, results }`. Volatile fields (`created`, `last_updated`,
 * `url`, `display_url`) are dropped so the files stay stable; ids are kept.
 *
 *   NETBOX_URL=http://127.0.0.1:8001 NETBOX_TOKEN=... bun libs/plugins/netbox/live/record.ts
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const BASE = (process.env.NETBOX_URL ?? '').replace(/\/$/, '')
const TOKEN = process.env.NETBOX_TOKEN ?? ''
if (!BASE || !TOKEN) {
  console.error('Set NETBOX_URL and NETBOX_TOKEN')
  process.exit(1)
}

const ENDPOINTS = [
  'dcim/devices',
  'dcim/interfaces',
  'dcim/cables',
  'dcim/sites',
  'dcim/locations',
  'dcim/virtual-chassis',
  'dcim/device-roles',
  'extras/tags',
  'virtualization/clusters',
  'virtualization/cluster-types',
  'virtualization/virtual-machines',
  'virtualization/interfaces',
  'ipam/prefixes',
  'ipam/ip-addresses',
  'ipam/vlans',
  'ipam/vrfs',
  'ipam/asns',
  'ipam/fhrp-groups',
  'ipam/fhrp-group-assignments',
  'circuits/circuits',
  'circuits/circuit-terminations',
  'circuits/providers',
  'circuits/provider-networks',
  'circuits/virtual-circuits',
  'circuits/virtual-circuit-terminations',
  'vpn/tunnels',
  'vpn/tunnel-groups',
  'vpn/tunnel-terminations',
  'vpn/l2vpns',
  'vpn/l2vpn-terminations',
  'wireless/wireless-links',
]

const VOLATILE = new Set(['created', 'last_updated', 'url', 'display_url'])

function strip(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(strip)
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) {
      if (!VOLATILE.has(k)) out[k] = strip(v)
    }
    return out
  }
  return value
}

async function getAll(endpoint: string): Promise<unknown[]> {
  const results: unknown[] = []
  let next: string | null = `${BASE}/api/${endpoint}/?limit=1000`
  while (next) {
    const res: Response = await fetch(next, {
      headers: { Authorization: `Bearer ${TOKEN}`, Accept: 'application/json' },
    })
    if (!res.ok)
      throw new Error(`GET ${endpoint} -> ${res.status}: ${(await res.text()).slice(0, 300)}`)
    const page = (await res.json()) as { results: unknown[]; next: string | null }
    results.push(...page.results)
    // `next` is built from the server's own idea of its host; keep the origin we were given.
    next = page.next ? `${BASE}${new URL(page.next).pathname}${new URL(page.next).search}` : null
  }
  return results
}

const outDir = join(dirname(fileURLToPath(import.meta.url)), '../src/fixtures/fictional-corp')
await mkdir(outDir, { recursive: true })

for (const endpoint of ENDPOINTS) {
  const results = (await getAll(endpoint)).map(strip)
  const file = `${endpoint.replace('/', '-')}.json`
  const body = { count: results.length, next: null, previous: null, results }
  await writeFile(join(outDir, file), `${JSON.stringify(body, null, 2)}\n`)
  console.log(`${String(results.length).padStart(4)}  ${file}`)
}
