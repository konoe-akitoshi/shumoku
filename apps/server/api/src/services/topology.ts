/**
 * Topology Service
 * Manages network topologies with database persistence
 *
 * Storage format: contentJson stores NetworkGraph JSON directly
 * YAML parsing happens only at import time
 */

import type { Database } from 'bun:sqlite'
import type { LayoutResult, NetworkGraph, IconDimensions } from '@shumoku/core'
import { sampleNetwork } from '@shumoku/core'
import { BunHierarchicalLayout } from '../layout.js'
import { YamlParser, HierarchicalParser, createMemoryFileResolver } from '@shumoku/parser-yaml'
import { resolveIconDimensionsForGraph, collectIconUrls } from '@shumoku/renderer'
import { getDatabase, generateId, timestamp } from '../db/index.js'
import type { Topology, TopologyInput, MetricsData, MetricsMapping } from '../types.js'

interface TopologyRow {
  id: string
  name: string
  content_json: string
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
    contentJson: row.content_json,
    topologySourceId: row.topology_source_id ?? undefined,
    metricsSourceId: row.metrics_source_id ?? undefined,
    mappingJson: row.mapping_json ?? undefined,
    shareToken: row.share_token ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/**
 * Resolved icon dimensions for rendering
 */
export interface ResolvedIconDimensions {
  byUrl: Map<string, IconDimensions>
  byKey: Map<string, IconDimensions>
}

/**
 * Error information when a topology fails to parse or layout
 */
export interface TopologyParseError {
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
  private layout: BunHierarchicalLayout
  private cache: Map<string, ParsedTopology> = new Map()
  private renderCache: Map<string, object> = new Map()
  private errorCache: Map<string, TopologyParseError> = new Map()

  constructor() {
    this.db = getDatabase()
    this.layout = new BunHierarchicalLayout()
  }

  /**
   * Get all topologies from the database
   */
  list(): Topology[] {
    const rows = this.db.query('SELECT * FROM topologies ORDER BY name ASC').all() as TopologyRow[]
    return rows.map(rowToTopology)
  }

  /**
   * Get a single topology by ID
   */
  get(id: string): Topology | null {
    const row = this.db.query('SELECT * FROM topologies WHERE id = ?').get(id) as
      | TopologyRow
      | undefined
    return row ? rowToTopology(row) : null
  }

  /**
   * Get a topology by name
   */
  getByName(name: string): Topology | null {
    const row = this.db.query('SELECT * FROM topologies WHERE name = ?').get(name) as
      | TopologyRow
      | undefined
    return row ? rowToTopology(row) : null
  }

  /**
   * Create a new topology
   * contentJson should be NetworkGraph JSON
   */
  async create(input: TopologyInput): Promise<Topology> {
    // Validate content by parsing it
    this.parseContent(input.contentJson)

    const id = await generateId()
    const now = timestamp()

    this.db
      .prepare(
        `INSERT INTO topologies (id, name, content_json, topology_source_id, metrics_source_id, mapping_json, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        input.name,
        input.contentJson,
        input.topologySourceId || null,
        input.metricsSourceId || null,
        input.mappingJson || null,
        now,
        now,
      )

    // Clear cache to force re-parse
    this.cache.delete(id)
    this.renderCache.delete(id)

    return this.get(id)!
  }

  /**
   * Update an existing topology
   */
  async update(id: string, input: Partial<TopologyInput>): Promise<Topology | null> {
    const existing = this.get(id)
    if (!existing) {
      return null
    }

    // If content is being updated, validate it
    if (input.contentJson !== undefined) {
      this.parseContent(input.contentJson)
    }

    const updates: string[] = []
    const values: (string | number | null)[] = []

    if (input.name !== undefined) {
      updates.push('name = ?')
      values.push(input.name)
    }
    if (input.contentJson !== undefined) {
      updates.push('content_json = ?')
      values.push(input.contentJson)
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

    if (updates.length === 0) {
      return existing
    }

    updates.push('updated_at = ?')
    values.push(timestamp())
    values.push(id)

    this.db.query(`UPDATE topologies SET ${updates.join(', ')} WHERE id = ?`).run(...values)

    // Clear cache to force re-parse
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
    const row = this.db
      .query('SELECT * FROM topologies WHERE share_token = ?')
      .get(token) as TopologyRow | undefined
    return row ? rowToTopology(row) : null
  }

  /**
   * Get a parsed topology ready for rendering
   * Uses cache if available
   */
  async getParsed(id: string): Promise<ParsedTopology | null> {
    // Check cache first
    if (this.cache.has(id)) {
      return this.cache.get(id)!
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
   * Parse a topology and generate layout
   */
  private async parseTopology(topology: Topology): Promise<ParsedTopology> {
    const graph = this.parseContent(topology.contentJson)

    // Resolve icon dimensions from CDN for proper sizing
    let iconDimensions: ResolvedIconDimensions = { byUrl: new Map(), byKey: new Map() }
    const iconUrls = collectIconUrls(graph)
    if (iconUrls.length > 0) {
      try {
        iconDimensions = await resolveIconDimensionsForGraph(iconUrls)
      } catch (err) {
        console.warn('Failed to resolve icon dimensions:', err)
        // Continue with empty dimensions - will use defaults
      }
    }

    // Compute layout with icon dimensions for proper node sizing
    // Use byKey (vendor/model format) for layout engine
    const layoutResult = await this.layout.layoutAsync(graph, iconDimensions.byKey)
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

    for (let i = 0; i < graph.links.length; i++) {
      const linkId = graph.links[i].id || `link-${i}`
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
    if (process.env.DEMO_MODE !== 'true') {
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

    // Store as JSON
    const contentJson = JSON.stringify(graph)

    // Insert
    const id = await generateId()
    const now = timestamp()

    this.db
      .prepare(
        `INSERT INTO topologies (id, name, content_json, topology_source_id, metrics_source_id, mapping_json, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(id, 'Sample Network', contentJson, null, null, null, now, now)

    console.log(
      '[TopologyService] Sample network created:',
      graph.nodes.length,
      'nodes,',
      graph.links.length,
      'links',
    )
  }
}
