/**
 * Build an NCE-Campus topology fragment: managed devices (APs, switches,
 * routers, firewalls), grouped into their sites, with device↔device links.
 *
 * Links come from the controller's own topology (`topomanager/device/node`
 * linkData — one call, ports + status included) when it returns any, falling
 * back to each device's LLDP neighbor table otherwise. Identity stamping lets
 * shumoku's composition merge these nodes with other sources (NetBox, Zabbix)
 * by MAC / management IP.
 */

import type { Link, NetworkGraph, Node, Subgraph } from '@shumoku/core'
import { buildIdentity, DeviceType } from '@shumoku/core'
import type { NceDevice, NceLldpNeighbor, NceTopoLink } from './types.js'

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

/** Node id for an LLDP-discovered device that NCE does not manage. */
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

export function buildTopology(
  devices: NceDevice[],
  topoLinks: NceTopoLink[],
  neighborsByDeviceId: Map<string, NceLldpNeighbor[]>,
): NetworkGraph {
  const nodes: Node[] = []
  const links: Link[] = []
  const subgraphs: Subgraph[] = []
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
      subgraphs.push({
        id: siteSubgraphId(d.siteId),
        label,
        identity: { name: label },
      })
    }
    return siteSubgraphId(d.siteId)
  }

  const siteOfDevice = new Map<string, string>()
  for (const d of devices) {
    if (!d.id) continue
    const parent = ensureSite(d)
    if (parent) siteOfDevice.set(d.id, parent)
    // The NCE device `name` is operator-editable (a display string), so it
    // stays out of sysName. MAC + management IP are the stable machine keys;
    // the ESN and NCE UUID ride along as vendor ids.
    const identity = buildIdentity({
      mgmtIp: d.ip || d.manageIp,
      mac: d.mac,
      vendorIds: {
        'nce-device-id': d.id,
        ...(d.esn ? { 'nce-esn': d.esn } : {}),
      },
    })
    nodes.push({
      id: deviceNodeId(d.id),
      label: [d.name || d.id],
      ...(parent ? { parent } : {}),
      ...(identity ? { identity } : {}),
      spec: {
        kind: 'hardware',
        type: mapDeviceType(d.deviceType),
        vendor: 'huawei',
        ...(d.neType || d.deviceModel
          ? { model: (d.neType || d.deviceModel || '').toLowerCase() }
          : {}),
      },
    })
  }

  const knownDevice = new Set<string>()
  for (const d of devices) if (d.id) knownDevice.add(d.id)
  const emittedLink = new Set<string>()

  // Preferred: the controller's own topology links. leftFdn/rightFdn are the
  // end nodes' resIds — for device nodes, the same UUID the device list
  // returns — with the ports in aPortName/zPortName. Links whose ends aren't
  // both managed devices (site/organization container nodes, unmanaged gear)
  // are dropped: an edge to a node we can't identify would neither merge nor
  // render usefully.
  for (const l of topoLinks) {
    if (!l.leftFdn || !l.rightFdn) continue
    if (!knownDevice.has(l.leftFdn) || !knownDevice.has(l.rightFdn)) continue
    if (l.leftFdn === l.rightFdn) continue
    const a = `${l.leftFdn}|${l.aPortName ?? ''}`
    const b = `${l.rightFdn}|${l.zPortName ?? ''}`
    const key = a < b ? `${a}~${b}` : `${b}~${a}`
    if (emittedLink.has(key)) continue
    emittedLink.add(key)
    links.push({
      id: `nce-link:${key}`,
      from: { node: deviceNodeId(l.leftFdn), port: l.aPortName || '' },
      to: { node: deviceNodeId(l.rightFdn), port: l.zPortName || '' },
      arrow: 'none',
    })
  }

  // Fallback: LLDP neighbor tables (used when the topo API returned no usable
  // links). Both ends report the same physical wire, so a canonical
  // endpoint-sorted key collapses the A→B / B→A duplicates.
  //
  // A WLAN-only tenant manages APs but not the switches they uplink into, so
  // most neighbours are NOT in the inventory. Emitting a node for them is the
  // whole point: the AP↔switch edge is the topology NCE knows that a wired
  // source doesn't, and identity (MAC/chassisId) lets composition merge that
  // switch onto the NetBox/Zabbix node instead of duplicating it.
  const emittedNeighbor = new Set<string>()
  const ensureNeighbor = (n: NceLldpNeighbor, discoveredBy: string): string | undefined => {
    const key = n.remoteMac ? normalizeMac(n.remoteMac) : n.sysName?.toLowerCase()
    if (!key) return undefined // nothing identifying — an edge to it can't merge
    const nodeId = neighborNodeId(key)
    if (emittedNeighbor.has(key)) return nodeId
    emittedNeighbor.add(key)
    // Parent it into the site of the AP that heard it. Emitting site subgraphs
    // makes this source's scope closed, and the resolver drops in-scope-source
    // nodes that sit in none of its regions — an unparented neighbour would be
    // discarded along with its link. The AP's site is also the truthful answer:
    // that's where the switch this AP plugs into physically lives.
    const parent = siteOfDevice.get(discoveredBy)
    nodes.push({
      id: nodeId,
      label: [n.sysName || n.remoteMac || key],
      ...(parent ? { parent } : {}),
      identity: buildIdentity({
        chassisId: n.remoteMac,
        mac: n.remoteMac,
        // LLDP sysName is the peer's own claim about itself — a valid sysName
        // even when Huawei switches report their ESN there.
        sysName: n.sysName,
      }),
      spec: { kind: 'hardware', type: mapNeighborType(n) },
    })
    return nodeId
  }

  if (links.length === 0) {
    for (const [deviceId, neighbors] of neighborsByDeviceId) {
      const fromNode = deviceNodeId(deviceId)
      for (const n of neighbors) {
        if (!n.localIfName) continue
        const peer = resolvePeer(n)
        if (peer?.id === deviceId) continue // self-report; not a wire
        const toNode = peer?.id ? deviceNodeId(peer.id) : ensureNeighbor(n, deviceId)
        if (!toNode) continue
        const a = `${deviceId}|${n.localIfName}`
        const b = `${peer?.id ?? toNode}|${n.remoteIfName ?? ''}`
        const key = a < b ? `${a}~${b}` : `${b}~${a}`
        if (emittedLink.has(key)) continue
        emittedLink.add(key)
        links.push({
          id: `nce-link:${key}`,
          from: { node: fromNode, port: n.localIfName },
          to: { node: toNode, port: n.remoteIfName || '' },
          arrow: 'none',
        })
      }
    }
  }

  return {
    version: '1.0.0',
    name: 'Huawei NCE-Campus',
    nodes,
    links,
    ...(subgraphs.length > 0 ? { subgraphs } : {}),
  }
}
