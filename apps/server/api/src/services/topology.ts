/**
 * Topology Service
 * Manages network topologies with database persistence.
 *
 * Storage model: the `topologies` table holds only the topology shell
 * (name, share_token, composition_revision). Sources live in
 * `topology_data_sources` (m2m). Each contribution — the project's own authored
 * graph AND every external source's latest observed graph — is stored DB-native
 * in the `contribution_*` store (decomposed into queryable element/link/
 * attachment rows; see db-native-persistence.md). `topology_observations` is now
 * just the append-only audit/history log. The metrics mapping is `metrics-binding`
 * attachments on the resolved graph (no `mapping_json`); the resolved graph +
 * layout are materialized in `topology_resolved_graph`.
 *
 * The editor 's "save" routes through `writeIntrinsicGraph` (PUT
 * /topologies/:id/intrinsic), which ingests the project's own graph as the
 * topology's intrinsic contribution (`contribution_source.attachment_id IS NULL`).
 * There is no Manual data source and no `content_json` column — the project's own
 * graph is just the top-priority contribution, read back via `readIntrinsicGraph`.
 */

import type { Database } from 'bun:sqlite'
import type {
  Attachment,
  IconDimensions,
  Identity,
  LayoutResult,
  MetricsBindingAttachment,
  NetworkGraph,
  Node,
  NodePort,
  ResolvedLayout,
  SnapshotEntry,
  Subgraph,
  Termination,
} from '@shumoku/core'
import {
  attachmentKey,
  computeNetworkLayout,
  createMemoryFileResolver,
  deriveMappingFromGraph,
  HierarchicalParser,
  resolve as resolveObservations,
  sampleNetwork,
  YamlParser,
} from '@shumoku/core'
import { collectIconUrls, resolveAllIconDimensions } from '@shumoku/renderer-svg'
import { generateId, getDatabase, timestamp } from '../db/index.js'
import type { MetricsData, MetricsMapping, Topology, TopologyInput } from '../types.js'
import { buildGraph, ingestGraph } from './contribution-store.js'

/**
 * The project's own (intrinsic) contribution id — one per topology
 * (contribution_source.attachment_id IS NULL). This is the authored layer; it is
 * NOT a data source. See db-native-persistence.md.
 */
const INTRINSIC_SOURCE = 'intrinsic'

import { TopologySourcesService } from './topology-sources.js'

/** Bare topology row — no content_json column post-migration-010. */
interface TopologyRow {
  id: string
  name: string
  share_token: string | null
  created_at: number
  updated_at: number
}

function rowToTopology(row: TopologyRow): Topology {
  return {
    id: row.id,
    name: row.name,
    // No contentJson / mappingJson / source pointers on the shell: the authored
    // graph is the intrinsic contribution, the mapping is derived from bindings,
    // and sources live in the m2m `topology_data_sources` table.
    shareToken: row.share_token ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/**
 * Bump when the resolve/layout algorithms change shape, so persisted
 * `topology_resolved_graph` artifacts built by an older version are treated as
 * stale and recomputed without a manual purge.
 */
const RESOLVER_VERSION = 2

/**
 * Map-aware JSON round-trip. `LayoutResult` / `ResolvedLayout` are Map-heavy
 * (nodes/links/ports/subgraphs are `Map`s) and `JSON.stringify` silently turns a
 * Map into `{}`, so the persisted artifact would be corrupt. These encode a Map
 * as `{__map__: [...entries]}` recursively (the replacer/reviver visit every
 * value), so arbitrarily-nested Maps survive the round-trip.
 */
const MAP_TAG = '__map__'
function stringifyWithMaps(value: unknown): string {
  return JSON.stringify(value, (_k, v) =>
    v instanceof Map ? { [MAP_TAG]: Array.from(v.entries()) } : v,
  )
}
function parseWithMaps<T>(text: string): T {
  return JSON.parse(text, (_k, v) => {
    // Only the encoder's exact shape `{ __map__: [...] }` (a single key) is a
    // tagged Map — so a real object that merely *has* a `__map__` array property
    // is not misread as a Map.
    if (
      v &&
      typeof v === 'object' &&
      !Array.isArray(v) &&
      Object.keys(v).length === 1 &&
      Array.isArray((v as Record<string, unknown>)[MAP_TAG])
    ) {
      return new Map((v as Record<string, [unknown, unknown][]>)[MAP_TAG])
    }
    return v
  }) as T
}

/** Persisted resolved-graph artifact row (Phase 3 materialization). */
interface ResolvedGraphRow {
  topology_id: string
  graph_json: string
  layout_json: string | null
  icon_dimensions_json: string | null
  built_revision: number
  resolver_version: number
  computed_at: number
}

/** Whether an identity carries at least one usable node match key. */
function hasAnyIdentityKey(identity: Identity | undefined): boolean {
  if (!identity) return false
  return Boolean(
    identity.mgmtIp ||
      identity.chassisId ||
      identity.sysName ||
      (identity.vendorIds && Object.keys(identity.vendorIds).length > 0),
  )
}

/** Two node identities match if they share any node key (mgmtIp/chassisId/sysName/vendorId). */
function identitiesMatch(a: Identity | undefined, b: Identity | undefined): boolean {
  if (!a || !b) return false
  if (a.mgmtIp && a.mgmtIp === b.mgmtIp) return true
  if (a.chassisId && a.chassisId === b.chassisId) return true
  if (a.sysName && a.sysName === b.sysName) return true
  if (a.vendorIds && b.vendorIds) {
    for (const [k, v] of Object.entries(a.vendorIds)) {
      if (v && b.vendorIds[k] === v) return true
    }
  }
  return false
}

/**
 * A pure-overlay node carries identity but makes NO authored claim whatsoever.
 * Such a node contributes nothing to resolve, so it's safe to drop after a
 * binding is cleared — avoids accumulating empty overlay rows. Conservative by
 * construction: ANY authored field present means we keep the node, so clearing a
 * binding can never delete unrelated authored content. Only `id` + `label:''` +
 * `identity` may remain for it to be dropped.
 */
function isPureEmptyOverlay(n: Node): boolean {
  const label = Array.isArray(n.label) ? n.label.join('') : (n.label ?? '')
  // Allow-list the fields a bare binding overlay legitimately carries; any other
  // populated property keeps the node.
  const ALLOWED = new Set(['id', 'label', 'identity'])
  for (const [k, v] of Object.entries(n)) {
    if (ALLOWED.has(k)) continue
    if (Array.isArray(v) ? v.length > 0 : v !== undefined && v !== null) return false
  }
  return label.trim() === ''
}

/**
 * A port that carries no human claim — safe to drop after its binding is
 * cleared. Conservative: ANY populated field beyond id/identity/empty-connectors
 * (including a non-empty label) keeps the port, so clearing a binding can't
 * delete a port the user authored a label or any other detail on.
 */
function isPureEmptyOverlayPort(p: NodePort): boolean {
  const label = Array.isArray(p.label) ? p.label.join('') : (p.label ?? '')
  const ALLOWED = new Set(['id', 'label', 'identity', 'connectors'])
  for (const [k, v] of Object.entries(p)) {
    if (ALLOWED.has(k)) continue
    if (Array.isArray(v) ? v.length > 0 : v !== undefined && v !== null) return false
  }
  return label.trim() === '' && (p.connectors?.length ?? 0) === 0
}

/**
 * One-time backfill merge: a topology may have had several legacy Manual sources
 * (#370). Concatenate their authored graphs into the single intrinsic contribution —
 * dedup nodes/subgraphs/terminations by id (first wins), append links/exclusions,
 * concat topology-default attachments. Best-effort; only runs once on first read.
 */
function mergeAuthoredGraphs(graphs: NetworkGraph[]): NetworkGraph {
  // Keep the first graph's graph-level fields (version/name/description/settings/pins);
  // the structural arrays are merged below.
  const out: NetworkGraph = { ...(graphs[0] ?? { version: '1' }), nodes: [], links: [] }
  out.subgraphs = undefined
  out.terminations = undefined
  out.exclusions = undefined
  out.attachments = undefined
  const seenNode = new Set<string>()
  const seenLink = new Set<string>()
  const seenSub = new Set<string>()
  const seenTerm = new Set<string>()
  const seenAttKey = new Set<string>()
  const subgraphs: Subgraph[] = []
  const terminations: Termination[] = []
  const exclusions: NetworkGraph['exclusions'] = []
  const attachments: Attachment[] = []
  for (const g of graphs) {
    for (const n of g.nodes ?? []) {
      if (seenNode.has(n.id)) continue
      seenNode.add(n.id)
      out.nodes.push(n)
    }
    for (const l of g.links ?? []) {
      // Dedup by id (DB local_id is unique); id-less links can't collide, always append.
      if (l.id != null) {
        if (seenLink.has(l.id)) continue
        seenLink.add(l.id)
      }
      out.links.push(l)
    }
    for (const sg of g.subgraphs ?? []) {
      if (seenSub.has(sg.id)) continue
      seenSub.add(sg.id)
      subgraphs.push(sg)
    }
    for (const t of g.terminations ?? []) {
      if (seenTerm.has(t.id)) continue
      seenTerm.add(t.id)
      terminations.push(t)
    }
    if (g.exclusions?.length) exclusions.push(...g.exclusions)
    // topology-default attachments: one slot per key (first wins).
    for (const a of g.attachments ?? []) {
      const key = attachmentKey(a)
      if (seenAttKey.has(key)) continue
      seenAttKey.add(key)
      attachments.push(a)
    }
  }
  if (subgraphs.length) out.subgraphs = subgraphs
  if (terminations.length) out.terminations = terminations
  if (exclusions.length) out.exclusions = exclusions
  if (attachments.length) out.attachments = attachments
  return out
}

/** Whether a port identity carries at least one usable port match key. */
function hasAnyPortIdentityKey(identity: Identity | undefined): boolean {
  if (!identity) return false
  return Boolean(identity.ifName || identity.ifIndex !== undefined || identity.mac)
}

/** Two port identities match if they share a port key (ifName / ifIndex / mac). */
function portIdentitiesMatch(a: Identity | undefined, b: Identity | undefined): boolean {
  if (!a || !b) return false
  if (a.ifName && a.ifName === b.ifName) return true
  if (a.ifIndex !== undefined && a.ifIndex === b.ifIndex) return true
  if (a.mac && a.mac === b.mac) return true
  return false
}

/** `[]` → `undefined` so an emptied attachment list drops the key entirely. */
function emptyToUndef<T>(arr: T[]): T[] | undefined {
  return arr.length > 0 ? arr : undefined
}

/** A node host binding to write onto the authored overlay. */
interface NodeBindingDesired {
  nodeId: string
  identity: Identity | undefined
  hostId?: string
  hostName?: string
}

/** A link interface binding to write onto the monitored port. */
interface LinkBindingDesired {
  monitoredNodeId: string
  nodeIdentity: Identity | undefined
  portId: string
  portIdentity: Identity | undefined
  interfaceName?: string
  bandwidth?: number
}

/**
 * Resolved icon dimensions for rendering, keyed by URL.
 */
export type ResolvedIconDimensions = Map<string, IconDimensions>

/**
 * Error information when a topology fails to parse or layout
 */
interface TopologyParseError {
  id: string
  name: string
  phase: 'parse' | 'layout'
  message: string
  timestamp: number
}

/**
 * Parsed topology with layout and metrics ready for rendering
 */
export interface ParsedTopology {
  id: string
  name: string
  graph: NetworkGraph
  layout: LayoutResult
  resolved?: ResolvedLayout
  iconDimensions: ResolvedIconDimensions
  metrics: MetricsData
  topologySourceId?: string
  metricsSourceId?: string
  mapping?: MetricsMapping
}

/**
 * Parse YAML content to NetworkGraph
 * Supports single file or multi-file hierarchical topologies
 */
export async function parseYamlToNetworkGraph(
  yamlContent: string,
  additionalFiles?: Map<string, string>,
): Promise<NetworkGraph> {
  // Check if content has file references (hierarchical)
  const hasFileRefs = yamlContent.includes('file:')

  if (hasFileRefs && additionalFiles) {
    // Parse hierarchically using memory resolver
    const fileMap = new Map<string, string>([['main.yaml', yamlContent], ...additionalFiles])
    const resolver = createMemoryFileResolver(fileMap, '')
    const parser = new HierarchicalParser(resolver)
    const result = await parser.parse(yamlContent, 'main.yaml')
    return result.graph
  }

  // Single file, parse directly
  const parser = new YamlParser()
  const result = parser.parse(yamlContent)
  return result.graph
}

export class TopologyService {
  private db: Database
  private cache: Map<string, ParsedTopology> = new Map()
  private renderCache: Map<string, object> = new Map()
  private errorCache: Map<string, TopologyParseError> = new Map()
  private topologySources: TopologySourcesService

  constructor() {
    this.db = getDatabase()
    this.topologySources = new TopologySourcesService()
  }

  /**
   * Get all topologies from the database.
   */
  list(): Topology[] {
    const rows = this.db.query('SELECT * FROM topologies ORDER BY name ASC').all() as TopologyRow[]
    return rows.map(rowToTopology)
  }

  /**
   * Get a single topology by ID.
   */
  get(id: string): Topology | null {
    const row = this.db.query('SELECT * FROM topologies WHERE id = ?').get(id) as
      | TopologyRow
      | undefined
    return row ? rowToTopology(row) : null
  }

  /**
   * Get a topology by name.
   */
  getByName(name: string): Topology | null {
    const row = this.db.query('SELECT * FROM topologies WHERE name = ?').get(name) as
      | TopologyRow
      | undefined
    return row ? rowToTopology(row) : null
  }

  /**
   * Create a new topology shell. No sources, no content. Callers attach
   * Manual / NetBox / SNMP via `POST /topologies/:id/sources` afterwards.
   * Keeping create() to the topology shell only mirrors the structure:
   * Topology owns name + mapping + share state; sources own graph content.
   */
  async create({ name }: TopologyInput): Promise<Topology> {
    const id = await generateId()
    const now = timestamp()

    // Shell only: sources are attached via topology_data_sources; the mapping
    // lives as metrics-binding attachments on the authored overlay.
    this.db
      .prepare('INSERT INTO topologies (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)')
      .run(id, name, now, now)

    this.clearCacheEntry(id)

    const created = this.get(id)
    if (!created) throw new Error('Topology disappeared immediately after creation')
    return created
  }

  /**
   * Update a topology 's shell fields (name / mapping / source pointers).
   * Graph content is NOT updatable through this endpoint — it lives in
   * source observations and changes via
   * `POST /topologies/:id/sources/:sid/observation`.
   */
  async update(id: string, input: Partial<TopologyInput>): Promise<Topology | null> {
    const existing = this.get(id)
    if (!existing) {
      return null
    }

    const updates: string[] = []
    const values: (string | number | null)[] = []

    if (input.name !== undefined) {
      updates.push('name = ?')
      values.push(input.name)
    }
    // Source pointers + mapping_json columns are gone: sources live in
    // topology_data_sources; the mapping is set via updateMapping (bindings).

    if (updates.length > 0) {
      updates.push('updated_at = ?')
      values.push(timestamp())
      values.push(id)
      this.db.query(`UPDATE topologies SET ${updates.join(', ')} WHERE id = ?`).run(...values)
    }

    this.clearCacheEntry(id)

    return this.get(id)
  }

  /**
   * Update the metrics mapping for a topology. The mapping is the single source
   * of truth as identity-keyed `metrics-binding` attachments on the authored
   * overlay (node host bindings on the node, link interface bindings on the
   * monitored port), folded by `resolve()` so they follow re-sync. There is no
   * `mapping_json` residual — `reconcileBindings` makes the overlay hold EXACTLY
   * the given mapping for this metrics source (so clearing an entry removes it).
   */
  async updateMapping(id: string, mapping: MetricsMapping): Promise<Topology | null> {
    const existing = this.get(id)
    if (!existing) return null

    const sourceId = this.metricsSourceIdFor(id)
    const parsed = await this.getParsed(id)
    // Refuse to reconcile against an unresolved graph: with no node/port to
    // anchor to, EVERY existing binding for the source would be stripped. A
    // transient resolve failure must not wipe bindings.
    if (!parsed) {
      throw new Error(
        'cannot resolve topology graph; refusing to update mapping (would drop bindings)',
      )
    }
    // Without a metrics source there's nowhere to bind (and nothing to poll).
    if (!sourceId) return this.get(id)

    const { desired: nodeDesired, skipped: nodeSkipped } = this.buildNodeBindingDesired(
      parsed.graph,
      mapping,
    )
    const { desired: linkDesired, skipped: linkSkipped } = this.buildLinkBindingDesired(
      parsed.graph,
      mapping,
    )
    if (nodeSkipped > 0 || linkSkipped > 0) {
      // Surface dropped bindings rather than silently losing them (no-silent-caps):
      // an element with no identity (node) or no port identity (link) can't be
      // anchored so the binding would create a duplicate overlay instead of
      // folding. These need source-emitted identity (Phase 1) to bind.
      console.warn(
        `[Mapping] topology ${id}: skipped ${nodeSkipped} node + ${linkSkipped} link binding(s) lacking identity to anchor`,
      )
    }
    await this.reconcileBindings(id, sourceId, nodeDesired, linkDesired)
    return this.get(id)
  }

  /**
   * Node host bindings to write. Only nodes with a usable identity are
   * anchorable — an identity-less authored overlay can't fold onto the observed
   * node (it gets a separate per-source fallback cluster), so it would create a
   * duplicate rather than bind. Such entries are skipped and counted.
   */
  private buildNodeBindingDesired(
    graph: NetworkGraph,
    mapping: MetricsMapping,
  ): { desired: NodeBindingDesired[]; skipped: number } {
    const identityByNodeId = new Map<string, Identity | undefined>(
      graph.nodes.map((n) => [n.id, n.identity]),
    )
    const desired: NodeBindingDesired[] = []
    let skipped = 0
    for (const [nodeId, nm] of Object.entries(mapping.nodes ?? {})) {
      if (!nm.hostId && !nm.hostName) continue
      const identity = identityByNodeId.get(nodeId)
      if (!hasAnyIdentityKey(identity)) {
        skipped++
        continue
      }
      desired.push({ nodeId, identity, hostId: nm.hostId, hostName: nm.hostName })
    }
    return { desired, skipped }
  }

  /**
   * Link interface bindings to write: resolve each link mapping to its monitored
   * node + port. Both the node identity AND the port identity (ifName/ifIndex/mac)
   * are required to anchor the binding so it folds onto the link's port — a
   * port-identity-less link binding can't bind (staged behind Phase 1 port
   * identity) and is skipped + counted. Link key matches the rest of the server.
   */
  private buildLinkBindingDesired(
    graph: NetworkGraph,
    mapping: MetricsMapping,
  ): { desired: LinkBindingDesired[]; skipped: number } {
    const identityByNodeId = new Map<string, Identity | undefined>(
      graph.nodes.map((n) => [n.id, n.identity]),
    )
    const nodeById = new Map(graph.nodes.map((n) => [n.id, n]))
    const desired: LinkBindingDesired[] = []
    let skipped = 0
    graph.links.forEach((link, i) => {
      const lm = mapping.links?.[link.id || `link-${i}`]
      if (!lm?.monitoredNodeId) return
      const ep = [link.from, link.to].find((e) => e.node === lm.monitoredNodeId)
      if (!ep) {
        skipped++
        return
      }
      const nodeIdentity = identityByNodeId.get(lm.monitoredNodeId)
      const port = nodeById.get(lm.monitoredNodeId)?.ports?.find((p) => p.id === ep.port)
      if (!hasAnyIdentityKey(nodeIdentity) || !hasAnyPortIdentityKey(port?.identity)) {
        skipped++
        return
      }
      desired.push({
        monitoredNodeId: lm.monitoredNodeId,
        nodeIdentity,
        portId: ep.port,
        portIdentity: port?.identity,
        interfaceName: lm.interface ?? port?.interfaceName ?? port?.identity?.ifName,
        bandwidth: lm.bandwidth,
      })
    })
    return { desired, skipped }
  }

  /** The metrics data source id for a topology (first m2m purpose='metrics'). */
  private metricsSourceIdFor(topologyId: string): string | undefined {
    return this.topologySources.listByPurpose(topologyId, 'metrics')[0]?.dataSourceId
  }

  /**
   * The structure (topology) data source id — first m2m purpose='topology'
   * source. Derived from the m2m table now that the legacy
   * `topologies.topology_source_id` column is gone; kept on `ParsedTopology` for
   * the /context response shape (the client doesn't read it today).
   */
  private topologySourceIdFor(topologyId: string): string | undefined {
    return this.topologySources.listByPurpose(topologyId, 'topology')[0]?.dataSourceId
  }

  /**
   * Reconcile this metrics source's bindings on the authored overlay so it holds
   * EXACTLY the given node + link bindings: strip every existing
   * `metrics-binding:${sourceId}` attachment from all nodes AND ports, then
   * re-add for each desired node (anchored by node identity) and link (anchored
   * by node + port identity on the monitored port). Empty overlay ports/nodes
   * left with no remaining human claim are dropped. One authored-graph pass.
   */
  private async reconcileBindings(
    topologyId: string,
    sourceId: string,
    nodeDesired: NodeBindingDesired[],
    linkDesired: LinkBindingDesired[],
  ): Promise<void> {
    const topology = this.get(topologyId)
    const authored = this.readIntrinsicGraph(topologyId) ?? {
      version: '1' as const,
      name: topology?.name ?? 'Manual',
      nodes: [],
      links: [],
    }
    const key = `metrics-binding:${sourceId}`
    const withoutKey = (atts: Attachment[] | undefined): Attachment[] =>
      (atts ?? []).filter((a) => attachmentKey(a) !== key)

    // Strip this source's binding from every node and every port.
    let nodes: Node[] = authored.nodes.map((n) => {
      const next: Node = { ...n, attachments: emptyToUndef(withoutKey(n.attachments)) }
      if (n.ports) {
        next.ports = n.ports.map((p) => ({
          ...p,
          attachments: emptyToUndef(withoutKey(p.attachments)),
        }))
      }
      return next
    })

    // Find (or index) an authored node by node identity, falling back to id.
    const findNode = (identity: Identity | undefined, nodeId: string): number =>
      nodes.findIndex((n) =>
        identity && hasAnyIdentityKey(identity)
          ? identitiesMatch(n.identity, identity)
          : n.id === nodeId,
      )

    // Node host bindings.
    for (const b of nodeDesired) {
      const attachment: MetricsBindingAttachment = {
        kind: 'metrics-binding',
        sourceId,
        ...(b.hostId ? { hostId: b.hostId } : {}),
        ...(b.hostName ? { hostName: b.hostName } : {}),
      }
      const idx = findNode(b.identity, b.nodeId)
      if (idx >= 0) {
        const cur = nodes[idx]
        if (!cur) continue
        nodes[idx] = { ...cur, attachments: [...withoutKey(cur.attachments), attachment] }
      } else {
        nodes.push({
          id: b.nodeId,
          label: '',
          ...(b.identity ? { identity: b.identity } : {}),
          attachments: [attachment],
        })
      }
    }

    // Link interface bindings (on the monitored port).
    for (const b of linkDesired) {
      const attachment: MetricsBindingAttachment = {
        kind: 'metrics-binding',
        sourceId,
        ...(b.portIdentity ? { interfaceIdentity: b.portIdentity } : {}),
        ...(b.interfaceName ? { interfaceName: b.interfaceName } : {}),
        ...(b.bandwidth !== undefined ? { bandwidth: b.bandwidth } : {}),
      }
      let idx = findNode(b.nodeIdentity, b.monitoredNodeId)
      if (idx < 0) {
        nodes.push({
          id: b.monitoredNodeId,
          label: '',
          ...(b.nodeIdentity ? { identity: b.nodeIdentity } : {}),
          ports: [],
        })
        idx = nodes.length - 1
      }
      const node = nodes[idx]
      if (!node) continue
      const ports = [...(node.ports ?? [])]
      const portIdx = ports.findIndex((p) =>
        b.portIdentity ? portIdentitiesMatch(p.identity, b.portIdentity) : p.id === b.portId,
      )
      if (portIdx >= 0) {
        const cur = ports[portIdx]
        if (cur)
          ports[portIdx] = { ...cur, attachments: [...withoutKey(cur.attachments), attachment] }
      } else {
        ports.push({
          id: b.portId,
          label: b.interfaceName ?? '',
          connectors: [],
          ...(b.portIdentity ? { identity: b.portIdentity } : {}),
          attachments: [attachment],
        })
      }
      nodes[idx] = { ...node, ports }
    }

    // Drop empty overlay ports, then empty overlay nodes (no remaining claim).
    nodes = nodes.map((n) => {
      if (!n.ports) return n
      const ports = n.ports.filter((p) => !isPureEmptyOverlayPort(p))
      const next = { ...n }
      if (ports.length > 0) next.ports = ports
      else delete next.ports
      return next
    })
    nodes = nodes.filter((n) => !isPureEmptyOverlay(n))

    // Records a new authored observation for this topology + invalidates it.
    await this.writeIntrinsicGraph(topologyId, { ...authored, nodes })
  }

  /**
   * One-shot migration of the legacy `mapping_json` blob into identity-keyed
   * metrics bindings, then DROP the column (no-backcompat). Runs at startup,
   * guarded by a `settings` flag. Best-effort and audited: a topology that
   * fails to resolve is logged and the column is NOT dropped this run (retry
   * next start) so no mapping is lost before it's migrated.
   *
   * The column is created by migration 001 and can't be removed by a SQL
   * migration (those run before this code), so the drop is imperative here —
   * after the data is safely in bindings.
   */
  async backfillMetricsBindings(): Promise<void> {
    const flag = this.db
      .query("SELECT value FROM settings WHERE key = 'metrics_bindings_backfilled'")
      .get() as { value: string } | undefined
    if (flag?.value === '1') return

    // If the column is already gone (e.g. a prior run dropped it but the flag
    // write was lost), there's nothing to migrate — just mark done.
    if (!this.columnExists('topologies', 'mapping_json')) {
      this.db
        .query(
          "INSERT OR REPLACE INTO settings (key, value) VALUES ('metrics_bindings_backfilled', '1')",
        )
        .run()
      return
    }

    const rows = this.db
      .query(
        "SELECT id, mapping_json FROM topologies WHERE mapping_json IS NOT NULL AND mapping_json != ''",
      )
      .all() as { id: string; mapping_json: string }[]
    let migrated = 0
    let failed = 0
    let lostEntries = 0
    for (const row of rows) {
      try {
        const mapping = JSON.parse(row.mapping_json) as MetricsMapping
        const originalCount =
          Object.keys(mapping.nodes ?? {}).length + Object.keys(mapping.links ?? {}).length
        // Re-apply through updateMapping → writes node + link bindings.
        await this.updateMapping(row.id, mapping)
        migrated++
        // Audit coverage: entries that couldn't be anchored (no metrics source,
        // or no node/port identity) don't survive as bindings. Under the project's
        // no-backcompat stance these are intentionally dropped — but log them so
        // it's never a SILENT loss.
        const after = (await this.getParsed(row.id))?.mapping
        const migratedCount =
          Object.keys(after?.nodes ?? {}).length + Object.keys(after?.links ?? {}).length
        if (migratedCount < originalCount) {
          const lost = originalCount - migratedCount
          lostEntries += lost
          console.warn(
            `[Backfill] topology ${row.id}: ${lost}/${originalCount} mapping entr(ies) could not be migrated to a binding (no metrics source or no identity to anchor) — dropped per no-backcompat`,
          )
        }
      } catch (err) {
        failed++
        console.warn(
          `[Backfill] metrics bindings for topology ${row.id}:`,
          err instanceof Error ? err.message : err,
        )
      }
    }

    if (failed === 0) {
      // Everything migrated → drop the column. Mark done ONLY if the drop
      // actually succeeded, so a failed drop retries next startup (re-running the
      // idempotent migration) instead of being silently left in place forever.
      let dropped = false
      try {
        this.db.query('ALTER TABLE topologies DROP COLUMN mapping_json').run()
        dropped = true
      } catch (err) {
        console.warn(
          '[Backfill] could not drop mapping_json column (will retry next start):',
          err instanceof Error ? err.message : err,
        )
      }
      if (dropped) {
        this.db
          .query(
            "INSERT OR REPLACE INTO settings (key, value) VALUES ('metrics_bindings_backfilled', '1')",
          )
          .run()
      }
    }
    if (migrated > 0 || failed > 0) {
      console.log(
        `[Backfill] metrics mapping → bindings: ${migrated} topolog(ies) migrated, ${failed} deferred, ${lostEntries} entr(ies) dropped (no-backcompat)`,
      )
    }
  }

  /**
   * One-shot retirement of the legacy `type='manual'` data source. The project's
   * authored graph is the intrinsic contribution now (stage 1); the Manual data
   * source is residue (settled by the canonical model — no special "Manual"
   * vocabulary). Runs at startup, guarded by a `settings` flag.
   *
   * Per topology: if the intrinsic is still empty, salvage it from the Manual
   * source's last graph snapshot (merging several legacy Manuals, #370) and ingest
   * it into the intrinsic FIRST — so no authored graph is lost. Then delete every
   * `type='manual'` data source; the FK cascade drops its `topology_data_sources`
   * attachments, observations, and any contribution rows.
   */
  retireManualSources(): void {
    const flag = this.db.query("SELECT value FROM settings WHERE key = 'manual_retired'").get() as
      | { value: string }
      | undefined
    if (flag?.value === '1') return

    const manualRows = this.db.query("SELECT id FROM data_sources WHERE type = 'manual'").all() as {
      id: string
    }[]
    if (manualRows.length === 0) {
      this.db
        .query("INSERT OR REPLACE INTO settings (key, value) VALUES ('manual_retired', '1')")
        .run()
      return
    }

    // Salvage authored graphs into the intrinsic before deleting Manual sources.
    const topoIds = this.db.query('SELECT DISTINCT id FROM topologies').all() as { id: string }[]
    let salvaged = 0
    for (const { id: topologyId } of topoIds) {
      if (buildGraph(topologyId, INTRINSIC_SOURCE, this.db)) continue // intrinsic already populated
      const legacy = this.readLegacyManualGraph(topologyId)
      if (!legacy) continue
      ingestGraph(topologyId, INTRINSIC_SOURCE, legacy, { attachmentId: null }, this.db)
      salvaged++
    }

    const deleted = this.db.query("DELETE FROM data_sources WHERE type = 'manual'").run()
    this.db
      .query("INSERT OR REPLACE INTO settings (key, value) VALUES ('manual_retired', '1')")
      .run()
    console.log(
      `[Migration] Retired Manual data source: ${deleted.changes} row(s) dropped, ${salvaged} intrinsic graph(s) salvaged from legacy Manual snapshots.`,
    )
  }

  /**
   * Read the pre-cutover authored graph from a topology's legacy Manual source
   * observation(s) — merged when several Manuals existed (#370). Salvage source
   * for `retireManualSources`; nothing else should call it.
   */
  private readLegacyManualGraph(topologyId: string): NetworkGraph | null {
    const manualSources = this.db
      .query(
        `SELECT ds.id AS id FROM topology_data_sources tds
         JOIN data_sources ds ON ds.id = tds.data_source_id
         WHERE tds.topology_id = ? AND ds.type = 'manual'
         ORDER BY ds.created_at ASC, ds.id ASC`,
      )
      .all(topologyId) as { id: string }[]
    const graphs: NetworkGraph[] = []
    for (const { id } of manualSources) {
      const row = this.db
        .query(
          `SELECT graph_json FROM topology_observations
           WHERE topology_id = ? AND source_id = ? AND graph_json IS NOT NULL
           ORDER BY captured_at DESC, rowid DESC LIMIT 1`,
        )
        .get(topologyId, id) as { graph_json: string } | undefined
      if (!row) continue
      try {
        graphs.push(JSON.parse(row.graph_json) as NetworkGraph)
      } catch {
        // skip a corrupt legacy blob
      }
    }
    if (graphs.length === 0) return null
    if (graphs.length === 1) return graphs[0] ?? null
    return mergeAuthoredGraphs(graphs)
  }

  /** Whether a column exists on a table (PRAGMA table_info). */
  private columnExists(table: string, column: string): boolean {
    try {
      const cols = this.db.query(`PRAGMA table_info(${table})`).all() as { name: string }[]
      return cols.some((c) => c.name === column)
    } catch {
      return false
    }
  }

  /**
   * Delete a topology
   */
  delete(id: string): boolean {
    const result = this.db.query('DELETE FROM topologies WHERE id = ?').run(id)
    this.cache.delete(id)
    this.renderCache.delete(id)
    return result.changes > 0
  }

  /**
   * Enable sharing by generating a token
   */
  async share(id: string): Promise<string | null> {
    const existing = this.get(id)
    if (!existing) return null

    const { nanoid } = await import('nanoid')
    const token = nanoid(24)
    this.db
      .query('UPDATE topologies SET share_token = ?, updated_at = ? WHERE id = ?')
      .run(token, timestamp(), id)
    return token
  }

  /**
   * Disable sharing by clearing the token
   */
  unshare(id: string): boolean {
    const existing = this.get(id)
    if (!existing) return false

    this.db
      .query('UPDATE topologies SET share_token = NULL, updated_at = ? WHERE id = ?')
      .run(timestamp(), id)
    return true
  }

  /**
   * Get a topology by its share token
   */
  getByShareToken(token: string): Topology | null {
    const row = this.db.query('SELECT * FROM topologies WHERE share_token = ?').get(token) as
      | TopologyRow
      | undefined
    return row ? rowToTopology(row) : null
  }

  /**
   * Get a parsed topology ready for rendering
   * Uses cache if available
   */
  async getParsed(id: string): Promise<ParsedTopology | null> {
    // Check cache first
    const cache = this.cache.get(id)
    if (cache) {
      return cache
    }

    // If there's a cached error, skip re-parse (cleared on content update)
    if (this.errorCache.has(id)) {
      return null
    }

    const topology = this.get(id)
    if (!topology) {
      return null
    }

    // L2: a persisted resolved-graph artifact (survives restart / RAM eviction).
    // Serve it only when it was built from the CURRENT composition revision and
    // resolver version — otherwise it's stale and we recompute. Fully guarded:
    // any read/parse failure falls through to a fresh resolve, so the artifact
    // can never break a read (worst case = current behaviour).
    const fromArtifact = this.tryHydrateArtifact(topology)
    if (fromArtifact) {
      this.cache.set(id, fromArtifact)
      this.errorCache.delete(id)
      return fromArtifact
    }

    // Capture the revision BEFORE the async resolve. If an input changes during
    // parse (a concurrent bump), this captured value won't match the new
    // current revision, so the artifact we persist is immediately considered
    // stale rather than served as falsely-fresh.
    const revisionAtStart = this.compositionRevisionOf(id)
    try {
      const parsed = await this.parseTopology(topology)
      this.errorCache.delete(id)
      // If an input changed DURING the async resolve, this result is already
      // stale: don't poison the RAM cache or persist it as fresh. Return it to
      // the current caller (it asked for "now"), but the next read re-resolves.
      if (this.compositionRevisionOf(id) === revisionAtStart) {
        this.cache.set(id, parsed)
        this.writeResolvedArtifact(topology, parsed, revisionAtStart)
      }
      return parsed
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      const phase = message.includes('Invalid NetworkGraph') ? 'parse' : 'layout'
      // Only cache the failure if the inputs haven't changed since the parse
      // started. A concurrent edit (revision bump) may have already fixed the
      // cause; caching a stale error would make later reads short-circuit to
      // null until the next invalidation.
      if (this.compositionRevisionOf(id) === revisionAtStart) {
        this.errorCache.set(id, {
          id,
          name: topology.name,
          phase,
          message,
          timestamp: Date.now(),
        })
      }
      console.error(
        `[TopologyService] Failed to parse topology "${topology.name}" (${id}):`,
        message,
      )
      return null
    }
  }

  /**
   * Get a parsed topology by name
   */
  async getParsedByName(name: string): Promise<ParsedTopology | null> {
    const topology = this.getByName(name)
    if (!topology) {
      return null
    }
    return this.getParsed(topology.id)
  }

  /**
   * Parse a topology and generate layout.
   *
   * The resolver runs here over two DB-native pools, both read from the
   * contribution store (`contribution_*`):
   *   - the intrinsic contribution (`attachment_id IS NULL`) — the project's
   *     authored graph — fills the `authored` slot (top priority);
   *   - every attached external source's contribution (`attachment_id NOT NULL`)
   *     becomes a `SnapshotEntry` in `snapshots`.
   *
   * With no authored content, `authored` is an empty graph — the diagram is
   * whatever the external sources produced.
   */
  private async parseTopology(topology: Topology): Promise<ParsedTopology> {
    // The authored graph is the intrinsic contribution (DB-native store), folded as
    // resolve()'s top-priority contribution. Absent → empty. (`readIntrinsicGraph`
    // lazily backfills from a legacy Manual observation the first time.)
    const authored: NetworkGraph = this.readIntrinsicGraph(topology.id) ?? {
      version: '1',
      name: topology.name,
      nodes: [],
      links: [],
    }
    // Source priority feeds the resolver's field merge: when two sources
    // observe the same device, the higher-priority source wins each field it
    // holds. Mirrors `topology_data_sources.priority`. The Manual/authored
    // contribution always outranks these (handled inside resolve()).
    const priorityBySource = new Map<string, number>()
    for (const tds of this.topologySources.listByTopology(topology.id)) {
      priorityBySource.set(tds.dataSourceId, tds.priority)
    }
    const snapshots = this.readObservedSnapshots(topology.id, priorityBySource)
    const graph = resolveObservations(authored, snapshots)

    // Resolve icon dimensions for URL icons (used by renderer for
    // aspect-preserving sizing).
    let iconDimensions: ResolvedIconDimensions = new Map()
    const iconUrls = collectIconUrls(graph)
    if (iconUrls.length > 0) {
      try {
        iconDimensions = await resolveAllIconDimensions(iconUrls)
      } catch (err) {
        console.warn('Failed to resolve icon dimensions:', err)
      }
    }

    const { resolved, layout: layoutResult } = await computeNetworkLayout(graph)
    const metrics = this.createEmptyMetrics(graph)
    const mapping = this.buildMapping(topology.id, graph)

    return {
      id: topology.id,
      name: topology.name,
      graph,
      layout: layoutResult,
      resolved,
      iconDimensions,
      metrics,
      topologySourceId: this.topologySourceIdFor(topology.id),
      metricsSourceId: this.metricsSourceIdFor(topology.id),
      mapping,
    }
  }

  /**
   * The observed snapshots feeding `resolve()` — one per external source, read
   * DB-native from the contribution store (NOT the audit log). Each external
   * source's latest graph is its `contribution_source` row (attachment_id NOT
   * NULL); `buildGraph` projects the decomposed rows back to a NetworkGraph.
   *
   * Properties this inherits from how contributions are written
   * (`ObservationsService.materializeContribution`):
   *   - failed scans are never ingested, so a contribution is always last-good
   *     (C7 — failed never retracts);
   *   - detaching a source cascades its contribution away, so only currently
   *     attached sources appear (the `priorityBySource` guard is a belt-and-braces
   *     filter on top of that).
   */
  private readObservedSnapshots(
    topologyId: string,
    priorityBySource: Map<string, number>,
  ): SnapshotEntry[] {
    this.backfillObservedContributions(topologyId)
    const rows = this.db
      .query(
        `SELECT source_id, last_status, last_ok_at
         FROM contribution_source
         WHERE topology_id = ? AND attachment_id IS NOT NULL`,
      )
      .all(topologyId) as {
      source_id: string
      last_status: string | null
      last_ok_at: number | null
    }[]
    const snapshots: SnapshotEntry[] = []
    for (const r of rows) {
      if (!priorityBySource.has(r.source_id)) continue
      const graph = buildGraph(topologyId, r.source_id, this.db)
      if (!graph) continue
      snapshots.push({
        sourceId: r.source_id,
        capturedAt: r.last_ok_at ?? 0,
        status: (r.last_status as SnapshotEntry['status']) ?? 'ok',
        graph,
        priority: priorityBySource.get(r.source_id) ?? 0,
      })
    }
    return snapshots
  }

  /**
   * One-time lazy backfill of observed contributions from the legacy audit log.
   *
   * A source attached AND synced before the stage-3 cutover has its latest graph
   * in `topology_observations` but no `contribution_source` row yet. Without this,
   * its nodes would vanish from the diagram until the next sync — and a manual-mode
   * source might never auto-resync. So for each attached topology source that lacks
   * a contribution, materialize its latest non-failed audit snapshot (mirrors the
   * intrinsic's lazy backfill in `readIntrinsicGraph`). Idempotent: once a contribution
   * exists, the source is skipped, so this degrades to a cheap existence check.
   *
   * GUARD on `lastSyncedAt != null` — the "data exists IFF attached AND synced"
   * invariant. A freshly (re-)attached source (incl. after a bulk source replace)
   * has `lastSyncedAt = null`, so its stale pre-detach audit rows are NOT revived:
   * a fresh attachment shows nothing until you Sync. Only a genuinely-synced source
   * (pre-cutover) is backfilled.
   *
   * Scoped to the CURRENT attachment's lifecycle: only audit captured at/after the
   * attach row's `createdAt` is eligible. This closes the one residual resurrection
   * path — a fresh re-attach whose first sync FAILS (which still stamps
   * `lastSyncedAt` but writes no contribution): the stale pre-detach audit predates
   * the new attach row, so it's excluded.
   */
  private backfillObservedContributions(topologyId: string): void {
    const have = new Set(
      (
        this.db
          .query(
            'SELECT source_id FROM contribution_source WHERE topology_id = ? AND attachment_id IS NOT NULL',
          )
          .all(topologyId) as { source_id: string }[]
      ).map((r) => r.source_id),
    )
    for (const tds of this.topologySources.listByPurpose(topologyId, 'topology')) {
      if (tds.dataSource?.type === 'manual') continue
      if (tds.lastSyncedAt == null) continue
      if (have.has(tds.dataSourceId)) continue
      const row = this.db
        .query(
          `SELECT graph_json, status, captured_at
           FROM topology_observations
           WHERE topology_id = ? AND source_id = ? AND status != 'failed'
             AND graph_json IS NOT NULL AND captured_at >= ?
           ORDER BY captured_at DESC, rowid DESC
           LIMIT 1`,
        )
        .get(topologyId, tds.dataSourceId, tds.createdAt) as
        | { graph_json: string; status: string; captured_at: number }
        | undefined
      if (!row) continue
      const graph = JSON.parse(row.graph_json) as NetworkGraph
      ingestGraph(
        topologyId,
        tds.dataSourceId,
        graph,
        { attachmentId: tds.id, lastStatus: row.status, lastOkAt: row.captured_at },
        this.db,
      )
    }
  }

  /**
   * Derive the metrics mapping (axis 2) for a resolved graph purely from the
   * `metrics-binding` attachments folded onto it by identity (node host bindings
   * + port interface bindings). The legacy `mapping_json` blob is gone — bindings
   * are the single source of truth. Used by both a fresh resolve and an artifact
   * hydrate so the two agree.
   */
  private buildMapping(topologyId: string, graph: NetworkGraph): MetricsMapping | undefined {
    // Only bindings from currently-attached metrics sources count — a binding
    // left behind by a detached source must not keep driving the mapping.
    const activeSourceIds = new Set(
      this.topologySources.listByPurpose(topologyId, 'metrics').map((s) => s.dataSourceId),
    )
    const mapping = deriveMappingFromGraph(graph, activeSourceIds)
    const hasBindings =
      Object.keys(mapping.nodes).length > 0 || Object.keys(mapping.links).length > 0
    return hasBindings ? mapping : undefined
  }

  /** Current composition revision for a topology (0 if column/row missing). */
  private compositionRevisionOf(id: string): number {
    try {
      const row = this.db
        .query('SELECT composition_revision AS r FROM topologies WHERE id = ?')
        .get(id) as { r: number } | undefined
      return row?.r ?? 0
    } catch {
      return 0
    }
  }

  /**
   * Hydrate a ParsedTopology from the persisted resolved-graph artifact, if one
   * exists and is current (matching composition revision + resolver version).
   * Returns null on any miss/staleness/parse error so the caller recomputes.
   * Metrics are always rebuilt empty (live values come per-poll); mapping is
   * re-derived from the stored graph so it tracks binding/residual edits.
   */
  private tryHydrateArtifact(topology: Topology): ParsedTopology | null {
    try {
      const row = this.db
        .query('SELECT * FROM topology_resolved_graph WHERE topology_id = ?')
        .get(topology.id) as ResolvedGraphRow | undefined
      if (!row?.layout_json) return null
      if (row.resolver_version !== RESOLVER_VERSION) return null
      if (row.built_revision !== this.compositionRevisionOf(topology.id)) return null

      const graph = JSON.parse(row.graph_json) as NetworkGraph
      const { layout, resolved } = parseWithMaps<{
        layout: LayoutResult
        resolved?: ResolvedLayout
      }>(row.layout_json)
      const iconDimensions: ResolvedIconDimensions = new Map(
        row.icon_dimensions_json ? JSON.parse(row.icon_dimensions_json) : [],
      )
      return {
        id: topology.id,
        name: topology.name,
        graph,
        layout,
        resolved,
        iconDimensions,
        metrics: this.createEmptyMetrics(graph),
        topologySourceId: this.topologySourceIdFor(topology.id),
        metricsSourceId: this.metricsSourceIdFor(topology.id),
        mapping: this.buildMapping(topology.id, graph),
      }
    } catch {
      return null
    }
  }

  /**
   * Persist the resolved graph + layout + icon dimensions as a derived artifact,
   * stamped with the revision it was built FROM (captured before the resolve, so
   * a mid-resolve input change leaves this immediately stale). Best-effort.
   */
  private writeResolvedArtifact(
    topology: Topology,
    parsed: ParsedTopology,
    builtRevision: number,
  ): void {
    try {
      this.db
        .query(
          `INSERT OR REPLACE INTO topology_resolved_graph
             (topology_id, graph_json, layout_json, icon_dimensions_json,
              built_revision, resolver_version, computed_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          topology.id,
          JSON.stringify(parsed.graph),
          stringifyWithMaps({ layout: parsed.layout, resolved: parsed.resolved }),
          JSON.stringify([...parsed.iconDimensions.entries()]),
          builtRevision,
          RESOLVER_VERSION,
          timestamp(),
        )
    } catch {
      // Persisting is best-effort — a failure just means the next read recomputes.
    }
  }

  // parseContent() was removed when content_json stopped flowing
  // through the topology row — observation payloads are now validated
  // at the API boundary (api/observations.ts) and at resolve() time.

  /**
   * Read a topology's intrinsic graph — the project's own contribution
   * (`contribution_source.attachment_id IS NULL`), where the editor writes. It
   * is always available (every topology has one, lazily) and is never backed by
   * a data source. Returns null when nothing has been authored yet (blank canvas).
   *
   * Public so the editor / settings / discovery-policy APIs can read + mutate it.
   */
  readIntrinsicGraph(topologyId: string): NetworkGraph | null {
    return buildGraph(topologyId, INTRINSIC_SOURCE, this.db)
  }

  /**
   * Persist a topology's intrinsic graph (the project's own contribution,
   * `attachment_id IS NULL`). resolve() folds it as the top-priority
   * contribution. Per-topology: an edit to X only invalidates X.
   */
  writeIntrinsicGraph(topologyId: string, graph: NetworkGraph): void {
    ingestGraph(topologyId, INTRINSIC_SOURCE, graph, { attachmentId: null }, this.db)
    this.clearCacheEntry(topologyId)
  }

  /**
   * Create empty metrics structure for a graph
   */
  private createEmptyMetrics(graph: NetworkGraph): MetricsData {
    const nodes: Record<string, { status: 'up' | 'down' | 'unknown' }> = {}
    const links: Record<string, { status: 'up' | 'down' | 'unknown'; utilization?: number }> = {}

    for (const node of graph.nodes) {
      nodes[node.id] = { status: 'unknown' }
    }

    for (const [i, link] of graph.links.entries()) {
      const linkId = link.id || `link-${i}`
      links[linkId] = { status: 'unknown' }
    }

    return {
      nodes,
      links,
      timestamp: Date.now(),
    }
  }

  /**
   * Get parse error for a topology (if any)
   */
  getParseError(id: string): TopologyParseError | undefined {
    return this.errorCache.get(id)
  }

  /**
   * Get all topology parse errors
   */
  getAllParseErrors(): TopologyParseError[] {
    return Array.from(this.errorCache.values())
  }

  /**
   * Update metrics for a cached topology
   */
  updateMetrics(id: string, metrics: MetricsData): void {
    const cached = this.cache.get(id)
    if (cached) {
      cached.metrics = metrics
    }
  }

  /**
   * Get cached render output
   */
  getRenderCache(id: string): object | undefined {
    return this.renderCache.get(id)
  }

  /**
   * Set cached render output
   */
  setRenderCache(id: string, output: object): void {
    this.renderCache.set(id, output)
  }

  /**
   * Clear all cached topologies. Also bumps every composition revision so the
   * persisted resolved-graph artifacts (L2) are invalidated in lockstep — a
   * bulk RAM clear must not leave stale artifacts servable.
   */
  clearCache(): void {
    this.cache.clear()
    this.renderCache.clear()
    this.errorCache.clear()
    try {
      this.db.query('UPDATE topologies SET composition_revision = composition_revision + 1').run()
    } catch {
      // Pre-migration / no rows — RAM clear still applied.
    }
  }

  /**
   * Invalidate every topology attached to a given data source. Used when the
   * data source itself changes (config edit — e.g. a Manual source's authored
   * graph lives in its config_json — or deletion) so attached topologies don't
   * serve a stale resolved artifact.
   */
  clearCacheForDataSource(dataSourceId: string): void {
    const rows = this.db
      .query('SELECT DISTINCT topology_id FROM topology_data_sources WHERE data_source_id = ?')
      .all(dataSourceId) as { topology_id: string }[]
    for (const { topology_id } of rows) this.clearCacheEntry(topology_id)
  }

  /**
   * Clear cached topology by ID. Also bumps `composition_revision` so the
   * persisted resolved-graph artifact (L2) is invalidated in lockstep with the
   * RAM cache — every invalidation site funnels through here, so the artifact
   * can never be served stale relative to a RAM clear.
   */
  clearCacheEntry(id: string): void {
    this.cache.delete(id)
    this.renderCache.delete(id)
    this.errorCache.delete(id)
    this.bumpCompositionRevision(id)
  }

  /** Bump the composition revision (invalidates the persisted resolved artifact). */
  private bumpCompositionRevision(id: string): void {
    try {
      this.db
        .query('UPDATE topologies SET composition_revision = composition_revision + 1 WHERE id = ?')
        .run(id)
    } catch {
      // Column missing (pre-migration) or row gone — invalidation degrades to
      // the RAM cache only, which is still correct within the process.
    }
  }

  /**
   * List all topology names (for compatibility with old API)
   */
  listNames(): string[] {
    return this.list().map((t) => t.name)
  }

  /**
   * Initialize with sample topology if database is empty
   * Parses YAML sample network and stores as NetworkGraph JSON
   * Only runs when DEMO_MODE environment variable is set to 'true'
   */
  async initializeSample(): Promise<void> {
    // Skip sample creation unless DEMO_MODE is enabled
    if (process.env['DEMO_MODE'] !== 'true') {
      return
    }

    const existing = this.list()
    if (existing.length > 0) {
      return
    }

    console.log('[TopologyService] Demo mode: creating sample network')

    // Build file map from sample network
    const fileMap = new Map<string, string>()
    let mainContent = ''
    for (const file of sampleNetwork) {
      fileMap.set(file.name, file.content)
      if (file.name === 'main.yaml') {
        mainContent = file.content
      }
    }

    if (!mainContent) {
      console.error('[TopologyService] No main.yaml in sample network')
      return
    }

    // Parse YAML to NetworkGraph
    const graph = await parseYamlToNetworkGraph(mainContent, fileMap)

    // Create the topology shell, then write the parsed graph as the project's
    // intrinsic contribution (the editor's write target — DB-native, always
    // available, never a data source).
    const created = await this.create({ name: 'Sample Network' })
    this.writeIntrinsicGraph(created.id, graph)

    console.log(
      '[TopologyService] Sample network created:',
      created.id,
      graph.nodes.length,
      'nodes,',
      graph.links.length,
      'links',
    )
  }
}
