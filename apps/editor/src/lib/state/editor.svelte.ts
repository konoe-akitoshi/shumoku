// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

import { darkTheme, lightTheme, type Theme } from '@shumoku/core'

// Editor UI store — mode (edit/view), theme. Pure leaf: no commit
// wrapping, no cross-store coupling. The composer adds the
// edit-session transaction bracket on top of `setMode`.

const editor = $state({
  mode: 'view' as 'edit' | 'view',
  isDark: false,
})

export const editorStore = {
  get mode(): 'edit' | 'view' {
    return editor.mode
  },
  setMode(v: 'edit' | 'view') {
    editor.mode = v
  },
  get isDark(): boolean {
    return editor.isDark
  },
  setDark(v: boolean) {
    editor.isDark = v
  },
  get theme(): Theme {
    return editor.isDark ? darkTheme : lightTheme
  },
  get interactive(): boolean {
    return editor.mode === 'edit'
  },
  toggleTheme() {
    editor.isDark = !editor.isDark
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark', editor.isDark)
      localStorage.setItem('theme', editor.isDark ? 'dark' : 'light')
    }
  },
}

/** Sync `isDark` with the DOM. Call once in the root layout. */
export function initDarkMode() {
  if (typeof document === 'undefined') return
  editor.isDark = document.documentElement.classList.contains('dark')
  const obs = new MutationObserver(() => {
    editor.isDark = document.documentElement.classList.contains('dark')
  })
  obs.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
  })
  return () => obs.disconnect()
}
