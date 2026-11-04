/**
 * Seeds a throwaway NetBox (4.2+) with the fictional `fictional-corp` dataset described in
 * `docs/plugins/netbox-mapping.md` ("Test dataset: fictional-corp"), through the REST API only.
 *
 * Idempotent: every object is looked up by its natural key (slug, name, cid, ...) and created
 * only when missing, so re-running changes nothing.
 *
 *   NETBOX_URL=http://127.0.0.1:8001 NETBOX_TOKEN=... bun libs/plugins/netbox/live/seed.ts
 *
 * Deviations from the spec are marked `DEVIATION` below and listed in README.md.
 */

const BASE = (process.env.NETBOX_URL ?? '').replace(/\/$/, '')
const TOKEN = process.env.NETBOX_TOKEN ?? ''
if (!BASE || !TOKEN) {
  console.error('Set NETBOX_URL and NETBOX_TOKEN')
  process.exit(1)
}

type Json = Record<string, unknown>
type Query = Record<string, string | number>
type Ref = { type: string; id: number }

async function call(method: string, path: string, body?: Json): Promise<unknown> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${text.slice(0, 800)}`)
  return text ? JSON.parse(text) : null
}

function qs(query: Query): string {
  return new URLSearchParams(Object.entries(query).map(([k, v]) => [k, String(v)])).toString()
}

function asObj(v: unknown): Json {
  return (v ?? {}) as Json
}

let created = 0
let existing = 0

/** Look up by `query`; POST `body` when nothing matches. Returns the object's id. */
async function id(path: string, query: Query, body: Json): Promise<number> {
  const found = asObj(await call('GET', `${path}?${qs(query)}`))
  const results = (found.results ?? []) as Json[]
  const first = results[0]
  if (first) {
    existing++
    return first.id as number
  }
  const made = asObj(await call('POST', path, body))
  created++
  return made.id as number
}

function bySlug(path: string, slug: string, body: Json): Promise<number> {
  return id(path, { slug }, { slug, ...body })
}

function byName(path: string, name: string, body: Json = {}): Promise<number> {
  return id(path, { name }, { name, ...body })
}

async function patch(path: string, objId: number, body: Json): Promise<void> {
  await call('PATCH', `${path}${objId}/`, body)
}

// --------------------------------------------------------------------------
// Reference data
// --------------------------------------------------------------------------

const mfr: Record<string, number> = {}
for (const [slug, name] of [
  ['juniper', 'Juniper'],
  ['fortinet', 'Fortinet'],
  ['dell', 'Dell'],
  ['ubiquiti', 'Ubiquiti'],
  ['generic', 'Generic'],
] as [string, string][]) {
  mfr[slug] = await bySlug('/api/dcim/manufacturers/', slug, { name })
}

const dtype: Record<string, number> = {}
for (const [m, slug, height] of [
  ['juniper', 'mx204', 1],
  ['juniper', 'ex4400-48p', 1],
  ['juniper', 'srx300', 1],
  ['fortinet', 'fortigate-100f', 1],
  ['dell', 'poweredge-r760', 2],
  ['ubiquiti', 'airfiber-60', 0],
  ['generic', 'patch-panel-1u', 1],
] as [string, string, number][]) {
  dtype[slug] = await id(
    '/api/dcim/device-types/',
    { slug },
    { manufacturer: mfr[m], model: slug, slug, u_height: height },
  )
}

const platform: Record<string, number> = {}
for (const [slug, name] of [
  ['junos', 'Junos 23.4R2'],
  ['fortios', 'FortiOS'],
  ['esxi', 'VMware ESXi 8'],
  ['linux', 'Linux'],
] as [string, string][]) {
  platform[slug] = await bySlug('/api/dcim/platforms/', slug, { name })
}

const role: Record<string, number> = {}
for (const slug of [
  'core-router',
  'firewall',
  'access-switch',
  'hypervisor',
  'wireless-bridge',
  'server',
  'vpn-gateway',
  'patch-panel',
]) {
  role[slug] = await bySlug('/api/dcim/device-roles/', slug, { name: slug, color: '9e9e9e' })
}

// Sites and locations
const hqSiteId = await bySlug('/api/dcim/sites/', 'hq', { name: 'Fictional HQ', status: 'active' })
const brSiteId = await bySlug('/api/dcim/sites/', 'branch', {
  name: 'Branch Osaka',
  status: 'active',
})
const site: Record<string, number> = { hq: hqSiteId, branch: brSiteId }
const loc: Record<string, number> = {}
loc['hq-mdf'] = await bySlug('/api/dcim/locations/', 'hq-mdf', {
  name: 'HQ MDF',
  site: hqSiteId,
  status: 'active',
})
loc['hq-annex'] = await bySlug('/api/dcim/locations/', 'hq-annex', {
  name: 'HQ Annex',
  site: hqSiteId,
  status: 'active',
})

// RIR and ASNs
const rir = await bySlug('/api/ipam/rirs/', 'private', { name: 'private', is_private: true })
const asn: Record<number, number> = {}
for (const n of [64496, 64500, 64501, 64510]) {
  asn[n] = await id('/api/ipam/asns/', { asn: n }, { asn: n, rir })
}
// ASN 64496 belongs to both sites
for (const s of [hqSiteId, brSiteId]) {
  const cur = asObj(await call('GET', `/api/dcim/sites/${s}/`))
  const have = ((cur.asns ?? []) as Json[]).map((a) => a.id as number)
  if (!have.includes(asn[64496] as number)) {
    await patch('/api/dcim/sites/', s, { asns: [...have, asn[64496]] })
  }
}

// VLANs (site hq)
const vlan: Record<number, number> = {}
for (const [vid, name] of [
  [10, 'servers'],
  [20, 'users'],
  [99, 'mgmt'],
] as [number, string][]) {
  vlan[vid] = await id(
    '/api/ipam/vlans/',
    { vid, site_id: hqSiteId },
    { vid, name, site: hqSiteId, status: 'active' },
  )
}

// VRF for the VPC
const vrfVpc = await byName('/api/ipam/vrfs/', 'vpc-0a1b2c3d4e5f60789')

// Prefixes
async function prefix(p: string, extra: Json = {}): Promise<number> {
  const q: Query = extra.vrf ? { vrf_id: extra.vrf as number } : { vrf_id: 'null' }
  return id('/api/ipam/prefixes/', { prefix: p, ...q }, { prefix: p, status: 'active', ...extra })
}
const hqScope = { scope_type: 'dcim.site', scope_id: hqSiteId }
await prefix('10.0.10.0/24', { ...hqScope, vlan: vlan[10] })
await prefix('10.0.20.0/24', { ...hqScope, vlan: vlan[20] })
await prefix('10.0.99.0/24', { ...hqScope, vlan: vlan[99] })
await prefix('203.0.113.0/24', hqScope)
await prefix('192.0.2.0/30')
await prefix('192.0.2.4/30')
await prefix('198.51.100.0/31')
await prefix('198.51.100.2/31')
await prefix('10.100.0.0/16', { vrf: vrfVpc, status: 'container' })
await prefix('10.100.1.0/24', { vrf: vrfVpc, description: 'subnet-a' })
await prefix('10.100.2.0/24', { vrf: vrfVpc, description: 'subnet-b' })

// --------------------------------------------------------------------------
// Devices and interfaces
// --------------------------------------------------------------------------

const dev: Record<string, number> = {}
async function device(
  name: string,
  type: string,
  roleSlug: string,
  siteSlug: string,
  extra: Json = {},
): Promise<void> {
  dev[name] = await id(
    '/api/dcim/devices/',
    { name },
    {
      name,
      device_type: dtype[type],
      role: role[roleSlug],
      site: site[siteSlug],
      status: 'active',
      ...extra,
    },
  )
}
const mdf = { location: loc['hq-mdf'] }
await device('hq-rt1', 'mx204', 'core-router', 'hq', { ...mdf, platform: platform.junos })
await device('hq-fw1', 'fortigate-100f', 'firewall', 'hq', { ...mdf, platform: platform.fortios })
await device('hq-fw2', 'fortigate-100f', 'firewall', 'hq', { ...mdf, platform: platform.fortios })
await device('hq-sw1', 'ex4400-48p', 'access-switch', 'hq', { ...mdf, platform: platform.junos })
await device('hq-sw2', 'ex4400-48p', 'access-switch', 'hq', { ...mdf, platform: platform.junos })
await device('hq-wl1', 'airfiber-60', 'wireless-bridge', 'hq', mdf)
await device('annex-wl1', 'airfiber-60', 'wireless-bridge', 'hq', { location: loc['hq-annex'] })
await device('annex-sw1', 'ex4400-48p', 'access-switch', 'hq', {
  location: loc['hq-annex'],
  platform: platform.junos,
})
await device('br-rt1', 'srx300', 'core-router', 'branch', { platform: platform.junos })
await device('hq-pp1', 'patch-panel-1u', 'patch-panel', 'hq', mdf)

// Virtual chassis hq-vc (master hq-sw1). Must exist before the cross-member LAG.
const vc = await byName('/api/dcim/virtual-chassis/', 'hq-vc')
await patch('/api/dcim/devices/', dev['hq-sw1'] as number, { virtual_chassis: vc, vc_position: 1 })
await patch('/api/dcim/devices/', dev['hq-sw2'] as number, { virtual_chassis: vc, vc_position: 2 })
await patch('/api/dcim/virtual-chassis/', vc, { master: dev['hq-sw1'] })

// Virtualization: cluster types and clusters (before the ESXi hosts join the cluster)
const ctVsphere = await bySlug('/api/virtualization/cluster-types/', 'vmware-vsphere', {
  name: 'VMware vSphere',
})
const ctAws = await bySlug('/api/virtualization/cluster-types/', 'aws', { name: 'AWS' })
const clVsphere = await byName('/api/virtualization/clusters/', 'hq-vsphere', {
  type: ctVsphere,
  status: 'active',
  scope_type: 'dcim.site',
  scope_id: hqSiteId,
})
const clAws = await byName('/api/virtualization/clusters/', 'aws-ap-northeast-1', {
  type: ctAws,
  status: 'active',
})
await device('hq-esx1', 'poweredge-r760', 'hypervisor', 'hq', {
  ...mdf,
  platform: platform.esxi,
  cluster: clVsphere,
})
await device('hq-esx2', 'poweredge-r760', 'hypervisor', 'hq', {
  ...mdf,
  platform: platform.esxi,
  cluster: clVsphere,
})

const iface: Record<string, number> = {} // "device:name" -> id
async function itf(d: string, name: string, type: string, extra: Json = {}): Promise<number> {
  const v = await id(
    '/api/dcim/interfaces/',
    { device_id: dev[d] as number, name },
    { device: dev[d], name, type, ...extra },
  )
  iface[`${d}:${name}`] = v
  return v
}
const dif = (key: string): number => iface[key] as number
const G1 = '1000base-t'
const Q100 = '100gbase-x-qsfp28'
const S10G = 10_000_000
const S1G = 1_000_000
const S100G = 100_000_000

// hq-rt1
await itf('hq-rt1', 'lo0', 'virtual')
await itf('hq-rt1', 'et-0/0/0', Q100, { speed: S10G })
await itf('hq-rt1', 'et-0/0/0.100', 'virtual', { parent: dif('hq-rt1:et-0/0/0') })
await itf('hq-rt1', 'et-0/0/1', Q100, { speed: S10G })
await itf('hq-rt1', 'et-0/0/1.200', 'virtual', { parent: dif('hq-rt1:et-0/0/1') })
await itf('hq-rt1', 'et-0/0/2', Q100)
await itf('hq-rt1', 'et-0/0/3', Q100)
const rtAe0 = await itf('hq-rt1', 'ae0', 'lag', {
  mode: 'tagged',
  untagged_vlan: vlan[99],
  tagged_vlans: [vlan[10], vlan[20]],
})
await itf('hq-rt1', 'et-0/0/4', Q100, { speed: S100G, lag: rtAe0 })
await itf('hq-rt1', 'et-0/0/5', Q100, { speed: S100G, lag: rtAe0 })
await itf('hq-rt1', 'irb.20', 'virtual')

// firewalls
for (const f of ['hq-fw1', 'hq-fw2']) {
  await itf(f, 'port1', G1, { speed: S1G, mode: 'access', untagged_vlan: vlan[10] })
  await itf(f, 'mgmt', G1, { mgmt_only: true })
}
await itf('hq-fw1', 'tunnel.1', 'virtual')
await itf('hq-fw1', 'tunnel.2', 'virtual')

// switches (hq-sw1 / hq-sw2 are virtual-chassis members)
const swAe0 = await itf('hq-sw1', 'ae0', 'lag', {
  mode: 'tagged',
  untagged_vlan: vlan[99],
  tagged_vlans: [vlan[10], vlan[20]],
})
for (const s of ['hq-sw1', 'hq-sw2']) {
  await itf(s, 'et-0/0/48', Q100, { speed: S100G, lag: swAe0 })
  await itf(s, 'ge-0/0/1', G1, { speed: S1G, mode: 'access', untagged_vlan: vlan[10] })
  await itf(s, 'ge-0/0/10', G1, {
    speed: S1G,
    mode: 'tagged',
    untagged_vlan: vlan[99],
    tagged_vlans: [vlan[10], vlan[20]],
  })
}
await itf('hq-sw2', 'ge-0/0/20', G1, { speed: S1G, mode: 'access', untagged_vlan: vlan[99] })
await itf('hq-sw1', 'irb.99', 'virtual')

// hypervisors
for (const e of ['hq-esx1', 'hq-esx2']) {
  await itf(e, 'vmnic0', G1, { speed: S1G })
  await itf(e, 'vmk0', 'virtual')
}

// wireless bridges
await itf('hq-wl1', 'radio0', 'other-wireless', { rf_role: 'ap' })
await itf('annex-wl1', 'radio0', 'other-wireless', { rf_role: 'station' })
await itf('hq-wl1', 'eth0', G1, { speed: S1G })
await itf('annex-wl1', 'eth0', G1, { speed: S1G })
await itf('annex-sw1', 'ge-0/0/1', G1, { speed: S1G })

// branch
await itf('br-rt1', 'lo0', 'virtual')
await itf('br-rt1', 'ge-0/0/0', G1, { speed: S10G })
await itf('br-rt1', 'ge-0/0/0.200', 'virtual', { parent: dif('br-rt1:ge-0/0/0') })
await itf('br-rt1', 'ge-0/0/1', G1, { speed: S1G })
await itf('br-rt1', 'ge-0/0/1.100', 'virtual', { parent: dif('br-rt1:ge-0/0/1') })
await itf('br-rt1', 'irb.20', 'virtual')

// Patch panel ports: front 1 / rear 1
const rear = await id(
  '/api/dcim/rear-ports/',
  { device_id: dev['hq-pp1'] as number, name: 'rear1' },
  { device: dev['hq-pp1'], name: 'rear1', type: 'lc', positions: 1 },
)
const front = await id(
  '/api/dcim/front-ports/',
  { device_id: dev['hq-pp1'] as number, name: 'front1' },
  {
    device: dev['hq-pp1'],
    name: 'front1',
    type: 'lc',
    rear_ports: [{ position: 1, rear_port: rear, rear_port_position: 1 }],
  },
)

// --------------------------------------------------------------------------
// Virtual machines
// --------------------------------------------------------------------------

const vm: Record<string, number> = {}
async function vmachine(name: string, extra: Json): Promise<void> {
  vm[name] = await id(
    '/api/virtualization/virtual-machines/',
    { name },
    { name, status: 'active', ...extra },
  )
}
await vmachine('app01', {
  cluster: clVsphere,
  site: hqSiteId,
  platform: platform.linux,
  role: role.server,
})
await vmachine('db01', {
  cluster: clVsphere,
  site: hqSiteId,
  device: dev['hq-esx1'],
  platform: platform.linux,
  role: role.server,
})
await vmachine('web01', { cluster: clAws, role: role.server, platform: platform.linux })
await vmachine('vgw', { cluster: clAws, role: role['vpn-gateway'] })

const vmif: Record<string, number> = {}
async function vmi(v: string, name: string, extra: Json = {}): Promise<void> {
  vmif[`${v}:${name}`] = await id(
    '/api/virtualization/interfaces/',
    { virtual_machine_id: vm[v] as number, name },
    { virtual_machine: vm[v], name, ...extra },
  )
}
await vmi('app01', 'eth0', { mode: 'access', untagged_vlan: vlan[10] })
await vmi('db01', 'eth0', { mode: 'access', untagged_vlan: vlan[10] })
await vmi('web01', 'eth0', { vrf: vrfVpc })
await vmi('vgw', 'tun1')
await vmi('vgw', 'tun2')

// --------------------------------------------------------------------------
// IP addresses (and primary IPs)
// --------------------------------------------------------------------------

async function ip(
  address: string,
  objType: string,
  objId: number,
  extra: Json = {},
  vrf?: number,
): Promise<number> {
  const q: Query = vrf ? { vrf_id: vrf } : { vrf_id: 'null' }
  return id(
    '/api/ipam/ip-addresses/',
    { address, ...q },
    {
      address,
      status: 'active',
      assigned_object_type: objType,
      assigned_object_id: objId,
      ...(vrf ? { vrf } : {}),
      ...extra,
    },
  )
}
async function primary(d: string, ipId: number): Promise<void> {
  await patch('/api/dcim/devices/', dev[d] as number, { primary_ip4: ipId })
}

await primary('hq-rt1', await ip('10.0.99.1/24', 'dcim.interface', dif('hq-rt1:lo0')))
await ip('198.51.100.1/31', 'dcim.interface', dif('hq-rt1:et-0/0/0'))
await ip('198.51.100.3/31', 'dcim.interface', dif('hq-rt1:et-0/0/2'))
await ip('203.0.113.10/24', 'dcim.interface', dif('hq-rt1:et-0/0/3'))
await ip('10.0.10.2/24', 'dcim.interface', dif('hq-fw1:port1'))
await ip('10.0.10.3/24', 'dcim.interface', dif('hq-fw2:port1'))
await ip('192.0.2.1/30', 'dcim.interface', dif('hq-fw1:tunnel.1'))
await ip('192.0.2.5/30', 'dcim.interface', dif('hq-fw1:tunnel.2'))
await primary('hq-fw1', await ip('10.0.99.2/24', 'dcim.interface', dif('hq-fw1:mgmt')))
await primary('hq-fw2', await ip('10.0.99.3/24', 'dcim.interface', dif('hq-fw2:mgmt')))
await primary('hq-sw1', await ip('10.0.99.11/24', 'dcim.interface', dif('hq-sw1:irb.99')))
await primary('hq-esx1', await ip('10.0.99.21/24', 'dcim.interface', dif('hq-esx1:vmk0')))
await primary('hq-esx2', await ip('10.0.99.22/24', 'dcim.interface', dif('hq-esx2:vmk0')))
await primary('br-rt1', await ip('10.0.99.254/24', 'dcim.interface', dif('br-rt1:lo0')))

const VMI = 'virtualization.vminterface'
async function vmPrimary(v: string, ipId: number): Promise<void> {
  await patch('/api/virtualization/virtual-machines/', vm[v] as number, { primary_ip4: ipId })
}
await vmPrimary('app01', await ip('10.0.10.21/24', VMI, vmif['app01:eth0'] as number))
await vmPrimary('db01', await ip('10.0.10.31/24', VMI, vmif['db01:eth0'] as number))
await vmPrimary('web01', await ip('10.100.1.10/24', VMI, vmif['web01:eth0'] as number, {}, vrfVpc))
await ip('192.0.2.2/30', VMI, vmif['vgw:tun1'] as number)
await ip('192.0.2.6/30', VMI, vmif['vgw:tun2'] as number)

// --------------------------------------------------------------------------
// FHRP
// --------------------------------------------------------------------------

// DEVIATION: NetBox has no protocol `vrrp`; it is split into `vrrp2` / `vrrp3`. Using vrrp2.
const fhrp = await id(
  '/api/ipam/fhrp-groups/',
  { group_id: 10, name: 'fw-vip' },
  { name: 'fw-vip', protocol: 'vrrp2', group_id: 10 },
)
await ip('10.0.10.1/24', 'ipam.fhrpgroup', fhrp, { role: 'vrrp' })
for (const [d, prio] of [
  ['hq-fw1', 110],
  ['hq-fw2', 100],
] as [string, number][]) {
  await id(
    '/api/ipam/fhrp-group-assignments/',
    { group_id: fhrp, interface_type: 'dcim.interface', interface_id: dif(`${d}:port1`) },
    {
      group: fhrp,
      interface_type: 'dcim.interface',
      interface_id: dif(`${d}:port1`),
      priority: prio,
    },
  )
}

// --------------------------------------------------------------------------
// Circuits
// --------------------------------------------------------------------------

const ctype: Record<string, number> = {}
for (const slug of ['dark-fiber', 'internet', 'ix']) {
  ctype[slug] = await bySlug('/api/circuits/circuit-types/', slug, { name: slug })
}
const prov: Record<string, number> = {}
for (const [slug, a] of [
  ['fictional-telecom', undefined],
  ['transit-one', 64500],
  ['transit-two', 64501],
  ['fict-ix', 64510],
] as [string, number | undefined][]) {
  prov[slug] = await bySlug('/api/circuits/providers/', slug, {
    name: slug,
    ...(a ? { asns: [asn[a]] } : {}),
  })
}
const pnet: Record<string, number> = {}
for (const [name, p] of [
  ['transit-one-backbone', 'transit-one'],
  ['transit-two-backbone', 'transit-two'],
  ['fict-ix-peering-lan', 'fict-ix'],
] as [string, string][]) {
  pnet[name] = await id(
    '/api/circuits/provider-networks/',
    { name, provider_id: prov[p] as number },
    { name, provider: prov[p] },
  )
}

type Term = { type: 'dcim.site' | 'circuits.providernetwork'; target: number }
const cterm: Record<string, number> = {} // "cid:A"
async function circuit(
  cid: string,
  providerSlug: string,
  typeSlug: string,
  status: string,
  a: Term,
  z: Term | undefined,
  extra: Json = {},
  speed?: number,
): Promise<void> {
  const cId = await id(
    '/api/circuits/circuits/',
    { cid },
    { cid, provider: prov[providerSlug], type: ctype[typeSlug], status, ...extra },
  )
  for (const [side, t] of [
    ['A', a],
    ['Z', z],
  ] as [string, Term | undefined][]) {
    if (!t) continue
    cterm[`${cid}:${side}`] = await id(
      '/api/circuits/circuit-terminations/',
      { circuit_id: cId, term_side: side },
      {
        circuit: cId,
        term_side: side,
        termination_type: t.type,
        termination_id: t.target,
        ...(speed ? { port_speed: speed } : {}),
      },
    )
  }
}
const hqSite: Term = { type: 'dcim.site', target: hqSiteId }
const brSite: Term = { type: 'dcim.site', target: brSiteId }
const pn = (n: string): Term => ({
  type: 'circuits.providernetwork',
  target: pnet[n] as number,
})

await circuit('FT-DF-0001', 'fictional-telecom', 'dark-fiber', 'active', hqSite, brSite, {}, S10G)
await circuit(
  'TO-IP-1001',
  'transit-one',
  'internet',
  'active',
  hqSite,
  pn('transit-one-backbone'),
  { commit_rate: 2_000_000 },
  S10G,
)
await circuit('TO-IP-1002', 'transit-one', 'internet', 'active', brSite, pn('transit-one-backbone'))
await circuit('TT-IP-2002', 'transit-two', 'internet', 'active', hqSite, pn('transit-two-backbone'))
await circuit('IX-PORT-7', 'fict-ix', 'ix', 'active', hqSite, pn('fict-ix-peering-lan'))
await circuit('FT-PLAN-9', 'fictional-telecom', 'dark-fiber', 'planned', brSite, undefined)

// --------------------------------------------------------------------------
// Cables
// --------------------------------------------------------------------------

const CABLED_ENDPOINTS: Record<string, string> = {
  'dcim.interface': '/api/dcim/interfaces/',
  'dcim.frontport': '/api/dcim/front-ports/',
  'dcim.rearport': '/api/dcim/rear-ports/',
  'circuits.circuittermination': '/api/circuits/circuit-terminations/',
}

async function cable(a: Ref, b: Ref, extra: Json = {}): Promise<void> {
  const cur = asObj(await call('GET', `${CABLED_ENDPOINTS[a.type]}${a.id}/`))
  if (cur.cable) {
    existing++
    return
  }
  await call('POST', '/api/dcim/cables/', {
    a_terminations: [{ object_type: a.type, object_id: a.id }],
    b_terminations: [{ object_type: b.type, object_id: b.id }],
    status: 'connected',
    ...extra,
  })
  created++
}
const I = (key: string): Ref => ({ type: 'dcim.interface', id: dif(key) })
const CT = (key: string): Ref => ({
  type: 'circuits.circuittermination',
  id: cterm[key] as number,
})
const smf3 = { type: 'smf', length: 3, length_unit: 'm' }
await cable(I('hq-rt1:et-0/0/4'), I('hq-sw1:et-0/0/48'), smf3)
await cable(I('hq-rt1:et-0/0/5'), I('hq-sw2:et-0/0/48'), smf3)
await cable(I('hq-fw1:port1'), I('hq-sw1:ge-0/0/1'), { type: 'cat6' })
await cable(I('hq-fw2:port1'), I('hq-sw2:ge-0/0/1'), { type: 'cat6' })
await cable(I('hq-esx1:vmnic0'), I('hq-sw1:ge-0/0/10'))
await cable(I('hq-esx2:vmnic0'), I('hq-sw2:ge-0/0/10'))
await cable(I('hq-wl1:eth0'), I('hq-sw2:ge-0/0/20'))
await cable(I('annex-wl1:eth0'), I('annex-sw1:ge-0/0/1'))

// Circuits to devices
await cable(I('hq-rt1:et-0/0/0'), CT('TO-IP-1001:A'))
await cable(I('br-rt1:ge-0/0/1'), CT('TO-IP-1002:A'))
await cable(I('hq-rt1:et-0/0/2'), CT('TT-IP-2002:A'))
await cable(I('hq-rt1:et-0/0/3'), CT('IX-PORT-7:A'))
// Patch-panel path: et-0/0/1 - front1 / rear1 - FT-DF-0001 A ... Z - br-rt1:ge-0/0/0
await cable(I('hq-rt1:et-0/0/1'), { type: 'dcim.frontport', id: front })
await cable({ type: 'dcim.rearport', id: rear }, CT('FT-DF-0001:A'))
await cable(I('br-rt1:ge-0/0/0'), CT('FT-DF-0001:Z'))

// Virtual circuit
const vct = await bySlug('/api/circuits/virtual-circuit-types/', 'vc-mpls', { name: 'vc-mpls' })
const vcirc = await id(
  '/api/circuits/virtual-circuits/',
  { cid: 'TO-VC-77' },
  {
    cid: 'TO-VC-77',
    provider_network: pnet['transit-one-backbone'],
    type: vct,
    status: 'active',
  },
)
for (const key of ['hq-rt1:et-0/0/0.100', 'br-rt1:ge-0/0/1.100']) {
  await id(
    '/api/circuits/virtual-circuit-terminations/',
    { virtual_circuit_id: vcirc, interface_id: dif(key) },
    { virtual_circuit: vcirc, role: 'peer', interface: dif(key) },
  )
}

// --------------------------------------------------------------------------
// VPN: tunnels and L2VPN
// --------------------------------------------------------------------------

const tgroup = await bySlug('/api/vpn/tunnel-groups/', 'vpn-aws', { name: 'vpn-aws' })
for (const [name, fwIf, vgwIf, n] of [
  ['aws-tun-1', 'hq-fw1:tunnel.1', 'vgw:tun1', 1],
  ['aws-tun-2', 'hq-fw1:tunnel.2', 'vgw:tun2', 2],
] as [string, string, string, number][]) {
  const t = await id(
    '/api/vpn/tunnels/',
    { name },
    {
      name,
      status: 'active',
      group: tgroup,
      encapsulation: 'ipsec-tunnel',
      tunnel_id: n,
    },
  )
  for (const [tt, tid] of [
    ['dcim.interface', dif(fwIf)],
    [VMI, vmif[vgwIf] as number],
  ] as [string, number][]) {
    await id(
      '/api/vpn/tunnel-terminations/',
      { tunnel_id: t, termination_type: tt, termination_id: tid },
      { tunnel: t, role: 'peer', termination_type: tt, termination_id: tid },
    )
  }
}

const pw = await bySlug('/api/vpn/l2vpns/', 'pw-hq-br', { name: 'pw-hq-br', type: 'vpws' })
const evpn = await bySlug('/api/vpn/l2vpns/', 'evpn-users', {
  name: 'evpn-users',
  type: 'vxlan-evpn',
  identifier: 10020,
})
for (const [l2, keys] of [
  [pw, ['hq-rt1:et-0/0/1.200', 'br-rt1:ge-0/0/0.200']],
  [evpn, ['hq-rt1:irb.20', 'br-rt1:irb.20']],
] as [number, string[]][]) {
  for (const key of keys) {
    await id(
      '/api/vpn/l2vpn-terminations/',
      { l2vpn_id: l2, interface_id: dif(key) },
      { l2vpn: l2, assigned_object_type: 'dcim.interface', assigned_object_id: dif(key) },
    )
  }
}

// --------------------------------------------------------------------------
// Wireless
// --------------------------------------------------------------------------

await id(
  '/api/wireless/wireless-links/',
  { ssid: 'hq-annex-ptp' },
  {
    interface_a: dif('hq-wl1:radio0'),
    interface_b: dif('annex-wl1:radio0'),
    ssid: 'hq-annex-ptp',
    status: 'connected',
    distance: 300,
    distance_unit: 'm',
  },
)

console.log(`seed done: ${created} created, ${existing} already present`)
