/**
 * Live metrics, by topology. Every view of a topology (its page, a dashboard widget, a shared
 * page, the node panel) watches it with `watchTopologyLive`: views of one topology share one
 * feed, and views of different topologies never see each other's values. Signed in, one `/ws`
 * socket carries every watched topology; a shared view has no session and reads one token-scoped
 * SSE stream per topology. Either way a feed also says when its topology was drawn again (its
 * revision) or its mapping changed (bandwidths, bindings), and the view loads the drawing again.
 */

import { untrack } from 'svelte'
import type { MetricsData } from './metrics'

/** Where a topology's live feed comes from. */
export type LiveSource = { kind: 'ws'; topologyId: string } | { kind: 'sse'; url: string }

/** A topology's feed when signed in: the `/ws` socket. A shared view names its SSE stream. */
export function liveSourceOf(topologyId: string): LiveSource {
  return { kind: 'ws', topologyId }
}

/** What the Server sends on `/ws`, each about one watched topology. */
type LiveMessage =
  | { type: 'metrics'; topology: string; data: MetricsData }
  | { type: 'revision'; topology: string; revision: number }
  | { type: 'mappingVersion'; topology: string; version: number }
  | { type: 'error'; topology: string; error: string }

type Version = 'revision' | 'mappingVersion'

class Feed {
  metrics = $state<MetricsData | null>(null)
  connected = $state(false)
  /** Told when the topology was drawn again or its mapping changed, not of the first values. */
  readonly onChanged = new Set<() => void>()
  holders = 0
  stream: EventSource | null = null
  private readonly last: Partial<Record<Version, number>> = {}

  constructor(readonly source: LiveSource) {}

  version(kind: Version, value: number): void {
    const last = this.last[kind]
    this.last[kind] = value
    if (last !== undefined && last !== value) for (const changed of this.onChanged) changed()
  }
}

const feeds = new Map<string, Feed>()

function keyOf(source: LiveSource): string {
  return source.kind === 'ws' ? `ws:${source.topologyId}` : `sse:${source.url}`
}

// --- `/ws`: one socket for every topology watched while signed in ---

/** Whether the signed-in live socket is open. */
export const liveConnection = $state({ connected: false })

let socket: WebSocket | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
let reconnectAttempts = 0

function socketFeeds(): Feed[] {
  return [...feeds.values()].filter((feed) => feed.source.kind === 'ws')
}

function topologyOf(feed: Feed): string {
  return feed.source.kind === 'ws' ? feed.source.topologyId : ''
}

function sendOnSocket(message: { type: 'subscribe' | 'unsubscribe'; topology: string }): void {
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message))
}

function openSocket(): void {
  if (socket || reconnectTimer) return
  const next = new WebSocket('/ws')
  socket = next
  next.onopen = () => {
    reconnectAttempts = 0
    liveConnection.connected = true
    for (const feed of socketFeeds()) {
      feed.connected = true
      sendOnSocket({ type: 'subscribe', topology: topologyOf(feed) })
    }
  }
  next.onmessage = (event) => {
    let message: LiveMessage
    try {
      message = JSON.parse(event.data) as LiveMessage
    } catch {
      return
    }
    const feed = feeds.get(`ws:${message.topology}`)
    if (!feed) return
    if (message.type === 'metrics') feed.metrics = message.data
    else if (message.type === 'revision') feed.version('revision', message.revision)
    else if (message.type === 'mappingVersion') feed.version('mappingVersion', message.version)
    else console.warn(`[Live] ${message.topology}: ${message.error}`)
  }
  // An error is followed by a close; the close reconnects.
  next.onclose = () => {
    socket = null
    liveConnection.connected = false
    for (const feed of socketFeeds()) feed.connected = false
    if (socketFeeds().length > 0) scheduleReconnect()
  }
}

function scheduleReconnect(): void {
  const delay = Math.min(1000 * 2 ** Math.min(reconnectAttempts, 5), 30_000)
  reconnectAttempts++
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null
    openSocket()
  }, delay)
}

/** Close the socket once nothing watches over it. */
function closeIdleSocket(): void {
  if (socketFeeds().length > 0) return
  if (reconnectTimer) clearTimeout(reconnectTimer)
  reconnectTimer = null
  reconnectAttempts = 0
  const closing = socket
  socket = null
  liveConnection.connected = false
  if (closing) {
    closing.onclose = null
    closing.close()
  }
}

// --- SSE: one token-scoped stream per topology in a shared view ---

function openStream(feed: Feed, url: string): void {
  const stream = new EventSource(url)
  feed.stream = stream
  stream.onopen = () => {
    feed.connected = true
  }
  stream.onerror = () => {
    feed.connected = false
  }
  for (const kind of ['revision', 'mappingVersion'] as const) {
    stream.addEventListener(kind, (event) => {
      const value = Number((event as MessageEvent).data)
      if (Number.isFinite(value)) feed.version(kind, value)
    })
  }
  stream.onmessage = (event) => {
    if (!event.data) return // a keep-alive ping
    try {
      feed.metrics = JSON.parse(event.data) as MetricsData
    } catch {
      // a malformed frame; the next one replaces it
    }
  }
}

// --- Holding a feed ---

/**
 * Hold a topology's feed until `release` is called: the first holder opens it, the last one
 * closes it. `onChanged` hears when the topology was drawn again or its mapping changed.
 */
export function holdTopologyLive(
  source: LiveSource,
  onChanged?: () => void,
): { feed: Feed; release: () => void } {
  const key = keyOf(source)
  let feed = feeds.get(key)
  if (!feed) {
    const created = new Feed(source)
    feeds.set(key, created)
    if (source.kind === 'sse') openStream(created, source.url)
    else if (socket?.readyState === WebSocket.OPEN) {
      created.connected = true
      sendOnSocket({ type: 'subscribe', topology: source.topologyId })
    } else openSocket()
    feed = created
  }
  const held = feed
  held.holders++
  if (onChanged) held.onChanged.add(onChanged)
  let released = false
  return {
    feed: held,
    release: () => {
      if (released) return
      released = true
      if (onChanged) held.onChanged.delete(onChanged)
      if (--held.holders > 0) return
      feeds.delete(key)
      held.stream?.close()
      if (held.source.kind === 'ws') {
        sendOnSocket({ type: 'unsubscribe', topology: held.source.topologyId })
        closeIdleSocket()
      }
    },
  }
}

/**
 * Watch a topology's live feed while the calling component lives, whenever `source()` names
 * one (it is read reactively: a different source moves the watch, `null` stops it). Call it
 * while the component is initialised.
 */
export function watchTopologyLive(source: () => LiveSource | null, onChanged?: () => void) {
  let feed = $state<Feed | null>(null)
  $effect(() => {
    const current = source()
    if (!current) return
    const held = untrack(() => holdTopologyLive(current, onChanged))
    feed = held.feed
    return () => {
      held.release()
      feed = null
    }
  })
  return {
    get metrics(): MetricsData | null {
      return feed?.metrics ?? null
    },
    get warnings(): string[] {
      return feed?.metrics?.warnings ?? []
    },
    get connected(): boolean {
      return feed?.connected ?? false
    },
  }
}
