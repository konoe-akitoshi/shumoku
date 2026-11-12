// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import type * as input from '../input/model.js'
import type {
  DrawingLayer,
  ObservationLayer,
  ObservedModel,
  SourceNetwork,
} from '../models/network-model.js'
import {
  type Attachment,
  attachmentKey,
  type MembershipCriterion,
  type NodeExclusion,
  type PortObservation,
  type Provenance,
  type RegionIdentity,
  type ScopeFilter,
} from '../models/types.js'
import {
  addressKey,
  keyHash,
  nodeIdentityKeys,
  portIdentityKeys,
  segmentAddressesOf,
} from './identity.js'
import { interfaceNamesMatch } from './interface-name.js'
import type { ResolveOptions } from './types.js'

/** What one source observed at a point in time, as the resolver merges it. */
export interface SourceSnapshot {
  /** Source identifier — typically `data_sources.id`. */
  sourceId: string
  /** Unix ms — when the source captured this. */
  capturedAt: number
  /** `'failed'` is never merged, so it never retracts what the source saw before. */
  status: 'ok' | 'partial' | 'failed' | 'empty'
  /** What was observed. `null` only when `status === 'failed'`. */
  source: SourceNetwork | null
  /** Merge priority — higher is earlier in the ordering, so wins per field. The project is first. */
  priority?: number
  /** How many of this source's recent runs failed in a row. */
  consecutiveFailures?: number
  /**
   * Registry entity ids for this source's nodes (by node id) and ports (by
   * `${nodeId}:${portName}`). Members sharing an entity id are always one device.
   */
  entities?: {
    nodes: Record<string, string>
    ports: Record<string, string>
  }
}

/**
 * The source label of the project's own contribution. The merge treats it as one contribution
 * among the others, first in the ordering; the label is what lets a reader tell its values apart,
 * and what the few rules that are the project's alone key on: a cluster it is in keeps its id, it
 * alone can suppress an attachment, and its presence claim settles a region's scope.
 */
const INTRINSIC = 'intrinsic'

/** The merged network, and the record of how its nodes are recognized and what the sources said. */
export interface ResolvedNetwork extends ObservedModel {
  readonly observation: ObservationLayer
}

/**
 * Merge the project's configuration with what every source observed into one network of the
 * same shape.
 *
 * All contributions are peers with an ordering between them; the project is first in it. Nodes
 * are clustered by the attributes their configuration writes (`address`, `chassisId`, `sysName`,
 * `mac`: any-key match), by a source's own ids (`observation.vendorIds`) or by a shared registry
 * entity id, regardless of the ordering; ports within a cluster by name, `mac` and `ifIndex`. Then
 * per field the first contribution in the ordering that holds a value wins (`priority desc,
 * capturedAt desc`). Every node, port, group and link gets a `provenance` in the observation
 * record returned beside the model.
 *
 * The merged network keeps a node's project id when the project wrote it, and gives a node only
 * sources found a synthesized `discovered:N` id. Each source's groups, segments, routing domains,
 * connections, redundancy sets and terminations are namespaced by its source id so they never
 * collide.
 *
 * See `apps/server/docs/design/topology-source-priority-merge.md`.
 */
export function resolveNetwork(
  project: SourceNetwork,
  snapshots: SourceSnapshot[],
  options: ResolveOptions = {},
): ResolvedNetwork {
  // 1. Contributions. The project is the first in the ordering and keeps its raw ids.
  const contributions: Contribution[] = [
    {
      sourceId: INTRINSIC,
      priority: Number.POSITIVE_INFINITY,
      capturedAt: Number.POSITIVE_INFINITY,
      network: project.network,
      ...(project.observation && { observation: project.observation }),
      ...(project.drawing && { drawing: project.drawing }),
    },
  ]
  for (const snap of snapshots) {
    if (snap.status === 'failed' || !snap.source) continue
    contributions.push({
      sourceId: snap.sourceId,
      priority: snap.priority ?? 0,
      capturedAt: snap.capturedAt,
      ...namespaceSource(snap.source, snap.sourceId),
      ...(snap.entities && { entities: snap.entities }),
    })
  }

  // 2. Node clusters by identity, then presence, hides and scope.
  const allClusters = clusterNodes(contributions)
  // Anchor-only clusters make no presence claim: they ride onto a node someone else scoops.
  const presentClusters = allClusters.filter((c) =>
    c.members.some((m) => m.observed?.presence !== 'anchor'),
  )
  const exclusions = project.observation?.exclusions ?? []
  const afterExclusions =
    exclusions.length > 0
      ? presentClusters.filter((c) => !isClusterExcluded(c, exclusions))
      : presentClusters

  const regions = clusterRegions(contributions)
  const regionIdRemap = new Map<string, string>()
  for (const cl of regions) {
    for (const m of cl.members) regionIdRemap.set(m.group.id, cl.canonicalId)
  }
  const scope = buildScopeIndex(regions, regionIdRemap)
  const regionScoped =
    scope.closedRegionIds.size > 0
      ? afterExclusions.filter((c) => clusterInClosedScope(c, regionIdRemap, scope))
      : afterExclusions
  const scopeFilter = options.scope
  const hasScopeFilter =
    !!scopeFilter && (scopeFilter.include?.length ?? 0) + (scopeFilter.exclude?.length ?? 0) > 0
  const nodeClusters =
    hasScopeFilter && scopeFilter
      ? regionScoped.filter((c) => clusterMatchesScopeFilter(c, scopeFilter))
      : regionScoped

  // 3. Fold every cluster into one node.
  const folded: FoldedNode[] = []
  const clusterById = new Map<string, NodeCluster>()
  const portRemap = new Map<string, string>()
  for (const cluster of nodeClusters) {
    const node = foldNodeCluster(cluster)
    folded.push(node)
    for (const [k, v] of node.portRemap) portRemap.set(k, v)
    for (const m of cluster.members) clusterById.set(memberKey(m.sourceId, m.node.id), cluster)
  }

  // 3b. Groups: remap to the merged region.
  for (const node of folded) {
    if (node.config.group === undefined) continue
    const mapped = regionIdRemap.get(node.config.group)
    if (mapped) node.config.group = mapped
  }
  const nodeIdOf = (sourceId: string, nodeId: string): string | undefined =>
    clusterById.get(memberKey(sourceId, nodeId))?.id
  for (const node of folded) {
    if (node.hostRef) {
      const host =
        nodeIdOf(node.hostRef.sourceId, node.hostRef.id) ??
        redundancyIdOf(node.hostRef.sourceId, node.hostRef.id)
      if (host) node.config.host = host
    }
  }

  // 4. Links.
  const portNames = new Map<string, string>()
  for (const node of folded) {
    for (const port of node.config.ports ?? []) {
      portNames.set(
        portKey(node.config.id, port.name),
        port.interfaceName || port.label || port.name,
      )
    }
  }
  const links = foldLinks(contributions, nodeIdOf, portRemap, portNames)

  // 5. Groups: keep regions with a member (directly or below), plus their ancestors.
  const kept = computeKeptRegions(folded, regions, regionIdRemap)
  const groups = foldRegions(regions, regionIdRemap, kept)

  // 6. Segments, routing domains, connections and redundancy sets: the union of every
  //    contribution's (already namespaced), with node references remapped to merged nodes.
  const segments = contributions.flatMap((c) =>
    (c.network.segments ?? []).map((s) => remapSegment(s, c.sourceId)),
  )
  const routingDomains = contributions.flatMap((c) => [...(c.network.routingDomains ?? [])])
  const connections = contributions.flatMap((c) => [...(c.network.connections ?? [])])
  const redundancy = contributions.flatMap((c) =>
    (c.network.redundancy ?? []).flatMap((r) => {
      const nodes = [
        ...new Set(r.nodes.flatMap((n) => nodeIdOf(c.sourceId, n) ?? [])),
      ] as input.NodeId[]
      return nodes.length >= 2 ? [{ ...r, nodes }] : []
    }),
  )
  const terminations = contributions.flatMap((c) => [...(c.network.terminations ?? [])])

  const config: input.Network = {
    ...(project.network.name && { name: project.network.name }),
    ...(project.network.description && { description: project.network.description }),
    ...(groups.network.length > 0 && { groups: groups.network }),
    ...(routingDomains.length > 0 && { routingDomains }),
    ...(connections.length > 0 && { connections }),
    ...(segments.length > 0 && { segments }),
    ...(redundancy.length > 0 && { redundancy }),
    nodes: folded.map((n) => n.config),
    links: links.map((l) => l.config),
    ...(terminations.length > 0 && { terminations }),
  }

  const observation: ObservationLayer = {
    nodes: Object.fromEntries(folded.map((n) => [n.config.id, n.observation])),
    links: Object.fromEntries(links.map((l) => [l.config.id, l.observation])),
    ...(Object.keys(groups.observation).length > 0 && { groups: groups.observation }),
  }
  const drawnNodes = Object.fromEntries(
    folded.filter((n) => Object.keys(n.drawing).length > 0).map((n) => [n.config.id, n.drawing]),
  )
  const drawnLinks = Object.fromEntries(
    links.filter((l) => Object.keys(l.drawing).length > 0).map((l) => [l.config.id, l.drawing]),
  )
  const drawing: DrawingLayer = {
    ...(Object.keys(drawnNodes).length > 0 && { nodes: drawnNodes }),
    ...(Object.keys(drawnLinks).length > 0 && { links: drawnLinks }),
    ...(Object.keys(groups.drawing).length > 0 && { groups: groups.drawing }),
    ...(project.drawing?.settings && { settings: project.drawing.settings }),
    // The order a person chose is keyed by the project's ids, which the merge keeps.
    ...(project.drawing?.order && { order: project.drawing.order }),
  }

  return {
    model: { config, ...(Object.keys(drawing).length > 0 && { drawing }) },
    observation,
  }

  function redundancyIdOf(sourceId: string, id: string): string | undefined {
    const contribution = contributions.find((c) => c.sourceId === sourceId)
    return contribution?.network.redundancy?.some((r) => r.id === id) ? id : undefined
  }

  function remapSegment(segment: input.Segment, sourceId: string): input.Segment {
    const group = segment.group && regionIdRemap.get(segment.group)
    const addresses = segment.addresses
      ? Object.fromEntries(
          Object.entries(segment.addresses).flatMap(([holder, address]) => {
            const id = nodeIdOf(sourceId, holder) ?? redundancyIdOf(sourceId, holder)
            return id ? [[id, address]] : []
          }),
        )
      : undefined
    const { group: _, addresses: __, ...rest } = segment
    return {
      ...rest,
      ...(group && kept.has(group) && { group }),
      ...(addresses && Object.keys(addresses).length > 0 && { addresses }),
    }
  }
}

// ---------------------------------------------------------------------------
// Contributions
// ---------------------------------------------------------------------------

type NodeObservationEntry = NonNullable<ObservationLayer['nodes']>[string]
type NodeDrawingEntry = NonNullable<DrawingLayer['nodes']>[string]
type LinkObservationEntry = NonNullable<ObservationLayer['links']>[string]
type LinkDrawingEntry = NonNullable<DrawingLayer['links']>[string]
type GroupObservationEntry = NonNullable<ObservationLayer['groups']>[string]
type GroupDrawingEntry = NonNullable<DrawingLayer['groups']>[string]

interface Contribution {
  sourceId: string
  /** Higher wins per field. The project is +Infinity. */
  priority: number
  capturedAt: number
  network: input.Network
  observation?: ObservationLayer
  drawing?: DrawingLayer
  entities?: SourceSnapshot['entities']
}

/** The addresses a contribution's nodes hold in its segments, by node id. */
const addressesOf = new WeakMap<input.Network, Map<string, string[]>>()
function segmentAddresses(network: input.Network, nodeId: string): readonly string[] {
  let byNode = addressesOf.get(network)
  if (!byNode) {
    byNode = segmentAddressesOf(network)
    addressesOf.set(network, byNode)
  }
  return byNode.get(nodeId) ?? []
}

/**
 * Prefix a source's group, segment, routing domain, connection, redundancy and termination ids
 * with its source id, and every reference to them, so two sources' ids can't collide. Node ids
 * are not namespaced: nodes are matched by identity, and the cluster key carries the source id.
 */
function namespaceSource(
  source: SourceNetwork,
  sourceId: string,
): Pick<Contribution, 'network' | 'observation' | 'drawing'> {
  const tag = (id: string) => `${sourceId}:${id}`
  const { network } = source
  const redundancyIds = new Set(network.redundancy?.map((r) => r.id))
  const end = (e: input.Endpoint): input.Endpoint =>
    'segment' in e
      ? { segment: tag(e.segment) }
      : 'routingDomain' in e
        ? { routingDomain: tag(e.routingDomain) }
        : e
  const renamed: input.Network = {
    ...network,
    ...(network.groups && { groups: tagGroups(network.groups) }),
    ...(network.routingDomains && {
      routingDomains: network.routingDomains.map((d) => ({ ...d, id: tag(d.id) })),
    }),
    ...(network.connections && {
      connections: network.connections.map((c) => ({ ...c, id: tag(c.id) })),
    }),
    ...(network.segments && {
      segments: network.segments.map((s) => ({
        ...s,
        id: tag(s.id),
        ...(s.group && { group: tag(s.group) }),
        ...(s.routingDomain && { routingDomain: tag(s.routingDomain) }),
        ...(s.addresses && {
          addresses: Object.fromEntries(
            Object.entries(s.addresses).map(([k, v]) => [redundancyIds.has(k) ? tag(k) : k, v]),
          ),
        }),
      })),
    }),
    ...(network.redundancy && {
      redundancy: network.redundancy.map((r) => ({ ...r, id: tag(r.id) })),
    }),
    ...(network.terminations && {
      terminations: network.terminations.map((t) => ({ ...t, id: tag(t.id) })),
    }),
    nodes: network.nodes.map((n) => ({
      ...n,
      ...(n.group && { group: tag(n.group) }),
      ...(n.host && redundancyIds.has(n.host) && { host: tag(n.host) }),
    })),
    links: network.links.map((l) => ({
      ...l,
      endpoints: [end(l.endpoints[0]), end(l.endpoints[1])],
      ...(l.segments && { segments: l.segments.map(tag) }),
      ...(l.connection && { connection: tag(l.connection) }),
      ...(l.via && { via: l.via.map(tag) }),
    })),
  }
  const observationGroups = source.observation?.groups
  const drawingGroups = source.drawing?.groups
  return {
    network: renamed,
    ...(source.observation && {
      observation: {
        ...source.observation,
        ...(observationGroups && { groups: tagKeys(observationGroups, tag) }),
      },
    }),
    ...(source.drawing && {
      drawing: { ...source.drawing, ...(drawingGroups && { groups: tagKeys(drawingGroups, tag) }) },
    }),
  }

  function tagGroups(groups: readonly input.Group[]): input.Group[] {
    return groups.map((g) => ({
      ...g,
      id: tag(g.id),
      ...(g.groups && { groups: tagGroups(g.groups) }),
    }))
  }
}

function tagKeys<T>(record: Readonly<Record<string, T>>, tag: (id: string) => string) {
  return Object.fromEntries(Object.entries(record).map(([k, v]) => [tag(k), v]))
}

// ---------------------------------------------------------------------------
// Node clusters
// ---------------------------------------------------------------------------

/** One contribution's view of a node: its configuration, how it is recognized, how it is drawn. */
interface NodeView {
  node: input.Node
  /** The addresses the node holds in the contribution's segments. */
  addresses: readonly string[]
  observed?: NodeObservationEntry
  drawn?: NodeDrawingEntry
}

interface ClusterMember extends NodeView {
  sourceId: string
  priority: number
  capturedAt: number
  /** Registry entity id for this node, if known. */
  entityId?: string
  /** Registry entity ids for this contribution's ports, by `${nodeId}:${portName}`. */
  portEntities?: Record<string, string>
}

interface NodeCluster {
  /** The project's id when the project wrote the node, else a synthesized `discovered:N`. */
  id: string
  members: ClusterMember[]
}

const memberKey = (sourceId: string, nodeId: string) => `${sourceId}:${nodeId}`
const portKey = (nodeId: string, portName: string) => `${nodeId}:${portName}`

function viewOf(c: Contribution, node: input.Node): NodeView {
  const observed = c.observation?.nodes?.[node.id]
  const drawn = c.drawing?.nodes?.[node.id]
  const addresses = segmentAddresses(c.network, node.id)
  return { node, addresses, ...(observed && { observed }), ...(drawn && { drawn }) }
}

/**
 * The keys a member's node is recognized by: its configuration's attributes, the addresses it has
 * in the contribution's segments, and its source's own ids.
 */
function memberKeys(view: NodeView) {
  return nodeIdentityKeys({
    ...view.node,
    addresses: view.addresses,
    vendorIds: view.observed?.vendorIds,
  })
}

/** Every address a member's node is known by, as keys. */
function memberAddresses(view: NodeView): string[] {
  return [view.node.address, ...view.addresses].flatMap((a) => (a ? [addressKey(a)] : []))
}

/**
 * Cluster nodes across contributions. A registry entity id is the strongest key: a member that
 * carries one always joins its entity's cluster, and identity keys never merge two distinct
 * entities. Members without one join by identity key (any-key match). The project is claimed
 * first, so a cluster it is in keeps the project's id; then the sources by priority.
 */
function clusterNodes(contributions: Contribution[]): NodeCluster[] {
  const clusters: NodeCluster[] = []
  const keyIndex = new Map<string, number>()
  const entityIndex = new Map<string, number>()
  const usedClusterIds = new Set<string>()
  let nextSynthId = 0

  const claim = (member: ClusterMember): void => {
    const keys = memberKeys(member)
    const entityKey = member.entityId ? `entity:${member.entityId}` : undefined
    let hit = entityKey !== undefined ? entityIndex.get(entityKey) : undefined

    if (hit === undefined) {
      for (const key of keys) {
        const idx = keyIndex.get(keyHash(key))
        if (idx === undefined) continue
        if (entityKey !== undefined) {
          const other = clusters[idx]?.members.find((m) => m.entityId)?.entityId
          if (other !== undefined && `entity:${other}` !== entityKey) continue
        }
        hit = idx
        break
      }
    }

    if (hit !== undefined) {
      clusters[hit]?.members.push(member)
    } else {
      let id: string
      if (member.sourceId === INTRINSIC) {
        id = member.node.id
      } else {
        do {
          id = `discovered:${nextSynthId++}`
        } while (usedClusterIds.has(id))
      }
      usedClusterIds.add(id)
      clusters.push({ id, members: [member] })
      hit = clusters.length - 1
    }

    if (entityKey !== undefined && !entityIndex.has(entityKey)) entityIndex.set(entityKey, hit)
    for (const key of keys) {
      const h = keyHash(key)
      if (!keyIndex.has(h)) keyIndex.set(h, hit)
    }
    // An identity-less node still matches itself across re-runs of the same source.
    if (keys.length === 0) {
      const fallback = keyHash({
        kind: 'vendorId',
        value: memberKey(member.sourceId, member.node.id),
      })
      if (!keyIndex.has(fallback)) keyIndex.set(fallback, hit)
    }
  }

  for (const c of contributions) {
    if (c.sourceId !== INTRINSIC) continue
    for (const node of c.network.nodes) {
      claim({
        sourceId: c.sourceId,
        priority: c.priority,
        capturedAt: c.capturedAt,
        ...viewOf(c, node),
      })
    }
  }
  // Then the sources, highest priority first (ties keep their input order): which cluster a
  // node that bridges two joins, and whose keys index a cluster, follow the same ordering as
  // the field merge, not the order the caller happened to list the snapshots in.
  const sources = contributions
    .filter((c) => c.sourceId !== INTRINSIC)
    .sort((a, b) => b.priority - a.priority)
  for (const c of sources) {
    for (const node of c.network.nodes) {
      const entityId = c.entities?.nodes[node.id]
      claim({
        sourceId: c.sourceId,
        priority: c.priority,
        capturedAt: c.capturedAt,
        ...viewOf(c, node),
        ...(entityId && { entityId }),
        ...(c.entities && { portEntities: c.entities.ports }),
      })
    }
  }
  return clusters
}

/**
 * A cluster is hidden when any key an exclusion specifies equals the attribute some member's
 * configuration writes: `mgmtIp` a node's `address`, `chassisId` and `sysName` their own.
 */
function isClusterExcluded(cluster: NodeCluster, exclusions: readonly NodeExclusion[]): boolean {
  const held = (read: (node: input.Node) => string | undefined, value: string) =>
    cluster.members.some((m) => read(m.node) === value)
  for (const ex of exclusions) {
    const hidden = ex.mgmtIp && addressKey(ex.mgmtIp)
    if (hidden && cluster.members.some((m) => memberAddresses(m).includes(hidden))) return true
    if (ex.chassisId && held((n) => n.chassisId, ex.chassisId)) return true
    if (ex.sysName && held((n) => n.sysName, ex.sysName)) return true
  }
  return false
}

// ---------------------------------------------------------------------------
// Folding a node
// ---------------------------------------------------------------------------

interface FoldedNode {
  config: Mutable<input.Node>
  observation: NodeObservationEntry
  drawing: NodeDrawingEntry
  /** The winning `host`, as written by its contribution, to remap once every node is folded. */
  hostRef?: { sourceId: string; id: string }
  /** `${sourceId}:${nodeId}:${portName}` → the merged port's name. */
  portRemap: Array<[string, string]>
}

type Mutable<T> = { -readonly [K in keyof T]: T[K] }

/** "Has a value worth merging": not null, not empty. Empty yields to the next contribution. */
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

function pickField<M extends { sourceId: string }, T>(
  ranked: readonly M[],
  read: (m: M) => T | undefined,
): FieldWin<T> | undefined {
  for (const m of ranked) {
    const v = read(m)
    if (hasValue(v)) return { value: v as T, source: m.sourceId }
  }
  return undefined
}

function rank<M extends { priority: number; capturedAt: number }>(members: readonly M[]): M[] {
  return [...members].sort((a, b) => b.priority - a.priority || b.capturedAt - a.capturedAt)
}

/**
 * How much of a name a label is, judged by the field it echoes: a name (sysName, or echoing
 * nothing) 4, a model 3, an address 2, a hardware address 1, an opaque id 0, empty -1. Only
 * observations that all had to guess are ordered by this; the project's label is kept ahead.
 */
function labelRank(view: NodeView): number {
  const label = (view.node.label ?? '').trim()
  if (!label) return -1
  const { node } = view
  const folded = label.toLowerCase()
  const echoes = (value: string | undefined): boolean =>
    value !== undefined && value.length > 0 && folded === value.toLowerCase()
  if (echoes(node.sysName)) return 4
  if (echoes(node.product?.split('/').at(-1))) return 3
  if (echoes(node.address)) return 2
  if (echoes(node.mac) || echoes(node.chassisId)) return 1
  if (echoes(node.id)) return 0
  for (const vendorId of Object.values(view.observed?.vendorIds ?? {})) {
    if (echoes(vendorId)) return 0
  }
  return 4
}

function pickLabel(ranked: ClusterMember[]): FieldWin<string> | undefined {
  const byNameliness = [...ranked].sort((a, b) => {
    const project = Number(b.sourceId === INTRINSIC) - Number(a.sourceId === INTRINSIC)
    return project || labelRank(b) - labelRank(a)
  })
  return pickField(byNameliness, (m) => m.node.label)
}

/**
 * Configuration fields merged generically; `id`, `label`, `group`, `host` and `ports` are handled
 * apart. The attributes a device is recognized by (`address`, `chassisId`, `sysName`, `mac`)
 * merge like any other field: the first in the ordering that holds a value wins, and every
 * member's value still keys the cluster.
 */
const NODE_CONFIG_FIELDS = [
  'type',
  'product',
  'productId',
  'platform',
  'service',
  'resource',
  'software',
  'address',
  'sysName',
  'chassisId',
  'mac',
  'asn',
  'description',
  'assumed',
  'members',
] as const

function foldNodeCluster(cluster: NodeCluster): FoldedNode {
  const ranked = rank(cluster.members)
  const top = ranked[0]
  if (!top) throw new Error('empty cluster')
  const hasProject = cluster.members.some((m) => m.sourceId === INTRINSIC)
  const observerCount = cluster.members.filter((m) => m.sourceId !== INTRINSIC).length

  const config: Mutable<input.Node> = { id: cluster.id }
  const labelWin = pickLabel(ranked)
  if (labelWin) config.label = labelWin.value
  for (const field of NODE_CONFIG_FIELDS) {
    const win = pickField(ranked, (m) => m.node[field])
    if (win) Object.assign(config, { [field]: win.value })
  }
  const groupWin = pickField(ranked, (m) => m.node.group)
  if (groupWin) config.group = groupWin.value
  const hostMember = ranked.find((m) => hasValue(m.node.host))
  const hostRef =
    hostMember?.node.host !== undefined
      ? { sourceId: hostMember.sourceId, id: hostMember.node.host }
      : undefined

  // Observation. A source's own ids are kept by namespace, the first in the ordering per key.
  const vendorIds = mergeVendorIds(ranked.map((m) => m.observed?.vendorIds))
  const metadata: Record<string, unknown> = {}
  for (const m of ranked) {
    for (const [k, v] of Object.entries(m.observed?.metadata ?? {})) {
      if (v !== undefined && metadata[k] === undefined) metadata[k] = v
    }
  }
  const primaryObserver = ranked.find((m) => m.sourceId !== INTRINSIC)
  if (primaryObserver && metadata['observedSource'] === undefined) {
    metadata['observedSource'] = primaryObserver.sourceId
  }
  // Only the project can remove an attachment another contribution supplied.
  const suppressed = [
    ...new Set(
      cluster.members
        .filter((m) => m.sourceId === INTRINSIC)
        .flatMap((m) => m.observed?.suppressedAttachments ?? []),
    ),
  ]
  const attachments = foldAttachments(
    ranked.map((m) => ({ ...m, attachments: m.observed?.attachments })),
    suppressed,
  )
  let provenance = membersProvenance(cluster.members, hasProject, observerCount)
  // Sources that disagree on a non-empty label make the node conflicting, unless the project
  // named it (a human rename is never a conflict).
  const labels = cluster.members.flatMap((m) => (hasValue(m.node.label) ? [m.node.label] : []))
  if (!hasProject && labels.length > 1 && new Set(labels).size > 1) {
    provenance = { ...provenance, state: 'conflicting' }
  }

  const ports = foldPortsAcrossCluster(cluster)
  if (ports.config.length > 0) config.ports = ports.config

  const observation: NodeObservationEntry = {
    ...(vendorIds && { vendorIds }),
    ...(attachments.length > 0 && { attachments }),
    ...(suppressed.length > 0 && { suppressedAttachments: suppressed }),
    ...(Object.keys(metadata).length > 0 && { metadata }),
    ...(ports.observation && { ports: ports.observation }),
    provenance,
  }

  // Drawing: per field, the first in the ordering that holds a value.
  const drawing: Mutable<NodeDrawingEntry> = {}
  for (const field of ['shape', 'style', 'icon'] as const) {
    const win = pickField(ranked, (m) => m.drawn?.[field])
    if (win) Object.assign(drawing, { [field]: win.value })
  }

  return {
    config,
    observation,
    drawing,
    ...(hostRef && { hostRef }),
    portRemap: ports.remap,
  }
}

function membersProvenance(
  members: ReadonlyArray<{ sourceId: string; capturedAt: number }>,
  hasProject: boolean,
  observerCount: number,
): Provenance {
  let state: Provenance['state']
  if (hasProject && observerCount > 0) state = 'confirmed'
  else if (hasProject) state = 'intrinsic-only'
  else if (observerCount >= 2) state = 'confirmed'
  else state = 'discovered-only'
  let source = INTRINSIC
  if (!hasProject) {
    const latest = [...members].sort((a, b) => b.capturedAt - a.capturedAt)[0]
    source = latest?.sourceId ?? 'unknown'
  }
  // The project's +Infinity is not an observation time.
  const latestObserved = members.reduce(
    (acc, m) => (Number.isFinite(m.capturedAt) && m.capturedAt > acc ? m.capturedAt : acc),
    Number.NEGATIVE_INFINITY,
  )
  return {
    source,
    state,
    ...(Number.isFinite(latestObserved) && { observedAt: latestObserved }),
  }
}

/**
 * Fold attachments by `attachmentKey`: entries are priority desc, so the first per key wins,
 * stamped with where it came from. Suppressed keys are dropped whoever supplied them.
 */
function foldAttachments(
  entries: ReadonlyArray<{
    sourceId: string
    capturedAt: number
    attachments?: readonly Attachment[] | undefined
  }>,
  suppressedKeys: readonly string[] = [],
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
          ...(Number.isFinite(e.capturedAt) && { observedAt: e.capturedAt }),
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

/** Sources' own ids by namespace; entries are in the ordering, so the first per namespace wins. */
function mergeVendorIds(
  all: Array<Readonly<Record<string, string>> | undefined>,
): Record<string, string> | undefined {
  const merged: Record<string, string> = {}
  for (const ids of all) {
    for (const [ns, value] of Object.entries(ids ?? {})) {
      if (value && merged[ns] === undefined) merged[ns] = value
    }
  }
  return Object.keys(merged).length > 0 ? merged : undefined
}

// ---------------------------------------------------------------------------
// Ports
// ---------------------------------------------------------------------------

interface PortMember {
  sourceId: string
  nodeId: string
  priority: number
  capturedAt: number
  name: string
  /** The port as the contribution's configuration writes it. */
  written?: input.Port
  observed?: PortObservation
  entityId?: string
}

interface FoldedPorts {
  /** The merged ports, as the configuration writes them. */
  config: input.Port[]
  observation?: Record<string, PortObservation>
  remap: Array<[string, string]>
}

/** Every port a member writes or saw, with what it says of it. */
function memberPorts(m: ClusterMember): PortMember[] {
  const written = new Map(m.node.ports?.map((p) => [p.name, p]))
  const names = new Set([...written.keys(), ...Object.keys(m.observed?.ports ?? {})])
  return [...names].map((name) => {
    const port = written.get(name)
    const observed = m.observed?.ports?.[name]
    const entityId = m.portEntities?.[portKey(m.node.id, name)] ?? observed?.entityId
    return {
      sourceId: m.sourceId,
      nodeId: m.node.id,
      priority: m.priority,
      capturedAt: m.capturedAt,
      name,
      ...(port && { written: port }),
      ...(observed && { observed }),
      ...(entityId && { entityId }),
    }
  })
}

/**
 * Cluster a node's ports across its members by registry entity id, then by what the port is
 * recognized by (its name, its `mac`, its observed `ifIndex`), and fold each. Remaps every
 * member's port name to the merged port's, so links still reach it.
 */
function foldPortsAcrossCluster(cluster: NodeCluster): FoldedPorts {
  const all = cluster.members.flatMap(memberPorts)
  if (all.length === 0) return { config: [], remap: [] }

  const portClusters: PortMember[][] = []
  const keyToIdx = new Map<string, number>()
  const entityIdx = new Map<string, number>()
  for (const entry of all) {
    const keys = portIdentityKeys({
      name: entry.name,
      ...(entry.written?.mac && { mac: entry.written.mac }),
      ...(entry.observed?.ifIndex !== undefined && { ifIndex: entry.observed.ifIndex }),
    })
    const entityKey = entry.entityId ? `entity:${entry.entityId}` : undefined
    let hit = entityKey !== undefined ? entityIdx.get(entityKey) : undefined
    if (hit === undefined) {
      for (const key of keys) {
        const idx = keyToIdx.get(keyHash(key))
        if (idx === undefined) continue
        if (entityKey !== undefined) {
          const other = portClusters[idx]?.find((p) => p.entityId)?.entityId
          if (other !== undefined && `entity:${other}` !== entityKey) continue
        }
        hit = idx
        break
      }
    }
    if (hit !== undefined) portClusters[hit]?.push(entry)
    else {
      portClusters.push([entry])
      hit = portClusters.length - 1
    }
    if (entityKey !== undefined && !entityIdx.has(entityKey)) entityIdx.set(entityKey, hit)
    for (const key of keys) if (!keyToIdx.has(keyHash(key))) keyToIdx.set(keyHash(key), hit)
  }

  const config: input.Port[] = []
  const observation: Record<string, PortObservation> = {}
  const remap: Array<[string, string]> = []
  for (const members of portClusters) {
    const port = foldPortCluster(members)
    observation[port.name] = port.observation
    if (port.written) config.push(port.written)
    for (const m of members) remap.push([`${m.sourceId}:${m.nodeId}:${m.name}`, port.name])
  }
  return { config, observation, remap }
}

/** A port's configuration fields, merged generically; `name` is the fold's own. */
const PORT_FIELDS = [
  'label',
  'faceplateLabel',
  'interfaceName',
  'aliases',
  'role',
  'speed',
  'connectors',
  'poe',
  'source',
  'mac',
  'notes',
] as const

function foldPortCluster(members: PortMember[]): {
  name: string
  observation: PortObservation
  written?: input.Port
} {
  const ranked = rank(members)
  const top = ranked[0]
  if (!top) throw new Error('empty port cluster')
  const hasProject = members.some((m) => m.sourceId === INTRINSIC)
  const observerCount = members.filter((m) => m.sourceId !== INTRINSIC).length
  const { observedAt: _, ...provenance } = membersProvenance([], hasProject, observerCount)

  const suppressed = [
    ...new Set(
      members
        .filter((m) => m.sourceId === INTRINSIC)
        .flatMap((m) => m.observed?.suppressedAttachments ?? []),
    ),
  ]
  const attachments = foldAttachments(
    ranked.map((m) => ({ ...m, attachments: m.observed?.attachments })),
    suppressed,
  )
  const ifIndex = pickField(ranked, (m) => m.observed?.ifIndex)
  const observation: PortObservation = {
    ...(ifIndex && { ifIndex: ifIndex.value }),
    ...(attachments.length > 0 && { attachments }),
    ...(suppressed.length > 0 && { suppressedAttachments: suppressed }),
    provenance: { ...provenance, source: top.sourceId },
  }

  const picked: Record<string, unknown> = {}
  for (const field of PORT_FIELDS) {
    const win = pickField(ranked, (m) => m.written?.[field])
    if (win) picked[field] = win.value
  }
  const written =
    Object.keys(picked).length > 0 ? ({ name: top.name, ...picked } as input.Port) : undefined
  return { name: top.name, observation, ...(written && { written }) }
}

// ---------------------------------------------------------------------------
// Regions (groups)
// ---------------------------------------------------------------------------

interface RegionMember {
  sourceId: string
  priority: number
  capturedAt: number
  group: { id: string; label?: string; parent?: string }
  observed?: GroupObservationEntry
  drawn?: GroupDrawingEntry
}

interface RegionCluster {
  /** The project's id when the project is in the region, else the first member's. */
  canonicalId: string
  members: RegionMember[]
}

function flattenGroups(
  groups: readonly input.Group[],
  parent?: string,
): Array<{ id: string; label?: string; parent?: string }> {
  return groups.flatMap((g) => [
    { id: g.id, ...(g.label && { label: g.label }), ...(parent && { parent }) },
    ...flattenGroups(g.groups ?? [], g.id),
  ])
}

function regionKeys(identity: RegionIdentity | undefined): string[] {
  if (!identity) return []
  const out: string[] = []
  if (identity.name) out.push(`name=${identity.name}`)
  for (const [ns, v] of Object.entries(identity.keys ?? {})) out.push(`${ns}=${v}`)
  return out
}

/** Cluster groups across contributions by region identity; a group without one stays alone. */
function clusterRegions(contributions: Contribution[]): RegionCluster[] {
  const clusters: RegionCluster[] = []
  const keyIndex = new Map<string, number>()
  const claim = (m: RegionMember): void => {
    const keys = regionKeys(m.observed?.identity)
    let hit: number | undefined
    for (const k of keys) {
      hit = keyIndex.get(k)
      if (hit !== undefined) break
    }
    if (hit === undefined) {
      clusters.push({ canonicalId: m.group.id, members: [m] })
      hit = clusters.length - 1
    } else {
      clusters[hit]?.members.push(m)
    }
    for (const k of keys) if (!keyIndex.has(k)) keyIndex.set(k, hit)
  }
  const claimAll = (c: Contribution) => {
    for (const group of flattenGroups(c.network.groups ?? [])) {
      const observed = c.observation?.groups?.[group.id]
      const drawn = c.drawing?.groups?.[group.id]
      claim({
        sourceId: c.sourceId,
        priority: c.priority,
        capturedAt: c.capturedAt,
        group,
        ...(observed && { observed }),
        ...(drawn && { drawn }),
      })
    }
  }
  for (const c of contributions) if (c.sourceId === INTRINSIC) claimAll(c)
  for (const c of contributions) if (c.sourceId !== INTRINSIC) claimAll(c)
  return clusters
}

function regionParentId(cl: RegionCluster, remap: Map<string, string>): string | undefined {
  for (const m of rank(cl.members)) {
    if (m.group.parent) return remap.get(m.group.parent) ?? m.group.parent
  }
  return undefined
}

interface ScopeIndex {
  closedRegionIds: Set<string>
  inClosedScope: (regionId: string) => boolean
}

/** A region is in the closed world iff a contributing group is marked `scope: 'closed'`. */
function buildScopeIndex(clusters: RegionCluster[], remap: Map<string, string>): ScopeIndex {
  const closedRegionIds = new Set<string>()
  const regionParent = new Map<string, string>()
  for (const cl of clusters) {
    if (cl.members.some((m) => m.observed?.scope === 'closed')) closedRegionIds.add(cl.canonicalId)
    const parent = regionParentId(cl, remap)
    if (parent) regionParent.set(cl.canonicalId, parent)
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
 * Whether the project's node claims the node exists, rather than only carrying a metrics
 * binding for a node some source finds.
 */
function projectAssertsTopology(view: NodeView): boolean {
  if (view.observed?.presence === 'anchor') return false
  if ((view.node.label ?? '').trim() !== '') return true
  const { node, drawn } = view
  if (node.type || node.product || node.group || node.productId) return true
  if (drawn?.shape || drawn?.style) return true
  if (Object.keys(view.observed?.ports ?? {}).length > 0) return true
  if ((node.ports?.length ?? 0) > 0) return true
  return (view.observed?.attachments ?? []).some((a) => a.kind !== 'metrics-binding')
}

function clusterInClosedScope(
  cluster: NodeCluster,
  remap: Map<string, string>,
  scope: ScopeIndex,
): boolean {
  for (const m of cluster.members) {
    if (m.sourceId === INTRINSIC && projectAssertsTopology(m)) return true
  }
  const parent = rank(cluster.members).find((m) => m.node.group)?.node.group
  const region = parent ? (remap.get(parent) ?? parent) : undefined
  return region !== undefined && scope.inClosedScope(region)
}

function clusterMatchesScopeFilter(cluster: NodeCluster, scope: ScopeFilter): boolean {
  for (const m of cluster.members) {
    if (m.sourceId === INTRINSIC && projectAssertsTopology(m)) return true
  }
  const anyMatches = (crit: MembershipCriterion) =>
    cluster.members.some((m) => criterionMatches(m, crit))
  if ((scope.exclude ?? []).some(anyMatches)) return false
  const include = scope.include ?? []
  return include.length === 0 || include.some(anyMatches)
}

function criterionMatches(view: NodeView, crit: MembershipCriterion): boolean {
  const { node } = view
  if (crit.attr === 'name') {
    const re = safeRegex(crit.value)
    if (!re) return false
    return [node.label, node.sysName].some((h) => !!h && re.test(h))
  }
  if (crit.attr === 'subnet') {
    return memberAddresses(view).some((address) => ipv4InCidr(address, crit.value))
  }
  if (crit.attr === 'metadata') {
    if (!crit.key) return false
    const v = view.observed?.metadata?.[crit.key]
    if (v === undefined) return false
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

/** Regions with a merged node in them or below, plus their ancestors, so nothing floats empty. */
function computeKeptRegions(
  nodes: FoldedNode[],
  clusters: RegionCluster[],
  remap: Map<string, string>,
): Set<string> {
  const parentOf = new Map<string, string>()
  for (const cl of clusters) {
    const p = regionParentId(cl, remap)
    if (p) parentOf.set(cl.canonicalId, p)
  }
  const kept = new Set<string>()
  for (const n of nodes) {
    let cur: string | undefined = n.config.group
    const seen = new Set<string>()
    while (cur && !seen.has(cur)) {
      seen.add(cur)
      kept.add(cur)
      cur = parentOf.get(cur)
    }
  }
  return kept
}

function mergeRegionIdentities(ids: Array<RegionIdentity | undefined>): RegionIdentity | undefined {
  let name: string | undefined
  const keys: Record<string, string> = {}
  for (const id of ids) {
    if (!id) continue
    if (id.name && !name) name = id.name
    for (const [k, v] of Object.entries(id.keys ?? {})) if (keys[k] === undefined) keys[k] = v
  }
  if (!name && Object.keys(keys).length === 0) return undefined
  return { ...(name && { name }), ...(Object.keys(keys).length > 0 && { keys }) }
}

/** Fold each kept region into one group, nested under its merged parent. */
function foldRegions(
  clusters: RegionCluster[],
  remap: Map<string, string>,
  kept: Set<string>,
): {
  network: input.Group[]
  observation: Record<string, GroupObservationEntry>
  drawing: Record<string, GroupDrawingEntry>
} {
  const flat: Array<{ id: string; label?: string; parent?: string }> = []
  const observation: Record<string, GroupObservationEntry> = {}
  const drawing: Record<string, GroupDrawingEntry> = {}
  for (const cl of clusters) {
    if (!kept.has(cl.canonicalId)) continue
    const ranked = rank(cl.members)
    const hasProject = cl.members.some((m) => m.sourceId === INTRINSIC)
    const observerCount = cl.members.filter((m) => m.sourceId !== INTRINSIC).length
    const { observedAt: _, ...provenance } = membersProvenance(
      cl.members,
      hasProject,
      observerCount,
    )
    const label = pickField(ranked, (m) => m.group.label)
    const parent = regionParentId(cl, remap)
    flat.push({
      id: cl.canonicalId,
      ...(label && { label: label.value }),
      ...(parent && kept.has(parent) && { parent }),
    })

    const identity = mergeRegionIdentities(cl.members.map((m) => m.observed?.identity))
    const attachments = foldAttachments(
      ranked.map((m) => ({ ...m, attachments: m.observed?.attachments })),
    )
    observation[cl.canonicalId] = {
      ...(identity && { identity }),
      ...(attachments.length > 0 && { attachments }),
      provenance,
    }
    const drawn: Record<string, unknown> = {}
    for (const field of ['style', 'spec'] as const) {
      const win = pickField(ranked, (m) => m.drawn?.[field])
      if (win) drawn[field] = win.value
    }
    if (Object.keys(drawn).length > 0) drawing[cl.canonicalId] = drawn as GroupDrawingEntry
  }
  return { network: nest(flat), observation, drawing }
}

function nest(flat: Array<{ id: string; label?: string; parent?: string }>): input.Group[] {
  const ids = new Set(flat.map((g) => g.id))
  const childrenOf = (parent: string | undefined): input.Group[] =>
    flat
      .filter((g) => (parent === undefined ? !g.parent || !ids.has(g.parent) : g.parent === parent))
      .map((g) => {
        const groups = childrenOf(g.id)
        return {
          id: g.id,
          ...(g.label && { label: g.label }),
          ...(groups.length > 0 && { groups }),
        }
      })
  return childrenOf(undefined)
}

// ---------------------------------------------------------------------------
// Links
// ---------------------------------------------------------------------------

/** A link end after remapping: a merged node and its merged port, or a shared network. */
type End = input.Endpoint

interface LinkMember {
  sourceId: string
  priority: number
  capturedAt: number
  link: input.Link
  ends: [End, End]
  observed?: LinkObservationEntry
  drawn?: LinkDrawingEntry
}

interface FoldedLink {
  config: input.Link & { id: string }
  observation: LinkObservationEntry
  drawing: LinkDrawingEntry
}

const endKey = (e: End): string =>
  'node' in e
    ? e.node
    : 'segment' in e
      ? `segment:${e.segment}`
      : `routingDomain:${e.routingDomain}`

/**
 * Fold links across contributions. Ends are remapped to merged nodes and ports; links are then
 * bucketed by their two ends and, within a bucket, grouped into one physical edge when an end's
 * interface names align, so the same link seen by two sources that name ports differently is one
 * edge while parallel links stay apart. Per field the first in the order holding a value wins. A
 * link whose node did not survive is dropped; a group of anchor-only members makes no edge.
 */
function foldLinks(
  contributions: Contribution[],
  nodeIdOf: (sourceId: string, nodeId: string) => string | undefined,
  portRemap: Map<string, string>,
  portNames: Map<string, string>,
): FoldedLink[] {
  const remapEnd = (e: input.Endpoint, sourceId: string): End | undefined => {
    if (!('node' in e)) return e
    const node = nodeIdOf(sourceId, e.node)
    if (!node) return undefined
    const port = e.port ? (portRemap.get(`${sourceId}:${e.node}:${e.port}`) ?? e.port) : undefined
    return { node, ...(port && { port }), ...(e.plug && { plug: e.plug }) }
  }

  const buckets = new Map<string, LinkMember[]>()
  for (const c of contributions) {
    for (const link of c.network.links) {
      const a = remapEnd(link.endpoints[0], c.sourceId)
      const b = remapEnd(link.endpoints[1], c.sourceId)
      if (!a || !b) continue
      const observed = link.id ? c.observation?.links?.[link.id] : undefined
      const drawn = link.id ? c.drawing?.links?.[link.id] : undefined
      const member: LinkMember = {
        sourceId: c.sourceId,
        priority: c.priority,
        capturedAt: c.capturedAt,
        link,
        ends: [a, b],
        ...(observed && { observed }),
        ...(drawn && { drawn }),
      }
      const key = [endKey(a), endKey(b)].sort().join('\x1e')
      const bucket = buckets.get(key)
      if (bucket) bucket.push(member)
      else buckets.set(key, [member])
    }
  }

  const usedIds = new Set<string>()
  const links: FoldedLink[] = []
  for (const members of buckets.values()) {
    const groups: LinkMember[][] = []
    for (const m of members) {
      const group = groups.find((g) => g.some((o) => samePhysicalLink(m, o, portNames)))
      if (group) group.push(m)
      else groups.push([m])
    }
    for (const group of groups) {
      if (!group.some((m) => m.observed?.presence !== 'anchor')) continue
      links.push(foldLinkCluster(group, usedIds))
    }
  }
  return links
}

function canonicalEnds(ends: [End, End]): [End, End] {
  const [a, b] = ends
  const ka = endKey(a)
  const kb = endKey(b)
  if (ka !== kb) return ka < kb ? [a, b] : [b, a]
  const pa = 'node' in a ? (a.port ?? '') : ''
  const pb = 'node' in b ? (b.port ?? '') : ''
  return pa <= pb ? [a, b] : [b, a]
}

function endPortName(e: End, portNames: Map<string, string>): string {
  if (!('node' in e) || !e.port) return ''
  return portNames.get(portKey(e.node, e.port)) ?? e.port
}

function endRelation(a: string, b: string): 'match' | 'conflict' | 'unknown' {
  if (!a || !b) return 'unknown'
  return interfaceNamesMatch(a, b) ? 'match' : 'conflict'
}

/** Same physical edge: an aligned end's interface names match, or neither end names a port. */
function samePhysicalLink(a: LinkMember, b: LinkMember, portNames: Map<string, string>): boolean {
  const [a1, a2] = canonicalEnds(a.ends)
  const [b1, b2] = canonicalEnds(b.ends)
  const e1 = endRelation(endPortName(a1, portNames), endPortName(b1, portNames))
  const e2 = endRelation(endPortName(a2, portNames), endPortName(b2, portNames))
  if (e1 === 'match' || e2 === 'match') return true
  return e1 === 'unknown' && e2 === 'unknown'
}

/** Link configuration fields merged generically; ids and ends are the fold's own. */
const LINK_CONFIG_FIELDS = [
  'speed',
  'bandwidth',
  'cable',
  'length',
  'via',
  'segments',
  'description',
  'connection',
  'assumed',
  'virtual',
] as const

/** The same end of a link as another member wrote it: the same node and port, in either order. */
function sameEndOf(member: LinkMember, end: End): End | undefined {
  const key = (e: End) => `${endKey(e)}:${'node' in e ? (e.port ?? '') : ''}`
  return member.ends.find((e) => key(e) === key(end))
}

function foldLinkCluster(members: LinkMember[], usedIds: Set<string>): FoldedLink {
  const ranked = rank(members)
  const top = ranked[0]
  if (!top) throw new Error('empty link cluster')

  const projectId = ranked.find((m) => m.sourceId === INTRINSIC && hasValue(m.link.id))?.link.id
  const written = projectId ?? ranked.find((m) => hasValue(m.link.id))?.link.id
  // Every merged link has an id, so its layers can refer to it.
  let id = written ?? `${endKey(top.ends[0])}~${endKey(top.ends[1])}`
  for (let n = 2; usedIds.has(id); n++) id = `${written ?? endKey(top.ends[0])}#${n}`
  usedIds.add(id)

  // Each end's plug: the first in the ordering that writes one at that end.
  const endpoints = top.ends.map((end): input.Endpoint => {
    if (!('node' in end)) return end
    const plug = pickField(ranked, (m) => {
      const same = sameEndOf(m, end)
      return same && 'node' in same ? same.plug : undefined
    })
    const { plug: _, ...bare } = end
    return plug ? { ...bare, plug: plug.value } : bare
  })
  const config: Record<string, unknown> = { id, endpoints }
  for (const field of LINK_CONFIG_FIELDS) {
    const win = pickField(ranked, (m) => m.link[field])
    if (win) config[field] = win.value
  }

  const hasProject = members.some((m) => m.sourceId === INTRINSIC)
  const observerCount = members.filter((m) => m.sourceId !== INTRINSIC).length
  const entityId = pickField(ranked, (m) => m.observed?.entityId)
  // Metadata merges per key: the first defined value in the ordering wins.
  const metadata: Record<string, unknown> = {}
  for (const m of ranked) {
    for (const [k, v] of Object.entries(m.observed?.metadata ?? {})) {
      if (v !== undefined && metadata[k] === undefined) metadata[k] = v
    }
  }
  const observation: LinkObservationEntry = {
    provenance: membersProvenance(members, hasProject, observerCount),
    ...(entityId && { entityId: entityId.value }),
    ...(Object.keys(metadata).length > 0 && { metadata }),
  }
  const drawing: Record<string, unknown> = {}
  for (const field of ['label', 'type', 'style'] as const) {
    const win = pickField(ranked, (m) => m.drawn?.[field])
    if (win) drawing[field] = win.value
  }
  return {
    config: config as unknown as input.Link & { id: string },
    observation,
    drawing: drawing as LinkDrawingEntry,
  }
}
