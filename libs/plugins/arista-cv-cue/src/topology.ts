/**
 * Build a CV-CUE topology fragment: managed APs, their LLDP-discovered uplink
 * switches, and the AP↔switch wired links. This is the piece a wired-inventory
 * source (NetBox, Zabbix) doesn't have; shumoku's composition merges it in by
 * identity (the shared PoE switch collapses onto the NetBox switch node).
 */

import type { inputModel, SourceNetwork } from '@shumoku/core'
import { buildIdentity, DeviceType, rateFromBps } from '@shumoku/core'
import type {
  CvLocation,
  CvLocationRef,
  CvManagedDevice,
  CvSwitch,
  CvUplinkLanData,
} from './types.js'

type ObservedNode = NonNullable<NonNullable<SourceNetwork['observation']>['nodes']>[string]

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

/** `vendor/model`, `vendor` alone, or `?/model` when only the model is known. */
function productOf(vendor: string | undefined, model: string | undefined): string | undefined {
  if (vendor && model) return `${vendor}/${model}`
  if (vendor) return vendor
  return model ? `?/${model}` : undefined
}

/** The AP's primary wired uplink (the LAN port that carries the switch link). */
export function primaryUplink(d: CvManagedDevice): CvUplinkLanData | undefined {
  const up = d.uplinkWiredInterfacesInfo
  if (!up) return undefined
  const candidates = [up.lan1Data, up.lan2Data].filter((l): l is CvUplinkLanData => !!l)
  // CV-CUE can retain LLDP data on an inactive/non-primary LAN port. Prefer
  // the port explicitly marked primary; otherwise the first port carrying a
  // real switch identity would incorrectly win merely because LAN1 is listed
  // before LAN2 (for example eth0 over the active eth1 uplink).
  return candidates.find((l) => l.primaryInterface) ?? candidates.find((l) => l.switchChassisId)
}

interface Loc {
  id: number
  label: string
  parent: number | undefined
}

/** Nest the flat location list into the group tree the network wants. */
function nestGroups(locs: readonly Loc[], parent?: number): inputModel.Group[] {
  return locs
    .filter((l) => l.parent === parent)
    .map((l) => {
      const children = nestGroups(locs, l.id)
      return {
        id: locSubgraphId(l.id),
        label: l.label,
        ...(children.length > 0 ? { groups: children } : {}),
      }
    })
}

export function buildTopology(
  aps: CvManagedDevice[],
  switches: CvSwitch[],
  locations?: CvLocation,
): SourceNetwork {
  const nodes: inputModel.Node[] = []
  const links: inputModel.Link[] = []
  const observedNodes: Record<string, ObservedNode> = {}
  const observedGroups: Record<string, { identity: { name: string } }> = {}
  const drawnLinks: Record<string, { arrow: 'none' }> = {}
  const locs: Loc[] = []
  const emittedSwitch = new Set<string>()

  // Location groups so APs group into their floor/zone instead of floating.
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
      ensureLocation(info.parent) // materialize ancestors first
      const parent =
        info.parent !== undefined && locIndex.has(info.parent) ? info.parent : undefined
      locs.push({ id, label: info.name, parent })
      observedGroups[locSubgraphId(id)] = { identity: { name: info.name } }
    }
    return locSubgraphId(id)
  }

  const ensureSwitch = (chassisId: string, name?: string, vendor?: string): void => {
    const key = chassisId.toLowerCase()
    if (emittedSwitch.has(key)) return
    emittedSwitch.add(key)
    const id = switchNodeId(chassisId)
    const product = productOf(vendor?.toLowerCase(), undefined)
    nodes.push({
      id,
      label: name || chassisId,
      type: DeviceType.L2Switch,
      ...(product ? { product } : {}),
    })
    // chassisId is the LLDP chassis id (strong cross-source key); the LLDP
    // system name is self-reported, so it's a valid sysName for merging onto
    // a NetBox/Zabbix switch node.
    observedNodes[id] = {
      identity: buildIdentity({
        chassisId,
        ...(name ? { sysName: name } : {}),
        vendorIds: { 'cvcue-switch-chassis': chassisId },
      }),
    }
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
    // Group the AP into its floor/zone. Switches deliberately get NO group so
    // they merge onto the wired source's switch node (and keep its zone); the
    // AP is the node the wired inventory doesn't have, so it needs a home here.
    const group = ensureLocation(locId(ap.locationId))
    const product = productOf(ap.vendorName?.toLowerCase(), ap.model?.toLowerCase())
    nodes.push({
      id: nodeId,
      label: ap.name || key,
      type: DeviceType.AccessPoint,
      ...(product ? { product } : {}),
      ...(group ? { group } : {}),
    })
    observedNodes[nodeId] = {
      identity: buildIdentity({
        mgmtIp: ap.ipAddress,
        mac: ap.macaddress,
        vendorIds: ap.boxId !== undefined ? { 'cvcue-boxid': String(ap.boxId) } : undefined,
      }),
    }

    // Emit the AP's wired uplink — but skip the phantom `localhost` switch. An
    // inactive AP's `uplinkWiredInterfacesInfo` is a frozen pre-recabling
    // snapshot: 44 dormant APs all report `switchName:"localhost"` fanning into
    // a handful of shared phantom ports, which is both wrong (that switch does
    // not exist) and unroutable (many links into one port → Bezier curve storm).
    // A live AP reports its real switch; only real uplinks become edges. APs
    // left link-less this way still render (hideDisconnected is off for this
    // topology) and rejoin the fabric once they come online.
    const uplink = primaryUplink(ap)
    if (uplink?.switchChassisId && uplink.switchName?.toLowerCase() !== 'localhost') {
      ensureSwitch(uplink.switchChassisId, uplink.switchName, uplink.switchVendor)
      const speedMbps = uplink.linkSpeed ?? ap.uplinkWiredInterfacesInfo?.sensorLinkSpeed
      const linkId = `cvcue-link:${nodeId}`
      links.push({
        id: linkId,
        // The AP-side port name doubles as the mappable interface (getHostItems
        // exposes the same name), so link metrics can bind to it.
        endpoints: [
          { node: nodeId, port: uplink.name || 'uplink' },
          {
            node: switchNodeId(uplink.switchChassisId),
            ...(uplink.switchPortId ? { port: uplink.switchPortId } : {}),
          },
        ],
        ...(speedMbps ? { speed: rateFromBps(speedMbps * 1_000_000) } : {}),
      })
      drawnLinks[linkId] = { arrow: 'none' }
    }
  }

  return {
    network: {
      name: 'Arista CV-CUE',
      nodes,
      links,
      ...(locs.length > 0 ? { groups: nestGroups(locs) } : {}),
    },
    observation: {
      nodes: observedNodes,
      ...(locs.length > 0 ? { groups: observedGroups } : {}),
    },
    ...(Object.keys(drawnLinks).length > 0 ? { drawing: { links: drawnLinks } } : {}),
  }
}
