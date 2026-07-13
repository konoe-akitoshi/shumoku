/**
 * Build a CV-CUE topology fragment: managed APs, their LLDP-discovered uplink
 * switches, and the AP↔switch wired links. This is the piece a wired-inventory
 * source (NetBox, Zabbix) doesn't have; shumoku's composition merges it in by
 * identity (the shared PoE switch collapses onto the NetBox switch node).
 */

import type { Link, NetworkGraph, Node } from '@shumoku/core'
import { buildIdentity, DeviceType } from '@shumoku/core'
import type { CvManagedDevice, CvSwitch, CvUplinkLanData } from './types.js'

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

export function buildTopology(aps: CvManagedDevice[], switches: CvSwitch[]): NetworkGraph {
  const nodes: Node[] = []
  const links: Link[] = []
  const emittedSwitch = new Set<string>()

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
    nodes.push({
      id: nodeId,
      label: [ap.name || key],
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

  return { version: '1.0.0', name: 'Arista CV-CUE', nodes, links }
}
