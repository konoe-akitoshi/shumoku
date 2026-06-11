// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Derivation queue — one background bake (resolve + layout, in a Worker) per
 * topology. The serving layer (`getParsed`) never computes in-request anymore:
 * it serves the last-good artifact (possibly stale) and kicks a bake here;
 * when the bake lands, the artifact + RAM cache are refreshed and viewers
 * pick it up (share SSE watches the served revision; the app polls while
 * `stale`).
 *
 * Module-level state on purpose: TopologyService is instantiated ad hoc in
 * several places, but there must never be two Workers baking the same
 * topology.
 */

import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { DeriveResult, TopologyService } from './topology.js'

/** Hard ceiling — a runaway layout must not pin a core forever. */
const DERIVE_TIMEOUT_MS = 30 * 60_000

/**
 * Worker entry path. In the bundled production image the worker ships as a
 * sibling bundle of the server entry (`/app/derive-worker.js`, see
 * esbuild.config.js + Dockerfile); in dev we run the TS source directly.
 */
function deriveWorkerUrl(): URL {
  const bundled = new URL('./derive-worker.js', import.meta.url)
  try {
    if (existsSync(fileURLToPath(bundled))) return bundled
  } catch {
    // non-file URL (unlikely) — fall through to the TS source
  }
  return new URL('./derive-worker.ts', import.meta.url)
}

export type DeriveStage = 'resolve' | 'icons' | 'layout'

interface DeriveJob {
  promise: Promise<void>
  stage: DeriveStage
  startedAt: number
  startedRevision: number
  worker: Worker
  /** Settle the promise and tear down (used by cancel + completion). */
  settle: () => void
}

const jobs = new Map<string, DeriveJob>()

/** Whether a bake is currently in flight for this topology. */
export function isDeriving(topologyId: string): boolean {
  return jobs.has(topologyId)
}

/** Current stage of the in-flight bake, if any (progress surface for the UI). */
export function derivationStatus(
  topologyId: string,
): { stage: DeriveStage; startedAt: number } | null {
  const job = jobs.get(topologyId)
  return job ? { stage: job.stage, startedAt: job.startedAt } : null
}

/** Terminate an in-flight bake. Returns whether one was running. */
export function cancelDerivation(topologyId: string): boolean {
  const job = jobs.get(topologyId)
  if (!job) return false
  job.settle()
  return true
}

/**
 * Ensure a bake is running for the topology; returns a promise that settles
 * when it finishes (success, error, cancel, or timeout). Deduped — kicking
 * while one is in flight returns the in-flight promise. If the composition
 * revision moved while baking, a follow-up bake is kicked automatically so
 * the artifact converges without waiting for the next request.
 */
export function kickDerivation(topologyId: string, svc: TopologyService): Promise<void> {
  const existing = jobs.get(topologyId)
  if (existing) return existing.promise

  const inputs = svc.collectDeriveInputs(topologyId)
  if (!inputs) return Promise.resolve()
  const startedRevision = svc.compositionRevisionOf(topologyId)

  const worker = new Worker(deriveWorkerUrl().href)
  let settle: () => void = () => {}
  const promise = new Promise<void>((done) => {
    let settled = false
    const timer = setTimeout(() => {
      svc.recordDeriveError(
        topologyId,
        startedRevision,
        `layout did not finish within ${DERIVE_TIMEOUT_MS / 60_000} minutes`,
      )
      settle()
    }, DERIVE_TIMEOUT_MS)
    settle = () => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      worker.terminate()
      jobs.delete(topologyId)
      done()
    }
    worker.onmessage = (event: MessageEvent) => {
      const msg = event.data as
        | { type: 'progress'; stage: DeriveStage }
        | ({ type: 'result' } & DeriveResult)
        | { type: 'error'; message: string }
      if (msg.type === 'progress') {
        const job = jobs.get(topologyId)
        if (job) job.stage = msg.stage
        return
      }
      if (msg.type === 'result') {
        try {
          svc.completeDerivation(topologyId, startedRevision, msg)
        } catch (err) {
          console.error(`[derivation] Failed to persist bake for ${topologyId}:`, err)
        }
      } else {
        svc.recordDeriveError(topologyId, startedRevision, msg.message)
      }
      settle()
      // Inputs changed mid-bake → what we just wrote is already stale; bake
      // again immediately so viewers converge.
      if (svc.compositionRevisionOf(topologyId) !== startedRevision) {
        void kickDerivation(topologyId, svc)
      }
    }
    worker.onerror = (event: ErrorEvent) => {
      svc.recordDeriveError(topologyId, startedRevision, event.message || 'derive worker crashed')
      settle()
    }
  })

  jobs.set(topologyId, {
    promise,
    stage: 'resolve',
    startedAt: Date.now(),
    startedRevision,
    worker,
    settle,
  })
  worker.postMessage(inputs)
  return promise
}
