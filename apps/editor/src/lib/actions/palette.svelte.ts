// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

// Tiny `$state` slot for the command palette's open/close. Lives
// here (not inside `CommandPalette.svelte`) so the `ui.commandPalette`
// action can flip it without importing the component, avoiding a
// boot cycle (action registry → palette component → registry).

const palette = $state({ open: false })

export function openPalette(): void {
  palette.open = true
}

export function closePalette(): void {
  palette.open = false
}

export function isPaletteOpen(): boolean {
  return palette.open
}
