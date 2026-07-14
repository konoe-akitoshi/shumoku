// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Server-side link interface matching for auto-map-links.
 *
 * Mirrors the normalization logic in apps/server/web/src/lib/auto-mapping.ts
 * but runs on the API server where browser-side stores are unavailable.
 * Kept intentionally minimal: the primary resolution path is identity-key
 * exact match (port.id / port.identity.ifName); fuzzy normalization is a
 * fallback for cross-vocabulary names (e.g. NetBox "GE0/1" vs Zabbix "Gi1/0/1").
 */

import type { LinkMetricsMapping } from '@shumoku/core'

// Interface-name prefix synonyms (canonical → set of synonyms including canonical).
// Kept in sync with the browser auto-mapping.ts prefix groups.
const PREFIX_SYNONYMS: [string[], string][] = [
  [['eighthundredgigabitethernet', 'eighthundredgigabitether', 'eighthundredgige', 'ehg'], 'ehge'],
  [['fourhundredgigabitethernet', 'fourhundredgigabitether', 'fourhundredgige', 'fhg'], 'fhge'],
  [['hundredgigabitethernet', 'hundredgigabitether', 'hundredgige', 'hu', 'hg'], 'hge'],
  [['fortygigabitethernet', 'fortygigabitether', 'fortygige', 'fo', 'fg'], 'fge'],
  [['twentyfivegigabitethernet', 'twentyfivegige'], 'xxge'],
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

const SORTED_PREFIX_SYNONYMS = PREFIX_SYNONYMS.map(
  ([synonyms, canonical]) =>
    [synonyms.slice().sort((a, b) => b.length - a.length), canonical] as [string[], string],
)

interface NormalizedIf {
  prefix: string
  numbers: number[]
}

function normalizeIfName(name: string): NormalizedIf {
  const lower = name.toLowerCase().trim()
  let prefix = ''
  let prefixLen = 0
  let rest = lower

  for (const [synonyms, canonical] of SORTED_PREFIX_SYNONYMS) {
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
      return { prefix: lower, numbers: [] }
    }
  }

  rest = rest.replace(/^[^0-9]*/, '')
  const numbers: number[] = []
  if (rest) {
    for (const seg of rest.split('/')) {
      const main = parseInt(seg.split('.')[0] ?? '', 10)
      if (!Number.isNaN(main)) numbers.push(main)
    }
  }
  return { prefix, numbers }
}

function ifMatchScore(a: NormalizedIf, b: NormalizedIf): number {
  if (a.prefix !== b.prefix) return 0
  if (a.numbers.length === 0 && b.numbers.length === 0) return 1.0
  if (a.numbers.length === 0 || b.numbers.length === 0) return 0.3
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
  return matched === maxLen ? 1.0 : 0.5 + (matched / maxLen) * 0.4
}

/**
 * Find the best matching interface name from `candidates` for a port
 * described by `portNames` (id / ifName / label, in preference order).
 *
 * Match priority:
 *   1. Exact name match (case-insensitive) — covers identity-key matches
 *      (port.id IS the ifName for inventory sources)
 *   2. Normalised prefix+number match (cross-vocabulary; score >= 0.5)
 *   3. Number-sequence match as cross-vocabulary fallback (exactly one candidate)
 *
 * Returns the matched candidate name, or null if nothing resolves.
 */
/**
 * The distinct INTERFACE NAMES a host's metric items describe. Metric sources
 * report per-direction items whose `name` is decorated ("Interface ge-0/0/1:
 * Bits received") — matching a port identity against that full string never
 * hits. Prefer the structured `interfaceName`; otherwise strip the
 * "Interface …: Bits …/- Inbound/Outbound" decoration; else use the raw name.
 * Deduped (in + out share one interface).
 */
export function extractInterfaceNames(
  items: readonly { name: string; interfaceName?: string }[],
): string[] {
  const names = new Set<string>()
  for (const it of items) {
    const ifName =
      it.interfaceName ??
      it.name.match(/^(?:Interface\s+)?(.+?)\s*[-:]\s*(?:Bits|Inbound|Outbound)/i)?.[1]?.trim() ??
      it.name
    if (ifName) names.add(ifName)
  }
  return [...names]
}

export function matchInterface(portNames: string[], candidates: string[]): string | null {
  if (candidates.length === 0 || portNames.length === 0) return null

  // 1. Exact match (case-insensitive)
  const lowerCandidates = candidates.map((c) => c.toLowerCase())
  for (const name of portNames) {
    const lower = name.toLowerCase()
    const idx = lowerCandidates.indexOf(lower)
    if (idx !== -1) return candidates[idx] ?? null
  }

  // 2. Normalised fuzzy match
  let bestScore = 0
  let bestCandidate: string | null = null
  const normCandidates = candidates.map((c) => normalizeIfName(c))
  for (const name of portNames) {
    const normPort = normalizeIfName(name)
    for (const [i, normC] of normCandidates.entries()) {
      const score = ifMatchScore(normPort, normC)
      if (score > bestScore) {
        bestScore = score
        bestCandidate = candidates[i] ?? null
      }
    }
  }
  if (bestScore >= 0.5) return bestCandidate

  // 3. Number-sequence fallback: if exactly one candidate shares the number
  //    sequence with any port name candidate, accept it (cross-vocabulary).
  for (const name of portNames) {
    const normPort = normalizeIfName(name)
    if (normPort.numbers.length === 0) continue
    const want = normPort.numbers.join('/')
    const hits = candidates.filter((c) => normalizeIfName(c).numbers.join('/') === want)
    if (hits.length === 1) return hits[0] ?? null
  }

  return null
}

// ============================================
// Link auto-map planning (pure)
// ============================================

/** A link the planner iterates: its stable key + both endpoints. */
export interface PlannableLink {
  key: string
  from: { node: string; port: string }
  to: { node: string; port: string }
}

/**
 * Inputs the planner needs, injected so the decision logic is a pure function
 * (no DB / network): which host a node is mapped to, the port-identity
 * candidates for an endpoint, and the interface names a host reports.
 */
export interface LinkAutoMapDeps {
  /** hostId a node is mapped to (undefined = not mapped). */
  hostForNode: (nodeId: string) => string | undefined
  /** Identity-key candidates for an endpoint port (id / ifName / label / aliases). */
  portCandidates: (nodeId: string, portId: string) => string[]
  /** Interface names the metrics source reports for a host. */
  interfacesForHost: (hostId: string) => string[]
}

/** What {@link planLinkAutoMap} decided, ready to fold into a mapping + summary. */
export interface LinkAutoMapPlan {
  /** New/updated link mappings, keyed by link key. Only the matched links. */
  resolved: Record<string, LinkMetricsMapping>
  matched: number
  /** Links skipped because already fully mapped and `overwrite` was false. */
  skipped: number
}

/**
 * Decide, for each link, which endpoint to monitor and which interface — the
 * deterministic core of server-side link auto-map, kept pure so it's testable
 * without a DB. For a link with at least one mapped endpoint it tries the
 * from-endpoint first, then the to-endpoint; the monitored end is the first
 * whose port identity ({@link matchInterface}) resolves to one of that host's
 * interfaces. A link already carrying both a monitored node AND an interface is
 * left untouched (and counted as skipped) unless `overwrite` is set. Links with
 * no mapped endpoint, or no resolvable interface, are simply not in `resolved`.
 */
export function planLinkAutoMap(
  links: readonly PlannableLink[],
  existing: Record<string, LinkMetricsMapping>,
  deps: LinkAutoMapDeps,
  opts: { overwrite?: boolean } = {},
): LinkAutoMapPlan {
  const resolved: Record<string, LinkMetricsMapping> = {}
  let matched = 0
  let skipped = 0

  for (const link of links) {
    const prior = existing[link.key]
    // Respect overwrite:false — leave a fully-mapped link alone.
    if (!opts.overwrite && prior?.monitoredNodeId && prior.interface) {
      skipped++
      continue
    }

    // Ordered from-then-to; only endpoints whose node is mapped to a host.
    const toTry: { nodeId: string; portId: string; hostId: string }[] = []
    const fromHost = deps.hostForNode(link.from.node)
    const toHost = deps.hostForNode(link.to.node)
    if (fromHost) toTry.push({ nodeId: link.from.node, portId: link.from.port, hostId: fromHost })
    if (toHost) toTry.push({ nodeId: link.to.node, portId: link.to.port, hostId: toHost })
    if (toTry.length === 0) continue // no mapped endpoint

    for (const ep of toTry) {
      const iface = matchInterface(
        deps.portCandidates(ep.nodeId, ep.portId),
        deps.interfacesForHost(ep.hostId),
      )
      if (iface) {
        resolved[link.key] = { ...(prior ?? {}), monitoredNodeId: ep.nodeId, interface: iface }
        matched++
        break
      }
    }
  }

  return { resolved, matched, skipped }
}

/**
 * Union a host's interface names across several metrics sources — the
 * self-select contract the poller already relies on: every attached source is
 * asked, and a source that doesn't know the host (or errors) contributes
 * nothing. This is what makes link auto-map "auto" on a multi-source
 * topology: the operator doesn't pick which source owns which host; whichever
 * source recognizes the hostId answers with its interfaces.
 *
 * Robustness: sources are queried in PARALLEL per host, each call is bounded
 * by a timeout, and a source that fails twice in a row is dropped for the
 * remaining hosts (circuit breaker) — one unreachable upstream must not turn
 * an auto-map into minutes of serial network timeouts.
 */
export async function unionInterfacesAcrossSources(
  hostIds: readonly string[],
  sourceIds: readonly string[],
  getHostItems: (
    sourceId: string,
    hostId: string,
  ) => Promise<readonly { name: string; interfaceName?: string }[]>,
  mapConcurrent: <T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>) => Promise<R[]>,
  opts: { timeoutMs?: number; maxConsecutiveFailures?: number } = {},
): Promise<Map<string, string[]>> {
  const timeoutMs = opts.timeoutMs ?? 8000
  const maxFailures = opts.maxConsecutiveFailures ?? 2
  const consecutiveFailures = new Map<string, number>()

  const withTimeout = <T>(promise: Promise<T>): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('getHostItems timeout')), timeoutMs)
      promise.then(
        (v) => {
          clearTimeout(timer)
          resolve(v)
        },
        (e) => {
          clearTimeout(timer)
          reject(e)
        },
      )
    })

  const fetched = await mapConcurrent([...hostIds], 5, async (hostId) => {
    const names = new Set<string>()
    const live = sourceIds.filter((sid) => (consecutiveFailures.get(sid) ?? 0) < maxFailures)
    const results = await Promise.allSettled(
      live.map(async (sourceId) => ({
        sourceId,
        items: await withTimeout(getHostItems(sourceId, hostId)),
      })),
    )
    for (const r of results) {
      if (r.status === 'fulfilled') {
        consecutiveFailures.set(r.value.sourceId, 0)
        for (const name of extractInterfaceNames(r.value.items)) names.add(name)
      }
    }
    for (const [i, r] of results.entries()) {
      if (r.status === 'rejected') {
        const sid = live[i]
        if (sid) consecutiveFailures.set(sid, (consecutiveFailures.get(sid) ?? 0) + 1)
      }
    }
    return [hostId, [...names]] as [string, string[]]
  })
  return new Map(fetched)
}
