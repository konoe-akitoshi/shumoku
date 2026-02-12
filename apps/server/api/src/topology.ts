/**
 * Topology Manager
 * Loads and manages network topologies from YAML files
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import { type NetworkGraph, sampleNetwork } from '@shumoku/core'
import {
  createMemoryFileResolver,
  type FileResolver,
  HierarchicalParser,
  YamlParser,
} from '@shumoku/parser-yaml'
import { resolvePath } from './config.js'
import { BunHierarchicalLayout } from './layout.js'
import type { Config, MetricsData, TopologyConfig, TopologyInstance } from './types.js'

/**
 * Create a Node.js file resolver for the given base path
 */
function createFileResolver(): FileResolver {
  return {
    async read(filePath: string): Promise<string> {
      return fs.promises.readFile(filePath, 'utf-8')
    },
    resolve(base: string, relativePath: string): string {
      const dir = path.dirname(base)
      return path.resolve(dir, relativePath)
    },
  }
}

export class TopologyManager {
  private config: Config
  private topologies: Map<string, TopologyInstance> = new Map()
  private layout: BunHierarchicalLayout

  constructor(config: Config) {
    this.config = config
    this.layout = new BunHierarchicalLayout()
  }

  /**
   * Load all configured topologies
   */
  async loadAll(): Promise<void> {
    // Load from config
    for (const topoConfig of this.config.topologies) {
      try {
        await this.loadTopology(topoConfig)
      } catch (err) {
        console.error(`[Topology] Failed to load ${topoConfig.name}:`, err)
      }
    }

    // If no topologies configured and DEMO_MODE is enabled, load sample network
    if (this.topologies.size === 0 && process.env.DEMO_MODE === 'true') {
      console.log('[Topology] Demo mode: loading sample network')
      await this.loadSampleNetwork()
    }
  }

  /**
   * Load a single topology from config
   */
  private async loadTopology(topoConfig: TopologyConfig): Promise<void> {
    const filePath = resolvePath(topoConfig.file)
    if (!fs.existsSync(filePath)) {
      throw new Error(`Topology file not found: ${filePath}`)
    }

    const content = fs.readFileSync(filePath, 'utf-8')

    // Check if the file has any file references (hierarchical)
    const hasFileRefs = content.includes('file:')

    let graph: NetworkGraph

    if (hasFileRefs) {
      // Use hierarchical parser for multi-file diagrams
      const resolver = createFileResolver()
      const hierarchicalParser = new HierarchicalParser(resolver)
      const result = await hierarchicalParser.parse(content, filePath)
      graph = result.graph
    } else {
      // Use simple parser for single-file diagrams
      const parser = new YamlParser()
      const result = parser.parse(content)
      graph = result.graph
    }

    const layoutResult = await this.layout.layout(graph)

    const instance: TopologyInstance = {
      name: topoConfig.name,
      config: topoConfig,
      graph,
      layout: layoutResult,
      metrics: this.createEmptyMetrics(graph),
    }

    this.topologies.set(topoConfig.name, instance)
    console.log(`[Topology] Loaded: ${topoConfig.name}`)
  }

  /**
   * Load the built-in sample network for demo purposes
   */
  private async loadSampleNetwork(): Promise<void> {
    // Convert SampleFile[] to Map<string, string> for memory file resolver
    const files = new Map<string, string>()
    for (const file of sampleNetwork) {
      files.set(file.name, file.content)
    }

    // Find the main file
    const mainFile = sampleNetwork.find((f) => f.name === 'main.yaml')
    if (!mainFile) {
      throw new Error('Sample network main.yaml not found')
    }

    // Use memory file resolver to parse the sample network
    const resolver = createMemoryFileResolver(files, '')
    const hierarchicalParser = new HierarchicalParser(resolver)
    const result = await hierarchicalParser.parse(mainFile.content, 'main.yaml')
    const graph = result.graph

    const layoutResult = await this.layout.layout(graph)

    const instance: TopologyInstance = {
      name: 'sample-network',
      config: { name: 'sample-network', file: 'built-in' },
      graph,
      layout: layoutResult,
      metrics: this.createEmptyMetrics(graph),
    }

    this.topologies.set('sample-network', instance)
    console.log('[Topology] Loaded: sample-network (built-in)')
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
      const linkId = graph.links[i]!.id || `link-${i}`
      links[linkId] = { status: 'unknown' }
    }

    return {
      nodes,
      links,
      timestamp: Date.now(),
    }
  }

  /**
   * Get a topology by name
   */
  getTopology(name: string): TopologyInstance | undefined {
    return this.topologies.get(name)
  }

  /**
   * List all topology names
   */
  listTopologies(): string[] {
    return Array.from(this.topologies.keys())
  }

  /**
   * Reload a specific topology
   */
  async reloadTopology(name: string): Promise<boolean> {
    const instance = this.topologies.get(name)
    if (!instance || instance.config.file === 'built-in') {
      return false
    }

    try {
      await this.loadTopology(instance.config)
      return true
    } catch (err) {
      console.error(`[Topology] Failed to reload ${name}:`, err)
      return false
    }
  }
}
