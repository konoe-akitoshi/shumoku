// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Existence discovery — "what is on this network", without a credential.
 *
 * This is the credential-free half of discovery: it establishes that devices
 * EXIST and gives each a mergeable identity (its address plus, on-segment, its
 * MAC). Reading a device in depth — SNMP, LLDP, the switch-to-switch backbone —
 * is a separate, credentialed step that lives server-side in `discovery/
 * deep-read`, not here. Keeping the two apart is the whole point: an ARP sweep
 * and an SNMP walk are different mechanisms, not two modes of one call.
 *
 * Every reachable host becomes a "notice" node — reachable, identified by MAC,
 * awaiting a credential before anything can read it. A wireless controller's
 * unmanaged uplink switch, an ARP sweep's bare host: both surface here so the
 * operator can point a credential at them and the deep-read can take over.
 */

import { buildIdentity, type NetworkGraph, type Node } from '@shumoku/core'
import { type NeighborEntry, readNeighborCache } from './arp.js'
import { expandTargets } from './cidr.js'
import { probeReachable, type ReachabilityResult } from './reachability.js'

/** Per-port TCP connect timeout for the reachability probe. */
const REACHABILITY_TIMEOUT_MS = 1000
/** How many probe→harvest rounds one scan runs. Intermittently-responsive
 *  switches surface a different subset each round, so a few rounds converge on
 *  the segment's real population where a single pass samples it. */
const REACHABILITY_ROUNDS = 3

export interface DiscoverInput {
  /** Mixed list of targets: IPs, hostnames, or CIDR blocks. CIDR is expanded. */
  targets: readonly string[]
  /** Source id stamped into provenance on every produced element. */
  sourceId: string
  /**
   * Keep hosts whose MAC is locally administered — phones and laptops that
   * randomise their address per network. Off by default: they answer the sweep
   * but are not part of the topology and churn on every scan.
   */
  includeClients?: boolean
}

export interface DiscoverResult {
  graph: NetworkGraph
  warnings: string[]
  stats: {
    expanded: number
    /** Reachable + MAC-identified hosts surfaced as notice nodes. */
    notice: number
  }
}

/**
 * Sweep the targets and return a graph of notice nodes — one per reachable,
 * MAC-identified host. No links: relationships need a credentialed read (LLDP),
 * which is the deep-read's job.
 */
export async function discover(input: DiscoverInput): Promise<DiscoverResult> {
  const warnings: string[] = []

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

  // These devices answer intermittently: any single probe of the segment catches
  // a shifting subset. Accumulate WITHIN one scan — re-probe only the candidates
  // still missing a MAC, then re-read the neighbour cache. A probe forces ARP
  // resolution even when the host ignores it at L4, and a switch silent one round
  // often answers the next. The MAC — not bare reachability — gates a node,
  // because an address without one cannot merge onto the device another source
  // knows by MAC.
  const reachable = new Map<string, ReachabilityResult>()
  const neighbors = new Map<string, NeighborEntry>()
  for (let round = 0; round < REACHABILITY_ROUNDS; round++) {
    const pending = expanded.filter((addr) => !neighbors.has(addr))
    if (pending.length === 0) break
    const found = await probeReachable(pending, { timeoutMs: REACHABILITY_TIMEOUT_MS })
    for (const [addr, res] of found) if (!reachable.has(addr)) reachable.set(addr, res)
    for (const [ip, entry] of await readNeighborCache()) neighbors.set(ip, entry)
  }

  const noticeNodes: Node[] = []
  let clientsSkipped = 0
  let refusedOnlySkipped = 0
  // Only the addresses we were ASKED to scan produce nodes. The neighbour cache
  // is machine-wide — it holds the scanner's own segment and multicast groups —
  // so iterating it unfiltered leaked hosts (and mDNS/SSDP pseudo-entries) that
  // were never in the targets.
  const targetSet = new Set(expanded)
  for (const address of targetSet) {
    const neighbor = neighbors.get(address)
    const probe = reachable.get(address)
    if (neighbor) {
      // On-link: the MAC identifies the device and merges it onto whatever
      // another source knows it by (a controller's LLDP chassis MAC).
      if (neighbor.randomized && !input.includeClients) {
        clientsSkipped++
        continue
      }
      noticeNodes.push(noticeNode(address, probe?.via, input.sourceId, neighbor))
    } else if (probe?.via !== undefined) {
      // Routed segment: ARP is link-local, so there is no MAC to harvest. A
      // COMPLETED TCP handshake (`via` set) is still solid existence evidence —
      // a real service answered on a management port. The node carries only its
      // address; the credentialed deep-read supplies the real identity
      // (chassis MAC) and the resolver merges the two by mgmtIp.
      noticeNodes.push(noticeNode(address, probe.via, input.sourceId, null))
    } else if (probe) {
      // Refused-only (RST, no MAC): proves *something* answered at the IP, but
      // a middlebox RST-storm answers for whole subnets — not evidence enough
      // to mint a node. This is the gate that kept a /24 of RSTs off the canvas.
      refusedOnlySkipped++
    }
  }

  if (clientsSkipped > 0) {
    warnings.push(
      `Skipped ${clientsSkipped} host${clientsSkipped === 1 ? '' : 's'} with a randomised MAC ` +
        `(a phone or laptop, not infrastructure). Set includeClients to keep ` +
        `${clientsSkipped === 1 ? 'it' : 'them'}.`,
    )
  }
  if (refusedOnlySkipped > 0) {
    warnings.push(
      `Skipped ${refusedOnlySkipped} address${refusedOnlySkipped === 1 ? '' : 'es'} that only ` +
        `refused connections (no MAC, no open port) — indistinguishable from a firewall's RST.`,
    )
  }
  if (noticeNodes.length > 0) {
    warnings.push(
      `${noticeNodes.length} device${noticeNodes.length === 1 ? '' : 's'} found — awaiting a ` +
        `credential to read ${noticeNodes.length === 1 ? 'it' : 'them'} over SNMP.`,
    )
  }

  return {
    graph: { version: '1.0', nodes: noticeNodes, links: [] },
    warnings,
    stats: { expanded: expanded.length, notice: noticeNodes.length },
  }
}

function emptyResult(warnings: string[]): DiscoverResult {
  return {
    graph: { version: '1.0', nodes: [], links: [] },
    warnings,
    stats: { expanded: 0, notice: 0 },
  }
}

/**
 * Build a "notice" node — a reachable host we have not read. On-link hosts
 * carry address + MAC (the MAC merges them onto whatever another source knows
 * the device by — a controller's LLDP chassis MAC, a prior deep-read). Routed
 * hosts (`neighbor` null) carry only their address; the deep-read supplies the
 * chassis identity later. `metadata.syncState='notice'` drives the UI badge.
 */
function noticeNode(
  address: string,
  via: number | undefined,
  sourceId: string,
  neighbor: NeighborEntry | null,
): Node {
  return {
    id: `${sourceId}:node:${address}`,
    label: address,
    identity: buildIdentity({ mgmtIp: address, ...(neighbor ? { mac: neighbor.mac } : {}) }) ?? {
      mgmtIp: address,
    },
    metadata: {
      syncState: 'notice',
      ...(via !== undefined ? { reachableVia: via } : {}),
    },
    provenance: { source: sourceId, observedAt: Date.now() },
  }
}
