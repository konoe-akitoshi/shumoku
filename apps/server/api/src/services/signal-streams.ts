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
import type { MetricsData } from '@shumoku/core'
import { getDatabase } from '../db/index.js'

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
   *
   * The `metrics_trends.entity_id` (and the keys inside the `metrics_history`
   * blob) are the resolved graph's `node.id` / `link.id`. Since the Phase 3
   * entity-id flip those ARE the stable registry entity ids — so this stream is
   * now keyed by the true entity id (as the column name always implied), and a
   * device keeps its trend history across re-scans / id churn. Rows written by a
   * pre-flip server stay keyed by the old element ids; they are not migrated
   * (no id-keyed reader exists yet) and simply age out under retention.
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
  // Written by the alert collector (`alert-collector.ts`), which keeps each source's state;
  // this service only prunes the history (`housekeeping`).

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
