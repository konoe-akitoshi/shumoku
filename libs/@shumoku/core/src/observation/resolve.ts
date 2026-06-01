// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import type {
  Identity,
  Link,
  LinkEndpoint,
  NetworkGraph,
  Node,
  NodeExclusion,
  NodePort,
  Provenance,
  Subgraph,
} from '../models/types.js'
import { keyHash, nodeIdentityKeys, portIdentityKeys } from './identity.js'
import type { ResolvedGraph, ResolveOptions, SnapshotEntry } from './types.js'

/**
 * Resolve an authored NetworkGraph against any number of source
 * snapshots into a single graph whose every entity carries a
 * `provenance.state` of `confirmed` / `authored-only` / `discovered-only`
 * / `conflicting`.
 *
 * Skeleton implementation — see `apps/server/docs/design/topology-foundation-resolve.md`
 * for the algorithm. This skeleton handles the common cases that v1
 * needs (single-source overlay, identity-based dedup, simple field
 * comparison) and intentionally leaves the harder cases (link
 * matching across cross-cluster endpoints, ghost endpoints, full
 * retraction hysteresis) as small TODOs surfaced in tests.
 */
export function resolve(
  authored: NetworkGraph,
  snapshots: SnapshotEntry[],
  options: ResolveOptions = {},
): ResolvedGraph {
  const _staleThreshold = options.staleThresholdMs ?? 30 * 24 * 60 * 60 * 1000
  const _retractAfter = options.retractAfterMissedScans ?? 3
  // _staleThreshold / _retractAfter are wired through in the full impl;
  // the skeleton leaves them as documented knobs.
  //
  // !!! When retraction logic lands here, gate it on
  //     `absenceImpliesRetraction(effectivePolicyForNode(authored, node))`.
  // A node whose effective policy is `disabled` must survive being
  // missing from a `status='ok'` snapshot — the operator opted out,
  // the source was never asked, the absence carries no information.
  // Codex 's review of the discovery-policy design
  // flagged this as the highest-impact footgun in the area; see
  // `discovery-policy.ts` for the gate predicate and rationale.
  void _staleThreshold
  void _retractAfter

  // 1. Gather valid contributions: authored + every non-failed snapshot
  const contributions: Contribution[] = [
    { sourceId: 'authored', capturedAt: Number.POSITIVE_INFINITY, graph: authored },
  ]
  for (const snap of snapshots) {
    if (snap.status === 'failed' || !snap.graph) continue
    contributions.push({
      sourceId: snap.sourceId,
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
  capturedAt: number
  graph: NetworkGraph
}

interface ClusterMember {
  sourceId: string
  capturedAt: number
  node: Node
}

interface NodeCluster {
  /** Synthesized id — preferring authored id when an authored member exists. */
  id: string
  members: ClusterMember[]
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

  // Authored first so cluster ids prefer authored values
  for (const contrib of contributions) {
    if (contrib.sourceId !== 'authored') continue
    for (const node of contrib.graph.nodes) {
      claim({ sourceId: contrib.sourceId, capturedAt: contrib.capturedAt, node })
    }
  }
  for (const contrib of contributions) {
    if (contrib.sourceId === 'authored') continue
    for (const node of contrib.graph.nodes) {
      claim({ sourceId: contrib.sourceId, capturedAt: contrib.capturedAt, node })
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
    if (used.every((k) => identity[k] !== undefined && identity[k] === ex[k])) return true
  }
  return false
}

function foldNodeCluster(cluster: NodeCluster): Node {
  // Observed members form the base; the authored member is a thin OVERLAY on
  // top — not a replacement. Picking the observed node as the structural base
  // (and overlaying only the authored fields that are actually set) means an
  // authored entry that carries community/name doesn't blank the device's
  // observed facts (ports / readVia / model). The authored node anchors only
  // when nothing observed the device (authored-only).
  const authored = cluster.members.find((m) => m.sourceId === 'authored')
  const observers = cluster.members.filter((m) => m.sourceId !== 'authored')
  const observedBase = observers[0]?.node
  const anchor = observedBase ?? authored?.node
  if (!anchor) {
    // unreachable — cluster always has at least one member
    throw new Error('empty cluster')
  }

  // Identity: union of all members' identity keys (keep first non-empty value)
  const mergedIdentity = mergeIdentities(cluster.members.map((m) => m.node.identity))

  // Metadata merge: observed members form the base (so facts like
  // `readVia` / `syncState` / model survive), then the authored member's
  // keys win on top. Without this, an authored override entry would
  // *replace* the observed node and blank everything the source saw — the
  // root of the "I added a community and the device's details vanished"
  // incoherence.
  const mergedMetadata: Record<string, unknown> = {}
  for (const m of observers) {
    for (const [k, v] of Object.entries(m.node.metadata ?? {})) {
      if (mergedMetadata[k] === undefined && v !== undefined) mergedMetadata[k] = v
    }
  }
  for (const [k, v] of Object.entries(authored?.node.metadata ?? {})) {
    if (v !== undefined) mergedMetadata[k] = v
  }
  // Preserve the observing source. Once an authored override exists the
  // cluster's `provenance.source` becomes `authored`, but the discovery UI
  // still needs the source that actually saw the device — for the "Tracked
  // by" line and to know which source to Probe.
  const observedSource = observers.find((m) => m.sourceId)?.sourceId
  if (observedSource && mergedMetadata['observedSource'] === undefined) {
    mergedMetadata['observedSource'] = observedSource
  }
  // `spec` (icon / model): authored wins, else first observed.
  const spec = authored?.node.spec ?? observers.find((m) => m.node.spec)?.node.spec

  // `attachments` are the authored overlay itself — always from authored.
  const attachments = authored?.node.attachments

  // `label` is an authored override only when the authored entry carries a
  // NON-EMPTY label. A thin overlay (community-only) stores an empty label
  // (`''`) as the "no rename" sentinel — Node.label is a required field, so the
  // overlay can't omit it, but empty means "let the observed name show". When
  // there's no observer (authored-only), `...anchor` is the authored node, so
  // its label is carried regardless of this check.
  const authoredLabel = authored?.node.label
  const authoredLabelOverrides =
    observedBase !== undefined &&
    authoredLabel !== undefined &&
    (Array.isArray(authoredLabel) ? authoredLabel.length > 0 : authoredLabel !== '')
  // `parent` is a straightforward authored override when set.
  const authoredParent = authored?.node.parent

  // Field-level resolution: observed base (`...anchor`) with authored fields
  // overlaid only where the operator actually set them.
  const resolved: Node = {
    ...anchor,
    id: cluster.id,
    identity: mergedIdentity,
    ...(authoredLabelOverrides ? { label: authoredLabel } : {}),
    ...(authoredParent !== undefined ? { parent: authoredParent } : {}),
    ...(Object.keys(mergedMetadata).length > 0 ? { metadata: mergedMetadata } : {}),
    ...(spec ? { spec } : {}),
    ...(attachments !== undefined ? { attachments } : {}),
    ports: foldPortsAcrossCluster(cluster),
    provenance: deriveNodeProvenance(cluster, observers.length, Boolean(authored)),
  }

  // Factual: if multiple sources disagree on `label`, mark conflicting.
  // (`label` straddles factual/chosen — we treat it as conflicting only
  // when *non-authored* sources disagree; authored always wins display.)
  const labelObservations = collectField(cluster.members, (n) => stringLabel(n.label))
  if (!authored && labelObservations.length > 1) {
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

function foldPortsAcrossCluster(cluster: NodeCluster): NodePort[] | undefined {
  // Collect ports from all members of the cluster, group by port
  // identity within the cluster, fold each port.
  const all: Array<{ sourceId: string; port: NodePort }> = []
  for (const m of cluster.members) {
    for (const port of m.node.ports ?? []) {
      all.push({ sourceId: m.sourceId, port })
    }
  }
  if (all.length === 0) return undefined

  // Group by port identity (within-cluster scope)
  const portClusters: Array<Array<{ sourceId: string; port: NodePort }>> = []
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

function foldPortCluster(members: Array<{ sourceId: string; port: NodePort }>): NodePort {
  const authored = members.find((m) => m.sourceId === 'authored')
  const anchor = authored?.port ?? members[0]?.port
  if (!anchor) throw new Error('empty port cluster')

  const observerCount = members.filter((m) => m.sourceId !== 'authored').length
  const hasAuthored = Boolean(authored)
  let state: Provenance['state']
  if (hasAuthored && observerCount > 0) state = 'confirmed'
  else if (hasAuthored) state = 'authored-only'
  else if (observerCount >= 2) state = 'confirmed'
  else state = 'discovered-only'

  const mergedIdentity = mergeIdentities(members.map((m) => m.port.identity))
  return {
    ...anchor,
    identity: mergedIdentity,
    provenance: {
      source: authored?.sourceId ?? members[0]?.sourceId ?? 'unknown',
      state,
    },
  }
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
