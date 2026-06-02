// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import type { AlertSeverity } from '../plugin-types.js'

/**
 * Severity helpers shared by every alerts-capable plugin.
 *
 * `AlertSeverity` is core's neutral, CVSS-flavored scale. Plugins translate
 * their upstream vocabulary (Zabbix priorities, Prometheus/Alertmanager
 * `severity` labels, Aruba health tokens) into it at the plugin boundary —
 * see `docs/plugin-authoring.md`. This module owns the *ranking* and the
 * *Alertmanager* dialect mapping, which previously lived as identical copies
 * in grafana and prometheus.
 */

/**
 * Neutral severity ordering — higher is more severe. Single source of truth;
 * replaces the per-plugin `SEVERITY_ORDER` / `getSeverityOrder` copies.
 */
export const SEVERITY_RANK: Record<AlertSeverity, number> = {
  ok: 0,
  info: 1,
  low: 2,
  medium: 3,
  high: 4,
  critical: 5,
}

/** Rank of a severity (unknown → `info`). */
export function severityRank(severity: AlertSeverity): number {
  return SEVERITY_RANK[severity] ?? SEVERITY_RANK.info
}

/** True when `severity` is at least as severe as `min`. */
export function severityAtLeast(severity: AlertSeverity, min: AlertSeverity): boolean {
  return severityRank(severity) >= severityRank(min)
}

/**
 * Map an Alertmanager-style `severity` label to the neutral scale.
 *
 * Alertmanager has no fixed severity vocabulary — operators put arbitrary
 * words in the `severity` label — so this covers the common dialects
 * (Prometheus `warning`/`critical`, plus legacy Zabbix-flavored words some
 * rules still emit). Unknown or missing → `info`.
 *
 * NOTE: this is the *Alertmanager* dialect only. Plugins with their own
 * native severity vocabulary (Zabbix 0–5, Aruba tokens) map those in their
 * own code; they must not be folded in here.
 */
const ALERTMANAGER_SEVERITY: Record<string, AlertSeverity> = {
  critical: 'critical',
  disaster: 'critical',
  high: 'high',
  major: 'high',
  error: 'high',
  medium: 'medium',
  average: 'medium',
  moderate: 'medium',
  warning: 'low',
  warn: 'low',
  minor: 'low',
  low: 'info',
  info: 'info',
  information: 'info',
  none: 'ok',
  ok: 'ok',
}

export function mapAlertmanagerSeverity(severity?: string): AlertSeverity {
  if (!severity) return 'info'
  return ALERTMANAGER_SEVERITY[severity.toLowerCase()] ?? 'info'
}
