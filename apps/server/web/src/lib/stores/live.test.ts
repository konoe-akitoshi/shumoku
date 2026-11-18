import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { sharedDashboardStreamUrl } from '$lib/api'
import { holdTopologyLive, liveConnection } from './live.svelte'

class SocketMock {
  static readonly CONNECTING = 0
  static readonly OPEN = 1
  static readonly CLOSED = 3
  static instances: SocketMock[] = []

  readyState = SocketMock.CONNECTING
  sent: unknown[] = []
  onopen: (() => void) | null = null
  onmessage: ((event: { data: string }) => void) | null = null
  onclose: (() => void) | null = null

  constructor(readonly url: string) {
    SocketMock.instances.push(this)
  }

  send(data: string): void {
    this.sent.push(JSON.parse(data))
  }

  close(): void {
    this.readyState = SocketMock.CLOSED
  }

  open(): void {
    this.readyState = SocketMock.OPEN
    this.onopen?.()
  }

  receive(message: unknown): void {
    this.onmessage?.({ data: JSON.stringify(message) })
  }

  drop(): void {
    this.readyState = SocketMock.CLOSED
    this.onclose?.()
  }
}

class StreamMock {
  static instances: StreamMock[] = []
  closed = false
  onopen: (() => void) | null = null
  onerror: (() => void) | null = null
  onmessage: ((event: { data: string }) => void) | null = null
  readonly listeners = new Map<string, (event: { data: string }) => void>()

  constructor(readonly url: string) {
    StreamMock.instances.push(this)
  }

  addEventListener(kind: string, listener: (event: { data: string }) => void): void {
    this.listeners.set(kind, listener)
  }

  close(): void {
    this.closed = true
  }
}

const metrics = (status: string) => ({ nodes: { a: { status } }, links: {}, timestamp: 1 })
const socket = () => SocketMock.instances.at(-1) as SocketMock

describe('live feeds', () => {
  const releases: (() => void)[] = []
  const hold = (...args: Parameters<typeof holdTopologyLive>) => {
    const held = holdTopologyLive(...args)
    releases.push(held.release)
    return held
  }

  beforeEach(() => {
    vi.stubGlobal('WebSocket', SocketMock)
    vi.stubGlobal('EventSource', StreamMock)
  })

  afterEach(() => {
    for (const release of releases.splice(0)) release()
    SocketMock.instances = []
    StreamMock.instances = []
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('carries every watched topology on one socket, each with its own values', () => {
    const a = hold({ kind: 'ws', topologyId: 'a' })
    const b = hold({ kind: 'ws', topologyId: 'b' })
    expect(SocketMock.instances).toHaveLength(1)
    expect(socket().url).toBe('/ws')

    socket().open()
    expect(socket().sent).toEqual([
      { type: 'subscribe', topology: 'a' },
      { type: 'subscribe', topology: 'b' },
    ])
    expect(liveConnection.connected).toBe(true)

    socket().receive({ type: 'metrics', topology: 'b', data: metrics('down') })
    expect(a.feed.metrics).toBeNull()
    expect(b.feed.metrics?.nodes['a']?.status).toBe('down')
  })

  it('shares one feed between the views of one topology', () => {
    const first = hold({ kind: 'ws', topologyId: 'a' })
    const second = hold({ kind: 'ws', topologyId: 'a' })
    socket().open()
    expect(second.feed).toBe(first.feed)
    expect(socket().sent).toEqual([{ type: 'subscribe', topology: 'a' }])

    first.release()
    expect(socket().sent).toHaveLength(1) // the second view still watches
    second.release()
    expect(socket().sent.at(-1)).toEqual({ type: 'unsubscribe', topology: 'a' })
    expect(socket().readyState).toBe(SocketMock.CLOSED) // nothing watches any more
  })

  it('tells a view when its topology was drawn again or its mapping changed, not of the first values', () => {
    const changed = vi.fn()
    hold({ kind: 'ws', topologyId: 'a' }, changed)
    socket().open()
    socket().receive({ type: 'revision', topology: 'a', revision: 3 })
    socket().receive({ type: 'mappingVersion', topology: 'a', version: 1 })
    expect(changed).not.toHaveBeenCalled()

    socket().receive({ type: 'revision', topology: 'a', revision: 3 })
    expect(changed).not.toHaveBeenCalled()
    socket().receive({ type: 'revision', topology: 'a', revision: 4 })
    socket().receive({ type: 'mappingVersion', topology: 'a', version: 2 })
    expect(changed).toHaveBeenCalledTimes(2)
  })

  it('keeps reconnecting while something watches, and subscribes again', async () => {
    vi.useFakeTimers()
    hold({ kind: 'ws', topologyId: 'a' })
    for (const connections of [2, 3, 4, 5, 6, 7]) {
      socket().drop()
      await vi.runOnlyPendingTimersAsync()
      expect(SocketMock.instances).toHaveLength(connections)
    }
    socket().open()
    expect(socket().sent).toEqual([{ type: 'subscribe', topology: 'a' }])
  })

  it('reads a shared dashboard topology from its token-scoped stream, never the socket', () => {
    const changed = vi.fn()
    const held = hold({ kind: 'sse', url: sharedDashboardStreamUrl('tok', 'a') }, changed)
    expect(SocketMock.instances).toHaveLength(0)
    const stream = StreamMock.instances[0] as StreamMock
    expect(stream.url).toBe('/api/share/dashboards/tok/topologies/a/metrics/stream')

    stream.onmessage?.({ data: JSON.stringify(metrics('up')) })
    expect(held.feed.metrics?.nodes['a']?.status).toBe('up')
    stream.listeners.get('revision')?.({ data: '1' })
    stream.listeners.get('revision')?.({ data: '2' })
    expect(changed).toHaveBeenCalledTimes(1)

    held.release()
    expect(stream.closed).toBe(true)
  })
})
