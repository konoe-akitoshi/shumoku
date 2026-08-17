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
import { createAuthApplicationService } from './app/auth.js'
import { SESSION_COOKIE } from './app/auth-session.js'
import { createDashboardApplicationService } from './app/dashboard.js'
import { createDataSourceCrudService } from './app/data-source-crud.js'
import { createDataSourceOperationsService } from './app/data-source-operations.js'
import { createDataSourceScanService } from './app/data-source-scan.js'
import { createDiscoveryPolicyApplicationService } from './app/discovery-policy.js'
import { createPluginApplicationService } from './app/plugins.js'
import type { AdminStatus, AppServices } from './app/services.js'
import { createShareApplicationService } from './app/share.js'
import { applyMappingBandwidth } from './app/topology-graph.js'
import { createTopologyMappingApplicationService } from './app/topology-mappings.js'
import { createTopologyObservationApplicationService } from './app/topology-observations.js'
import { createTopologyQueryApplicationService } from './app/topology-queries.js'
import { createTopologySourceApplicationService } from './app/topology-sources.js'
import { createTopologySyncApplicationService } from './app/topology-sync.js'
import { createWebhookApplicationService } from './app/webhooks.js'
import { closeDatabase, initDatabase } from './db/index.js'
import { MockMetricsProvider } from './mock-metrics.js'
import { createApiRouter } from './openapi/router.js'
import {
  hasMetricsCapability,
  loadPluginsFromConfig,
  pluginRegistry,
  registerBundledPlugins,
} from './plugins/index.js'
import { isSetupComplete, validateSession } from './services/auth.js'
import { getDashboardService } from './services/dashboard.js'
import { DataSourceService } from './services/datasource.js'
import { GrafanaAlertService } from './services/grafana-alerts.js'
import { startHealthChecker, stopHealthChecker } from './services/health-checker.js'
import {
  getSubscriberCount,
  liveSubscriberCount,
  publishMetrics,
  setWatchChangeCallback,
} from './services/metrics-hub.js'
import { aggregateMetricsData, type MetricsSourcePoll } from './services/metrics-merge.js'
import { ObservationsService } from './services/observations.js'
import { PollScheduler } from './services/poll-scheduler.js'
import { SettingsService } from './services/settings.js'
import { getSignalStreams } from './services/signal-streams.js'
import {
  getSyncSchedulerStatus,
  startSyncScheduler,
  stopSyncScheduler,
} from './services/sync-scheduler.js'
import { getBuildInfo, getSystemInfo } from './services/system-info.js'
import { type ParsedTopology, TopologyService } from './services/topology.js'
import { TopologySourcesService } from './services/topology-sources.js'
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

export class Server {
  private app: Hono
  private config: Config
  private topologyService: TopologyService | null = null
  private topologySourcesService: TopologySourcesService | null = null
  private dataSourceService: DataSourceService | null = null
  private metricsProvider: MockMetricsProvider
  private clients: Map<ServerWebSocket<ClientState>, ClientState> = new Map()
  private pollScheduler: PollScheduler | null = null
  private housekeepingInterval: ReturnType<typeof setInterval> | null = null
  private bunServer: BunServer<ClientState> | null = null
  private dbTopologyMetrics: Map<string, MetricsData> = new Map()
  private startedAt = Date.now()

  constructor(config: Config) {
    this.config = config
    this.app = new Hono()
    this.metricsProvider = new MockMetricsProvider()

    this.setupBaseRoutes()
  }

  private setupBaseRoutes(): void {
    this.app.use('*', cors())
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
          }
        }
      } catch (err) {
        console.error('[WebSocket] Failed to send metrics:', err)
      }
    }
  }

  /** Poll metrics for one persisted topology. */
  private async pollTopology(topologyId: string): Promise<void> {
    const topology = this.topologyService?.get(topologyId)
    if (!topology) return
    await this.updateSingleDbTopologyMetrics(topology)
    this.broadcastMetrics()
  }

  private async startMetricsPolling(): Promise<void> {
    const fastInterval = this.config.server.pollInterval || 5000
    const slowInterval = this.config.server.backgroundPollInterval || 60_000
    const concurrencyLimit = this.config.server.concurrencyLimit || 3

    const getTopologyIds = (): string[] => {
      return this.topologyService?.list().map((topology) => topology.id) ?? []
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

    // Wire the topology service's hooks BEFORE starting the scheduler so no
    // write can fall into a hook-less window. topology.ts must not import
    // server.ts — callback injection keeps it clean.
    if (this.topologyService) {
      const sched = this.pollScheduler
      // Mapping save → immediate poll (Item 3, #569).
      this.topologyService.setMappingWriteHook((topologyId) => {
        sched.pokeTopology(topologyId)
      })
      // Topology create/delete → register/unregister with the scheduler. The
      // scheduler seeds its state map once at start(); without this, a
      // topology created after startup would never be polled again once its
      // last live subscriber disconnects.
      this.topologyService.setTopologyLifecycleHook((topologyId, event) => {
        if (event === 'created') sched.addTopology(topologyId)
        else sched.removeTopology(topologyId)
      })
    }

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

    // Poll every attached metrics source. Multiple sources observing the same
    // entity are expected: their readings are redundant evidence, not a
    // collision to resolve by choosing a winner.
    const metricsSources = this.topologySourcesService.listByPurpose(topology.id, 'metrics')
    if (metricsSources.length > 0) {
      const mappingsBySource = this.topologyService.buildMappingsBySource(topology.id, parsed.graph)

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
          const sourceMapping = mappingsBySource.get(source.dataSourceId)
          const mapping: MetricsMapping = sourceMapping
            ? { nodes: { ...sourceMapping.nodes }, links: { ...sourceMapping.links } }
            : { nodes: {}, links: {} }

          // Backfill topology bandwidth into this source's link bindings. Each
          // plugin receives only host ids from its own namespace, but the graph
          // remains the shared authority for link capacity.
          for (const [i, link] of parsed.graph.links.entries()) {
            const linkId = link.id || `link-${i}`
            const linkMapping = mapping.links[linkId]
            if (linkMapping && linkMapping.bandwidth === undefined) {
              const bps = linkSpeedBps(link)
              if (bps !== undefined) mapping.links[linkId] = { ...linkMapping, bandwidth: bps }
            }
          }
          const polledData = await plugin.pollMetrics(mapping)
          const nodes = { ...polledData.nodes }
          const links = { ...polledData.links }
          // A configured binding that returns no sample is still evidence about
          // this monitoring path. Keep it as pending instead of making the
          // source disappear from the redundancy calculation.
          for (const nodeId of Object.keys(mapping.nodes)) {
            if (nodes[nodeId]) continue
            nodes[nodeId] = {
              status: 'unknown',
              monitoring: 'pending',
              monitoringError: 'No observation returned for the mapped node',
            }
          }
          for (const linkId of Object.keys(mapping.links)) {
            if (!links[linkId]) links[linkId] = { status: 'unknown' }
          }
          return {
            source: { id: dataSource.id, name: dataSource.name, type: dataSource.type },
            data: { ...polledData, nodes, links },
          }
        }),
      )

      // Aggregate the successful observations as one unordered set. Failed
      // sources do not erase the still-valid evidence from redundant paths.
      const polledFrom: string[] = []
      const successfulPolls: MetricsSourcePoll[] = []
      for (const [i, result] of polled.entries()) {
        if (result.status === 'rejected') {
          const attachedSource = metricsSources[i]
          const dataSource = attachedSource
            ? this.dataSourceService.get(attachedSource.dataSourceId)
            : undefined
          const type = dataSource?.type ?? 'unknown'
          const detail =
            result.reason instanceof Error ? result.reason.message : String(result.reason)
          console.error(
            `[Server] Failed to poll metrics from ${type} for topology "${topology.name}":`,
            detail,
          )
          if (attachedSource && dataSource) {
            const failedMapping = mappingsBySource.get(attachedSource.dataSourceId)
            successfulPolls.push({
              source: { id: dataSource.id, name: dataSource.name, type: dataSource.type },
              data: {
                nodes: Object.fromEntries(
                  Object.keys(failedMapping?.nodes ?? {}).map((nodeId) => [
                    nodeId,
                    {
                      status: 'unknown' as const,
                      monitoring: 'failing' as const,
                      monitoringError: `Datasource poll failed: ${detail}`,
                    },
                  ]),
                ),
                links: Object.fromEntries(
                  Object.keys(failedMapping?.links ?? {}).map((linkId) => [
                    linkId,
                    { status: 'unknown' as const },
                  ]),
                ),
                timestamp: Date.now(),
              },
            })
          }
          continue
        }
        if (!result.value) continue
        successfulPolls.push(result.value)
        polledFrom.push(result.value.source.name)
      }
      if (successfulPolls.length > 0) metrics = aggregateMetricsData(successfulPolls)
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
    this.app.route('/api', createApiRouter(this.createAppServices()))
  }

  private createAppServices(): AppServices {
    const topologyService = this.topologyService
    if (!topologyService) throw new Error('Topology service is not initialized')
    const dataSourceService = new DataSourceService()
    const observationsService = new ObservationsService()
    const topologySourcesService = new TopologySourcesService()
    const dashboardService = getDashboardService()
    return {
      system: { getBuildInfo, getSystemInfo },
      admin: { getStatus: () => this.getAdminStatus() },
      auth: createAuthApplicationService(),
      dataSources: {
        crud: createDataSourceCrudService(dataSourceService, topologyService),
        operations: createDataSourceOperationsService(dataSourceService, getSignalStreams()),
        scan: createDataSourceScanService(dataSourceService, observationsService, topologyService),
      },
      dashboards: createDashboardApplicationService(dashboardService),
      settings: new SettingsService(),
      plugins: createPluginApplicationService(),
      observations: createTopologyObservationApplicationService(
        observationsService,
        topologyService,
      ),
      topologySources: createTopologySourceApplicationService({
        topologies: topologyService,
        sources: topologySourcesService,
        dataSources: dataSourceService,
        observations: observationsService,
      }),
      topologyQueries: createTopologyQueryApplicationService(topologyService),
      topologyMappings: createTopologyMappingApplicationService({
        topologies: topologyService,
        sources: topologySourcesService,
        dataSources: dataSourceService,
      }),
      topologySync: createTopologySyncApplicationService({
        topologies: topologyService,
        sources: topologySourcesService,
        dataSources: dataSourceService,
        observations: observationsService,
      }),
      discoveryPolicy: createDiscoveryPolicyApplicationService(topologyService),
      share: createShareApplicationService({
        topologies: topologyService,
        dashboards: dashboardService,
        dataSources: dataSourceService,
      }),
      webhooks: createWebhookApplicationService({
        topologies: topologyService,
        sources: topologySourcesService,
        dataSources: dataSourceService,
        observations: observationsService,
        grafanaAlerts: new GrafanaAlertService(),
      }),
      topologies: topologyService,
    }
  }

  private getAdminStatus(): AdminStatus {
    const databaseReady = this.topologyService !== null
    const fastIntervalMs = this.config.server.pollInterval || 5000
    const slowIntervalMs = this.config.server.backgroundPollInterval || 60_000
    const concurrencyLimit = this.config.server.concurrencyLimit || 3
    const metrics = this.pollScheduler?.getStatus() ?? {
      running: false,
      activePolls: 0,
      queuedPolls: 0,
      topologyCount: 0,
      watchedTopologies: 0,
      inFlightTopologies: 0,
      fastIntervalMs,
      slowIntervalMs,
      concurrencyLimit,
    }

    return {
      status: databaseReady ? 'ok' : 'degraded',
      timestamp: Date.now(),
      uptimeSeconds: Math.max(0, (Date.now() - this.startedAt) / 1000),
      database: { ready: databaseReady },
      topologies: {
        total: this.topologyService?.list().length ?? 0,
      },
      plugins: { registered: pluginRegistry.getRegisteredTypes().length },
      realtime: {
        webSocketClients: this.clients.size,
        sseSubscribers: liveSubscriberCount(),
      },
      schedulers: {
        metrics,
        discovery: getSyncSchedulerStatus(),
      },
    }
  }

  async initialize(): Promise<void> {
    // Register bundled plugins before database access
    registerBundledPlugins()

    // Load external plugins from config file
    const pluginsConfigPath =
      process.env['SHUMOKU_PLUGINS_CONFIG'] || path.join(this.config.server.dataDir, 'plugins.yaml')
    await loadPluginsFromConfig(pluginsConfigPath)

    initDatabase(this.config.server.dataDir)
    this.topologyService = new TopologyService()
    this.setupApiRoutes()
    this.setupStaticFileServing()

    this.topologySourcesService = new TopologySourcesService()
    this.dataSourceService = new DataSourceService()
    await this.topologyService.initializeSample()
    // One-shot: retroactively mint entity_registry rows for existing contributions
    // so the entity-keyed mapping backfills below have entity ids to translate to.
    await this.topologyService.backfillEntityRegistry()
    // One-shot: migrate legacy mapping_json → metrics mapping rows (entity-keyed).
    await this.topologyService.backfillMetricsBindings()
    // One-shot (Phase 2): migrate existing metrics-binding attachments into
    // metrics_mapping rows, then stop reading/writing binding attachments.
    await this.topologyService.backfillMetricsMappingRows()

    console.log(`[Server] Database has ${this.topologyService.list().length} topologies`)

    // Start background health checker for data sources
    startHealthChecker()
    // Start the discovery scheduler — periodically syncs every attached
    // topology source on the cadence its topology default configures.
    // Set SHUMOKU_DISCOVERY_SCHEDULER=off to disable (dev / debugging).
    startSyncScheduler()
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
    stopSyncScheduler()
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
