// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Sync job — a tracked, cancellable "Sync all" run for one topology.
 *
 * The POST endpoint starts the job and returns immediately; the UI polls
 * `GET /topologies/:id/sync-job` to drive a progress modal, so a page reload
 * mid-sync simply re-attaches to the same job (state lives here, not in the
 * request). Steps: one fetch per pull-capable topology source, one instantly-
 * settled `stored:` step per push-only source (Manual — the editor already
 * wrote its data; the step shows that the stored copy joins the run), then
 * the bake split into `merge` (resolve — read every source's stored
 * contribution and fold them) and `derive` (icons + layout), tracked live
 * from the derivation queue's substage.
 *
 * Cancellation is honored at stage boundaries: an in-flight plugin fetch
 * cannot be aborted (no signal in the plugin contract), but its result is
 * discarded — nothing is recorded — and the derivation Worker is terminated.
 *
 * Module-level registry (one job per topology, the previous job is kept until
 * the next start) for the same reason as the derivation queue: services are
 * instantiated ad hoc, job identity must not be.
 */

import type { NetworkGraph } from '@shumoku/core'
import { parseSyncOptions } from '../plugins/sync-options.js'
import { canPullTopology, hasAutoscanCapability, hasTopologyCapability } from '../plugins/types.js'
import type { TopologyDataSource } from '../types.js'
import type { DataSourceService } from './datasource.js'
import { cancelDerivation, derivationStatus } from './derivation.js'
import type { ObservationsService } from './observations.js'
import { planSyncSteps, type SyncJobStep } from './sync-plan.js'
import { resolveCredentialsForAutoscan, resolveSeedsForAutoscan } from './sync-scheduler.js'
import type { TopologyService } from './topology.js'
import type { TopologySourcesService } from './topology-sources.js'

export type { StoredCounters, SyncJobStep, SyncStepStatus } from './sync-plan.js'
export { planSyncSteps } from './sync-plan.js'

export interface SyncJob {
  id: string
  topologyId: string
  state: 'running' | 'done' | 'failed' | 'cancelled'
  startedAt: number
  finishedAt?: number
  steps: SyncJobStep[]
  cancelRequested: boolean
}

export interface SyncJobDeps {
  topologyService: TopologyService
  topologySourcesService: TopologySourcesService
  dataSourceService: DataSourceService
  observationsService: ObservationsService
}

const jobs = new Map<string, SyncJob>()

/**
 * Wire view of a job: the running bake step (merge or derive) carries the live
 * Worker substage so the modal can show progress without a second endpoint.
 */
export function syncJobView(
  job: SyncJob,
): SyncJob & { steps: Array<SyncJobStep & { stage?: string }> } {
  const status = derivationStatus(job.topologyId)
  return {
    ...job,
    steps: job.steps.map((s) =>
      (s.key === 'merge' || s.key === 'derive') && s.status === 'running' && status
        ? { ...s, stage: status.stage }
        : s,
    ),
  }
}

export function getSyncJob(topologyId: string): SyncJob | null {
  return jobs.get(topologyId) ?? null
}

/** Request cancellation: flag the job and terminate the derivation Worker. */
export function cancelSyncJob(topologyId: string): SyncJob | null {
  const job = jobs.get(topologyId)
  if (!job || job.state !== 'running') return job ?? null
  job.cancelRequested = true
  cancelDerivation(topologyId)
  return job
}

/**
 * Start a Sync-all job. Returns null when no topology sources are attached;
 * throws nothing — per-source failures land in the step states. No-op
 * (returns the running job) when one is already in flight.
 */
export function startSyncJob(
  topologyId: string,
  sources: TopologyDataSource[],
  deps: SyncJobDeps,
): SyncJob | null {
  const existing = jobs.get(topologyId)
  if (existing && existing.state === 'running') return existing
  if (sources.length === 0) return null

  const latestBySource = new Map(
    deps.observationsService.latestPerSource(topologyId).map((o) => [o.sourceId, o]),
  )
  const { pull, steps } = planSyncSteps(
    sources,
    (dataSourceId) => {
      const plugin = deps.dataSourceService.getPlugin(dataSourceId)
      return !plugin || canPullTopology(plugin)
    },
    (dataSourceId) => {
      const latest = latestBySource.get(dataSourceId)
      return latest ? { nodeCount: latest.nodeCount, linkCount: latest.linkCount } : null
    },
  )

  const job: SyncJob = {
    id: `${topologyId}-${Date.now()}`,
    topologyId,
    state: 'running',
    startedAt: Date.now(),
    steps,
    cancelRequested: false,
  }
  jobs.set(topologyId, job)
  void runSyncJob(job, pull, deps)
  return job
}

async function runSyncJob(
  job: SyncJob,
  sources: TopologyDataSource[],
  deps: SyncJobDeps,
): Promise<void> {
  const { topologyId } = job
  let anyChanged = false
  // Drive every source in parallel — slow netbox shouldn't block fast snmp.
  await Promise.allSettled(
    sources.map(async (source, i) => {
      const step = job.steps[i]
      if (!step) return
      step.status = 'running'
      try {
        const plugin = deps.dataSourceService.getPlugin(source.dataSourceId)
        if (!plugin) throw new Error('Data source not found / plugin failed to load')

        const capturedAt = Date.now()
        let graph: NetworkGraph | null = null
        let status: 'ok' | 'partial' | 'failed' | 'empty' = 'ok'
        let statusMessage: string | undefined

        if (hasAutoscanCapability(plugin)) {
          const credentials = await resolveCredentialsForAutoscan(topologyId, deps.topologyService)
          // Seed from what the topology already knows, so a device another
          // source identified gets read even though nobody listed it as a
          // target. An empty list leaves the plugin on its own config.
          const seeds = resolveSeedsForAutoscan(topologyId)
          const snapshot = await plugin.scan({ seeds, credentials })
          graph = snapshot.graph
          status = snapshot.status
          statusMessage = snapshot.statusMessage
        } else if (hasTopologyCapability(plugin)) {
          const opts = parseSyncOptions(plugin.type, source.optionsJson)
          graph = await plugin.fetchTopology(opts)
          status = graph?.nodes && graph.nodes.length > 0 ? 'ok' : 'empty'
        } else {
          throw new Error(
            `Plugin ${plugin.type} cannot supply topology (no autoscan or topology capability)`,
          )
        }

        // Cancelled while the fetch was in flight → discard, record nothing.
        if (job.cancelRequested) {
          step.status = 'skipped'
          return
        }

        const recorded = await deps.observationsService.record({
          topologyId,
          sourceId: source.dataSourceId,
          capturedAt,
          status,
          statusMessage,
          graph,
        })
        if (recorded.contributionChanged) anyChanged = true
        deps.observationsService.updateHysteresis(
          topologyId,
          source.dataSourceId,
          status === 'failed' ? 'failed' : 'ok',
          capturedAt,
        )
        deps.topologySourcesService.updateLastSynced(source.id)

        step.status = status === 'failed' ? 'failed' : 'done'
        step.message = statusMessage
        step.nodeCount = graph?.nodes?.length ?? 0
        step.linkCount = graph?.links?.length ?? 0
      } catch (err) {
        step.status = 'failed'
        step.message = err instanceof Error ? err.message : String(err)
        console.error(`[sync-job] ${topologyId} ← ${source.dataSourceId} failed:`, step.message)
      }
    }),
  )

  const mergeStep = job.steps.find((s) => s.key === 'merge')
  const deriveStep = job.steps.find((s) => s.key === 'derive')
  const skipBake = (message?: string) => {
    if (mergeStep) mergeStep.status = 'skipped'
    if (deriveStep) {
      deriveStep.status = 'skipped'
      deriveStep.message = message
    }
  }
  // Fetch success is judged on fetch steps only — `stored:` steps settle
  // 'done' at plan time and must not mask an all-fetches-failed run. A run
  // with nothing to fetch (only push-only sources attached) has no fetch to
  // fail, so it counts as ok.
  const fetchesOk = () =>
    sources.length === 0 || job.steps.some((s) => s.key.startsWith('fetch:') && s.status === 'done')

  if (job.cancelRequested) {
    skipBake()
    finish(job, 'cancelled')
    return
  }

  // No-change gate: every source re-scanned to the same structural content →
  // the diagram cannot have changed, so skip the invalidation AND the
  // multi-minute layout re-bake entirely.
  if (!anyChanged) {
    skipBake('No changes since last sync')
    finish(job, fetchesOk() ? 'done' : 'failed')
    return
  }

  // One invalidation + one bake for the whole run (NOT per source — a
  // per-source kick would let the first bake start while later sources are
  // still recording, guaranteeing a thrown-away multi-minute layout). Same
  // `rebake` primitive the Rebuild action uses.
  //
  // The bake is one Worker run, surfaced as two steps: `merge` (the resolve
  // stage — read every source's stored contribution and fold them) and
  // `derive` (icons + layout). A poll flips merge → derive when the Worker
  // reports it has moved past resolve; a bake that finishes faster than one
  // poll tick just settles both below.
  if (mergeStep) mergeStep.status = 'running'
  const stagePoll = setInterval(() => {
    const status = derivationStatus(topologyId)
    if (status && status.stage !== 'resolve' && mergeStep?.status === 'running') {
      mergeStep.status = 'done'
      if (deriveStep?.status === 'pending') deriveStep.status = 'running'
    }
  }, 250)
  try {
    await deps.topologyService.rebake(topologyId)
  } finally {
    clearInterval(stagePoll)
  }

  if (job.cancelRequested) {
    if (mergeStep && mergeStep.status === 'running') mergeStep.status = 'skipped'
    if (deriveStep && deriveStep.status !== 'done') deriveStep.status = 'skipped'
    finish(job, 'cancelled')
    return
  }
  const deriveError = deps.topologyService.getParseError(topologyId)
  if (deriveError) {
    // Attribute the failure to the stage the Worker was last seen in: still
    // merging → the merge failed and layout never ran; past it → layout failed.
    if (mergeStep?.status === 'running') {
      mergeStep.status = 'failed'
      mergeStep.message = deriveError.message
      if (deriveStep) deriveStep.status = 'skipped'
    } else if (deriveStep) {
      deriveStep.status = 'failed'
      deriveStep.message = deriveError.message
    }
  } else {
    if (mergeStep) mergeStep.status = 'done'
    if (deriveStep) deriveStep.status = 'done'
  }
  finish(job, deriveError || !fetchesOk() ? 'failed' : 'done')
}

function finish(job: SyncJob, state: SyncJob['state']): void {
  job.state = state
  job.finishedAt = Date.now()
}
