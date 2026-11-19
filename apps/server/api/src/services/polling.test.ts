import { describe, expect, it } from 'vitest'
import type { PollingOverride } from '../types.js'
import { POLLING_DEFAULTS, POLLING_FLOORS, PollingPolicy } from './polling.js'

function policy(
  settings: Record<string, string> = {},
  overrides: Record<string, PollingOverride> = {},
  envMetricsMs?: number,
) {
  return new PollingPolicy({
    setting: (key) => settings[key] ?? null,
    override: (id) => overrides[id],
    envMetricsMs,
  })
}

describe('polling intervals', () => {
  it('uses the built-in defaults when nothing is set', () => {
    const p = policy()
    expect(p.alertsMs('s')).toBe(POLLING_DEFAULTS.alertsMs)
    expect(p.metricsMs('s')).toBe(POLLING_DEFAULTS.metricsMs)
    expect(p.syncMs()).toBe(POLLING_DEFAULTS.syncMs)
  })

  it('takes the Settings default, and a source override over it', () => {
    const p = policy(
      { 'polling.alertsMs': '60000', 'polling.metricsMs': '10000' },
      { cloud: { metricsMs: 120_000 } },
    )
    expect(p.alertsMs('zabbix')).toBe(60_000)
    expect(p.metricsMs('zabbix')).toBe(10_000)
    expect(p.metricsMs('cloud')).toBe(120_000)
  })

  it('keeps an explicit POLL_INTERVAL below the Settings default, above the built-in one', () => {
    expect(policy({}, {}, 5_000).metricsMs('s')).toBe(5_000)
    expect(policy({ 'polling.metricsMs': '15000' }, {}, 5_000).metricsMs('s')).toBe(15_000)
  })

  it('never goes below the floor, and alertsMs 0 stops collecting', () => {
    const p = policy(
      { 'polling.alertsMs': '1000', 'polling.metricsMs': '1' },
      { off: { alertsMs: 0 } },
    )
    expect(p.alertsMs('s')).toBe(POLLING_FLOORS.alertsMs)
    expect(p.metricsMs('s')).toBe(POLLING_FLOORS.metricsMs)
    expect(p.alertsMs('off')).toBe(0)
  })

  it('ignores values that are not numbers', () => {
    expect(policy({ 'polling.alertsMs': 'soon' }).alertsMs('s')).toBe(POLLING_DEFAULTS.alertsMs)
  })
  it('reads an empty setting as unset and a metrics override of 0 as no override', () => {
    const p = policy(
      { 'polling.alertsMs': '', 'polling.metricsMs': '60000' },
      { s: { metricsMs: 0 } },
    )
    expect(p.alertsMs('s')).toBe(POLLING_DEFAULTS.alertsMs)
    expect(p.metricsMs('s')).toBe(60_000)
  })
})
