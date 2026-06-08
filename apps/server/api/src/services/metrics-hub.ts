/**
 * Metrics hub — a tiny in-process pub/sub bridging the central metrics poll loop
 * (in `Server`, server.ts) to the route layer (the share SSE endpoint).
 *
 * The poll loop calls `publishMetrics(topologyId, data)` every tick; SSE handlers
 * read the last snapshot with `getLatestMetrics` and `subscribeMetrics` for live
 * updates. Single-process / single-instance (same posture as the WS client map and
 * the login rate-limiter) — no Redis, no new dependency.
 */

import type { MetricsData } from '../types.js'

type Listener = (data: MetricsData) => void

const latest = new Map<string, MetricsData>()
const listeners = new Map<string, Set<Listener>>()

/** Total live SSE subscribers across all topologies (for a global connection cap). */
let subscriberCount = 0

/** Poll loop → hub: cache the latest snapshot and fan out to live subscribers. */
export function publishMetrics(topologyId: string, data: MetricsData): void {
  latest.set(topologyId, data)
  const set = listeners.get(topologyId)
  if (!set) return
  for (const listener of set) {
    try {
      listener(data)
    } catch {
      // a slow/broken subscriber must not break the poll fan-out
    }
  }
}

/** Latest cached metrics for a topology (for the SSE initial event). */
export function getLatestMetrics(topologyId: string): MetricsData | undefined {
  return latest.get(topologyId)
}

/** Current number of live SSE subscribers (global cap enforcement). */
export function liveSubscriberCount(): number {
  return subscriberCount
}

/**
 * Subscribe to a topology's metric ticks. Returns an unsubscribe function; call it
 * on stream abort/close so dead clients are cleaned up and the count stays honest.
 */
export function subscribeMetrics(topologyId: string, listener: Listener): () => void {
  let set = listeners.get(topologyId)
  if (!set) {
    set = new Set()
    listeners.set(topologyId, set)
  }
  set.add(listener)
  subscriberCount++
  let active = true
  return () => {
    if (!active) return
    active = false
    subscriberCount--
    const s = listeners.get(topologyId)
    if (s) {
      s.delete(listener)
      if (s.size === 0) listeners.delete(topologyId)
    }
  }
}
