// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Subnet-membership inference for L3 topology.
 *
 * When the scanned devices don 't run LLDP / CDP (NEC routers, VyOS
 * boxes, NAS appliances, …) we still have the IP layer to lean on.
 * Every device 's `ipAddrTable` returns the IPv4 addresses and netmasks
 * bound to each interface. Two interfaces sitting in the same subnet
 * are reachable through some Layer-2 segment — usually a direct cable
 * or a passive switch — so the simplest useful topology approximation
 * is: "if interface A and interface B share a subnet, draw a link
 * between their parent devices."
 *
 * Caveats called out in the produced link metadata:
 *   - Inferred — not observed. A passive switch between A and B is
 *     invisible. Two devices in the same broadcast domain via several
 *     hops will still look directly connected.
 *   - For subnets with N participating interfaces this produces N·(N-1)/2
 *     pairwise links (a logical mesh). That 's accurate as "any of these
 *     can reach any other on this subnet" but visually busy on the
 *     diagram. Operators are expected to overlay a Manual source that
 *     describes the actual cabling — `resolve()` will merge the two.
 *
 * Loopback (127.0.0.0/8) and link-local (169.254.0.0/16) ranges are
 * skipped — they 're per-device and don 't model connectivity.
 */

/** One interface 's IPv4 binding as harvested from `ipAddrTable`. */
export interface InterfaceIp {
  /** Dotted-quad address (e.g. `192.168.13.15`). */
  ip: string
  /** Dotted-quad netmask (e.g. `255.255.252.0`). */
  netmask: string
  /** ifIndex on the parent device. */
  ifIndex: number
}

/** An interface binding scoped to its parent device. */
export interface DeviceInterfaceIp extends InterfaceIp {
  /** Stable node id of the parent device (e.g. `snmp-lldp:node:192.168.13.15`). */
  nodeId: string
  /** Stable port id for the link endpoints to point at. */
  portId: string
}

/** Result of grouping interfaces by the subnet they sit in. */
export interface SubnetGroup {
  /** CIDR string, e.g. `192.168.12.0/22`. */
  cidr: string
  /** All interfaces in this subnet, possibly across multiple devices. */
  members: DeviceInterfaceIp[]
}

/** A single inferred link between two device interfaces. */
export interface InferredLink {
  from: { nodeId: string; portId: string }
  to: { nodeId: string; portId: string }
  /** Subnet that justified the inference. */
  subnet: string
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
  // The mask is a contiguous block of 1s followed by 0s. Bit-twiddle to
  // count by complementing and asking how many trailing zeros it has.
  // We accept non-contiguous masks defensively (count popcount) but
  // most devices return contiguous masks anyway.
  let count = 0
  let m = mask
  // Mask & 0xff for each octet
  for (let i = 0; i < 32; i++) {
    if (m & 0x80000000) count++
    m = (m << 1) >>> 0
  }
  return count
}

/**
 * Compute the (subnet, prefix) for an (ip, netmask) pair. Returns null
 * if either component is malformed or if the address is in a range we
 * intentionally skip (loopback, link-local, 0.0.0.0).
 */
export function subnetCidr(ip: string, netmask: string): string | null {
  const ipN = parseDottedQuad(ip)
  const maskN = parseDottedQuad(netmask)
  if (ipN === null || maskN === null) return null
  if (ipN === 0) return null
  // Skip loopback 127.0.0.0/8 and link-local 169.254.0.0/16
  if ((ipN & 0xff000000) === 127 << 24) return null
  if ((ipN & 0xffff0000) === ((169 << 24) | (254 << 16))) return null
  // Skip /32 (host-only — e.g. loopbacks declared with full mask).
  // /32 carries no link information and would produce singleton groups
  // we 'd just skip anyway downstream.
  const prefix = prefixLength(maskN)
  if (prefix === 32) return null
  const network = (ipN & maskN) >>> 0
  return `${dottedQuad(network)}/${prefix}`
}

/**
 * Group device interfaces by the IPv4 subnet they sit in. Subnets with
 * only one member (a private subnet on a single device) are dropped —
 * they 're not links by themselves.
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
    // Need ≥ 2 *distinct devices* on the subnet for an actual link.
    const distinctNodes = new Set(members.map((m) => m.nodeId))
    if (distinctNodes.size < 2) continue
    groups.push({ cidr, members })
  }
  return groups
}

/**
 * Emit pairwise inferred links for every subnet group. For a subnet
 * containing N interfaces across M ≥ 2 distinct devices, we walk every
 * unordered pair of *interfaces from different devices* — the
 * "logical mesh" representation of the segment. Same-device pairs are
 * skipped (those aren 't a link between devices, just two of the
 * device 's own interfaces happening to share a subnet, which only
 * shows up when the device deliberately bridges two segments).
 */
export function inferLinksFromSubnets(groups: SubnetGroup[]): InferredLink[] {
  const out: InferredLink[] = []
  for (const group of groups) {
    for (let i = 0; i < group.members.length; i++) {
      const a = group.members[i]
      if (!a) continue
      for (let j = i + 1; j < group.members.length; j++) {
        const b = group.members[j]
        if (!b) continue
        if (a.nodeId === b.nodeId) continue
        out.push({
          from: { nodeId: a.nodeId, portId: a.portId },
          to: { nodeId: b.nodeId, portId: b.portId },
          subnet: group.cidr,
        })
      }
    }
  }
  return out
}
