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
   * Hydrate a bare Topology row with its Manual source 's contentJson
   * (if attached). One DB roundtrip for `data_source_id` lookup plus
   * one for the latest observation. `list()` skips this so it stays O(1)
   * per row — callers that need contentJson use `get()`.
   */
  private withManual(topology: Topology): Topology {
    const manualId = this.findManualSourceId(topology.id)
    if (!manualId) return topology
    const obs = this.observations.latestPerSource(topology.id).find((o) => o.sourceId === manualId)
    return {
      ...topology,
      manualSourceId: manualId,
      contentJson: obs?.graph ? JSON.stringify(obs.graph) : undefined,
    }
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
   * Find-or-create the Manual data source for this topology. Cardinality
   * is one-Manual-per-topology — see migration 010. New rows use the
   * standard generateId(); the `man_` prefix from the migration is only
   * a historical marker.
   */
  private async getOrCreateManualSource(topologyId: string): Promise<string> {
    const existing = this.findManualSourceId(topologyId)
    if (existing) return existing

    const now = timestamp()
    const dsId = await generateId()
    this.db
      .prepare(
        `INSERT INTO data_sources (id, name, type, config_json, status, fail_count, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(dsId, 'Manual', 'manual', '{}', 'connected', 0, now, now)
    await this.topologySources.add(topologyId, {
      dataSourceId: dsId,
      purpose: 'topology',
      syncMode: 'manual',
    })
    return dsId
  }

  /**
   * Get all topologies from the database. Hydrates `manualSourceId`
   * via a single JOIN so list-page links can point straight at the
   * Manual source 's detail page; does NOT hydrate `contentJson`
   * (would N+1 against topology_observations).
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
    return row ? this.withManual(rowToTopology(row)) : null
  }

  /**
   * Get a topology by name (hydrated).
   */
  getByName(name: string): Topology | null {
    const row = this.db.query('SELECT * FROM topologies WHERE name = ?').get(name) as
      | TopologyRow
      | undefined
    return row ? this.withManual(rowToTopology(row)) : null
  }

  /**
   * Create a new topology.
   *
   * If `contentJson` is provided, a Manual data source is created and
   * attached to the new topology, and the content is recorded as its
   * first observation. Otherwise the topology is created empty (no
   * Manual attached) — the user adds one explicitly via +Add Source.
   */
  async create({
    name,
    contentJson,
    topologySourceId,
    metricsSourceId,
    mappingJson,
  }: TopologyInput): Promise<Topology> {
    if (contentJson !== undefined) {
      // Validate before any DB writes so a bad payload fails fast.
      this.parseContent(contentJson)
    }

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

    if (contentJson !== undefined) {
      await this.recordManualSnapshot(id, contentJson, now)
    }

    this.cache.delete(id)
    this.renderCache.delete(id)

    const created = this.get(id)
    if (!created) throw new Error('Topology disappeared immediately after creation')
    return created
  }

  /**
   * Record a Manual snapshot: find-or-create the Manual data source for
   * this topology, then write a new observation against it. Used by
   * `create()` and `update()` whenever `contentJson` is supplied.
   */
  private async recordManualSnapshot(
    topologyId: string,
    contentJson: string,
    capturedAt: number,
  ): Promise<void> {
    const graph = this.parseContent(contentJson)
    const sourceId = await this.getOrCreateManualSource(topologyId)
    await this.observations.record({
      topologyId,
      sourceId,
      capturedAt,
      status: 'ok',
      graph,
    })
  }

  /**
   * Update an existing topology. When `contentJson` is supplied, a new
   * Manual observation is recorded (the Manual source is created on
   * first save if it didn 't exist yet — single Manual per topology).
   */
  async update(id: string, input: Partial<TopologyInput>): Promise<Topology | null> {
    const existing = this.get(id)
    if (!existing) {
      return null
    }

    if (input.contentJson !== undefined) {
      this.parseContent(input.contentJson)
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

    if (input.contentJson !== undefined) {
      await this.recordManualSnapshot(id, input.contentJson, timestamp())
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
   * This is also where the **observation resolver** runs. The Manual
   * source 's latest snapshot fills the `authored` slot of `resolve()`;
   * every other source contributes through the `snapshots` array. When
   * a topology has no Manual source attached, `authored` is the empty
   * graph (the diagram shows whatever the other sources produced).
   *
   * Discovered-only nodes show up in the diagram, conflict state is
   * carried on `provenance`, etc.
   */
  private async parseTopology(topology: Topology): Promise<ParsedTopology> {
    const latest = this.observations.latestPerSource(topology.id)
    const manualId = topology.manualSourceId
    const manualObs = manualId
      ? latest.find((o) => o.sourceId === manualId && o.graph !== null)
      : undefined
    const authored: NetworkGraph = manualObs?.graph ?? {
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

  /**
   * Parse content JSON to NetworkGraph
   * contentJson is NetworkGraph JSON directly
   */
  private parseContent(contentJson: string): NetworkGraph {
    const graph = JSON.parse(contentJson) as NetworkGraph

    // Basic validation
    if (!graph.nodes || !Array.isArray(graph.nodes)) {
      throw new Error('Invalid NetworkGraph: nodes array is required')
    }
    if (!graph.links || !Array.isArray(graph.links)) {
      throw new Error('Invalid NetworkGraph: links array is required')
    }

    return graph
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

    // Go through the normal create() path so the sample gets a Manual
    // source + initial observation just like a user-created topology.
    const created = await this.create({
      name: 'Sample Network',
      contentJson: JSON.stringify(graph),
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
