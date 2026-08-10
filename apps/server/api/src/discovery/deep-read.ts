// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Discovery deep-read — reading a *known* device in depth over SNMP.
 *
 * This is a shumoku built-in, not a data-source plugin. A plugin (or an ARP
 * sweep) establishes that a device EXISTS and gives it a "notice" identity;
 * deep-read is what turns that notice into a "synced" node — its ports, model,
 * and, decisively, its LLDP neighbours, which is where the switch-to-switch
 * backbone comes from. It runs against devices the operator has given a
 * credential (`access:snmp`), driven by the Discovery surface's Rescan button
 * and the scheduler, and its output is recorded as an observation that merges
 * onto whatever else knows the device (by chassis MAC / mgmtIp).
 *
 * The SNMP execution primitives (`snmp-client`, `mib`) live beside this file so
 * the whole capability is server-side; no plugin is involved in reading a
 * device over SNMP.
 */

import { builtinEntries, Catalog, type CatalogEntry, vendorFromOid } from '@shumoku/catalog'
import {
  type Attachment,
  buildIdentity,
  type Identity,
  type Link,
  type NetworkGraph,
  type Node,
  type NodePort,
  type NodeSpec,
  normalizeMacKey,
} from '@shumoku/core'
import {
  ENTITY_CLASS_CHASSIS,
  ENTITY_TABLE,
  IF_TABLE,
  IF_X_TABLE,
  LLDP_LOC_CHASSIS_ID,
  LLDP_REM_TABLE,
  SYSTEM_MIB,
} from './mib.js'
import {
  asMacString,
  asNumber,
  asString,
  indexByRow,
  SnmpClient,
  type VarbindLike,
} from './snmp-client.js'

/** One device to read, with the credential resolved for it. */
export interface DeepReadTarget {
  address: string
  community: string
  timeoutMs?: number
}

export interface DeepReadResult {
  graph: NetworkGraph
  warnings: string[]
  /** How many targets answered SNMP and were read. */
  readCount: number
  /** True when a device we were asked to read failed mid-walk (data missing,
   *  not merely absent) — drives the `partial` vs `ok` observation status. */
  partial: boolean
}

interface VisitedDevice {
  nodeId: string
  identity: Identity
  community: string
  sysName?: string
  sysDescr?: string
  vendor?: string
  catalogEntry?: CatalogEntry
  sysObjectID?: string
  chassisModel?: string
  ports: Map<string, NodePort>
}

let _catalog: Catalog | null = null
function getCatalog(): Catalog {
  if (!_catalog) {
    const c = new Catalog()
    c.registerAll(builtinEntries)
    _catalog = c
  }
  return _catalog
}

/**
 * Read every target over SNMP and return one graph of the devices read plus the
 * LLDP links between them (and to switches they name but we didn't read).
 * Never throws: a device that fails to answer is skipped with a warning, so one
 * unreachable switch never sinks the batch.
 */
export async function deepReadDevices(
  targets: DeepReadTarget[],
  sourceId: string,
): Promise<DeepReadResult> {
  const warnings: string[] = []
  const visited = new Map<string, VisitedDevice>() // address → device
  let partial = false

  for (const target of targets) {
    const client = new SnmpClient({
      address: target.address,
      community: target.community,
      timeoutMs: target.timeoutMs ?? 2000,
    })
    try {
      visited.set(target.address, await scanOne(client, target.address, sourceId, target.community))
    } catch (err) {
      partial = true
      warnings.push(
        `SNMP read ${target.address}: ${err instanceof Error ? err.message : String(err)}`,
      )
    } finally {
      client.close()
    }
  }

  // LLDP pass — resolve neighbours by chassis id (unique) rather than sysName
  // (which Maipu answers with its model, identical across every switch).
  const byChassis = new Map<string, VisitedDevice>()
  for (const device of visited.values()) {
    if (device.identity.chassisId) byChassis.set(device.identity.chassisId, device)
  }
  const lldpPeers = new Map<string, Node>()
  const links: Link[] = []
  for (const [address, device] of visited) {
    const client = new SnmpClient({
      address,
      community: device.community,
      timeoutMs: targetTimeout(targets, address),
    })
    try {
      links.push(...(await fetchLldpNeighbors(client, device, byChassis, lldpPeers, sourceId)))
    } catch (err) {
      partial = true
      warnings.push(`LLDP walk ${address}: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      client.close()
    }
  }

  return {
    graph: {
      version: '1.0',
      nodes: [
        ...Array.from(visited.values()).map((d) => visitedToNode(d, sourceId)),
        ...lldpPeers.values(),
      ],
      links,
    },
    warnings,
    readCount: visited.size,
    partial,
  }
}

function targetTimeout(targets: DeepReadTarget[], address: string): number {
  return targets.find((t) => t.address === address)?.timeoutMs ?? 2000
}

async function scanOne(
  client: SnmpClient,
  address: string,
  sourceId: string,
  community: string,
): Promise<VisitedDevice> {
  const sys = await client.get([
    SYSTEM_MIB.sysName,
    SYSTEM_MIB.sysObjectID,
    SYSTEM_MIB.sysDescr,
    LLDP_LOC_CHASSIS_ID,
  ])
  const sysName = asString(sys[0]?.value)
  const sysObjectID = asString(sys[1]?.value)
  const sysDescr = asString(sys[2]?.value)
  const lldpLocChassis = asMacString(sys[3]?.value)

  const [physClasses, physSerials, physModels, ifDescrs, ifNames, ifMacs] = await Promise.all([
    client
      .walk(ENTITY_TABLE.entPhysicalClass)
      .then((vbs) => indexByRow(vbs, ENTITY_TABLE.entPhysicalClass)),
    client
      .walk(ENTITY_TABLE.entPhysicalSerialNum)
      .then((vbs) => indexByRow(vbs, ENTITY_TABLE.entPhysicalSerialNum)),
    client
      .walk(ENTITY_TABLE.entPhysicalModelName)
      .then((vbs) => indexByRow(vbs, ENTITY_TABLE.entPhysicalModelName)),
    client.walk(IF_TABLE.ifDescr).then((vbs) => indexByRow(vbs, IF_TABLE.ifDescr)),
    client.walk(IF_X_TABLE.ifName).then((vbs) => indexByRow(vbs, IF_X_TABLE.ifName)),
    client.walk(IF_TABLE.ifPhysAddress).then((vbs) => indexByRow(vbs, IF_TABLE.ifPhysAddress)),
  ])

  const chassisIdx = Object.entries(physClasses).find(
    ([, v]) => asNumber(v) === ENTITY_CLASS_CHASSIS,
  )?.[0]
  const chassisSerial = chassisIdx ? asString(physSerials[chassisIdx]) : undefined
  const chassisModel = chassisIdx ? asString(physModels[chassisIdx]) : undefined

  let baseMac: string | undefined
  if (!chassisSerial) {
    for (const idx of Object.keys(ifMacs).sort((a, b) => Number(a) - Number(b))) {
      const mac = asMacString(ifMacs[idx])
      if (mac && mac !== '00:00:00:00:00:00') {
        baseMac = mac
        break
      }
    }
  }
  // LLDP chassis id wins — it is what neighbours cite and what other sources key
  // on, so it merges. ENTITY serial / base MAC are fallbacks for non-LLDP gear.
  const chassisId = lldpLocChassis ? normalizeMacKey(lldpLocChassis) : (chassisSerial ?? baseMac)

  const catalogEntry =
    (sysObjectID ? getCatalog().findBySysObjectId(sysObjectID) : undefined) ??
    (chassisModel ? getCatalog().findByPartNumber(chassisModel) : undefined)
  const vendor =
    catalogEntry?.spec.vendor ??
    (sysObjectID ? (vendorFromOid(sysObjectID) ?? undefined) : undefined)

  const identity: Identity = { mgmtIp: address, sysName, ...(chassisId ? { chassisId } : {}) }

  const ports = new Map<string, NodePort>()
  for (const [ifIndex, descr] of Object.entries(ifDescrs)) {
    const ifName = asString(ifNames[ifIndex]) ?? asString(descr)
    if (!ifName) continue
    const mac = asMacString(ifMacs[ifIndex])
    ports.set(ifIndex, {
      id: `${sourceId}:port:${address}:${ifIndex}`,
      label: ifName,
      interfaceName: ifName,
      connectors: [],
      identity: {
        ifName,
        ifIndex: Number(ifIndex),
        mac: mac && mac !== '00:00:00:00:00:00' ? mac : undefined,
      },
      provenance: { source: sourceId },
    })
  }

  return {
    nodeId: `${sourceId}:node:${address}`,
    identity,
    community,
    sysName,
    sysDescr,
    vendor,
    catalogEntry,
    sysObjectID,
    chassisModel,
    ports,
  }
}

function visitedToNode(device: VisitedDevice, sourceId: string): Node {
  const labelParts: string[] = []
  if (device.sysName) labelParts.push(device.sysName)
  else if (device.identity.mgmtIp) labelParts.push(device.identity.mgmtIp)

  const spec: NodeSpec | undefined = device.catalogEntry
    ? {
        ...device.catalogEntry.spec,
        ...(device.catalogEntry.icon ? { icon: device.catalogEntry.icon } : {}),
      }
    : device.vendor
      ? { kind: 'hardware', vendor: device.vendor }
      : undefined

  // The credential this device was actually read with — recorded so a green
  // (synced) node is honest and the scheduler resolves the same value back.
  const accessAttachment: Attachment = {
    kind: 'access',
    protocol: 'snmp',
    community: device.community,
  }

  return {
    id: device.nodeId,
    label: labelParts.length > 0 ? labelParts : (device.identity.mgmtIp ?? 'unknown'),
    identity: device.identity,
    ...(spec ? { spec } : {}),
    attachments: [accessAttachment],
    metadata: {
      syncState: 'synced',
      readVia: 'snmp',
      vendor: device.vendor,
      sysDescr: device.sysDescr,
      catalogId: device.catalogEntry?.id,
      sysObjectID: device.sysObjectID,
      chassisModel: device.chassisModel,
    },
    ports: Array.from(device.ports.values()),
    provenance: { source: sourceId, observedAt: Date.now() },
  }
}

async function fetchLldpNeighbors(
  client: SnmpClient,
  device: VisitedDevice,
  byChassis: Map<string, VisitedDevice>,
  lldpPeers: Map<string, Node>,
  sourceId: string,
): Promise<Link[]> {
  const [chassisIds, portIds, sysNames] = await Promise.all([
    client
      .walk(LLDP_REM_TABLE.lldpRemChassisId)
      .then((vbs) => indexByRow(vbs, LLDP_REM_TABLE.lldpRemChassisId)),
    client
      .walk(LLDP_REM_TABLE.lldpRemPortId)
      .then((vbs) => indexByRow(vbs, LLDP_REM_TABLE.lldpRemPortId)),
    client
      .walk(LLDP_REM_TABLE.lldpRemSysName)
      .then((vbs) => indexByRow(vbs, LLDP_REM_TABLE.lldpRemSysName)),
  ])

  const links: Link[] = []
  for (const rowSuffix of Object.keys(chassisIds)) {
    const parts = rowSuffix.split('.')
    if (parts.length < 3) continue
    const localPortNum = parts[1]
    if (!localPortNum) continue
    // The LLDP local-port number is not the IF-MIB ifIndex on every device —
    // Maipu's IS230 numbers them independently — so the local port often won't
    // resolve. That must NOT drop the link: which switch connects to which is
    // the backbone, and it is worth far more than the exact local port. Anchor
    // on the node (empty port) when the port can't be matched.
    const localPort = device.ports.get(localPortNum)

    const remoteChassisRaw = asMacString(chassisIds[rowSuffix])
    if (!remoteChassisRaw) continue
    const remoteChassis = normalizeMacKey(remoteChassisRaw)
    const remoteSysName = asString(sysNames[rowSuffix])
    const remotePortId = asString(portIds[rowSuffix])

    const visitedPeer = byChassis.get(remoteChassis)
    let toNodeId: string
    let toPortId: string | undefined
    if (visitedPeer && visitedPeer !== device) {
      toNodeId = visitedPeer.nodeId
      if (remotePortId) {
        for (const p of visitedPeer.ports.values()) {
          if (p.identity?.ifName === remotePortId || p.interfaceName === remotePortId) {
            toPortId = p.id
            break
          }
        }
      }
    } else if (!visitedPeer) {
      const peer = ensureLldpPeer(lldpPeers, remoteChassis, remoteSysName, sourceId)
      toNodeId = peer.id
      toPortId = remotePortId ? anchorPeerPort(peer, remotePortId) : undefined
    } else {
      continue // a device's own chassis echoed back — not a wire
    }

    links.push({
      from: { node: device.nodeId, port: localPort?.id ?? '' },
      to: { node: toNodeId, port: toPortId ?? '' },
      provenance: { source: sourceId, observedAt: Date.now() },
      metadata: { lldpRemoteChassis: remoteChassis },
    })
  }
  return links
}

/**
 * A chassis-keyed node for a switch a device named over LLDP but that we did not
 * read this pass. Both `chassisId` and `mac` are that MAC, so it merges onto the
 * same switch seen by a controller (chassis id) or an ARP sweep (mac). The
 * model-as-sysName Maipu reports stays only as the label, never a key.
 */
function ensureLldpPeer(
  lldpPeers: Map<string, Node>,
  chassis: string,
  sysName: string | undefined,
  sourceId: string,
): Node {
  const existing = lldpPeers.get(chassis)
  if (existing) return existing
  const node: Node = {
    id: `${sourceId}:node:lldp:${chassis}`,
    label: sysName || chassis,
    identity: buildIdentity({ chassisId: chassis, mac: chassis }) ?? { chassisId: chassis },
    metadata: { syncState: 'notice' },
    provenance: { source: sourceId, observedAt: Date.now() },
  }
  lldpPeers.set(chassis, node)
  return node
}

/** Add (once) the far-end port a neighbour reported, so the link anchors to a
 *  named port on the peer rather than the bare node. */
function anchorPeerPort(peer: Node, ifName: string): string {
  const id = `${peer.id}:port:${ifName}`
  if (!peer.ports?.some((p) => p.id === id)) {
    peer.ports = [
      ...(peer.ports ?? []),
      { id, label: ifName, interfaceName: ifName, connectors: [] },
    ]
  }
  return id
}

// Re-export for tests / callers that assemble varbinds themselves.
export type { VarbindLike }
