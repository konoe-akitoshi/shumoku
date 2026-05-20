// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Seed-crawl discovery against one or more devices.
 *
 * Algorithm:
 *   1. Identify each seed via System-MIB (sysName / sysObjectID / sysDescr)
 *   2. Walk IF-MIB / ifXTable to materialize ports with identity
 *   3. Walk LLDP-MIB to harvest neighbor (chassisId, portId, sysName)
 *   4. For neighbors we haven 't visited yet, only record the **link**;
 *      crossing to other devices requires an explicit seed list (v1)
 *
 * v1 deliberately does NOT auto-expand the seed set with discovered
 * neighbors — that requires reachability assumptions and address
 * resolution that we punt to v2 (`shumoku-probe` / `ScopePolicy`
 * include-CIDR). v1 produces a useful snapshot from a fixed seed list
 * already.
 */

import {
  type Identity,
  type Link,
  type NetworkGraph,
  type Node,
  type NodePort,
  vendorFromSysObjectID,
} from '@shumoku/core'
import { asMacString, asNumber, asString, indexByRow, SnmpClient } from './client.js'
import { IF_TABLE, IF_X_TABLE, LLDP_REM_TABLE, SYSTEM_MIB } from './mib.js'

export interface DiscoverInput {
  seeds: Array<{ address: string; community: string }>
  /** Source id stamped into provenance on every produced element. */
  sourceId: string
  /** Per-device timeout in ms (default 2000). */
  timeoutMs?: number
}

export interface DiscoverResult {
  graph: NetworkGraph
  warnings: string[]
  /** True if every seed responded successfully. */
  allOk: boolean
}

interface VisitedDevice {
  /** Synthesized node id, e.g. "snmp:<seed-address>". */
  nodeId: string
  /** Identity captured at scan time. */
  identity: Identity
  sysName?: string
  sysDescr?: string
  vendor?: string
  ports: Map<string, NodePort> // keyed by ifIndex string
}

export async function discover(input: DiscoverInput): Promise<DiscoverResult> {
  const warnings: string[] = []
  const visited = new Map<string, VisitedDevice>() // seed-address → device
  const allLinks: Link[] = []
  let okCount = 0

  for (const seed of input.seeds) {
    const client = new SnmpClient({
      address: seed.address,
      community: seed.community,
      timeoutMs: input.timeoutMs,
    })

    try {
      const device = await scanOne(client, seed.address, input.sourceId)
      visited.set(seed.address, device)
      okCount++
    } catch (err) {
      warnings.push(`Seed ${seed.address}: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      client.close()
    }
  }

  // 2nd pass: walk LLDP for each visited device and emit Links.
  // Done in a second pass because link endpoints can reference the
  // *peer* device only if that peer was also visited as a seed.
  for (const [address, device] of visited) {
    const client = new SnmpClient({
      address,
      community: input.seeds.find((s) => s.address === address)?.community ?? 'public',
      timeoutMs: input.timeoutMs,
    })
    try {
      const links = await fetchLldpNeighbors(client, device, visited, input.sourceId)
      allLinks.push(...links)
    } catch (err) {
      warnings.push(`LLDP walk on ${address}: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      client.close()
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
    allOk: okCount === input.seeds.length && warnings.length === 0,
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
  const vendor = sysObjectID ? (vendorFromSysObjectID(sysObjectID) ?? undefined) : undefined

  const identity: Identity = {
    mgmtIp: address,
    sysName,
    vendorIds: sysObjectID ? { 'snmp-sys-object-id': sysObjectID } : undefined,
  }

  // IF-MIB walks — get names, MACs, oper status
  const [ifDescrs, ifNames, ifMacs] = await Promise.all([
    client.walk(IF_TABLE.ifDescr).then((vbs) => indexByRow(vbs, IF_TABLE.ifDescr)),
    client.walk(IF_X_TABLE.ifName).then((vbs) => indexByRow(vbs, IF_X_TABLE.ifName)),
    client.walk(IF_TABLE.ifPhysAddress).then((vbs) => indexByRow(vbs, IF_TABLE.ifPhysAddress)),
  ])

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
    ports,
  }
}

function visitedToNode(device: VisitedDevice, sourceId: string): Node {
  const labelParts: string[] = []
  if (device.sysName) labelParts.push(device.sysName)
  else if (device.identity.mgmtIp) labelParts.push(device.identity.mgmtIp)

  return {
    id: device.nodeId,
    label: labelParts.length > 0 ? labelParts : (device.identity.mgmtIp ?? 'unknown'),
    shape: 'rect',
    identity: device.identity,
    metadata: {
      vendor: device.vendor,
      sysDescr: device.sysDescr,
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
