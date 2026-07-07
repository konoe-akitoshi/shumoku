// Copyright (C) 2026-present Akitoshi Saeki

// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PollSchedulerConfig } from './poll-scheduler.js'
import { PollScheduler } from './poll-scheduler.js'

/** A config with jitter=0 so tests have deterministic timing. */
function makeConfig(overrides: Partial<PollSchedulerConfig> = {}): PollSchedulerConfig {
  return {
    fastInterval: 100,
    slowInterval: 1000,
    concurrencyLimit: 3,
    jitterMax: 0, // deterministic in tests
    ...overrides,
  }
}

describe('PollScheduler', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // -------------------------------------------------------------------------
  // 1. Watched topology polls at fast cadence
  // -------------------------------------------------------------------------
  it('polls watched topology at fastInterval', async () => {
    const calls: string[] = []
    const pollFn = vi.fn(async (id: string) => {
      calls.push(id)
    })
    const watched = new Set(['topo-a'])
    const scheduler = new PollScheduler(
      makeConfig({ fastInterval: 50, slowInterval: 5000 }),
      pollFn,
      () => ['topo-a'],
      (id) => watched.has(id),
    )
    scheduler.start()

    // Fire the initial timer (delay=0, jitter=0)
    await vi.advanceTimersByTimeAsync(5)
    const countAfterFirst = calls.length
    expect(countAfterFirst).toBeGreaterThanOrEqual(1)

    // Advance by 3 fast intervals (50ms each = 150ms)
    await vi.advanceTimersByTimeAsync(160)
    const countAfterThree = calls.length
    // Should have fired ~3 more times
    expect(countAfterThree - countAfterFirst).toBeGreaterThanOrEqual(2)

    scheduler.stop()
  })

  // -------------------------------------------------------------------------
  // 2. Unwatched topology polls at slow cadence
  // -------------------------------------------------------------------------
  it('polls unwatched topology at slowInterval', async () => {
    const calls: string[] = []
    const pollFn = vi.fn(async (id: string) => {
      calls.push(id)
    })
    const scheduler = new PollScheduler(
      makeConfig({ fastInterval: 50, slowInterval: 500 }),
      pollFn,
      () => ['topo-b'],
      () => false, // never watched
    )
    scheduler.start()

    // Fire initial poll
    await vi.advanceTimersByTimeAsync(5)
    expect(calls.length).toBeGreaterThanOrEqual(1)

    const countBefore = calls.length
    // Advance 200ms — less than one slow interval (500ms)
    await vi.advanceTimersByTimeAsync(200)
    // Should NOT have fired again yet
    expect(calls.length).toBe(countBefore)

    // Advance another 350ms to cross the 500ms slow interval
    await vi.advanceTimersByTimeAsync(350)
    expect(calls.length).toBeGreaterThan(countBefore)

    scheduler.stop()
  })

  // -------------------------------------------------------------------------
  // 3. Per-topology overlap guard: other topologies unaffected by a slow poll;
  //    in-flight guard prevents double-start via notifyWatchChanged
  // -------------------------------------------------------------------------
  it('overlap guard: notifyWatchChanged does not double-start an in-flight poll', async () => {
    const inflightResolvers: Array<() => void> = []
    const pollStarted: string[] = []

    const pollFn = vi.fn(async (id: string) => {
      pollStarted.push(id)
      if (id === 'topo-a') {
        // Block until manually resolved
        await new Promise<void>((resolve) => inflightResolvers.push(resolve))
      }
    })

    const watched = new Set(['topo-a'])
    const scheduler = new PollScheduler(
      makeConfig({ fastInterval: 50, slowInterval: 5000, concurrencyLimit: 10 }),
      pollFn,
      () => ['topo-a'],
      (id) => watched.has(id),
    )
    scheduler.start()

    // Fire initial timer → topo-a is now in-flight
    await vi.advanceTimersByTimeAsync(5)
    expect(pollStarted.filter((id) => id === 'topo-a').length).toBe(1)

    // While in-flight, notify watch change → schedules an immediate timer
    scheduler.notifyWatchChanged('topo-a')

    // Fire that immediate timer — the inFlight guard should block it
    await vi.advanceTimersByTimeAsync(5)

    // topo-a poll still only called once (inFlight guard fired)
    expect(pollStarted.filter((id) => id === 'topo-a').length).toBe(1)

    // Resolve the in-flight poll
    for (const resolve of inflightResolvers) resolve()
    await vi.advanceTimersByTimeAsync(10)

    scheduler.stop()
  })

  it('overlap guard: other topologies poll independently while one is in flight', async () => {
    const inflightResolvers: Array<() => void> = []
    const pollCounts: Record<string, number> = { a: 0, b: 0 }

    const pollFn = vi.fn(async (id: string) => {
      if (id === 'topo-a') {
        await new Promise<void>((resolve) => inflightResolvers.push(resolve))
      } else {
        pollCounts['b'] = (pollCounts['b'] ?? 0) + 1
      }
    })

    const scheduler = new PollScheduler(
      makeConfig({ fastInterval: 50, slowInterval: 50, concurrencyLimit: 10 }),
      pollFn,
      () => ['topo-a', 'topo-b'],
      () => true,
    )
    scheduler.start()

    // Let topo-a get stuck, topo-b polls freely for ~300ms
    await vi.advanceTimersByTimeAsync(305)

    // topo-b should have polled several times independently
    expect(pollCounts['b']).toBeGreaterThanOrEqual(3)

    // Resolve topo-a to let the scheduler clean up
    for (const resolve of inflightResolvers) resolve()
    await vi.advanceTimersByTimeAsync(10)

    scheduler.stop()
  })

  // -------------------------------------------------------------------------
  // 4. Concurrency cap: with cap=2, 3rd concurrent poll is queued
  // -------------------------------------------------------------------------
  it('concurrency cap: queues 3rd poll until a slot opens', async () => {
    const resolvers: Array<() => void> = []
    const started: string[] = []

    const pollFn = vi.fn(async (id: string) => {
      started.push(id) // synchronous — before any await
      await new Promise<void>((resolve) => resolvers.push(resolve))
    })

    const scheduler = new PollScheduler(
      makeConfig({ fastInterval: 50, slowInterval: 50, concurrencyLimit: 2 }),
      pollFn,
      () => ['t1', 't2', 't3'],
      () => true,
    )
    scheduler.start()

    // Fire all three t=0 timers
    await vi.advanceTimersByTimeAsync(5)

    // Only 2 should be in flight (concurrency cap = 2); t3 is queued
    expect(started.length).toBe(2)

    // Resolve one slot — the queued t3 poll should start synchronously in drainQueue
    const r = resolvers.shift()
    r?.()
    // Flush microtasks: resolve → finally → drainQueue → pollFn (started.push synchronous)
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()

    // Now all 3 should have started
    expect(started.length).toBe(3)

    // Clean up
    for (const r2 of resolvers) r2()
    await vi.advanceTimersByTimeAsync(10)

    scheduler.stop()
  })

  // -------------------------------------------------------------------------
  // 5. Watch transition triggers immediate poll (with debounce)
  // -------------------------------------------------------------------------
  it('notifyWatchChanged triggers immediate poll when topology becomes watched', async () => {
    const calls: string[] = []
    const pollFn = vi.fn(async (id: string) => {
      calls.push(id)
    })

    const watched = new Set<string>()
    const scheduler = new PollScheduler(
      makeConfig({ fastInterval: 100, slowInterval: 5000 }),
      pollFn,
      () => ['topo-x'],
      (id) => watched.has(id),
    )
    scheduler.start()

    // Fire initial slow poll
    await vi.advanceTimersByTimeAsync(5)
    expect(calls.length).toBeGreaterThanOrEqual(1)

    // Advance well past fastInterval so lastPollAt is stale
    await vi.advanceTimersByTimeAsync(200)
    const countBefore = calls.length

    // Now add a watcher — lastPollAt is ~205ms ago, fastInterval=100, so >= threshold
    watched.add('topo-x')
    scheduler.notifyWatchChanged('topo-x')

    // The immediate poll should have fired (delay=0)
    await vi.advanceTimersByTimeAsync(5)
    expect(calls.length).toBeGreaterThan(countBefore)

    scheduler.stop()
  })

  // -------------------------------------------------------------------------
  // 6. pokeTopology: immediate poll after a mapping write (Item 3, #569)
  // -------------------------------------------------------------------------
  it('pokeTopology fires an immediate poll when last poll is stale', async () => {
    const calls: string[] = []
    const pollFn = vi.fn(async (id: string) => {
      calls.push(id)
    })

    const scheduler = new PollScheduler(
      makeConfig({ fastInterval: 2000, slowInterval: 10000 }),
      pollFn,
      () => ['topo-poke'],
      () => false,
    )
    scheduler.start()

    // Fire the initial poll (delay=0)
    await vi.advanceTimersByTimeAsync(5)
    await Promise.resolve()
    await Promise.resolve()
    const afterInit = calls.length
    expect(afterInit).toBeGreaterThanOrEqual(1)

    // Advance well past fastInterval so the last poll is stale
    await vi.advanceTimersByTimeAsync(3000)
    const countBefore = calls.length

    // Poke — last poll was > fastInterval ago, should fire immediately
    scheduler.pokeTopology('topo-poke')
    await vi.advanceTimersByTimeAsync(5)

    expect(calls.length).toBeGreaterThan(countBefore)

    scheduler.stop()
  })

  it('pokeTopology is a no-op when last poll was recent (debounce)', async () => {
    const calls: string[] = []
    const pollFn = vi.fn(async (id: string) => {
      calls.push(id)
    })

    const scheduler = new PollScheduler(
      makeConfig({ fastInterval: 2000, slowInterval: 10000 }),
      pollFn,
      () => ['topo-debounce'],
      () => false,
    )
    scheduler.start()

    // Fire the initial poll
    await vi.advanceTimersByTimeAsync(5)
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
    const afterInit = calls.length
    expect(afterInit).toBeGreaterThanOrEqual(1)

    // Advance only a little — last poll was recent (< fastInterval=2000ms)
    await vi.advanceTimersByTimeAsync(100)
    const countBefore = calls.length

    // Poke — should be a no-op (debounced)
    scheduler.pokeTopology('topo-debounce')
    await vi.advanceTimersByTimeAsync(10)

    // No extra poll fired
    expect(calls.length).toBe(countBefore)

    scheduler.stop()
  })

  it('pokeTopology is a no-op for unknown topology', async () => {
    const pollFn = vi.fn(async () => {})
    const scheduler = new PollScheduler(
      makeConfig(),
      pollFn,
      () => ['known'],
      () => false,
    )
    scheduler.start()
    await vi.advanceTimersByTimeAsync(5)
    const countBefore = pollFn.mock.calls.length

    // unknown id — should not throw, should not poll
    scheduler.pokeTopology('totally-unknown')
    await vi.advanceTimersByTimeAsync(5)

    expect(pollFn.mock.calls.length).toBe(countBefore)
    scheduler.stop()
  })

  it('notifyWatchChanged does NOT re-poll if last poll was very recent (debounce)', async () => {
    const calls: string[] = []
    const pollFn = vi.fn(async (id: string) => {
      calls.push(id)
    })

    const watched = new Set<string>()
    const scheduler = new PollScheduler(
      makeConfig({ fastInterval: 2000, slowInterval: 10000 }),
      pollFn,
      () => ['topo-y'],
      (id) => watched.has(id),
    )
    scheduler.start()

    // Fire the initial poll
    await vi.advanceTimersByTimeAsync(5)
    // Flush so the finally block runs and lastPollAt is set
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
    const countAfterInit = calls.length
    expect(countAfterInit).toBeGreaterThanOrEqual(1)

    // Immediately notify watch change — lastPollAt was just set, < fastInterval(2000) ago
    watched.add('topo-y')
    scheduler.notifyWatchChanged('topo-y')

    // Only advance a tiny bit — not enough for a normal slow poll
    await vi.advanceTimersByTimeAsync(10)
    // Should NOT have fired another immediate poll (debounce: last poll < fastInterval ago)
    expect(calls.length).toBe(countAfterInit)

    scheduler.stop()
  })
})
