// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import type { Alert } from '@shumoku/core'
import { getDatabase } from '../../src/db/index.ts'
import { RETENTION, SignalStreamsService } from '../../src/services/signal-streams.ts'
import { setupTempDb, type TempDb } from './helper.ts'

let db_: TempDb
let streams: SignalStreamsService
beforeAll(() => {
  db_ = setupTempDb()
  streams = new SignalStreamsService()
})
afterAll(() => db_.teardown())

const HOUR = 3600_000

const metricsAt = (at: number, util: number) => ({
  nodes: { n1: { status: 'up' as const } },
  links: { l1: { status: 'up' as const, utilization: util, inBps: 100, outBps: 50 } },
  timestamp: at,
})

describe('metrics stream — raw history + hourly trends', () => {
  test('records raw snapshots and flushes a trend row on hour rollover', () => {
    const hour0 = Math.floor(Date.now() / HOUR) * HOUR - 3 * HOUR
    streams.recordMetrics('topo1', metricsAt(hour0 + 60_000, 10))
    streams.recordMetrics('topo1', metricsAt(hour0 + 120_000, 30))
    // hour rollover → previous hour's buckets flush
    streams.recordMetrics('topo1', metricsAt(hour0 + HOUR + 60_000, 50))

    const db = getDatabase()
    const history = db
      .query('SELECT COUNT(*) AS n FROM metrics_history WHERE topology_id = ?')
      .get('topo1') as { n: number }
    expect(history.n).toBe(3)

    const trend = db
      .query(
        `SELECT samples, util_min, util_avg, util_max, status_worst
         FROM metrics_trends
         WHERE topology_id = ? AND entity_kind = 'link' AND entity_id = 'l1' AND hour_start = ?`,
      )
      .get('topo1', hour0) as {
      samples: number
      util_min: number
      util_avg: number
      util_max: number
      status_worst: string
    }
    expect(trend.samples).toBe(2)
    expect(trend.util_min).toBe(10)
    expect(trend.util_max).toBe(30)
    expect(trend.util_avg).toBe(20)
    expect(trend.status_worst).toBe('up')
  })

  test('raw payload round-trips through gzip', () => {
    const db = getDatabase()
    const row = db
      .query(
        'SELECT payload FROM metrics_history WHERE topology_id = ? ORDER BY captured_at LIMIT 1',
      )
      .get('topo1') as { payload: Uint8Array }
    const decoded = JSON.parse(Buffer.from(Bun.gunzipSync(row.payload)).toString())
    expect(decoded.links.l1.utilization).toBe(10)
  })
})

describe('alert stream — state transitions only', () => {
  const alert = (id: string, severity: Alert['severity'], status: Alert['status']): Alert =>
    ({ id, severity, status, title: id, startTime: 0, source: 's' }) as Alert

  test('fired → changed → resolved, idempotent against re-fetches', async () => {
    expect(await streams.ingestAlerts('src1', null, [alert('a1', 'high', 'active')])).toBe(1)
    // same state again → no new transition
    expect(await streams.ingestAlerts('src1', null, [alert('a1', 'high', 'active')])).toBe(0)
    // severity moved → changed
    expect(await streams.ingestAlerts('src1', null, [alert('a1', 'critical', 'active')])).toBe(1)
    // explicit resolved
    expect(await streams.ingestAlerts('src1', null, [alert('a1', 'critical', 'resolved')])).toBe(1)
    // resolved again → nothing
    expect(await streams.ingestAlerts('src1', null, [alert('a1', 'critical', 'resolved')])).toBe(0)

    const db = getDatabase()
    const transitions = db
      .query('SELECT transition FROM alert_events WHERE alert_key = ? ORDER BY rowid')
      .all('a1') as { transition: string }[]
    expect(transitions.map((t) => t.transition)).toEqual(['fired', 'changed', 'resolved'])
  })

  test('disappearance resolves ONLY with fullActiveSet', async () => {
    await streams.ingestAlerts('src2', null, [alert('b1', 'high', 'active')])
    // filtered fetch without b1 — must NOT resolve it
    expect(await streams.ingestAlerts('src2', null, [], { fullActiveSet: false })).toBe(0)
    // unfiltered active set without b1 — resolves it
    expect(await streams.ingestAlerts('src2', null, [], { fullActiveSet: true })).toBe(1)
    const db = getDatabase()
    const last = db
      .query('SELECT transition FROM alert_events WHERE alert_key = ? ORDER BY rowid DESC LIMIT 1')
      .get('b1') as { transition: string }
    expect(last.transition).toBe('resolved')
  })
})

describe('housekeeping — stream retentions', () => {
  test('deletes rows beyond each retention window', () => {
    const db = getDatabase()
    const now = Date.now()
    db.query(
      'INSERT OR REPLACE INTO metrics_history (topology_id, captured_at, payload) VALUES (?, ?, ?)',
    ).run('old', now - RETENTION.metricsHistoryMs - 1000, Buffer.from('x'))
    const before = (db.query('SELECT COUNT(*) AS n FROM metrics_history').get() as { n: number }).n
    const pruned = streams.housekeeping(now)
    expect(pruned.history).toBeGreaterThanOrEqual(1)
    const after = (db.query('SELECT COUNT(*) AS n FROM metrics_history').get() as { n: number }).n
    expect(after).toBe(before - pruned.history)
  })
})
