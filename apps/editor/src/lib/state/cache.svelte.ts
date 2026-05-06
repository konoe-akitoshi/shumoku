// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

// Mirrors the editor's in-memory project state into IndexedDB so a
// reload picks up where the user left off. There is no "save"
// concept — state IS the project; the cache is just the disk-side
// mirror, kept in sync.
//
// Model: every commit calls `cache.touch()`. If a sync is already
// running, the new request just sets a `pending` flag — the
// running loop picks it up after the current write completes. This
// coalesces bursts naturally without arbitrary timeouts and keeps
// IDB write order serialized.

const PREF_KEY = 'shumoku.cache'

type SyncFn = () => Promise<void> | void

let registered: SyncFn | null = null
let inFlight: Promise<void> | null = null
let pending = false
let listenersBound = false

const enabledState = $state({
  /** Beta flag — defaults on; user can disable via Settings. */
  on: true,
})

function loadPref() {
  // `typeof localStorage` is 'object' in SSR (Vite stubs it) but
  // its methods aren't real functions, so feature-detect by call
  // shape, not by presence.
  try {
    if (typeof localStorage?.getItem !== 'function') return
    enabledState.on = localStorage.getItem(PREF_KEY) !== 'off'
  } catch {
    // ignore — disabled storage / private mode etc.
  }
}
loadPref()

function bindLifecycleListeners() {
  if (listenersBound || typeof window === 'undefined') return
  listenersBound = true
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void drain()
  })
  window.addEventListener('pagehide', () => {
    void drain()
  })
}

async function runLoop(): Promise<void> {
  while (pending) {
    pending = false
    if (!registered) return
    try {
      await registered()
    } catch (err) {
      // Don't loop forever on a broken DB — log and let the next
      // touch() re-trigger.
      console.warn('[cache] sync failed', err)
      return
    }
  }
}

async function drain(): Promise<void> {
  if (!enabledState.on || !registered) {
    pending = false
    return
  }
  if (inFlight) return inFlight
  inFlight = runLoop().finally(() => {
    inFlight = null
  })
  return inFlight
}

export const cache = {
  /** Whether the user has the cache enabled. */
  get enabled(): boolean {
    return enabledState.on
  },
  setEnabled(on: boolean) {
    enabledState.on = on
    try {
      if (typeof localStorage?.setItem === 'function') {
        localStorage.setItem(PREF_KEY, on ? 'on' : 'off')
      }
    } catch {
      // ignore — same SSR / private-mode reasoning as loadPref
    }
    if (!on) pending = false
  },
  /**
   * Wire up the sync function. Caller is the composer; we keep the
   * boundary thin so tests can replace it. Re-registering
   * overwrites the previous sink — only one is active at a time.
   */
  register(syncFn: SyncFn): void {
    registered = syncFn
    bindLifecycleListeners()
  },
  /**
   * State changed. Mark dirty and kick the sync loop. If a sync is
   * already running, it will pick this up after it finishes the
   * current write.
   */
  touch(): void {
    if (!enabledState.on || !registered) return
    pending = true
    void drain()
  },
  /** Wait for any pending writes to land. Used on lifecycle boundaries. */
  drain(): Promise<void> {
    return drain()
  },
  /** Reset everything — used when switching projects or in tests. */
  reset(): void {
    pending = false
  },
}
