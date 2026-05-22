// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Network discovery against a list of targets.
 *
 * Algorithm:
 *   1. Expand any CIDR entries to individual addresses (`expandTargets`)
 *   2. Liveness probe — concurrent short-timeout SNMP `sysName` get.
 *      Silently drop addresses that do not respond.
 *   3. For each live address: identify via System-MIB, walk IF-MIB /
 *      ifXTable for ports
 *   4. Second pass: walk LLDP-MIB on each visited device, emit Links
 *      between cluster members. Cross-cluster neighbors are recorded
 *      (chassisId in link metadata) but the Link itself is skipped if
 *      the peer wasn 't visited.
 *
 * v1 does NOT auto-expand from LLDP neighbors — every device must be in
 * `targets` (either as IP, hostname, or via a CIDR that covers it). The
 * follow-on PR adds neighbor-driven expansion.
 */

import { builtinEntries, Catalog, type CatalogEntry, vendorFromOid } from '@shumoku/catalog'
import type { Identity, Link, NetworkGraph, Node, NodePort, NodeSpec } from '@shumoku/core'
import { expandTargets } from './cidr.js'
import { asMacString, asNumber, asString, indexByRow, SnmpClient } from './client.js'
import {
  ENTITY_CLASS_CHASSIS,
  ENTITY_TABLE,
  IF_TABLE,
  IF_X_TABLE,
  LLDP_REM_TABLE,
  SYSTEM_MIB,
} from './mib.js'

/** How many addresses to probe in parallel during the liveness pass. */
const LIVENESS_CONCURRENCY = 32
/** Liveness probe timeout — much shorter than the deep-scan timeout
 *  because we 're triaging many candidates at once. */
const LIVENESS_TIMEOUT_MS = 1000

export interface DiscoverInput {
  /** Mixed list of targets: IPs, hostnames, or CIDR blocks. CIDR is
   *  expanded to host addresses; non-CIDR entries pass through. */
  targets: readonly string[]
  /** SNMP community string used for every target. */
  community: string
  /** Source id stamped into provenance on every produced element. */
  sourceId: string
  /** Deep-scan timeout in ms (full SNMP walk per device). Default 2000. */
  timeoutMs?: number
}

export interface DiscoverResult {
  graph: NetworkGraph
  warnings: string[]
  /** Counts surfaced in the snapshot summary. */
  stats: {
    expanded: number
    alive: number
    walked: number
  }
}

interface VisitedDevice {
  /** Synthesized node id, e.g. "snmp:<seed-address>". */
  nodeId: string
  /** Identity captured at scan time. */
  identity: Identity
  sysName?: string
  sysDescr?: string
  vendor?: string
  /** Resolved catalog entry, if the device 's sysObjectID matched. */
  catalogEntry?: CatalogEntry
  /** Raw sysObjectID — useful for surfacing on unmatched nodes. */
  sysObjectID?: string
  /** Chassis model from ENTITY-MIB (entPhysicalModelName on the chassis row). */
  chassisModel?: string
  ports: Map<string, NodePort> // keyed by ifIndex string
}

/**
 * Module-level catalog instance. The SNMP discover path is read-only
 * against the catalog and the builtin entries are static, so a single
 * shared instance is fine. If the server later wires in a project-
 * local catalog override we can accept it via `DiscoverInput`.
 */
let _catalog: Catalog | null = null
function getCatalog(): Catalog {
  if (!_catalog) {
    const c = new Catalog()
    c.registerAll(builtinEntries)
    _catalog = c
  }
  return _catalog
}

export async function discover(input: DiscoverInput): Promise<DiscoverResult> {
  const warnings: string[] = []
  const visited = new Map<string, VisitedDevice>() // address → device
  const allLinks: Link[] = []

  // 1. Expand CIDRs. Per-entry errors (oversized CIDR) become warnings,
  //    not exceptions, so a typo in one target doesn 't abort the run.
  let expanded: string[]
  try {
    expanded = expandTargets(input.targets)
  } catch (err) {
    warnings.push(err instanceof Error ? err.message : String(err))
    return emptyResult(warnings)
  }
  if (expanded.length === 0) {
    warnings.push('No targets to scan.')
    return emptyResult(warnings)
  }

  // 2. Liveness probe — short SNMP get for sysName in parallel chunks.
  //    Silently drops non-responders. This is the key behavior that
  //    makes a /24 scan tolerable: ~250 addresses, ~250ms RTT each,
  //    32-way parallel → ~2s instead of ~250s sequential.
  const alive = await probeAlive(expanded, input.community)

  if (alive.length === 0) {
    warnings.push(
      `Probed ${expanded.length} address${expanded.length === 1 ? '' : 'es'}, none responded ` +
        `to SNMP. Check community / network reachability / firewall.`,
    )
    return emptyResult(warnings, { expanded: expanded.length, alive: 0, walked: 0 })
  }

  // 3. Full SNMP walk on live targets only.
  for (const address of alive) {
    const client = new SnmpClient({
      address,
      community: input.community,
      timeoutMs: input.timeoutMs,
    })
    try {
      const device = await scanOne(client, address, input.sourceId)
      visited.set(address, device)
    } catch (err) {
      warnings.push(`Walk ${address}: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      client.close()
    }
  }

  // 4. Second pass: walk LLDP for each visited device and emit Links.
  // We track per-device LLDP outcomes so a "0 links overall" snapshot
  // can carry a useful diagnostic ("LLDP empty on every device" reads
  // very differently from "LLDP errored on every device").
  let lldpDevicesEmpty = 0
  let lldpDevicesErrored = 0
  for (const [address, device] of visited) {
    const client = new SnmpClient({
      address,
      community: input.community,
      timeoutMs: input.timeoutMs,
    })
    try {
      const links = await fetchLldpNeighbors(client, device, visited, input.sourceId)
      if (links.length === 0) lldpDevicesEmpty++
      allLinks.push(...links)
    } catch (err) {
      lldpDevicesErrored++
      warnings.push(`LLDP walk on ${address}: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      client.close()
    }
  }

  // No links across the entire scan is usually a deployment property
  // (the network just doesn 't run LLDP between these devices —
  // common with routers / NAS / firewalls) rather than a plugin bug.
  // Surface that explicitly so the user doesn 't think the scan
  // "worked but found nothing useful" without context.
  if (allLinks.length === 0 && visited.size > 0) {
    if (lldpDevicesErrored === visited.size) {
      warnings.push(
        `LLDP-MIB unreachable on every device — community may not grant access to lldpRemTable.`,
      )
    } else if (lldpDevicesEmpty === visited.size - lldpDevicesErrored) {
      warnings.push(
        `LLDP returned no neighbors on any device — LLDP probably isn 't enabled (common for routers / NAS / firewalls). v1 derives links from LLDP only; IP/MAC-table-based discovery is v2.`,
      )
    }
  }

  const graph: NetworkGraph = {
    version: '1.0',
    nodes: Array.from(visited.values()).map((d) => visitedToNode(d, input.sourceId)),
    links: allLinks,
  }

  return {
    graph,
    warnings,
    stats: { expanded: expanded.length, alive: alive.length, walked: visited.size },
  }
}

/** Liveness sweep — short-timeout SNMP `sysName` get against many
 *  candidates in bounded-concurrency chunks. Returns the subset that
 *  responded. Errors are swallowed (non-responders are not warnings;
 *  the whole point is to silently drop dead addresses). */
async function probeAlive(addresses: readonly string[], community: string): Promise<string[]> {
  const alive: string[] = []
  for (let i = 0; i < addresses.length; i += LIVENESS_CONCURRENCY) {
    const chunk = addresses.slice(i, i + LIVENESS_CONCURRENCY)
    const settled = await Promise.all(
      chunk.map(async (addr) => {
        const client = new SnmpClient({
          address: addr,
          community,
          timeoutMs: LIVENESS_TIMEOUT_MS,
          retries: 0,
        })
        try {
          const vbs = await client.get([SYSTEM_MIB.sysName])
          return vbs.length > 0 ? addr : null
        } catch {
          return null
        } finally {
          client.close()
        }
      }),
    )
    for (const r of settled) if (r) alive.push(r)
  }
  return alive
}

function emptyResult(
  warnings: string[],
  stats: DiscoverResult['stats'] = { expanded: 0, alive: 0, walked: 0 },
): DiscoverResult {
  return {
    graph: { version: '1.0', nodes: [], links: [] },
    warnings,
    stats,
  }
}

async function scanOne(
  client: SnmpClient,
  address: string,
  sourceId: string,
): Promise<VisitedDevice> {
  // System-MIB scalars
  const sys = await client.get([SYSTEM_MIB.sysName, SYSTEM_MIB.sysObjectID, SYSTEM_MIB.sysDescr])

  const sysName = asString(sys[0]?.value)
  const sysObjectID = asString(sys[1]?.value)
  const sysDescr = asString(sys[2]?.value)

  // ENTITY-MIB + IF-MIB walks in parallel. ENTITY-MIB gives us the
  // chassis serial (best identity key); IF-MIB ifPhysAddress on the
  // lowest non-loopback interface is the universal fallback when
  // ENTITY-MIB is empty.
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

  // Universal MAC-based identity fallback. Pick the lowest-ifIndex
  // interface that publishes a non-zero hardware MAC; this is almost
  // always the device 's base / first physical NIC and is hardware-
  // burned (operators can change IP / hostname / VLAN but not the
  // baked-in MAC). Less authoritative than ENTITY-MIB serial — a
  // virtual machine 's MAC can change on rebuild — but a big step up
  // from mgmtIp / sysName alone.
  let baseMac: string | undefined
  if (!chassisSerial) {
    const sortedIfIndices = Object.keys(ifMacs).sort((a, b) => Number(a) - Number(b))
    for (const idx of sortedIfIndices) {
      const mac = asMacString(ifMacs[idx])
      if (mac && mac !== '00:00:00:00:00:00') {
        baseMac = mac
        break
      }
    }
  }
  const chassisId = chassisSerial ?? baseMac

  // Catalog lookup. First try `sysObjectID` (the canonical product OID
  // for SNMP-discoverable devices). If that misses, try the chassis
  // model name as a part number — many devices expose a clean SKU
  // through ENTITY-MIB (e.g. `TS-453BU-RP` for QNAP NAS) even when
  // their sysObjectID isn 't yet seeded in the catalog. Falls back to
  // vendor-only lookup via the IANA enterprise-number registry when
  // both miss.
  const catalogEntry =
    (sysObjectID ? getCatalog().findBySysObjectId(sysObjectID) : undefined) ??
    (chassisModel ? getCatalog().findByPartNumber(chassisModel) : undefined)
  const vendor =
    catalogEntry?.spec.vendor ??
    (sysObjectID ? (vendorFromOid(sysObjectID) ?? undefined) : undefined)

  // sysObjectID is a *product family* identifier (same value across
  // every device of the same model), so it must NOT live in `identity`
  // — the resolver clusters nodes by identity keys, and feeding it the
  // sysObjectID would collapse every QNAP NAS / every Cisco 9300 into
  // a single node. Catalog binding info goes in `metadata.sysObjectID`
  // on the produced Node; per-device identity is mgmtIp / sysName /
  // chassisId (when ENTITY-MIB gives us one).
  const identity: Identity = {
    mgmtIp: address,
    sysName,
    ...(chassisId ? { chassisId } : {}),
  }

  const ports = new Map<string, NodePort>()
  for (const [ifIndex, descr] of Object.entries(ifDescrs)) {
    const ifName = asString(ifNames[ifIndex]) ?? asString(descr)
    if (!ifName) continue
    const mac = asMacString(ifMacs[ifIndex])
    const port: NodePort = {
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
    }
    ports.set(ifIndex, port)
  }

  return {
    nodeId: `${sourceId}:node:${address}`,
    identity,
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

  // When the catalog matched the device by its sysObjectID, copy that
  // entry 's spec onto the node (same pattern editor Product-binding
  // uses). Renderer 's `resolveIcon(spec)` then picks up the correct
  // device-type icon. When no catalog match, fall back to a thin
  // HardwareSpec carrying just vendor so at least the chip shows the
  // right manufacturer.
  const spec: NodeSpec | undefined = device.catalogEntry
    ? {
        ...device.catalogEntry.spec,
        ...(device.catalogEntry.icon ? { icon: device.catalogEntry.icon } : {}),
      }
    : device.vendor
      ? { kind: 'hardware', vendor: device.vendor }
      : undefined

  return {
    id: device.nodeId,
    label: labelParts.length > 0 ? labelParts : (device.identity.mgmtIp ?? 'unknown'),
    // `shape` is intentionally omitted — the renderer defaults to
    // `'rounded'`, which is what a discovered device should look
    // like. Shape is presentation data; plugins shouldn 't be
    // inventing it on every node.
    identity: device.identity,
    ...(spec ? { spec } : {}),
    metadata: {
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
  visited: Map<string, VisitedDevice>,
  sourceId: string,
): Promise<Link[]> {
  // Walk the LLDP neighbor table columns we care about
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
    // rowSuffix is `lldpRemTimeMark.lldpRemLocalPortNum.lldpRemIndex`
    const parts = rowSuffix.split('.')
    if (parts.length < 3) continue
    const localPortNum = parts[1] // assumed == ifIndex on most devices
    if (!localPortNum) continue

    const localPort = device.ports.get(localPortNum)
    if (!localPort) continue

    const remoteChassis = asMacString(chassisIds[rowSuffix])
    const remoteSysName = asString(sysNames[rowSuffix])
    const remotePortId = asString(portIds[rowSuffix])

    // Find the peer device in our visited set by chassisId / sysName.
    // The peer 's identity might not have the chassisId yet (we read it
    // off the LLDP-LOC table on the peer to know that), but sysName
    // matching usually works.
    let peer: VisitedDevice | undefined
    for (const d of visited.values()) {
      if (d === device) continue
      if (remoteSysName && d.sysName === remoteSysName) {
        peer = d
        break
      }
    }

    if (!peer) {
      // We see the neighbor but didn 't seed it. v1: skip the link
      // entirely (cross-cluster dangling endpoints are deferred —
      // see resolve.ts skeleton TODO).
      continue
    }

    // Find the peer port matching remotePortId
    let peerPort: NodePort | undefined
    if (remotePortId) {
      for (const p of peer.ports.values()) {
        if (p.identity?.ifName === remotePortId || p.interfaceName === remotePortId) {
          peerPort = p
          break
        }
      }
    }
    if (!peerPort) continue

    links.push({
      from: { node: device.nodeId, port: localPort.id },
      to: { node: peer.nodeId, port: peerPort.id },
      provenance: { source: sourceId, observedAt: Date.now() },
      metadata: {
        lldpRemoteChassis: remoteChassis,
      },
    })
  }

  return links
}

// Helpers used by tests to keep types in sync without exporting all internals.
export const __internals__ = { scanOne, fetchLldpNeighbors }
// asNumber re-exported in case downstream code wants it.
export { asNumber }
