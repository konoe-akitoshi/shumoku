/**
 * Topology Service
 * Manages network topologies with database persistence.
 *
 * Storage model (post-migration-010): the `topologies` table holds
 * only the topology shell (name, mapping, share_token, etc). All graph
 * content — including human-authored content from the editor — lives
 * in `topology_observations`, indexed by source.
 *
 * The editor 's "save" routes through this service 's `create()` /
 * `update()` `contentJson` input. Internally that translates to:
 * find-or-create a Manual data source attached to this topology, then
 * record a fresh observation against it. The `Topology.contentJson`
 * field returned by `get()` is a virtual view of that latest Manual
 * observation — there is no `content_json` column.
 */

import type { Database } from 'bun:sqlite'
import type {
  IconDimensions,
  Identity,
  LayoutResult,
  MetricsBindingAttachment,
  NetworkGraph,
  Node,
  ResolvedLayout,
  SnapshotEntry,
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
import { ObservationsService } from './observations.js'
import { TopologySourcesService } from './topology-sources.js'

/** Bare topology row — no content_json column post-migration-010. */
interface TopologyRow {
  id: string
  name: string
  topology_source_id: string | null
  metrics_source_id: string | null
  mapping_json: string | null
  share_token: string | null
  created_at: number
  updated_at: number
}

function rowToTopology(row: TopologyRow): Topology {
  return {
    id: row.id,
    name: row.name,
    // contentJson + manualSourceId populated by withManual() at the call site
    topologySourceId: row.topology_source_id ?? undefined,
    metricsSourceId: row.metrics_source_id ?? undefined,
    mappingJson: row.mapping_json ?? undefined,
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
const RESOLVER_VERSION = 1

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
  private observations: ObservationsService
  private topologySources: TopologySourcesService

  constructor() {
    this.db = getDatabase()
    this.observations = new ObservationsService()
    this.topologySources = new TopologySourcesService()
  }

  /**
   * Attach `manualSourceId` to a bare Topology row. Public API
   * intentionally does NOT carry the Manual snapshot here — the
   * editor / settings UI reads it through
   * `GET /api/topologies/:id/sources/:sid/latest-snapshot` instead.
   * Mixing snapshot content into the Topology shell was structurally
   * confusing (Topology.contentJson read like "project JSON" when it
   * was really one source 's input).
   */
  private hydrateManualId(topology: Topology): Topology {
    const manualId = this.findManualSourceId(topology.id)
    if (!manualId) return topology
    return { ...topology, manualSourceId: manualId }
  }

  /**
   * Find the Manual data source id attached to a topology, if any.
   * Returns the *data source* id (PK of `data_sources`), not the
   * junction row id.
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
   * when the body is `{ type: 'manual' }`. Caller should 409 if a
   * Manual is already attached (we don 't double-check here so the
   * endpoint can craft a clearer message).
   */
  async attachManualSource(
    topologyId: string,
    purpose: 'topology' | 'metrics' = 'topology',
  ): Promise<{ dataSourceId: string }> {
    const now = timestamp()
    const dsId = await generateId()
    // Seed config_json with an empty graph so the editor opens on a
    // blank canvas. Manual content lives here, not in observations
    // (see migration 011).
    const emptyConfig = JSON.stringify({
      graph: { version: '1', nodes: [], links: [] },
    })
    this.db
      .prepare(
        `INSERT INTO data_sources (id, name, type, config_json, status, fail_count, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(dsId, 'Manual', 'manual', emptyConfig, 'connected', 0, now, now)
    await this.topologySources.add(topologyId, {
      dataSourceId: dsId,
      purpose,
      syncMode: 'manual',
    })
    this.clearCacheEntry(topologyId)
    return { dataSourceId: dsId }
  }

  /**
   * Get all topologies from the database. Hydrates `manualSourceId`
   * via a single JOIN so list-page links can point straight at the
   * Manual source 's detail page.
   */
  list(): Topology[] {
    const rows = this.db
      .query(
        `SELECT t.*, ds.id AS manual_source_id
         FROM topologies t
         LEFT JOIN topology_data_sources tds ON tds.topology_id = t.id
         LEFT JOIN data_sources ds ON ds.id = tds.data_source_id AND ds.type = 'manual'
         GROUP BY t.id
         ORDER BY t.name ASC`,
      )
      .all() as (TopologyRow & { manual_source_id: string | null })[]
    return rows.map((row) => {
      const base = rowToTopology(row)
      if (row.manual_source_id) base.manualSourceId = row.manual_source_id
      return base
    })
  }

  /**
   * Get a single topology by ID, with contentJson hydrated from the
   * latest Manual observation.
   */
  get(id: string): Topology | null {
    const row = this.db.query('SELECT * FROM topologies WHERE id = ?').get(id) as
      | TopologyRow
      | undefined
    return row ? this.hydrateManualId(rowToTopology(row)) : null
  }

  /**
   * Get a topology by name.
   */
  getByName(name: string): Topology | null {
    const row = this.db.query('SELECT * FROM topologies WHERE name = ?').get(name) as
      | TopologyRow
      | undefined
    return row ? this.hydrateManualId(rowToTopology(row)) : null
  }

  /**
   * Create a new topology shell. No sources, no content. Callers attach
   * Manual / NetBox / SNMP via `POST /topologies/:id/sources` afterwards.
   * Keeping create() to the topology shell only mirrors the structure:
   * Topology owns name + mapping + share state; sources own graph content.
   */
  async create({
    name,
    topologySourceId,
    metricsSourceId,
    mappingJson,
  }: TopologyInput): Promise<Topology> {
    const id = await generateId()
    const now = timestamp()

    this.db
      .prepare(
        `INSERT INTO topologies (id, name, topology_source_id, metrics_source_id, mapping_json, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        name,
        topologySourceId || null,
        metricsSourceId || null,
        mappingJson || null,
        now,
        now,
      )

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
    if (input.topologySourceId !== undefined) {
      updates.push('topology_source_id = ?')
      values.push(input.topologySourceId || null)
    }
    if (input.metricsSourceId !== undefined) {
      updates.push('metrics_source_id = ?')
      values.push(input.metricsSourceId || null)
    }
    if (input.mappingJson !== undefined) {
      updates.push('mapping_json = ?')
      values.push(input.mappingJson || null)
    }

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
   * Update the metrics mapping for a topology.
   *
   * Node host bindings that can be anchored to a resolved node's identity (and
   * for which the topology has a metrics source) are written as identity-keyed
   * `metrics-binding` attachments on the authored overlay — so they follow
   * re-sync by construction (composition-store Phase 2). Everything that can't
   * yet be anchored (nodes with no identity, and ALL link bindings, which are
   * staged behind port identity) stays in the legacy `topologies.mapping_json`
   * blob. Each entry lives in exactly ONE place, so reads
   * (`deriveMappingFromGraph` ∪ mapping_json) never see a divergent duplicate.
   *
   * Re-applying a topology's existing mapping through this method IS the Phase 2
   * backfill: anchorable nodes migrate to bindings, the residual shrinks.
   */
  async updateMapping(id: string, mapping: MetricsMapping): Promise<Topology | null> {
    const existing = this.get(id)
    if (!existing) return null

    const sourceId = this.metricsSourceIdFor(id)
    const parsed = await this.getParsed(id)
    // Refuse to reconcile against an unresolved graph: with no node identities,
    // EVERY existing binding for the source would be stripped (the reconcile
    // sees an empty desired set). A transient resolve failure must not wipe
    // bindings — surface it so the caller can retry. (PATCH guards too, but PUT
    // calls this directly.)
    if (!parsed) {
      throw new Error(
        'cannot resolve topology graph; refusing to update mapping (would drop bindings)',
      )
    }
    const identityByNodeId = new Map<string, Identity | undefined>(
      parsed.graph.nodes.map((n) => [n.id, n.identity]),
    )

    // Split: anchorable node bindings vs the residual (kept in mapping_json).
    const residual: MetricsMapping = {
      nodes: {},
      links: { ...(mapping.links ?? {}) },
    }
    const desired: Array<{
      nodeId: string
      identity: Identity
      hostId?: string
      hostName?: string
    }> = []
    for (const [nodeId, nm] of Object.entries(mapping.nodes ?? {})) {
      const identity = identityByNodeId.get(nodeId)
      const anchorable = sourceId && identity && hasAnyIdentityKey(identity)
      if (anchorable && (nm.hostId || nm.hostName)) {
        desired.push({ nodeId, identity, hostId: nm.hostId, hostName: nm.hostName })
      } else {
        residual.nodes[nodeId] = nm
      }
    }

    // Reconcile bindings onto the authored overlay (also removes ones the new
    // mapping dropped, so "clear" works).
    if (sourceId) {
      await this.reconcileNodeBindings(id, sourceId, desired)
    }

    // Persist the residual (null when empty so the column can later be dropped).
    const residualEmpty =
      Object.keys(residual.nodes).length === 0 && Object.keys(residual.links).length === 0
    this.db
      .query('UPDATE topologies SET mapping_json = ?, updated_at = ? WHERE id = ?')
      .run(residualEmpty ? null : JSON.stringify(residual), timestamp(), id)

    this.clearCacheEntry(id)
    return this.get(id)
  }

  /** The metrics data source id for a topology (m2m purpose='metrics', legacy fallback). */
  private metricsSourceIdFor(topologyId: string): string | undefined {
    const metrics = this.topologySources.listByPurpose(topologyId, 'metrics')
    return metrics[0]?.dataSourceId ?? this.get(topologyId)?.metricsSourceId
  }

  /**
   * Reconcile this metrics source's node bindings on the authored overlay so it
   * holds EXACTLY `desired`: strip every existing `metrics-binding:${sourceId}`
   * attachment, then re-add for each desired node (anchored by identity so the
   * binding survives re-sync). Pure-overlay nodes left with no remaining claim
   * are dropped. Mirrors the discovery-policy authored-overlay rail.
   */
  private async reconcileNodeBindings(
    topologyId: string,
    sourceId: string,
    desired: Array<{ nodeId: string; identity: Identity; hostId?: string; hostName?: string }>,
  ): Promise<void> {
    const manualId = await this.ensureManualSource(topologyId)
    const topology = this.get(topologyId)
    const authored = this.readManualGraph(manualId) ?? {
      version: '1' as const,
      name: topology?.name ?? 'Manual',
      nodes: [],
      links: [],
    }
    const key = `metrics-binding:${sourceId}`
    const stripBinding = (n: Node): Node => {
      if (!n.attachments?.some((a) => attachmentKey(a) === key)) return n
      const attachments = n.attachments.filter((a) => attachmentKey(a) !== key)
      return { ...n, attachments: attachments.length > 0 ? attachments : undefined }
    }
    let nodes = authored.nodes.map(stripBinding)

    for (const b of desired) {
      const attachment: MetricsBindingAttachment = {
        kind: 'metrics-binding',
        sourceId,
        ...(b.hostId ? { hostId: b.hostId } : {}),
        ...(b.hostName ? { hostName: b.hostName } : {}),
      }
      const idx = nodes.findIndex((n) => identitiesMatch(n.identity, b.identity))
      if (idx >= 0) {
        const cur = nodes[idx]
        if (!cur) continue
        const others = (cur.attachments ?? []).filter((a) => attachmentKey(a) !== key)
        nodes[idx] = { ...cur, attachments: [...others, attachment] }
      } else {
        nodes.push({ id: b.nodeId, label: '', identity: b.identity, attachments: [attachment] })
      }
    }

    // Drop thin overlay nodes that no longer carry any human claim.
    nodes = nodes.filter((n) => !isPureEmptyOverlay(n))
    this.writeManualGraph(manualId, { ...authored, nodes })
    this.clearCacheEntry(topologyId)
  }

  /**
   * One-shot Phase 2 backfill: migrate every topology's legacy `mapping_json`
   * into identity-keyed bindings by re-applying its current full mapping through
   * `updateMapping` (anchorable nodes → bindings; links + unanchorable stay in
   * the residual). Idempotent and guarded by a `settings` flag so it runs once.
   * Best-effort: a topology that fails to resolve is logged and left untouched
   * (its `mapping_json` survives, so nothing is lost).
   */
  async backfillMetricsBindings(): Promise<void> {
    const flag = this.db
      .query("SELECT value FROM settings WHERE key = 'metrics_bindings_backfilled'")
      .get() as { value: string } | undefined
    if (flag?.value === '1') return

    const rows = this.db
      .query("SELECT id FROM topologies WHERE mapping_json IS NOT NULL AND mapping_json != ''")
      .all() as { id: string }[]
    let migrated = 0
    let failed = 0
    for (const { id } of rows) {
      try {
        const parsed = await this.getParsed(id)
        if (parsed?.mapping) {
          await this.updateMapping(id, parsed.mapping)
          migrated++
        } else if (!parsed) {
          // Couldn't resolve — leave mapping_json intact and retry next start.
          failed++
        }
      } catch (err) {
        failed++
        console.warn(
          `[Backfill] metrics bindings for topology ${id}:`,
          err instanceof Error ? err.message : err,
        )
      }
    }
    // Only mark done when every topology migrated cleanly. A transient failure
    // leaves the flag unset so the next startup retries — and so dropping
    // mapping_json later (Phase 2 contract migration) stays safe.
    if (failed === 0) {
      this.db
        .query(
          "INSERT OR REPLACE INTO settings (key, value) VALUES ('metrics_bindings_backfilled', '1')",
        )
        .run()
    }
    if (migrated > 0 || failed > 0) {
      console.log(`[Backfill] metrics mapping → bindings: ${migrated} migrated, ${failed} deferred`)
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
   * The observation resolver runs here. Two pools feed it:
   *   - The Manual source 's graph (read from `data_sources.config_json.graph`
   *     — it 's stored on the source, not in observations; see
   *     migration 011). Fills the `authored` slot.
   *   - Every other attached source 's latest observation snapshot.
   *     Goes into the `snapshots` array.
   *
   * When no Manual is attached, `authored` is an empty graph — the
   * diagram is whatever the other sources produced.
   */
  private async parseTopology(topology: Topology): Promise<ParsedTopology> {
    // Latest NON-FAILED snapshot per source: a transient failed scan must not
    // drop a source's last-good nodes (C7 — failed never retracts).
    const latest = this.observations.latestSuccessfulPerSource(topology.id)
    const manualId = topology.manualSourceId
    const authored: NetworkGraph = manualId
      ? (this.readManualGraph(manualId) ?? {
          version: '1',
          name: topology.name,
          nodes: [],
          links: [],
        })
      : {
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
    // Only currently-attached sources contribute. A detached source leaves its
    // old observation rows behind, so without this filter a detached source
    // would keep feeding the resolve from stale snapshots.
    const snapshots: SnapshotEntry[] = latest
      .filter((o) => o.sourceId !== manualId && priorityBySource.has(o.sourceId))
      .map((o) => ({
        sourceId: o.sourceId,
        capturedAt: o.capturedAt,
        status: o.status,
        graph: o.graph,
        priority: priorityBySource.get(o.sourceId) ?? 0,
      }))
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
    const mapping = this.buildMapping(topology, graph)

    return {
      id: topology.id,
      name: topology.name,
      graph,
      layout: layoutResult,
      resolved,
      iconDimensions,
      metrics,
      topologySourceId: topology.topologySourceId,
      metricsSourceId: topology.metricsSourceId,
      mapping,
    }
  }

  /**
   * Derive the metrics mapping (axis 2) for a resolved graph: `metrics-binding`
   * attachments folded onto the graph by identity (so it follows re-sync),
   * unioned with the legacy `topologies.mapping_json` residual (binding wins;
   * per-link field merge so a binding's {monitoredNodeId, interface} doesn't
   * clobber a residual {bandwidth}). Pure read; used by both a fresh resolve and
   * an artifact hydrate so the two agree.
   */
  private buildMapping(topology: Topology, graph: NetworkGraph): MetricsMapping | undefined {
    const bindingMapping = deriveMappingFromGraph(graph)
    const hasBindings =
      Object.keys(bindingMapping.nodes).length > 0 || Object.keys(bindingMapping.links).length > 0
    let mapping: MetricsMapping | undefined = hasBindings ? bindingMapping : undefined
    if (topology.mappingJson) {
      try {
        const legacy = JSON.parse(topology.mappingJson) as MetricsMapping
        const links: MetricsMapping['links'] = { ...legacy.links }
        for (const [id, b] of Object.entries(bindingMapping.links)) {
          links[id] = { ...links[id], ...b }
        }
        mapping = {
          nodes: { ...legacy.nodes, ...bindingMapping.nodes },
          links,
        }
      } catch {
        // Invalid JSON, ignore — keep whatever bindings produced.
      }
    }
    return mapping
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
        topologySourceId: topology.topologySourceId,
        metricsSourceId: topology.metricsSourceId,
        mapping: this.buildMapping(topology, graph),
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
   * Read the graph stored on a Manual data source 's config_json.
   * Returns null when the source doesn 't exist, isn 't Manual, or has
   * no graph (e.g. freshly attached then config cleared by hand).
   *
   * Public so the discovery-policy API can compute / mutate the authored
   * layer without poking the data_sources table directly.
   */
  readManualGraph(sourceId: string): NetworkGraph | null {
    const row = this.db
      .query('SELECT type, config_json FROM data_sources WHERE id = ?')
      .get(sourceId) as { type: string; config_json: string } | undefined
    if (!row || row.type !== 'manual') return null
    try {
      const config = JSON.parse(row.config_json) as { graph?: NetworkGraph }
      return config.graph ?? null
    } catch {
      return null
    }
  }

  /**
   * Persist a new authored graph onto a Manual data source 's config_json.
   * Preserves any sibling keys we don 't own. Caller is responsible for
   * invalidating the topology cache (`clearCacheEntry`).
   */
  writeManualGraph(sourceId: string, graph: NetworkGraph): void {
    const row = this.db
      .query('SELECT type, config_json FROM data_sources WHERE id = ?')
      .get(sourceId) as { type: string; config_json: string } | undefined
    if (!row || row.type !== 'manual') {
      throw new Error(`Data source ${sourceId} is not a Manual source`)
    }
    let config: Record<string, unknown> = {}
    try {
      config = JSON.parse(row.config_json) as Record<string, unknown>
    } catch {
      // Corrupted config — start fresh.
    }
    config['graph'] = graph
    this.db
      .query('UPDATE data_sources SET config_json = ?, updated_at = ? WHERE id = ?')
      .run(JSON.stringify(config), timestamp(), sourceId)
  }

  /**
   * Find-or-create the Manual data source attached to this topology.
   * Returns the data-source id. Used by the discovery-policy PATCH
   * endpoint when the first override on a topology lands before the
   * operator has explicitly attached Manual.
   */
  async ensureManualSource(topologyId: string): Promise<string> {
    const existing = this.findManualSourceId(topologyId)
    if (existing) return existing
    const { dataSourceId } = await this.attachManualSource(topologyId, 'topology')
    return dataSourceId
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

    // Three-step seed mirroring the user 's flow: create topology shell,
    // attach a Manual source, then record the parsed graph as that
    // source 's first observation.
    const created = await this.create({ name: 'Sample Network' })
    const { dataSourceId } = await this.attachManualSource(created.id)
    await this.observations.record({
      topologyId: created.id,
      sourceId: dataSourceId,
      capturedAt: timestamp(),
      status: 'ok',
      graph,
    })

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
