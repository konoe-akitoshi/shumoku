/**
 * Build an NCE-Campus topology fragment: managed devices (APs, switches,
 * routers, firewalls), grouped into their sites, with device↔device links
 * recovered from each device's LLDP neighbor table. Identity stamping lets
 * shumoku's composition merge these nodes with other sources (NetBox, Zabbix)
 * by MAC / management IP / sysName.
 */

import type { Link, NetworkGraph, Node, Subgraph } from '@shumoku/core'
import { buildIdentity, DeviceType } from '@shumoku/core'
import type { NceDevice, NceLldpNeighbor } from './types.js'

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

const normalizeMac = (mac: string): string => mac.toLowerCase()

export function buildTopology(
  devices: NceDevice[],
  neighborsByDeviceId: Map<string, NceLldpNeighbor[]>,
): NetworkGraph {
  const nodes: Node[] = []
  const links: Link[] = []
  const subgraphs: Subgraph[] = []
  const emittedSite = new Set<string>()

  // Neighbor entries reference peers by self-reported sysName and MAC; index
  // the managed inventory by both so an edge can land on the peer's node.
  const byName = new Map<string, NceDevice>()
  const byMac = new Map<string, NceDevice>()
  for (const d of devices) {
    if (d.name) byName.set(d.name, d)
    if (d.mac) byMac.set(normalizeMac(d.mac), d)
  }

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

  for (const d of devices) {
    if (!d.id) continue
    const parent = ensureSite(d)
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

  // LLDP edges. Both ends report the same physical wire, so a canonical
  // endpoint-sorted key collapses the A→B / B→A duplicates.
  const emittedLink = new Set<string>()
  for (const [deviceId, neighbors] of neighborsByDeviceId) {
    const fromNode = deviceNodeId(deviceId)
    for (const n of neighbors) {
      if (!n.localIfName) continue
      const peer =
        (n.remoteMac ? byMac.get(normalizeMac(n.remoteMac)) : undefined) ??
        (n.sysName ? byName.get(n.sysName) : undefined)
      // Neighbors outside the managed inventory (upstream carrier gear, phones)
      // are dropped in v1 — an edge to a node we can't identify would neither
      // merge nor render usefully.
      if (!peer?.id || peer.id === deviceId) continue
      const a = `${deviceId}|${n.localIfName}`
      const b = `${peer.id}|${n.remoteIfName ?? ''}`
      const key = a < b ? `${a}~${b}` : `${b}~${a}`
      if (emittedLink.has(key)) continue
      emittedLink.add(key)
      links.push({
        id: `nce-link:${key}`,
        from: { node: fromNode, port: n.localIfName },
        to: { node: deviceNodeId(peer.id), port: n.remoteIfName || '' },
        arrow: 'none',
      })
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
