// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

import { ArrowsClockwise, ArrowUUpLeft, ArrowUUpRight, Trash } from 'phosphor-svelte'
import { diagramState } from '../context.svelte'
import { defineAction } from './registry'
import type { Action, ActionContext } from './types'

// Built-in v1 action set. Lives next to the registry rather than
// inline in components so each surface (context menu / shortcut /
// toolbar / palette) gets the same wiring for free.
//
// Calling this at app boot once registers everything. The module
// itself is pure / side-effect-free; the entry route invokes
// `registerBuiltinActions()` so SSR doesn't run side effects on
// import.

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.platform)
const Mod = isMac ? '⌘' : 'Ctrl'

const hasSelection = (ctx: ActionContext) => ctx.selection.ids.length > 0
const inDiagram = (ctx: ActionContext) => ctx.mode === 'diagram'

function deleteSelection(ctx: ActionContext): void {
  // Snapshot so removals don't mutate the iteration.
  const items = ctx.selection.ids.map((id, i) => ({ id, type: ctx.selection.types[i] }))
  for (const it of items) {
    if (it.type === 'edge' || it.type === 'link') diagramState.removeLink(it.id)
    else diagramState.removeNode(it.id)
  }
}

const builtinActions: Action[] = [
  // ----- Edit ------------------------------------------------------------
  {
    id: 'edit.undo',
    label: 'Undo',
    shortcut: `${Mod}+Z`,
    icon: ArrowUUpLeft,
    group: 'edit',
    enabled: () => diagramState.canUndo,
    run: () => {
      diagramState.undo()
    },
  },
  {
    id: 'edit.redo',
    label: 'Redo',
    shortcut: `${Mod}+Shift+Z`,
    icon: ArrowUUpRight,
    group: 'edit',
    enabled: () => diagramState.canRedo,
    run: () => {
      diagramState.redo()
    },
  },
  {
    id: 'edit.delete',
    label: 'Delete',
    shortcut: 'Del',
    icon: Trash,
    group: 'edit',
    enabled: hasSelection,
    run: deleteSelection,
  },

  // ----- View ------------------------------------------------------------
  {
    id: 'view.fitAll',
    label: 'Fit to view',
    shortcut: `${Mod}+0`,
    group: 'view',
    enabled: (ctx) => !!ctx.camera,
    run: (ctx) => ctx.camera?.fitAll(),
  },
  {
    id: 'view.zoomIn',
    label: 'Zoom in',
    shortcut: `${Mod}+=`,
    group: 'view',
    enabled: (ctx) => !!ctx.camera,
    run: (ctx) => ctx.camera?.zoomIn(),
  },
  {
    id: 'view.zoomOut',
    label: 'Zoom out',
    shortcut: `${Mod}+-`,
    group: 'view',
    enabled: (ctx) => !!ctx.camera,
    run: (ctx) => ctx.camera?.zoomOut(),
  },
  {
    id: 'view.resetZoom',
    label: 'Reset zoom',
    group: 'view',
    enabled: (ctx) => !!ctx.camera,
    run: (ctx) => ctx.camera?.reset(),
  },

  // ----- Arrange (diagram only) ------------------------------------------
  {
    id: 'arrange.autoLayout',
    label: 'Auto-arrange',
    icon: ArrowsClockwise,
    group: 'arrange',
    when: inDiagram,
    run: () => diagramState.autoArrange(),
  },
]

let registered = false

/** Register the built-in action set once. Idempotent. */
export function registerBuiltinActions(): void {
  if (registered) return
  registered = true
  for (const a of builtinActions) defineAction(a)
}
