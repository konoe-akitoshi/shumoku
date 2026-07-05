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

/**
 * Optional callback invoked when a topology's SSE subscriber count changes
 * (first subscriber arrived, or last subscriber left). Used by the PollScheduler
 * so SSE arrivals trigger a cadence switch without requiring a direct reference
 * between the route layer and the Server class.
 */
let watchChangeCallback: ((topologyId: string) => void) | null = null

/**
 * Register (or clear) the watch-change callback. Called once at server startup;
 * the PollScheduler supplies its `notifyWatchChanged` method here.
 */
export function setWatchChangeCallback(cb: ((topologyId: string) => void) | null): void {
  watchChangeCallback = cb
}

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

/** Number of live SSE subscribers for a specific topology. */
export function getSubscriberCount(topologyId: string): number {
  return listeners.get(topologyId)?.size ?? 0
}

/**
 * Subscribe to a topology's metric ticks. Returns an unsubscribe function; call it
 * on stream abort/close so dead clients are cleaned up and the count stays honest.
 */
export function subscribeMetrics(topologyId: string, listener: Listener): () => void {
  let set = listeners.get(topologyId)
  const wasEmpty = !set || set.size === 0
  if (!set) {
    set = new Set()
    listeners.set(topologyId, set)
  }
  set.add(listener)
  subscriberCount++
  // Notify scheduler that this topology is now watched (first SSE subscriber)
  if (wasEmpty && watchChangeCallback) {
    watchChangeCallback(topologyId)
  }
  let active = true
  return () => {
    if (!active) return
    active = false
    subscriberCount--
    const s = listeners.get(topologyId)
    if (s) {
      s.delete(listener)
      if (s.size === 0) {
        listeners.delete(topologyId)
        // Notify scheduler that this topology is now unwatched (last SSE subscriber left)
        if (watchChangeCallback) watchChangeCallback(topologyId)
      }
    }
  }
}
