/**
 * How often the Server reads data sources: the choices the Settings page and a data source's
 * override offer. The Server decides the effective value and its floors
 * (`apps/server/api/src/services/polling.ts`); these are only the menus.
 */

/** The Settings keys of the server-wide defaults. */
export const POLLING_KEYS = {
  alertsMs: 'polling.alertsMs',
  metricsMs: 'polling.metricsMs',
  syncMs: 'polling.syncMs',
} as const

/** The built-in defaults (as the Server's `POLLING_DEFAULTS`), shown as "Default". */
export const POLLING_BUILT_IN = { alertsMs: 30_000, metricsMs: 30_000, syncMs: 30 * 60_000 }

export interface PollingChoice {
  value: number
  label: string
}

export const ALERTS_CHOICES: PollingChoice[] = [
  { value: 10_000, label: '10 seconds' },
  { value: 30_000, label: '30 seconds' },
  { value: 60_000, label: '1 minute' },
  { value: 120_000, label: '2 minutes' },
  { value: 300_000, label: '5 minutes' },
]

export const METRICS_CHOICES: PollingChoice[] = [
  { value: 5_000, label: '5 seconds' },
  { value: 10_000, label: '10 seconds' },
  { value: 15_000, label: '15 seconds' },
  { value: 30_000, label: '30 seconds' },
  { value: 60_000, label: '1 minute' },
  { value: 120_000, label: '2 minutes' },
  { value: 300_000, label: '5 minutes' },
]

export const SYNC_CHOICES: PollingChoice[] = [
  { value: 5 * 60_000, label: '5 minutes' },
  { value: 15 * 60_000, label: '15 minutes' },
  { value: 30 * 60_000, label: '30 minutes' },
  { value: 60 * 60_000, label: '1 hour' },
  { value: 6 * 60 * 60_000, label: '6 hours' },
  { value: 24 * 60 * 60_000, label: '24 hours' },
]

/** A label for an interval: its menu entry, else a plain count of seconds. */
export function intervalLabel(ms: number, choices: readonly PollingChoice[]): string {
  return choices.find((c) => c.value === ms)?.label ?? `${Math.round(ms / 1000)} seconds`
}
