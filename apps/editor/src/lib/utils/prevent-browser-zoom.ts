// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

import { onMount } from 'svelte'

/**
 * Block the browser's built-in zoom on Cmd/Ctrl + wheel and pinch
 * (which the OS synthesizes as `wheel` with `ctrlKey: true`).
 * Without this, hovering over a floating button while zooming
 * triggers the page-level zoom shortcut on macOS instead of the
 * canvas zoom — Miro / Figma / Excalidraw all suppress it the
 * same way.
 *
 * The listener is registered with `{ passive: false }` because the
 * default `passive: true` on wheel events forbids preventDefault.
 * `preventDefault` only stops the *browser default*, so Svelte
 * Flow / d3-zoom / wheel-gestures listeners still see the event
 * and run their pan/zoom logic.
 *
 * Use only on canvas pages (diagram / scene). Pages with normal
 * scrollable content (settings, materials, BOM) should keep
 * browser zoom working for accessibility.
 */
export function preventBrowserZoom(): void {
  onMount(() => {
    const handler = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) e.preventDefault()
    }
    window.addEventListener('wheel', handler, { passive: false })
    return () => window.removeEventListener('wheel', handler)
  })
}
