// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

import type { ActionContext } from './types'

// Single slot for "the currently active action context". Pages /
// canvases publish their `ActionContext` here while mounted; the
// global keyboard handler and any toolbar buttons read it.
//
// Reactive ($state) so consumers re-derive `enabled` flags as the
// underlying state (selection, camera) changes.

const provider = $state<{ ctx: ActionContext | null }>({ ctx: null })

/** Replace the active context. Pages call this in $effect. */
export function provideActionContext(ctx: ActionContext): void {
  provider.ctx = ctx
}

/** Drop the active context — page is unmounting. */
export function clearActionContext(): void {
  provider.ctx = null
}

/**
 * Read the currently active context, or a minimal stub if no
 * canvas is mounted (e.g. on settings / materials / BOM pages).
 * Toolbar buttons that don't need selection / camera (Undo /
 * Redo) work fine with the stub.
 */
export function getActionContext(): ActionContext {
  return provider.ctx ?? { mode: 'diagram', selection: { ids: [], types: [] } }
}
