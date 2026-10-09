/**
 * Build an NCE-Campus topology fragment: managed devices (APs, switches,
 * routers, firewalls), grouped into their sites, with device↔device links.
 *
 * Links come from Link Management (`/rest/openapi/network/link` — one paged
 * call naming both endpoints by device UUID) when it returns any, falling back
 * to each device's LLDP neighbor table otherwise. Identity stamping lets
 * shumoku's composition merge these nodes with other sources (NetBox, Zabbix)
 * by MAC / management IP.
 */

import type { inputModel, SourceNetwork } from '@shumoku/core'
import { buildIdentity, DeviceType, rateFromBps } from '@shumoku/core'
import type { NceDevice, NceLldpNeighbor, NceNetworkLink } from './types.js'

/**
 * Link Management `speed` (Mbit/s, as a string) → capacity in bps.
 *
 * The same number is the link's drawn rate and the denominator that turns the
 * device's throughput counters into a utilization percentage, so both readings
 * come from here rather than each parsing the field their own way.
 */
export function linkCapacityBps(link: Pick<NceNetworkLink, 'speed'>): number | undefined {
  const mbps = Number.parseFloat(link.speed ?? '')
  if (!Number.isFinite(mbps) || mbps <= 0) return undefined
  return mbps * 1_000_000
}

type ObservedNode = NonNullable<NonNullable<SourceNetwork['observation']>['nodes']>[string]

/** A node while it is still being collected: peers gain ports and a product as links are read. */
interface MutableNode {
  id: string
  label: string
  type: DeviceType
  product?: string
  group?: string
}

interface MutableObservation {
  identity?: ObservedNode['identity']
}

/** `vendor/model`, `vendor` alone, or `?/model` when only the model is known. */
function productOf(vendor: string | undefined, model: string | undefined): string | undefined {
  if (vendor && model) return `${vendor}/${model}`
  if (vendor) return vendor
  return model ? `?/${model}` : undefined
}

/** Node id for a device, derived from its NCE UUID. */
export function deviceNodeId(deviceId: string): string {
  return `nce:${deviceId}`
}

function siteSubgraphId(siteId: string): string {
  return `nce-site:${siteId}`
}

/** NCE device class → core device type. */
export function mapDeviceType(deviceType: string | undefined): DeviceType {
  switch ((deviceType ?? '').toUpperCase()) {
    case 'AP':
      return DeviceType.AccessPoint
    case 'AR':
      return DeviceType.Router
    case 'FW':
      return DeviceType.Firewall
    default:
      // LSW (LAN switch) and anything unrecognized.
      return DeviceType.L2Switch
  }
}

/**
 * Canonical MAC key. NCE is not self-consistent about separators — the device
 * list returns `50-04-01-02-14-80` while LLDP returns `CC:D8:1F:9F:D4:17` — so
 * comparison must ignore separators and case, not just case.
 */
const normalizeMac = (mac: string): string => mac.toLowerCase().replace(/[^0-9a-f]/g, '')

/** Node id for a peer NCE reports a link to but does not manage. */
function neighborNodeId(key: string): string {
  return `nce-lldp:${key}`
}

/**
 * Guess a device type for an unmanaged LLDP neighbor from what it says about
 * itself. Campus APs uplink into switches, so an unrecognized neighbor is far
 * more likely a switch than anything else.
 */
export function mapNeighborType(neighbor: NceLldpNeighbor): DeviceType {
  const hint = `${neighbor.sysDescription ?? ''} ${neighbor.sysCapEnabled ?? ''}`.toLowerCase()
  if (/router|\brtr\b/.test(hint)) return DeviceType.Router
  if (/firewall/.test(hint)) return DeviceType.Firewall
  if (/access.?point|\bap\b|wlan/.test(hint)) return DeviceType.AccessPoint
  return DeviceType.L2Switch
}

/**
 * The port name only when NCE actually holds a port entity for it.
 *
 * A managed port's DN is a UUID; a port NCE never resolved has its DN set to
 * the name itself — the string came straight off the neighbour's LLDP TLV.
 * Such a "port" is not exclusive: the live tenant fans four AP uplinks into
 * one `port1.0.5` on a synthetic peer, and anchoring four edges to a single
 * port leaves the router no way to separate them (they cross, loop, and miss
 * the port badge). Anchoring to the node instead renders honestly: we know
 * the AP's port, we do not know the far end's.
 */
function realPortName(name: string | undefined, dn: string | undefined): string {
  if (!name) return ''
  return dn && dn !== name ? name : ''
}

export function buildTopology(
  devices: NceDevice[],
  networkLinks: NceNetworkLink[],
  neighborsByDeviceId: Map<string, NceLldpNeighbor[]>,
): SourceNetwork {
  // Devices and peers in the order they are found; peers are also kept by key.
  const nodes = new Map<string, MutableNode>()
  const observed = new Map<string, MutableObservation>()
  const links: inputModel.Link[] = []
  const drawnLinks: Record<string, { arrow: 'none' }> = {}
  const sites: inputModel.Group[] = []
  const observedSites: Record<string, { identity: { name: string } }> = {}
  const emittedSite = new Set<string>()

  // Neighbor entries identify peers by MAC and a self-reported system name —
  // which on Huawei gear is often the chassis ESN rather than a hostname. Index
  // the managed inventory by all three so an edge can land on the peer's node.
  const byName = new Map<string, NceDevice>()
  const byMac = new Map<string, NceDevice>()
  const byEsn = new Map<string, NceDevice>()
  for (const d of devices) {
    if (d.name) byName.set(d.name, d)
    if (d.mac) byMac.set(normalizeMac(d.mac), d)
    if (d.esn) byEsn.set(d.esn, d)
  }
  const resolvePeer = (n: NceLldpNeighbor): NceDevice | undefined =>
    (n.remoteMac ? byMac.get(normalizeMac(n.remoteMac)) : undefined) ??
    (n.sysName ? (byEsn.get(n.sysName) ?? byName.get(n.sysName)) : undefined)

  const ensureSite = (d: NceDevice): string | undefined => {
    if (!d.siteId) return undefined
    if (!emittedSite.has(d.siteId)) {
      emittedSite.add(d.siteId)
      const label = d.siteName || d.siteId
      sites.push({ id: siteSubgraphId(d.siteId), label })
      observedSites[siteSubgraphId(d.siteId)] = { identity: { name: label } }
    }
    return siteSubgraphId(d.siteId)
  }

  /**
   * Fallback management address per device, from Link Management.
   *
   * NCE reports two addresses per device and they mean different things. `ip`
   * is where the *controller* sees the device from, which behind NAT is one
   * shared public address for the whole site — a live tenant returned
   * `103.26.27.187` for 38 of its 39 APs, an identity key that merges the
   * entire site into one entity. `manageIp` is the device's own address and is
   * unique, so it is what we key on; this map only covers devices whose
   * `manageIp` is empty but which appear as a link endpoint. `0.0.0.0` is the
   * controller's placeholder for "no address" and never becomes a key.
   */
  const deviceIp = new Map<string, string>()
  for (const l of networkLinks) {
    for (const [id, ip] of [
      [l.anedn, l.aneip],
      [l.znedn, l.zneip],
    ] as const) {
      if (id && ip && ip !== '0.0.0.0') deviceIp.set(id, ip)
    }
  }

  const siteOfDevice = new Map<string, string>()
  for (const d of devices) {
    if (!d.id) continue
    const group = ensureSite(d)
    if (group) siteOfDevice.set(d.id, group)
    // The NCE device `name` is operator-editable (a display string), so it
    // stays out of sysName. MAC + management IP are the stable machine keys;
    // the ESN and NCE UUID ride along as vendor ids.
    const identity = buildIdentity({
      mgmtIp: d.manageIp || deviceIp.get(d.id) || d.ip,
      mac: d.mac,
      vendorIds: {
        'nce-device-id': d.id,
        ...(d.esn ? { 'nce-esn': d.esn } : {}),
      },
    })
    const id = deviceNodeId(d.id)
    const model = d.neType || d.deviceModel
    nodes.set(id, {
      id,
      label: d.name || d.id,
      type: mapDeviceType(d.deviceType),
      product: productOf('huawei', model?.toLowerCase()),
      group,
    })
    observed.set(id, { identity })
  }

  const knownDevice = new Set<string>()
  for (const d of devices) if (d.id) knownDevice.add(d.id)
  const emittedLink = new Set<string>()

  // A peer NCE reports a link to but does not manage — a WLAN-only tenant's
  // uplink switches, or the controller's own `VirtualDevice` placeholder.
  // Emitting them is the point: the AP↔switch edge is the topology NCE knows
  // that a wired source doesn't, and identity lets composition merge the real
  // ones onto the NetBox/Zabbix node instead of duplicating them.
  //
  // Group each into the site of the device that reported it. Emitting site
  // groups makes this source's scope closed, and the resolver drops
  // in-scope-source nodes belonging to none of its regions — an ungrouped
  // peer would be discarded along with its link.
  const peerIds = new Map<string, string>()
  const ensurePeerNode = (
    key: string,
    label: string,
    reportedBy: string,
    identity: Parameters<typeof buildIdentity>[0],
    type: DeviceType,
  ): string => {
    const existing = peerIds.get(key)
    if (existing) return existing
    const id = neighborNodeId(key)
    nodes.set(id, { id, label, type, group: siteOfDevice.get(reportedBy) })
    observed.set(id, { identity: buildIdentity(identity) })
    peerIds.set(key, id)
    return id
  }

  /**
   * An anchor on a peer whose real port NCE doesn't know.
   *
   * Every endpoint needs a port id, and endpoints that share one share an
   * anchor: four AP uplinks all reported against `port1.0.5` (or all left
   * blank) collapse onto a single point, so the router draws four crossing
   * lines into one badge. Give each link its own anchor instead, keyed by the
   * device that reported it — unique per link and stable across syncs, unlike
   * core's `ensurePorts`, whose anonymous ids are regenerated every time and
   * would churn the port entities. The anchor is declared on the peer through
   * the design layer with an empty label, since we genuinely do not know this
   * port's real name.
   */
  const anchors = new Map<string, string[]>()
  const anchorOnPeer = (peerId: string, reportedBy: string): string => {
    const id = `uplink:${reportedBy}`
    anchors.set(peerId, [...(anchors.get(peerId) ?? []), id])
    return id
  }

  /**
   * Chassis MAC for each unmanaged peer, learned from the LLDP table of the
   * device that reported the link.
   *
   * Link Management names a peer only by UUID, model string, and `0.0.0.0` — it
   * carries no MAC field at all — so peers built from it alone share no key
   * with the same switch seen by a wired source and can never merge. The
   * reporting device's LLDP table does carry the peer's chassis MAC, and on a
   * live tenant that MAC is exactly the address the switch answers ARP with, so
   * it is the key worth recovering.
   *
   * Which neighbour belongs to which link is pinned by the A-side port name,
   * falling back to the sole neighbour when a device reported exactly one (the
   * common case: an AP with a single uplink).
   */
  const peerMac = new Map<string, string>()
  for (const l of networkLinks) {
    if (!l.anedn || !l.znedn || knownDevice.has(l.znedn)) continue
    const neighbors = neighborsByDeviceId.get(l.anedn) ?? []
    const match =
      neighbors.find((n) => n.localIfName && n.localIfName === l.aportname) ??
      (neighbors.length === 1 ? neighbors[0] : undefined)
    if (match?.remoteMac) peerMac.set(l.znedn, match.remoteMac)
  }

  const addLink = (
    key: string,
    from: { node: string; port: string },
    to: { node: string; port: string },
    capacity?: number,
  ): void => {
    const id = `nce-link:${key}`
    links.push({
      id,
      endpoints: [
        { node: from.node, ...(from.port ? { port: from.port } : {}) },
        { node: to.node, ...(to.port ? { port: to.port } : {}) },
      ],
      ...(capacity !== undefined ? { speed: rateFromBps(capacity) } : {}),
    })
    drawnLinks[id] = { arrow: 'none' }
  }

  // Preferred link source: Link Management (`/rest/openapi/network/link`).
  // One call, and both ends carry the managed device's UUID plus a port name —
  // the topology API needs a per-site walk and still leaves ports null on some
  // deployments.
  for (const l of networkLinks) {
    const aId = l.anedn
    const zId = l.znedn
    if (!aId || !zId || aId === zId) continue
    // The A end is expected to be managed (that's whose link table this is);
    // an unmanaged A end has no site to anchor the pair to, so skip it.
    if (!knownDevice.has(aId)) continue
    const fromNode = deviceNodeId(aId)
    const peer = knownDevice.has(zId)
      ? undefined
      : ensurePeerNode(
          zId,
          l.znename || zId,
          aId,
          {
            // 0.0.0.0 is the controller's placeholder for "no address".
            mgmtIp: l.zneip && l.zneip !== '0.0.0.0' ? l.zneip : undefined,
            chassisId: peerMac.get(zId),
            mac: peerMac.get(zId),
            sysName: l.znename,
            vendorIds: { 'nce-device-id': zId },
          },
          DeviceType.L2Switch,
        )
    const toNode = peer ?? deviceNodeId(zId)
    const aPort = realPortName(l.aportname, l.aportdn)
    const namedZPort = realPortName(l.zportname, l.zportdn)
    const zPort = namedZPort || (peer ? anchorOnPeer(peer, aId) : '')
    const a = `${aId}|${aPort}`
    const b = `${zId}|${zPort}`
    const key = a < b ? `${a}~${b}` : `${b}~${a}`
    if (emittedLink.has(key)) continue
    emittedLink.add(key)
    addLink(key, { node: fromNode, port: aPort }, { node: toNode, port: zPort }, linkCapacityBps(l))
  }

  // Fallback: LLDP neighbor tables. Both ends report the same physical wire, so
  // a canonical endpoint-sorted key collapses the A→B / B→A duplicates.
  const ensureLldpPeer = (n: NceLldpNeighbor, discoveredBy: string): string | undefined => {
    const key = n.remoteMac ? normalizeMac(n.remoteMac) : n.sysName?.toLowerCase()
    if (!key) return undefined // nothing identifying — an edge to it can't merge
    return ensurePeerNode(
      key,
      n.sysName || n.remoteMac || key,
      discoveredBy,
      {
        chassisId: n.remoteMac,
        mac: n.remoteMac,
        // LLDP sysName is the peer's own claim about itself — a valid sysName
        // even when Huawei switches report their ESN there.
        sysName: n.sysName,
      },
      mapNeighborType(n),
    )
  }

  if (links.length === 0) {
    for (const [deviceId, neighbors] of neighborsByDeviceId) {
      const fromNode = deviceNodeId(deviceId)
      for (const n of neighbors) {
        if (!n.localIfName) continue
        const managed = resolvePeer(n)
        if (managed?.id === deviceId) continue // self-report; not a wire
        const peer = managed?.id ? undefined : ensureLldpPeer(n, deviceId)
        if (!managed?.id && !peer) continue
        const toNode = managed?.id ? deviceNodeId(managed.id) : (peer ?? '')
        // Same anchor rule as above: an unnamed far end gets its own anchor so
        // several neighbours of one peer don't pile onto a single point.
        const zPort = n.remoteIfName || (peer ? anchorOnPeer(peer, deviceId) : '')
        const a = `${deviceId}|${n.localIfName}`
        const b = `${managed?.id ?? toNode}|${zPort}`
        const key = a < b ? `${a}~${b}` : `${b}~${a}`
        if (emittedLink.has(key)) continue
        emittedLink.add(key)
        addLink(key, { node: fromNode, port: n.localIfName }, { node: toNode, port: zPort })
      }
    }
  }

  // Huawei answers the LLDP system-name query with the switch *model*, so every
  // peer in a tenant reports `IS230-10TP-AC(V1)`. That string is a model, and it
  // belongs in the node's product where the catalog and the renderer can use it —
  // being a model is also why it cannot be an identity key, since sixteen
  // switches would claim the same one. Non-uniqueness is what gives it away: a
  // real system name is unique to its device.
  //
  // It stays on the label as well. A model shared by every peer is a poor name,
  // but it is the most legible thing anyone here knows: NCE has no address for
  // these switches, and a raw chassis MAC reads worse in a diagram than a model
  // does. A source that learns an address contributes a better label through
  // the normal field merge.
  const reportedNameCount = new Map<string, number>()
  for (const id of peerIds.values()) {
    const name = observed.get(id)?.identity?.sysName
    if (name) reportedNameCount.set(name, (reportedNameCount.get(name) ?? 0) + 1)
  }
  for (const id of peerIds.values()) {
    const name = observed.get(id)?.identity?.sysName
    const node = nodes.get(id)
    if (!node || !name || (reportedNameCount.get(name) ?? 0) < 2) continue
    if (!node.product) node.product = productOf(undefined, name.toLowerCase())
  }

  // A key value shared by several nodes identifies none of them, and a
  // colliding key is worse than a missing one: it tells the resolver to merge
  // nodes that are not the same device. Two NCE fields collide in practice —
  // every switch of one family reports its *model* as the LLDP system name (a
  // live tenant had sixteen switches all calling themselves
  // `IS230-10TP-AC(V1)`), and behind NAT the device list hands every AP on the
  // site the same public address. Each is dropped wherever it repeats; the
  // value survives as the node's label, which is where a display string
  // belongs. A node whose only key collides keeps it, since a node with no key
  // at all would fail the identity contract outright.
  for (const key of ['sysName', 'mgmtIp'] as const) {
    const count = new Map<string, number>()
    for (const obs of observed.values()) {
      const value = obs.identity?.[key]
      if (value) count.set(value, (count.get(value) ?? 0) + 1)
    }
    for (const obs of observed.values()) {
      const value = obs.identity?.[key]
      if (!value || (count.get(value) ?? 0) < 2) continue
      const rebuilt = buildIdentity({ ...obs.identity, [key]: undefined })
      if (rebuilt) obs.identity = rebuilt
    }
  }

  return {
    network: {
      name: 'Huawei NCE-Campus',
      nodes: [...nodes.values()].map(toInputNode),
      links,
      ...(sites.length > 0 ? { groups: sites } : {}),
    },
    observation: {
      nodes: Object.fromEntries(
        [...observed].map(([id, obs]): [string, ObservedNode] => [id, toObservedNode(obs)]),
      ),
      ...(sites.length > 0 ? { groups: observedSites } : {}),
    },
    ...(anchors.size > 0 ? { design: { nodes: designedPeers(anchors) } } : {}),
    ...(Object.keys(drawnLinks).length > 0 ? { drawing: { links: drawnLinks } } : {}),
  }
}

function toInputNode(node: MutableNode): inputModel.Node {
  return {
    id: node.id,
    label: node.label,
    type: node.type,
    ...(node.product ? { product: node.product } : {}),
    ...(node.group ? { group: node.group } : {}),
  }
}

function toObservedNode(obs: MutableObservation): ObservedNode {
  return {
    ...(obs.identity ? { identity: obs.identity } : {}),
  }
}

/** Each anchor is a port with no name and no known connector. */
function designedPeers(
  anchors: Map<string, string[]>,
): Record<string, { ports: Record<string, { label: string; connectors: [] }> }> {
  return Object.fromEntries(
    [...anchors].map(([peer, ids]) => [
      peer,
      { ports: Object.fromEntries(ids.map((id) => [id, { label: '', connectors: [] as [] }])) },
    ]),
  )
}
