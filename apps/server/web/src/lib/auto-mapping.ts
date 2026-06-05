// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Auto-mapping utilities for network topology.
 *
 * Provides fuzzy matching for:
 * - Node names ↔ monitoring host names
 * - Interface/port names across different systems (NetBox, Zabbix, SNMP, etc.)
 *
 * Different systems use different naming conventions for the same physical port:
 *   NetBox "GE0/1"  ↔  Zabbix "Gi1/0/1"  ↔  SNMP "GigabitEthernet1/0/1"
 *   NetBox "TE1/1"  ↔  Zabbix "Te1/1/1"
 *   NetBox "GE0/0"  ↔  Zabbix "GigaEthernet0"  (UNIVERGE IX)
 */

import { type Identity, type InterfaceNeighbor, nodeIdentityKeys } from '@shumoku/core'

// ============================================
// Interface name prefix synonyms
// ============================================

const PREFIX_GROUPS: [string[], string][] = [
  // Speed prefixes carry vendor full names, common abbreviations, and TTDB's
  // speed-coded forms (eg = 1G, xg = 10G, fg = 40G, hg = 100G, fhg = 400G,
  // ehg = 800G). Zabbix SNMP sometimes truncates the vendor word
  // ("HundredGigabitEther"), so the truncated spelling is listed too.
  [
    ['eighthundredgigabitethernet', 'eighthundredgigabitether', 'eighthundredgige', 'ehg'],
    'eighthundredge',
  ],
  [
    ['fourhundredgigabitethernet', 'fourhundredgigabitether', 'fourhundredgige', 'fhg'],
    'fourhundredge',
  ],
  [['hundredgigabitethernet', 'hundredgigabitether', 'hundredgige', 'hu', 'hg'], 'hundredge'],
  [['fortygigabitethernet', 'fortygigabitether', 'fortygige', 'fo', 'fg'], 'fortyge'],
  [['twentyfivegigabitethernet', 'twentyfivegige'], 'twentyfivege'],
  [
    ['tengigabitethernet', 'tengigabitether', 'tengigaethernet', 'tenge', 'te', 'xge', 'xe', 'xg'],
    'te',
  ],
  [['gigabitethernet', 'gigaethernet', 'gi', 'ge'], 'ge'],
  [['fastethernet', 'fa', 'fe'], 'fe'],
  [['ethernet', 'ens', 'enp', 'eno', 'eth', 'en'], 'eth'],
  [['port-channel', 'portchannel', 'po', 'ae', 'bond'], 'lag'],
  [['vlan', 'vl', 'irb'], 'vlan'],
  [['loopback', 'lo'], 'lo'],
  [['tunnel', 'tu', 'tun'], 'tun'],
  [['management', 'mgmt', 'me'], 'mgmt'],
  [['wireless', 'wifi', 'wlan'], 'wlan'],
  [['wired'], 'wired'],
  [['serial', 'se'], 'serial'],
  [['bvi'], 'bvi'],
]

// Pre-sort: longest synonym first for greedy matching
const SORTED_PREFIX_GROUPS = PREFIX_GROUPS.map(
  ([synonyms, canonical]) =>
    [synonyms.slice().sort((a, b) => b.length - a.length), canonical] as [string[], string],
)

// ============================================
// Normalization
// ============================================

export interface NormalizedInterface {
  prefix: string
  numbers: number[]
  sub: number | null
  original: string
}

/**
 * Normalize a network interface name into structured form.
 *
 *   "GigabitEthernet1/0/2"  → { prefix: "ge", numbers: [1, 0, 2], sub: null }
 *   "GE0/1"                 → { prefix: "ge", numbers: [0, 1],    sub: null }
 *   "GigaEthernet0.0"       → { prefix: "ge", numbers: [0],       sub: 0    }
 *   "eth0"                  → { prefix: "eth", numbers: [0],      sub: null }
 */
export function normalizeInterfaceName(name: string): NormalizedInterface {
  const lower = name.toLowerCase().trim()

  let prefix = ''
  let prefixLen = 0
  let rest = lower

  // Scan all groups to find the globally longest matching prefix
  for (const [synonyms, canonical] of SORTED_PREFIX_GROUPS) {
    for (const syn of synonyms) {
      if (lower.startsWith(syn) && syn.length > prefixLen) {
        prefix = canonical
        prefixLen = syn.length
        rest = lower.slice(syn.length)
      }
    }
  }

  if (!prefix) {
    const m = lower.match(/^([a-z][a-z-]*)(.*)$/)
    if (m?.[1] && m[2]) {
      prefix = m[1]
      rest = m[2]
    } else {
      return { prefix: lower, numbers: [], sub: null, original: name }
    }
  }

  // Strip leading non-digit separators
  rest = rest.replace(/^[^0-9]*/, '')

  const numbers: number[] = []
  let sub: number | null = null

  if (rest) {
    const segments = rest.split('/')
    for (const [i, seg] of segments.entries()) {
      const dotParts = seg.split('.')
      if (!dotParts[0]) continue
      const main = parseInt(dotParts[0], 10)
      if (!Number.isNaN(main)) numbers.push(main)

      // Sub-interface: only on last segment
      if (i === segments.length - 1 && dotParts.length > 1 && dotParts[1]) {
        const s = parseInt(dotParts[1], 10)
        if (!Number.isNaN(s)) sub = s
      }
    }
  }

  return { prefix, numbers, sub, original: name }
}

// ============================================
// Interface matching
// ============================================

/**
 * Score how well two normalized interface names match (0–1).
 *
 * - Prefix must be the same canonical group
 * - Port numbers compared right-to-left (rightmost = most specific)
 * - Sub-interface ignored for scoring
 */
export function interfaceMatchScore(a: NormalizedInterface, b: NormalizedInterface): number {
  if (a.prefix !== b.prefix) return 0

  if (a.numbers.length === 0 && b.numbers.length === 0) return 1.0
  if (a.numbers.length === 0 || b.numbers.length === 0) return 0.3

  // Compare from rightmost (port number is most specific)
  const aRev = [...a.numbers].reverse()
  const bRev = [...b.numbers].reverse()
  const minLen = Math.min(aRev.length, bRev.length)

  let matched = 0
  for (let i = 0; i < minLen; i++) {
    if (aRev[i] === bRev[i]) matched++
    else break
  }

  if (matched === 0) return 0

  const maxLen = Math.max(aRev.length, bRev.length)
  // All segments match → perfect (1.0); partial → range [0.5, 0.9]
  return matched === maxLen ? 1.0 : 0.5 + (matched / maxLen) * 0.4
}

export interface InterfaceMatchOptions {
  /** Minimum score to consider a match (default: 0.5) */
  threshold?: number
  /**
   * If true and there is exactly one candidate, match it regardless of score.
   * Useful for devices like APs that have a single wired port with
   * different names across systems (e.g. NetBox "main" ↔ Zabbix "wired0").
   */
  singleCandidateFallback?: boolean
}

/**
 * Find the best matching interface name from candidates.
 */
export function findBestInterfaceMatch(
  portName: string,
  candidates: string[],
  options: InterfaceMatchOptions | number = 0.5,
): string | null {
  if (candidates.length === 0) return null

  const opts: InterfaceMatchOptions = typeof options === 'number' ? { threshold: options } : options
  const threshold = opts.threshold ?? 0.5

  const norm = normalizeInterfaceName(portName)
  let bestScore = 0
  let bestCandidate: string | null = null

  for (const c of candidates) {
    const score = interfaceMatchScore(norm, normalizeInterfaceName(c))
    if (score > bestScore) {
      bestScore = score
      bestCandidate = c
    }
  }

  if (bestScore >= threshold) return bestCandidate

  // Cross-vocabulary fallback: a port named by speed class (TTDB's hg/xg/fhg…)
  // and one named by media/type (`Ethernet1/5`, `et-0/0/0`, `swp0`) share no
  // canonical prefix, so the score above is 0 even for the same physical port —
  // but the port NUMBER aligns. Match on the number sequence, and only when
  // exactly one candidate carries it, so genuinely ambiguous cases (a chassis
  // exposing `ge-0/1` and `xe-0/1`) fall through instead of mis-binding.
  if (norm.numbers.length > 0) {
    const want = norm.numbers.join('/')
    const numHits = candidates.filter((c) => normalizeInterfaceName(c).numbers.join('/') === want)
    if (numHits.length === 1) return numHits[0] ?? null
  }

  // Fallback: single candidate → assume it's the same physical port
  if (opts.singleCandidateFallback && candidates.length === 1) {
    return candidates[0] ?? null
  }

  return null
}

/**
 * Rank all candidates by match score.
 */
export function rankInterfaceMatches(
  portName: string,
  candidates: string[],
  threshold = 0.3,
): Array<{ name: string; score: number }> {
  const norm = normalizeInterfaceName(portName)
  return candidates
    .map((name) => ({
      name,
      score: interfaceMatchScore(norm, normalizeInterfaceName(name)),
    }))
    .filter((m) => m.score >= threshold)
    .sort((a, b) => b.score - a.score)
}

// ============================================
// Node name matching
// ============================================

/** Default minimum score for node name auto-mapping */
export const NODE_MATCH_THRESHOLD = 0.7

/**
 * Score how well a topology node name matches a monitoring host name (0–1).
 */
export function nodeNameMatchScore(
  nodeName: string,
  hostName: string,
  hostDisplayName?: string,
): number {
  const n = nodeName.toLowerCase().trim()
  const h = hostName.toLowerCase().trim()
  const d = hostDisplayName?.toLowerCase().trim()

  // Exact
  if (h === n || d === n) return 1.0

  // Without domain suffix
  const nBase = n.split('.')[0]
  const hBase = h.split('.')[0]
  if (hBase === nBase) return 0.9

  // Case-insensitive containment
  if (h.includes(n) || n.includes(h)) return 0.7
  if (d && (d.includes(n) || n.includes(d))) return 0.7

  return 0
}

// ============================================
// Composite node → host matching
// ============================================

/** Minimal host shape the matcher needs (a `MappingHost` satisfies it). */
export interface MatchableHost {
  id: string
  name: string
  displayName?: string
  identity?: Identity
}

/** Minimal node shape the matcher needs (a topology `Node` satisfies it). */
export interface MatchableNode {
  label?: string | string[]
  identity?: Identity
}

/** Result of {@link matchNodeToHost}: the chosen host and which signal won. */
export interface NodeHostMatch<H> {
  host: H
  /** `'identity'` = a shared device key drove it; `'name'` = fuzzy name only. */
  via: 'identity' | 'name'
}

/**
 * Weight of each identity-key kind, derived from core's own priority order
 * (`nodeIdentityKeys` emits the strongest key first) instead of a duplicated
 * magic table — reorder or extend the keys in core and this follows along.
 * Yields mgmtIp > chassisId > sysName > vendorId.
 */
const IDENTITY_KIND_WEIGHT: Record<string, number> = (() => {
  const order = nodeIdentityKeys({
    mgmtIp: 'x',
    chassisId: 'x',
    sysName: 'x',
    vendorIds: { x: 'x' },
  }).map((k) => k.kind)
  const weights: Record<string, number> = {}
  order.forEach((kind, i) => {
    weights[kind] = order.length - i
  })
  return weights
})()

/**
 * Name similarity contributes strictly below the weakest identity key, so it
 * disambiguates otherwise-tied identity matches without ever outranking a real
 * identity signal.
 */
const NAME_TIEBREAK_WEIGHT = 0.9

/** Composite identity score: sum of the weights of every key node & host share. */
function identityMatchScore(node: MatchableNode, host: MatchableHost): number {
  if (!node.identity) return 0
  const hostKeys = new Set(nodeIdentityKeys(host.identity).map((k) => `${k.kind}:${k.value}`))
  let score = 0
  for (const k of nodeIdentityKeys(node.identity)) {
    if (hostKeys.has(`${k.kind}:${k.value}`)) score += IDENTITY_KIND_WEIGHT[k.kind] ?? 0
  }
  return score
}

/**
 * Pick the best host for a node by combining *every* shared identity key
 * (weighted by strength) with fuzzy name similarity into a single score:
 *
 *   score(host) = Σ weight(kind) for each identity key node & host share
 *               + nameSimilarity · NAME_TIEBREAK_WEIGHT
 *
 * The composite is what makes this robust without special-casing: a host
 * sharing mgmtIp *and* name beats one sharing only mgmtIp, and when several
 * hosts tie on a strong key (e.g. a management IP that Zabbix monitors twice)
 * a weaker shared key — or the name — breaks the tie. If nothing distinguishes
 * the top identity candidates, we return `null` rather than guess.
 *
 * Falls back to name-only matching (threshold `NODE_MATCH_THRESHOLD`) when the
 * node carries no identity, preserving behaviour for hand-authored topologies.
 */
export function matchNodeToHost<H extends MatchableHost>(
  node: MatchableNode,
  hosts: readonly H[],
): NodeHostMatch<H> | null {
  const nodeLabel = Array.isArray(node.label) ? node.label[0] : node.label
  // Try both the display label and the discovered sysName as the node's name:
  // a device's sysName ("dl380-1.dc") often matches a monitoring host's visible
  // name even when the human label ("DL380 Gen12-1") doesn't.
  const nodeNames = [nodeLabel, node.identity?.sysName].filter((s): s is string => !!s)

  let best: { host: H; total: number; identity: number; name: number } | null = null
  let topCount = 0
  for (const host of hosts) {
    const identity = identityMatchScore(node, host)
    const name = nodeNames.reduce(
      (max, n) => Math.max(max, nodeNameMatchScore(n, host.name, host.displayName)),
      0,
    )
    const total = identity + name * NAME_TIEBREAK_WEIGHT
    if (!best || total > best.total) {
      best = { host, total, identity, name }
      topCount = 1
    } else if (total === best.total) {
      topCount++
    }
  }

  if (!best || best.total <= 0) return null

  if (best.identity > 0) {
    // Identity-driven match: refuse to guess between equally-scored hosts.
    if (topCount > 1) return null
    return { host: best.host, via: 'identity' }
  }

  // Name-only match: keep the previous threshold; ties resolve to the first
  // host at the top score (source-priority order via the strict `>` above).
  if (best.name < NODE_MATCH_THRESHOLD) return null
  return { host: best.host, via: 'name' }
}

// ============================================
// Link → interface resolution via neighbour discovery (LLDP/CDP)
// ============================================

/** The far-end node of a link, as the matcher needs to recognise it. */
export interface MatchablePeer {
  identity?: Identity
  label?: string | string[]
}

/** True if two device names refer to the same host (exact or domain-stripped). */
function sameDeviceName(a: string | undefined, b: string | undefined): boolean {
  return !!a && !!b && nodeNameMatchScore(a, b) >= 0.9
}

/**
 * Resolve which local interface faces `peer` using a host's neighbour table —
 * the deterministic, naming-agnostic alternative to interface-name matching.
 *
 * A link `A↔B` asks A's neighbours for the one whose remote end is B (matched
 * by sysName / chassisId / mgmtIp, or the peer's label). When several local
 * interfaces face B (a LAG or parallel links), `peerPort` disambiguates via the
 * neighbour's `remotePortId`. Returns null if no neighbour matches or the
 * choice stays ambiguous — callers fall back to name matching.
 */
export function matchInterfaceByNeighbor(
  peer: MatchablePeer,
  peerPort: string | undefined,
  neighbors: readonly InterfaceNeighbor[],
): string | null {
  if (neighbors.length === 0) return null

  const peerLabel = Array.isArray(peer.label) ? peer.label[0] : peer.label
  const peerSys = peer.identity?.sysName
  const peerChassis = peer.identity?.chassisId?.toLowerCase()
  const peerMgmt = peer.identity?.mgmtIp

  const facesPeer = (n: InterfaceNeighbor): boolean => {
    if (n.remoteChassisId && peerChassis && n.remoteChassisId.toLowerCase() === peerChassis) {
      return true
    }
    const rs = n.remoteSysName
    if (rs && (sameDeviceName(rs, peerSys) || sameDeviceName(rs, peerLabel) || rs === peerMgmt)) {
      return true
    }
    return false
  }

  const hits = neighbors.filter(facesPeer)
  if (hits.length === 0) return null
  if (hits.length === 1) return hits[0]?.localInterface ?? null

  // Parallel links / LAG: disambiguate by the peer's own port id.
  if (peerPort) {
    const remotePorts = hits.map((n) => n.remotePortId).filter((p): p is string => !!p)
    const bestRemote = findBestInterfaceMatch(peerPort, remotePorts)
    if (bestRemote) {
      const picked = hits.filter((n) => n.remotePortId === bestRemote)
      if (picked.length === 1) return picked[0]?.localInterface ?? null
    }
  }

  return null // ambiguous → fall back to name matching
}
