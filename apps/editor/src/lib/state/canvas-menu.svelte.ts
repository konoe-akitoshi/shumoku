// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

// Slot for the canvas right-click menu's open / position state.
// Lives in `state/` so the (canvas) layout can render the menu
// once and the per-page right-click handler can flip it open
// without prop-drilling.

const slot = $state({ open: false, x: 0, y: 0 })

export function openCanvasMenu(x: number, y: number): void {
  slot.x = x
  slot.y = y
  slot.open = true
}

export function closeCanvasMenu(): void {
  slot.open = false
}

export function isCanvasMenuOpen(): boolean {
  return slot.open
}

export function canvasMenuPosition(): { x: number; y: number } {
  return { x: slot.x, y: slot.y }
}
