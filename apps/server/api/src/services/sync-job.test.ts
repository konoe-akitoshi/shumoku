// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from 'vitest'
import type { TopologyDataSource } from '../types.js'
import { planSyncSteps } from './sync-plan.js'

function named(dataSourceId: string, name: string): TopologyDataSource {
  // Only the fields the planner reads are exercised; the rest of the row
  // shape is irrelevant to step planning.
  return {
    id: `tds-${dataSourceId}`,
    topologyId: 't1',
    dataSourceId,
    purpose: 'topology',
    priority: 0,
    dataSource: { name },
  } as unknown as TopologyDataSource
}

describe('planSyncSteps', () => {
  it('gives pull-capable sources a fetch step and always appends merge + derive', () => {
    const { pull, steps } = planSyncSteps(
      [named('nb', 'NetBox'), named('zx', 'Zabbix')],
      () => true,
      () => null,
    )
    expect(pull.map((s) => s.dataSourceId)).toEqual(['nb', 'zx'])
    expect(steps.map((s) => s.key)).toEqual(['fetch:nb', 'fetch:zx', 'merge', 'derive'])
    expect(
      steps.every((s) => s.key === 'merge' || s.key === 'derive' || s.status === 'pending'),
    ).toBe(true)
  })

  it('settles a push-only source as a stored step with its counters', () => {
    const { pull, steps } = planSyncSteps(
      [named('nce', 'sec'), named('man', 'Manual')],
      (id) => id !== 'man',
      (id) => (id === 'man' ? { nodeCount: 51, linkCount: 50 } : null),
    )
    expect(pull.map((s) => s.dataSourceId)).toEqual(['nce'])
    const stored = steps.find((s) => s.key === 'stored:man')
    expect(stored).toMatchObject({
      status: 'done',
      nodeCount: 51,
      linkCount: 50,
    })
    // Fetch steps come first so the runner's index-aligned loop stays valid.
    expect(steps.map((s) => s.key)).toEqual(['fetch:nce', 'stored:man', 'merge', 'derive'])
  })

  it('marks a push-only source with no saved data as skipped', () => {
    const { steps } = planSyncSteps(
      [named('man', 'Manual')],
      () => false,
      () => null,
    )
    const stored = steps.find((s) => s.key === 'stored:man')
    expect(stored).toMatchObject({ status: 'skipped', message: 'No stored data yet' })
  })

  it('keeps a source whose plugin failed to load in the pull list (error must surface)', () => {
    // canPull mirrors startSyncJob: an unloadable plugin returns true there so
    // the failure lands on a failed fetch step instead of a silent "stored".
    const { pull, steps } = planSyncSteps(
      [named('broken', 'Broken')],
      () => true,
      () => null,
    )
    expect(pull.map((s) => s.dataSourceId)).toEqual(['broken'])
    expect(steps.map((s) => s.key)).toEqual(['fetch:broken', 'merge', 'derive'])
  })
})
