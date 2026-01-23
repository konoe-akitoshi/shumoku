/**
 * HTTP + WebSocket Server using Hono + Bun
 */

import * as fs from 'node:fs'
import * as path from 'node:path'

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/bun'
import type { Server as BunServer, ServerWebSocket } from 'bun'
import type { Config, ClientMessage, ClientState, MetricsData } from './types.js'
import { TopologyManager } from './topology.js'
import { generateMetricsHtml } from './html-generator.js'
import { MockMetricsProvider } from './mock-metrics.js'
import { initDatabase, closeDatabase } from './db/index.js'
import { createApiRouter } from './api/index.js'
import { TopologyService } from './services/topology.js'
import { registerBuiltinPlugins } from './plugins/index.js'

export class Server {
  private app: Hono
  private config: Config
  private topologyManager: TopologyManager
  private topologyService: TopologyService | null = null
  private metricsProvider: MockMetricsProvider
  private clients: Map<ServerWebSocket<ClientState>, ClientState> = new Map()
  private pollInterval: ReturnType<typeof setInterval> | null = null
  private bunServer: BunServer<ClientState> | null = null
  private dbTopologyMetrics: Map<string, MetricsData> = new Map()

  constructor(config: Config) {
    this.config = config
    this.app = new Hono()
    this.topologyManager = new TopologyManager(config)
    this.metricsProvider = new MockMetricsProvider()

    this.setupBaseRoutes()
  }

  private setupBaseRoutes(): void {
    this.app.use('*', cors())

    // Legacy API: Get topology details with current metrics (by name)
    this.app.get('/api/topology/:name', (c) => {
      const name = c.req.param('name')
      const instance = this.topologyManager.getTopology(name)
      if (!instance) {
        return c.json({ error: 'Topology not found' }, 404)
      }
      return c.json({
        name: instance.name,
        graph: instance.graph,
        metrics: instance.metrics,
      })
    })

    // Legacy: Topology view (HTML page with real-time updates)
    this.app.get('/topology/:name', (c) => {
      const name = c.req.param('name')
      const instance = this.topologyManager.getTopology(name)
      if (!instance) {
        return c.html('<h1>Topology not found</h1>', 404)
      }

      const wsUrl = `ws://${c.req.header('host')}/ws`
      const html = generateMetricsHtml(instance, {
        wsUrl,
        weathermap: this.config.weathermap,
      })
      return c.html(html)
    })
  }

  private setupStaticFileServing(): void {
    const webBuildPath = this.getWebBuildPath()
    if (webBuildPath && fs.existsSync(webBuildPath)) {
      console.log(`[Server] Serving static files from: ${webBuildPath}`)

      // Serve static assets
      this.app.use('/*', serveStatic({ root: webBuildPath }))

      // SPA fallback - serve index.html for all non-API routes
      this.app.get('*', async (c) => {
        const indexPath = path.join(webBuildPath, 'index.html')
        if (fs.existsSync(indexPath)) {
          const html = fs.readFileSync(indexPath, 'utf-8')
          return c.html(html)
        }
        return c.text('Not found', 404)
      })
    } else {
      throw new Error('[Server] Web UI not found. Run "bun run build" in apps/server/web first.')
    }
  }

  private getWebBuildPath(): string | null {
    const possiblePaths = [
      path.join(process.cwd(), 'web', 'build'),
      path.join(process.cwd(), 'apps', 'server', 'web', 'build'),
      '/app/web/build',
    ]

    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        return p
      }
    }

    return null
  }

  private handleWebSocketOpen(ws: ServerWebSocket<ClientState>): void {
    const state: ClientState = {
      subscribedTopology: null,
      filter: { nodes: [], links: [] },
    }
    ws.data = state
    this.clients.set(ws, state)
    console.log(`[WebSocket] Client connected (total: ${this.clients.size})`)
  }

  private handleClientMessage(ws: ServerWebSocket<ClientState>, data: string): void {
    try {
      const message: ClientMessage = JSON.parse(data)
      const state = this.clients.get(ws)
      if (!state) return

      switch (message.type) {
        case 'subscribe':
          state.subscribedTopology = message.topology || null
          console.log(`[WebSocket] Client subscribed to: ${state.subscribedTopology}`)
          this.sendInitialMetrics(ws, state)
          break

        case 'setInterval':
          console.log(
            `[WebSocket] Client requested interval: ${message.interval}ms (ignored - using server poll interval)`,
          )
          break

        case 'filter':
          state.filter = {
            nodes: message.nodes || [],
            links: message.links || [],
          }
          break
      }
    } catch (err) {
      console.error('[WebSocket] Failed to parse message:', err)
    }
  }

  private handleWebSocketClose(ws: ServerWebSocket<ClientState>): void {
    this.clients.delete(ws)
    console.log(`[WebSocket] Client disconnected (remaining: ${this.clients.size})`)
  }

  private sendInitialMetrics(ws: ServerWebSocket<ClientState>, state: ClientState): void {
    if (!state.subscribedTopology) return

    // Check DB topology first
    const dbMetrics = this.dbTopologyMetrics.get(state.subscribedTopology)
    if (dbMetrics) {
      ws.send(JSON.stringify({ type: 'metrics', data: dbMetrics }))
      return
    }

    // Check file-based topology
    const instance = this.topologyManager.getTopology(state.subscribedTopology)
    if (instance) {
      ws.send(JSON.stringify({ type: 'metrics', data: instance.metrics }))
    }
  }

  private broadcastMetrics(): void {
    for (const [ws, state] of this.clients.entries()) {
      if (!state.subscribedTopology) continue

      try {
        // Check DB topology first
        const dbMetrics = this.dbTopologyMetrics.get(state.subscribedTopology)
        if (dbMetrics) {
          ws.send(JSON.stringify({ type: 'metrics', data: dbMetrics }))
          continue
        }

        // Check file-based topology
        const instance = this.topologyManager.getTopology(state.subscribedTopology)
        if (instance) {
          const filteredMetrics = this.filterMetrics(instance.metrics, state.filter)
          ws.send(JSON.stringify({ type: 'metrics', data: filteredMetrics }))
        }
      } catch (err) {
        console.error('[WebSocket] Failed to send metrics:', err)
      }
    }
  }

  private filterMetrics(
    metrics: MetricsData,
    filter: { nodes: string[]; links: string[] },
  ): MetricsData {
    if (filter.nodes.length === 0 && filter.links.length === 0) {
      return metrics
    }

    const filteredNodes: typeof metrics.nodes = {}
    const filteredLinks: typeof metrics.links = {}

    if (filter.nodes.length > 0) {
      for (const nodeId of filter.nodes) {
        if (metrics.nodes[nodeId]) {
          filteredNodes[nodeId] = metrics.nodes[nodeId]
        }
      }
    } else {
      Object.assign(filteredNodes, metrics.nodes)
    }

    if (filter.links.length > 0) {
      for (const linkId of filter.links) {
        if (metrics.links[linkId]) {
          filteredLinks[linkId] = metrics.links[linkId]
        }
      }
    } else {
      Object.assign(filteredLinks, metrics.links)
    }

    return {
      nodes: filteredNodes,
      links: filteredLinks,
      timestamp: metrics.timestamp,
    }
  }

  private async startMetricsPolling(): Promise<void> {
    await this.updateAllMetrics()
    this.broadcastMetrics()

    const interval = this.config.zabbix?.pollInterval || 5000
    let isPolling = false

    this.pollInterval = setInterval(async () => {
      // Skip if previous poll is still running
      if (isPolling) {
        console.log('[Server] Skipping metrics poll - previous poll still running')
        return
      }

      isPolling = true
      try {
        await this.updateAllMetrics()
        this.broadcastMetrics()
      } finally {
        isPolling = false
      }
    }, interval)
  }

  private async updateAllMetrics(): Promise<void> {
    // Update legacy file-based topologies
    for (const name of this.topologyManager.listTopologies()) {
      const instance = this.topologyManager.getTopology(name)
      if (instance) {
        instance.metrics = this.metricsProvider.generateMetrics(instance.graph)
      }
    }

    // Update DB topologies
    if (this.topologyService) {
      await this.updateDbTopologyMetrics()
    }
  }

  private async updateDbTopologyMetrics(): Promise<void> {
    if (!this.topologyService) return

    const topologies = this.topologyService.list()
    for (const topology of topologies) {
      const parsed = await this.topologyService.getParsed(topology.id)
      if (parsed) {
        const metrics = this.metricsProvider.generateMetrics(parsed.graph)
        this.dbTopologyMetrics.set(topology.id, metrics)
        this.topologyService.updateMetrics(topology.id, metrics)
      }
    }
  }

  private setupApiRoutes(): void {
    this.app.route('/api', createApiRouter())
  }

  async initialize(): Promise<void> {
    // Register built-in plugins before database access
    registerBuiltinPlugins()

    initDatabase(this.config.server.dataDir)
    this.setupApiRoutes()
    this.setupStaticFileServing()

    this.topologyService = new TopologyService()
    await this.topologyService.initializeSample()

    await this.topologyManager.loadAll()
    console.log(
      `[Server] Loaded ${this.topologyManager.listTopologies().length} file-based topologies`,
    )
    console.log(`[Server] Database has ${this.topologyService.list().length} topologies`)
  }

  async start(): Promise<void> {
    await this.initialize()
    await this.startMetricsPolling()

    const self = this

    this.bunServer = Bun.serve({
      port: this.config.server.port,
      hostname: this.config.server.host,

      fetch(req, server) {
        // Handle WebSocket upgrade
        if (new URL(req.url).pathname === '/ws') {
          const upgraded = server.upgrade(req, {
            data: { subscribedTopology: null, filter: { nodes: [], links: [] } },
          })
          if (upgraded) return undefined
          return new Response('WebSocket upgrade failed', { status: 400 })
        }

        // Handle regular HTTP requests with Hono
        return self.app.fetch(req)
      },

      websocket: {
        open(ws) {
          self.handleWebSocketOpen(ws)
        },
        message(ws, message) {
          self.handleClientMessage(ws, String(message))
        },
        close(ws) {
          self.handleWebSocketClose(ws)
        },
      },
    })

    console.log(`[Server] Running at http://${this.config.server.host}:${this.config.server.port}`)
  }

  stop(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval)
      this.pollInterval = null
    }

    for (const ws of this.clients.keys()) {
      try {
        ws.close()
      } catch {
        // Ignore
      }
    }
    this.clients.clear()

    if (this.bunServer) {
      this.bunServer.stop()
      this.bunServer = null
    }

    closeDatabase()
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
  }
}
