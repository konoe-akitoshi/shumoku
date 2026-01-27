/**
 * Metrics Store
 * WebSocket connection and real-time metrics updates
 */

import { writable, derived, get } from 'svelte/store'

// Types
export type NodeStatus = 'up' | 'down' | 'unknown' | 'warning'
export type EdgeStatus = 'up' | 'down' | 'unknown' | 'degraded'

export interface NodeMetrics {
  status: NodeStatus
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
}

function getGlobal(): MetricsGlobal {
  if (!(globalThis as Record<string, unknown>)[METRICS_WS_KEY]) {
    ;(globalThis as Record<string, unknown>)[METRICS_WS_KEY] = {
      ws: null,
      reconnectTimeout: null,
      reconnectAttempts: 0,
      intentionalDisconnect: false,
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
      const delay = Math.min(1000 * Math.pow(2, g.reconnectAttempts), 30000)
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

  return {
    subscribe,
    connect,
    disconnect,
    subscribeToTopology,
    setInterval,
    unsubscribe,
  }
}

export const metricsStore = createMetricsStore()

// Derived stores for easy access
export const metricsConnected = derived(metricsStore, ($store) => $store.connected)
export const metricsData = derived(metricsStore, ($store) => $store.metrics)
export const metricsError = derived(metricsStore, ($store) => $store.error)
