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

function createMetricsStore() {
  const { subscribe, set, update } = writable<MetricsState>(initialState)
  let ws: WebSocket | null = null
  let reconnectTimeout: ReturnType<typeof setTimeout> | null = null
  let reconnectAttempts = 0
  const maxReconnectAttempts = 5
  let intentionalDisconnect = false

  function getWebSocketUrl(): string {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${protocol}//${window.location.host}/ws`
  }

  function cleanupWebSocket(): void {
    if (ws) {
      // Remove event handlers to prevent callbacks after cleanup
      ws.onopen = null
      ws.onmessage = null
      ws.onclose = null
      ws.onerror = null
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close()
      }
      ws = null
    }
  }

  function connect(): void {
    // Cancel any pending reconnect
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout)
      reconnectTimeout = null
    }

    // Clean up existing connection (handles CONNECTING state too)
    cleanupWebSocket()

    intentionalDisconnect = false

    try {
      ws = new WebSocket(getWebSocketUrl())

      ws.onopen = () => {
        reconnectAttempts = 0
        update((s) => ({ ...s, connected: true, error: null }))

        // Re-subscribe if we had a topology
        const state = get({ subscribe })
        if (state.subscribedTopology) {
          sendMessage({ type: 'subscribe', topology: state.subscribedTopology })
        }
      }

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data) as MetricsMessage
          if (msg.type === 'metrics') {
            update((s) => ({ ...s, metrics: msg.data }))
          }
        } catch (err) {
          console.error('[Metrics] Failed to parse message:', err)
        }
      }

      ws.onclose = () => {
        update((s) => ({ ...s, connected: false }))
        // Only reconnect if this wasn't an intentional disconnect
        if (!intentionalDisconnect) {
          scheduleReconnect()
        }
      }

      ws.onerror = (event) => {
        console.error('[Metrics] WebSocket error:', event)
        update((s) => ({ ...s, error: 'Connection error' }))
      }
    } catch (err) {
      console.error('[Metrics] Failed to create WebSocket:', err)
      update((s) => ({ ...s, error: 'Failed to connect' }))
      if (!intentionalDisconnect) {
        scheduleReconnect()
      }
    }
  }

  function scheduleReconnect(): void {
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout)
    }

    if (reconnectAttempts < maxReconnectAttempts && !intentionalDisconnect) {
      const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000)
      reconnectAttempts++
      reconnectTimeout = setTimeout(connect, delay)
    }
  }

  function disconnect(): void {
    intentionalDisconnect = true

    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout)
      reconnectTimeout = null
    }

    cleanupWebSocket()
    reconnectAttempts = 0
    set(initialState)
  }

  function sendMessage(msg: ClientMessage): void {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg))
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
