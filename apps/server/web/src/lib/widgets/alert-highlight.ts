import type { Alert, AlertSeverity } from '$lib/types'

/** Severity rank: 0 = most severe. */
export const SEVERITY_RANK: Record<AlertSeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4,
  ok: 5,
}

/**
 * The active alert with a host that a pinned highlight should show: the most severe one, and of
 * those the first in the given order (the widget sorts newest first). A newer but milder alert
 * must not take the highlight from a more severe one that is still active.
 */
export function mostSevereActive(alerts: readonly Alert[]): Alert | undefined {
  let best: Alert | undefined
  for (const alert of alerts) {
    if (alert.status !== 'active' || !alert.host) continue
    if (!best || SEVERITY_RANK[alert.severity] < SEVERITY_RANK[best.severity]) best = alert
  }
  return best
}

/** A flash highlight that is on screen: how severe it is and when it ends (epoch ms). */
export interface FlashState {
  rank: number
  until: number
}

/**
 * Whether new alerts of `rank` may replace the flash highlight on screen. A milder alert waits
 * until a more severe flash has ended; an equal or more severe one replaces it.
 */
export function mayReplaceFlash(current: FlashState | null, rank: number, now: number): boolean {
  if (!current || now >= current.until) return true
  return rank <= current.rank
}
