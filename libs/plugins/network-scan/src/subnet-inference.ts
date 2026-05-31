// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Subnet-membership inference for L3 topology.
 *
 * When the scanned devices don 't run LLDP / CDP (NEC routers, VyOS
 * boxes, NAS appliances, …) we still have the IP layer to lean on.
 * Every device 's `ipAddrTable` returns the IPv4 addresses and netmasks
 * bound to each interface. Devices whose interfaces sit in the same
 * subnet share a Layer-2 broadcast domain — usually some
 * unmanaged-switch fabric the scan can 't observe directly.
 *
 * **Why a segment node, not a mesh of pairwise links:** the rest of
 * the codebase relies on a "one port owns at most one link endpoint"
 * invariant (enforced in the editor, the renderer 's drag-create
 * flow rejects drops on linked ports, etc). A naive pair-wise mesh
 * of N nodes would attach N-1 links to each device 's single
 * IP-bearing interface and violate that invariant — visually it
 * shows up as several lines fanning out of one port, which is
 * physically impossible (one cable, one peer). Instead we synthesise
 * a virtual "segment" node for each shared subnet and emit one
 * spoke link from each member interface to a unique port on the
 * segment node. Result is a star topology that respects the
 * invariant and matches reality ("there is some L2 fabric in the
 * middle even if we can 't see it"). If an LLDP-aware discovery
 * later finds the actual switch and reports it, identity matching
 * lets the segment node be replaced or merged.
 *
 * Loopback (127.0.0.0/8) and link-local (169.254.0.0/16) ranges are
 * skipped — they 're per-device and don 't model connectivity.
 */

import { DeviceType, type Link, type Node, type NodeSpec } from '@shumoku/core'

/** One interface 's IPv4 binding as harvested from `ipAddrTable`. */
export interface InterfaceIp {
  ip: string
  netmask: string
  ifIndex: number
}

/** An interface binding scoped to its parent device. */
export interface DeviceInterfaceIp extends InterfaceIp {
  /** Stable node id of the parent device (e.g. `network-scan:node:192.168.13.15`). */
  nodeId: string
  /** Stable port id on the parent device for the spoke endpoint. */
  portId: string
}

/** Result of grouping interfaces by the subnet they sit in. */
export interface SubnetGroup {
  /** CIDR string, e.g. `192.168.12.0/22`. */
  cidr: string
  /** All interfaces in this subnet, possibly across multiple devices. */
  members: DeviceInterfaceIp[]
}

/** Final inference output: virtual segment nodes plus their spoke links. */
export interface SegmentInference {
  /** Virtual segment nodes — one per shared subnet. */
  segmentNodes: Node[]
  /** Spoke links from each device 's interface to its segment node. */
  spokeLinks: Link[]
}

/** Parse a dotted-quad to a 32-bit unsigned integer. Returns null on malformed input. */
function parseDottedQuad(s: string): number | null {
  const parts = s.split('.').map((p) => Number(p))
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null
  return (
    (((parts[0] ?? 0) << 24) |
      ((parts[1] ?? 0) << 16) |
      ((parts[2] ?? 0) << 8) |
      (parts[3] ?? 0)) >>>
    0
  )
}

/** Convert a 32-bit unsigned integer back to a dotted quad string. */
function dottedQuad(n: number): string {
  return [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff].join('.')
}

/** Count the leading 1-bits in a netmask integer (CIDR prefix length). */
function prefixLength(mask: number): number {
  let count = 0
  let m = mask
  for (let i = 0; i < 32; i++) {
    if (m & 0x80000000) count++
    m = (m << 1) >>> 0
  }
  return count
}

/**
 * Compute the (subnet, prefix) for an (ip, netmask) pair. Returns null
 * if either component is malformed or if the address is in a range we
 * intentionally skip (loopback, link-local, 0.0.0.0, /32 host-only).
 */
export function subnetCidr(ip: string, netmask: string): string | null {
  const ipN = parseDottedQuad(ip)
  const maskN = parseDottedQuad(netmask)
  if (ipN === null || maskN === null) return null
  if (ipN === 0) return null
  if ((ipN & 0xff000000) === 127 << 24) return null
  if ((ipN & 0xffff0000) === ((169 << 24) | (254 << 16))) return null
  const prefix = prefixLength(maskN)
  if (prefix === 32) return null
  const network = (ipN & maskN) >>> 0
  return `${dottedQuad(network)}/${prefix}`
}

/**
 * Group device interfaces by the IPv4 subnet they sit in. Subnets with
 * only one device 's interfaces are dropped — a segment with one
 * member isn 't a segment, just a stub network on that device.
 */
export function groupBySubnet(ifaces: DeviceInterfaceIp[]): SubnetGroup[] {
  const byCidr = new Map<string, DeviceInterfaceIp[]>()
  for (const iface of ifaces) {
    const cidr = subnetCidr(iface.ip, iface.netmask)
    if (!cidr) continue
    const bucket = byCidr.get(cidr)
    if (bucket) bucket.push(iface)
    else byCidr.set(cidr, [iface])
  }
  const groups: SubnetGroup[] = []
  for (const [cidr, members] of byCidr) {
    const distinctNodes = new Set(members.map((m) => m.nodeId))
    if (distinctNodes.size < 2) continue
    groups.push({ cidr, members })
  }
  return groups
}

/**
 * Build a deterministic, URL-safe id fragment from a CIDR.
 * `192.168.12.0/22` → `192.168.12.0_22`.
 */
function cidrToIdFragment(cidr: string): string {
  return cidr.replace('/', '_')
}

/**
 * Emit one virtual segment Node per group and one spoke Link from each
 * member device 's interface to a unique per-spoke port on the segment
 * node. The "1 port = 1 link endpoint" invariant is preserved on both
 * sides:
 *   - Each member interface owns one spoke (its IP-bearing ifIndex
 *     terminates exactly one link).
 *   - The segment node has one port per spoke, each owning exactly
 *     one link.
 *
 * Same-device pairs are not an issue here — a device contributes one
 * spoke per interface it has in this subnet, and those interfaces
 * already have distinct port ids on the device.
 *
 * Each segment node carries `spec.kind="hardware", spec.type="segment"`
 * so renderers / catalog code can recognise the synthetic transit
 * node. `metadata.subnet` carries the CIDR for downstream tooling.
 */
export function buildSegmentInference(groups: SubnetGroup[], sourceId: string): SegmentInference {
  const segmentNodes: Node[] = []
  const spokeLinks: Link[] = []
  for (const group of groups) {
    const cidrFragment = cidrToIdFragment(group.cidr)
    const segmentNodeId = `${sourceId}:segment:${cidrFragment}`
    const spec: NodeSpec = { kind: 'hardware', type: DeviceType.Segment }
    const segmentNode: Node = {
      id: segmentNodeId,
      label: group.cidr,
      spec,
      metadata: { subnet: group.cidr, linkType: 'subnet-inferred' },
      provenance: { source: sourceId, observedAt: Date.now(), state: 'discovered-only' },
      ports: [],
    }
    for (const member of group.members) {
      const segmentPortId = `${segmentNodeId}:spoke:${member.nodeId}:${member.ifIndex}`
      segmentNode.ports?.push({
        id: segmentPortId,
        // Label the segment-side port with the peer 's interface
        // identifier so the renderer can show "→ Gig3.0" or "→ eth0"
        // without having to chase the link back.
        label: '',
        connectors: [],
        provenance: { source: sourceId },
      })
      spokeLinks.push({
        from: { node: member.nodeId, port: member.portId },
        to: { node: segmentNodeId, port: segmentPortId },
        provenance: { source: sourceId, observedAt: Date.now() },
        metadata: { linkType: 'subnet-inferred', subnet: group.cidr },
      })
    }
    segmentNodes.push(segmentNode)
  }
  return { segmentNodes, spokeLinks }
}
