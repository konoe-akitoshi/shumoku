/**
 * Build a CV-CUE topology fragment: managed APs, their LLDP-discovered uplink
 * switches, and the AP↔switch wired links. This is the piece a wired-inventory
 * source (NetBox, Zabbix) doesn't have; shumoku's composition merges it in by
 * identity (the shared PoE switch collapses onto the NetBox switch node).
 */

import type { Link, NetworkGraph, Node, Subgraph } from '@shumoku/core'
import { buildIdentity, DeviceType } from '@shumoku/core'
import type {
  CvLocation,
  CvLocationRef,
  CvManagedDevice,
  CvSwitch,
  CvUplinkLanData,
} from './types.js'

/** Extract the numeric location id from a `{ id }` ref or a bare number. */
function locId(ref: CvLocationRef | number | undefined): number | undefined {
  if (typeof ref === 'number') return ref
  return ref?.id
}

interface LocInfo {
  name: string
  parent: number | undefined
}

/** Flatten the CV-CUE location tree into id → { name, parentId }. */
function indexLocations(root: CvLocation | undefined): Map<number, LocInfo> {
  const index = new Map<number, LocInfo>()
  const walk = (node: CvLocation | undefined, parent: number | undefined): void => {
    if (!node) return
    const id = locId(node.id)
    if (id !== undefined && id !== 0) index.set(id, { name: node.name ?? String(id), parent })
    for (const child of node.children ?? []) walk(child, id)
  }
  walk(root, undefined)
  return index
}

function locSubgraphId(id: number): string {
  return `cvcue-loc:${id}`
}

/** Node id for a switch, derived from its (stable) LLDP chassis id. */
function switchNodeId(chassisId: string): string {
  return `cvcue-sw:${chassisId.toLowerCase()}`
}

/** Node id for an AP. */
function apNodeId(boxIdOrMac: string): string {
  return `cvcue-ap:${boxIdOrMac}`
}

/** Stable id for an AP (boxId, else MAC) — the same key getHosts uses. */
function apKey(d: CvManagedDevice): string | undefined {
  return d.boxId !== undefined ? String(d.boxId) : d.macaddress
}

/** The AP's primary wired uplink (the LAN port that carries the switch link). */
export function primaryUplink(d: CvManagedDevice): CvUplinkLanData | undefined {
  const up = d.uplinkWiredInterfacesInfo
  if (!up) return undefined
  const candidates = [up.lan1Data, up.lan2Data].filter((l): l is CvUplinkLanData => !!l)
  return candidates.find((l) => l.switchChassisId) ?? candidates.find((l) => l.primaryInterface)
}

export function buildTopology(
  aps: CvManagedDevice[],
  switches: CvSwitch[],
  locations?: CvLocation,
): NetworkGraph {
  const nodes: Node[] = []
  const links: Link[] = []
  const subgraphs: Subgraph[] = []
  const emittedSwitch = new Set<string>()

  // Location subgraphs so APs group into their floor/zone instead of floating.
  // `identity: { name }` lets a wired source that names the same zone merge the
  // box (once it exposes subgraph identity); until then these are CV-CUE boxes.
  const locIndex = indexLocations(locations)
  const emittedLoc = new Set<number>()
  const ensureLocation = (id: number | undefined): string | undefined => {
    if (id === undefined) return undefined
    const info = locIndex.get(id)
    if (!info) return undefined
    if (!emittedLoc.has(id)) {
      emittedLoc.add(id)
      const parentSg = ensureLocation(info.parent) // materialize ancestors first
      subgraphs.push({
        id: locSubgraphId(id),
        label: info.name,
        identity: { name: info.name },
        ...(parentSg ? { parent: parentSg } : {}),
      })
    }
    return locSubgraphId(id)
  }

  const ensureSwitch = (chassisId: string, name?: string, vendor?: string): void => {
    const key = chassisId.toLowerCase()
    if (emittedSwitch.has(key)) return
    emittedSwitch.add(key)
    nodes.push({
      id: switchNodeId(chassisId),
      label: [name || chassisId],
      // chassisId is the LLDP chassis id (strong cross-source key); the LLDP
      // system name is self-reported, so it's a valid sysName for merging onto
      // a NetBox/Zabbix switch node.
      identity: buildIdentity({
        chassisId,
        ...(name ? { sysName: name } : {}),
        vendorIds: { 'cvcue-switch-chassis': chassisId },
      }),
      spec: {
        kind: 'hardware',
        type: DeviceType.L2Switch,
        ...(vendor ? { vendor: vendor.toLowerCase() } : {}),
      },
    })
  }

  // Seed switch nodes from the /switches inventory (so switches with no AP in
  // this scope still appear), then AP uplinks fill in / attach edges.
  for (const s of switches) {
    if (s.chassisId) ensureSwitch(s.chassisId, s.name, s.vendor)
  }

  for (const ap of aps) {
    const key = apKey(ap)
    if (!key) continue
    const nodeId = apNodeId(key)
    // Group the AP into its floor/zone. Switches deliberately get NO parent so
    // they merge onto the wired source's switch node (and keep its zone); the
    // AP is the node the wired inventory doesn't have, so it needs a home here.
    const parent = ensureLocation(locId(ap.locationId))
    nodes.push({
      id: nodeId,
      label: [ap.name || key],
      ...(parent ? { parent } : {}),
      identity: buildIdentity({
        mgmtIp: ap.ipAddress,
        mac: ap.macaddress,
        vendorIds: ap.boxId !== undefined ? { 'cvcue-boxid': String(ap.boxId) } : undefined,
      }),
      spec: {
        kind: 'hardware',
        type: DeviceType.AccessPoint,
        ...(ap.model ? { model: ap.model.toLowerCase() } : {}),
        ...(ap.vendorName ? { vendor: ap.vendorName.toLowerCase() } : {}),
      },
    })

    const uplink = primaryUplink(ap)
    if (uplink?.switchChassisId) {
      ensureSwitch(uplink.switchChassisId, uplink.switchName, uplink.switchVendor)
      const speedMbps = uplink.linkSpeed ?? ap.uplinkWiredInterfacesInfo?.sensorLinkSpeed
      links.push({
        id: `cvcue-link:${nodeId}`,
        // The AP-side port name doubles as the mappable interface (getHostItems
        // exposes the same name), so link metrics can bind to it.
        from: { node: nodeId, port: uplink.name || 'uplink' },
        to: { node: switchNodeId(uplink.switchChassisId), port: uplink.switchPortId || '' },
        arrow: 'none',
        ...(speedMbps ? { rateBps: speedMbps * 1_000_000 } : {}),
      })
    }
  }

  return {
    version: '1.0.0',
    name: 'Arista CV-CUE',
    nodes,
    links,
    ...(subgraphs.length > 0 ? { subgraphs } : {}),
  }
}
