/**
 * Discovery Scheduler
 *
 * Walks every topology's attached topology sources on a fixed cadence
 * and runs the same sync flow the manual "Sync now" button calls.
 *
 * Decision per (topology, source) on each tick:
 *
 *   1. Topology default discovery mode is `disabled`?  → skip.
 *      (Per-node `disabled` is honored downstream by the resolver's
 *      absence-implies-retraction gate — a still-running scan won't
 *      retract excluded nodes. The scheduler only cares whether to
 *      run the scan at all, which is a topology-level question.)
 *
 *   2. `now - lastSyncedAt < intervalMs` (effective topology default,
 *      with a floor at MIN_INTERVAL)?  → skip, not due yet.
 *
 *   3. Source is in exponential backoff after consecutive failures?
 *      → skip until the backoff window passes.
 *
 *   4. Otherwise → call `syncSource()` and record the result.
 *
 * Why a scheduler instead of cron jobs in the DB:
 *   - One process, one source of truth. No "two replicas both fired
 *     the same poll" race.
 *   - The HealthChecker pattern (see `health-checker.ts`) already
 *     exists in this codebase and operators understand it — match
 *     that surface so on-call doesn't have to learn a second pattern.
 *
 * Why the topology default and not per-node intervals:
 *   - Source plugins are coarse-grained — `plugin.scan()` walks the
 *     whole reachable surface, you can't tell NetBox "skip these IPs
 *     and grab those". A per-node interval is meaningless until we
 *     have a partial-scan capability. Tracked separately.
 *
 * Disable via `SHUMOKU_DISCOVERY_SCHEDULER=off`.
 */

import { computeEffectivePolicy, type NetworkGraph, RUNTIME_DEFAULT } from '@shumoku/core'
import { getDatabase } from '../db/index.js'
import { hasAutoscanCapability, hasTopologyCapability } from '../plugins/types.js'
import { DataSourceService } from './datasource.js'
import { ObservationsService } from './observations.js'
import { TopologyService } from './topology.js'
import { TopologySourcesService } from './topology-sources.js'

const TICK_INTERVAL_MS = 60_000 // 1 minute
const MIN_SYNC_INTERVAL_MS = 5 * 60_000 // 5 minutes — guard against runaway
const MAX_BACKOFF_MS = 30 * 60_000 // 30 minutes max after repeated failures
const BACKOFF_BASE_MS = 2 * 60_000 // 2 minutes — first retry after a failure

/**
 * One-shot sync of a single (topology, source). Extracted from the
 * `POST /sources/:sourceId/sync` endpoint so the scheduler can call
 * the same path. Returns the recorded observation summary.
 */
export async function syncSource(
  topologyId: string,
  sourceId: string,
  deps: {
    topologyService: TopologyService
    topologySourcesService: TopologySourcesService
    dataSourceService: DataSourceService
    observationsService: ObservationsService
  },
): Promise<{
  status: 'ok' | 'partial' | 'failed' | 'empty'
  statusMessage?: string
  nodeCount: number
  linkCount: number
}> {
  const attached = deps.topologySourcesService.find(topologyId, sourceId, 'topology')
  if (!attached) {
    throw new Error(`Source ${sourceId} is not attached to topology ${topologyId}`)
  }
  const plugin = deps.dataSourceService.getPlugin(sourceId)
  if (!plugin) throw new Error(`Plugin for data source ${sourceId} failed to load`)

  const capturedAt = Date.now()
  let graph: NetworkGraph | null = null
  let status: 'ok' | 'partial' | 'failed' | 'empty' = 'ok'
  let statusMessage: string | undefined

  try {
    if (hasAutoscanCapability(plugin)) {
      const snapshot = await plugin.scan({ seeds: [] })
      graph = snapshot.graph
      status = snapshot.status
      statusMessage = snapshot.statusMessage
    } else if (hasTopologyCapability(plugin)) {
      const opts = attached.optionsJson ? JSON.parse(attached.optionsJson) : undefined
      graph = await plugin.fetchTopology(opts)
      status = graph && graph.nodes && graph.nodes.length > 0 ? 'ok' : 'empty'
    } else {
      throw new Error(
        `Plugin ${plugin.type} cannot supply topology (no autoscan or topology capability)`,
      )
    }
  } catch (err) {
    status = 'failed'
    statusMessage = err instanceof Error ? err.message : String(err)
    graph = null
  }

  await deps.observationsService.record({
    topologyId,
    sourceId,
    capturedAt,
    status,
    statusMessage,
    graph,
  })
  deps.observationsService.updateHysteresis(
    topologyId,
    sourceId,
    status === 'failed' ? 'failed' : 'ok',
    capturedAt,
  )
  deps.topologyService.clearCacheEntry(topologyId)
  deps.topologySourcesService.updateLastSynced(attached.id)

  return {
    status,
    statusMessage,
    nodeCount: graph?.nodes?.length ?? 0,
    linkCount: graph?.links?.length ?? 0,
  }
}

/**
 * Exponential backoff. After N consecutive failures, wait
 * BACKOFF_BASE_MS * 2^(N-1), capped at MAX_BACKOFF_MS. Same shape as
 * HealthChecker.calculateBackoff but anchored on a longer base — we
 * don't want a flaky NetBox to be re-polled every 30 seconds.
 */
function backoffFor(failCount: number): number {
  if (failCount <= 0) return 0
  const backoff = BACKOFF_BASE_MS * 2 ** Math.min(failCount - 1, 5)
  return Math.min(backoff, MAX_BACKOFF_MS)
}

export class DiscoveryScheduler {
  private topologyService: TopologyService
  private topologySourcesService: TopologySourcesService
  private dataSourceService: DataSourceService
  private observationsService: ObservationsService
  private intervalId: ReturnType<typeof setInterval> | null = null
  private isRunning = false
  private tickInFlight = false

  constructor() {
    this.topologyService = new TopologyService()
    this.topologySourcesService = new TopologySourcesService()
    this.dataSourceService = new DataSourceService()
    this.observationsService = new ObservationsService()
  }

  start(): void {
    if (this.isRunning) {
      console.log('[DiscoveryScheduler] already running')
      return
    }
    const flag = process.env['SHUMOKU_DISCOVERY_SCHEDULER']
    if (flag && flag.toLowerCase() === 'off') {
      console.log('[DiscoveryScheduler] disabled by SHUMOKU_DISCOVERY_SCHEDULER=off')
      return
    }
    this.isRunning = true
    console.log(
      `[DiscoveryScheduler] starting (tick=${TICK_INTERVAL_MS / 1000}s, min-sync=${
        MIN_SYNC_INTERVAL_MS / 1000
      }s)`,
    )
    // First tick after a short delay so server boot logs don't interleave
    // with the first scan's diagnostics.
    setTimeout(() => this.tick(), 10_000)
    this.intervalId = setInterval(() => this.tick(), TICK_INTERVAL_MS)
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
    this.isRunning = false
    console.log('[DiscoveryScheduler] stopped')
  }

  /**
   * One scheduler tick. Sequential per (topology, source) — we don't
   * want a tick to fan out 30 parallel SNMP scans against an
   * unsuspecting network. The manual "Sync all" button already
   * parallelises; the scheduler is the slow background drip.
   */
  private async tick(): Promise<void> {
    if (this.tickInFlight) {
      // A previous tick is still running (slow scan or many sources).
      // Skip this one rather than queueing — better to miss a beat
      // than to stack and saturate.
      return
    }
    this.tickInFlight = true
    try {
      const topologies = this.topologyService.list()
      const now = Date.now()
      for (const topology of topologies) {
        const sources = this.topologySourcesService.listByPurpose(topology.id, 'topology')
        if (sources.length === 0) continue

        // The topology default policy gates every source on this topology
        // uniformly. Per-node overrides only affect what the resolver
        // emits, not whether we ask the source at all (the source returns
        // its whole reachable surface — partial-scan is out of scope).
        const topologyDefault = await this.readTopologyDefault(topology.id)
        const effective = computeEffectivePolicy({
          node: { discovery: undefined, parent: undefined },
          topologyDefault,
        })
        if (effective.mode === 'disabled') continue

        const intervalMs = Math.max(effective.intervalMs, MIN_SYNC_INTERVAL_MS)
        for (const source of sources) {
          if (source.lastSyncedAt && now - source.lastSyncedAt < intervalMs) continue

          const consecutiveFailures = this.readConsecutiveFailures(source.id)
          if (consecutiveFailures > 0 && source.lastSyncedAt) {
            const wait = backoffFor(consecutiveFailures)
            if (now - source.lastSyncedAt < wait) continue
          }

          try {
            const result = await syncSource(topology.id, source.dataSourceId, {
              topologyService: this.topologyService,
              topologySourcesService: this.topologySourcesService,
              dataSourceService: this.dataSourceService,
              observationsService: this.observationsService,
            })
            console.log(
              `[DiscoveryScheduler] ${topology.name} ← ${source.dataSourceId}: ${result.status} (${result.nodeCount} nodes, ${result.linkCount} links)`,
            )
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            console.warn(
              `[DiscoveryScheduler] ${topology.name} ← ${source.dataSourceId}: error — ${msg}`,
            )
          }
        }
      }
    } finally {
      this.tickInFlight = false
    }
  }

  /**
   * Read the topology default discovery policy from the authored
   * (Manual) graph. We deliberately don't fold per-node overrides
   * here — the scheduler asks at the topology level only.
   */
  private async readTopologyDefault(
    topologyId: string,
  ): Promise<import('@shumoku/core').DiscoveryPolicy | undefined> {
    const topology = this.topologyService.get(topologyId)
    if (!topology?.manualSourceId) return undefined
    const graph = this.topologyService.readManualGraph(topology.manualSourceId)
    return graph?.discovery
  }

  /**
   * Read `consecutive_failures` for a topology_data_sources row.
   * Inlined SQL because the existing service doesn't expose it; the
   * column was added by migration alongside `last_ok_captured_at`.
   */
  private readConsecutiveFailures(attachmentId: string): number {
    const row = getDatabase()
      .query('SELECT consecutive_failures FROM topology_data_sources WHERE id = ?')
      .get(attachmentId) as { consecutive_failures: number } | undefined
    return row?.consecutive_failures ?? 0
  }
}

let scheduler: DiscoveryScheduler | null = null

export function getDiscoveryScheduler(): DiscoveryScheduler {
  if (!scheduler) scheduler = new DiscoveryScheduler()
  return scheduler
}

export function startDiscoveryScheduler(): void {
  getDiscoveryScheduler().start()
}

export function stopDiscoveryScheduler(): void {
  scheduler?.stop()
}

// Re-export so callers that already import discovery types don't pull
// from too many places.
export { RUNTIME_DEFAULT }
