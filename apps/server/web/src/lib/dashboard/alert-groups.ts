/**
 * The alerts a widget lists, read the way an operator reads them: one row per problem on a host
 * (an alert raised again and again, such as an SNMP trap, counted on one row), the worst first,
 * and the problems left open for long set apart as stale. A monitoring system often keeps alerts
 * open that nothing will ever close (a trap trigger with no recovery); they must not bury what is
 * happening now, nor keep the topology red.
 */

import { severityRank } from '@shumoku/core/plugin-kit'
import type { Alert, AlertSeverity } from '$lib/types'

export interface AlertGroup {
  key: string
  /** The alerts of the row, the latest first. */
  alerts: Alert[]
  /** The latest alert: what the row shows, hovers and opens. */
  latest: Alert
  host?: string
  title: string
  /** The worst severity among them. */
  severity: AlertSeverity
  status: Alert['status']
  /** When the earliest of them started, and when the latest arrived (ms). */
  firstAt: number
  lastAt: number
  /** Open, and raised last longer ago than the stale age. */
  stale: boolean
}

/** When an alert arrived: by webhook, else when it started. */
export function alertTime(alert: Alert): number {
  return alert.receivedAt ?? alert.startTime
}

/**
 * Group `alerts` by host, title and status, and order the rows: open before resolved, then the
 * worst severity, then the latest. `staleAfterMs` (0: never) sets apart the open rows not raised
 * again for that long; they come in `stale`, in the same order.
 */
export function groupAlerts(
  alerts: readonly Alert[],
  options: { now: number; staleAfterMs: number },
): { current: AlertGroup[]; stale: AlertGroup[] } {
  const byKey = new Map<string, Alert[]>()
  for (const alert of alerts) {
    const key = `${alert.status}\u0000${alert.host ?? ''}\u0000${alert.title}`
    const list = byKey.get(key)
    if (list) list.push(alert)
    else byKey.set(key, [alert])
  }

  const groups: AlertGroup[] = []
  for (const [key, list] of byKey) {
    const sorted = [...list].sort((a, b) => alertTime(b) - alertTime(a))
    const latest = sorted[0]
    if (!latest) continue
    let severity = latest.severity
    let firstAt = alertTime(latest)
    for (const alert of sorted) {
      if (severityRank(alert.severity) > severityRank(severity)) severity = alert.severity
      firstAt = Math.min(firstAt, alert.startTime)
    }
    const lastAt = alertTime(latest)
    groups.push({
      key,
      alerts: sorted,
      latest,
      host: latest.host,
      title: latest.title,
      severity,
      status: latest.status,
      firstAt,
      lastAt,
      stale:
        latest.status === 'active' &&
        options.staleAfterMs > 0 &&
        options.now - lastAt > options.staleAfterMs,
    })
  }

  groups.sort(
    (a, b) =>
      Number(b.status === 'active') - Number(a.status === 'active') ||
      severityRank(b.severity) - severityRank(a.severity) ||
      b.lastAt - a.lastAt,
  )
  return { current: groups.filter((g) => !g.stale), stale: groups.filter((g) => g.stale) }
}

/** How many open rows of each severity, the worst first; severities with none are left out. */
export function severityCounts(groups: readonly AlertGroup[]): [AlertSeverity, number][] {
  const counts = new Map<AlertSeverity, number>()
  for (const group of groups) {
    if (group.status !== 'active') continue
    counts.set(group.severity, (counts.get(group.severity) ?? 0) + 1)
  }
  return [...counts].sort(([a], [b]) => severityRank(b) - severityRank(a))
}

/**
 * How long an open row counts as new, from when it first started: it beats on the topologies, and
 * a topology set to follow alerts flies to it. Counted from the alert's own start, not from when
 * this page saw it, so a page opened again (a wall display reloading) still shows what is new.
 */
export const NEW_MS = 10 * 60_000

/** Whether a row is new: open, not stale, and first started within `NEW_MS`. */
export function isNew(group: AlertGroup, now: number): boolean {
  return group.status === 'active' && !group.stale && now - group.firstAt <= NEW_MS
}

/** Something that happened to a row: it started, or it was resolved. */
export interface AlertChange {
  kind: 'new' | 'resolved'
  at: number
  group: AlertGroup
}

/** A line of the change log: one change, or a burst of the same kind close together. */
export interface ChangeLine {
  kind: AlertChange['kind']
  /** The latest of them. */
  at: number
  groups: AlertGroup[]
}

/**
 * The change log: the changes within `windowMs`, the latest first. Changes of one kind that come
 * within `burstGapMs` of each other are a burst; a burst of at least `burstMin` is one line (a
 * switch going down takes forty hosts with it: one line says so, forty would bury everything
 * else), a smaller one stays a line each.
 */
export function changeLines(
  changes: readonly AlertChange[],
  options: { now: number; windowMs: number; burstGapMs?: number; burstMin?: number },
): ChangeLine[] {
  const gap = options.burstGapMs ?? 120_000
  const burstMin = options.burstMin ?? 3
  const recent = changes
    .filter((c) => options.now - c.at <= options.windowMs)
    .sort((a, b) => b.at - a.at)
  const runs: { kind: AlertChange['kind']; changes: AlertChange[] }[] = []
  for (const change of recent) {
    const run = runs.at(-1)
    const oldest = run?.changes.at(-1)
    if (run && oldest && run.kind === change.kind && oldest.at - change.at <= gap) {
      run.changes.push(change)
    } else {
      runs.push({ kind: change.kind, changes: [change] })
    }
  }
  return runs.flatMap((run) =>
    run.changes.length >= burstMin
      ? [{ kind: run.kind, at: run.changes[0]?.at ?? 0, groups: run.changes.map((c) => c.group) }]
      : run.changes.map((c) => ({ kind: c.kind, at: c.at, groups: [c.group] })),
  )
}
