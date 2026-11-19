/**
 * AlertCollector — the Server collects each alert source once and keeps its state
 * (apps/server/docs/design/alert-collection.md, Phase 1).
 *
 * Before, every open screen asked the monitoring system through the API on its own: load grew
 * with the screens, screens disagreed, and nothing knew when an alert started or resolved.
 * Now one loop per alert-capable data source asks `getAlerts({ activeOnly: true })` every
 * interval, and every reader (the signed-in REST, the shared dashboards) reads what it found.
 *
 * The rules:
 *
 *   - Only a complete answer resolves. An open alert missing from a successful answer is
 *     resolved then (`resolved_by = 'absent'`); one the answer itself calls resolved takes the
 *     source's end time (`'source'`). A failed or timed-out poll changes nothing: the source
 *     goes `failing`, its alerts stay as they were (frozen, never resolved), and readers are
 *     told it is not updating.
 *   - An id open again after it resolved is a new occurrence (`occurrence + 1`), as PagerDuty
 *     treats a dedup key after a resolve.
 *   - Only transitions are written (`alert_state` + `alert_events`); a quiet poll writes
 *     nothing. The state is read back at start, so a restart remembers what was open and
 *     resolves what closed meanwhile on the next success.
 *   - A failing source backs off: interval × 2^(failures − 1), at most 5 minutes.
 *
 * Single process (as the metrics hub and the WS client table are).
 */

import type { Database } from 'bun:sqlite'
import type { Alert, AlertQueryOptions } from '@shumoku/core'
import {
  meetsAlertsContract,
  severityAtLeast,
  validateAlertsContract,
} from '@shumoku/core/plugin-kit'

export type AlertSourceStateName = 'ok' | 'failing' | 'never' | 'off'

export interface AlertSourceState {
  sourceId: string
  state: AlertSourceStateName
  lastSuccessAt: number | null
  lastAttemptAt: number | null
  lastError: string | null
  failCount: number
}

/** One alert as the Server keeps it: the plugin's `Alert` and what the Server knows of it. */
export interface CollectedAlert {
  sourceId: string
  key: string
  occurrence: number
  groupKey: string
  status: Alert['status']
  severity: Alert['severity']
  startedAt: number
  resolvedAt: number | null
  resolvedBy: 'source' | 'absent' | null
  firstSeenAt: number
  lastSeenAt: number
  alert: Alert
}

export interface AlertCollectorDeps {
  db: Database
  /** The data sources to collect: every alert-capable one. */
  listSources(): string[]
  /**
   * Whether a data source still exists. One that is no longer listed but exists (its plugin
   * failed to load, say) is set `off` and keeps what was collected; a gone one is forgotten.
   */
  exists?(sourceId: string): boolean
  /** `plugin.getAlerts({ activeOnly: true })` for a source; throws when it cannot answer. */
  fetchAlerts(sourceId: string): Promise<Alert[]>
  now?: () => number
  /** How often to collect a source (ms); 0: not collected (`off`). Default 30 s. */
  intervalMs?: (sourceId: string) => number
  /** The longest one poll may take before it counts as failed. Default 30 s. */
  timeoutMs?: number
  /** Polls running at once across sources. Default 3. */
  concurrency?: number
}

const DEFAULT_INTERVAL_MS = 30_000
const MAX_BACKOFF_MS = 5 * 60_000
/** Resolved rows are kept this long: enough for "show resolved" and the change log. */
const RESOLVED_KEEP_MS = 24 * 3_600_000
/** Spread loops that share an interval. */
const JITTER_MS = 1_000

interface SourceLoop {
  state: AlertSourceState
  alerts: Map<string, CollectedAlert>
  timer: ReturnType<typeof setTimeout> | null
  running: Promise<void> | null
}

interface StateRow {
  source_id: string
  alert_key: string
  occurrence: number
  group_key: string
  status: string
  severity: string
  started_at: number
  resolved_at: number | null
  resolved_by: string | null
  first_seen_at: number
  last_seen_at: number
  alert_json: string
}

interface SourceStateRow {
  source_id: string
  state: string
  last_success_at: number | null
  last_attempt_at: number | null
  last_error: string | null
  fail_count: number
}

/** What repeats of one problem share, until plugins say it themselves (Phase 3). */
function groupKeyOf(alert: Alert): string {
  return `${alert.host ?? ''}\u0000${alert.title}`
}

function rowToCollected(row: StateRow): CollectedAlert | null {
  let alert: Alert
  try {
    alert = JSON.parse(row.alert_json) as Alert
  } catch {
    return null
  }
  return {
    sourceId: row.source_id,
    key: row.alert_key,
    occurrence: row.occurrence,
    groupKey: row.group_key,
    status: row.status === 'resolved' ? 'resolved' : 'active',
    severity: row.severity as Alert['severity'],
    startedAt: row.started_at,
    resolvedAt: row.resolved_at,
    resolvedBy:
      row.resolved_by === 'source' || row.resolved_by === 'absent' ? row.resolved_by : null,
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
    alert,
  }
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export class AlertCollector {
  private readonly deps: AlertCollectorDeps
  private readonly now: () => number
  private readonly loops = new Map<string, SourceLoop>()
  private running = 0
  /** Set by `stop()`: a poll that finishes afterwards writes nothing (the DB may be closed). */
  private stopped = false
  private readonly waiting: (() => void)[] = []
  private started = false
  private resync: ReturnType<typeof setInterval> | null = null

  constructor(deps: AlertCollectorDeps) {
    this.deps = deps
    this.now = deps.now ?? Date.now
  }

  /** Read the kept state, then collect every source now and on its interval. */
  start(): void {
    if (this.started) return
    this.started = true
    this.stopped = false
    this.load()
    this.syncSources()
    for (const id of this.loops.keys()) this.schedule(id, 0)
    // Settings can turn a source's alerts on or off; follow them within a minute.
    this.resync = setInterval(() => this.syncSources(), 60_000)
  }

  stop(): void {
    this.started = false
    this.stopped = true
    if (this.resync) clearInterval(this.resync)
    this.resync = null
    for (const loop of this.loops.values()) {
      if (loop.timer) clearTimeout(loop.timer)
      loop.timer = null
    }
  }

  /**
   * Match the loops to the alert-capable data sources: start the new ones (collected at once),
   * drop the gone ones and what was kept of them. Call after a data source is created, updated
   * or deleted.
   */
  syncSources(): void {
    const wanted = new Set(this.deps.listSources())
    for (const id of [...this.loops.keys()]) {
      if (wanted.has(id)) continue
      if (this.deps.exists?.(id)) this.setOff(id)
      else this.forget(id)
    }
    for (const id of wanted) {
      const loop = this.loops.get(id)
      if (this.interval(id) === 0) {
        if (!loop) this.loops.set(id, this.newLoop(id))
        this.setOff(id)
        continue
      }
      if (!loop) {
        this.loops.set(id, this.newLoop(id))
        if (this.started) this.schedule(id, 0)
      } else if (loop.state.state === 'off') {
        // Turned back on: collected again at once, against what was kept.
        loop.state = { ...loop.state, state: 'never' }
        if (this.started) this.schedule(id, 0)
      }
    }
  }

  /** Collect a source now (the data source changed, or someone asked); resolves when done. */
  refresh(sourceId: string): Promise<void> {
    const loop = this.loops.get(sourceId)
    if (!loop || loop.state.state === 'off') return Promise.resolve()
    // A poll running now may have started before the change that asks for this one (a new
    // configuration): poll again once it is done.
    if (loop.running) return loop.running.then(() => this.refresh(sourceId))
    if (loop.timer) clearTimeout(loop.timer)
    loop.timer = null
    return this.run(sourceId)
  }

  /** How collecting a source goes; null when it is not collected. */
  sourceState(sourceId: string): AlertSourceState | null {
    return this.loops.get(sourceId)?.state ?? null
  }

  /**
   * The alerts kept for a source, filtered as the alerts REST always offered: `activeOnly`,
   * resolved ones within `timeRange` (s, default 1 h), `minSeverity`, `hostIds`. Collected at
   * once if the source was never collected yet. Throws while the source cannot be read
   * (failing or never answered), so a reader says "not updating" instead of "all clear".
   */
  async read(sourceId: string, options: AlertQueryOptions = {}): Promise<Alert[]> {
    const loop = this.loops.get(sourceId)
    if (!loop) throw new Error('Data source does not collect alerts')
    if (loop.state.state === 'off') throw new Error('Alerts are off for this data source')
    if (loop.state.state === 'never') await this.refresh(sourceId)
    if (loop.state.state !== 'ok') {
      throw new Error(loop.state.lastError ?? 'Alerts are not collected yet')
    }
    const since = this.now() - (options.timeRange ?? 3600) * 1000
    const out: Alert[] = []
    for (const kept of loop.alerts.values()) {
      if (kept.status !== 'active') {
        if (options.activeOnly || (kept.resolvedAt ?? 0) < since) continue
      }
      if (options.minSeverity && !severityAtLeast(kept.severity, options.minSeverity)) continue
      if (options.hostIds?.length && !options.hostIds.includes(kept.alert.hostId ?? '')) continue
      out.push(this.toAlert(kept))
    }
    return out
  }

  /** Every alert kept for a source, with what the Server knows of it (open and recently resolved). */
  collected(sourceId: string): CollectedAlert[] {
    return [...(this.loops.get(sourceId)?.alerts.values() ?? [])]
  }

  /**
   * Take an answer for a source. `complete`: it is every open alert (a successful poll), so an
   * open alert missing from it is resolved. Not complete (a webhook): only what it mentions
   * changes.
   */
  ingest(sourceId: string, alerts: readonly Alert[], options: { complete: boolean }): void {
    const loop = this.loops.get(sourceId)
    if (!loop) return
    const at = this.now()
    const writes: CollectedAlert[] = []
    const events: { kept: CollectedAlert; transition: 'fired' | 'changed' | 'resolved' }[] = []
    const seen = new Set<string>()

    for (const alert of alerts) {
      seen.add(alert.id)
      const held = loop.alerts.get(alert.id)
      if (alert.status === 'active') {
        if (!held || held.status === 'resolved') {
          const kept: CollectedAlert = {
            sourceId,
            key: alert.id,
            occurrence: held ? held.occurrence + 1 : 1,
            groupKey: groupKeyOf(alert),
            status: 'active',
            severity: alert.severity,
            startedAt: alert.startTime,
            resolvedAt: null,
            resolvedBy: null,
            firstSeenAt: at,
            lastSeenAt: at,
            alert,
          }
          loop.alerts.set(alert.id, kept)
          writes.push(kept)
          events.push({ kept, transition: 'fired' })
        } else {
          const changed = held.severity !== alert.severity || held.alert.title !== alert.title
          held.alert = alert
          held.lastSeenAt = at
          if (changed) {
            held.severity = alert.severity
            held.groupKey = groupKeyOf(alert)
            writes.push(held)
            events.push({ kept: held, transition: 'changed' })
          }
        }
      } else if (held && held.status === 'active') {
        held.status = 'resolved'
        held.resolvedAt = alert.endTime ?? at
        held.resolvedBy = 'source'
        held.alert = alert
        writes.push(held)
        events.push({ kept: held, transition: 'resolved' })
      }
    }

    if (options.complete) {
      for (const held of loop.alerts.values()) {
        if (held.status !== 'active' || seen.has(held.key)) continue
        held.status = 'resolved'
        held.resolvedAt = at
        held.resolvedBy = 'absent'
        writes.push(held)
        events.push({ kept: held, transition: 'resolved' })
      }
    }

    try {
      this.write(writes, events, at)
    } catch (error) {
      // Memory moved ahead of the DB: put it back as the DB has it, so the next poll sees these
      // transitions again and writes them then. The poll counts as failed.
      this.reloadAlerts(sourceId)
      throw error
    }
    this.prune(loop, at)
  }

  // --- the loop ---------------------------------------------------------------------------

  private newLoop(sourceId: string): SourceLoop {
    return {
      state: {
        sourceId,
        state: 'never',
        lastSuccessAt: null,
        lastAttemptAt: null,
        lastError: null,
        failCount: 0,
      },
      alerts: new Map(),
      timer: null,
      running: null,
    }
  }

  private interval(sourceId: string): number {
    return this.deps.intervalMs?.(sourceId) ?? DEFAULT_INTERVAL_MS
  }

  /** Not collected (interval 0, or its plugin is gone): no timer; what was kept stays. */
  private setOff(sourceId: string): void {
    const loop = this.loops.get(sourceId)
    if (!loop) return
    if (loop.timer) clearTimeout(loop.timer)
    loop.timer = null
    if (loop.state.state === 'off') return
    loop.state = { ...loop.state, state: 'off' }
    this.saveSourceState(loop.state)
  }

  private schedule(sourceId: string, delay: number): void {
    const loop = this.loops.get(sourceId)
    if (!loop || !this.started || loop.state.state === 'off') return
    if (loop.timer) clearTimeout(loop.timer)
    loop.timer = setTimeout(() => {
      loop.timer = null
      this.run(sourceId).catch((error) => {
        console.error(`[AlertCollector] poll of ${sourceId} failed:`, error)
      })
    }, delay)
  }

  private nextDelay(loop: SourceLoop): number {
    const interval = this.interval(loop.state.sourceId) || DEFAULT_INTERVAL_MS
    const base =
      loop.state.state === 'failing'
        ? Math.min(interval * 2 ** Math.max(0, loop.state.failCount - 1), MAX_BACKOFF_MS)
        : interval
    return base + Math.random() * JITTER_MS
  }

  /** One poll of a source; a second call while one runs waits for it. */
  private run(sourceId: string): Promise<void> {
    const loop = this.loops.get(sourceId)
    if (!loop) return Promise.resolve()
    if (loop.running) return loop.running
    loop.running = this.withSlot(() => this.poll(sourceId, loop)).finally(() => {
      loop.running = null
      if (this.loops.get(sourceId) === loop) this.schedule(sourceId, this.nextDelay(loop))
    })
    return loop.running
  }

  private async poll(sourceId: string, loop: SourceLoop): Promise<void> {
    const at = this.now()
    loop.state.lastAttemptAt = at
    try {
      const alerts = await this.withTimeout(this.deps.fetchAlerts(sourceId))
      const check = validateAlertsContract(alerts)
      if (!meetsAlertsContract(check)) {
        throw new Error(`The source broke the alerts contract: ${JSON.stringify(check)}`)
      }
      if (this.loops.get(sourceId) !== loop || this.stopped) return
      this.ingest(sourceId, alerts, { complete: true })
      loop.state = {
        ...loop.state,
        state: 'ok',
        lastSuccessAt: this.now(),
        lastError: null,
        failCount: 0,
      }
    } catch (error) {
      if (this.loops.get(sourceId) !== loop || this.stopped) return
      loop.state = {
        ...loop.state,
        state: 'failing',
        lastError: errorText(error),
        failCount: loop.state.failCount + 1,
      }
    }
    this.saveSourceState(loop.state)
  }

  /** A state write that fails is logged, not thrown: the state in memory is still right. */
  private saveSourceState(state: AlertSourceState): void {
    if (this.stopped) return
    try {
      this.writeSourceState(state)
    } catch (error) {
      console.error('[AlertCollector] source state write failed:', error)
    }
  }

  private withTimeout<T>(promise: Promise<T>): Promise<T> {
    const ms = this.deps.timeoutMs ?? 30_000
    let timer: ReturnType<typeof setTimeout> | undefined
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`No answer within ${ms / 1000} s`)), ms)
    })
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
  }

  private async withSlot<T>(task: () => Promise<T>): Promise<T> {
    const limit = this.deps.concurrency ?? 3
    // A slot freed while others wait is handed to the next one as it is (`running` unchanged),
    // so no new caller can take it in between.
    if (this.running >= limit) await new Promise<void>((resolve) => this.waiting.push(resolve))
    else this.running++
    try {
      return await task()
    } finally {
      const next = this.waiting.shift()
      if (next) next()
      else this.running--
    }
  }

  // --- storage ----------------------------------------------------------------------------

  private load(): void {
    const { db } = this.deps
    const states = db.query('SELECT * FROM alert_source_state').all() as SourceStateRow[]
    for (const row of states) {
      const loop = this.newLoop(row.source_id)
      loop.state = {
        sourceId: row.source_id,
        // What was collected before a restart is not current until the next success.
        state: 'never',
        lastSuccessAt: row.last_success_at,
        lastAttemptAt: row.last_attempt_at,
        lastError: row.last_error,
        failCount: row.fail_count,
      }
      this.loops.set(row.source_id, loop)
    }
    const rows = db.query('SELECT * FROM alert_state').all() as StateRow[]
    for (const row of rows) {
      const kept = rowToCollected(row)
      if (!kept) continue
      let loop = this.loops.get(row.source_id)
      if (!loop) {
        loop = this.newLoop(row.source_id)
        this.loops.set(row.source_id, loop)
      }
      loop.alerts.set(row.alert_key, kept)
    }
  }

  /** A source's kept alerts again from the DB (after a write that failed). */
  private reloadAlerts(sourceId: string): void {
    const loop = this.loops.get(sourceId)
    if (!loop) return
    const rows = this.deps.db
      .query('SELECT * FROM alert_state WHERE source_id = ?')
      .all(sourceId) as StateRow[]
    loop.alerts.clear()
    for (const row of rows) {
      const kept = rowToCollected(row)
      if (kept) loop.alerts.set(row.alert_key, kept)
    }
  }

  private write(
    rows: readonly CollectedAlert[],
    events: readonly { kept: CollectedAlert; transition: 'fired' | 'changed' | 'resolved' }[],
    at: number,
  ): void {
    if (rows.length === 0 && events.length === 0) return
    const { db } = this.deps
    const upsert = db.prepare(
      `INSERT OR REPLACE INTO alert_state
         (source_id, alert_key, occurrence, group_key, status, severity, started_at,
          resolved_at, resolved_by, first_seen_at, last_seen_at, alert_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    const append = db.prepare(
      `INSERT INTO alert_events
         (id, topology_id, source_id, alert_key, transition, severity, node_id, at, payload_json,
          occurrence)
       VALUES (?, NULL, ?, ?, ?, ?, NULL, ?, ?, ?)`,
    )
    db.transaction(() => {
      for (const r of rows) {
        upsert.run(
          r.sourceId,
          r.key,
          r.occurrence,
          r.groupKey,
          r.status,
          r.severity,
          r.startedAt,
          r.resolvedAt,
          r.resolvedBy,
          r.firstSeenAt,
          r.lastSeenAt,
          JSON.stringify(r.alert),
        )
      }
      for (const { kept, transition } of events) {
        append.run(
          crypto.randomUUID(),
          kept.sourceId,
          kept.key,
          transition,
          kept.severity,
          transition === 'resolved' ? (kept.resolvedAt ?? at) : at,
          JSON.stringify(this.toAlert(kept)),
          kept.occurrence,
        )
      }
    })()
  }

  private writeSourceState(state: AlertSourceState): void {
    this.deps.db
      .prepare(
        `INSERT OR REPLACE INTO alert_source_state
           (source_id, state, last_success_at, last_attempt_at, last_error, fail_count)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        state.sourceId,
        state.state,
        state.lastSuccessAt,
        state.lastAttemptAt,
        state.lastError,
        state.failCount,
      )
  }

  /** Resolved rows older than `RESOLVED_KEEP_MS` go (their history stays in `alert_events`). */
  private prune(loop: SourceLoop, at: number): void {
    const gone: string[] = []
    for (const kept of loop.alerts.values()) {
      if (kept.status === 'resolved' && at - (kept.resolvedAt ?? at) > RESOLVED_KEEP_MS) {
        gone.push(kept.key)
      }
    }
    if (gone.length === 0) return
    const del = this.deps.db.prepare(
      'DELETE FROM alert_state WHERE source_id = ? AND alert_key = ?',
    )
    this.deps.db.transaction(() => {
      for (const key of gone) {
        loop.alerts.delete(key)
        del.run(loop.state.sourceId, key)
      }
    })()
  }

  /** A source no longer collected: stop it and drop what was kept (history stays). */
  private forget(sourceId: string): void {
    const loop = this.loops.get(sourceId)
    if (loop?.timer) clearTimeout(loop.timer)
    this.loops.delete(sourceId)
    const { db } = this.deps
    db.prepare('DELETE FROM alert_state WHERE source_id = ?').run(sourceId)
    db.prepare('DELETE FROM alert_source_state WHERE source_id = ?').run(sourceId)
  }

  private toAlert(kept: CollectedAlert): Alert {
    return {
      ...kept.alert,
      status: kept.status,
      ...(kept.resolvedAt !== null ? { endTime: kept.resolvedAt } : {}),
    }
  }
}
