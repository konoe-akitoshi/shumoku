// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import {
  type Attachment,
  attachmentKey,
  type Identity,
  type Link,
  type LinkEndpoint,
  type MembershipCriterion,
  type NetworkGraph,
  type Node,
  type NodeExclusion,
  type NodePort,
  type Provenance,
  type RegionIdentity,
  type ScopeFilter,
  type Subgraph,
} from '../models/types.js'
import { keyHash, nodeIdentityKeys, portIdentityKeys } from './identity.js'
import { interfaceNamesMatch } from './interface-name.js'
import type { ResolvedGraph, ResolveOptions, SnapshotEntry } from './types.js'

/**
 * Resolve the project's own (intrinsic) NetworkGraph against any number of
 * source snapshots into a single graph whose every entity carries
 * `provenance`.
 *
 * Model: **all sources are equal, priority-ordered contributions.** The
 * intrinsic (project-owned) graph is just the top-priority contribution;
 * observed snapshots carry their own priority (mirroring
 * `topology_data_sources.priority`). resolve clusters contributions by
 * identity (any-key match — orthogonal to priority) and then, **per
 * field**, the highest-priority contribution that actually holds a value
 * wins (`priority desc, capturedAt desc`). A field nobody holds is
 * omitted. This is the "Git-like" merge: an edit that only renamed a node
 * keeps the observed ports/community flowing through untouched.
 *
 * There is intentionally NO `=== 'intrinsic'` special-casing in the field
 * merge — "the project's edits win" falls out of "intrinsic has the highest
 * priority". The reserved id `'intrinsic'` survives only as that
 * contribution's source *label*, so the UI can tell a project-set value from
 * an observed one (per-field `fieldSources`, per-attachment `provenance`). It
 * is ownership (intrinsic vs external), NOT a human-vs-machine layer.
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
  // v1 feeds only each source's latest non-failed graph — its current-state
  // contribution (see services/topology.ts → readObservedSnapshots, fed from the
  // DB-native contribution store). So "retraction" today is simply "absent from
  // the latest successful snapshot". A failed scan is never ingested, so it never
  // replaces a source's last-good contribution.
  // There is no multi-scan hysteresis yet; _staleThreshold / _retractAfter
  // stay documented knobs for when snapshot history is fed in.
  //
  // Invariants that MUST hold regardless of priority (covered by tests):
  //   - The intrinsic (project-owned) contribution is never retracted. A node
  //     the operator touched (rename, access, or a policy=disabled overlay) is
  //     an intrinsic contribution, so it persists until Reset.
  //   - A 'failed' snapshot is ignored — never read as a retraction.
  //   - When real hysteresis lands it must gate on
  //     `absenceImpliesRetraction(effectivePolicyForNode(authored, node))`
  //     so a policy=disabled node survives being missing from a
  //     status='ok' snapshot (the operator opted out; absence carries no
  //     information). Codex flagged this as the highest-impact footgun.
  void _staleThreshold
  void _retractAfter

  // 1. Gather valid contributions. The intrinsic graph is the top-priority
  //    contribution ("the project's edits win" = "intrinsic outranks every
  //    source"); every non-failed snapshot is a contribution at its own
  //    priority. Identity clustering ignores priority; only the field merge
  //    consults it.
  const contributions: Contribution[] = [
    {
      sourceId: 'intrinsic',
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
      // Namespace this source's subgraph ids (and the node.parent refs into
      // them) so groups from different sources can't collide. The intrinsic
      // contribution keeps the raw id space (it's the top-priority, project-owned one).
      graph: namespaceSourceSubgraphs(snap.graph, snap.sourceId),
      entities: snap.entities,
    })
  }

  // 2. Build node clusters by identity keys
  const allClusters = clusterNodes(contributions)

  // 2a. Presence. A cluster exists only if some contribution SCOOPS it
  //     (`presence !== 'anchor'`, i.e. makes a positive existence claim).
  //     Anchor-only clusters make no presence claim — they carry identity /
  //     attachments to ride onto a node someone else scoops — so they are
  //     dropped. This is what lets an overlay node that merely holds a
  //     metrics-binding evaporate once every source stops observing the
  //     device, instead of lingering as a ghost. Anchor members still
  //     contribute their identity / fields / attachments to clusters that DO
  //     have a scoop member (the fold below reads every member).
  const presentClusters = allClusters.filter((c) =>
    c.members.some((m) => m.node.presence !== 'anchor'),
  )

  // 2b. Drop hidden clusters. A cluster is hidden when its merged identity
  //     matches any exclusion (by mgmtIp / chassisId / sysName). Identity-keyed
  //     so a hide survives re-scans that re-number ephemeral node ids. Dropping
  //     here (before link folding) also removes links to hidden nodes.
  const exclusions = authored.exclusions ?? []
  const afterExclusions =
    exclusions.length > 0
      ? presentClusters.filter((c) => !isClusterExcluded(c, exclusions))
      : presentClusters

  // 2c. Regions. Cluster subgraphs across contributions by region identity
  //     (any-key match) — same machinery as nodes. A subgraph with no identity
  //     stays its own region (keeping its namespaced id).
  const regions = clusterRegions(contributions)
  const regionIdRemap = new Map<string, string>()
  for (const cl of regions) {
    for (const m of cl.members) regionIdRemap.set(m.subgraph.id, cl.canonicalId)
  }

  // 2d. Scope (region-centric, MECHANISM only). A region is the closed world iff
  //     one of its contributing subgraphs is marked `scope:'closed'`. resolve does
  //     NOT decide WHICH source scopes — that policy (auto = top source / open /
  //     closed-to a chosen source) lives in the caller, which stamps `scope:'closed'`
  //     on the right contributions (incl. the overlay) before calling resolve.
  //     "In scope" means being a member of a closed region — NOT merely being
  //     emitted by the scope source — so even the scope source's own out-of-region
  //     nodes (e.g. Zabbix LLDP external neighbors, outside the fetched host group)
  //     are dropped. Operator curation (a real intrinsic node) is always kept. No
  //     closed region → no filtering (open-world union). See clusterInClosedScope.
  const scope = buildScopeIndex(regions, regionIdRemap)
  const regionScoped =
    scope.closedRegionIds.size > 0
      ? afterExclusions.filter((c) => clusterInClosedScope(c, regions, regionIdRemap, scope))
      : afterExclusions

  // 2e. Topology-level scope predicate (orthogonal to region scope). When the
  //     caller supplies include/exclude criteria, drop clusters that don't match
  //     — operator-curated intrinsic nodes are always kept. This is the common,
  //     plugin-independent scope every source's "what to pull" filter folds into.
  const scopeFilter = options.scope
  const hasScopeFilter =
    !!scopeFilter && (scopeFilter.include?.length ?? 0) + (scopeFilter.exclude?.length ?? 0) > 0
  const nodeClusters =
    hasScopeFilter && scopeFilter
      ? regionScoped.filter((c) => clusterMatchesScopeFilter(c, scopeFilter))
      : regionScoped

  // 3. For each cluster, fold into a single resolved Node
  const resolvedNodes: Node[] = []
  const clusterById = new Map<string, NodeCluster>()
  // `${sourceId}:${origNodeId}:${origPortId}` → folded port id, so a link
  // endpoint's port reference survives port folding (see remapEndpoint).
  const portIdRemap = new Map<string, string>()
  for (const cluster of nodeClusters) {
    const { node, portRemap } = foldNodeCluster(cluster)
    resolvedNodes.push(node)
    for (const [k, v] of portRemap) portIdRemap.set(k, v)
    // Bind each member's original `id` → cluster id so links can be remapped
    for (const member of cluster.members) {
      clusterById.set(`${member.sourceId}:${member.node.id}`, cluster)
    }
  }

  // 3b. Region membership for resolved nodes:
  //       - remap every resolved node's `parent` to the merged region's id;
  //       - for a node with NO parent, assign the first region whose membership
  //         criteria match (so a lower source fills a region an upper scooped).
  for (const node of resolvedNodes) {
    if (node.parent !== undefined) {
      const mapped = regionIdRemap.get(node.parent)
      if (mapped) node.parent = mapped
    } else {
      for (const cl of regions) {
        if (nodeMatchesRegion(node, cl)) {
          node.parent = cl.canonicalId
          break
        }
      }
    }
  }

  // 4. Fold links — endpoint node id → cluster id, port id → folded port id.
  //    `portNameById` lets cross-source dedup compare interface NAMES (one source
  //    may key a port "HundredGigE0/0/0/8" where another says "hg-0/0/0/8").
  const portNameById = new Map<string, string>()
  for (const node of resolvedNodes) {
    for (const p of node.ports ?? []) {
      portNameById.set(p.id, p.interfaceName || p.label || p.id)
    }
  }
  const resolvedLinks = foldLinks(contributions, clusterById, portIdRemap, portNameById)

  // 5. Subgraphs — fold each region cluster into one merged subgraph.
  // Keep a region only if it has a resolved MEMBER node (directly or via a
  // descendant), plus its ancestor chain so it nests. Empty regions — e.g. a
  // confined source's groups whose nodes were dropped/re-parented — are pruned
  // so they don't render as floating boxes.
  const keptRegions = computeKeptRegions(resolvedNodes, regions, regionIdRemap)
  const resolvedSubgraphs = foldRegions(regions, regionIdRemap, keptRegions)

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
  /**
   * Registry entity ids for this contribution's nodes and ports. Absent for
   * the intrinsic contribution and for snapshots without registry data.
   */
  entities?: {
    nodes: Record<string, string>
    ports: Record<string, string>
  }
}

interface ClusterMember {
  sourceId: string
  priority: number
  capturedAt: number
  node: Node
  /** Registry entity id for this node, if known. */
  entityId?: string
  /**
   * Registry entity ids for this node's ports, keyed by
   * `${nodeLocalId}:${portLocalId}`. Used by foldPortsAcrossCluster to
   * group ports by entity. Absent when the contribution has no registry data.
   */
  portEntities?: Record<string, string>
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

/**
 * Registry-driven node clustering.
 *
 * Two-tier cluster key space:
 *
 *   `entity:<entityId>` — first-class registry key (strongest). A member that
 *     carries an entityId is ALWAYS placed in its entity cluster regardless of
 *     identity-key overlap with other clusters. Identity keys of entity-bearing
 *     members are also bound to the same cluster so that entity-less members
 *     (overlay / ghost / old data) can JOIN via key matching — but a key clash
 *     that would merge two DISTINCT entity clusters is silently ignored (first
 *     writer wins). This upholds the invariant: registry verdicts are never
 *     overridden by identity-key coincidence.
 *
 *   identity-key hash — classic (fallback). Used when a member has no entityId.
 *     May NOT cross entity-cluster boundaries.
 *
 * When no contribution carries `entities`, the function degenerates to the
 * original pure-identity-key algorithm — existing behaviour is fully preserved
 * and all existing tests pass unchanged.
 */
function clusterNodes(contributions: Contribution[]): NodeCluster[] {
  const clusters: NodeCluster[] = []
  // Map identity-key-hash → cluster index
  const keyIndex = new Map<string, number>()
  // Map `entity:<entityId>` → cluster index (registry-first)
  const entityIndex = new Map<string, number>()
  // Every cluster id handed out so far. Authored nodes keep their own id,
  // which can itself look like a synthesized `discovered:N` (e.g. a node
  // adopted into Manual from a previously-synthesized id). Tracking used
  // ids lets the synthetic generator skip those, so two clusters never
  // share an id — a duplicate id crashes the keyed grid in the UI.
  const usedClusterIds = new Set<string>()
  let nextSynthId = 0

  const claim = (member: ClusterMember): void => {
    const keys = nodeIdentityKeys(member.node.identity)
    const entityKey = member.entityId ? `entity:${member.entityId}` : undefined

    let hit: number | undefined

    // 1. Registry lookup (entity id → cluster). Registry verdict is final:
    //    never merge two distinct entity clusters even if their identity keys
    //    overlap. An overlay member (no entityId) whose id matches a known
    //    entity cluster key is handled in step 2 below.
    if (entityKey !== undefined) {
      const idx = entityIndex.get(entityKey)
      if (idx !== undefined) {
        hit = idx
      }
    }

    // 2. Identity-key fallback — only used when no entity hit found yet.
    //    An entity-bearing member that did NOT find its entity cluster yet
    //    (first occurrence) will create a new cluster and bind keys there.
    //    An entity-less member uses this path exclusively.
    if (hit === undefined) {
      for (const key of keys) {
        const idx = keyIndex.get(keyHash(key))
        if (idx !== undefined) {
          // Guard: if the found cluster already has a different entity id
          // than this member, do NOT merge — put the member in its own cluster.
          if (entityKey !== undefined) {
            const candidateEntityKey = clusters[idx]?.members.find((m) => m.entityId)?.entityId
            if (candidateEntityKey !== undefined && `entity:${candidateEntityKey}` !== entityKey) {
              // Different entity — skip this identity match (first-writer principle)
              continue
            }
          }
          hit = idx
          break
        }
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
      if (member.sourceId === 'intrinsic') {
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

    // Bind the entity key to this cluster so future members with the same
    // entity id join immediately (without key-lookup).
    if (entityKey !== undefined && !entityIndex.has(entityKey)) {
      entityIndex.set(entityKey, hit)
    }

    // Bind every identity key of this member to the cluster — including
    // keys not used to find it. Future weaker observations can collapse.
    // If a key is already bound to a DIFFERENT entity cluster, skip it
    // (no cross-entity merges via identity keys).
    for (const key of keys) {
      const h = keyHash(key)
      if (!keyIndex.has(h)) {
        keyIndex.set(h, hit)
      } else if (entityKey !== undefined) {
        // Key already claimed — check if it's by a different entity cluster.
        // If so, leave it alone (first-writer wins; no merge across entities).
        const existingIdx = keyIndex.get(h)
        if (existingIdx !== undefined && existingIdx !== hit) {
          // Leave the existing binding; don't clobber.
        }
      }
    }
    // Also bind a deterministic per-source id fallback so identity-less
    // nodes still match themselves across re-runs of the same source.
    if (keys.length === 0) {
      const fallback = keyHash({ kind: 'vendorId', value: `${member.sourceId}:${member.node.id}` })
      if (!keyIndex.has(fallback)) keyIndex.set(fallback, hit)
    }
  }

  // Authored first so cluster ids prefer authored values. This ordering is
  // about id preference only — it does NOT decide field winners (priority
  // does, in foldNodeCluster) and does NOT decide identity (any-key match).
  for (const contrib of contributions) {
    if (contrib.sourceId !== 'intrinsic') continue
    for (const node of contrib.graph.nodes) {
      // Intrinsic members never carry registry entity ids — the overlay node's
      // id IS the entity id in Phase 3, but the identity-clustering path
      // handles that via the node.id matching as a known entity cluster key.
      claim({
        sourceId: contrib.sourceId,
        priority: contrib.priority,
        capturedAt: contrib.capturedAt,
        node,
      })
    }
  }
  for (const contrib of contributions) {
    if (contrib.sourceId === 'intrinsic') continue
    for (const node of contrib.graph.nodes) {
      const entityId = contrib.entities?.nodes[node.id]
      claim({
        sourceId: contrib.sourceId,
        priority: contrib.priority,
        capturedAt: contrib.capturedAt,
        node,
        entityId,
        portEntities: contrib.entities?.ports,
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
function foldNodeCluster(cluster: NodeCluster): { node: Node; portRemap: Array<[string, string]> } {
  const ranked = rankMembers(cluster.members)
  const top = ranked[0]
  if (!top) {
    // unreachable — cluster always has at least one member
    throw new Error('empty cluster')
  }

  const hasIntrinsic = cluster.members.some((m) => m.sourceId === 'intrinsic')
  const observerCount = cluster.members.filter((m) => m.sourceId !== 'intrinsic').length

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
  const primaryObserver = ranked.find((m) => m.sourceId !== 'intrinsic')
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
        .filter((m) => m.sourceId === 'intrinsic')
        .flatMap((m) => m.node.suppressedAttachments ?? []),
    ),
  )

  // Attachments: per kind (+protocol for access), highest-priority wins, each
  // stamped with the provenance of the source that supplied it; any key the
  // human suppressed is dropped.
  const attachments = foldAttachments(ranked, suppressed)

  const { ports, remap: portRemap } = foldPortsAcrossCluster(cluster)

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
    provenance: deriveNodeProvenance(cluster, observerCount, hasIntrinsic),
  }

  // Factual: if multiple *non-authored* sources disagree on `label`, mark
  // conflicting. (`label` straddles factual/chosen — authored always wins
  // display, so a human rename is never "conflicting".) Only NON-EMPTY
  // labels count — an empty label makes no claim (same hasValue rule as the
  // field winner), so `''` vs `'real'` is a fall-through, not a conflict.
  const labelObservations = collectField(cluster.members, (n) => stringLabel(n.label)).filter((o) =>
    hasValue(o.value),
  )
  if (!hasIntrinsic && labelObservations.length > 1) {
    const distinct = new Set(labelObservations.map((o) => o.value))
    if (distinct.size > 1) {
      resolved.provenance = {
        ...(resolved.provenance ?? { source: cluster.members[0]?.sourceId ?? 'unknown' }),
        state: 'conflicting',
      }
    }
  }

  return { node: resolved, portRemap }
}

function deriveNodeProvenance(
  cluster: NodeCluster,
  observerCount: number,
  hasIntrinsic: boolean,
): Provenance {
  // State derivation:
  //   intrinsic + observed → confirmed
  //   intrinsic only       → intrinsic-only
  //   observed only        → discovered-only (1 source) or confirmed (≥2 agreeing)
  let state: Provenance['state']
  if (hasIntrinsic && observerCount > 0) state = 'confirmed'
  else if (hasIntrinsic) state = 'intrinsic-only'
  else if (observerCount >= 2) state = 'confirmed'
  else state = 'discovered-only'

  // Pick a canonical source label: intrinsic wins, otherwise latest observer.
  let source = 'intrinsic'
  if (!hasIntrinsic) {
    const latest = [...cluster.members].sort((a, b) => b.capturedAt - a.capturedAt)[0]
    source = latest?.sourceId ?? 'unknown'
  }
  // `observedAt` = the latest real OBSERVATION time. Consider only finite
  // capturedAt — the human contribution carries `+Infinity` (it's not an
  // observation), and including it would poison the max and drop observedAt
  // (→ "Last seen" blanks out the moment a node is renamed / given a
  // community). An intrinsic-only node has no finite time → undefined.
  const latestObserved = cluster.members.reduce(
    (acc, m) => (Number.isFinite(m.capturedAt) && m.capturedAt > acc ? m.capturedAt : acc),
    Number.NEGATIVE_INFINITY,
  )
  return {
    source,
    state,
    observedAt: Number.isFinite(latestObserved) ? latestObserved : undefined,
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
/**
 * Member-agnostic attachment fold core. `entries` must be priority desc; each
 * carries its source, capture time, and the attachment list to fold. Used for
 * both node clusters (`foldAttachments`) and port clusters
 * (`foldPortAttachments`) so merge + suppression + provenance + ordering stay
 * identical across element kinds.
 */
function foldAttachmentEntries(
  entries: Array<{ sourceId: string; capturedAt: number; attachments?: Attachment[] }>,
  suppressedKeys: string[] = [],
): Attachment[] {
  const suppressed = new Set(suppressedKeys)
  const byKey = new Map<string, Attachment>()
  for (const e of entries) {
    for (const a of e.attachments ?? []) {
      const k = attachmentKey(a)
      if (suppressed.has(k) || byKey.has(k)) continue
      byKey.set(k, {
        ...a,
        provenance: {
          source: e.sourceId,
          observedAt: Number.isFinite(e.capturedAt) ? e.capturedAt : undefined,
        },
      })
    }
  }
  const order = (a: Attachment): string =>
    a.kind === 'access'
      ? `0:${a.protocol}`
      : a.kind === 'metrics-binding'
        ? `2:${a.sourceId}`
        : `1:${a.kind}`
  return [...byKey.values()].sort((a, b) => order(a).localeCompare(order(b)))
}

function foldAttachments(ranked: ClusterMember[], suppressedKeys: string[] = []): Attachment[] {
  return foldAttachmentEntries(
    ranked.map((m) => ({
      sourceId: m.sourceId,
      capturedAt: m.capturedAt,
      attachments: m.node.attachments,
    })),
    suppressedKeys,
  )
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
  nodeId: string
  priority: number
  capturedAt: number
  port: NodePort
  /** Registry entity id for this port, if known. */
  entityId?: string
}

/** Port-id remap key: a source's original (node, port) → the folded port id. */
function portRemapKey(sourceId: string, nodeId: string, portId: string): string {
  return `${sourceId}:${nodeId}:${portId}`
}

interface FoldedPorts {
  ports: NodePort[] | undefined
  /** `${sourceId}:${origNodeId}:${origPortId}` → folded port id. */
  remap: Array<[string, string]>
}

function foldPortsAcrossCluster(cluster: NodeCluster): FoldedPorts {
  // Collect ports from all members of the cluster, group by port
  // identity within the cluster, fold each port.
  // Each ClusterMember carries the contribution's entities map (via the
  // Contribution object — we need to thread entityId through to PortMember).
  // Because ClusterMember doesn't hold a back-reference to Contribution, we
  // look up port entity ids from the node's member.entityId context — port
  // entity ids were stored as `${nodeLocalId}:${portLocalId}` composites in
  // the SnapshotEntry.entities.ports map. We pass them via PortMember.entityId.
  const all: PortMember[] = []
  for (const m of cluster.members) {
    for (const port of m.node.ports ?? []) {
      // Port entity id: prefer the registry entities map (threaded from
      // SnapshotEntry via ClusterMember.portEntities), fall back to the
      // Phase 3-stamped port.entityId field.
      const compositeKey = `${m.node.id}:${port.id}`
      const portEntityId = m.portEntities?.[compositeKey] ?? port.entityId
      all.push({
        sourceId: m.sourceId,
        nodeId: m.node.id,
        priority: m.priority,
        capturedAt: m.capturedAt,
        port,
        entityId: portEntityId,
      })
    }
  }
  if (all.length === 0) return { ports: undefined, remap: [] }

  // Group by port identity (within-cluster scope).
  // Entity-driven: if two port entries share the same entityId, they go into
  // the same port cluster regardless of identity-key overlap.
  // Falls back to identity-key matching when no entityId is present.
  const portClusters: PortMember[][] = []
  const keyToIdx = new Map<string, number>()
  const portEntityIdx = new Map<string, number>() // `entity:${id}` → cluster idx
  for (const entry of all) {
    const keys = portIdentityKeys(entry.port.identity)
    const portEntityKey = entry.entityId ? `entity:${entry.entityId}` : undefined
    let hit: number | undefined

    // 1. Entity key lookup (strongest)
    if (portEntityKey !== undefined) {
      const idx = portEntityIdx.get(portEntityKey)
      if (idx !== undefined) {
        hit = idx
      }
    }

    // 2. Identity-key fallback
    if (hit === undefined) {
      for (const key of keys) {
        const idx = keyToIdx.get(keyHash(key))
        if (idx !== undefined) {
          // Guard: don't merge across distinct port entities
          if (portEntityKey !== undefined) {
            const existingEntityId = portClusters[idx]?.find((pm) => pm.entityId)?.entityId
            if (existingEntityId !== undefined && `entity:${existingEntityId}` !== portEntityKey) {
              continue
            }
          }
          hit = idx
          break
        }
      }
    }

    if (hit !== undefined) {
      portClusters[hit]?.push(entry)
    } else {
      portClusters.push([entry])
      hit = portClusters.length - 1
    }

    if (portEntityKey !== undefined && !portEntityIdx.has(portEntityKey)) {
      portEntityIdx.set(portEntityKey, hit)
    }
    for (const key of keys) {
      if (!keyToIdx.has(keyHash(key))) keyToIdx.set(keyHash(key), hit)
    }
    if (keys.length === 0) {
      const fb = `fallback:${entry.sourceId}:${entry.port.id}`
      if (!keyToIdx.has(fb)) keyToIdx.set(fb, hit)
    }
  }

  // Fold each port cluster and record every member port id → the folded id, so
  // a link endpoint that referenced an original port id still resolves to the
  // surviving folded port (keeps link↔port consistent across the merge).
  const ports: NodePort[] = []
  const remap: Array<[string, string]> = []
  for (const members of portClusters) {
    const folded = foldPortCluster(members)
    ports.push(folded)
    for (const m of members) {
      remap.push([portRemapKey(m.sourceId, m.nodeId, m.port.id), folded.id])
    }
  }
  return { ports, remap }
}

function foldPortCluster(members: PortMember[]): NodePort {
  const ranked = [...members].sort((a, b) => b.priority - a.priority || b.capturedAt - a.capturedAt)
  const top = ranked[0]
  if (!top) throw new Error('empty port cluster')

  const hasIntrinsic = members.some((m) => m.sourceId === 'intrinsic')
  const observerCount = members.filter((m) => m.sourceId !== 'intrinsic').length
  let state: Provenance['state']
  if (hasIntrinsic && observerCount > 0) state = 'confirmed'
  else if (hasIntrinsic) state = 'intrinsic-only'
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

  // Attachments (e.g. link metrics-binding): per key, highest-priority wins,
  // human suppression drops the slot, provenance stamped — same machinery as
  // node attachments so a port binding follows re-sync by identity. Only the
  // human (authored) contribution may suppress.
  const suppressed = Array.from(
    new Set(
      members
        .filter((m) => m.sourceId === 'intrinsic')
        .flatMap((m) => m.port.suppressedAttachments ?? []),
    ),
  )
  const attachments = foldAttachmentEntries(
    ranked.map((m) => ({
      sourceId: m.sourceId,
      capturedAt: m.capturedAt,
      attachments: m.port.attachments,
    })),
    suppressed,
  )
  // Override the spread-from-top.port values so a suppressed/lost binding
  // doesn't survive via the base copy.
  folded.attachments = attachments.length > 0 ? attachments : undefined
  folded.suppressedAttachments = suppressed.length > 0 ? suppressed : undefined
  return folded
}

/**
 * Namespace a source contribution's subgraph references so groups from
 * different sources can't collide. A subgraph `id`, a node's `parent`, and a
 * subgraph's `parent`/`children` are all subgraph ids — prefix every one with
 * the source id. Mirrors the node-id namespacing already used for link
 * endpoints (`${sourceId}:${node}` in remapEndpoint / clusterById).
 *
 * Returns the graph unchanged when there is nothing to namespace, and never
 * mutates the input.
 */
function namespaceSourceSubgraphs(graph: NetworkGraph, sourceId: string): NetworkGraph {
  const tag = (id: string) => `${sourceId}:${id}`
  const hasSubgraphs = (graph.subgraphs?.length ?? 0) > 0
  const hasNodeParent = graph.nodes.some((n) => n.parent)
  if (!hasSubgraphs && !hasNodeParent) return graph

  const nodes = hasNodeParent
    ? graph.nodes.map((n) => (n.parent ? { ...n, parent: tag(n.parent) } : n))
    : graph.nodes

  const subgraphs = graph.subgraphs?.map((s) => {
    const next: Subgraph = { ...s, id: tag(s.id) }
    if (s.parent) next.parent = tag(s.parent)
    if (s.children) next.children = s.children.map(tag)
    return next
  })

  return { ...graph, nodes, subgraphs }
}

interface RegionMember {
  sourceId: string
  priority: number
  capturedAt: number
  subgraph: Subgraph
}
interface RegionCluster {
  /** Merged region id — prefers the intrinsic member's id, else first member's. */
  canonicalId: string
  members: RegionMember[]
}

/** Region identity match keys (name + namespaced keys). `[]` = no identity. */
function regionKeys(identity: RegionIdentity | undefined): string[] {
  if (!identity) return []
  const out: string[] = []
  if (identity.name) out.push(`name=${identity.name}`)
  for (const [ns, v] of Object.entries(identity.keys ?? {})) out.push(`${ns}=${v}`)
  return out
}

/**
 * Cluster subgraphs across contributions by region identity (any-key match) —
 * the subgraph analogue of clusterNodes. A subgraph with no identity never
 * merges (each stays its own region, keeping its namespaced id). Intrinsic is
 * claimed first so a merged region prefers the intrinsic (raw) id.
 */
function clusterRegions(contributions: Contribution[]): RegionCluster[] {
  const clusters: RegionCluster[] = []
  const keyIndex = new Map<string, number>()
  const claim = (m: RegionMember): void => {
    const keys = regionKeys(m.subgraph.identity)
    let hit: number | undefined
    for (const k of keys) {
      const idx = keyIndex.get(k)
      if (idx !== undefined) {
        hit = idx
        break
      }
    }
    if (hit === undefined) {
      clusters.push({ canonicalId: m.subgraph.id, members: [m] })
      hit = clusters.length - 1
    } else {
      clusters[hit]?.members.push(m)
    }
    for (const k of keys) if (!keyIndex.has(k)) keyIndex.set(k, hit)
  }
  for (const c of contributions) {
    if (c.sourceId !== 'intrinsic') continue
    for (const s of c.graph.subgraphs ?? [])
      claim({ sourceId: c.sourceId, priority: c.priority, capturedAt: c.capturedAt, subgraph: s })
  }
  for (const c of contributions) {
    if (c.sourceId === 'intrinsic') continue
    for (const s of c.graph.subgraphs ?? [])
      claim({ sourceId: c.sourceId, priority: c.priority, capturedAt: c.capturedAt, subgraph: s })
  }
  return clusters
}

/**
 * Whether a node cluster satisfies the topology-level scope filter: it matches an
 * `include` criterion (or `include` is empty) AND no `exclude` criterion. A
 * criterion is satisfied when ANY member node of the cluster matches it (so a
 * cluster confirmed across sources stays in scope if any contributor matches).
 * Operator-curated intrinsic nodes are always kept, mirroring region scope.
 */
function clusterMatchesScopeFilter(cluster: NodeCluster, scope: ScopeFilter): boolean {
  for (const m of cluster.members) {
    if (m.sourceId === 'intrinsic' && intrinsicAssertsTopology(m.node)) return true
  }
  const include = scope.include ?? []
  const exclude = scope.exclude ?? []
  const anyMemberMatches = (crit: MembershipCriterion): boolean =>
    cluster.members.some((m) => criterionMatches(m.node, crit))
  if (exclude.some(anyMemberMatches)) return false
  if (include.length === 0) return true
  return include.some(anyMemberMatches)
}

/** Whether a node satisfies any membership criterion of any member of a region. */
function nodeMatchesRegion(node: Node, cluster: RegionCluster): boolean {
  for (const m of cluster.members) {
    for (const crit of m.subgraph.membership ?? []) {
      if (criterionMatches(node, crit)) return true
    }
  }
  return false
}

function criterionMatches(node: Node, crit: MembershipCriterion): boolean {
  if (crit.attr === 'name') {
    const re = safeRegex(crit.value)
    if (!re) return false
    const hay = [stringLabel(node.label), node.identity?.sysName].filter(
      (s): s is string => typeof s === 'string' && s.length > 0,
    )
    return hay.some((h) => re.test(h))
  }
  if (crit.attr === 'subnet') {
    return node.identity?.mgmtIp ? ipv4InCidr(node.identity.mgmtIp, crit.value) : false
  }
  if (crit.attr === 'metadata') {
    if (!crit.key) return false
    const v = node.metadata?.[crit.key]
    if (v === undefined) return false
    // Array metadata (e.g. a node's `hostGroups`) matches if any element equals
    // the value — so a host-group / tag / role criterion hits a multi-valued field.
    if (Array.isArray(v)) return v.some((x) => String(x) === crit.value)
    return String(v) === crit.value
  }
  return false
}

function safeRegex(pattern: string): RegExp | null {
  try {
    return new RegExp(pattern)
  } catch {
    return null
  }
}

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.')
  if (parts.length !== 4) return null
  let v = 0
  for (const p of parts) {
    const n = Number(p)
    if (!Number.isInteger(n) || n < 0 || n > 255) return null
    v = v * 256 + n
  }
  return v >>> 0
}

function ipv4InCidr(ip: string, cidr: string): boolean {
  const [net, bitsStr] = cidr.split('/')
  const bits = Number(bitsStr)
  if (!net || !Number.isFinite(bits) || bits < 0 || bits > 32) return false
  const a = ipv4ToInt(ip)
  const b = ipv4ToInt(net)
  if (a === null || b === null) return false
  if (bits === 0) return true
  const mask = (bits === 32 ? 0xffffffff : ~(0xffffffff >>> bits)) >>> 0
  return (a & mask) === (b & mask)
}

interface ScopeIndex {
  /** Canonical ids of regions owned by a scope-defining source (the closed world). */
  closedRegionIds: Set<string>
  /** True if `regionId` is closed or descends from a closed region. */
  inClosedScope: (regionId: string) => boolean
}

/** Index closed regions + the region parent chain for scope ancestry walks. */
function buildScopeIndex(
  clusters: RegionCluster[],
  regionIdRemap: Map<string, string>,
): ScopeIndex {
  const closedRegionIds = new Set<string>()
  const regionParent = new Map<string, string>()
  for (const cl of clusters) {
    // A region is part of the closed scope iff one of its contributing subgraphs
    // is marked `scope:'closed'`. The caller decides which source(s) scope and
    // stamps that mark — resolve is pure mechanism here (no priority/source policy).
    if (cl.members.some((m) => m.subgraph.scope === 'closed')) closedRegionIds.add(cl.canonicalId)
    const ranked = [...cl.members].sort(
      (a, b) => b.priority - a.priority || b.capturedAt - a.capturedAt,
    )
    for (const m of ranked) {
      if (m.subgraph.parent) {
        regionParent.set(cl.canonicalId, regionIdRemap.get(m.subgraph.parent) ?? m.subgraph.parent)
        break
      }
    }
  }
  const inClosedScope = (regionId: string): boolean => {
    let cur: string | undefined = regionId
    const seen = new Set<string>()
    while (cur && !seen.has(cur)) {
      seen.add(cur)
      if (closedRegionIds.has(cur)) return true
      cur = regionParent.get(cur)
    }
    return false
  }
  return { closedRegionIds, inClosedScope }
}

/**
 * Whether an intrinsic (overlay) node makes a real TOPOLOGY claim — operator
 * curation of a node's existence — rather than merely a metrics-binding anchor.
 * A binding-only overlay node carries identity + metrics-binding(s) with an empty
 * label and no other authored content; it asserts nothing about presence/scope.
 * `presence:'anchor'` says so explicitly; we also detect the binding-only shape
 * for older data stored as scoop.
 */
function intrinsicAssertsTopology(node: Node): boolean {
  if (node.presence === 'anchor') return false
  const label = Array.isArray(node.label) ? node.label.join('') : (node.label ?? '')
  if (label.trim() !== '') return true
  if (node.spec || node.shape || node.style || node.parent || node.rank || node.productId)
    return true
  if ((node.ports?.length ?? 0) > 0) return true
  if ((node.attachments ?? []).some((a) => a.kind !== 'metrics-binding')) return true
  return false
}

/**
 * Whether a node cluster is IN the closed scope. The scope is the scope-defining
 * source's REGIONS (e.g. a host group) — being a member of such a region is what
 * "in scope" means, NOT merely being emitted by the scope source. So a scope
 * source's own peripheral nodes that aren't in any of its regions (e.g. Zabbix
 * LLDP external neighbors, which sit outside the fetched host group) are OUT of
 * scope. A cluster is in scope if:
 *   - it carries an intrinsic member that makes a real topology claim (operator
 *     curation — never dropped; a bare metrics-binding doesn't count), OR
 *   - its winning parent region is closed / descends from one, OR
 *   - any member matches a closed region's membership criteria (a lower source
 *     filling a gap WITHIN the scope by predicate).
 * Otherwise it's outside the scope's regions → dropped.
 */
function clusterInClosedScope(
  cluster: NodeCluster,
  clusters: RegionCluster[],
  regionIdRemap: Map<string, string>,
  scope: ScopeIndex,
): boolean {
  for (const m of cluster.members) {
    if (m.sourceId === 'intrinsic' && intrinsicAssertsTopology(m.node)) return true
  }
  let parentRegion: string | undefined
  for (const m of rankMembers(cluster.members)) {
    if (m.node.parent) {
      parentRegion = regionIdRemap.get(m.node.parent) ?? m.node.parent
      break
    }
  }
  if (parentRegion && scope.inClosedScope(parentRegion)) return true
  for (const cl of clusters) {
    if (!scope.closedRegionIds.has(cl.canonicalId)) continue
    for (const m of cluster.members) if (nodeMatchesRegion(m.node, cl)) return true
  }
  return false
}

function mergeRegionIdentities(ids: Array<RegionIdentity | undefined>): RegionIdentity | undefined {
  let name: string | undefined
  const keys: Record<string, string> = {}
  let touched = false
  for (const id of ids) {
    if (!id) continue
    if (id.name && !name) {
      name = id.name
      touched = true
    }
    for (const [k, v] of Object.entries(id.keys ?? {})) {
      if (keys[k] === undefined) {
        keys[k] = v
        touched = true
      }
    }
  }
  if (!touched) return undefined
  const out: RegionIdentity = {}
  if (name) out.name = name
  if (Object.keys(keys).length > 0) out.keys = keys
  return out
}

function dedupMembership(crit: MembershipCriterion[]): MembershipCriterion[] {
  const seen = new Set<string>()
  const out: MembershipCriterion[] = []
  for (const c of crit) {
    const k = `${c.attr}|${c.key ?? ''}|${c.value}`
    if (!seen.has(k)) {
      seen.add(k)
      out.push(c)
    }
  }
  return out
}

/**
 * Fold each region cluster into one merged subgraph. Cross-source members merge
 * by identity (id collapses to `canonicalId`); per field the highest-priority
 * member holding a value wins; identity keys + membership criteria union;
 * parent / children ids are remapped through the region map. Provenance is
 * ALWAYS restamped so resolve is the sole authority.
 */
/** Canonical parent of a region cluster (highest-priority member's parent, remapped). */
function regionParentId(cl: RegionCluster, regionIdRemap: Map<string, string>): string | undefined {
  const ranked = [...cl.members].sort(
    (a, b) => b.priority - a.priority || b.capturedAt - a.capturedAt,
  )
  for (const m of ranked) {
    if (m.subgraph.parent) return regionIdRemap.get(m.subgraph.parent) ?? m.subgraph.parent
  }
  return undefined
}

/**
 * Regions to keep: those with a resolved member node (directly or via a
 * descendant), plus the full ancestor chain of each so the kept regions nest.
 * Empty regions are excluded → no floating boxes.
 */
function computeKeptRegions(
  resolvedNodes: Node[],
  clusters: RegionCluster[],
  regionIdRemap: Map<string, string>,
): Set<string> {
  const parentOf = new Map<string, string>()
  for (const cl of clusters) {
    const p = regionParentId(cl, regionIdRemap)
    if (p) parentOf.set(cl.canonicalId, p)
  }
  const kept = new Set<string>()
  for (const n of resolvedNodes) {
    let cur: string | undefined = n.parent
    const seen = new Set<string>()
    while (cur && !seen.has(cur)) {
      seen.add(cur)
      kept.add(cur)
      cur = parentOf.get(cur)
    }
  }
  return kept
}

function foldRegions(
  clusters: RegionCluster[],
  regionIdRemap: Map<string, string>,
  keptRegions: Set<string>,
): Subgraph[] | undefined {
  const out: Subgraph[] = []
  for (const cl of clusters) {
    if (!keptRegions.has(cl.canonicalId)) continue
    const ranked = [...cl.members].sort(
      (a, b) => b.priority - a.priority || b.capturedAt - a.capturedAt,
    )
    const top = ranked[0]
    if (!top) continue
    const pick = <T>(read: (s: Subgraph) => T | undefined): T | undefined => {
      for (const m of ranked) {
        const v = read(m.subgraph)
        if (hasValue(v)) return v
      }
      return undefined
    }

    const hasIntrinsic = cl.members.some((m) => m.sourceId === 'intrinsic')
    const observerCount = cl.members.filter((m) => m.sourceId !== 'intrinsic').length
    let state: Provenance['state']
    if (hasIntrinsic && observerCount > 0) state = 'confirmed'
    else if (hasIntrinsic) state = 'intrinsic-only'
    else if (observerCount >= 2) state = 'confirmed'
    else state = 'discovered-only'
    const source = hasIntrinsic
      ? 'intrinsic'
      : ([...cl.members].sort((a, b) => b.capturedAt - a.capturedAt)[0]?.sourceId ?? 'unknown')

    const identity = mergeRegionIdentities(cl.members.map((m) => m.subgraph.identity))
    const membership = dedupMembership(cl.members.flatMap((m) => m.subgraph.membership ?? []))
    const parentRaw = pick((s) => s.parent)
    const parent = parentRaw ? (regionIdRemap.get(parentRaw) ?? parentRaw) : undefined
    const childrenRaw = cl.members.flatMap((m) => m.subgraph.children ?? [])
    const children = [
      ...new Set(
        childrenRaw.map((c) => regionIdRemap.get(c) ?? c).filter((c) => keptRegions.has(c)),
      ),
    ]
    const direction = pick((s) => s.direction)
    const style = pick((s) => s.style)
    const spec = pick((s) => s.spec)
    const file = pick((s) => s.file)
    const pins = pick((s) => s.pins)
    const attachments = foldAttachmentEntries(
      ranked.map((m) => ({
        sourceId: m.sourceId,
        capturedAt: m.capturedAt,
        attachments: m.subgraph.attachments,
      })),
    )

    out.push({
      id: cl.canonicalId,
      label: pick((s) => s.label) ?? top.subgraph.label,
      ...(parent ? { parent } : {}),
      ...(children.length > 0 ? { children } : {}),
      ...(direction ? { direction } : {}),
      ...(style ? { style } : {}),
      ...(spec ? { spec } : {}),
      ...(file ? { file } : {}),
      ...(pins ? { pins } : {}),
      ...(identity ? { identity } : {}),
      ...(membership.length > 0 ? { membership } : {}),
      ...(attachments.length > 0 ? { attachments } : {}),
      provenance: { source, state },
    })
  }
  return out.length > 0 ? out : undefined
}

interface LinkMember {
  sourceId: string
  priority: number
  capturedAt: number
  /** The link with its endpoints already remapped to cluster ids + folded ports. */
  link: Link
}

/**
 * Fold links across contributions. Endpoints are first remapped to resolved
 * cluster ids + folded port ids. Links are then bucketed by NODE PAIR (port
 * independent) and, within each pair, greedily sub-clustered into the same
 * physical edge when their endpoints' interface NAMES align — so the same link
 * observed by two sources that name the ports differently ("HundredGigE0/0/0/8"
 * vs TTDB's "hg-0/0/0/8", or a Zabbix ifIndex on the far end) still collapses to
 * one edge (#404). Genuine parallel links between the same pair (distinct ports
 * on both ends) stay separate. Per field, the highest-priority contribution that
 * holds a value wins (priority desc, capturedAt desc), mirroring the node field
 * merge; `metadata` merges per key. Dangling links (an endpoint whose node
 * didn't survive clustering) are dropped.
 */
function foldLinks(
  contributions: Contribution[],
  clusterById: Map<string, NodeCluster>,
  portIdRemap: Map<string, string>,
  portNameById: Map<string, string>,
): Link[] {
  // 1. Remap endpoints and bucket by node pair. First-seen order is preserved
  //    (contributions are intrinsic-first) for stable output.
  const buckets = new Map<string, LinkMember[]>()
  const order: string[] = []
  for (const contrib of contributions) {
    for (const link of contrib.graph.links) {
      const from = remapEndpoint(link.from, contrib.sourceId, clusterById, portIdRemap)
      const to = remapEndpoint(link.to, contrib.sourceId, clusterById, portIdRemap)
      if (!from || !to) continue // dangling — endpoint node didn't survive
      const key = nodePairKey(from, to)
      const member: LinkMember = {
        sourceId: contrib.sourceId,
        priority: contrib.priority,
        capturedAt: contrib.capturedAt,
        link: { ...link, from, to },
      }
      const existing = buckets.get(key)
      if (existing) existing.push(member)
      else {
        buckets.set(key, [member])
        order.push(key)
      }
    }
  }

  // 2. Within each node pair, greedily group members that denote the same
  //    physical edge, then fold each group. A group with only anchor members
  //    (every contributor was link_contribution:'update') makes no presence
  //    claim → no new edge, exactly like an anchor-only node cluster.
  const links: Link[] = []
  for (const key of order) {
    const members = buckets.get(key)
    if (!members) continue
    const groups: LinkMember[][] = []
    for (const m of members) {
      const g = groups.find((grp) => grp.some((other) => samePhysicalLink(m, other, portNameById)))
      if (g) g.push(m)
      else groups.push([m])
    }
    for (const group of groups) {
      if (!group.some((m) => m.link.presence !== 'anchor')) continue
      links.push(foldLinkCluster(group))
    }
  }
  return links
}

// Internal Map-key separator (never displayed). Record separator doesn't occur
// in node ids (namespaced alphanumerics + `:`/`-`/`.`/`/`).
const ENDPOINT_PAIR_SEP = '\x1e'

/** Canonical, order-independent key for a remapped link's node pair. */
function nodePairKey(from: LinkEndpoint, to: LinkEndpoint): string {
  return [from.node, to.node].sort().join(ENDPOINT_PAIR_SEP)
}

/**
 * Canonical endpoint order for a link: the endpoint whose node id sorts first
 * comes first (for a self-loop, order by port id). This aligns two links on the
 * same node pair so their corresponding ends can be compared.
 */
function canonicalEnds(link: Link): [LinkEndpoint, LinkEndpoint] {
  const { from, to } = link
  if (from.node < to.node) return [from, to]
  if (from.node > to.node) return [to, from]
  return (from.port ?? '') <= (to.port ?? '') ? [from, to] : [to, from]
}

function endPortName(end: LinkEndpoint, portNameById: Map<string, string>): string {
  if (!end.port) return ''
  return portNameById.get(end.port) ?? end.port
}

type EndRelation = 'match' | 'conflict' | 'unknown'

function endRelation(a: string, b: string): EndRelation {
  if (!a || !b) return 'unknown' // at least one side names no port → can't decide
  return interfaceNamesMatch(a, b) ? 'match' : 'conflict'
}

/**
 * Whether two remapped links (already on the same node pair) are the same
 * physical edge. They are if at least one aligned end's interface names match
 * — the other end may legitimately disagree because sources speak different
 * port vocabularies (e.g. a Zabbix ifIndex on the far end). If neither end
 * names any port, fall back to node-pair identity (the old behavior).
 */
function samePhysicalLink(
  a: LinkMember,
  b: LinkMember,
  portNameById: Map<string, string>,
): boolean {
  const [a1, a2] = canonicalEnds(a.link)
  const [b1, b2] = canonicalEnds(b.link)
  const e1 = endRelation(endPortName(a1, portNameById), endPortName(b1, portNameById))
  const e2 = endRelation(endPortName(a2, portNameById), endPortName(b2, portNameById))
  if (e1 === 'match' || e2 === 'match') return true
  return e1 === 'unknown' && e2 === 'unknown'
}

/** Link fields owned by the fold itself — never copied through the generic merge. */
const LINK_FOLD_RESERVED = new Set(['id', 'from', 'to', 'provenance', 'metadata', 'presence'])

function foldLinkCluster(members: LinkMember[]): Link {
  const ranked = [...members].sort((a, b) => b.priority - a.priority || b.capturedAt - a.capturedAt)
  const top = ranked[0]
  if (!top) throw new Error('empty link cluster')

  // Generic per-field winner: first ranked member holding a value wins. Keeps
  // the fold robust as Link grows new optional fields (vlan, cable, label, …).
  const merged: Record<string, unknown> = {}
  const keys = new Set<string>()
  for (const m of ranked) {
    for (const k of Object.keys(m.link)) if (!LINK_FOLD_RESERVED.has(k)) keys.add(k)
  }
  for (const k of keys) {
    for (const m of ranked) {
      const v = (m.link as unknown as Record<string, unknown>)[k]
      if (hasValue(v)) {
        merged[k] = v
        break
      }
    }
  }

  // metadata: per-key, highest-priority defined value wins (structural merge).
  const metadata: Record<string, unknown> = {}
  for (const m of ranked) {
    for (const [k, v] of Object.entries(m.link.metadata ?? {})) {
      if (v !== undefined && metadata[k] === undefined) metadata[k] = v
    }
  }

  // id: prefer the intrinsic contribution's id, else the highest-priority one.
  const intrinsicId = ranked.find((m) => m.sourceId === 'intrinsic' && hasValue(m.link.id))?.link.id
  const id = intrinsicId ?? ranked.find((m) => hasValue(m.link.id))?.link.id

  return {
    ...(id != null ? { id } : {}),
    ...merged,
    from: top.link.from,
    to: top.link.to,
    ...(Object.keys(metadata).length > 0 ? { metadata } : {}),
    provenance: deriveLinkProvenance(members),
  }
}

function deriveLinkProvenance(members: LinkMember[]): Provenance {
  const hasIntrinsic = members.some((m) => m.sourceId === 'intrinsic')
  const observerCount = members.filter((m) => m.sourceId !== 'intrinsic').length
  let state: Provenance['state']
  if (hasIntrinsic && observerCount > 0) state = 'confirmed'
  else if (hasIntrinsic) state = 'intrinsic-only'
  else if (observerCount >= 2) state = 'confirmed'
  else state = 'discovered-only'

  let source = 'intrinsic'
  if (!hasIntrinsic) {
    const latest = [...members].sort((a, b) => b.capturedAt - a.capturedAt)[0]
    source = latest?.sourceId ?? 'unknown'
  }
  const latestObserved = members.reduce(
    (acc, m) => (Number.isFinite(m.capturedAt) && m.capturedAt > acc ? m.capturedAt : acc),
    Number.NEGATIVE_INFINITY,
  )
  return {
    source,
    state,
    observedAt: Number.isFinite(latestObserved) ? latestObserved : undefined,
  }
}

function remapEndpoint(
  endpoint: LinkEndpoint,
  sourceId: string,
  clusterById: Map<string, NodeCluster>,
  portIdRemap: Map<string, string>,
): LinkEndpoint | null {
  const cluster = clusterById.get(`${sourceId}:${endpoint.node}`)
  if (!cluster) return null
  // The endpoint's port id came from this source's pre-fold node; after port
  // folding the surviving port may carry a different id. Remap it so the link
  // still references a real port (and a port-level metrics binding on that port
  // is discoverable). Falls back to the original id if unmapped.
  const remappedPort = endpoint.port
    ? (portIdRemap.get(portRemapKey(sourceId, endpoint.node, endpoint.port)) ?? endpoint.port)
    : endpoint.port
  return { ...endpoint, node: cluster.id, port: remappedPort }
}
