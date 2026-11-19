/**
 * HTTP + WebSocket Server using Hono + Bun
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import { hasAlertsCapability, linkSpeedBps } from '@shumoku/core'
import type { Server as BunServer, ServerWebSocket } from 'bun'
import { Hono } from 'hono'
import { serveStatic } from 'hono/bun'
import { cors } from 'hono/cors'
import { HTTPException } from 'hono/http-exception'
import { createAuthApplicationService } from './app/auth.js'
import { createCredentialApplicationService } from './app/credentials.js'
import { createDashboardApplicationService } from './app/dashboard.js'
import { createDataSourceCrudService } from './app/data-source-crud.js'
import { createDataSourceOperationsService } from './app/data-source-operations.js'
import { createDataSourceScanService } from './app/data-source-scan.js'
import { createDeviceApplicationService } from './app/devices.js'
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
import { getProxyAuthConfig } from './auth/proxy-auth.js'
import { admitWebSocketUpgrade } from './auth/resolve-principal.js'
import { closeDatabase, getDatabase, initDatabase } from './db/index.js'
import { MockMetricsProvider } from './mock-metrics.js'
import { apiError } from './openapi/common.js'
import { createApiRouter } from './openapi/router.js'
import {
  hasMetricsCapability,
  loadPluginsFromConfig,
  pluginRegistry,
  registerBundledPlugins,
} from './plugins/index.js'
import { AlertCollector } from './services/alert-collector.js'
import {
  assertAuthenticationReady,
  bootstrapAdminAuthentication,
  getSessionPrincipal,
  isSetupComplete,
} from './services/auth.js'
import { getDashboardService } from './services/dashboard.js'
import { DataSourceService } from './services/datasource.js'
import { GrafanaAlertService } from './services/grafana-alerts.js'
import { startHealthChecker, stopHealthChecker } from './services/health-checker.js'
import { LiveClients } from './services/live-clients.js'
import {
  getSubscriberCount,
  liveSubscriberCount,
  publishMetrics,
  setWatchChangeCallback,
} from './services/metrics-hub.js'
import { aggregateMetricsData, type MetricsSourcePoll } from './services/metrics-merge.js'
import { ObservationsService } from './services/observations.js'
import { PollScheduler } from './services/poll-scheduler.js'
import { PollingPolicy } from './services/polling.js'
import { SettingsService } from './services/settings.js'
import { getSignalStreams } from './services/signal-streams.js'
import {
  getSyncScheduler,
  getSyncSchedulerStatus,
  startSyncScheduler,
  stopSyncScheduler,
} from './services/sync-scheduler.js'
import { getBuildInfo, getSystemInfo } from './services/system-info.js'
import { type ParsedTopology, TopologyService } from './services/topology.js'
import { TopologySourcesService } from './services/topology-sources.js'
import type { ClientMessage, ClientState, Config, MetricsData, MetricsMapping } from './types.js'
import { readWebUiCsp, webUiCsp } from './web-ui-csp.js'

export class Server {
  private app: Hono
  private config: Config
  private topologyService: TopologyService | null = null
  private topologySourcesService: TopologySourcesService | null = null
  private dataSourceService: DataSourceService | null = null
  private metricsProvider: MockMetricsProvider
  private clients: Map<ServerWebSocket<ClientState>, ClientState> = new Map()
  /** Who watches which topology on `/ws`, and what each is sent. */
  private readonly live = new LiveClients<ServerWebSocket<ClientState>>(
    {
      exists: (topology) => this.topologyService?.get(topology) !== undefined,
      revisionOf: (topology) => this.topologyService?.servedRevisionOf(topology) ?? 0,
      mappingVersionOf: (topology) => this.topologyService?.mappingVersionOf(topology) ?? 0,
      metricsOf: (topology) => this.liveMetricsOf(topology),
    },
    (ws, message) => {
      try {
        ws.send(JSON.stringify(message))
      } catch (err) {
        console.error('[WebSocket] Failed to send:', err)
      }
    },
    (topology) => this.pollScheduler?.notifyWatchChanged(topology),
  )
  private pollScheduler: PollScheduler | null = null
  /** Collects every alert source once; every reader reads what it found. */
  private alertCollector: AlertCollector | null = null
  /** How often each data source is read: Settings defaults and per-source overrides. */
  private pollingPolicy: PollingPolicy | null = null
  /**
   * Each (topology, source)'s last metrics poll, reused until the source is due again: its
   * reading, or its failure (so a failing source is not asked again before its interval). Only
   * reused for the same data source configuration and the same mapping (`version`).
   */
  private readonly lastSourcePoll = new Map<
    string,
    { at: number; version: string; poll?: MetricsSourcePoll; error?: string }
  >()
  /** Bumped by every mapping save, so a poll made for the old mapping is not reused. */
  private readonly mappingGeneration = new Map<string, number>()
  private housekeepingInterval: ReturnType<typeof setInterval> | null = null
  /** Tells each client when a topology it watches was drawn again or its mapping changed. */
  private versionInterval: ReturnType<typeof setInterval> | null = null
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
    // Last-resort handler: route handlers do their own error shaping; anything
    // that still escapes must come back as JSON (the API contract), not Hono's
    // default text/plain 500.
    this.app.onError((err, c) => {
      // A middleware that answers with a status of its own (the development credential's 401)
      // throws it as an HTTPException: that answer stands, it is not a fault.
      if (err instanceof HTTPException) return err.getResponse()
      console.error(`[Server] Unhandled error on ${c.req.method} ${c.req.path}:`, err)
      return apiError(c, 'Internal server error', 500)
    })
    this.app.notFound((c) => apiError(c, 'Not found', 404))
    this.app.use('*', cors())
  }

  private setupStaticFileServing(): void {
    // Skip static file serving in development mode
    if (process.env.NODE_ENV === 'development') {
      console.log(
        '[Server] Development mode - skipping static file serving (use the apps/server/web dev server)',
      )
      return
    }

    const webBuildPath = this.getWebBuildPath()
    if (webBuildPath && fs.existsSync(webBuildPath)) {
      console.log(`[Server] Serving static files from: ${webBuildPath}`)

      const indexPath = path.join(webBuildPath, 'index.html')
      const csp = fs.existsSync(indexPath)
        ? readWebUiCsp(fs.readFileSync(indexPath, 'utf-8'))
        : null
      if (csp) {
        this.app.use('/*', webUiCsp(csp))
      } else {
        console.warn('[Server] Web UI build has no CSP meta; serving it without a CSP header')
      }

      // Serve static assets
      this.app.use('/*', serveStatic({ root: webBuildPath }))

      // SPA fallback - serve index.html for all non-API routes
      this.app.get('*', async (c) => {
        // Unknown API paths must 404 as JSON, not resolve to the SPA shell.
        if (c.req.path.startsWith('/api/')) {
          return c.notFound()
        }
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
    const state: ClientState = { principal: ws.data.principal }
    ws.data = state
    this.clients.set(ws, state)
    this.live.add(ws)
    console.log(`[WebSocket] Client connected (total: ${this.clients.size})`)
  }

  private handleClientMessage(ws: ServerWebSocket<ClientState>, data: string): void {
    if (data.length > 16_384) {
      ws.close(1009, 'Message too large')
      return
    }
    try {
      this.live.receive(ws, JSON.parse(data) as ClientMessage)
    } catch (err) {
      console.error('[WebSocket] Failed to parse message:', err)
    }
  }

  private handleWebSocketClose(ws: ServerWebSocket<ClientState>): void {
    this.clients.delete(ws)
    this.live.remove(ws)
    console.log(`[WebSocket] Client disconnected (remaining: ${this.clients.size})`)
  }

  /**
   * A topology's live metrics as a client is sent them: the last poll, with the parse error (if
   * any) among its warnings; or only that warning when nothing was polled yet; else nothing.
   */
  private liveMetricsOf(topology: string): MetricsData | undefined {
    const metrics = this.dbTopologyMetrics.get(topology)
    const parseError = this.topologyService?.getParseError(topology)
    if (!parseError) return metrics
    const warning = `Parse error: ${parseError.message}`
    if (metrics) return { ...metrics, warnings: [...(metrics.warnings ?? []), warning] }
    return { nodes: {}, links: {}, timestamp: Date.now(), warnings: [warning] }
  }

  private broadcastMetrics(): void {
    this.live.broadcastMetrics()
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
      return this.live.isWatched(topologyId)
    }

    // A topology polls as often as the most often read of its metrics sources wants (each
    // source's own interval: Settings default or its override); unwatched, at most once a
    // background interval.
    const cadenceOf = (topologyId: string, watched: boolean): number | undefined => {
      const sources = this.topologySourcesService?.listByPurpose(topologyId, 'metrics') ?? []
      if (sources.length === 0) return undefined
      const shortest = Math.min(...sources.map((s) => this.polling().metricsMs(s.dataSourceId)))
      return watched ? shortest : Math.max(shortest, slowInterval)
    }

    this.pollScheduler = new PollScheduler(
      { fastInterval, slowInterval, concurrencyLimit, jitterMax: 1000, cadenceOf },
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
        // A new mapping: read every source again, not what was read for the old one.
        this.mappingGeneration.set(topologyId, (this.mappingGeneration.get(topologyId) ?? 0) + 1)
        sched.pokeTopology(topologyId)
      })
      // Topology create/delete → register/unregister with the scheduler. The
      // scheduler seeds its state map once at start(); without this, a
      // topology created after startup would never be polled again once its
      // last live subscriber disconnects.
      this.topologyService.setTopologyLifecycleHook((topologyId, event) => {
        if (event === 'created') sched.addTopology(topologyId)
        else {
          sched.removeTopology(topologyId)
          this.forgetSourcePolls(topologyId, new Set())
        }
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
    this.versionInterval = setInterval(() => this.live.pushVersions(), 1000)
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
    this.forgetSourcePolls(topology.id, new Set(metricsSources.map((s) => s.dataSourceId)))
    if (metricsSources.length > 0) {
      const mappingsBySource = this.topologyService.buildMappingsBySource(
        topology.id,
        parsed.graph,
        parsed.record,
      )

      // Poll all sources concurrently — they're independent plugin
      // instances hitting independent upstreams, so a poll cycle
      // should cost max(source latency), not the sum. `allSettled`
      // keeps one source's failure from sinking the others.
      const polled = await Promise.allSettled(
        metricsSources.map(async (source) => {
          const dataSource = this.dataSourceService?.get(source.dataSourceId)
          if (!dataSource) return null
          // Not due yet (its own interval is longer than the topology's cadence): its last
          // reading still stands in the merge, so redundancy and priority see every source.
          const cacheKey = `${topology.id}\u0000${dataSource.id}`
          const version = `${dataSource.updatedAt}\u0000${this.mappingGeneration.get(topology.id) ?? 0}`
          const last = this.lastSourcePoll.get(cacheKey)
          const due = this.polling().metricsMs(dataSource.id)
          if (last && last.version === version && Date.now() - last.at < due - 1000) {
            if (last.poll) return last.poll
            throw new Error(last.error ?? 'Datasource poll failed')
          }
          const config = JSON.parse(dataSource.configJson)
          const plugin = await pluginRegistry.getInstance(dataSource.id, dataSource.type, config)
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
          let polledData: Awaited<ReturnType<typeof plugin.pollMetrics>>
          try {
            polledData = await plugin.pollMetrics(mapping)
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error)
            this.lastSourcePoll.set(cacheKey, { at: Date.now(), version, error: message })
            throw error
          }
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
          const poll: MetricsSourcePoll = {
            source: { id: dataSource.id, name: dataSource.name, type: dataSource.type },
            data: { ...polledData, nodes, links },
          }
          this.lastSourcePoll.set(cacheKey, { at: Date.now(), version, poll })
          return poll
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

  /**
   * One alert collector for the process: every alert-capable data source, asked for its open
   * alerts on an interval. The plugin is asked directly (not `DataSourceService.getAlerts`,
   * which answers an empty list for a source it cannot reach: here that would resolve
   * everything).
   */
  /** Drop the kept polls of a topology's sources that it no longer reads (or of all of them). */
  private forgetSourcePolls(topologyId: string, keep: ReadonlySet<string>): void {
    const prefix = `${topologyId}\u0000`
    for (const key of this.lastSourcePoll.keys()) {
      if (key.startsWith(prefix) && !keep.has(key.slice(prefix.length))) {
        this.lastSourcePoll.delete(key)
      }
    }
  }

  private polling(): PollingPolicy {
    if (this.pollingPolicy) return this.pollingPolicy
    const settings = new SettingsService()
    const dataSources = new DataSourceService()
    this.pollingPolicy = new PollingPolicy({
      setting: (key) => settings.get(key),
      override: (id) => dataSources.get(id)?.polling,
      envMetricsMs: this.config.server.pollInterval,
    })
    return this.pollingPolicy
  }

  private createAlertCollector(dataSources: DataSourceService): AlertCollector {
    if (this.alertCollector) return this.alertCollector
    const polling = this.polling()
    this.alertCollector = new AlertCollector({
      db: getDatabase(),
      listSources: () => dataSources.listByCapability('alerts').map((source) => source.id),
      exists: (id) => dataSources.get(id) !== null,
      // 0: not collected (`off`), keeping what was collected.
      intervalMs: (id) => polling.alertsMs(id),
      fetchAlerts: async (id) => {
        const plugin = await dataSources.getPlugin(id)
        if (!plugin || !hasAlertsCapability(plugin)) {
          throw new Error('Data source cannot report alerts')
        }
        return plugin.getAlerts({ activeOnly: true })
      },
    })
    return this.alertCollector
  }

  private createAppServices(): AppServices {
    const topologyService = this.topologyService
    if (!topologyService) throw new Error('Topology service is not initialized')
    const dataSourceService = new DataSourceService()
    const alertCollector = this.createAlertCollector(dataSourceService)
    const observationsService = new ObservationsService()
    const topologySourcesService = new TopologySourcesService()
    const dashboardService = getDashboardService()
    return {
      system: { getBuildInfo, getSystemInfo },
      admin: { getStatus: () => this.getAdminStatus() },
      auth: createAuthApplicationService(),
      dataSources: {
        crud: createDataSourceCrudService(dataSourceService, topologyService, alertCollector),
        operations: createDataSourceOperationsService(dataSourceService, alertCollector),
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
      devices: createDeviceApplicationService({
        topologies: topologyService,
        observations: observationsService,
      }),
      credentials: createCredentialApplicationService({ topologies: topologyService }),
      share: createShareApplicationService({
        topologies: topologyService,
        dashboards: dashboardService,
        dataSources: dataSourceService,
        alerts: alertCollector,
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
    await bootstrapAdminAuthentication()
    getProxyAuthConfig()
    assertAuthenticationReady(this.config.server.host)
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
    getSyncScheduler().setDefaultInterval(() => this.polling().syncMs())
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
          // AUTH GATE: the live-metrics socket requires an authenticated
          // principal with workspace read permission.
          // It bypasses Hono (and thus authMiddleware), so without this check ANY
          // anonymous client could otherwise subscribe to ANY topology id and
          // receive its live metrics + internal warnings — a data leak.
          const principal = admitWebSocketUpgrade(req, getSessionPrincipal, isSetupComplete())
          if (principal instanceof Response) return principal
          const upgraded = server.upgrade(req, {
            data: { principal },
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

    // Collect alerts and poll metrics after the server is listening (sources may be slow).
    this.alertCollector?.start()
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
    this.alertCollector?.stop()
    if (this.housekeepingInterval) {
      clearInterval(this.housekeepingInterval)
      this.housekeepingInterval = null
    }
    if (this.versionInterval) {
      clearInterval(this.versionInterval)
      this.versionInterval = null
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
