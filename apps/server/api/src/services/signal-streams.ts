/**
 * Signal streams — collection side (design: docs/design/signal-streams.md).
 *
 * Append-only, source-attributed, timestamped records are the PRIMARY data;
 * current state is a projection. This service owns the metrics stream
 * (raw history + hourly trends) and the alert stream (state transitions),
 * plus housekeeping for all stream retentions. The topology stream lives in
 * ObservationsService (it predates this module and was promoted in place).
 *
 * All writes are best-effort: a stream insert failure must never break the
 * poll loop or an alert fetch — callers wrap in try/catch or use the
 * `record*` helpers that swallow + log.
 */

import type { Database } from 'bun:sqlite'
import type { Alert, MetricsData } from '@shumoku/core'
import { generateId, getDatabase } from '../db/index.js'

// Retention defaults (ms). Deliberately module constants for now — the
// design reserves a settings surface, but none of these need live tuning
// to start accumulating. Change here = next housekeeping applies it.
export const RETENTION = {
  /** raw per-tick metrics snapshots (point-in-time weathermap) */
  metricsHistoryMs: 72 * 3600_000,
  /** hourly aggregates (sparklines, baseline deviation) */
  metricsTrendsMs: 400 * 86_400_000,
  /** alert state transitions */
  alertEventsMs: 180 * 86_400_000,
  /** topology observations (as-of rendering) — used by ObservationsService */
  topologyObservationsMs: 90 * 86_400_000,
} as const

const HOUR_MS = 3600_000

const STATUS_RANK: Record<string, number> = { up: 0, unknown: 1, degraded: 2, down: 3 }

interface TrendBucket {
  topologyId: string
  entityKind: 'node' | 'link'
  entityId: string
  hourStart: number
  samples: number
  utilMin: number | null
  utilMax: number | null
  utilSum: number
  utilSamples: number
  bpsSum: number
  bpsSamples: number
  statusWorst: string | null
}

export class SignalStreamsService {
  private db: Database
  /** open hour buckets, keyed `${topologyId}|${kind}|${id}` */
  private buckets = new Map<string, TrendBucket>()

  constructor() {
    this.db = getDatabase()
  }

  // -- metrics stream ----------------------------------------------------------

  /**
   * Record one poll tick. Layer 1 stores the full MetricsData snapshot
   * (gzip) keyed by capture time; layer 2 accumulates per-entity hour
   * buckets in RAM and flushes them when the hour rolls over (a process
   * restart loses at most the open hour — accepted, no interpolation).
   */
  recordMetrics(topologyId: string, data: MetricsData): void {
    const at = data.timestamp || Date.now()
    try {
      const payload = Bun.gzipSync(Buffer.from(JSON.stringify(data)))
      this.db
        .query(
          'INSERT OR REPLACE INTO metrics_history (topology_id, captured_at, payload) VALUES (?, ?, ?)',
        )
        .run(topologyId, at, payload)
    } catch (err) {
      console.error('[SignalStreams] metrics_history insert failed:', err)
    }

    const hourStart = Math.floor(at / HOUR_MS) * HOUR_MS
    try {
      this.flushBucketsBefore(hourStart)
      for (const [nodeId, m] of Object.entries(data.nodes ?? {})) {
        this.accumulate(topologyId, 'node', nodeId, hourStart, {
          status: m.status,
        })
      }
      for (const [linkId, m] of Object.entries(data.links ?? {})) {
        const util = m.utilization ?? maxOf(m.inUtilization, m.outUtilization)
        const bps = sumOf(m.inBps, m.outBps)
        this.accumulate(topologyId, 'link', linkId, hourStart, {
          status: m.status,
          util,
          bps,
        })
      }
    } catch (err) {
      console.error('[SignalStreams] trend accumulation failed:', err)
    }
  }

  private accumulate(
    topologyId: string,
    entityKind: 'node' | 'link',
    entityId: string,
    hourStart: number,
    sample: { status?: string; util?: number; bps?: number },
  ): void {
    const key = `${topologyId}|${entityKind}|${entityId}`
    let bucket = this.buckets.get(key)
    if (!bucket || bucket.hourStart !== hourStart) {
      if (bucket) this.flushBucket(bucket)
      bucket = {
        topologyId,
        entityKind,
        entityId,
        hourStart,
        samples: 0,
        utilMin: null,
        utilMax: null,
        utilSum: 0,
        utilSamples: 0,
        bpsSum: 0,
        bpsSamples: 0,
        statusWorst: null,
      }
      this.buckets.set(key, bucket)
    }
    bucket.samples++
    if (sample.util !== undefined && Number.isFinite(sample.util)) {
      bucket.utilMin = bucket.utilMin === null ? sample.util : Math.min(bucket.utilMin, sample.util)
      bucket.utilMax = bucket.utilMax === null ? sample.util : Math.max(bucket.utilMax, sample.util)
      bucket.utilSum += sample.util
      bucket.utilSamples++
    }
    if (sample.bps !== undefined && Number.isFinite(sample.bps)) {
      bucket.bpsSum += sample.bps
      bucket.bpsSamples++
    }
    if (sample.status !== undefined) {
      const current = bucket.statusWorst === null ? -1 : (STATUS_RANK[bucket.statusWorst] ?? 1)
      const incoming = STATUS_RANK[sample.status] ?? 1
      if (incoming > current) bucket.statusWorst = sample.status
    }
  }

  /** Flush all open buckets from hours strictly before `hourStart`. */
  private flushBucketsBefore(hourStart: number): void {
    for (const [key, bucket] of this.buckets) {
      if (bucket.hourStart < hourStart) {
        this.flushBucket(bucket)
        this.buckets.delete(key)
      }
    }
  }

  private flushBucket(bucket: TrendBucket): void {
    try {
      this.db
        .query(
          `INSERT OR REPLACE INTO metrics_trends
             (topology_id, entity_kind, entity_id, hour_start, samples,
              util_min, util_avg, util_max, bps_avg, status_worst)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          bucket.topologyId,
          bucket.entityKind,
          bucket.entityId,
          bucket.hourStart,
          bucket.samples,
          bucket.utilMin,
          bucket.utilSamples > 0 ? bucket.utilSum / bucket.utilSamples : null,
          bucket.utilMax,
          bucket.bpsSamples > 0 ? bucket.bpsSum / bucket.bpsSamples : null,
          bucket.statusWorst,
        )
    } catch (err) {
      console.error('[SignalStreams] metrics_trends flush failed:', err)
    }
  }

  /** Flush every open bucket (graceful shutdown). */
  flushAll(): void {
    for (const bucket of this.buckets.values()) this.flushBucket(bucket)
    this.buckets.clear()
  }

  // -- alert stream ------------------------------------------------------------

  /**
   * Ingest a fetched alert batch and append STATE TRANSITIONS only:
   * fired (new active), changed (severity moved while active), resolved
   * (explicit resolved status — or, when `fullActiveSet` is true,
   * disappearance from the batch). Idempotent against re-fetches of the
   * same state: no transition → no row.
   */
  async ingestAlerts(
    sourceId: string,
    topologyId: string | null,
    alerts: readonly Alert[],
    options: { fullActiveSet?: boolean; at?: number } = {},
  ): Promise<number> {
    const at = options.at ?? Date.now()
    let appended = 0
    // rowid tiebreak: several transitions for one key can land in the
    // same millisecond (webhook bursts, test batches) — "latest" must be
    // insertion order, not an arbitrary pick among `at` ties.
    const lastOf = this.db.query(
      `SELECT transition, severity FROM alert_events
       WHERE source_id = ? AND alert_key = ?
       ORDER BY at DESC, rowid DESC LIMIT 1`,
    )
    const seen = new Set<string>()
    for (const alert of alerts) {
      const key = alert.id
      seen.add(key)
      const last = lastOf.get(sourceId, key) as { transition: string; severity: string } | undefined
      if (alert.status === 'active') {
        if (!last || last.transition === 'resolved') {
          await this.appendAlertEvent(sourceId, topologyId, key, 'fired', alert, at)
          appended++
        } else if (last.severity !== alert.severity) {
          await this.appendAlertEvent(sourceId, topologyId, key, 'changed', alert, at)
          appended++
        }
      } else if (last && last.transition !== 'resolved') {
        await this.appendAlertEvent(sourceId, topologyId, key, 'resolved', alert, at)
        appended++
      }
    }
    // Disappearance = resolution, but ONLY when the caller guarantees the
    // batch is the complete active set (an unfiltered poll). A filtered
    // query must never resolve alerts it simply didn't ask about.
    if (options.fullActiveSet) {
      const open = this.db
        .query(
          `SELECT alert_key, severity FROM alert_events a
           WHERE source_id = ?
             AND rowid = (SELECT b.rowid FROM alert_events b
                          WHERE b.source_id = a.source_id AND b.alert_key = a.alert_key
                          ORDER BY b.at DESC, b.rowid DESC LIMIT 1)
             AND transition != 'resolved'`,
        )
        .all(sourceId) as { alert_key: string; severity: Alert['severity'] }[]
      for (const row of open) {
        if (seen.has(row.alert_key)) continue
        await this.appendAlertEvent(
          sourceId,
          topologyId,
          row.alert_key,
          'resolved',
          { id: row.alert_key, severity: row.severity, status: 'resolved' },
          at,
        )
        appended++
      }
    }
    return appended
  }

  private async appendAlertEvent(
    sourceId: string,
    topologyId: string | null,
    alertKey: string,
    transition: 'fired' | 'changed' | 'resolved',
    alert: Partial<Alert> & { severity: Alert['severity'] },
    at: number,
  ): Promise<void> {
    try {
      this.db
        .query(
          `INSERT INTO alert_events
             (id, topology_id, source_id, alert_key, transition, severity, node_id, at, payload_json)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          await generateId(),
          topologyId,
          sourceId,
          alertKey,
          transition,
          alert.severity,
          alert.nodeId ?? null,
          at,
          JSON.stringify(alert),
        )
    } catch (err) {
      console.error('[SignalStreams] alert_events insert failed:', err)
    }
  }

  // -- housekeeping --------------------------------------------------------------

  /** Apply stream retentions. Cheap; run at startup and periodically. */
  housekeeping(now = Date.now()): { history: number; trends: number; alerts: number } {
    const history = this.db
      .query('DELETE FROM metrics_history WHERE captured_at < ?')
      .run(now - RETENTION.metricsHistoryMs).changes
    const trends = this.db
      .query('DELETE FROM metrics_trends WHERE hour_start < ?')
      .run(now - RETENTION.metricsTrendsMs).changes
    const alerts = this.db
      .query('DELETE FROM alert_events WHERE at < ?')
      .run(now - RETENTION.alertEventsMs).changes
    return { history, trends, alerts }
  }
}

function maxOf(a?: number, b?: number): number | undefined {
  if (a === undefined) return b
  if (b === undefined) return a
  return Math.max(a, b)
}

function sumOf(a?: number, b?: number): number | undefined {
  if (a === undefined && b === undefined) return undefined
  return (a ?? 0) + (b ?? 0)
}

let instance: SignalStreamsService | null = null
export function getSignalStreams(): SignalStreamsService {
  if (!instance) instance = new SignalStreamsService()
  return instance
}
