/**
 * HTTP + WebSocket Server using Hono + Bun
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import { linkSpeedBps } from '@shumoku/core'
import type { Server as BunServer, ServerWebSocket } from 'bun'
import { Hono } from 'hono'
import { serveStatic } from 'hono/bun'
import { cors } from 'hono/cors'
import { createApiRouter } from './api/index.js'
import { applyMappingBandwidth, getTopologyService } from './api/topologies.js'
import { closeDatabase, initDatabase } from './db/index.js'
import { generateMetricsHtml } from './html-generator.js'
import { MockMetricsProvider } from './mock-metrics.js'
import {
  hasMetricsCapability,
  loadPluginsFromConfig,
  pluginRegistry,
  registerBundledPlugins,
} from './plugins/index.js'
import { isSetupComplete, SESSION_COOKIE, validateSession } from './services/auth.js'
import { DataSourceService } from './services/datasource.js'
import { startDiscoveryScheduler, stopDiscoveryScheduler } from './services/discovery-scheduler.js'
import { startHealthChecker, stopHealthChecker } from './services/health-checker.js'
import {
  getSubscriberCount,
  publishMetrics,
  setWatchChangeCallback,
} from './services/metrics-hub.js'
import { ObservationsService } from './services/observations.js'
import { PollScheduler } from './services/poll-scheduler.js'
import { getSignalStreams } from './services/signal-streams.js'
import type { ParsedTopology, TopologyService } from './services/topology.js'
import { TopologySourcesService } from './services/topology-sources.js'
import { TopologyManager } from './topology.js'
import type { ClientMessage, ClientState, Config, MetricsData, MetricsMapping } from './types.js'

/**
 * Validate the admin session straight off a raw `Request` (the WebSocket upgrade
 * runs in Bun's `fetch`, before Hono, so we parse the Cookie header ourselves
 * rather than via hono/cookie). Returns true only for a live session.
 */
function hasValidSession(req: Request): boolean {
  const cookie = req.headers.get('cookie')
  if (!cookie) return false
  for (const part of cookie.split(';')) {
    const eq = part.indexOf('=')
    if (eq === -1) continue
    if (part.slice(0, eq).trim() !== SESSION_COOKIE) continue
    const value = decodeURIComponent(part.slice(eq + 1).trim())
    return validateSession(value)
  }
  return false
}

/**
 * Merge metrics from a later poll into an accumulator. Sources are
 * polled in priority order, so the later result is **lower-priority**
 * — earlier values win on conflicts. Plugin host-id namespaces are
 * structurally disjoint in practice so the typical case is that
 * `incoming` fills slots that `acc` doesn't have yet.
 *
 * `warnings` is concatenated (every source's warnings get surfaced);
 * the timestamp tracks the latest poll so consumers see freshness.
 */
function mergeMetricsData(acc: MetricsData | null, incoming: MetricsData): MetricsData {
  if (!acc) return incoming
  const nodes = { ...incoming.nodes, ...acc.nodes }
  const links = { ...incoming.links, ...acc.links }
  const warnings = [...(acc.warnings ?? []), ...(incoming.warnings ?? [])]
  return {
    nodes,
    links,
    timestamp: Math.max(acc.timestamp, incoming.timestamp),
    warnings: warnings.length > 0 ? warnings : undefined,
  }
}

export class Server {
  private app: Hono
  private config: Config
  // Legacy file-based topology path (YAML files watched on disk, served over the
  // WebSocket subscribe/poll handlers). Deliberately SCOPED OUT of the
  // composition-store refactor (it has no DB sources/observations/bindings) and
  // retained as-is; retiring it is a separate concern. See composition-store
  // plan § Phase 4 (old-path retirement).
  private topologyManager: TopologyManager
  private topologyService: TopologyService | null = null
  private topologySourcesService: TopologySourcesService | null = null
  private dataSourceService: DataSourceService | null = null
  private metricsProvider: MockMetricsProvider
  private clients: Map<ServerWebSocket<ClientState>, ClientState> = new Map()
  private pollScheduler: PollScheduler | null = null
  private housekeepingInterval: ReturnType<typeof setInterval> | null = null
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
    // Skip static file serving in development mode
    if (process.env.NODE_ENV === 'development') {
      console.log(
        '[Server] Development mode - skipping static file serving (use apps/web dev server)',
      )
      return
    }

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
      // Relative to apps/server/api (when running from api/)
      path.join(process.cwd(), '..', 'web', 'build'),
      // Relative to monorepo root (when running from root)
      path.join(process.cwd(), 'apps', 'server', 'web', 'build'),
      // Docker/production path
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
        case 'subscribe': {
          const prevTopology = state.subscribedTopology
          state.subscribedTopology = message.topology || null
          console.log(`[WebSocket] Client subscribed to: ${state.subscribedTopology}`)
          this.sendInitialMetrics(ws, state)
          // Notify scheduler: previous topology may now be unwatched
          if (prevTopology) this.pollScheduler?.notifyWatchChanged(prevTopology)
          // Notify scheduler: new topology is now watched
          if (state.subscribedTopology) {
            this.pollScheduler?.notifyWatchChanged(state.subscribedTopology)
          }
          break
        }

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
    const state = this.clients.get(ws)
    this.clients.delete(ws)
    console.log(`[WebSocket] Client disconnected (remaining: ${this.clients.size})`)
    // Notify scheduler: this topology may now be unwatched
    if (state?.subscribedTopology) {
      this.pollScheduler?.notifyWatchChanged(state.subscribedTopology)
    }
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
          // Inject parse error warnings if any
          const parseError = this.topologyService?.getParseError(state.subscribedTopology)
          if (parseError) {
            const warnings = [...(dbMetrics.warnings || [])]
            warnings.push(`Parse error: ${parseError.message}`)
            ws.send(JSON.stringify({ type: 'metrics', data: { ...dbMetrics, warnings } }))
          } else {
            ws.send(JSON.stringify({ type: 'metrics', data: dbMetrics }))
          }
          continue
        }

        // Check for parse error on DB topology with no metrics yet
        if (this.topologyService) {
          const parseError = this.topologyService.getParseError(state.subscribedTopology)
          if (parseError) {
            const errorMetrics: MetricsData = {
              nodes: {},
              links: {},
              timestamp: Date.now(),
              warnings: [`Parse error: ${parseError.message}`],
            }
            ws.send(JSON.stringify({ type: 'metrics', data: errorMetrics }))
            continue
          }
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
      warnings: metrics.warnings,
    }
  }

  /**
   * Poll metrics for a single topology ID. Handles both legacy file-based
   * topologies and DB topologies. Called by the PollScheduler for each
   * topology independently.
   */
  private async pollTopology(topologyId: string): Promise<void> {
    // DB topology path
    if (this.topologyService) {
      const topologies = this.topologyService.list()
      const topology = topologies.find((t) => t.id === topologyId)
      if (topology) {
        await this.updateSingleDbTopologyMetrics(topology)
        this.broadcastMetrics()
        return
      }
    }

    // Legacy file-based topology path
    const instance = this.topologyManager.getTopology(topologyId)
    if (instance) {
      instance.metrics = this.metricsProvider.generateMetrics(instance.graph)
      this.broadcastMetrics()
    }
  }

  private async startMetricsPolling(): Promise<void> {
    const fastInterval = this.config.server.pollInterval || 5000
    const slowInterval = this.config.server.backgroundPollInterval || 60_000
    const concurrencyLimit = this.config.server.concurrencyLimit || 3

    const getTopologyIds = (): string[] => {
      const ids: string[] = []
      // DB topologies
      if (this.topologyService) {
        for (const t of this.topologyService.list()) {
          ids.push(t.id)
        }
      }
      // Legacy file-based topologies
      for (const name of this.topologyManager.listTopologies()) {
        ids.push(name)
      }
      return ids
    }

    const isWatched = (topologyId: string): boolean => {
      // Check SSE subscribers via the hub
      if (getSubscriberCount(topologyId) > 0) return true
      // Check WS clients
      for (const state of this.clients.values()) {
        if (state.subscribedTopology === topologyId) return true
      }
      return false
    }

    this.pollScheduler = new PollScheduler(
      { fastInterval, slowInterval, concurrencyLimit, jitterMax: 1000 },
      (topologyId) => this.pollTopology(topologyId),
      getTopologyIds,
      isWatched,
    )

    // Wire the hub's SSE watch-change callback so SSE subscribers trigger
    // immediate polls just like WS subscribe events do.
    setWatchChangeCallback((topologyId) => {
      this.pollScheduler?.notifyWatchChanged(topologyId)
    })

    this.pollScheduler.start()

    // Signal-stream housekeeping (signal-streams.md retentions): once at
    // startup, then every 6h. Cheap deletes; never let it crash the server.
    const runHousekeeping = () => {
      try {
        const pruned = getSignalStreams().housekeeping()
        const observations = new ObservationsService().pruneOldObservations()
        if (pruned.history + pruned.trends + pruned.alerts + observations > 0) {
          console.log(
            `[SignalStreams] housekeeping: history=${pruned.history} trends=${pruned.trends} alerts=${pruned.alerts} observations=${observations}`,
          )
        }
      } catch (err) {
        console.error('[SignalStreams] housekeeping failed:', err)
      }
    }
    runHousekeeping()
    this.housekeepingInterval = setInterval(runHousekeeping, 6 * 3600_000)
  }

  private async updateSingleDbTopologyMetrics(topology: {
    id: string
    name: string
  }): Promise<void> {
    if (!this.topologySourcesService || !this.dataSourceService || !this.topologyService) return

    let parsed: ParsedTopology | null = null
    try {
      parsed = await this.topologyService.getParsed(topology.id)
    } catch (err) {
      console.error(
        `[Server] Unexpected error parsing topology "${topology.name}":`,
        err instanceof Error ? err.message : err,
      )
    }
    if (!parsed) return

    let metrics: MetricsData | null = null

    // Poll every attached metrics source and merge their results.
    // Plugin host-id namespaces are structurally disjoint in practice
    // (Zabbix numeric ids vs Aruba serials vs NetBox integers), so
    // each plugin naturally answers for the subset of mapped nodes
    // it recognizes and ignores the rest.
    const metricsSources = this.topologySourcesService.listByPurpose(topology.id, 'metrics')
    if (metricsSources.length > 0) {
      // Use the resolved mapping (metrics-binding attachments ∪ residual
      // mapping_json), NOT the raw mapping_json blob — after the binding
      // backfill, node bindings live as attachments and mapping_json holds
      // only the residual, so reading the blob alone would starve pollers of
      // node bindings. `parseTopology` already produced this view.
      const mapping: MetricsMapping = parsed.mapping
        ? { nodes: { ...parsed.mapping.nodes }, links: { ...parsed.mapping.links } }
        : { nodes: {}, links: {} }

      // Backfill link bandwidth from the topology spec exactly once.
      // The plugin sees a single authoritative bps per link.
      if (parsed?.graph?.links) {
        for (const [i, link] of parsed.graph.links.entries()) {
          const linkId = link.id || `link-${i}`
          const linkMapping = mapping.links?.[linkId]
          if (linkMapping && linkMapping.bandwidth === undefined) {
            const bps = linkSpeedBps(link)
            // Copy-on-write: the link object is shared with the cached
            // parsed.mapping, so replace it rather than mutate in place.
            if (bps !== undefined) mapping.links[linkId] = { ...linkMapping, bandwidth: bps }
          }
        }
      }

      // Poll all sources concurrently — they're independent plugin
      // instances hitting independent upstreams, so a poll cycle
      // should cost max(source latency), not the sum. `allSettled`
      // keeps one source's failure from sinking the others.
      const polled = await Promise.allSettled(
        metricsSources.map(async (source) => {
          const dataSource = this.dataSourceService?.get(source.dataSourceId)
          if (!dataSource) return null
          const config = JSON.parse(dataSource.configJson)
          const plugin = pluginRegistry.getInstance(dataSource.id, dataSource.type, config)
          if (!hasMetricsCapability(plugin)) return null
          const data = await plugin.pollMetrics(mapping)
          return { type: dataSource.type, data }
        }),
      )

      // Merge in source order. `metricsSources` is priority-sorted
      // (low number = high precedence) and `allSettled` preserves
      // input order, so on the rare nodeId/linkId conflict the
      // higher-priority source wins (see `mergeMetricsData`).
      const polledFrom: string[] = []
      for (const [i, result] of polled.entries()) {
        if (result.status === 'rejected') {
          const type = metricsSources[i]
            ? (this.dataSourceService.get(metricsSources[i].dataSourceId)?.type ?? 'unknown')
            : 'unknown'
          console.error(
            `[Server] Failed to poll metrics from ${type} for topology "${topology.name}":`,
            result.reason instanceof Error ? result.reason.message : result.reason,
          )
          continue
        }
        if (!result.value) continue
        metrics = mergeMetricsData(metrics, result.value.data)
        polledFrom.push(result.value.type)
      }
      // One line per topology per poll cycle, not one per source —
      // keeps the log readable when many topologies × sources poll.
      if (polledFrom.length > 0) {
        console.log(
          `[Server] Polled metrics for topology "${topology.name}" from ${polledFrom.join(', ')}`,
        )
      }
    }

    // DEMO mode fallback: when no real metrics source is wired up
    // (sample-network in DEMO_MODE has none), generate mock metrics
    // so every overlay (weathermap flow, node status, etc.) actually
    // shows live values in the UI. The mock sees the merged
    // bandwidth so its bps numbers match what the renderer draws.
    if (!metrics && process.env['DEMO_MODE'] === 'true') {
      const mergedGraph = applyMappingBandwidth(parsed.graph, parsed.mapping)
      metrics = this.metricsProvider.generateMetrics(mergedGraph)
    }

    if (metrics) {
      this.dbTopologyMetrics.set(topology.id, metrics)
      this.topologyService.updateMetrics(topology.id, metrics)
      // Feed the hub so token-scoped share SSE streams can read/observe live
      // metrics off the same central poll (no second poll loop).
      publishMetrics(topology.id, metrics)
      // Metrics stream (signal-streams.md): raw history + hourly trends.
      // Best-effort — a stream write must never break the poll loop.
      try {
        getSignalStreams().recordMetrics(topology.id, metrics)
      } catch (err) {
        console.error('[Server] metrics stream record failed:', err)
      }
    }
  }

  private setupApiRoutes(): void {
    this.app.route('/api', createApiRouter())
  }

  async initialize(): Promise<void> {
    // Register bundled plugins before database access
    registerBundledPlugins()

    // Load external plugins from config file
    const pluginsConfigPath =
      process.env['SHUMOKU_PLUGINS_CONFIG'] || path.join(this.config.server.dataDir, 'plugins.yaml')
    await loadPluginsFromConfig(pluginsConfigPath)

    initDatabase(this.config.server.dataDir)
    this.setupApiRoutes()
    this.setupStaticFileServing()

    this.topologyService = getTopologyService()
    this.topologySourcesService = new TopologySourcesService()
    this.dataSourceService = new DataSourceService()
    await this.topologyService.initializeSample()
    // One-shot: move operator content out of Manual data sources into each
    // topology's project overlay, then retire the Manual sources. MUST run before
    // the metrics backfill, which writes bindings into the project overlay.
    await this.topologyService.migrateManualToProject()
    // One-shot: retroactively mint entity_registry rows for existing contributions
    // so the entity-keyed mapping backfills below have entity ids to translate to.
    await this.topologyService.backfillEntityRegistry()
    // One-shot: migrate legacy mapping_json → metrics mapping rows (entity-keyed).
    await this.topologyService.backfillMetricsBindings()
    // One-shot (Phase 2): migrate existing metrics-binding attachments into
    // metrics_mapping rows, then stop reading/writing binding attachments.
    await this.topologyService.backfillMetricsMappingRows()

    await this.topologyManager.loadAll()
    console.log(
      `[Server] Loaded ${this.topologyManager.listTopologies().length} file-based topologies`,
    )
    console.log(`[Server] Database has ${this.topologyService.list().length} topologies`)

    // Start background health checker for data sources
    startHealthChecker()
    // Start the discovery scheduler — periodically syncs every attached
    // topology source on the cadence its topology default configures.
    // Set SHUMOKU_DISCOVERY_SCHEDULER=off to disable (dev / debugging).
    startDiscoveryScheduler()
  }

  async start(): Promise<void> {
    await this.initialize()

    const self = this

    // Start HTTP server before metrics polling so /api/health is available immediately
    this.bunServer = Bun.serve({
      port: this.config.server.port,
      hostname: this.config.server.host,

      // Bun's default idleTimeout is 10s — the connection is closed if no
      // data flows for that long. SNMP-LLDP `/sync` requests stay quiet
      // for tens of seconds while the per-device walks (and LLDP walks)
      // run, then write the response in one go. With the default the
      // browser saw `ERR_EMPTY_RESPONSE` mid-scan even though the scan
      // was still running server-side. 5 minutes is a comfortable ceiling
      // for any single sync — the scheduler's MIN_SYNC_INTERVAL_MS is
      // also 5 minutes, so the same window applies.
      idleTimeout: 255, // seconds — Bun caps idleTimeout at 255
      fetch(req, server) {
        // Handle WebSocket upgrade
        if (new URL(req.url).pathname === '/ws') {
          // AUTH GATE: the live-metrics socket requires a valid admin session.
          // It bypasses Hono (and thus authMiddleware), so without this check ANY
          // anonymous client could subscribe to ANY topology id and receive its
          // live metrics + internal warnings — a data leak. Public/shared live
          // metrics will be served separately via a token-scoped channel, NOT here.
          // (When setup isn't complete there's no password yet — mirror
          // authMiddleware and allow through.)
          if (isSetupComplete() && !hasValidSession(req)) {
            return new Response('Unauthorized', { status: 401 })
          }
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

    // Start metrics polling after server is listening (may block on slow data sources)
    await this.startMetricsPolling()
  }

  stop(): void {
    // Stop background loops first so they don't fire mid-shutdown.
    stopDiscoveryScheduler()
    stopHealthChecker()

    // Clear the hub watch-change callback so it doesn't fire after shutdown.
    setWatchChangeCallback(null)

    if (this.pollScheduler) {
      this.pollScheduler.stop()
      this.pollScheduler = null
    }
    if (this.housekeepingInterval) {
      clearInterval(this.housekeepingInterval)
      this.housekeepingInterval = null
    }
    // flush open trend hour-buckets so a graceful shutdown loses nothing
    try {
      getSignalStreams().flushAll()
    } catch {
      // best-effort
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
}
