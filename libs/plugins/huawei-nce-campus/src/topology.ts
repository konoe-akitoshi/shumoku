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

import type { Link, NetworkGraph, Node, Subgraph } from '@shumoku/core'
import { buildIdentity, DeviceType } from '@shumoku/core'
import type { NceDevice, NceLldpNeighbor, NceNetworkLink } from './types.js'

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

  // A peer NCE reports a link to but does not manage — a WLAN-only tenant's
  // uplink switches, or the controller's own `VirtualDevice` placeholder.
  // Emitting them is the point: the AP↔switch edge is the topology NCE knows
  // that a wired source doesn't, and identity lets composition merge the real
  // ones onto the NetBox/Zabbix node instead of duplicating them.
  //
  // Parent each into the site of the device that reported it. Emitting site
  // subgraphs makes this source's scope closed, and the resolver drops
  // in-scope-source nodes belonging to none of its regions — an unparented
  // peer would be discarded along with its link.
  const peerNodes = new Map<string, Node>()
  const ensurePeerNode = (
    key: string,
    label: string,
    reportedBy: string,
    identity: Parameters<typeof buildIdentity>[0],
    type: DeviceType,
  ): Node => {
    const existing = peerNodes.get(key)
    if (existing) return existing
    const parent = siteOfDevice.get(reportedBy)
    const node: Node = {
      id: neighborNodeId(key),
      label: [label],
      ...(parent ? { parent } : {}),
      identity: buildIdentity(identity),
      spec: { kind: 'hardware', type },
    }
    peerNodes.set(key, node)
    nodes.push(node)
    return node
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
   * would churn the port entities. The label stays empty because we genuinely
   * do not know this port's name.
   */
  const anchorOnPeer = (peer: Node, reportedBy: string): string => {
    const id = `uplink:${reportedBy}`
    if (!peer.ports?.some((p) => p.id === id)) {
      peer.ports = [...(peer.ports ?? []), { id, label: '', connectors: [] }]
    }
    return id
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
            sysName: l.znename,
            vendorIds: { 'nce-device-id': zId },
          },
          DeviceType.L2Switch,
        )
    const toNode = peer ? peer.id : deviceNodeId(zId)
    const aPort = realPortName(l.aportname, l.aportdn)
    const namedZPort = realPortName(l.zportname, l.zportdn)
    const zPort = namedZPort || (peer ? anchorOnPeer(peer, aId) : '')
    const a = `${aId}|${aPort}`
    const b = `${zId}|${zPort}`
    const key = a < b ? `${a}~${b}` : `${b}~${a}`
    if (emittedLink.has(key)) continue
    emittedLink.add(key)
    const speedMbps = Number.parseFloat(l.speed ?? '')
    links.push({
      id: `nce-link:${key}`,
      from: { node: fromNode, port: aPort },
      to: { node: toNode, port: zPort },
      arrow: 'none',
      ...(Number.isFinite(speedMbps) && speedMbps > 0 ? { rateBps: speedMbps * 1_000_000 } : {}),
    })
  }

  // Fallback: LLDP neighbor tables. Both ends report the same physical wire, so
  // a canonical endpoint-sorted key collapses the A→B / B→A duplicates.
  const ensureLldpPeer = (n: NceLldpNeighbor, discoveredBy: string): Node | undefined => {
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
        const toNode = managed?.id ? deviceNodeId(managed.id) : (peer?.id ?? '')
        // Same anchor rule as above: an unnamed far end gets its own anchor so
        // several neighbours of one peer don't pile onto a single point.
        const zPort = n.remoteIfName || (peer ? anchorOnPeer(peer, deviceId) : '')
        const a = `${deviceId}|${n.localIfName}`
        const b = `${managed?.id ?? toNode}|${zPort}`
        const key = a < b ? `${a}~${b}` : `${b}~${a}`
        if (emittedLink.has(key)) continue
        emittedLink.add(key)
        links.push({
          id: `nce-link:${key}`,
          from: { node: fromNode, port: n.localIfName },
          to: { node: toNode, port: zPort },
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
