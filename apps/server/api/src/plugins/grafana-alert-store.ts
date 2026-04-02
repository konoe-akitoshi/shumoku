/**
 * DB-backed AlertStoreService implementation for Grafana plugin
 * Uses SQLite to store webhook-received alerts
 */

import type { Database } from 'bun:sqlite'
import type { Alert, AlertQueryOptions, AlertSeverity } from '@shumoku/core'
import type { AlertStoreService, GrafanaWebhookPayload } from 'shumoku-plugin-grafana'
import { buildTitle, filterLabels, mapSeverity, SEVERITY_ORDER } from 'shumoku-plugin-grafana'
import { getDatabase } from '../db/index.js'

interface GrafanaAlertRow {
  id: string
  data_source_id: string
  severity: string
  title: string
  description: string | null
  host: string | null
  status: string
  started_at: number
  ended_at: number | null
  received_at: number
  source_url: string | null
  labels_json: string | null
}

function rowToAlert(row: GrafanaAlertRow): Alert & { receivedAt: number } {
  return {
    id: row.id,
    severity: row.severity as AlertSeverity,
    title: row.title,
    description: row.description ?? undefined,
    host: row.host ?? undefined,
    startTime: row.started_at,
    endTime: row.ended_at ?? undefined,
    receivedAt: row.received_at,
    status: row.status as 'active' | 'resolved',
    source: 'grafana',
    url: row.source_url ?? undefined,
    labels: row.labels_json ? JSON.parse(row.labels_json) : undefined,
  }
}

export class GrafanaAlertStore implements AlertStoreService {
  private db: Database

  constructor() {
    this.db = getDatabase()
  }

  /**
   * Get alerts for a data source from DB
   */
  getAlerts(dataSourceId: string, options?: AlertQueryOptions): (Alert & { receivedAt: number })[] {
    const conditions = ['data_source_id = ?']
    const params: (string | number)[] = [dataSourceId]

    if (options?.activeOnly) {
      conditions.push("status = 'active'")
    }

    if (options?.timeRange) {
      const cutoff = Date.now() - options.timeRange * 1000
      conditions.push('(status = ? OR started_at > ?)')
      params.push('active', cutoff)
    }

    const where = conditions.join(' AND ')
    const rows = this.db
      .query(`SELECT * FROM grafana_alerts WHERE ${where} ORDER BY received_at DESC`)
      .all(...params) as GrafanaAlertRow[]

    let alerts = rows.map(rowToAlert)

    if (options?.minSeverity) {
      const minOrder = SEVERITY_ORDER[options.minSeverity]
      alerts = alerts.filter((a) => SEVERITY_ORDER[a.severity] >= minOrder)
    }

    return alerts
  }

  /**
   * Upsert alerts from a Grafana webhook payload
   */
  upsertFromWebhook(dataSourceId: string, payload: GrafanaWebhookPayload): number {
    const now = Date.now()
    let count = 0

    const upsert = this.db.query(`
      INSERT INTO grafana_alerts (id, data_source_id, severity, title, description, host, status, started_at, ended_at, received_at, source_url, labels_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        severity = excluded.severity,
        title = excluded.title,
        description = excluded.description,
        host = excluded.host,
        status = excluded.status,
        started_at = excluded.started_at,
        ended_at = excluded.ended_at,
        received_at = excluded.received_at,
        source_url = excluded.source_url,
        labels_json = excluded.labels_json
    `)

    for (const a of payload.alerts) {
      const severity = mapSeverity(a.labels['severity'])
      const title = buildTitle(a.labels)
      const description = a.annotations?.['description'] || a.annotations?.['summary'] || null
      const host = a.labels['hostname'] || a.labels['instance'] || a.labels['host'] || null
      const status = a.status === 'firing' ? 'active' : 'resolved'
      const startedAt = new Date(a.startsAt).getTime()
      const endedAt = a.endsAt ? new Date(a.endsAt).getTime() : null
      const labels = filterLabels(a.labels)

      upsert.run(
        a.fingerprint,
        dataSourceId,
        severity,
        title,
        description,
        host,
        status,
        startedAt,
        endedAt,
        now,
        a.generatorURL || null,
        JSON.stringify(labels),
      )
      count++
    }

    return count
  }

  /**
   * Clean up old resolved alerts
   */
  cleanup(maxAgeMs: number): number {
    const cutoff = Date.now() - maxAgeMs
    const result = this.db
      .query("DELETE FROM grafana_alerts WHERE status = 'resolved' AND received_at < ?")
      .run(cutoff)
    return result.changes
  }
}
