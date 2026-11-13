// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Sync-all run planning — pure step composition, no DB / plugin imports so it
 * is unit-testable (and importable) outside the Bun runtime.
 */

import type { DataSourcePlugin } from '@shumoku/core'
import { canPullTopology } from '../plugins/types.js'
import type { TopologyDataSource } from '../types.js'

export type SyncStepStatus = 'pending' | 'running' | 'done' | 'failed' | 'skipped'

export interface SyncJobStep {
  /** `fetch:<dataSourceId>`, `stored:<dataSourceId>`, `merge`, or `derive`. */
  key: string
  label: string
  status: SyncStepStatus
  message?: string
  nodeCount?: number
  linkCount?: number
}

/** A source's latest-observation counters, for the `stored:` step display. */
export interface StoredCounters {
  nodeCount: number
  linkCount: number
}

/**
 * Plan a Sync-all run: split the attached sources into pull-capable ones
 * (fetched by the job) and push-only ones (Manual — no pull capability; the
 * editor writes its data in), and build the full step list.
 *
 * A plugin that failed to LOAD stays in the pull list on purpose: its error
 * belongs on a failed fetch step, not silently downgraded to "stored".
 *
 * A `stored:` step settles at plan time: `done` with the stored counters when
 * a contribution exists (that copy joins the merge exactly like a fetched
 * one), `skipped` when the source has never saved anything.
 */
export function planSyncSteps(
  sources: TopologyDataSource[],
  canPull: (dataSourceId: string) => boolean,
  storedCountersOf: (dataSourceId: string) => StoredCounters | null,
): { pull: TopologyDataSource[]; steps: SyncJobStep[] } {
  const pull: TopologyDataSource[] = []
  const stored: TopologyDataSource[] = []
  for (const s of sources) {
    if (canPull(s.dataSourceId)) pull.push(s)
    else stored.push(s)
  }
  const steps: SyncJobStep[] = [
    ...pull.map((s) => ({
      key: `fetch:${s.dataSourceId}`,
      label: s.dataSource?.name ?? s.dataSourceId,
      status: 'pending' as SyncStepStatus,
    })),
    ...stored.map((s): SyncJobStep => {
      const counters = storedCountersOf(s.dataSourceId)
      const base = {
        key: `stored:${s.dataSourceId}`,
        label: s.dataSource?.name ?? s.dataSourceId,
      }
      if (!counters) return { ...base, status: 'skipped', message: 'No stored data yet' }
      return {
        ...base,
        status: 'done',
        message: 'Hand-edited — stored data joins the merge',
        nodeCount: counters.nodeCount,
        linkCount: counters.linkCount,
      }
    }),
    { key: 'merge', label: 'Merge sources', status: 'pending' },
    { key: 'derive', label: 'Layout', status: 'pending' },
  ]
  return { pull, steps }
}

/**
 * Which of `sources` a sync can pull from (autoscan or topology capability).
 * Resolved up front because loading a plugin is async, while `startSyncJob`
 * must stay synchronous: its running-job check and registration can't have
 * an await between them, or two concurrent starts would both get through.
 * An unloadable plugin counts as pullable, so its load error surfaces on the
 * fetch step instead of silently downgrading the source to stored.
 */
export async function resolvePullableSourceIds(
  sources: readonly TopologyDataSource[],
  dataSourceService: { getPlugin(id: string): Promise<DataSourcePlugin | null> },
): Promise<ReadonlySet<string>> {
  const checks = await Promise.all(
    sources.map(async ({ dataSourceId }) => {
      const plugin = await dataSourceService.getPlugin(dataSourceId).catch(() => null)
      return { dataSourceId, pullable: !plugin || canPullTopology(plugin) }
    }),
  )
  return new Set(checks.filter((check) => check.pullable).map((check) => check.dataSourceId))
}
