/**
 * Metrics Store
 * WebSocket connection and real-time metrics updates
 */

import { derived, get, writable } from 'svelte/store'

// Types
export type NodeStatus = 'up' | 'down' | 'unknown' | 'warning'
export type EdgeStatus = 'up' | 'down' | 'unknown' | 'degraded'

/** State of the monitoring path itself — see core plugin-types for details. */
export type MonitoringHealth = 'healthy' | 'failing' | 'pending' | 'paused'

export interface NodeMetrics {
  status: NodeStatus
  /** Last time the host was confirmed reachable (epoch ms). */
  lastSeen?: number
  /** Whether monitoring is succeeding (orthogonal to device status). */
  monitoring?: MonitoringHealth
  /** Short reason when monitoring !== 'healthy' (e.g. SNMP timeout text). */
  monitoringError?: string
}

export interface EdgeMetrics {
  status: EdgeStatus
  utilization?: number // Legacy: max of in/out
  inUtilization?: number // Incoming direction (0-100)
  outUtilization?: number // Outgoing direction (0-100)
  inBps?: number // Incoming traffic in bits per second
  outBps?: number // Outgoing traffic in bits per second
}

export interface MetricsData {
  nodes: Record<string, NodeMetrics>
  links: Record<string, EdgeMetrics>
  timestamp: number
  warnings?: string[]
}

interface MetricsMessage {
  type: 'metrics'
  data: MetricsData
}

interface ClientMessage {
  type: 'subscribe' | 'setInterval' | 'filter'
  topology?: string
  interval?: number
  nodes?: string[]
  links?: string[]
}

// Store state
interface MetricsState {
  connected: boolean
  subscribedTopology: string | null
  metrics: MetricsData | null
  error: string | null
}

const initialState: MetricsState = {
  connected: false,
  subscribedTopology: null,
  metrics: null,
  error: null,
}

// Use globalThis to persist WebSocket across HMR reloads
const METRICS_WS_KEY = '__shumoku_metrics_ws__'
interface MetricsGlobal {
  ws: WebSocket | null
  reconnectTimeout: ReturnType<typeof setTimeout> | null
  reconnectAttempts: number
  intentionalDisconnect: boolean
  /** SSE source for shared (token-scoped) live metrics — anonymous viewers. */
  sse: EventSource | null
}

function getGlobal(): MetricsGlobal {
  if (!(globalThis as Record<string, unknown>)[METRICS_WS_KEY]) {
    ;(globalThis as Record<string, unknown>)[METRICS_WS_KEY] = {
      ws: null,
      reconnectTimeout: null,
      reconnectAttempts: 0,
      intentionalDisconnect: false,
      sse: null,
    }
  }
  return (globalThis as Record<string, unknown>)[METRICS_WS_KEY] as MetricsGlobal
}

function createMetricsStore() {
  const { subscribe, set, update } = writable<MetricsState>(initialState)
  const g = getGlobal()
  const maxReconnectAttempts = 5

  function getWebSocketUrl(): string {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    // In development (Vite), connect directly to API server
    // In production, use same host
    const isDev = window.location.port === '5173'
    const host = isDev ? 'localhost:8080' : window.location.host
    return `${protocol}//${host}/ws`
  }

  function cleanupWebSocket(): void {
    if (g.ws) {
      // Remove event handlers to prevent callbacks after cleanup
      g.ws.onopen = null
      g.ws.onmessage = null
      g.ws.onclose = null
      g.ws.onerror = null
      if (g.ws.readyState === WebSocket.OPEN || g.ws.readyState === WebSocket.CONNECTING) {
        g.ws.close()
      }
      g.ws = null
    }
  }

  function connect(): void {
    // If already connected, just sync the store state and return
    if (g.ws?.readyState === WebSocket.OPEN) {
      update((s) => ({ ...s, connected: true, error: null }))
      return
    }

    // If connecting, wait for it
    if (g.ws?.readyState === WebSocket.CONNECTING) {
      return
    }

    // Cancel any pending reconnect
    if (g.reconnectTimeout) {
      clearTimeout(g.reconnectTimeout)
      g.reconnectTimeout = null
    }

    // Clean up existing connection (handles CLOSING/CLOSED state)
    cleanupWebSocket()

    g.intentionalDisconnect = false

    try {
      g.ws = new WebSocket(getWebSocketUrl())

      g.ws.onopen = () => {
        g.reconnectAttempts = 0
        update((s) => ({ ...s, connected: true, error: null }))

        // Re-subscribe if we had a topology
        const state = get({ subscribe })
        if (state.subscribedTopology) {
          sendMessage({ type: 'subscribe', topology: state.subscribedTopology })
        }
      }

      g.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data) as MetricsMessage
          if (msg.type === 'metrics') {
            update((s) => ({ ...s, metrics: msg.data }))
          }
        } catch (err) {
          console.error('[Metrics] Failed to parse message:', err)
        }
      }

      g.ws.onclose = () => {
        update((s) => ({ ...s, connected: false }))
        // Only reconnect if this wasn't an intentional disconnect
        if (!g.intentionalDisconnect) {
          scheduleReconnect()
        }
      }

      g.ws.onerror = (event) => {
        console.error('[Metrics] WebSocket error:', event)
        update((s) => ({ ...s, error: 'Connection error' }))
      }
    } catch (err) {
      console.error('[Metrics] Failed to create WebSocket:', err)
      update((s) => ({ ...s, error: 'Failed to connect' }))
      if (!g.intentionalDisconnect) {
        scheduleReconnect()
      }
    }
  }

  function scheduleReconnect(): void {
    if (g.reconnectTimeout) {
      clearTimeout(g.reconnectTimeout)
    }

    if (g.reconnectAttempts < maxReconnectAttempts && !g.intentionalDisconnect) {
      const delay = Math.min(1000 * 2 ** g.reconnectAttempts, 30000)
      g.reconnectAttempts++
      g.reconnectTimeout = setTimeout(connect, delay)
    }
  }

  function disconnect(): void {
    g.intentionalDisconnect = true

    if (g.reconnectTimeout) {
      clearTimeout(g.reconnectTimeout)
      g.reconnectTimeout = null
    }

    cleanupWebSocket()
    g.reconnectAttempts = 0
    set(initialState)
  }

  function sendMessage(msg: ClientMessage): void {
    if (g.ws?.readyState === WebSocket.OPEN) {
      g.ws.send(JSON.stringify(msg))
    }
  }

  function subscribeToTopology(topologyId: string): void {
    update((s) => ({ ...s, subscribedTopology: topologyId, metrics: null }))
    sendMessage({ type: 'subscribe', topology: topologyId })
  }

  function setInterval(interval: number): void {
    sendMessage({ type: 'setInterval', interval })
  }

  function unsubscribe(): void {
    update((s) => ({ ...s, subscribedTopology: null, metrics: null }))
  }

  // --- Shared (token-scoped) live metrics over SSE ---
  // A public/shared viewer has no session, so it can't use the auth-gated `/ws`.
  // Instead it streams projected metrics from the token-scoped share endpoint.
  function getShareStreamUrl(token: string): string {
    const isDev = window.location.port === '5173'
    const origin = isDev ? 'http://localhost:8080' : window.location.origin
    return `${origin}/api/share/topologies/${token}/metrics/stream`
  }

  function disconnectShareStream(): void {
    if (g.sse) {
      g.sse.onmessage = null
      g.sse.onerror = null
      g.sse.close()
      g.sse = null
    }
    set(initialState)
  }

  function connectShareStream(token: string): void {
    disconnectShareStream()
    try {
      const es = new EventSource(getShareStreamUrl(token))
      g.sse = es
      es.onopen = () => update((s) => ({ ...s, connected: true, error: null }))
      es.onmessage = (event) => {
        if (!event.data) return // ignore keep-alive pings
        try {
          update((s) => ({ ...s, metrics: JSON.parse(event.data) as MetricsData }))
        } catch (err) {
          console.error('[Metrics] Failed to parse share stream message:', err)
        }
      }
      es.onerror = () => update((s) => ({ ...s, connected: false }))
    } catch (err) {
      console.error('[Metrics] Failed to open share stream:', err)
      update((s) => ({ ...s, error: 'Failed to connect' }))
    }
  }

  return {
    subscribe,
    connect,
    disconnect,
    subscribeToTopology,
    setInterval,
    unsubscribe,
    connectShareStream,
    disconnectShareStream,
  }
}

export const metricsStore = createMetricsStore()

// Derived stores for easy access
export const metricsConnected = derived(metricsStore, ($store) => $store.connected)
export const metricsData = derived(metricsStore, ($store) => $store.metrics)
export const metricsError = derived(metricsStore, ($store) => $store.error)
export const metricsWarnings = derived(metricsStore, ($store) => $store.metrics?.warnings ?? [])
