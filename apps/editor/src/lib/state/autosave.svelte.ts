// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

// "Edit happened → write to IndexedDB."
//
// Model: every commit fires `schedule()`. If a save is already in
// flight, the new request just sets a `pending` flag — the running
// loop will pick it up after the current write completes. This
// coalesces bursts naturally without arbitrary timeouts and keeps
// IDB write order serialized.
//
// Lifecycle hooks (visibilitychange / pagehide) call `flush()`
// which awaits any in-flight save plus one more if pending.

const PREF_KEY = 'shumoku.autosave'

type FlushFn = () => Promise<void> | void

let registered: FlushFn | null = null
let saving: Promise<void> | null = null
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
    if (document.visibilityState === 'hidden') void flush()
  })
  window.addEventListener('pagehide', () => {
    void flush()
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
      // commit re-trigger.
      console.warn('[autosave] save failed', err)
      return
    }
  }
}

async function flush(): Promise<void> {
  if (!enabledState.on || !registered) {
    pending = false
    return
  }
  if (saving) return saving
  saving = runLoop().finally(() => {
    saving = null
  })
  return saving
}

export const autosave = {
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
   * Wire up the flush function. Caller is the composer; we keep the
   * boundary thin so tests can replace `flush`. Re-registering
   * overwrites the previous one — the editor only has one active
   * flush sink at a time.
   */
  register(flushFn: FlushFn): void {
    registered = flushFn
    bindLifecycleListeners()
  },
  /**
   * A commit happened. Mark dirty and kick the save loop. If a
   * save is already running, it will pick this up after it
   * finishes the current write.
   */
  schedule(): void {
    if (!enabledState.on || !registered) return
    pending = true
    void flush()
  },
  /** Force-flush — useful before navigation away or user-driven save. */
  flush(): Promise<void> {
    return flush()
  },
  /** Reset everything — used when switching projects or in tests. */
  reset(): void {
    pending = false
  },
}
