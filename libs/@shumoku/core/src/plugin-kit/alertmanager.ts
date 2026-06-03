// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import type { Alert, AlertQueryOptions } from '../plugin-types.js'
import { mapAlertmanagerSeverity, severityAtLeast } from './severity.js'

/**
 * Shared Alertmanager (`/api/v2/alerts`) adapter.
 *
 * grafana and prometheus both spoke Alertmanager and had hand-rolled,
 * drifted copies of this parse (different host-label priority, prometheus
 * dropped `labels` and built a poorer title, both mishandled a missing
 * `endsAt`). This is the single parser they now share; plugins only do the
 * HTTP fetch (via the SDK `httpClient`) and pass the JSON here.
 */

/** Subset of an Alertmanager v2 alert we read. */
export interface AlertmanagerAlert {
  fingerprint: string
  labels: Record<string, string>
  annotations?: Record<string, string>
  startsAt: string
  endsAt?: string
  status: { state: 'active' | 'suppressed' | 'unprocessed' }
  generatorURL?: string
}

/** Host from the common label dialects, in priority order. */
export function extractHost(labels: Record<string, string>): string | undefined {
  return labels['hostname'] || labels['instance'] || labels['host'] || undefined
}

/** Display title: `"<alertname> - <host>"`, or just the name when no host. */
export function buildAlertTitle(labels: Record<string, string>): string {
  const name = labels['alertname'] || 'Unknown Alert'
  const host = extractHost(labels)
  return host ? `${name} - ${host}` : name
}

/** Drop Alertmanager-internal labels (`__name__`, other `__…`). */
export function filterAlertLabels(labels: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(labels)) {
    if (key.startsWith('__')) continue
    out[key] = value
  }
  return out
}

export interface ParseAlertmanagerOptions {
  /** Plugin `type`, stamped into `Alert.source`. */
  source: string
  /** Query filters (timeRange / activeOnly / minSeverity). */
  query?: AlertQueryOptions
  /** Injected clock for deterministic tests (defaults to `Date.now()`). */
  now?: number
}

/**
 * Parse an Alertmanager response into core `Alert[]`, applying the standard
 * active/timeRange and minSeverity filters.
 *
 * - Active alerts are always kept; resolved alerts are dropped when
 *   `activeOnly`, otherwise dropped once older than `timeRange` (default 1h).
 * - Unparseable `startsAt` falls back to `now`; missing/unparseable `endsAt`
 *   yields `undefined` (no bogus epoch-0 end time).
 */
export function parseAlertmanagerAlerts(
  raw: AlertmanagerAlert[],
  options: ParseAlertmanagerOptions,
): Alert[] {
  const now = options.now ?? Date.now()
  const timeRangeMs = (options.query?.timeRange ?? 3600) * 1000
  const activeOnly = options.query?.activeOnly ?? false

  const alerts = raw
    .filter((a) => {
      if (a.status.state === 'active') return true
      if (activeOnly) return false
      const startTime = Date.parse(a.startsAt)
      return !(Number.isFinite(startTime) && now - startTime > timeRangeMs)
    })
    .map((a): Alert => {
      const start = Date.parse(a.startsAt)
      const end = a.endsAt ? Date.parse(a.endsAt) : Number.NaN
      return {
        id: a.fingerprint,
        severity: mapAlertmanagerSeverity(a.labels['severity']),
        title: buildAlertTitle(a.labels),
        description: a.annotations?.['description'] || a.annotations?.['summary'],
        host: extractHost(a.labels),
        startTime: Number.isFinite(start) ? start : now,
        endTime: Number.isFinite(end) ? end : undefined,
        status: a.status.state === 'active' ? 'active' : 'resolved',
        source: options.source,
        url: a.generatorURL,
        labels: filterAlertLabels(a.labels),
      }
    })

  const min = options.query?.minSeverity
  return min ? alerts.filter((a) => severityAtLeast(a.severity, min)) : alerts
}
