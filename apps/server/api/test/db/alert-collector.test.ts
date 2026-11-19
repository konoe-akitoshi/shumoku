// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import type { Alert } from '@shumoku/core'
import { getDatabase } from '../../src/db/index.ts'
import { AlertCollector } from '../../src/services/alert-collector.ts'
import { setupTempDb, type TempDb } from './helper.ts'

let db_: TempDb
beforeAll(() => {
  db_ = setupTempDb()
})
afterAll(() => db_.teardown())

const alert = (id: string, over: Partial<Alert> = {}): Alert => ({
  id,
  severity: 'medium',
  title: `problem ${id}`,
  host: `host-${id}`,
  startTime: 1_000,
  status: 'active',
  source: 'test',
  ...over,
})

/** A collector over one source whose answers the test sets, on a clock the test moves. */
function rig(sourceId: string) {
  const db = getDatabase()
  db.query(
    `INSERT OR IGNORE INTO data_sources (id, name, type, config_json, created_at, updated_at)
     VALUES (?, ?, 'test', '{}', 0, 0)`,
  ).run(sourceId, sourceId)
  let answer: () => Promise<Alert[]> = async () => []
  let clock = 10_000
  let interval = 30_000
  let fetches = 0
  const make = () =>
    new AlertCollector({
      db,
      listSources: () => [sourceId],
      exists: () => true,
      fetchAlerts: () => {
        fetches++
        return answer()
      },
      now: () => clock,
      intervalMs: () => interval,
    })
  const collector = make()
  collector.syncSources()
  return {
    collector,
    make,
    answer(alerts: Alert[] | Error) {
      answer = async () => {
        if (alerts instanceof Error) throw alerts
        return alerts
      }
    },
    at(ms: number) {
      clock = ms
    },
    interval(ms: number) {
      interval = ms
    },
    fetches: () => fetches,
    /** Answer only when the returned function is called. */
    hold(alerts: Alert[]) {
      let release: () => void = () => {}
      const gate = new Promise<void>((resolve) => {
        release = resolve
      })
      answer = async () => {
        await gate
        return alerts
      }
      return () => release()
    },
    transitions(key: string) {
      return (
        db
          .query(
            'SELECT transition, occurrence FROM alert_events WHERE source_id = ? AND alert_key = ? ORDER BY rowid',
          )
          .all(sourceId, key) as { transition: string; occurrence: number }[]
      ).map((r) => `${r.transition}#${r.occurrence}`)
    },
  }
}

describe('alert collector', () => {
  beforeEach(() => {
    getDatabase().exec(
      'DELETE FROM alert_events; DELETE FROM alert_state; DELETE FROM alert_source_state',
    )
  })

  test('opens, changes and resolves by absence from a complete answer', async () => {
    const r = rig('s-life')
    r.answer([alert('a'), alert('b')])
    await r.collector.refresh('s-life')
    expect((await r.collector.read('s-life', { activeOnly: true })).map((a) => a.id)).toEqual([
      'a',
      'b',
    ])

    r.answer([alert('a', { severity: 'critical' })])
    r.at(20_000)
    await r.collector.refresh('s-life')
    const all = await r.collector.read('s-life')
    expect(all.find((a) => a.id === 'b')).toMatchObject({ status: 'resolved', endTime: 20_000 })
    expect(all.find((a) => a.id === 'a')).toMatchObject({ status: 'active', severity: 'critical' })
    expect(r.transitions('a')).toEqual(['fired#1', 'changed#1'])
    expect(r.transitions('b')).toEqual(['fired#1', 'resolved#1'])
  })

  test('a failed poll resolves nothing and says the source is failing', async () => {
    const r = rig('s-fail')
    r.answer([alert('a')])
    await r.collector.refresh('s-fail')
    r.answer(new Error('connection refused'))
    await r.collector.refresh('s-fail')

    expect(r.collector.sourceState('s-fail')).toMatchObject({
      state: 'failing',
      lastError: 'connection refused',
      failCount: 1,
    })
    await expect(r.collector.read('s-fail')).rejects.toThrow('connection refused')
    expect(r.transitions('a')).toEqual(['fired#1'])

    // Back: what closed meanwhile is resolved by the first success.
    r.answer([])
    await r.collector.refresh('s-fail')
    expect(r.collector.sourceState('s-fail')?.state).toBe('ok')
    expect(r.transitions('a')).toEqual(['fired#1', 'resolved#1'])
  })

  test('an answer breaking the contract counts as a failure, not as no alerts', async () => {
    const r = rig('s-contract')
    r.answer([alert('a')])
    await r.collector.refresh('s-contract')
    r.answer([alert('x'), alert('x')])
    await r.collector.refresh('s-contract')
    expect(r.collector.sourceState('s-contract')?.state).toBe('failing')
    expect(r.transitions('a')).toEqual(['fired#1'])
  })

  test('the same id open again after it resolved is a new occurrence', async () => {
    const r = rig('s-again')
    r.answer([alert('fp')])
    await r.collector.refresh('s-again')
    r.answer([])
    await r.collector.refresh('s-again')
    r.answer([alert('fp')])
    await r.collector.refresh('s-again')
    expect(r.transitions('fp')).toEqual(['fired#1', 'resolved#1', 'fired#2'])
  })

  test('a quiet poll writes nothing', async () => {
    const r = rig('s-quiet')
    r.answer([alert('a')])
    await r.collector.refresh('s-quiet')
    const count = () =>
      (getDatabase().query('SELECT COUNT(*) AS n FROM alert_events').get() as { n: number }).n
    const before = count()
    await r.collector.refresh('s-quiet')
    await r.collector.refresh('s-quiet')
    expect(count()).toBe(before)
  })

  test('a restart remembers what was open, and resolves what closed meanwhile', async () => {
    const r = rig('s-restart')
    r.answer([alert('a'), alert('b')])
    await r.collector.refresh('s-restart')

    r.answer([alert('a')])
    const again = r.make()
    again.start()
    await again.refresh('s-restart')
    again.stop()
    expect(r.transitions('b')).toEqual(['fired#1', 'resolved#1'])
    expect(r.transitions('a')).toEqual(['fired#1'])
  })

  test('reads the source at once when it was never collected', async () => {
    const r = rig('s-first')
    r.answer([alert('a')])
    expect((await r.collector.read('s-first')).map((a) => a.id)).toEqual(['a'])
  })

  test('a webhook-like partial answer changes only what it mentions', async () => {
    const r = rig('s-partial')
    r.answer([alert('a'), alert('b')])
    await r.collector.refresh('s-partial')
    r.collector.ingest('s-partial', [alert('a', { status: 'resolved', endTime: 15_000 })], {
      complete: false,
    })
    const all = await r.collector.read('s-partial')
    expect(all.find((a) => a.id === 'a')).toMatchObject({ status: 'resolved', endTime: 15_000 })
    expect(all.find((a) => a.id === 'b')?.status).toBe('active')
  })

  test('filters as the alerts REST did: active only, resolved within the time range', async () => {
    const r = rig('s-filter')
    r.answer([alert('old'), alert('new'), alert('open', { severity: 'high' })])
    await r.collector.refresh('s-filter')
    r.answer([alert('new'), alert('open', { severity: 'high' })])
    r.at(1_000_000)
    await r.collector.refresh('s-filter')
    r.answer([alert('open', { severity: 'high' })])
    r.at(5_000_000)
    await r.collector.refresh('s-filter')

    const ids = async (options: Parameters<AlertCollector['read']>[1]) =>
      (await r.collector.read('s-filter', options)).map((a) => a.id).sort()
    expect(await ids({ activeOnly: true })).toEqual(['open'])
    // resolved at 1,000,000 is more than an hour before 5,000,000; resolved at 5,000,000 is not
    expect(await ids({})).toEqual(['new', 'open'])
    expect(await ids({ minSeverity: 'high' })).toEqual(['open'])
  })

  test('turned off, a source keeps what it collected; turned on, it goes on from there', async () => {
    const r = rig('s-off')
    r.answer([alert('a')])
    await r.collector.refresh('s-off')
    r.interval(0)
    r.collector.syncSources()
    expect(r.collector.sourceState('s-off')?.state).toBe('off')
    await expect(r.collector.read('s-off')).rejects.toThrow('off')
    expect(r.collector.collected('s-off').map((a) => a.key)).toEqual(['a'])

    r.interval(30_000)
    r.collector.syncSources()
    await r.collector.refresh('s-off')
    expect(r.collector.sourceState('s-off')?.state).toBe('ok')
    // Still open: no second "fired" for it.
    expect(r.transitions('a')).toEqual(['fired#1'])
  })

  test('a refresh asked during a poll polls again once it is done', async () => {
    const r = rig('s-rerun')
    const release = r.hold([alert('old-config')])
    const first = r.collector.refresh('s-rerun')
    r.answer([alert('new-config')])
    const second = r.collector.refresh('s-rerun')
    release()
    await Promise.all([first, second])
    expect(r.fetches()).toBe(2)
    expect((await r.collector.read('s-rerun', { activeOnly: true })).map((a) => a.id)).toEqual([
      'new-config',
    ])
  })

  test('a poll that finishes after stop() writes nothing', async () => {
    const r = rig('s-stop')
    const release = r.hold([alert('late')])
    const poll = r.collector.refresh('s-stop')
    r.collector.stop()
    release()
    await poll
    expect(r.transitions('late')).toEqual([])
  })
})
