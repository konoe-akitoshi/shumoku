import { describe, expect, it } from 'vitest'
import { DashboardState } from './dashboard.svelte'
import { hostNodesOf, readerFor } from './reader'

function dashboard() {
  return new DashboardState(readerFor({ kind: 'workspace' }))
}

describe('dashboard state', () => {
  it('keeps the most severe mark on a host, across widgets', () => {
    const d = dashboard()
    d.setMarks('alerts-a', [
      { host: 'sw1', color: 'yellow', rank: 2 },
      { host: 'sw1', color: 'red', rank: 5 },
      { host: 'r1', color: 'orange', rank: 4 },
    ])
    d.setMarks('alerts-b', [{ host: 'r1', color: 'red', rank: 5 }])
    expect(d.hostMarks.get('sw1')).toEqual({ color: 'red', rank: 5 })
    expect(d.hostMarks.get('r1')).toEqual({ color: 'red', rank: 5 })
  })

  it('drops a mark when the alert behind it goes, and all of a widget’s when it goes', () => {
    const d = dashboard()
    d.setMarks('alerts', [
      { host: 'sw1', color: 'red', rank: 5 },
      { host: 'r1', color: 'red', rank: 5 },
    ])
    d.setMarks('alerts', [{ host: 'r1', color: 'red', rank: 5 }])
    expect([...d.hostMarks.keys()]).toEqual(['r1'])
    d.clearMarks('alerts')
    expect(d.hostMarks.size).toBe(0)
  })

  it('clears a focus only for the widget that set it', () => {
    const d = dashboard()
    d.setFocus({ source: 'a', hosts: ['sw1'] })
    d.setFocus({ source: 'b', hosts: ['r1'] })
    d.clearFocus('a')
    expect(d.focus?.source).toBe('b')
    d.clearFocus('b')
    expect(d.focus).toBeNull()
  })

  it('lists the topology views registered, by topology', () => {
    const d = dashboard()
    const handle = (topologyId: string) => ({ topologyId, showHost: () => true, restore() {} })
    const t1 = handle('t1')
    const unregister = d.registerTopology(t1)
    d.registerTopology(handle('t2'))
    expect(d.topologies('t1')).toEqual([t1])
    expect(d.topologies()).toHaveLength(2)
    unregister()
    expect(d.topologies('t1')).toEqual([])
  })
})

describe('host nodes', () => {
  it('maps each host to every node bound to it', () => {
    const map = hostNodesOf({
      n1: { hostName: 'sw1' },
      n2: { hostName: 'sw1' },
      n3: {},
      n4: undefined,
    })
    expect([...map]).toEqual([['sw1', ['n1', 'n2']]])
  })
})
