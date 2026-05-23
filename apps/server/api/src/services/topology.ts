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
  LayoutResult,
  NetworkGraph,
  ResolvedLayout,
  SnapshotEntry,
} from '@shumoku/core'
import {
  computeNetworkLayout,
  createMemoryFileResolver,
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
  private findManualSourceId(topologyId: string): string | undefined {
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
    this.cache.delete(topologyId)
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

    this.cache.delete(id)
    this.renderCache.delete(id)

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

    this.cache.delete(id)
    this.renderCache.delete(id)

    return this.get(id)
  }

  /**
   * Update metrics mapping for a topology
   */
  updateMapping(id: string, mapping: MetricsMapping): Topology | null {
    const existing = this.get(id)
    if (!existing) {
      return null
    }

    const mappingJson = JSON.stringify(mapping)
    this.db
      .query('UPDATE topologies SET mapping_json = ?, updated_at = ? WHERE id = ?')
      .run(mappingJson, timestamp(), id)

    // Clear cache to force re-parse
    this.cache.delete(id)
    this.renderCache.delete(id)

    return this.get(id)
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

    try {
      const parsed = await this.parseTopology(topology)
      this.cache.set(id, parsed)
      this.errorCache.delete(id)
      return parsed
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      const phase = message.includes('Invalid NetworkGraph') ? 'parse' : 'layout'
      this.errorCache.set(id, {
        id,
        name: topology.name,
        phase,
        message,
        timestamp: Date.now(),
      })
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
    const latest = this.observations.latestPerSource(topology.id)
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
    const snapshots: SnapshotEntry[] = latest
      .filter((o) => o.sourceId !== manualId)
      .map((o) => ({
        sourceId: o.sourceId,
        capturedAt: o.capturedAt,
        status: o.status,
        graph: o.graph,
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

    let mapping: MetricsMapping | undefined
    if (topology.mappingJson) {
      try {
        mapping = JSON.parse(topology.mappingJson) as MetricsMapping
      } catch {
        // Invalid JSON, ignore
      }
    }

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
   * Clear all cached topologies
   */
  clearCache(): void {
    this.cache.clear()
    this.renderCache.clear()
    this.errorCache.clear()
  }

  /**
   * Clear cached topology by ID
   */
  clearCacheEntry(id: string): void {
    this.cache.delete(id)
    this.renderCache.delete(id)
    this.errorCache.delete(id)
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
