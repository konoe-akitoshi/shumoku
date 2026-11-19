import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ZabbixPlugin } from './plugin.js'

/**
 * getAlerts must return every problem still open, however long ago it started (a dashboard keeps
 * it highlighted until it resolves), and only the resolved ones are limited to `timeRange`.
 */

const HOURS = 3600
const now = Math.floor(Date.now() / 1000)

interface FakeEvent {
  eventid: string
  objectid: string
  name: string
  severity: string
  clock: string
  value: string
  r_eventid: string
  hosts: { hostid: string; host: string; name: string }[]
}

function event(id: string, startedHoursAgo: number, resolved: boolean): FakeEvent {
  return {
    eventid: id,
    objectid: `t${id}`,
    name: `problem ${id}`,
    severity: '3',
    clock: String(now - startedHoursAgo * HOURS),
    value: '1',
    r_eventid: resolved ? `r${id}` : '0',
    hosts: [{ hostid: `h${id}`, host: `host-${id}`, name: `Host ${id}` }],
  }
}

const EVENTS = [
  event('1', 3, false), // open for three hours
  event('2', 0.5, false), // open, recent
  event('3', 0.2, true), // resolved, recent
  event('4', 5, true), // resolved long ago
]

describe('ZabbixPlugin.getAlerts', () => {
  let plugin: ZabbixPlugin

  beforeEach(() => {
    const apiRequest = vi.fn(async (method: string, params: Record<string, unknown> = {}) => {
      if (method === 'problem.get') {
        return EVENTS.filter((e) => e.r_eventid === '0').map((e) => ({ eventid: e.eventid }))
      }
      if (method === 'event.get') {
        if (Array.isArray(params['eventids'])) {
          const ids = params['eventids'] as string[]
          return EVENTS.filter((e) => ids.includes(e.eventid))
        }
        const from = Number(params['time_from'] ?? 0)
        return EVENTS.filter((e) => Number(e.clock) >= from)
      }
      return []
    })
    plugin = new ZabbixPlugin()
    plugin.initialize({ url: 'http://zabbix.test', token: 'tok' })
    ;(plugin as unknown as { apiRequest: typeof apiRequest }).apiRequest = apiRequest
  })

  it('returns every open problem, also one older than the time range', async () => {
    const alerts = await plugin.getAlerts({ activeOnly: true })
    expect(alerts.map((a) => [a.id, a.status, a.host])).toEqual([
      ['2', 'active', 'host-2'],
      ['1', 'active', 'host-1'],
    ])
  })

  it('adds the problems resolved within the time range, newest first', async () => {
    const alerts = await plugin.getAlerts({ activeOnly: false })
    expect(alerts.map((a) => [a.id, a.status])).toEqual([
      ['3', 'resolved'],
      ['2', 'active'],
      ['1', 'active'],
    ])
  })
})
