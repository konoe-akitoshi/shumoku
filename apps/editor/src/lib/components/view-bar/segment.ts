// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Tailwind class string for a segmented-control trigger button. The
 * outer `<ViewBar>` provides the surrounding pill (gray background +
 * shadow), so each segment is just a transparent rounded-lg that
 * gains a white "card" treatment when active.
 */
export function segmentClass(active: boolean): string {
  return [
    'flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-medium transition-colors',
    active
      ? 'bg-white text-neutral-900 shadow-sm dark:bg-neutral-700 dark:text-neutral-50'
      : 'text-neutral-500 hover:bg-white/60 hover:text-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-700/40 dark:hover:text-neutral-200',
  ].join(' ')
}
