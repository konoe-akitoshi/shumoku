/**
 * Topology Service
 * Manages network topologies with database persistence
 */

import type { Database } from 'bun:sqlite'
import type { LayoutResult, NetworkGraph, IconDimensions } from '@shumoku/core'
import { sampleNetwork } from '@shumoku/core'
import { BunHierarchicalLayout } from '../layout.js'
import { YamlParser, HierarchicalParser, createMemoryFileResolver } from '@shumoku/parser-yaml'
import { resolveIconDimensionsForGraph, collectIconUrls } from '@shumoku/renderer'
import { getDatabase, generateId, timestamp } from '../db/index.js'
import type { Topology, TopologyInput, MetricsData, ZabbixMapping } from '../types.js'

/**
 * Single file in a multi-file topology
 */
export interface TopologyFile {
  name: string
  content: string
}

/**
 * Multi-file content format stored in content_json
 */
export interface MultiFileContent {
  files: TopologyFile[]
}

/**
 * Parse multi-file JSON content
 */
export function parseMultiFileContent(contentJson: string): TopologyFile[] {
  const parsed = JSON.parse(contentJson) as MultiFileContent
  return parsed.files
}

/**
 * Serialize files to multi-file JSON format
 */
export function serializeMultiFileContent(files: TopologyFile[]): string {
  return JSON.stringify({ files }, null, 2)
}

/**
 * Create multi-file content from a single YAML string (for simple topologies)
 */
export function createSingleFileContent(yamlContent: string): string {
  return serializeMultiFileContent([{ name: 'main.yaml', content: yamlContent }])
}

interface TopologyRow {
  id: string
  name: string
  content_json: string
  topology_source_id: string | null
  metrics_source_id: string | null
  mapping_json: string | null
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
  mapping?: ZabbixMapping
}

export class TopologyService {
  private db: Database
  private layout: BunHierarchicalLayout
  private cache: Map<string, ParsedTopology> = new Map()

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
   */
  async create(input: TopologyInput): Promise<Topology> {
    // Validate content by parsing it
    await this.parseContent(input.contentJson)

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
      await this.parseContent(input.contentJson)
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

    return this.get(id)
  }

  /**
   * Update Zabbix mapping for a topology
   */
  updateMapping(id: string, mapping: ZabbixMapping): Topology | null {
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

    return this.get(id)
  }

  /**
   * Delete a topology
   */
  delete(id: string): boolean {
    const result = this.db.query('DELETE FROM topologies WHERE id = ?').run(id)
    this.cache.delete(id)
    return result.changes > 0
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

    const topology = this.get(id)
    if (!topology) {
      return null
    }

    const parsed = await this.parseTopology(topology)
    this.cache.set(id, parsed)
    return parsed
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
    const graph = await this.parseContent(topology.contentJson)

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

    let mapping: ZabbixMapping | undefined
    if (topology.mappingJson) {
      try {
        mapping = JSON.parse(topology.mappingJson) as ZabbixMapping
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
   * Supports multi-file hierarchical topologies
   */
  private async parseContent(contentJson: string): Promise<NetworkGraph> {
    const files = parseMultiFileContent(contentJson)

    // Find main.yaml
    const mainFile = files.find((f) => f.name === 'main.yaml')
    if (!mainFile) {
      throw new Error('main.yaml not found in topology files')
    }

    // Check if main file has file references
    const hasFileRefs = mainFile.content.includes('file:')

    if (hasFileRefs) {
      // Parse hierarchically using memory resolver
      const fileMap = new Map<string, string>()
      for (const file of files) {
        fileMap.set(file.name, file.content)
      }
      const resolver = createMemoryFileResolver(fileMap, '')
      const parser = new HierarchicalParser(resolver)
      const result = await parser.parse(mainFile.content, 'main.yaml')
      return result.graph
    }

    // Single file, parse directly
    const parser = new YamlParser()
    const result = parser.parse(mainFile.content)
    return result.graph
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
   * Update metrics for a cached topology
   */
  updateMetrics(id: string, metrics: MetricsData): void {
    const cached = this.cache.get(id)
    if (cached) {
      cached.metrics = metrics
    }
  }

  /**
   * Clear all cached topologies
   */
  clearCache(): void {
    this.cache.clear()
  }

  /**
   * Clear cached topology by ID
   */
  clearCacheEntry(id: string): void {
    this.cache.delete(id)
  }

  /**
   * List all topology names (for compatibility with old API)
   */
  listNames(): string[] {
    return this.list().map((t) => t.name)
  }

  /**
   * Initialize with sample topology if database is empty
   * Uses the comprehensive hierarchical sample network from @shumoku/core/fixtures
   */
  async initializeSample(): Promise<void> {
    const existing = this.list()
    if (existing.length > 0) {
      return
    }

    console.log('[TopologyService] No topologies found, creating sample network')

    // Convert sample network files to JSON format
    const files: TopologyFile[] = sampleNetwork.map((f) => ({
      name: f.name,
      content: f.content,
    }))

    const contentJson = serializeMultiFileContent(files)

    // Validate by parsing
    await this.parseContent(contentJson)

    // Insert
    const id = await generateId()
    const now = timestamp()

    this.db
      .prepare(
        `INSERT INTO topologies (id, name, content_json, topology_source_id, metrics_source_id, mapping_json, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(id, 'Sample Network', contentJson, null, null, null, now, now)

    console.log('[TopologyService] Sample network created with', files.length, 'files')
  }
}
