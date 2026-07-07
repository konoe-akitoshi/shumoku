/**
 * Topology Service
 * Manages network topologies with database persistence.
 *
 * Storage model: the `topologies` table holds only the topology shell
 * (name, share_token, composition_revision). Sources live in
 * `topology_data_sources` (m2m). Every contribution is stored DB-native in the
 * `contribution_*` store (decomposed into queryable element/link/attachment rows;
 * see db-native-persistence.md). `topology_observations` is now just the
 * append-only audit/history log. The metrics mapping is `metrics-binding`
 * attachments on the resolved graph (no `mapping_json`); the resolved graph +
 * layout are materialized in `topology_resolved_graph`.
 *
 * Two kinds of contribution, distinguished by `attachment_id`:
 *   - **source contributions** (`attachment_id` set) — every attached source's
 *     latest graph, INCLUDING an explicitly-added hand-drawn Manual source. ALL of
 *     them are written the SAME way: `ObservationsService.record()` →
 *     `materializeContribution`. A Manual source's editor save is just an
 *     observation with the human as the "scanner" — no manual-specific path.
 *     Folded by priority.
 *   - **the project overlay** (`attachment_id` NULL, {@link PROJECT_SOURCE}) — the
 *     operator's curation: exclusions, overrides, metrics bindings, display
 *     settings. Written by `writeProjectOverlay` (never spawns a data source).
 *     Fed to `resolve()` as the top-priority `authored` input.
 */

import type { Database } from 'bun:sqlite'
import crypto from 'node:crypto'
import type {
  Attachment,
  EntityId,
  IconDimensions,
  LayoutResult,
  Link,
  MembershipCriterion,
  NetworkGraph,
  Node,
  NodePort,
  ResolvedLayout,
  ScopeFilter,
  SnapshotEntry,
  Subgraph,
  Termination,
} from '@shumoku/core'
import {
  asEntityId,
  attachmentKey,
  createMemoryFileResolver,
  deriveMappingFromGraph,
  HierarchicalParser,
  parseWithMaps,
  sampleNetwork,
  stringifyWithMaps,
  YamlParser,
} from '@shumoku/core'
import { generateId, getDatabase, timestamp } from '../db/index.js'
import type {
  LinkContribution,
  LinkMetricsMapping,
  MetricsData,
  MetricsMapping,
  NodeContribution,
  NodeMetricsMapping,
  ScopeMode,
  Topology,
  TopologyInput,
} from '../types.js'
import { buildGraph, ingestGraph } from './contribution-store.js'
import type { DataSourceService } from './datasource.js'
import { isDeriving, kickDerivation } from './derivation.js'
import {
  adoptOrMintForGraph,
  flipToEntityIds,
  resolveEntityAlias,
  stampEntityIds,
} from './entity-registry.js'
import { extractInterfaceNames, planLinkAutoMap } from './link-automap.js'
import { TopologySourcesService } from './topology-sources.js'

/**
 * How long `getParsed` waits for an in-flight bake before falling back to
 * stale-serving. Small topologies finish inside this window, so the common
 * case still returns fresh data in one request.
 */
const DERIVE_WAIT_MS = 3_000

/**
 * Sentinel `source_id` of the **project overlay** — the project's own
 * top-priority contribution (`attachment_id` NULL, one per topology, enforced by
 * `idx_contrib_one_intrinsic`). It is NOT a data source: it holds the operator's
 * curation over the composed result — exclusions (`presence='hide'`), field
 * overrides, metrics bindings, and graph-level display settings (edge style).
 * `resolve()` folds it as the top-priority `authored` input. The value is kept as
 * `'intrinsic'` so the existing partial unique index applies with no migration.
 *
 * This is the contrast to a Manual *data source* (`attachment_id` set): Manual is
 * now ONLY for explicitly-added hand-drawn graphs and is folded like any other
 * source. Curation never spawns a Manual source — it writes the project overlay.
 */
const PROJECT_SOURCE = 'intrinsic'

/** Bare topology row — no content_json column post-migration-010. */
interface TopologyRow {
  id: string
  name: string
  share_token: string | null
  scope_mode: string | null
  scope_source_id: string | null
  composition_mode: string | null
  created_at: number
  updated_at: number
}

function rowToTopology(row: TopologyRow): Topology {
  return {
    id: row.id,
    name: row.name,
    // Topology is just the shell. No content, no source pointers — sources live
    // in the m2m topology_data_sources table; mappingJson is derived from bindings.
    shareToken: row.share_token ?? undefined,
    scopeMode: (row.scope_mode as Topology['scopeMode']) ?? 'auto',
    scopeSourceId: row.scope_source_id ?? undefined,
    compositionMode: (row.composition_mode as Topology['compositionMode']) ?? 'additive',
    // Filled by the service from topology_scope_criteria (rowToTopology has no db).
    scope: { include: [], exclude: [] },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

interface ScopeCriterionRow {
  kind: string
  attr: string
  key: string | null
  value: string
}

/**
 * A `metrics_mapping` row (Phase 2): the mapping keyed by stable entity id.
 * `entity_id` is cast at the DB-read boundary via `castMappingRow`.
 */
interface MetricsMappingRow {
  entity_id: EntityId
  kind: string
  source_id: string
  payload_json: string
}

/**
 * Cast a raw DB row to MetricsMappingRow, branding entity_id at the DB boundary.
 * Trust boundary: metrics_mapping.entity_id values are ULIDs stored by writeMappingRows.
 */
function castMappingRow(raw: {
  entity_id: string
  kind: string
  source_id: string
  payload_json: string
}): MetricsMappingRow {
  return { ...raw, entity_id: asEntityId(raw.entity_id) }
}

/**
 * Persisted payload of a `link` metrics_mapping row. The monitored node is
 * referenced by its stable entity id (`monitoredNodeEntityId`) so it survives the
 * Phase 3 element-id flip. `monitoredNodeId` only appears in legacy rows written
 * before the flip and is treated as a stale element id on read.
 */
interface StoredLinkMapping {
  monitoredNodeEntityId?: EntityId
  /** Legacy (pre-Phase-3) rows only: a now-stale resolved element id. */
  monitoredNodeId?: string
  interface?: string
  bandwidth?: number
}

/**
 * Bump when the resolve/layout algorithms change shape, so persisted
 * `topology_resolved_graph` artifacts built by an older version are treated as
 * stale and recomputed without a manual purge.
 */
// v8: container-overlap is a BLOCKING constraint — post-search feasibility
// rounds widen gaps until all container boxes are disjoint.
// v9: composite layout for typed/role-driven graphs — eccentricity apex,
// tidy-tree centering, horizontal tier spread, depth-based zone banding (#526).
// v10: LayoutProblem-based compound semantic layout replaces the legacy
// zone/row/band composite placement; existing artifacts must rebake.
// v11: LayoutProblem projection layout changes node/group coordinates;
// invalidate v10 artifacts produced during the transition.
// v12: router gutter bypass no longer treats node boxes as gutter obstacles;
// invalidate artifacts with over-detoured local wires.
// v13: comb bus routing no longer applies to singleton child rows and no
// longer emits y-backtracking bends.
// v14: role-driven ranks use directed topology dependencies first; soft
// device tiers no longer place firewalls above upstream routers.
// v18: entity registry Phase 1 — entityId field added to nodes/ports/links
// v19: composite edges return to log display widths; vertical risers separate by ink width
// v20: entity registry Phase 3 — node.id/link.id ON the resolved graph (+ layout
// + resolved artifact) are flipped to their stable entity ids; old-id artifacts
// must rebake so persisted references (metrics mapping, weathermap) key on ULIDs.
const RESOLVER_VERSION = 20

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

/**
 * A pure-overlay node carries identity but makes NO authored claim whatsoever.
 * Such a node contributes nothing to resolve, so it's safe to drop after a
 * binding is cleared — avoids accumulating empty overlay rows. Conservative by
 * construction: ANY authored field present means we keep the node, so clearing a
 * binding can never delete unrelated authored content. Only `id` + `label:''` +
 * `identity` may remain for it to be dropped.
 */
/**
 * Does a link endpoint's port correspond to the given interface name? Matches
 * the port id (interface names ARE port ids for inventory sources), its
 * `identity.ifName`, or its label — so a legacy link mapping can recover which
 * endpoint it monitored from the interface alone.
 */
function endpointMatchesInterface(
  nodeById: ReadonlyMap<string, Node>,
  endpoint: { node: string; port: string },
  iface: string,
): boolean {
  if (endpoint.port === iface) return true
  const port = nodeById.get(endpoint.node)?.ports?.find((p) => p.id === endpoint.port)
  if (!port) return false
  if (port.identity?.ifName === iface) return true
  const label = Array.isArray(port.label) ? port.label[0] : port.label
  return label === iface
}

function isPureEmptyOverlay(n: Node): boolean {
  const label = Array.isArray(n.label) ? n.label.join('') : (n.label ?? '')
  // Allow-list the fields a bare binding overlay legitimately carries; any other
  // populated property keeps the node. `presence` is here so a binding-anchor
  // node (which we tag `presence:'anchor'`) is still droppable once its binding
  // is cleared — otherwise the leftover `presence` would pin an empty row.
  const ALLOWED = new Set(['id', 'label', 'identity', 'presence'])
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

/** `[]` → `undefined` so an emptied attachment list drops the key entirely. */
function emptyToUndef<T>(arr: T[]): T[] | undefined {
  return arr.length > 0 ? arr : undefined
}

/**
 * `updateMapping` result: the updated topology, plus how many mapping entries
 * could NOT be persisted because their element carries no stable entity id to
 * key on (node: no entityId; link: no endpoint-derived entityId). Returned so
 * callers stop reporting a clean success when part of the mapping was silently
 * dropped — the UI surfaces a warning.
 */
export interface UpdateMappingResult {
  topology: Topology | null
  skipped: { nodes: number; links: number }
}

/**
 * A source's composition for one topology. node/link contribution are per-source
 * (how THIS source behaves here); `closeScope` is derived from the TOPOLOGY's
 * scope policy (which source's regions close the world) — see computeScopeSources.
 */
interface SourceMode {
  nodeContribution: NodeContribution
  linkContribution: LinkContribution
  closeScope: boolean
}

/**
 * Apply a source's composition to its built contribution before it enters
 * resolve(): anchor its nodes (node_contribution='anchor'), anchor its links
 * (link_contribution='update'), and/or mark its regions `scope:'closed'` (this
 * source is the topology's scope definer). All-default is a no-op. Never mutates
 * input.
 */
function applySourceMode(graph: NetworkGraph, mode: SourceMode): NetworkGraph {
  const anchorNodes = mode.nodeContribution === 'anchor'
  const anchorLinks = mode.linkContribution === 'update'
  if (!anchorNodes && !anchorLinks && !mode.closeScope) return graph
  return {
    ...graph,
    nodes: anchorNodes
      ? graph.nodes.map((n) => ({ ...n, presence: 'anchor' as const }))
      : graph.nodes,
    links: anchorLinks
      ? graph.links.map((l) => ({ ...l, presence: 'anchor' as const }))
      : graph.links,
    ...(mode.closeScope && graph.subgraphs
      ? { subgraphs: graph.subgraphs.map((s) => ({ ...s, scope: 'closed' as const })) }
      : {}),
  }
}

/**
 * Resolve the topology's scope policy to the set of SOURCE ids whose regions
 * close the world:
 *   - 'open'   → none (pure union)
 *   - 'closed' → just `scopeSourceId`
 *   - 'auto'   → the highest-priority topology-purpose source(s)
 * This is the scope POLICY; resolve() is pure mechanism (honors the `scope:'closed'`
 * marks this drives). Empty set → no scoping.
 */
function computeScopeSources(
  scopeMode: ScopeMode,
  scopeSourceId: string | undefined,
  topologySources: { dataSourceId: string; purpose: string; priority: number }[],
): Set<string> {
  if (scopeMode === 'open') return new Set()
  if (scopeMode === 'closed') return new Set(scopeSourceId ? [scopeSourceId] : [])
  const topo = topologySources.filter((s) => s.purpose === 'topology')
  if (topo.length === 0) return new Set()
  const maxPriority = topo.reduce((m, s) => Math.max(m, s.priority), Number.NEGATIVE_INFINITY)
  return new Set(topo.filter((s) => s.priority === maxPriority).map((s) => s.dataSourceId))
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
  /** Served from an artifact older than the current composition revision —
   *  a background bake is (re)building the fresh one. */
  stale?: boolean
}

/** What the derive worker sends back (apps/server/api/src/services/derive-worker.ts). */
export interface DeriveResult {
  graph: NetworkGraph
  layout: LayoutResult
  resolved?: ResolvedLayout
  iconDimensions: ResolvedIconDimensions
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
  /**
   * Optional hook called after a mapping write (updateMapping, reassignOrphan,
   * discardOrphan). Injected by server.ts to poke the poll scheduler so the
   * new binding is reflected in live metrics without a full poll-interval wait.
   * topology.ts must NOT import server.ts — the hook is injected from outside.
   */
  private onMappingWritten: ((topologyId: string) => void) | null = null
  /**
   * In-memory per-topology counter bumped on every mapping write
   * (`invalidateMappingCache`). The share SSE stream includes this so shared
   * viewers can detect mapping changes (e.g. bandwidth-override edits) that do
   * NOT bump `composition_revision` — and refetch the graph to see the new
   * bandwidth display. Pure in-memory: resets on restart (viewers do a one-time
   * refetch at that point anyway). See Item 4 of #569.
   */
  private mappingVersions: Map<string, number> = new Map()

  constructor() {
    this.db = getDatabase()
    this.topologySources = new TopologySourcesService()
  }

  /**
   * Register a callback to be called after every mapping write.
   * Called by server.ts to wire the poll-scheduler poke (Item 3, #569).
   * The callback must not throw; any error is logged and swallowed.
   */
  setMappingWriteHook(fn: (topologyId: string) => void): void {
    this.onMappingWritten = fn
  }

  /**
   * Optional hook fired when a topology is created or deleted. Injected by
   * server.ts to register/unregister the topology with the poll scheduler —
   * without this, a topology created AFTER startup never enters the polling
   * loop (the scheduler seeds its state map once at start()). Same injection
   * pattern as the mapping-write hook: topology.ts must not import server.ts.
   */
  private onTopologyLifecycle: ((topologyId: string, event: 'created' | 'deleted') => void) | null =
    null

  setTopologyLifecycleHook(fn: (topologyId: string, event: 'created' | 'deleted') => void): void {
    this.onTopologyLifecycle = fn
  }

  private fireTopologyLifecycle(topologyId: string, event: 'created' | 'deleted'): void {
    try {
      this.onTopologyLifecycle?.(topologyId, event)
    } catch (err) {
      console.error('[TopologyService] lifecycle hook failed:', err)
    }
  }

  /**
   * Find the Manual data source id attached to a topology, if any.
   * Returns the *data source* id (PK of `data_sources`), not the
   * junction row id. (A topology may have several Manual sources; this
   * returns the first — used only for internal "is X the manual source"
   * checks, not as a privileged per-topology pointer.)
   */
  findManualSourceId(topologyId: string): string | undefined {
    const row = this.db
      .query(
        `SELECT ds.id AS id
         FROM topology_data_sources tds
         JOIN data_sources ds ON ds.id = tds.data_source_id
         WHERE tds.topology_id = ? AND ds.type = 'manual'
         LIMIT 1`,
      )
      .get(topologyId) as { id: string } | undefined
    return row?.id
  }

  /**
   * Create-and-attach a new Manual data source to a topology, plus
   * record an empty initial observation so the editor opens on a
   * blank canvas rather than 404 / null.
   *
   * Public — invoked by the `POST /api/topologies/:id/sources` endpoint
   * when the body is `{ type: 'manual' }`. Manual is fully uniform: no
   * cardinality limit, so this can run more than once per topology.
   */
  async attachManualSource(
    topologyId: string,
    purpose: 'topology' | 'metrics' = 'topology',
  ): Promise<{ dataSourceId: string }> {
    const now = timestamp()
    const dsId = await generateId()
    // Manual has no connection config and no seeded content: its authored graph
    // is a topology_observations snapshot recorded by the editor's first save.
    // Until then there's no observation → resolve treats authored as empty (blank
    // canvas). Config is `{}` like any source with nothing to configure.
    this.db
      .prepare(
        `INSERT INTO data_sources (id, name, type, config_json, status, fail_count, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(dsId, 'Manual', 'manual', '{}', 'connected', 0, now, now)
    await this.topologySources.add(topologyId, {
      dataSourceId: dsId,
      purpose,
      syncMode: 'manual',
    })
    this.clearCacheEntry(topologyId)
    return { dataSourceId: dsId }
  }

  /** Get all topologies from the database (shells only). */
  list(): Topology[] {
    const rows = this.db.query('SELECT * FROM topologies ORDER BY name ASC').all() as TopologyRow[]
    return rows.map((row) => this.withScope(rowToTopology(row)))
  }

  /** Get a single topology shell by ID. */
  get(id: string): Topology | null {
    const row = this.db.query('SELECT * FROM topologies WHERE id = ?').get(id) as
      | TopologyRow
      | undefined
    return row ? this.withScope(rowToTopology(row)) : null
  }

  /** Get a topology shell by name. */
  getByName(name: string): Topology | null {
    const row = this.db.query('SELECT * FROM topologies WHERE name = ?').get(name) as
      | TopologyRow
      | undefined
    return row ? this.withScope(rowToTopology(row)) : null
  }

  /** Read the topology's scope criteria into a ScopeFilter. */
  readScopeCriteria(topologyId: string): ScopeFilter {
    const rows = this.db
      .query('SELECT kind, attr, key, value FROM topology_scope_criteria WHERE topology_id = ?')
      .all(topologyId) as ScopeCriterionRow[]
    const include: MembershipCriterion[] = []
    const exclude: MembershipCriterion[] = []
    for (const r of rows) {
      const crit: MembershipCriterion = {
        attr: r.attr as MembershipCriterion['attr'],
        value: r.value,
        ...(r.key ? { key: r.key } : {}),
      }
      ;(r.kind === 'exclude' ? exclude : include).push(crit)
    }
    return { include, exclude }
  }

  /** Fill a topology's `scope` from its criteria rows. */
  private withScope(topology: Topology): Topology {
    topology.scope = this.readScopeCriteria(topology.id)
    return topology
  }

  /**
   * Replace the topology's scope criteria wholesale. Bumps the composition
   * revision so the resolved graph re-resolves under the new scope.
   */
  setScopeCriteria(topologyId: string, scope: ScopeFilter): Topology | null {
    if (!this.get(topologyId)) return null
    const now = timestamp()
    this.db.query('DELETE FROM topology_scope_criteria WHERE topology_id = ?').run(topologyId)
    const insert = this.db.query(
      `INSERT INTO topology_scope_criteria (id, topology_id, kind, attr, key, value, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    const write = (kind: 'include' | 'exclude', crit: MembershipCriterion): void => {
      insert.run(
        crypto.randomUUID(),
        topologyId,
        kind,
        crit.attr,
        crit.key ?? null,
        crit.value,
        now,
      )
    }
    for (const c of scope.include ?? []) write('include', c)
    for (const c of scope.exclude ?? []) write('exclude', c)
    this.clearCacheEntry(topologyId)
    return this.get(topologyId)
  }

  /** Set the topology-wide composition Mode (additive | enrichment). */
  setCompositionMode(topologyId: string, mode: Topology['compositionMode']): Topology | null {
    if (!this.get(topologyId)) return null
    this.db
      .query('UPDATE topologies SET composition_mode = ?, updated_at = ? WHERE id = ?')
      .run(mode, timestamp(), topologyId)
    this.clearCacheEntry(topologyId)
    return this.get(topologyId)
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
    this.fireTopologyLifecycle(id, 'created')
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
   * Set the topology's scope policy (composition). `scopeSourceId` is only
   * meaningful for `scopeMode === 'closed'`; it's cleared otherwise. Bumps the
   * composition revision (via clearCacheEntry) so the resolved graph re-resolves.
   */
  setScope(id: string, scopeMode: ScopeMode, scopeSourceId?: string): Topology | null {
    const existing = this.get(id)
    if (!existing) return null
    const sourceId = scopeMode === 'closed' ? (scopeSourceId ?? null) : null
    this.db
      .query(
        'UPDATE topologies SET scope_mode = ?, scope_source_id = ?, updated_at = ? WHERE id = ?',
      )
      .run(scopeMode, sourceId, timestamp(), id)
    this.clearCacheEntry(id)
    return this.get(id)
  }

  /**
   * Update the metrics mapping for a topology. The mapping is stored as plain
   * `metrics_mapping` rows keyed by stable ENTITY id (Phase 2): the identity
   * anchoring machinery is gone — the entity registry already did the identity
   * matching at ingest, so the server just translates the element-keyed wire
   * shape to entity ids using the entityId-stamped resolved graph and upserts
   * one row per mapped element. Holds EXACTLY the given mapping for this metrics
   * source (a full replace, so clearing an entry removes its row).
   *
   * `opts.sourceId` — write rows under this specific metrics source instead of
   * the default first source (Wave B-3, #569). Must be an ATTACHED
   * `metrics`-purpose source of the topology; an unrecognised id signals
   * `error: 'invalidSource'` in the result so the route can return 400. When
   * omitted the first source is used (backward compatible).
   *
   * Returns the updated topology AND the count of entries that couldn't be
   * persisted because their element carries no stable entity id (see
   * `UpdateMappingResult`) so the route/UI can warn instead of reporting a clean
   * success when part of the mapping was dropped.
   */
  async updateMapping(
    id: string,
    mapping: MetricsMapping,
    opts?: { sourceId?: string },
  ): Promise<UpdateMappingResult & { error?: 'invalidSource' }> {
    const noneSkipped = { nodes: 0, links: 0 }
    const existing = this.get(id)
    if (!existing) return { topology: null, skipped: noneSkipped }

    // Resolve which metrics source to write under (Wave B-3, #569).
    let sourceId: string | undefined
    if (opts?.sourceId) {
      // Validate: must be an attached metrics source for this topology.
      const attached = this.topologySources.listByPurpose(id, 'metrics')
      const found = attached.find((s) => s.dataSourceId === opts.sourceId)
      if (!found) return { topology: null, skipped: noneSkipped, error: 'invalidSource' }
      sourceId = opts.sourceId
    } else {
      sourceId = this.metricsSourceIdFor(id)
    }

    const parsed = await this.getParsed(id)
    // Refuse to key against an unresolved graph: with no stamped entity ids to
    // translate against, EVERY entry would be dropped. A transient resolve
    // failure must not wipe the mapping.
    if (!parsed) {
      throw new Error(
        'cannot resolve topology graph; refusing to update mapping (would drop entries)',
      )
    }
    // Without a metrics source there's nowhere to bind (and nothing to poll).
    if (!sourceId) return { topology: this.get(id), skipped: noneSkipped }

    const skipped = this.writeMappingRows(id, sourceId, mapping, parsed.graph)
    if (skipped.nodes > 0 || skipped.links > 0) {
      // Surface dropped entries rather than silently losing them (no-silent-caps):
      // an element with no stamped entity id (its identity didn't resolve in the
      // registry) has no stable key to store the mapping against. The count rides
      // back on the result so the UI can warn (not just this log).
      console.warn(
        `[Mapping] topology ${id}: skipped ${skipped.nodes} node + ${skipped.links} link mapping entr(ies) lacking a stable entity id`,
      )
    }
    // The mapping is NOT part of the baked resolved artifact — it is re-derived
    // from these rows on every read. So only drop the RAM caches (so the next
    // read rebuilds the mapping from the fresh rows); do NOT bump the composition
    // revision, which would needlessly re-run the multi-minute resolve + layout.
    this.invalidateMappingCache(id)
    return { topology: this.get(id), skipped }
  }

  /**
   * Replace this metrics source's `metrics_mapping` rows so they hold EXACTLY the
   * given element-keyed mapping. Each element id is translated to its stable
   * entity id via the entityId-stamped resolved graph; entries whose element has
   * no entity id (unresolved identity) are skipped + counted. One transaction:
   * delete this source's rows, then upsert the survivors.
   */
  private writeMappingRows(
    topologyId: string,
    sourceId: string,
    mapping: MetricsMapping,
    graph: NetworkGraph,
  ): { nodes: number; links: number } {
    const nodeById = new Map(graph.nodes.map((n) => [n.id, n]))
    // element mapping key (link.id || `link-${i}`) → link, matching the rest of
    // the server so the wire shape round-trips.
    const linkByKey = new Map<string, (typeof graph.links)[number]>()
    graph.links.forEach((link, i) => {
      linkByKey.set(link.id || `link-${i}`, link)
    })

    const skipped = { nodes: 0, links: 0 }
    const now = timestamp()
    const upsert = this.db.query(
      `INSERT OR REPLACE INTO metrics_mapping
         (topology_id, entity_id, kind, source_id, payload_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    const run = this.db.transaction(() => {
      this.db
        .query('DELETE FROM metrics_mapping WHERE topology_id = ? AND source_id = ?')
        .run(topologyId, sourceId)
      for (const [nodeId, nm] of Object.entries(mapping.nodes ?? {})) {
        if (!nm.hostId && !nm.hostName) continue
        const entityId = nodeById.get(nodeId)?.entityId
        if (!entityId) {
          skipped.nodes++
          continue
        }
        upsert.run(topologyId, entityId, 'node', sourceId, JSON.stringify(nm), now, now)
      }
      for (const [linkKey, lm] of Object.entries(mapping.links ?? {})) {
        // An entry with no monitored node makes no binding — matches the legacy
        // skip (uncounted). A pure bandwidth override without a monitored node is
        // not persisted, preserving prior behaviour.
        if (!lm.monitoredNodeId) continue
        const entityId = linkByKey.get(linkKey)?.entityId
        if (!entityId) {
          skipped.links++
          continue
        }
        // Persist the monitored node by its STABLE entity id, never the element
        // id: resolved element ids change across the Phase 3 flip, so a stored
        // element id would dangle after an upgrade (the poller would look it up
        // in mapping.nodes and miss). `buildMapping` re-derives the current
        // element id from this on read.
        //
        // Fix 3 (#547): if the monitored node has no entityId at write time, skip
        // the row and count it as skipped rather than writing a doomed row whose
        // legacy fallback can never resolve post-flip.
        const monitoredNodeEntityId = nodeById.get(lm.monitoredNodeId)?.entityId
        if (!monitoredNodeEntityId) {
          skipped.links++
          continue
        }
        const stored: StoredLinkMapping = {
          monitoredNodeEntityId,
          interface: lm.interface,
          bandwidth: lm.bandwidth,
        }
        upsert.run(topologyId, entityId, 'link', sourceId, JSON.stringify(stored), now, now)
      }
    })
    run()
    return skipped
  }

  /** The metrics data source id for a topology (first m2m purpose='metrics'). */
  private metricsSourceIdFor(topologyId: string): string | undefined {
    return this.topologySources.listByPurpose(topologyId, 'metrics')[0]?.dataSourceId
  }

  /**
   * The structure (topology) data source id — first non-manual m2m
   * purpose='topology' source. Derived from the m2m table now that the legacy
   * `topologies.topology_source_id` column is gone; kept on `ParsedTopology` for
   * the /context response shape (the client doesn't read it today).
   */
  private topologySourceIdFor(topologyId: string): string | undefined {
    const manualId = this.findManualSourceId(topologyId)
    return this.topologySources
      .listByPurpose(topologyId, 'topology')
      .find((s) => s.dataSourceId !== manualId)?.dataSourceId
  }

  /**
   * Drop only the RAM caches for a topology WITHOUT bumping the composition
   * revision. Used after a mapping edit: the mapping is re-derived from
   * `metrics_mapping` rows on every read (it is not part of the baked resolved
   * artifact), so the next `getParsed` rehydrates the same fresh artifact and
   * rebuilds the mapping from the new rows — no resolve, no layout re-run.
   */
  private invalidateMappingCache(id: string): void {
    this.cache.delete(id)
    this.renderCache.delete(id)
    this.errorCache.delete(id)
    // Bump the in-memory mapping version so the share SSE stream can signal
    // shared viewers to refetch (Item 4, #569).
    this.mappingVersions.set(id, (this.mappingVersions.get(id) ?? 0) + 1)
    // Poke the poll scheduler so the new binding is reflected in live metrics
    // without waiting a full poll interval (Item 3, #569). The hook is
    // injected by server.ts; a missing hook is a no-op (e.g. in tests).
    try {
      this.onMappingWritten?.(id)
    } catch (err) {
      console.error('[TopologyService] onMappingWritten hook threw:', err)
    }
  }

  /**
   * Current in-memory mapping version for a topology. Starts at 0 and is
   * incremented on every mapping write. The share SSE stream sends this so
   * shared viewers can detect mapping-only changes (e.g. bandwidth overrides)
   * that do not bump `composition_revision` (Item 4, #569).
   */
  mappingVersionOf(id: string): number {
    return this.mappingVersions.get(id) ?? 0
  }

  /**
   * One-shot cleanup used by the mapping backfill: remove every `metrics-binding`
   * attachment from the project overlay (both node and port scope), since the
   * mapping now lives in `metrics_mapping` rows and the binding attachments are
   * no longer read. Pure-anchor overlay nodes/ports that existed ONLY to host a
   * binding are dropped (no remaining human claim). No-op when the overlay has no
   * binding attachments, so it never needlessly rewrites (and re-bakes) an overlay.
   */
  private async stripOverlayMetricsBindings(topologyId: string): Promise<void> {
    const overlay = this.readProjectOverlay(topologyId)
    if (!overlay) return
    const hasBinding = (atts: Attachment[] | undefined): boolean =>
      (atts ?? []).some((a) => a.kind === 'metrics-binding')
    const overlayHasBinding = overlay.nodes.some(
      (n) => hasBinding(n.attachments) || (n.ports ?? []).some((p) => hasBinding(p.attachments)),
    )
    if (!overlayHasBinding) return

    const withoutBinding = (atts: Attachment[] | undefined): Attachment[] =>
      (atts ?? []).filter((a) => a.kind !== 'metrics-binding')

    let nodes: Node[] = overlay.nodes.map((n) => {
      const next: Node = { ...n, attachments: emptyToUndef(withoutBinding(n.attachments)) }
      if (n.ports) {
        next.ports = n.ports.map((p) => ({
          ...p,
          attachments: emptyToUndef(withoutBinding(p.attachments)),
        }))
      }
      return next
    })
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

    await this.writeProjectOverlay(topologyId, { ...overlay, nodes })
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
   * One-shot: mint entity_registry rows for every EXISTING contribution
   * (each topology source + the project overlay). Phase 1 only mints on the next
   * ingest, so a topology never re-synced since the registry landed has no
   * entities — and the Phase 2 mapping rows key on them. This retroactively
   * registers them (adopt-or-mint is idempotent). Because the stored resolved
   * artifacts predate these entities (their graphs carry no `entityId`), each
   * touched topology is invalidated so the next bake stamps them — required
   * before `backfillMetricsBindings` / `backfillMetricsMappingRows` translate a
   * mapping to entity ids. Runs at startup, settings-guarded.
   */
  async backfillEntityRegistry(): Promise<void> {
    const flag = this.db
      .query("SELECT value FROM settings WHERE key = 'entity_registry_backfilled'")
      .get() as { value: string } | undefined
    if (flag?.value === '1') return

    const rows = this.db
      .query('SELECT DISTINCT topology_id, source_id FROM contribution_source')
      .all() as { topology_id: string; source_id: string }[]
    const touched = new Set<string>()
    for (const r of rows) {
      try {
        adoptOrMintForGraph(r.topology_id, r.source_id, this.db)
        touched.add(r.topology_id)
      } catch (err) {
        console.warn(
          `[Backfill] entity registry for topology ${r.topology_id} / source ${r.source_id}:`,
          err instanceof Error ? err.message : err,
        )
      }
    }
    // Invalidate so the next bake re-stamps the resolved graphs with the entities.
    for (const t of touched) this.clearCacheEntry(t)
    this.db
      .query(
        "INSERT OR REPLACE INTO settings (key, value) VALUES ('entity_registry_backfilled', '1')",
      )
      .run()
    if (rows.length > 0) {
      console.log(
        `[Backfill] entity registry: registered ${rows.length} contribution(s) across ${touched.size} topolog(ies)`,
      )
    }
  }

  /**
   * One-shot: migrate existing `metrics-binding` attachments (the pre-Phase-2
   * mapping representation) into `metrics_mapping` rows keyed by entity id, then
   * strip the binding attachments so nothing reads them anymore. For each
   * topology whose overlay still carries binding attachments, force a fresh
   * resolve (so the graph is entityId-stamped), derive the element-keyed mapping
   * from the folded bindings, translate it to rows, then remove the bindings.
   * Best-effort and settings-guarded: a topology that can't resolve this run is
   * deferred (flag not set) so its mapping is never lost before migration.
   */
  async backfillMetricsMappingRows(): Promise<void> {
    const flag = this.db
      .query("SELECT value FROM settings WHERE key = 'metrics_mapping_rows_backfilled'")
      .get() as { value: string } | undefined
    if (flag?.value === '1') return

    const topos = this.db.query('SELECT id FROM topologies').all() as { id: string }[]
    const overlayHasBinding = (g: NetworkGraph | null): boolean =>
      !!g &&
      g.nodes.some(
        (n) =>
          (n.attachments ?? []).some((a) => a.kind === 'metrics-binding') ||
          (n.ports ?? []).some((p) =>
            (p.attachments ?? []).some((a) => a.kind === 'metrics-binding'),
          ),
      )

    let migrated = 0
    let failed = 0
    for (const { id } of topos) {
      try {
        if (!overlayHasBinding(this.readProjectOverlay(id))) continue // nothing to migrate
        const sourceId = this.metricsSourceIdFor(id)
        const parsed = await this.getParsed(id)
        if (!parsed) {
          // Can't resolve now → don't strip, don't mark done; retry next start.
          failed++
          continue
        }
        const activeSourceIds = new Set(
          this.topologySources.listByPurpose(id, 'metrics').map((s) => s.dataSourceId),
        )
        const elementMapping = deriveMappingFromGraph(parsed.graph, activeSourceIds)
        const hasEntries =
          Object.keys(elementMapping.nodes).length > 0 ||
          Object.keys(elementMapping.links).length > 0
        if (sourceId && hasEntries) {
          this.writeMappingRows(id, sourceId, elementMapping, parsed.graph)
          migrated++
        }
        // Stop reading/folding binding attachments: drop them from the overlay.
        await this.stripOverlayMetricsBindings(id)
      } catch (err) {
        failed++
        console.warn(
          `[Backfill] metrics mapping rows for topology ${id}:`,
          err instanceof Error ? err.message : err,
        )
      }
    }

    if (failed === 0) {
      this.db
        .query(
          "INSERT OR REPLACE INTO settings (key, value) VALUES ('metrics_mapping_rows_backfilled', '1')",
        )
        .run()
    }
    if (migrated > 0 || failed > 0) {
      console.log(
        `[Backfill] metrics bindings → mapping rows: ${migrated} topolog(ies) migrated, ${failed} deferred`,
      )
    }
  }

  /**
   * Delete a topology
   */
  delete(id: string): boolean {
    const result = this.db.query('DELETE FROM topologies WHERE id = ?').run(id)
    this.cache.delete(id)
    this.renderCache.delete(id)
    if (result.changes > 0) this.fireTopologyLifecycle(id, 'deleted')
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
    return row ? this.withScope(rowToTopology(row)) : null
  }

  /**
   * Get a parsed topology ready for rendering — WITHOUT computing in-request.
   *
   * Order: RAM cache → fresh artifact → (kick a background bake, wait briefly
   * so small topologies still feel synchronous) → STALE artifact marked
   * `stale: true` → null (first-ever bake, nothing to serve yet; the route
   * reports `deriving`). The heavy resolve+layout always runs in the
   * derivation Worker (see services/derivation.ts) — a minutes-long layout
   * must never block the serving event loop.
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

    // L2: a persisted resolved-graph artifact (survives restart / RAM eviction),
    // fresh = built from the CURRENT composition revision + resolver version.
    const fromArtifact = this.tryHydrateArtifact(topology)
    if (fromArtifact) {
      this.cache.set(id, fromArtifact)
      this.errorCache.delete(id)
      return fromArtifact
    }

    // Bake in the Worker. When WE just started the bake, wait a short grace
    // period so small topologies return their fresh result in this request
    // (tests + snappy UX). When a bake was already in flight, skip the wait —
    // a big layout means every request during it would otherwise idle the
    // full grace period before serving the same stale artifact.
    const alreadyBaking = isDeriving(id)
    const baking = kickDerivation(id, this)
    if (!alreadyBaking) {
      await Promise.race([
        baking,
        new Promise((resolveSleep) => setTimeout(resolveSleep, DERIVE_WAIT_MS)),
      ])
    }
    const baked = this.cache.get(id)
    if (baked) return baked
    if (this.errorCache.has(id)) return null

    // Still baking (or the bake landed for an already-moved revision): serve
    // the last-good artifact, stale. Viewers refresh when the bake lands.
    const staleParsed = this.tryHydrateArtifact(topology, { allowStale: true })
    if (staleParsed) {
      staleParsed.stale = true
      return staleParsed
    }
    return null
  }

  /** Whether a background bake is in flight for this topology. */
  deriving(id: string): boolean {
    return isDeriving(id)
  }

  /** Fire-and-forget bake — call after a sync so the artifact is ready before the next view. */
  precompute(id: string): void {
    void kickDerivation(id, this)
  }

  /**
   * The revision of the CONTENT currently served (the artifact's
   * built_revision, falling back to the composition revision when no artifact
   * exists). The share SSE stream sends this — viewers must refetch when the
   * served content changes (a bake landing), not when an input changes (the
   * stale artifact they already have would just be refetched).
   */
  servedRevisionOf(id: string): number {
    try {
      const row = this.db
        .query('SELECT built_revision AS r FROM topology_resolved_graph WHERE topology_id = ?')
        .get(id) as { r: number } | undefined
      if (row && typeof row.r === 'number') return row.r
    } catch {
      // fall through
    }
    return this.compositionRevisionOf(id)
  }

  /**
   * Finalize a Worker bake: compose the ParsedTopology (DB-backed bits — mapping,
   * source ids — happen here, not in the Worker), persist the artifact stamped
   * with the revision the bake STARTED from, and refresh the RAM caches when
   * that revision is still current.
   */
  completeDerivation(id: string, builtRevision: number, result: DeriveResult): void {
    const topology = this.get(id)
    if (!topology) return
    // Phase 3: stamp entity ids, then FLIP node.id/link.id (on the graph AND the
    // layout + resolved artifact that share those ids) to the stable entity ids.
    // Graph, layout and resolved are flipped with one shared id map so the baked
    // artifact never disagrees with itself; the client viewer joins graph↔resolved
    // by these ids, and metrics/weathermap key on them, so all three must move
    // together. Elements the registry doesn't know keep their id.
    const stampedGraph = stampEntityIds(id, result.graph, this.db)
    const flipped = flipToEntityIds(stampedGraph, result.layout, result.resolved)
    const parsed: ParsedTopology = {
      id: topology.id,
      name: topology.name,
      graph: flipped.graph,
      layout: flipped.layout,
      resolved: flipped.resolved,
      iconDimensions: result.iconDimensions,
      metrics: this.createEmptyMetrics(flipped.graph),
      topologySourceId: this.topologySourceIdFor(topology.id),
      metricsSourceId: this.metricsSourceIdFor(topology.id),
      // buildMapping projects entity-keyed rows back through the graph's ids —
      // which ARE the entity ids post-flip — so the mapping keys line up with the
      // element ids the client sees and sends back.
      mapping: this.buildMapping(topology.id, flipped.graph),
    }
    // Persist even if the revision moved mid-bake: built_revision marks it
    // stale, and stale-but-newer beats the previous artifact for stale-serving.
    this.writeResolvedArtifact(topology, parsed, builtRevision)
    if (this.compositionRevisionOf(id) === builtRevision) {
      this.cache.set(id, parsed)
      this.renderCache.delete(id)
      this.errorCache.delete(id)
    }
  }

  /** Record a bake failure (only when the inputs haven't changed since it started). */
  recordDeriveError(id: string, builtRevision: number, message: string): void {
    const topology = this.get(id)
    if (!topology) return
    if (this.compositionRevisionOf(id) !== builtRevision) return
    const phase = message.includes('Invalid NetworkGraph') ? 'parse' : 'layout'
    this.errorCache.set(id, {
      id,
      name: topology.name,
      phase,
      message,
      timestamp: Date.now(),
    })
    console.error(
      `[TopologyService] Failed to derive topology "${topology.name}" (${id}):`,
      message,
    )
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
   * Gather the resolver inputs for a derivation bake — the DB-read half of the
   * old in-request parse. The compute half (resolve → display filter → icons →
   * layout) runs in the derive Worker (services/derive-worker.ts) so it never
   * blocks the serving event loop.
   *
   * The resolver consumes two DB-native pools, both read from the
   * contribution store (`contribution_*`):
   *   - the PROJECT OVERLAY (attachment_id NULL) — the operator's curation —
   *     fills the `authored` slot (top priority);
   *   - every attached source's contribution becomes a `SnapshotEntry` in
   *     `snapshots` — including an explicitly-added hand-drawn Manual source,
   *     which is just an ordinary source here (no special-casing).
   *
   * With no overlay, `authored` is an empty graph — the diagram is whatever the
   * attached sources produced.
   */
  collectDeriveInputs(topologyId: string): {
    authored: NetworkGraph
    snapshots: SnapshotEntry[]
    scope?: ScopeFilter
    hideDisconnected: boolean
  } | null {
    const topology = this.get(topologyId)
    if (!topology) return null
    // The `authored` slot is the PROJECT OVERLAY (DB-native, attachment_id NULL):
    // the operator's curation — exclusions, overrides, metrics bindings, settings —
    // folded as resolve()'s top-priority contribution. Absent → empty. A hand-drawn
    // Manual source is NOT here; it's an ordinary source in `snapshots` below.
    const overlay: NetworkGraph = this.readProjectOverlay(topology.id) ?? {
      version: '1',
      name: topology.name,
      nodes: [],
      links: [],
    }
    const topologySources = this.topologySources.listByTopology(topology.id)
    // Scope POLICY → which sources' regions close the world (auto/open/closed).
    // resolve() is pure mechanism: it honors `scope:'closed'` marks; we stamp them
    // here per the topology's policy, on both the scope source(s) and the overlay
    // (operator-curated regions also scope, unless the topology is 'open').
    const scopeSourceIds = computeScopeSources(
      topology.scopeMode,
      topology.scopeSourceId,
      topologySources,
    )
    const authored =
      topology.scopeMode !== 'open' && overlay.subgraphs && overlay.subgraphs.length > 0
        ? {
            ...overlay,
            subgraphs: overlay.subgraphs.map((s) => ({ ...s, scope: 'closed' as const })),
          }
        : overlay
    // Source priority feeds the resolver's field merge: when two sources
    // observe the same device, the higher-priority source wins each field it
    // holds. Mirrors `topology_data_sources.priority`. The project overlay
    // always outranks these (handled inside resolve() as the `authored` input).
    const priorityBySource = new Map<string, number>()
    const modeBySource = new Map<string, SourceMode>()
    // Mode is a TOPOLOGY-WIDE merge method (not per-source): every topology source
    // gets the same node/link contribution derived from `topology.compositionMode`.
    //   additive   → scoop / add  (sources assert nodes + links)
    //   enrichment → anchor / update (sources only enrich; assert nothing new)
    const enrich = topology.compositionMode === 'enrichment'
    for (const tds of topologySources) {
      priorityBySource.set(tds.dataSourceId, tds.priority)
      if (tds.purpose === 'topology') {
        modeBySource.set(tds.dataSourceId, {
          nodeContribution: enrich ? 'anchor' : 'scoop',
          linkContribution: enrich ? 'update' : 'add',
          closeScope: scopeSourceIds.has(tds.dataSourceId),
        })
      }
    }
    const snapshots = this.readObservedSnapshots(topology.id, priorityBySource, modeBySource)
    // Topology-level scope criteria + the display filter run in the Worker:
    // scope is enforced post-merge by resolve; hideDisconnected runs on the
    // fully-merged graph — never per-source.
    return {
      authored,
      snapshots,
      scope: topology.scope,
      hideDisconnected: authored.settings?.hideDisconnected === true,
    }
  }

  /**
   * The snapshots feeding `resolve()` — one per attached source, read DB-native
   * from the contribution store (NOT the audit log). Each source's latest graph is
   * its `contribution_source` row (attachment_id NOT NULL); `buildGraph` projects
   * the decomposed rows back to a NetworkGraph. A hand-drawn Manual source is an
   * ordinary entry here; only the project overlay (NULL) is fed elsewhere.
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
    modeBySource: Map<string, SourceMode>,
  ): SnapshotEntry[] {
    this.backfillObservedContributions(topologyId)
    // Every attached source's contribution (attachment_id NOT NULL) is a snapshot —
    // INCLUDING a hand-drawn Manual source, now an ordinary source folded by
    // priority. The project overlay (attachment_id NULL) is fed separately as
    // `authored`, and the `attachment_id IS NOT NULL` filter already excludes it,
    // so there is no double-count and no `type='manual'` branch here.
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
      const built = buildGraph(topologyId, r.source_id, this.db)
      if (!built) continue
      // Apply this source's composition mode (anchor nodes/links, closed scope)
      // before it enters resolve(). Additive (default) is a no-op.
      const mode = modeBySource.get(r.source_id)
      const graph = mode ? applySourceMode(built, mode) : built
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
   * a contribution, materialize its latest non-failed audit snapshot. Idempotent:
   * once a contribution exists, the source is skipped, so this degrades to a cheap
   * existence check.
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
      // A never-synced source (incl. a fresh hand-drawn Manual, syncMode 'manual')
      // has lastSyncedAt == null → nothing to backfill. No type='manual' branch.
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
   * Derive the element-keyed metrics mapping (axis 2) for a resolved graph from
   * the `metrics_mapping` rows (Phase 2). Each row is keyed by a stable entity
   * id; we project it back to the element id it belongs to via the graph's
   * stamped `entityId`s, following aliases so a row stored against a pre-merge id
   * still resolves to its survivor. Only rows of a currently-attached metrics
   * source count (a row left by a detached source must not keep driving the
   * mapping). Used by both a fresh resolve and an artifact hydrate so the two
   * agree; the graph MUST be the entityId-stamped resolved graph.
   */
  private buildMapping(topologyId: string, graph: NetworkGraph): MetricsMapping | undefined {
    // Fix 1 (#547): with the new PK (topology_id, entity_id, source_id) an entity
    // can have one row PER source. Apply source-priority precedence: the source with
    // the lowest `priority` value in topology_data_sources wins (same convention as
    // the poller merge in server.ts — lower priority number = higher precedence).
    // listByPurpose returns rows ORDER BY priority (ascending), so the first entry in
    // the ordered list is the highest-priority source.
    const orderedSources = this.topologySources.listByPurpose(topologyId, 'metrics')
    const activeSourceIds = new Set(orderedSources.map((s) => s.dataSourceId))
    // Build a rank map: source id → its position in the priority-ordered list
    // (0 = highest priority). Lower rank wins when two sources map the same entity.
    const sourceRank = new Map(orderedSources.map((s, i) => [s.dataSourceId, i]))

    // Trust boundary: DB read — cast entity_id to EntityId via castMappingRow.
    const rows = (
      this.db
        .query(
          'SELECT entity_id, kind, source_id, payload_json FROM metrics_mapping WHERE topology_id = ?',
        )
        .all(topologyId) as {
        entity_id: string
        kind: string
        source_id: string
        payload_json: string
      }[]
    ).map(castMappingRow)
    if (rows.length === 0) return undefined

    const { nodeByEntity, linkKeyByEntity, linkByEntity } = this.indexGraphEntities(graph)
    const nodeById = new Map(graph.nodes.map((n) => [n.id, n]))
    const nodes: Record<string, NodeMetricsMapping> = {}
    const links: Record<string, LinkMetricsMapping> = {}
    // Track which source rank last wrote each element key so a lower-rank (higher
    // priority) source can override what a higher-rank source wrote earlier.
    const nodeWinnerRank = new Map<string, number>()
    const linkWinnerRank = new Map<string, number>()
    for (const row of rows) {
      if (!activeSourceIds.has(row.source_id)) continue
      const rank = sourceRank.get(row.source_id) ?? Number.MAX_SAFE_INTEGER
      const eid = resolveEntityAlias(row.entity_id, this.db)
      if (row.kind === 'node') {
        const node = nodeByEntity.get(eid)
        if (!node) continue
        const existingRank = nodeWinnerRank.get(node.id) ?? Number.MAX_SAFE_INTEGER
        if (rank < existingRank) {
          nodes[node.id] = JSON.parse(row.payload_json) as NodeMetricsMapping
          nodeWinnerRank.set(node.id, rank)
        }
      } else if (row.kind === 'link') {
        const linkKey = linkKeyByEntity.get(eid)
        const link = linkByEntity.get(eid)
        if (!linkKey || !link) continue
        const existingRank = linkWinnerRank.get(linkKey) ?? Number.MAX_SAFE_INTEGER
        if (rank >= existingRank) continue
        const stored = JSON.parse(row.payload_json) as StoredLinkMapping
        // Re-derive the monitored node's CURRENT element id — never emit the
        // stored value, which after the Phase 3 id flip is a stale reference the
        // poller can't resolve.
        const monitoredNodeId = this.resolveMonitoredNodeId(stored, link, nodeByEntity, nodeById)
        if (!monitoredNodeId) continue // can't anchor → orphan, not a dangling ref
        links[linkKey] = {
          monitoredNodeId,
          interface: stored.interface,
          bandwidth: stored.bandwidth,
        }
        linkWinnerRank.set(linkKey, rank)
      }
    }
    const has = Object.keys(nodes).length > 0 || Object.keys(links).length > 0
    return has ? { nodes, links } : undefined
  }

  /**
   * Index a resolved graph's stamped entity ids: `entityId → node`,
   * `entityId → link mapping key` (`link.id || link-${i}`), and the set of all
   * entity ids present. Shared by the mapping projection and orphan detection so
   * both agree on which entities the current graph carries.
   */
  private indexGraphEntities(graph: NetworkGraph): {
    nodeByEntity: Map<EntityId, Node>
    linkKeyByEntity: Map<EntityId, string>
    linkByEntity: Map<EntityId, Link>
    presentEntityIds: Set<EntityId>
  } {
    const nodeByEntity = new Map<EntityId, Node>()
    const linkKeyByEntity = new Map<EntityId, string>()
    const linkByEntity = new Map<EntityId, Link>()
    const presentEntityIds = new Set<EntityId>()
    for (const node of graph.nodes) {
      if (node.entityId) {
        nodeByEntity.set(node.entityId, node)
        presentEntityIds.add(node.entityId)
      }
    }
    graph.links.forEach((link, i) => {
      if (link.entityId) {
        linkKeyByEntity.set(link.entityId, link.id || `link-${i}`)
        linkByEntity.set(link.entityId, link)
        presentEntityIds.add(link.entityId)
      }
    })
    return { nodeByEntity, linkKeyByEntity, linkByEntity, presentEntityIds }
  }

  /**
   * Resolve a stored link mapping to the monitored node's CURRENT resolved
   * element id. Prefers the persisted entity id (alias-followed → current id).
   * Legacy rows (written before the Phase 3 id flip) stored a now-stale element
   * id instead: the monitored node is one of the link's two endpoints, so the
   * monitored interface name picks which end, and a still-current id (unstamped
   * element that never flipped) matches an endpoint directly. Returns undefined
   * when nothing anchors, so the caller surfaces an orphan rather than emitting a
   * dangling reference the poller would silently drop.
   */
  private resolveMonitoredNodeId(
    stored: StoredLinkMapping,
    link: Link,
    nodeByEntity: ReadonlyMap<EntityId, Node>,
    nodeById: ReadonlyMap<string, Node>,
  ): string | undefined {
    if (stored.monitoredNodeEntityId) {
      const node = nodeByEntity.get(resolveEntityAlias(stored.monitoredNodeEntityId, this.db))
      if (node) return node.id
    }
    // Legacy row (pre-Phase-3): the monitored node is one of the link's two
    // endpoints. The stored interface name identifies which end (matched against
    // the endpoint port's id / ifName / label), and a still-current node id
    // (an unstamped element that never flipped) matches an endpoint directly.
    const iface = stored.interface
    if (iface) {
      const fromMatches = endpointMatchesInterface(nodeById, link.from, iface)
      const toMatches = endpointMatchesInterface(nodeById, link.to, iface)
      // Fix 4 (#547): if the interface name matches BOTH endpoints (LAG /
      // parallel links / same-named ports on each side), we cannot tell which
      // end the operator meant. Return undefined so the row surfaces as an
      // orphan the operator can repair, rather than silently guessing wrong
      // half the time.
      if (fromMatches && toMatches) return undefined
      if (fromMatches) return link.from.node
      if (toMatches) return link.to.node
    }
    if (stored.monitoredNodeId === link.from.node) return link.from.node
    if (stored.monitoredNodeId === link.to.node) return link.to.node
    return undefined
  }

  /**
   * Metrics-mapping rows that cannot be projected onto the current resolved
   * graph — the drift surface (Terraform-style) the operator must repair.
   * Two categories:
   *
   *   1. The entity is NOT present in the current graph (the element was removed
   *      or retired). Element ids are unknown (the element is gone), so entries
   *      are reported by entity id + kind + payload.
   *
   *   2. Fix 4 (#547): a link row whose stored interface name matches BOTH
   *      endpoints (LAG / parallel links / same-named ports) — resolveMonitoredNodeId
   *      returns undefined to avoid a silent wrong-endpoint guess, so the row
   *      can't project and must surface here so the operator can reassign or
   *      discard it.
   *
   * Alias-following keeps a merged entity from showing as an orphan. Scoped to
   * the active metrics source(s); a row left by a detached source is inactive,
   * not an orphan.
   */
  async mappingOrphans(
    id: string,
  ): Promise<{ entityId: string; kind: string; sourceId: string; payload: unknown }[]> {
    const parsed = await this.getParsed(id)
    if (!parsed) return []
    const activeSourceIds = new Set(
      this.topologySources.listByPurpose(id, 'metrics').map((s) => s.dataSourceId),
    )
    // Trust boundary: DB read — cast entity_id to EntityId via castMappingRow.
    const rows = (
      this.db
        .query(
          'SELECT entity_id, kind, source_id, payload_json FROM metrics_mapping WHERE topology_id = ?',
        )
        .all(id) as { entity_id: string; kind: string; source_id: string; payload_json: string }[]
    ).map(castMappingRow)
    const { presentEntityIds, linkByEntity } = this.indexGraphEntities(parsed.graph)
    const nodeById = new Map(parsed.graph.nodes.map((n) => [n.id, n]))
    const nodeByEntity = new Map(
      parsed.graph.nodes.filter((n) => n.entityId).map((n) => [n.entityId as EntityId, n]),
    )
    const orphans: { entityId: string; kind: string; sourceId: string; payload: unknown }[] = []
    for (const row of rows) {
      if (!activeSourceIds.has(row.source_id)) continue
      const eid = resolveEntityAlias(row.entity_id, this.db)
      if (!presentEntityIds.has(eid)) {
        // Category 1: entity not in current graph.
        orphans.push({
          entityId: row.entity_id,
          kind: row.kind,
          sourceId: row.source_id,
          payload: JSON.parse(row.payload_json),
        })
        continue
      }
      // Category 2: link row whose monitored node can't be resolved (ambiguous
      // interface or missing anchor). Only check link rows — node rows don't need
      // an endpoint resolution step.
      if (row.kind === 'link') {
        const link = linkByEntity.get(eid)
        if (link) {
          const stored = JSON.parse(row.payload_json) as StoredLinkMapping
          const monitoredNodeId = this.resolveMonitoredNodeId(stored, link, nodeByEntity, nodeById)
          if (!monitoredNodeId) {
            orphans.push({
              entityId: row.entity_id,
              kind: row.kind,
              sourceId: row.source_id,
              payload: JSON.parse(row.payload_json),
            })
          }
        }
      }
    }
    return orphans
  }

  /**
   * Server-side link auto-map: for each unmapped link whose endpoint nodes are
   * mapped to hosts, resolves the monitored endpoint + interface by matching the
   * endpoint port's identity keys (id / ifName / label) against the metrics
   * source's reported interfaces. Writes via updateMapping so results are
   * entity-keyed and durable. Returns a summary { matched, total, skipped }.
   *
   * The `overwrite` option controls whether links that already have both a
   * monitored node and an interface set are re-matched (true) or skipped (false).
   *
   * `opts.sourceId` — fetch interfaces from this specific metrics source and
   * persist results under it (Wave B-3, #569). Must be an ATTACHED
   * `metrics`-purpose source; signals `error: 'invalidSource'` when not.
   * When omitted the first source is used (backward compatible).
   */
  async autoMapLinks(
    id: string,
    dataSourceService: DataSourceService,
    opts: { overwrite?: boolean; sourceId?: string } = {},
  ): Promise<{ matched: number; total: number; skipped: number; error?: 'invalidSource' }> {
    const parsed = await this.getParsed(id)
    if (!parsed) throw new Error('topology not resolved; cannot auto-map links')
    const total = parsed.graph.links.length

    // Resolve which metrics source to use (Wave B-3, #569).
    let sourceId: string | undefined
    if (opts.sourceId) {
      const attached = this.topologySources.listByPurpose(id, 'metrics')
      const found = attached.find((s) => s.dataSourceId === opts.sourceId)
      if (!found) return { matched: 0, total, skipped: 0, error: 'invalidSource' }
      sourceId = opts.sourceId
    } else {
      sourceId = this.metricsSourceIdFor(id)
    }

    if (!sourceId) return { matched: 0, total, skipped: 0 }

    const currentMapping = parsed.mapping ?? { nodes: {}, links: {} }
    const nodeById = new Map(parsed.graph.nodes.map((n) => [n.id, n]))
    // hostId keyed by nodeId, from the current node mapping.
    const hostByNode = new Map<string, string>()
    for (const [nodeId, nm] of Object.entries(currentMapping.nodes ?? {})) {
      if (nm.hostId) hostByNode.set(nodeId, nm.hostId)
    }

    // Pre-fetch every referenced host's interface list ONCE (server-side, no
    // per-link browser round-trips — the whole point of this endpoint). The
    // planner then runs purely against these lists.
    const ifacesByHost = new Map<string, string[]>()
    for (const hostId of new Set(hostByNode.values())) {
      const items = await dataSourceService.getHostItems(sourceId, hostId)
      // The INTERFACE NAME is what port identities match — never the full,
      // per-direction item `name` (see extractInterfaceNames).
      ifacesByHost.set(hostId, extractInterfaceNames(items))
    }

    // Port identity candidates for an endpoint: id (== ifName for inventory
    // sources), identity.ifName, label, and aliases — in preference order.
    const portCandidates = (nodeId: string, portId: string): string[] => {
      const port = nodeById.get(nodeId)?.ports?.find((p) => p.id === portId)
      if (!port) return portId ? [portId] : []
      const label = Array.isArray(port.label) ? port.label[0] : port.label
      return [port.id, port.identity?.ifName, label, ...(port.aliases ?? [])].filter(
        (s): s is string => typeof s === 'string' && s.length > 0,
      )
    }

    const plan = planLinkAutoMap(
      parsed.graph.links.map((link, i) => ({
        key: link.id || `link-${i}`,
        from: { node: link.from.node, port: link.from.port ?? '' },
        to: { node: link.to.node, port: link.to.port ?? '' },
      })),
      currentMapping.links ?? {},
      {
        hostForNode: (nodeId) => hostByNode.get(nodeId),
        portCandidates,
        interfacesForHost: (hostId) => ifacesByHost.get(hostId) ?? [],
      },
      { overwrite: opts.overwrite ?? false },
    )

    // Fold the resolved links onto the current mapping and persist via
    // updateMapping so rows are entity-keyed (Phase 2) and durable (Phase 3).
    // Pass the resolved sourceId so the write targets the same source whose
    // interfaces were fetched (Wave B-3, #569).
    if (plan.matched > 0) {
      const newMapping: MetricsMapping = {
        nodes: { ...(currentMapping.nodes ?? {}) },
        links: { ...(currentMapping.links ?? {}), ...plan.resolved },
      }
      await this.updateMapping(id, newMapping, { sourceId })
    }

    return { matched: plan.matched, total, skipped: plan.skipped }
  }

  /**
   * Reassign an orphaned metrics_mapping row to a live entity (Phase 4).
   * Validates that the target entity exists in the current resolved graph and
   * that the orphan and target kinds match. Returns `ok: false` with a reason
   * when either check fails, so the caller surfaces WHY a repair was refused.
   *
   * Semantics note: "orphaned" means absent from the CURRENT graph, which can
   * be transient (an observation gap). If the original entity is later
   * re-observed, it comes back UNMAPPED — the moved rows stay with the target
   * (the operator's explicit choice is never silently reverted). Reassignment
   * is therefore only the *final* answer for permanently removed elements; a
   * returning device needs a fresh mapping (auto-map re-covers it).
   *
   * Fix 1 (#547): with the new PK (topology_id, entity_id, source_id) an orphaned
   * entity can have multiple rows (one per source). Reassign moves ALL of that
   * entity's rows to the target entity id — all sources' bindings travel together.
   * This preserves every source's payload without information loss.
   */
  async reassignOrphan(
    topologyId: string,
    entityId: string,
    toEntityId: string,
  ): Promise<{ ok: boolean; error?: string }> {
    const parsed = await this.getParsed(topologyId)
    if (!parsed) return { ok: false, error: 'topology not resolved' }

    // Trust boundary: entityId and toEntityId arrive from HTTP params — validated by the DB
    // lookup that follows (if the id isn't in metrics_mapping the lookup returns null).
    const brandedEntityId = asEntityId(entityId)
    const brandedToEntityId = asEntityId(toEntityId)

    // Verify at least one orphan row exists for this entity (nothing to move otherwise).
    // Use the first row to determine kind for validation.
    const orphanRow = this.db
      .query<
        { entity_id: string; kind: string; source_id: string; payload_json: string },
        [string, string]
      >(
        'SELECT entity_id, kind, source_id, payload_json FROM metrics_mapping WHERE topology_id = ? AND entity_id = ? LIMIT 1',
      )
      .get(topologyId, brandedEntityId)
    if (!orphanRow) return { ok: false, error: 'orphan not found' }
    const typedOrphanRow = castMappingRow(orphanRow)

    const { presentEntityIds, nodeByEntity, linkKeyByEntity } = this.indexGraphEntities(
      parsed.graph,
    )
    // Follow aliases so a caller passing a pre-merge id still lands on the survivor.
    const resolvedTarget = resolveEntityAlias(brandedToEntityId, this.db)
    if (!presentEntityIds.has(resolvedTarget)) {
      return { ok: false, error: 'target entity not in current graph' }
    }

    // Kind must match (node→node, link→link) — a link binding on a node makes
    // no sense to the poller.
    if (typedOrphanRow.kind === 'node' && !nodeByEntity.has(resolvedTarget)) {
      return { ok: false, error: 'kind mismatch: target is not a node' }
    }
    if (typedOrphanRow.kind === 'link' && !linkKeyByEntity.has(resolvedTarget)) {
      return { ok: false, error: 'kind mismatch: target is not a link' }
    }

    // Move ALL rows for this entity (one per source) to the target entity id.
    this.db
      .query('UPDATE metrics_mapping SET entity_id = ? WHERE topology_id = ? AND entity_id = ?')
      .run(resolvedTarget, topologyId, brandedEntityId)
    // The mapping is re-derived from these rows on every read → only drop the
    // RAM cache; no resolve/layout re-run needed.
    this.invalidateMappingCache(topologyId)
    return { ok: true }
  }

  /**
   * Discard an orphaned metrics_mapping row (Phase 4). Returns true when a row
   * was deleted, false when the entity had no row.
   *
   * Fix 1 (#547): with the new PK (topology_id, entity_id, source_id) an orphaned
   * entity can have multiple rows (one per source). Discard deletes ALL of that
   * entity's rows — all sources' bindings are removed together, which is the
   * correct "forget this broken mapping" semantics.
   */
  discardOrphan(topologyId: string, entityId: string): boolean {
    // Trust boundary: entityId arrives from HTTP params — validated by the DB lookup.
    const brandedEntityId = asEntityId(entityId)
    const result = this.db
      .query('DELETE FROM metrics_mapping WHERE topology_id = ? AND entity_id = ?')
      .run(topologyId, brandedEntityId)
    if (result.changes > 0) this.invalidateMappingCache(topologyId)
    return result.changes > 0
  }

  /**
   * Full registry reset (Phase 4): wipe entity_registry, entity_identity_key,
   * entity_alias, entity_retire_counter, and metrics_mapping for this topology.
   * The next resolve re-mints fresh entities. DISTINCT from Rebuild (which keeps
   * the human/entity layer); this discards every stable id and mapping — the
   * "complete re-initialization" the design mentions. Guard with a confirm in
   * the UI (it drops durable mappings).
   */
  resetRegistry(topologyId: string): void {
    // entity_identity_key, entity_alias, and entity_retire_counter all cascade
    // on entity_registry delete (via their entity_id FKs). metrics_mapping does
    // NOT cascade (no FK to entity_registry), so delete it explicitly first.
    this.db.query('DELETE FROM metrics_mapping WHERE topology_id = ?').run(topologyId)
    this.db.query('DELETE FROM entity_registry WHERE topology_id = ?').run(topologyId)
    this.clearCacheEntry(topologyId)
  }

  /** Current composition revision for a topology (0 if column/row missing). */
  /**
   * Current composition revision (bumped on every invalidation). Public:
   * the share SSE stream sends it so viewers can refetch the graph on
   * real changes instead of polling on a timer.
   */
  compositionRevisionOf(id: string): number {
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
   * With `allowStale`, the revision check is skipped — the serving layer uses
   * this to keep showing the last-good diagram while a bake is in flight (the
   * resolver-version check still applies; a wrong-shape artifact never serves).
   * Returns null on any miss/staleness/parse error so the caller recomputes.
   * Metrics are always rebuilt empty (live values come per-poll); mapping is
   * re-derived from the stored graph so it tracks binding/residual edits.
   */
  private tryHydrateArtifact(
    topology: Topology,
    opts?: { allowStale?: boolean },
  ): ParsedTopology | null {
    try {
      const row = this.db
        .query('SELECT * FROM topology_resolved_graph WHERE topology_id = ?')
        .get(topology.id) as ResolvedGraphRow | undefined
      if (!row?.layout_json) return null
      if (row.resolver_version !== RESOLVER_VERSION) return null
      if (!opts?.allowStale && row.built_revision !== this.compositionRevisionOf(topology.id))
        return null

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
   * Read the PROJECT OVERLAY — the project's own top-priority contribution
   * (`attachment_id` NULL, `source_id` = {@link PROJECT_SOURCE}). Holds the
   * operator's curation: exclusions, field overrides, metrics bindings, and
   * graph-level display settings. Fed to `resolve()` as `authored`. Returns null
   * when the project has no overlay yet.
   *
   * Public so the discovery-policy / mapping APIs can read it to mutate.
   *
   * No legacy fallback: `migrateManualToProject` (startup) moves any pre-refactor
   * operator content into this NULL slot. A hand-drawn Manual *source* now records
   * its own observations like any source, so reading its observations here would
   * wrongly conflate source content with the overlay.
   */
  readProjectOverlay(topologyId: string): NetworkGraph | null {
    return buildGraph(topologyId, PROJECT_SOURCE, this.db)
  }

  /**
   * MIGRATION-ONLY: read the pre-refactor operator content from legacy Manual
   * observations (a topology may have had MULTIPLE Manual sources, #370), so
   * `migrateManualToProject` can fold it into the project overlay. Not used by the
   * live read path.
   */
  private readLegacyManualObservation(topologyId: string): NetworkGraph | null {
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

  /**
   * Persist the PROJECT OVERLAY (attachment_id NULL, {@link PROJECT_SOURCE}). This
   * is where ALL operator curation lands — exclusions, overrides, metrics bindings,
   * display settings. It is owned by the project, NOT a data source: writing it
   * never creates or attaches a Manual source (no phantom spawn, no orphan).
   * `idx_contrib_one_intrinsic` keeps it to one per topology. resolve() folds it as
   * the top-priority `authored` contribution. Per-topology: an edit to X invalidates X.
   */
  async writeProjectOverlay(topologyId: string, graph: NetworkGraph): Promise<void> {
    ingestGraph(
      topologyId,
      PROJECT_SOURCE,
      graph,
      { attachmentId: null, lastStatus: 'ok', lastOkAt: timestamp() },
      this.db,
    )
    adoptOrMintForGraph(topologyId, PROJECT_SOURCE, this.db)
    this.clearCacheEntry(topologyId)
  }

  /**
   * One-shot migration: move all operator content out of `type='manual'` DATA
   * SOURCES into each topology's PROJECT OVERLAY (attachment_id NULL), then RETIRE
   * the Manual data sources entirely. This realizes the model where curation is
   * project-owned and Manual is reserved for future explicit hand-drawn sources
   * (manual-source-unification.md Known-gap; no backward compat — legacy Manual
   * sources are folded into the overlay and removed). Runs at startup, settings-guarded.
   *
   * For each topology with Manual content, merge it (a topology could have several
   * Manual sources + legacy observations) and ingest it as the overlay — but never
   * clobber an overlay that already has content. Then delete every Manual data
   * source: dropping its attach row cascades its contribution, and the global
   * delete also sweeps orphaned (unattached) Manual rows.
   */
  async migrateManualToProject(): Promise<void> {
    const flag = this.db
      .query("SELECT value FROM settings WHERE key = 'manual_to_project_migrated'")
      .get() as { value: string } | undefined
    if (flag?.value === '1') return

    const hasContent = (g: NetworkGraph | null): boolean =>
      !!g &&
      ((g.nodes?.length ?? 0) > 0 ||
        (g.links?.length ?? 0) > 0 ||
        (g.subgraphs?.length ?? 0) > 0 ||
        (g.terminations?.length ?? 0) > 0 ||
        (g.attachments?.length ?? 0) > 0 ||
        (g.exclusions?.length ?? 0) > 0)

    const topoRows = this.db
      .query(
        `SELECT DISTINCT tds.topology_id AS topology_id
         FROM topology_data_sources tds
         JOIN data_sources ds ON ds.id = tds.data_source_id
         WHERE ds.type = 'manual'`,
      )
      .all() as { topology_id: string }[]
    let migrated = 0
    for (const { topology_id } of topoRows) {
      // Merge every Manual source's contribution + any legacy Manual observation
      // for this topology (one-shot fold of all pre-refactor operator content).
      const manualSources = this.db
        .query(
          `SELECT ds.id AS id FROM topology_data_sources tds
           JOIN data_sources ds ON ds.id = tds.data_source_id
           WHERE tds.topology_id = ? AND ds.type = 'manual'
           ORDER BY ds.created_at ASC, ds.id ASC`,
        )
        .all(topology_id) as { id: string }[]
      const graphs: NetworkGraph[] = []
      for (const { id } of manualSources) {
        const g = buildGraph(topology_id, id, this.db)
        if (g) graphs.push(g)
      }
      const legacy = this.readLegacyManualObservation(topology_id)
      if (legacy) graphs.push(legacy)
      const content =
        graphs.length === 0
          ? null
          : graphs.length === 1
            ? (graphs[0] ?? null)
            : mergeAuthoredGraphs(graphs)

      // Never clobber an overlay that already has content.
      if (
        hasContent(content) &&
        content &&
        !hasContent(buildGraph(topology_id, PROJECT_SOURCE, this.db))
      ) {
        ingestGraph(
          topology_id,
          PROJECT_SOURCE,
          content,
          { attachmentId: null, lastStatus: 'ok', lastOkAt: timestamp() },
          this.db,
        )
        migrated++
      }
      this.clearCacheEntry(topology_id)
    }

    // Retire every Manual data source. Deleting the attach row cascades its
    // contribution (FK ON DELETE CASCADE); the global deletes sweep leftovers and
    // orphans. Manual is now created fresh, on explicit add, for hand-drawing only.
    const manualDs = this.db.query("SELECT id FROM data_sources WHERE type = 'manual'").all() as {
      id: string
    }[]
    for (const { id } of manualDs) {
      this.db.query('DELETE FROM topology_data_sources WHERE data_source_id = ?').run(id)
      this.db.query('DELETE FROM contribution_source WHERE source_id = ?').run(id)
      this.db.query('DELETE FROM data_sources WHERE id = ?').run(id)
    }

    this.db
      .query(
        "INSERT OR REPLACE INTO settings (key, value) VALUES ('manual_to_project_migrated', '1')",
      )
      .run()
    if (migrated > 0 || manualDs.length > 0) {
      console.log(
        `[Migration] Moved ${migrated} Manual contribution(s) into project overlays; retired ${manualDs.length} Manual data source(s).`,
      )
    }
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
   * data source itself changes (config edit — priority / connection — or
   * deletion) so attached topologies don't serve a stale resolved artifact.
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

  /**
   * Force a full re-derive with the CURRENT resolver/layout: drop the cached
   * artifact (`clearCacheEntry` bumps the composition revision so the next read
   * cannot reuse it) and kick one fresh bake. The single primitive behind
   * "Sync all" completion and the Rebuild action, and the supported way to pick
   * up a layout-code change without bumping RESOLVER_VERSION. Returns the bake
   * promise so progress-tracking callers (the sync job) can await it; request
   * handlers fire-and-forget and let stale-while-revalidate serve the old figure
   * until the bake lands.
   */
  rebake(id: string): Promise<void> {
    this.clearCacheEntry(id)
    return kickDerivation(id, this)
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

    // The sample's base graph is the project's own content → the project overlay
    // (no Manual data source is spawned).
    const created = await this.create({ name: 'Sample Network' })
    await this.writeProjectOverlay(created.id, graph)

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
