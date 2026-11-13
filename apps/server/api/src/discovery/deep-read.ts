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
 * onto whatever else knows the device (by chassis MAC / address, the attributes the node
 * writes).
 *
 * The SNMP execution primitives (`snmp-client`, `mib`) live beside this file so
 * the whole capability is server-side; no plugin is involved in reading a
 * device over SNMP.
 */

import { builtinEntries, Catalog, type CatalogEntry, vendorFromOid } from '@shumoku/catalog'
import {
  type DeviceAttributes,
  type DrawingLayer,
  deviceAttributes,
  type inputModel,
  type LinkObservation,
  mapWithConcurrency,
  type NodeObservation,
  normalizeMacKey,
  type PortObservation,
  rateFromBps,
  type SourceNetwork,
  specDeviceType,
} from '@shumoku/core'
import { decodeChassisId, decodePortId, type LldpId, portNameOf } from './lldp-id.js'
import {
  ENTITY_CLASS_CHASSIS,
  ENTITY_TABLE,
  IF_TABLE,
  IF_X_TABLE,
  LLDP_LOC_CHASSIS_ID,
  LLDP_LOC_CHASSIS_ID_SUBTYPE,
  LLDP_LOC_PORT_TABLE,
  LLDP_REM_TABLE,
  SYSTEM_MIB,
} from './mib.js'
import {
  asMacString,
  asNumber,
  asString,
  indexByRow,
  SnmpClient,
  type SnmpTarget,
  type VarbindLike,
} from './snmp-client.js'

/** What deep-read needs of an SNMP client. */
export type DeepReadClient = Pick<SnmpClient, 'get' | 'walk' | 'close'>

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
  /** The nodes of the devices whose LLDP table was read, so whose links this result states. */
  linksRead: string[]
  /** True when a device we were asked to read failed mid-walk (data missing,
   *  not merely absent) — drives the `partial` vs `ok` observation status. */
  partial: boolean
  /** How each target's read went, by address. */
  outcomes: DeepReadOutcome[]
}

export interface DeepReadOutcome {
  address: string
  /** `partial` = the device answered but a later walk (LLDP) failed. */
  status: 'ok' | 'partial' | 'failed'
  error?: string
}

/** One interface of a read device. */
export interface VisitedPort {
  /** The name a link end writes for this port, and the key of its layer entries. */
  name: string
  ifName: string
  ifIndex: number
  mac?: string
  /** The rate the interface runs at (bits/sec); absent when it is down or reports none. */
  speedBps?: number
}

export interface VisitedDevice {
  nodeId: string
  /** What the device is recognized by, as its node writes it: address, sysName, chassisId. */
  attributes: DeviceAttributes
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

/** Devices read at once. Bounded so a large segment does not open hundreds of sockets. */
const READ_CONCURRENCY = 8

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
 * Say why a read failed in terms an operator can act on. net-snmp reports a
 * wrong community and a dead host the same way (a timeout), and a refused
 * send as a bare socket error; the raw message stays in parentheses.
 */
export function describeReadError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err)
  if (/timed? ?out/i.test(raw)) {
    return `No response (timed out) — check the address, the community, and that SNMP is enabled on the device (${raw})`
  }
  if (/^send\s/i.test(raw) || /ECONNREFUSED|EHOSTUNREACH|ENETUNREACH|EACCES/i.test(raw)) {
    return `Cannot reach the device on the SNMP port — check the address and any firewall (${raw})`
  }
  return raw
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
  createClient: (target: SnmpTarget) => DeepReadClient = (target) => new SnmpClient(target),
): Promise<DeepReadResult> {
  const warnings: string[] = []
  const visited = new Map<string, VisitedDevice>() // address → device
  const outcomes = new Map<string, DeepReadOutcome>() // address → how its read went
  let partial = false
  const observedAt = Date.now()
  const messageOf = describeReadError

  // Devices are read in parallel (bounded) — one that never answers must not
  // hold up the rest — and folded back in the order given, so the result does
  // not depend on which answered first.
  const scans = await mapWithConcurrency(targets, READ_CONCURRENCY, async (target) => {
    const client = createClient({
      address: target.address,
      community: target.community,
      timeoutMs: target.timeoutMs ?? 2000,
    })
    try {
      return {
        target,
        device: await scanOne(client, target.address, sourceId, target.community),
      }
    } catch (err) {
      return { target, error: messageOf(err) }
    } finally {
      client.close()
    }
  })
  for (const scan of scans) {
    const { address } = scan.target
    if (scan.device) {
      visited.set(address, scan.device)
      outcomes.set(address, { address, status: 'ok' })
    } else {
      partial = true
      const error = scan.error ?? 'read failed'
      warnings.push(`SNMP read ${address}: ${error}`)
      outcomes.set(address, { address, status: 'failed', error })
    }
  }

  // LLDP pass — resolve neighbours by chassis id (unique) rather than sysName
  // (which Maipu answers with its model, identical across every switch).
  const byChassis = new Map<string, VisitedDevice>()
  for (const device of visited.values()) {
    if (device.attributes.chassisId) byChassis.set(device.attributes.chassisId, device)
  }
  const lldpPeers = new Map<string, LldpPeer>()
  const lldp = await mapWithConcurrency(
    [...visited],
    READ_CONCURRENCY,
    async ([address, device]) => {
      const client = createClient({
        address,
        community: device.community,
        timeoutMs: targetTimeout(targets, address),
      })
      try {
        const read = await fetchLldpNeighbors(client, device, byChassis, lldpPeers, sourceId)
        return { address, nodeId: device.nodeId, wires: read }
      } catch (err) {
        return { address, nodeId: device.nodeId, wires: [] as Wire[], error: messageOf(err) }
      } finally {
        client.close()
      }
    },
  )
  const wires: Wire[] = []
  const linksRead: string[] = []
  for (const result of lldp) {
    wires.push(...result.wires)
    if (result.error === undefined) {
      linksRead.push(result.nodeId)
    } else {
      partial = true
      warnings.push(`LLDP walk ${result.address}: ${result.error}`)
      outcomes.set(result.address, {
        address: result.address,
        status: 'partial',
        error: `LLDP: ${result.error}`,
      })
    }
  }

  const nodes: inputModel.Node[] = []
  const obsNodes: Record<string, NodeObs> = {}
  const drawingNodes: Record<string, { icon: string }> = {}
  for (const device of visited.values()) {
    const read = visitedToNode(device, sourceId, observedAt)
    nodes.push(read.node)
    obsNodes[read.node.id] = read.observation
    if (read.icon) drawingNodes[read.node.id] = { icon: read.icon }
  }
  for (const peer of lldpPeers.values()) {
    // A far-end port a neighbour reported: named as the neighbour named it.
    const ports = [...peer.ports].map((name): inputModel.Port => ({ name, interfaceName: name }))
    nodes.push(ports.length > 0 ? { ...peer.node, ports } : peer.node)
    obsNodes[peer.node.id] = peer.observation
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
      ...(drawing ? { drawing } : {}),
    },
    warnings,
    readCount: visited.size,
    linksRead,
    partial,
    outcomes: [...outcomes.values()],
  }
}

const IF_SPEED_SATURATED = 4294967295

/**
 * An interface's speed in bits/sec: ifHighSpeed (Mbps), else ifSpeed (bps) unless it is the
 * saturation value; nothing for a down interface or one that reports none (0).
 */
export function portSpeedBps(
  high: VarbindLike['value'] | undefined,
  plain: VarbindLike['value'] | undefined,
): number | undefined {
  const mbps = asNumber(high)
  if (mbps !== undefined && mbps > 0) return mbps * 1_000_000
  const bps = asNumber(plain)
  return bps !== undefined && bps > 0 && bps < IF_SPEED_SATURATED ? bps : undefined
}

function endOf(end: LinkEnd): inputModel.NodeEnd {
  return end.port ? { node: end.node, port: end.port } : { node: end.node }
}

function targetTimeout(targets: DeepReadTarget[], address: string): number {
  return targets.find((t) => t.address === address)?.timeoutMs ?? 2000
}

/** An agent lacking the object is an answer; a timeout or any other failure stays one. */
function emptyWhenNoSuchObject(error: unknown): VarbindLike[] {
  if (error instanceof Error && error.message.startsWith('NoSuch')) return []
  throw error
}

async function scanOne(
  client: DeepReadClient,
  address: string,
  sourceId: string,
  community: string,
): Promise<VisitedDevice> {
  const sys = await client.get([SYSTEM_MIB.sysName, SYSTEM_MIB.sysObjectID, SYSTEM_MIB.sysDescr])
  // Asked one by one: an agent may lack either, and a device without the LLDP MIB is still readable.
  const [locChassis, locChassisSubtype] = await Promise.all(
    [LLDP_LOC_CHASSIS_ID, LLDP_LOC_CHASSIS_ID_SUBTYPE].map((oid) =>
      client.get([oid]).catch(emptyWhenNoSuchObject),
    ),
  )
  const sysName = asString(sys[0]?.value)
  const sysObjectID = asString(sys[1]?.value)
  const sysDescr = asString(sys[2]?.value)
  const lldpLocChassis = decodeChassisId(
    locChassis?.[0]?.value,
    asNumber(locChassisSubtype?.[0]?.value),
  )

  const [physClasses, physSerials, physModels, ifDescrs, ifNames, ifMacs, ifHighSpeeds] =
    await Promise.all([
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
      // An agent without the IF-MIB extension answers noSuchObject; the plain ifSpeed then serves.
      client
        .walk(IF_X_TABLE.ifHighSpeed)
        .catch(emptyWhenNoSuchObject)
        .then((vbs) => indexByRow(vbs, IF_X_TABLE.ifHighSpeed)),
    ])
  // ifSpeed (bits/sec, saturating at 4294967295) is walked only when some row lacks ifHighSpeed.
  const needsIfSpeed = Object.keys(ifDescrs).some((idx) => !(asNumber(ifHighSpeeds[idx]) ?? 0))
  const ifSpeeds = needsIfSpeed
    ? await client
        .walk(IF_TABLE.ifSpeed)
        .catch(emptyWhenNoSuchObject)
        .then((vbs) => indexByRow(vbs, IF_TABLE.ifSpeed))
    : {}

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
  const chassisId = lldpLocChassis?.value ?? chassisSerial ?? baseMac

  const catalogEntry =
    (sysObjectID ? getCatalog().findBySysObjectId(sysObjectID) : undefined) ??
    (chassisModel ? getCatalog().findByPartNumber(chassisModel) : undefined)
  const vendor =
    catalogEntry?.spec.vendor ??
    (sysObjectID ? (vendorFromOid(sysObjectID) ?? undefined) : undefined)

  const attributes = deviceAttributes({ address, sysName, chassisId })

  const ports = new Map<string, VisitedPort>()
  const taken = new Set<string>()
  for (const [ifIndex, descr] of Object.entries(ifDescrs)) {
    const ifName = asString(ifNames[ifIndex]) ?? asString(descr)
    if (!ifName) continue
    const mac = asMacString(ifMacs[ifIndex])
    // Ports are keyed by name; an ifName another row already took keeps its ifIndex apart.
    const name = taken.has(ifName) ? `${ifName}#${ifIndex}` : ifName
    taken.add(name)
    const speedBps = portSpeedBps(ifHighSpeeds[ifIndex], ifSpeeds[ifIndex])
    ports.set(ifIndex, {
      name,
      ifName,
      ifIndex: Number(ifIndex),
      ...(mac && mac !== '00:00:00:00:00:00' ? { mac } : {}),
      ...(speedBps ? { speedBps } : {}),
    })
  }

  return {
    nodeId: `${sourceId}:node:${address}`,
    attributes,
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
  icon?: string
} {
  const spec = device.catalogEntry?.spec
  const vendor = spec?.vendor ?? device.vendor
  // The catalog's model when the device is in it, else the model the chassis reports itself.
  // A `/` inside a model would read as another level of the product path.
  const model =
    (spec?.kind === 'hardware' ? spec.model : undefined) ??
    (device.chassisModel?.trim().replaceAll('/', '-') || undefined)
  const type = specDeviceType(spec)
  const product = productOf(vendor, model)
  const icon = device.catalogEntry?.icon ?? spec?.icon

  // A port is recognized by its name (the interface name) and its MAC, both written on the
  // port; the agent's ifIndex is this source's own numbering, so it stays in the observation.
  const obsPorts: Record<string, PortObservation> = {}
  const ports: inputModel.Port[] = []
  for (const port of device.ports.values()) {
    obsPorts[port.name] = { ifIndex: port.ifIndex, provenance: { source: sourceId } }
    ports.push({
      name: port.name,
      ...(port.ifName !== port.name && { label: port.ifName }),
      interfaceName: port.ifName,
      ...(port.mac ? { mac: port.mac } : {}),
      ...(port.speedBps ? { speed: rateFromBps(port.speedBps) } : {}),
    })
  }

  // NOTE: the credential the device was read with is deliberately NOT baked
  // into the observed node. Credentials are Discovery feature config
  // (`deep_read_config`, keyed by entity), not an observation — baking them in
  // was how config data leaked into the composition pipeline.
  return {
    node: {
      id: device.nodeId,
      // No label: a label is the name a person gives. The name the device reports is its
      // `sysName`, which the Server shows for a node nobody has named.
      ...device.attributes,
      ...(type ? { type } : {}),
      ...(product ? { product } : {}),
      ...(ports.length > 0 ? { ports } : {}),
    },
    observation: {
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
    ...(icon ? { icon } : {}),
  }
}

async function fetchLldpNeighbors(
  client: DeepReadClient,
  device: VisitedDevice,
  byChassis: Map<string, VisitedDevice>,
  lldpPeers: Map<string, LldpPeer>,
  sourceId: string,
): Promise<Wire[]> {
  const column = async (oid: string) => indexByRow(await client.walk(oid), oid)
  const [chassisIds, chassisSubtypes, portIds, portSubtypes, portDescs, sysNames] =
    await Promise.all([
      column(LLDP_REM_TABLE.lldpRemChassisId),
      column(LLDP_REM_TABLE.lldpRemChassisIdSubtype),
      column(LLDP_REM_TABLE.lldpRemPortId),
      column(LLDP_REM_TABLE.lldpRemPortIdSubtype),
      column(LLDP_REM_TABLE.lldpRemPortDesc),
      column(LLDP_REM_TABLE.lldpRemSysName),
    ])
  // What each of this device's own LLDP port numbers is. The number is an ifIndex on many
  // devices and not on others (Arista numbers breakout ports like Ethernet49/1 apart), so
  // the table is asked first and the ifIndex is only the fallback.
  const [locPortIds, locPortSubtypes, locPortDescs] = await Promise.all([
    column(LLDP_LOC_PORT_TABLE.lldpLocPortId),
    column(LLDP_LOC_PORT_TABLE.lldpLocPortIdSubtype),
    column(LLDP_LOC_PORT_TABLE.lldpLocPortDesc),
  ]).catch((): Array<ReturnType<typeof indexByRow>> => [{}, {}, {}])

  const wires: Wire[] = []
  for (const rowSuffix of Object.keys(chassisIds)) {
    const parts = rowSuffix.split('.')
    if (parts.length < 3) continue
    const localPortNum = parts[1]
    if (!localPortNum) continue
    // The LLDP local-port number is not the IF-MIB ifIndex on every device — Maipu's
    // IS230 and Arista's breakout ports number them independently — so the local port
    // table says which interface it is, and the ifIndex is only the fallback. A port
    // that still can't be matched must NOT drop the link: which switch connects to
    // which is the backbone, and it is worth far more than the exact local port.
    // Anchor on the node (empty port) in that case.
    const localPortName =
      matchPort(
        device,
        decodePortId(locPortIds[localPortNum], asNumber(locPortSubtypes[localPortNum])),
        asString(locPortDescs[localPortNum]),
      ) ?? device.ports.get(localPortNum)?.name

    const remoteChassisId = decodeChassisId(
      chassisIds[rowSuffix],
      asNumber(chassisSubtypes[rowSuffix]),
    )
    if (!remoteChassisId) continue
    const remoteChassis = remoteChassisId.value
    const remoteSysName = asString(sysNames[rowSuffix])
    const remotePortId = decodePortId(portIds[rowSuffix], asNumber(portSubtypes[rowSuffix]))
    const remotePortDesc = asString(portDescs[rowSuffix])

    const visitedPeer = byChassis.get(remoteChassis)
    let toNodeId: string
    let toPort: string | undefined
    if (visitedPeer && visitedPeer !== device) {
      toNodeId = visitedPeer.nodeId
      toPort = matchPort(visitedPeer, remotePortId, remotePortDesc)
    } else if (!visitedPeer) {
      const peer = ensureLldpPeer(lldpPeers, remoteChassisId, remoteSysName, sourceId)
      toNodeId = peer.node.id
      if (remotePortId) {
        toPort = portNameOf(remotePortId, remotePortDesc)
        peer.ports.add(toPort)
      }
    } else {
      continue // a device's own chassis echoed back — not a wire
    }

    wires.push({
      from: { node: device.nodeId, port: localPortName ?? '' },
      to: { node: toNodeId, port: toPort ?? '' },
      remoteChassis,
    })
  }
  return wires
}

/**
 * The port of a switch we read that an LLDP port id names: a neighbour's end of a wire, or
 * the switch's own LLDP port number. A name matches the interface name; a MAC matches the
 * interface's own MAC; the port description is the last try. Undefined when none matches,
 * so the wire anchors on the switch alone.
 */
export function matchPort(
  peer: VisitedDevice,
  id: LldpId | undefined,
  description: string | undefined,
): string | undefined {
  const ports = [...peer.ports.values()]
  if (id?.kind === 'text') {
    const named = ports.find((p) => p.ifName === id.value || p.name === id.value)
    if (named) return named.name
  }
  if (id?.kind === 'mac') {
    const owned = ports.filter((p) => p.mac && normalizeMacKey(p.mac) === id.value)
    // Many ports can share one base MAC; only a unique owner names the port.
    if (owned.length === 1) return owned[0]?.name
  }
  const text = description?.trim()
  if (text) return ports.find((p) => p.ifName === text || p.name === text)?.name
  return undefined
}

/**
 * A chassis-keyed node for a switch a device named over LLDP but that we did not
 * read this pass. When the chassis id is a MAC, `chassisId` and `mac` are both that
 * MAC, so it merges onto the same switch seen by a controller (chassis id) or an ARP
 * sweep (mac). The model-as-sysName Maipu reports stays only as the reported name, never a key.
 */
function ensureLldpPeer(
  lldpPeers: Map<string, LldpPeer>,
  chassisId: LldpId,
  sysName: string | undefined,
  sourceId: string,
): LldpPeer {
  const chassis = chassisId.value
  const existing = lldpPeers.get(chassis)
  if (existing) return existing
  // Only a MAC chassis id is also the node's MAC; a device-assigned string or an address is not.
  const attributes = deviceAttributes(
    chassisId.kind === 'mac' ? { chassisId: chassis, mac: chassis } : { chassisId: chassis },
  )
  const peer: LldpPeer = {
    node: { id: `${sourceId}:node:lldp:${chassis}`, ...attributes },
    observation: {
      // The name the neighbour reported for it: shown while nobody names it, never a label (a
      // name a person gives) and never a key.
      metadata: { syncState: 'notice', ...(sysName ? { reportedName: sysName } : {}) },
      provenance: { source: sourceId, observedAt: Date.now() },
    },
    ports: new Set(),
  }
  lldpPeers.set(chassis, peer)
  return peer
}

// Re-export for tests / callers that assemble varbinds themselves.
export type { VarbindLike }
