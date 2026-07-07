/**
 * PollScheduler — per-topology demand-driven metrics polling.
 *
 * Replaces the single global `setInterval` in `Server.startMetricsPolling()`.
 * Each topology gets its own recursive-setTimeout loop so we can individually
 * adjust cadence based on whether anyone is watching:
 *
 *   - Watched (>0 WS/SSE subscribers): poll every `fastInterval` (default 5 s)
 *   - Unwatched: poll every `slowInterval` (default 60 s — "background" cadence)
 *
 * Key design choices:
 *
 *   - `inFlight` guard per topology: a slow poll doesn't double-start for that
 *     topology. Other topologies are completely unaffected — no global lock.
 *   - Global concurrency cap (`concurrencyLimit`): total simultaneous polls across
 *     all topologies. Excess requests are queued and run as slots open.
 *   - Jitter (`jitterMax`): small random offset on every rescheduled timer to
 *     break thundering-herd alignment when many topologies share a cadence.
 *   - `notifyWatchChanged`: immediate debounced poll when a topology becomes
 *     watched. Skipped if the last poll was < `fastInterval` ago (already fresh).
 */

export interface PollSchedulerConfig {
  /** Fast poll interval in ms — used when the topology has active subscribers. */
  fastInterval: number
  /** Slow poll interval in ms — used when no subscribers are watching. */
  slowInterval: number
  /** Maximum simultaneous in-flight polls across all topologies. Default 3. */
  concurrencyLimit: number
  /** Maximum random jitter added to each reschedule in ms. Default 1000. */
  jitterMax: number
}

export interface TopologyScheduleState {
  topologyId: string
  isWatched: boolean
  lastPollAt: number
  inFlight: boolean
  timer: ReturnType<typeof setTimeout> | null
  /**
   * True while a run for this topology is waiting in the concurrency-cap
   * queue. Guards against rapid pokes enqueueing duplicate closures — without
   * it a burst of mapping saves under a saturated cap grows the queue
   * unboundedly (one stale closure per poke).
   */
  queued: boolean
}

/**
 * PollScheduler with injected dependencies so it can be tested without a
 * real database or HTTP server.
 */
export class PollScheduler {
  private config: PollSchedulerConfig
  private pollFn: (topologyId: string) => Promise<void>
  private getTopologyIds: () => string[]
  private isWatched: (topologyId: string) => boolean

  private states: Map<string, TopologyScheduleState> = new Map()
  /** Slots in use (active concurrent polls). */
  private activeCount = 0
  /** Queue of pending poll calls that are waiting for a concurrency slot. */
  private queue: Array<() => void> = []
  private started = false

  constructor(
    config: PollSchedulerConfig,
    pollFn: (topologyId: string) => Promise<void>,
    getTopologyIds: () => string[],
    isWatched: (topologyId: string) => boolean,
  ) {
    this.config = config
    this.pollFn = pollFn
    this.getTopologyIds = getTopologyIds
    this.isWatched = isWatched
  }

  /** Start polling for all current topology IDs. */
  start(): void {
    if (this.started) return
    this.started = true
    const ids = this.getTopologyIds()
    for (const id of ids) {
      this.ensureState(id)
      this.scheduleNext(id, 0) // immediate first poll
    }
  }

  /** Stop all per-topology timers and drain the queue. */
  stop(): void {
    this.started = false
    for (const state of this.states.values()) {
      if (state.timer !== null) {
        clearTimeout(state.timer)
        state.timer = null
      }
    }
    this.queue = []
    this.states.clear()
  }

  /**
   * Call when a topology's watch status changes (subscriber added or removed,
   * or a new topology is registered). If the topology is newly watched and was
   * not recently polled, an immediate poll is triggered and the cadence switches
   * to fast. If unwatched, the cadence switches to slow on next reschedule.
   */
  notifyWatchChanged(topologyId: string): void {
    if (!this.started) return
    const watched = this.isWatched(topologyId)
    const state = this.ensureState(topologyId)
    const wasWatched = state.isWatched
    state.isWatched = watched

    if (watched && !wasWatched) {
      // Newly watched — trigger immediate poll if last poll was not recent
      const sinceLastPoll = Date.now() - state.lastPollAt
      if (sinceLastPoll >= this.config.fastInterval) {
        // Cancel the pending slow timer and fire right away
        if (state.timer !== null) {
          clearTimeout(state.timer)
          state.timer = null
        }
        this.scheduleNext(topologyId, 0)
      }
      // If the last poll was < fastInterval ago, the data is already fresh —
      // let the existing timer run (it'll use the fast cadence on next tick).
    }
  }

  /**
   * Schedule an immediate poll for a topology, debounced by `fastInterval`.
   *
   * Used after a mapping write (updateMapping / orphan reassign / discard) so
   * the new binding is reflected in live metrics without waiting a full poll
   * interval. The debounce prevents a burst of saves from hammering the data
   * source: if a poll already ran within `fastInterval` ms the data is fresh
   * enough and the poke is a no-op; if a poll is currently in flight the
   * overlap guard will reschedule at the fast cadence after it completes.
   *
   * The topology must already be registered (either by `start()` or
   * `addTopology()`); an unknown id is silently ignored.
   */
  pokeTopology(topologyId: string): void {
    if (!this.started) return
    const state = this.states.get(topologyId)
    if (!state) return
    // Debounce: if last poll was recent (< fastInterval) the cached data is
    // already fresh — don't fire an extra poll.
    const sinceLastPoll = Date.now() - state.lastPollAt
    if (sinceLastPoll < this.config.fastInterval) return
    // Cancel any pending timer and schedule an immediate poll (delay=0).
    if (state.timer !== null) {
      clearTimeout(state.timer)
      state.timer = null
    }
    this.scheduleNext(topologyId, 0)
  }

  /**
   * Register a new topology that was added after `start()` was called.
   * Starts its timer loop immediately.
   */
  addTopology(topologyId: string): void {
    if (!this.started) return
    if (this.states.has(topologyId)) return
    this.ensureState(topologyId)
    this.scheduleNext(topologyId, 0)
  }

  /** Remove a topology — cancel its timer and forget its state. */
  removeTopology(topologyId: string): void {
    const state = this.states.get(topologyId)
    if (!state) return
    if (state.timer !== null) {
      clearTimeout(state.timer)
      state.timer = null
    }
    this.states.delete(topologyId)
  }

  // ---------------------------------------------------------------------------
  // Private

  private ensureState(topologyId: string): TopologyScheduleState {
    const existing = this.states.get(topologyId)
    if (existing) return existing
    const state: TopologyScheduleState = {
      topologyId,
      isWatched: this.isWatched(topologyId),
      lastPollAt: 0,
      inFlight: false,
      timer: null,
      queued: false,
    }
    this.states.set(topologyId, state)
    return state
  }

  private scheduleNext(topologyId: string, delay: number): void {
    const state = this.states.get(topologyId)
    if (!state || !this.started) return

    // Cancel any existing pending timer before setting a new one
    if (state.timer !== null) {
      clearTimeout(state.timer)
      state.timer = null
    }

    const jitter = Math.floor(Math.random() * (this.config.jitterMax + 1))
    const actualDelay = Math.max(0, delay + jitter)

    state.timer = setTimeout(() => {
      state.timer = null
      this.runPoll(topologyId)
    }, actualDelay)
  }

  private runPoll(topologyId: string): void {
    const state = this.states.get(topologyId)
    if (!state || !this.started) return

    if (state.inFlight) {
      // Overlap guard: this topology's previous poll is still running.
      // Reschedule at current cadence without starting a second poll.
      const cadence = state.isWatched ? this.config.fastInterval : this.config.slowInterval
      this.scheduleNext(topologyId, cadence)
      return
    }

    if (this.activeCount >= this.config.concurrencyLimit) {
      // Global concurrency cap — queue this poll until a slot opens. At most
      // ONE queued run per topology: a rapid poke burst must not stack
      // duplicate closures (each would re-run and reschedule).
      if (state.queued) return
      state.queued = true
      this.queue.push(() => {
        const s = this.states.get(topologyId)
        if (s) s.queued = false
        this.runPoll(topologyId)
      })
      return
    }

    this.startPoll(state)
  }

  private startPoll(state: TopologyScheduleState): void {
    if (!this.started) return
    state.inFlight = true
    this.activeCount++

    const { topologyId } = state

    this.pollFn(topologyId)
      .catch((err) => {
        console.error(`[PollScheduler] Poll failed for topology "${topologyId}":`, err)
      })
      .finally(() => {
        const s = this.states.get(topologyId)
        if (s) {
          s.inFlight = false
          s.lastPollAt = Date.now()
        }
        this.activeCount--
        this.drainQueue()
        // Reschedule for this topology
        if (s && this.started) {
          const cadence = s.isWatched ? this.config.fastInterval : this.config.slowInterval
          this.scheduleNext(topologyId, cadence)
        }
      })
  }

  private drainQueue(): void {
    while (this.queue.length > 0 && this.activeCount < this.config.concurrencyLimit) {
      const next = this.queue.shift()
      if (next) next()
    }
  }
}
