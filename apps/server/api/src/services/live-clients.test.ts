import { describe, expect, it, vi } from 'vitest'
import type { LiveMessage, MetricsData } from '../types.js'
import { LiveClients, type LiveTopologies } from './live-clients.js'

const metrics = (status: 'up' | 'down'): MetricsData => ({
  nodes: { n1: { status } },
  links: {},
  timestamp: 1,
})

function setup() {
  const state = {
    revision: { a: 1, b: 7 } as Record<string, number>,
    mapping: { a: 0, b: 0 } as Record<string, number>,
    metrics: { a: metrics('up') } as Record<string, MetricsData | undefined>,
  }
  const topologies: LiveTopologies = {
    exists: (t) => t in state.revision,
    revisionOf: (t) => state.revision[t] ?? 0,
    mappingVersionOf: (t) => state.mapping[t] ?? 0,
    metricsOf: (t) => state.metrics[t],
  }
  const sent = new Map<string, LiveMessage[]>()
  const watchChanged = vi.fn()
  const live = new LiveClients<string>(
    topologies,
    (client, message) => sent.set(client, [...(sent.get(client) ?? []), message]),
    watchChanged,
  )
  const take = (client: string) => {
    const messages = sent.get(client) ?? []
    sent.set(client, [])
    return messages
  }
  return { state, live, take, watchChanged }
}

describe('LiveClients', () => {
  it('lets one client watch several topologies, each message naming its topology', () => {
    const { live, take } = setup()
    live.add('c')
    live.receive('c', { type: 'subscribe', topology: 'a' })
    live.receive('c', { type: 'subscribe', topology: 'b' })
    expect(take('c')).toEqual([
      { type: 'revision', topology: 'a', revision: 1 },
      { type: 'mappingVersion', topology: 'a', version: 0 },
      { type: 'metrics', topology: 'a', data: metrics('up') },
      { type: 'revision', topology: 'b', revision: 7 },
      { type: 'mappingVersion', topology: 'b', version: 0 },
    ])
    live.broadcastMetrics()
    expect(take('c')).toEqual([{ type: 'metrics', topology: 'a', data: metrics('up') }])
  })

  it('sends each watcher only what it watches', () => {
    const { live, take, state } = setup()
    live.add('x')
    live.add('y')
    live.receive('x', { type: 'subscribe', topology: 'a' })
    live.receive('y', { type: 'subscribe', topology: 'b' })
    take('x')
    take('y')
    state.metrics.b = metrics('down')
    live.broadcastMetrics()
    expect(take('x').map((m) => m.topology)).toEqual(['a'])
    expect(take('y')).toEqual([{ type: 'metrics', topology: 'b', data: metrics('down') }])
  })

  it('tells a watcher when the revision or the mapping version moved, and only then', () => {
    const { live, take, state } = setup()
    live.add('c')
    live.receive('c', { type: 'subscribe', topology: 'a' })
    take('c')
    live.pushVersions()
    expect(take('c')).toEqual([])
    state.revision.a = 2
    state.mapping.a = 5
    live.pushVersions()
    expect(take('c')).toEqual([
      { type: 'revision', topology: 'a', revision: 2 },
      { type: 'mappingVersion', topology: 'a', version: 5 },
    ])
    live.pushVersions()
    expect(take('c')).toEqual([])
  })

  it('stops sending what a client unsubscribed from, and knows what is still watched', () => {
    const { live, take, watchChanged } = setup()
    live.add('c')
    live.receive('c', { type: 'subscribe', topology: 'a' })
    expect(live.isWatched('a')).toBe(true)
    live.receive('c', { type: 'unsubscribe', topology: 'a' })
    take('c')
    live.broadcastMetrics()
    expect(take('c')).toEqual([])
    expect(live.isWatched('a')).toBe(false)
    expect(watchChanged.mock.calls.map(([t]) => t)).toEqual(['a', 'a'])
  })

  it('forgets a client that left, and the topologies it watched', () => {
    const { live, watchChanged } = setup()
    live.add('c')
    live.receive('c', { type: 'subscribe', topology: 'a' })
    live.receive('c', { type: 'subscribe', topology: 'b' })
    watchChanged.mockClear()
    live.remove('c')
    expect(live.size).toBe(0)
    expect(live.isWatched('a')).toBe(false)
    expect(watchChanged.mock.calls.map(([t]) => t)).toEqual(['a', 'b'])
  })

  it('answers a topology that does not exist with an error, and does not watch it', () => {
    const { live, take } = setup()
    live.add('c')
    live.receive('c', { type: 'subscribe', topology: 'missing' })
    expect(take('c')).toEqual([{ type: 'error', topology: 'missing', error: 'Topology not found' }])
    expect(live.isWatched('missing')).toBe(false)
  })
})
