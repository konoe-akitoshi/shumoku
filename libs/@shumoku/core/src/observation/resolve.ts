// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import {
  type Attachment,
  attachmentKey,
  type Identity,
  type Link,
  type LinkEndpoint,
  type NetworkGraph,
  type Node,
  type NodeExclusion,
  type NodePort,
  type Provenance,
  type Subgraph,
} from '../models/types.js'
import { keyHash, nodeIdentityKeys, portIdentityKeys } from './identity.js'
import type { ResolvedGraph, ResolveOptions, SnapshotEntry } from './types.js'

/**
 * Resolve an authored NetworkGraph against any number of source
 * snapshots into a single graph whose every entity carries
 * `provenance`.
 *
 * Model: **all sources are equal, priority-ordered contributions.** The
 * authored (human) graph is just the top-priority source; observed
 * snapshots carry their own priority (mirroring
 * `topology_data_sources.priority`). resolve clusters contributions by
 * identity (any-key match — orthogonal to priority) and then, **per
 * field**, the highest-priority contribution that actually holds a value
 * wins (`priority desc, capturedAt desc`). A field nobody holds is
 * omitted. This is the "Git-like" merge: a human who only renamed a node
 * keeps the observed ports/community flowing through untouched.
 *
 * There is intentionally NO `authored ===` special-casing in the field
 * merge — "human wins" falls out of "human has the highest priority". The
 * literal `'authored'` survives only as the human contribution's source
 * *label*, so the UI can tell a human-set value from an observed one
 * (per-field `fieldSources`, per-attachment `provenance`).
 *
 * See `apps/server/docs/design/topology-source-priority-merge.md`.
 */
export function resolve(
  authored: NetworkGraph,
  snapshots: SnapshotEntry[],
  options: ResolveOptions = {},
): ResolvedGraph {
  const _staleThreshold = options.staleThresholdMs ?? 30 * 24 * 60 * 60 * 1000
  const _retractAfter = options.retractAfterMissedScans ?? 3
  // Retraction (design decision 4) is ORTHOGONAL to priority. Two axes:
  //   - presence: a resolved node exists iff some surviving contribution
  //     carries it. Presence is the *union* of clusters, so priority —
  //     which only decides per-field winners — never adds or drops a node.
  //   - retraction: an OBSERVED contribution may stop carrying a node.
  // v1 feeds only the latest non-failed snapshot per source (see
  // services/topology.ts → latestSuccessfulPerSource), so "retraction" today
  // is simply "absent from the latest successful snapshot". A failed scan is
  // skipped at the feed, so it never replaces a source's last-good snapshot.
  // There is no multi-scan hysteresis yet; _staleThreshold / _retractAfter
  // stay documented knobs for when snapshot history is fed in.
  //
  // Invariants that MUST hold regardless of priority (covered by tests):
  //   - The human/authored contribution is never retracted. A node the
  //     operator touched (rename, access, or a policy=disabled overlay) is
  //     an authored contribution, so it persists until Reset.
  //   - A 'failed' snapshot is ignored — never read as a retraction.
  //   - When real hysteresis lands it must gate on
  //     `absenceImpliesRetraction(effectivePolicyForNode(authored, node))`
  //     so a policy=disabled node survives being missing from a
  //     status='ok' snapshot (the operator opted out; absence carries no
  //     information). Codex flagged this as the highest-impact footgun.
  void _staleThreshold
  void _retractAfter

  // 1. Gather valid contributions. The authored graph is the top-priority
  //    contribution ("human wins" = "human outranks every source"); every
  //    non-failed snapshot is a contribution at its own priority. Identity
  //    clustering ignores priority; only the field merge consults it.
  const contributions: Contribution[] = [
    {
      sourceId: 'authored',
      priority: Number.POSITIVE_INFINITY,
      capturedAt: Number.POSITIVE_INFINITY,
      graph: authored,
    },
  ]
  for (const snap of snapshots) {
    if (snap.status === 'failed' || !snap.graph) continue
    contributions.push({
      sourceId: snap.sourceId,
      priority: snap.priority ?? 0,
      capturedAt: snap.capturedAt,
      graph: snap.graph,
    })
  }

  // 2. Build node clusters by identity keys
  const allClusters = clusterNodes(contributions)

  // 2b. Drop hidden clusters. A cluster is hidden when its merged identity
  //     matches any exclusion (by mgmtIp / chassisId / sysName). Identity-keyed
  //     so a hide survives re-scans that re-number ephemeral node ids. Dropping
  //     here (before link folding) also removes links to hidden nodes.
  const exclusions = authored.exclusions ?? []
  const nodeClusters =
    exclusions.length > 0
      ? allClusters.filter((c) => !isClusterExcluded(c, exclusions))
      : allClusters

  // 3. For each cluster, fold into a single resolved Node
  const resolvedNodes: Node[] = []
  const clusterById = new Map<string, NodeCluster>()
  for (const cluster of nodeClusters) {
    const node = foldNodeCluster(cluster)
    resolvedNodes.push(node)
    // Bind each member's original `id` → cluster id so links can be remapped
    for (const member of cluster.members) {
      clusterById.set(`${member.sourceId}:${member.node.id}`, cluster)
    }
  }

  // 4. Fold links — endpoint remapping only; cross-cluster matching is
  //    out of scope for the skeleton.
  const resolvedLinks = foldLinks(contributions, clusterById)

  // 5. Subgraphs — pass through authored, then stamp provenance.
  //    Workload-source subgraphs are v2; skeleton respects authored only.
  const resolvedSubgraphs = foldSubgraphs(authored)

  return {
    version: authored.version,
    name: authored.name,
    description: authored.description,
    nodes: resolvedNodes,
    links: resolvedLinks,
    subgraphs: resolvedSubgraphs,
    terminations: authored.terminations,
    settings: authored.settings,
    pins: authored.pins,
  }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

interface Contribution {
  sourceId: string
  /** Higher wins per field. Authored/human = +Infinity. */
  priority: number
  capturedAt: number
  graph: NetworkGraph
}

interface ClusterMember {
  sourceId: string
  priority: number
  capturedAt: number
  node: Node
}

interface NodeCluster {
  /** Synthesized id — preferring authored id when an authored member exists. */
  id: string
  members: ClusterMember[]
}

/**
 * "Has a value worth merging" — non-null AND non-empty (decision 1 of the
 * priority-merge design). Empty string / empty array / null all yield to
 * the next-highest-priority contribution. Same rule for observed and human
 * values, so a thin human overlay carrying `label: ''` simply makes no
 * claim on `label` (no sentinel special-case needed).
 */
function hasValue(v: unknown): boolean {
  if (v == null) return false
  if (v === '') return false
  if (Array.isArray(v) && v.length === 0) return false
  return true
}

interface FieldWin<T> {
  value: T
  source: string
}

/**
 * Pick the field winner: the first member (members are pre-sorted
 * priority desc, capturedAt desc) whose node holds a value (`hasValue`).
 * Returns the value and the source that supplied it (for `fieldSources`).
 */
function pickField<T>(
  ranked: ClusterMember[],
  read: (n: Node) => T | undefined,
): FieldWin<T> | undefined {
  for (const m of ranked) {
    const v = read(m.node)
    if (hasValue(v)) return { value: v as T, source: m.sourceId }
  }
  return undefined
}

function rankMembers(members: ClusterMember[]): ClusterMember[] {
  return [...members].sort((a, b) => b.priority - a.priority || b.capturedAt - a.capturedAt)
}

function clusterNodes(contributions: Contribution[]): NodeCluster[] {
  const clusters: NodeCluster[] = []
  // Map identity-key-hash → cluster index
  const keyIndex = new Map<string, number>()
  // Every cluster id handed out so far. Authored nodes keep their own id,
  // which can itself look like a synthesized `discovered:N` (e.g. a node
  // adopted into Manual from a previously-synthesized id). Tracking used
  // ids lets the synthetic generator skip those, so two clusters never
  // share an id — a duplicate id crashes the keyed grid in the UI.
  const usedClusterIds = new Set<string>()
  let nextSynthId = 0

  const claim = (member: ClusterMember): void => {
    const keys = nodeIdentityKeys(member.node.identity)
    // Try to find an existing cluster via any key
    let hit: number | undefined
    for (const key of keys) {
      const idx = keyIndex.get(keyHash(key))
      if (idx !== undefined) {
        hit = idx
        break
      }
    }
    if (hit !== undefined) {
      clusters[hit]?.members.push(member)
    } else {
      // Brand new cluster. Authored members keep their own id; discovered
      // members get a synthesized one — skipping any id already in use so a
      // synthetic `discovered:N` can't collide with an authored node that
      // happens to carry the same id.
      let id: string
      if (member.sourceId === 'authored') {
        id = member.node.id
      } else {
        do {
          id = `discovered:${nextSynthId++}`
        } while (usedClusterIds.has(id))
      }
      usedClusterIds.add(id)
      const cluster: NodeCluster = { id, members: [member] }
      clusters.push(cluster)
      hit = clusters.length - 1
    }
    // Bind every identity key of this member to the cluster — including
    // keys not used to find it. Future weaker observations can collapse.
    for (const key of keys) {
      const h = keyHash(key)
      if (!keyIndex.has(h)) keyIndex.set(h, hit)
    }
    // Also bind a deterministic per-source id fallback so identity-less
    // nodes still match themselves across re-runs of the same source.
    if (keys.length === 0) {
      const fallback = keyHash({ kind: 'vendorId', value: `${member.sourceId}:${member.node.id}` })
      keyIndex.set(fallback, hit)
    }
  }

  // Authored first so cluster ids prefer authored values. This ordering is
  // about id preference only — it does NOT decide field winners (priority
  // does, in foldNodeCluster) and does NOT decide identity (any-key match).
  for (const contrib of contributions) {
    if (contrib.sourceId !== 'authored') continue
    for (const node of contrib.graph.nodes) {
      claim({
        sourceId: contrib.sourceId,
        priority: contrib.priority,
        capturedAt: contrib.capturedAt,
        node,
      })
    }
  }
  for (const contrib of contributions) {
    if (contrib.sourceId === 'authored') continue
    for (const node of contrib.graph.nodes) {
      claim({
        sourceId: contrib.sourceId,
        priority: contrib.priority,
        capturedAt: contrib.capturedAt,
        node,
      })
    }
  }
  return clusters
}

/**
 * True when a cluster's merged identity matches any exclusion. An exclusion
 * matches when every key it specifies equals the cluster's corresponding
 * identity value (mgmtIp / chassisId / sysName). An exclusion with no usable
 * key never matches. Uses the union of all members' identity keys so a hide
 * keyed on chassisId still catches a cluster found via mgmtIp.
 */
function isClusterExcluded(cluster: NodeCluster, exclusions: NodeExclusion[]): boolean {
  const identity = mergeIdentities(cluster.members.map((m) => m.node.identity))
  if (!identity) return false
  for (const ex of exclusions) {
    const keys: Array<keyof NodeExclusion> = ['mgmtIp', 'chassisId', 'sysName']
    const used = keys.filter((k) => ex[k] !== undefined && ex[k] !== '')
    if (used.length === 0) continue
    // Match when ANY specified key matches — a Hide stored with mgmtIp +
    // chassisId + sysName must keep biting even if one of them later changes
    // (e.g. a sysName rename or chassisId re-normalization). Requiring ALL to
    // match would silently un-hide the node. Matches the type's doc comment.
    if (used.some((k) => identity[k] !== undefined && identity[k] === ex[k])) return true
  }
  return false
}

/**
 * Fold a cluster of same-device observations into one resolved Node by
 * picking, for every field, the highest-priority contribution that holds a
 * value. No layer concept, no `authored ===` branch — "human wins" is just
 * "+Infinity priority". `fieldSources` / attachment `provenance` record who
 * won each field so the UI can show human values as editable and observed
 * values as read-only.
 */
function foldNodeCluster(cluster: NodeCluster): Node {
  const ranked = rankMembers(cluster.members)
  const top = ranked[0]
  if (!top) {
    // unreachable — cluster always has at least one member
    throw new Error('empty cluster')
  }

  const hasAuthored = cluster.members.some((m) => m.sourceId === 'authored')
  const observerCount = cluster.members.filter((m) => m.sourceId !== 'authored').length

  // Identity: union of all members' identity keys (keep first non-empty value)
  const mergedIdentity = mergeIdentities(cluster.members.map((m) => m.node.identity))

  // Per-field winners (priority desc, capturedAt desc; must hold a value).
  const labelWin = pickField(ranked, (n) => n.label)
  const shapeWin = pickField(ranked, (n) => n.shape)
  const parentWin = pickField(ranked, (n) => n.parent)
  const rankWin = pickField(ranked, (n) => n.rank)
  const styleWin = pickField(ranked, (n) => n.style)
  const specWin = pickField(ranked, (n) => n.spec)
  const productIdWin = pickField(ranked, (n) => n.productId)
  const positionWin = pickField(ranked, (n) => n.position)
  const sizeWin = pickField(ranked, (n) => n.size)
  const terminationWin = pickField(ranked, (n) => n.termination)

  // Metadata: per-key, highest-priority defined value wins (structural map
  // merge, not the scalar hasValue rule — `false` / `0` are legit values).
  const mergedMetadata = mergeMetadata(ranked)
  // Preserve the observing source for the discovery UI ("Tracked by" line,
  // which source to Probe). Highest-ranked non-authored member.
  const primaryObserver = ranked.find((m) => m.sourceId !== 'authored')
  if (primaryObserver && mergedMetadata['observedSource'] === undefined) {
    mergedMetadata['observedSource'] = primaryObserver.sourceId
  }

  // Suppression: attachment keys the human removed (negative assertion — the
  // counterpart to a positive override). Only the human contribution can
  // suppress; a source can't remove another's attachment. Collected from the
  // authored member(s) and passed through onto the resolved node so the UI can
  // round-trip it (a re-scan re-supplying the attachment won't resurrect it).
  const suppressed = Array.from(
    new Set(
      cluster.members
        .filter((m) => m.sourceId === 'authored')
        .flatMap((m) => m.node.suppressedAttachments ?? []),
    ),
  )

  // Attachments: per kind (+protocol for access), highest-priority wins, each
  // stamped with the provenance of the source that supplied it; any key the
  // human suppressed is dropped.
  const attachments = foldAttachments(ranked, suppressed)

  const ports = foldPortsAcrossCluster(cluster)

  // fieldSources: who won the human-relevant fields. Lets the UI render the
  // displayed name/spec as a human override vs an observed fact.
  const fieldSources: Record<string, string> = {}
  if (labelWin) fieldSources['label'] = labelWin.source
  if (specWin) fieldSources['spec'] = specWin.source
  if (parentWin) fieldSources['parent'] = parentWin.source

  const resolved: Node = {
    id: cluster.id,
    label: labelWin?.value ?? top.node.label,
    ...(shapeWin ? { shape: shapeWin.value } : {}),
    ...(parentWin ? { parent: parentWin.value } : {}),
    ...(rankWin ? { rank: rankWin.value } : {}),
    ...(styleWin ? { style: styleWin.value } : {}),
    ...(specWin ? { spec: specWin.value } : {}),
    ...(productIdWin ? { productId: productIdWin.value } : {}),
    ...(positionWin ? { position: positionWin.value } : {}),
    ...(sizeWin ? { size: sizeWin.value } : {}),
    ...(terminationWin ? { termination: terminationWin.value } : {}),
    ...(Object.keys(mergedMetadata).length > 0 ? { metadata: mergedMetadata } : {}),
    ...(mergedIdentity ? { identity: mergedIdentity } : {}),
    ...(attachments.length > 0 ? { attachments } : {}),
    ...(ports ? { ports } : {}),
    ...(Object.keys(fieldSources).length > 0 ? { fieldSources } : {}),
    ...(suppressed.length > 0 ? { suppressedAttachments: suppressed } : {}),
    provenance: deriveNodeProvenance(cluster, observerCount, hasAuthored),
  }

  // Factual: if multiple *non-authored* sources disagree on `label`, mark
  // conflicting. (`label` straddles factual/chosen — authored always wins
  // display, so a human rename is never "conflicting".) Only NON-EMPTY
  // labels count — an empty label makes no claim (same hasValue rule as the
  // field winner), so `''` vs `'real'` is a fall-through, not a conflict.
  const labelObservations = collectField(cluster.members, (n) => stringLabel(n.label)).filter((o) =>
    hasValue(o.value),
  )
  if (!hasAuthored && labelObservations.length > 1) {
    const distinct = new Set(labelObservations.map((o) => o.value))
    if (distinct.size > 1) {
      resolved.provenance = {
        ...(resolved.provenance ?? { source: cluster.members[0]?.sourceId ?? 'unknown' }),
        state: 'conflicting',
      }
    }
  }

  return resolved
}

function deriveNodeProvenance(
  cluster: NodeCluster,
  observerCount: number,
  hasAuthored: boolean,
): Provenance {
  // State derivation:
  //   authored + observed → confirmed
  //   authored only       → authored-only
  //   observed only       → discovered-only (1 source) or confirmed (≥2 agreeing)
  let state: Provenance['state']
  if (hasAuthored && observerCount > 0) state = 'confirmed'
  else if (hasAuthored) state = 'authored-only'
  else if (observerCount >= 2) state = 'confirmed'
  else state = 'discovered-only'

  // Pick a canonical source label: authored wins, otherwise latest observer.
  let source = 'authored'
  if (!hasAuthored) {
    const latest = [...cluster.members].sort((a, b) => b.capturedAt - a.capturedAt)[0]
    source = latest?.sourceId ?? 'unknown'
  }
  const latest = cluster.members.reduce(
    (acc, m) => (m.capturedAt > acc ? m.capturedAt : acc),
    Number.NEGATIVE_INFINITY,
  )
  return {
    source,
    state,
    observedAt: Number.isFinite(latest) ? latest : undefined,
  }
}

/**
 * Merge metadata maps across a cluster: for each key, the highest-priority
 * member that defines it wins. `members` are pre-ranked. A defined value
 * (`!== undefined`) is enough — unlike the scalar field rule, a metadata
 * value of `false` / `0` / `''` is meaningful and kept.
 */
function mergeMetadata(ranked: ClusterMember[]): Record<string, unknown> {
  const merged: Record<string, unknown> = {}
  for (const m of ranked) {
    for (const [k, v] of Object.entries(m.node.metadata ?? {})) {
      if (v !== undefined && merged[k] === undefined) merged[k] = v
    }
  }
  return merged
}

/**
 * Fold attachments across a cluster, keyed by `attachmentKey` (per protocol
 * for `access`). `ranked` is priority desc, so the first writer per key wins —
 * a human SNMP community overrides an observed one, but a human policy-only
 * contribution leaves the observed community untouched (different key). Each
 * resolved attachment is stamped with the provenance of the source that
 * supplied it, an annotation of where the value came from (not a layer).
 *
 * `suppressedKeys` are the keys the human removed (negative assertion); any
 * attachment of those keys is dropped no matter which source supplied it — so
 * deleting an observed access is just the human asserting "none here", and it
 * survives re-scans. Output order is deterministic (access by protocol, then
 * the rest) — independent of who won.
 */
function foldAttachments(ranked: ClusterMember[], suppressedKeys: string[] = []): Attachment[] {
  const suppressed = new Set(suppressedKeys)
  const byKey = new Map<string, Attachment>()
  for (const m of ranked) {
    for (const a of m.node.attachments ?? []) {
      const k = attachmentKey(a)
      if (suppressed.has(k) || byKey.has(k)) continue
      byKey.set(k, {
        ...a,
        provenance: {
          source: m.sourceId,
          observedAt: Number.isFinite(m.capturedAt) ? m.capturedAt : undefined,
        },
      })
    }
  }
  const order = (a: Attachment): string => (a.kind === 'access' ? `0:${a.protocol}` : `1:${a.kind}`)
  return [...byKey.values()].sort((a, b) => order(a).localeCompare(order(b)))
}

function mergeIdentities(identities: Array<Identity | undefined>): Identity | undefined {
  const merged: Identity = {}
  let touched = false
  for (const id of identities) {
    if (!id) continue
    if (id.mgmtIp && !merged.mgmtIp) {
      merged.mgmtIp = id.mgmtIp
      touched = true
    }
    if (id.chassisId && !merged.chassisId) {
      merged.chassisId = id.chassisId
      touched = true
    }
    if (id.sysName && !merged.sysName) {
      merged.sysName = id.sysName
      touched = true
    }
    if (id.ifName && !merged.ifName) {
      merged.ifName = id.ifName
      touched = true
    }
    if (id.mac && !merged.mac) {
      merged.mac = id.mac
      touched = true
    }
    if (id.ifIndex !== undefined && merged.ifIndex === undefined) {
      merged.ifIndex = id.ifIndex
      touched = true
    }
    if (id.vendorIds) {
      merged.vendorIds = { ...(merged.vendorIds ?? {}), ...id.vendorIds }
      touched = true
    }
  }
  return touched ? merged : undefined
}

interface FieldObservation<T> {
  sourceId: string
  value: T
}

function collectField<T>(
  members: ClusterMember[],
  read: (n: Node) => T | undefined,
): FieldObservation<T>[] {
  const out: FieldObservation<T>[] = []
  for (const m of members) {
    const v = read(m.node)
    if (v !== undefined) out.push({ sourceId: m.sourceId, value: v })
  }
  return out
}

function stringLabel(label: string | string[]): string {
  return Array.isArray(label) ? label.join('\n') : label
}

interface PortMember {
  sourceId: string
  priority: number
  capturedAt: number
  port: NodePort
}

function foldPortsAcrossCluster(cluster: NodeCluster): NodePort[] | undefined {
  // Collect ports from all members of the cluster, group by port
  // identity within the cluster, fold each port.
  const all: PortMember[] = []
  for (const m of cluster.members) {
    for (const port of m.node.ports ?? []) {
      all.push({ sourceId: m.sourceId, priority: m.priority, capturedAt: m.capturedAt, port })
    }
  }
  if (all.length === 0) return undefined

  // Group by port identity (within-cluster scope)
  const portClusters: PortMember[][] = []
  const keyToIdx = new Map<string, number>()
  for (const entry of all) {
    const keys = portIdentityKeys(entry.port.identity)
    let hit: number | undefined
    for (const key of keys) {
      const idx = keyToIdx.get(keyHash(key))
      if (idx !== undefined) {
        hit = idx
        break
      }
    }
    if (hit !== undefined) {
      portClusters[hit]?.push(entry)
    } else {
      portClusters.push([entry])
      hit = portClusters.length - 1
    }
    for (const key of keys) keyToIdx.set(keyHash(key), hit)
    if (keys.length === 0) {
      keyToIdx.set(`fallback:${entry.sourceId}:${entry.port.id}`, hit)
    }
  }

  return portClusters.map((members) => foldPortCluster(members))
}

function foldPortCluster(members: PortMember[]): NodePort {
  const ranked = [...members].sort((a, b) => b.priority - a.priority || b.capturedAt - a.capturedAt)
  const top = ranked[0]
  if (!top) throw new Error('empty port cluster')

  const hasAuthored = members.some((m) => m.sourceId === 'authored')
  const observerCount = members.filter((m) => m.sourceId !== 'authored').length
  let state: Provenance['state']
  if (hasAuthored && observerCount > 0) state = 'confirmed'
  else if (hasAuthored) state = 'authored-only'
  else if (observerCount >= 2) state = 'confirmed'
  else state = 'discovered-only'

  // Per-field winner (priority desc, capturedAt desc; must hold a value), so a
  // high-priority port that lacks a field — e.g. `connectors: []` or no
  // faceplateLabel — falls through to a lower-priority source that has it
  // (§6). The top port is the base (keeps id + any field not re-picked).
  const pick = <T>(read: (p: NodePort) => T | undefined): T | undefined => {
    for (const m of ranked) {
      const v = read(m.port)
      if (hasValue(v)) return v
    }
    return undefined
  }
  const folded: NodePort = {
    ...top.port,
    identity: mergeIdentities(members.map((m) => m.port.identity)),
    provenance: { source: top.sourceId, state },
  }
  const label = pick((p) => p.label)
  if (label !== undefined) folded.label = label
  const faceplateLabel = pick((p) => p.faceplateLabel)
  if (faceplateLabel !== undefined) folded.faceplateLabel = faceplateLabel
  const interfaceName = pick((p) => p.interfaceName)
  if (interfaceName !== undefined) folded.interfaceName = interfaceName
  const aliases = pick((p) => p.aliases)
  if (aliases !== undefined) folded.aliases = aliases
  const role = pick((p) => p.role)
  if (role !== undefined) folded.role = role
  const speed = pick((p) => p.speed)
  if (speed !== undefined) folded.speed = speed
  const connectors = pick((p) => p.connectors)
  if (connectors !== undefined) folded.connectors = connectors
  const poe = pick((p) => p.poe)
  if (poe !== undefined) folded.poe = poe
  const notes = pick((p) => p.notes)
  if (notes !== undefined) folded.notes = notes
  const placement = pick((p) => p.placement)
  if (placement !== undefined) folded.placement = placement
  return folded
}

function foldSubgraphs(authored: NetworkGraph): Subgraph[] | undefined {
  if (!authored.subgraphs) return undefined
  return authored.subgraphs.map((s) => ({
    ...s,
    provenance: s.provenance ?? { source: 'authored', state: 'authored-only' },
  }))
}

/**
 * Skeleton link folding. Currently passes through every contribution's
 * links with provenance stamped; cross-source dedup is left as a follow-up
 * in the full implementation.
 *
 * The endpoint `node` id is remapped to the resolved cluster id so links
 * still reference real nodes after clustering.
 */
function foldLinks(contributions: Contribution[], clusterById: Map<string, NodeCluster>): Link[] {
  const links: Link[] = []
  for (const contrib of contributions) {
    for (const link of contrib.graph.links) {
      const from = remapEndpoint(link.from, contrib.sourceId, clusterById)
      const to = remapEndpoint(link.to, contrib.sourceId, clusterById)
      if (!from || !to) continue // dangling — TODO: ghost endpoint
      links.push({
        ...link,
        from,
        to,
        provenance: {
          source: contrib.sourceId,
          state: contrib.sourceId === 'authored' ? 'authored-only' : 'discovered-only',
          observedAt: Number.isFinite(contrib.capturedAt) ? contrib.capturedAt : undefined,
        },
      })
    }
  }
  return links
}

function remapEndpoint(
  endpoint: LinkEndpoint,
  sourceId: string,
  clusterById: Map<string, NodeCluster>,
): LinkEndpoint | null {
  const cluster = clusterById.get(`${sourceId}:${endpoint.node}`)
  if (!cluster) return null
  return { ...endpoint, node: cluster.id }
}
