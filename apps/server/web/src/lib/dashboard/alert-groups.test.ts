import { describe, expect, it } from 'vitest'
import type { Alert } from '$lib/types'
import { type AlertChange, changeLines, groupAlerts, isNew, severityCounts } from './alert-groups'

const HOUR = 3_600_000
const now = 1_000 * HOUR

function alert(id: string, over: Partial<Alert>): Alert {
  return {
    id,
    severity: 'medium',
    title: 'problem',
    startTime: now,
    status: 'active',
    source: 'zabbix',
    ...over,
  }
}

describe('alert groups', () => {
  it('counts an alert raised again and again on one row, latest first', () => {
    const { current } = groupAlerts(
      [
        alert('1', { host: 'umv', title: 'SNMP Trap Fallback', startTime: now - 300 * HOUR }),
        alert('2', { host: 'umv', title: 'SNMP Trap Fallback', startTime: now - 0.1 * HOUR }),
        alert('3', { host: 'umv', title: 'SNMP Trap Fallback', startTime: now - 5 * HOUR }),
      ],
      { now, staleAfterMs: 24 * HOUR },
    )
    expect(current).toHaveLength(1)
    expect(current[0]?.alerts.map((a) => a.id)).toEqual(['2', '3', '1'])
    expect(current[0]?.firstAt).toBe(now - 300 * HOUR)
    expect(current[0]?.lastAt).toBe(now - 0.1 * HOUR)
  })

  it('puts the worst first, then the latest, and resolved after open', () => {
    const { current } = groupAlerts(
      [
        alert('new-medium', { host: 'a', startTime: now - HOUR }),
        alert('old-critical', { host: 'b', severity: 'critical', startTime: now - 10 * HOUR }),
        alert('resolved-critical', { host: 'c', severity: 'critical', status: 'resolved' }),
        alert('older-medium', { host: 'd', startTime: now - 2 * HOUR }),
      ],
      { now, staleAfterMs: 24 * HOUR },
    )
    expect(current.map((g) => g.latest.id)).toEqual([
      'old-critical',
      'new-medium',
      'older-medium',
      'resolved-critical',
    ])
  })

  it('sets apart what is open but not raised again within the stale age', () => {
    const alerts = [
      alert('demo', { host: 'x', severity: 'critical', startTime: now - 172 * HOUR }),
      alert('down', { host: 'y', startTime: now - 2 * HOUR }),
      alert('gone', { host: 'z', status: 'resolved', startTime: now - 100 * HOUR }),
    ]
    const { current, stale } = groupAlerts(alerts, { now, staleAfterMs: 24 * HOUR })
    expect(current.map((g) => g.latest.id)).toEqual(['down', 'gone'])
    expect(stale.map((g) => g.latest.id)).toEqual(['demo'])
    expect(groupAlerts(alerts, { now, staleAfterMs: 0 }).stale).toEqual([])
  })

  it('counts the open rows by severity, the worst first', () => {
    const { current } = groupAlerts(
      [
        alert('1', { host: 'a', title: 'trap' }),
        alert('2', { host: 'a', title: 'trap' }),
        alert('3', { host: 'b', severity: 'high' }),
        alert('4', { host: 'c', status: 'resolved' }),
      ],
      { now, staleAfterMs: 0 },
    )
    expect(severityCounts(current)).toEqual([
      ['high', 1],
      ['medium', 1],
    ])
  })
})

describe('new rows and the change log', () => {
  const opts = { now, staleAfterMs: 24 * HOUR }

  it('counts a row as new from when it first started, not from its repeats', () => {
    const { current } = groupAlerts(
      [
        alert('fresh', { host: 'a', startTime: now - 5 * 60_000 }),
        alert('trap-old', { host: 'b', title: 'trap', startTime: now - 300 * HOUR }),
        alert('trap-new', { host: 'b', title: 'trap', startTime: now - 60_000 }),
      ],
      opts,
    )
    const byHost = new Map(current.map((g) => [g.host, isNew(g, now)]))
    expect(byHost.get('a')).toBe(true)
    expect(byHost.get('b')).toBe(false)
  })

  it('puts a burst on one line and keeps the rest a line each, the latest first', () => {
    const groups = groupAlerts(
      [
        ...['h1', 'h2', 'h3', 'h4'].map((host, i) =>
          alert(host, { host, startTime: now - 20 * 60_000 + i * 10_000 }),
        ),
        alert('later', { host: 'x', startTime: now - 60_000 }),
      ],
      opts,
    ).current
    const changes: AlertChange[] = groups.map((group) => ({
      kind: 'new',
      at: group.firstAt,
      group,
    }))
    const lines = changeLines(changes, { now, windowMs: 30 * 60_000, burstGapMs: 60_000 })
    expect(lines.map((l) => [l.kind, l.groups.length])).toEqual([
      ['new', 1],
      ['new', 4],
    ])
  })

  it('leaves out what happened before the window', () => {
    const [group] = groupAlerts([alert('old', { startTime: now - 2 * HOUR })], opts).current
    if (!group) throw new Error('no group')
    expect(
      changeLines([{ kind: 'new', at: group.firstAt, group }], { now, windowMs: HOUR }),
    ).toEqual([])
  })
})
