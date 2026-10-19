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
  buildIdentity,
  type DrawingLayer,
  type Identity,
  type inputModel,
  type LinkObservation,
  type NodeObservation,
  normalizeMacKey,
  type PortDesign,
  type PortObservation,
  type SourceNetwork,
  specDeviceType,
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
  /** The devices read and the LLDP links between them, keyed by this source's own ids. */
  source: SourceNetwork
  warnings: string[]
  /** How many targets answered SNMP and were read. */
  readCount: number
  /** True when a device we were asked to read failed mid-walk (data missing,
   *  not merely absent) — drives the `partial` vs `ok` observation status. */
  partial: boolean
}

/** One interface of a read device. */
interface VisitedPort {
  /** The name a link end writes for this port, and the key of its layer entries. */
  name: string
  ifName: string
  ifIndex: number
  mac?: string
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
  /** By ifIndex. */
  ports: Map<string, VisitedPort>
}

/** A switch named over LLDP that was not read this pass. */
interface LldpPeer {
  node: inputModel.Node
  observation: NodeObs
  /** Far-end ports a neighbour reported, by name. */
  ports: Set<string>
}

type LinkEnd = { node: string; port: string }

/** One LLDP-reported wire, before it is given an id. */
interface Wire {
  from: LinkEnd
  to: LinkEnd
  remoteChassis: string
}

type NodeObs = NodeObservation & {
  ports?: Record<string, PortObservation>
  metadata?: Record<string, unknown>
}
type LinkObs = LinkObservation & { metadata?: Record<string, unknown> }

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
 * Read every target over SNMP and return one network of the devices read plus the
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
  const observedAt = Date.now()

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
  const lldpPeers = new Map<string, LldpPeer>()
  const wires: Wire[] = []
  for (const [address, device] of visited) {
    const client = new SnmpClient({
      address,
      community: device.community,
      timeoutMs: targetTimeout(targets, address),
    })
    try {
      wires.push(...(await fetchLldpNeighbors(client, device, byChassis, lldpPeers, sourceId)))
    } catch (err) {
      partial = true
      warnings.push(`LLDP walk ${address}: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      client.close()
    }
  }

  const nodes: inputModel.Node[] = []
  const obsNodes: Record<string, NodeObs> = {}
  const designNodes: Record<string, { ports: Record<string, PortDesign> }> = {}
  const drawingNodes: Record<string, { icon: string }> = {}
  for (const device of visited.values()) {
    const read = visitedToNode(device, sourceId, observedAt)
    nodes.push(read.node)
    obsNodes[read.node.id] = read.observation
    designNodes[read.node.id] = { ports: read.designPorts }
    if (read.icon) drawingNodes[read.node.id] = { icon: read.icon }
  }
  for (const peer of lldpPeers.values()) {
    nodes.push(peer.node)
    obsNodes[peer.node.id] = peer.observation
    const ports: Record<string, PortDesign> = {}
    for (const name of peer.ports) {
      ports[name] = { label: name, interfaceName: name, connectors: [] }
    }
    designNodes[peer.node.id] = { ports }
  }

  // A link's id follows its ends, so a re-read of the same wire lands on the same entry.
  const links: inputModel.Link[] = []
  const obsLinks: Record<string, LinkObs> = {}
  const usedIds = new Set<string>()
  for (const wire of wires) {
    const base = `${sourceId}:link:${wire.from.node}:${wire.from.port}--${wire.to.node}:${wire.to.port}`
    let id = base
    for (let n = 2; usedIds.has(id); n++) id = `${base}#${n}`
    usedIds.add(id)
    links.push({ id, endpoints: [endOf(wire.from), endOf(wire.to)] })
    obsLinks[id] = {
      provenance: { source: sourceId, observedAt },
      metadata: { lldpRemoteChassis: wire.remoteChassis },
    }
  }

  const drawing: DrawingLayer | undefined =
    Object.keys(drawingNodes).length > 0 ? { nodes: drawingNodes } : undefined
  return {
    source: {
      network: { nodes, links },
      observation: { nodes: obsNodes, links: obsLinks },
      design: { nodes: designNodes },
      ...(drawing ? { drawing } : {}),
    },
    warnings,
    readCount: visited.size,
    partial,
  }
}

function endOf(end: LinkEnd): inputModel.NodeEnd {
  return end.port ? { node: end.node, port: end.port } : { node: end.node }
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

  const ports = new Map<string, VisitedPort>()
  const taken = new Set<string>()
  for (const [ifIndex, descr] of Object.entries(ifDescrs)) {
    const ifName = asString(ifNames[ifIndex]) ?? asString(descr)
    if (!ifName) continue
    const mac = asMacString(ifMacs[ifIndex])
    // Ports are keyed by name; an ifName another row already took keeps its ifIndex apart.
    const name = taken.has(ifName) ? `${ifName}#${ifIndex}` : ifName
    taken.add(name)
    ports.set(ifIndex, {
      name,
      ifName,
      ifIndex: Number(ifIndex),
      ...(mac && mac !== '00:00:00:00:00:00' ? { mac } : {}),
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

/** `vendor/model`, `vendor`, or `?/model`; undefined when neither is known. */
function productOf(vendor: string | undefined, model: string | undefined): string | undefined {
  if (vendor) return model ? `${vendor}/${model}` : vendor
  return model ? `?/${model}` : undefined
}

function visitedToNode(
  device: VisitedDevice,
  sourceId: string,
  observedAt: number,
): {
  node: inputModel.Node
  observation: NodeObs
  designPorts: Record<string, PortDesign>
  icon?: string
} {
  const spec = device.catalogEntry?.spec
  const vendor = spec?.vendor ?? device.vendor
  const model = spec?.kind === 'hardware' ? spec.model : undefined
  const type = specDeviceType(spec)
  const product = productOf(vendor, model)
  const icon = device.catalogEntry?.icon ?? spec?.icon

  const obsPorts: Record<string, PortObservation> = {}
  const designPorts: Record<string, PortDesign> = {}
  for (const port of device.ports.values()) {
    obsPorts[port.name] = {
      identity: {
        ifName: port.ifName,
        ifIndex: port.ifIndex,
        ...(port.mac ? { mac: port.mac } : {}),
      },
      provenance: { source: sourceId },
    }
    designPorts[port.name] = { label: port.ifName, interfaceName: port.ifName, connectors: [] }
  }

  // NOTE: the credential the device was read with is deliberately NOT baked
  // into the observed node. Credentials are Discovery feature config
  // (`deep_read_config`, keyed by entity), not an observation — baking them in
  // was how config data leaked into the composition pipeline.
  return {
    node: {
      id: device.nodeId,
      label: device.sysName ?? device.identity.mgmtIp ?? 'unknown',
      ...(type ? { type } : {}),
      ...(product ? { product } : {}),
    },
    observation: {
      identity: device.identity,
      metadata: {
        syncState: 'synced',
        readVia: 'snmp',
        vendor: device.vendor,
        sysDescr: device.sysDescr,
        catalogId: device.catalogEntry?.id,
        sysObjectID: device.sysObjectID,
        chassisModel: device.chassisModel,
      },
      ports: obsPorts,
      provenance: { source: sourceId, observedAt },
    },
    designPorts,
    ...(icon ? { icon } : {}),
  }
}

async function fetchLldpNeighbors(
  client: SnmpClient,
  device: VisitedDevice,
  byChassis: Map<string, VisitedDevice>,
  lldpPeers: Map<string, LldpPeer>,
  sourceId: string,
): Promise<Wire[]> {
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

  const wires: Wire[] = []
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
    let toPort: string | undefined
    if (visitedPeer && visitedPeer !== device) {
      toNodeId = visitedPeer.nodeId
      if (remotePortId) {
        for (const p of visitedPeer.ports.values()) {
          if (p.ifName === remotePortId) {
            toPort = p.name
            break
          }
        }
      }
    } else if (!visitedPeer) {
      const peer = ensureLldpPeer(lldpPeers, remoteChassis, remoteSysName, sourceId)
      toNodeId = peer.node.id
      if (remotePortId) {
        peer.ports.add(remotePortId)
        toPort = remotePortId
      }
    } else {
      continue // a device's own chassis echoed back — not a wire
    }

    wires.push({
      from: { node: device.nodeId, port: localPort?.name ?? '' },
      to: { node: toNodeId, port: toPort ?? '' },
      remoteChassis,
    })
  }
  return wires
}

/**
 * A chassis-keyed node for a switch a device named over LLDP but that we did not
 * read this pass. Both `chassisId` and `mac` are that MAC, so it merges onto the
 * same switch seen by a controller (chassis id) or an ARP sweep (mac). The
 * model-as-sysName Maipu reports stays only as the label, never a key.
 */
function ensureLldpPeer(
  lldpPeers: Map<string, LldpPeer>,
  chassis: string,
  sysName: string | undefined,
  sourceId: string,
): LldpPeer {
  const existing = lldpPeers.get(chassis)
  if (existing) return existing
  const peer: LldpPeer = {
    node: { id: `${sourceId}:node:lldp:${chassis}`, label: sysName || chassis },
    observation: {
      identity: buildIdentity({ chassisId: chassis, mac: chassis }) ?? { chassisId: chassis },
      metadata: { syncState: 'notice' },
      provenance: { source: sourceId, observedAt: Date.now() },
    },
    ports: new Set(),
  }
  lldpPeers.set(chassis, peer)
  return peer
}

// Re-export for tests / callers that assemble varbinds themselves.
export type { VarbindLike }
