/**
 * How often the Server reads each data source (apps/server/docs/design/alert-collection.md §6).
 *
 * Two levels, both stored on the Server and read by it: server-wide defaults on the Settings
 * page (`settings`: `polling.alertsMs`, `polling.metricsMs`, `polling.syncMs`), and a data
 * source's own override (`data_sources.polling_json`) for the exceptions (a cloud API with a
 * tight rate limit). The Settings page's old "Update Interval" lived only in the browser and the
 * Server ignored it; nothing here is like that.
 *
 * An effective interval, the first that applies:
 *
 *   1. the data source's override;
 *   2. the Settings default;
 *   3. `POLL_INTERVAL` when it is set explicitly (metrics only; the older way to tune it);
 *   4. the built-in default.
 *
 * and never below the floor. `alertsMs: 0` (override or default) stops collecting alerts.
 */

import type { PollingOverride } from '../types.js'

export const POLLING_SETTING_KEYS = {
  alertsMs: 'polling.alertsMs',
  metricsMs: 'polling.metricsMs',
  syncMs: 'polling.syncMs',
} as const

/** Built-in defaults (ms). Zabbix items mostly update every 60 s: 30 s is fresh enough. */
export const POLLING_DEFAULTS = { alertsMs: 30_000, metricsMs: 30_000, syncMs: 30 * 60_000 }

/** The shortest interval allowed (ms), whatever is set. */
export const POLLING_FLOORS = { alertsMs: 10_000, metricsMs: 5_000, syncMs: 5 * 60_000 }

export interface PollingDeps {
  /** A Settings value (`SettingsService.get`). */
  setting(key: string): string | null
  /** A data source's override, if it has one. */
  override(sourceId: string): PollingOverride | undefined
  /** `POLL_INTERVAL`, when it was set explicitly. */
  envMetricsMs?: number
}

function positive(value: unknown): number | undefined {
  // An empty string is "not set", not 0 (Number('') is 0, which would turn alerts off).
  if (typeof value === 'string' && value.trim() === '') return undefined
  const n = typeof value === 'string' ? Number(value) : value
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 ? n : undefined
}

export class PollingPolicy {
  private readonly deps: PollingDeps

  constructor(deps: PollingDeps) {
    this.deps = deps
  }

  /** The server-wide defaults as the Settings page shows them (built-in where unset). */
  defaults(): { alertsMs: number; metricsMs: number; syncMs: number } {
    return {
      alertsMs: this.setting('alertsMs') ?? POLLING_DEFAULTS.alertsMs,
      metricsMs: this.setting('metricsMs') ?? this.deps.envMetricsMs ?? POLLING_DEFAULTS.metricsMs,
      syncMs: this.setting('syncMs') ?? POLLING_DEFAULTS.syncMs,
    }
  }

  /** How often to collect a source's alerts (ms); 0: not collected. */
  alertsMs(sourceId: string): number {
    const value = positive(this.deps.override(sourceId)?.alertsMs) ?? this.defaults().alertsMs
    return value === 0 ? 0 : Math.max(value, POLLING_FLOORS.alertsMs)
  }

  /** How often to read a source's metrics (ms). */
  metricsMs(sourceId: string): number {
    // Metrics cannot be turned off: an override of 0 means "not set", so the default applies.
    const own = positive(this.deps.override(sourceId)?.metricsMs) || undefined
    const value = own ?? this.defaults().metricsMs
    return Math.max(value || POLLING_DEFAULTS.metricsMs, POLLING_FLOORS.metricsMs)
  }

  /** How often to sync a topology's structure when its own policy says nothing (ms). */
  syncMs(): number {
    return Math.max(this.defaults().syncMs || POLLING_DEFAULTS.syncMs, POLLING_FLOORS.syncMs)
  }

  private setting(key: keyof typeof POLLING_SETTING_KEYS): number | undefined {
    return positive(this.deps.setting(POLLING_SETTING_KEYS[key]))
  }
}
