// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

// Coordinates "edit happened → eventually persist to IndexedDB".
//
// Strategy:
//   - debounce 1500ms after the last commit (typing / dragging
//     bursts collapse into one zip pass)
//   - immediate flush on `visibilitychange` → hidden and on
//     `pagehide` so a tab close in the debounce window doesn't lose
//     the last edits
//
// The actual write is owned by context.svelte.ts (it's the only
// piece that knows how to assemble a `.neted.zip` from current
// state); this module just schedules it.

const PREF_KEY = 'shumoku.autosave'
const DEBOUNCE_MS = 1500

type FlushFn = () => Promise<void> | void

let registered: FlushFn | null = null
let pending = false
let timer: ReturnType<typeof setTimeout> | null = null
let listenersBound = false

const enabledState = $state({
  /** Beta flag — defaults on; user can disable via Settings. */
  on: true,
})

function loadPref() {
  if (typeof localStorage === 'undefined') return
  enabledState.on = localStorage.getItem(PREF_KEY) !== 'off'
}
loadPref()

function bindLifecycleListeners() {
  if (listenersBound || typeof window === 'undefined') return
  listenersBound = true
  // 'hidden' fires reliably on tab switch, OS minimize, mobile
  // background. 'pagehide' is the navigation/close path.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void flushNow()
  })
  window.addEventListener('pagehide', () => {
    void flushNow()
  })
}

async function flushNow() {
  if (!registered || !pending) return
  if (timer) {
    clearTimeout(timer)
    timer = null
  }
  pending = false
  try {
    await registered()
  } catch (err) {
    // Don't loop on a broken DB — surface and move on.
    console.warn('[autosave] flush failed', err)
  }
}

export const autosave = {
  /** Whether the user has the cache enabled. */
  get enabled(): boolean {
    return enabledState.on
  },
  setEnabled(on: boolean) {
    enabledState.on = on
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(PREF_KEY, on ? 'on' : 'off')
    }
    if (!on) {
      pending = false
      if (timer) {
        clearTimeout(timer)
        timer = null
      }
    }
  },
  /**
   * Wire up the flush function. Caller is the composer; we keep the
   * boundary thin so tests can replace `flush`. Re-registering
   * overwrites the previous one — the editor only has one active
   * flush sink at a time.
   */
  register(flush: FlushFn): void {
    registered = flush
    bindLifecycleListeners()
  },
  /**
   * A commit happened. If autosave is on, schedule a flush; if off,
   * the call is a no-op (export still works manually).
   */
  schedule(): void {
    if (!enabledState.on || !registered) return
    pending = true
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      void flushNow()
    }, DEBOUNCE_MS)
  },
  /** Force-flush — useful before navigation away or user-driven save. */
  flush(): Promise<void> {
    return Promise.resolve(flushNow())
  },
  /** Reset everything — used when switching projects or in tests. */
  reset(): void {
    pending = false
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
  },
}
