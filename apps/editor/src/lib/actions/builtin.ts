// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

import { newId } from '@shumoku/core'
import {
  ArrowsClockwise,
  ArrowUUpLeft,
  ArrowUUpRight,
  ClipboardText,
  Copy,
  CopySimple,
  Info,
  MagnifyingGlass,
  Trash,
} from 'phosphor-svelte'
import { diagramState } from '../context.svelte'
import { clipboard } from '../state/clipboard.svelte'
import { detailPanel } from '../state/detail-panel.svelte'
import { openPalette } from './palette.svelte'
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
    else if (it.type === 'subgraph') diagramState.removeSubgraph(it.id)
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
    id: 'edit.copy',
    label: 'Copy',
    shortcut: `${Mod}+C`,
    icon: Copy,
    group: 'edit',
    when: inDiagram,
    enabled: (ctx) =>
      !!ctx.renderer &&
      ctx.selection.ids.length === 1 &&
      (ctx.selection.types[0] === 'node' || ctx.selection.types[0] === 'subgraph'),
    run: (ctx) => {
      const id = ctx.selection.ids[0]
      if (!id || !ctx.renderer) return
      const info = ctx.renderer.getElementInfo(id)
      if (!info) return
      const productId = info.kind === 'node' ? diagramState.nodes.get(id)?.productId : undefined
      clipboard.set({
        label: Array.isArray(info.label) ? info.label.join(', ') : info.label,
        shape: info.kind === 'node' ? info.shape : undefined,
        spec: info.kind === 'node' ? info.spec : undefined,
        productId,
        elementKind: info.kind,
      })
    },
  },
  {
    id: 'edit.paste',
    label: 'Paste',
    shortcut: `${Mod}+V`,
    icon: ClipboardText,
    group: 'edit',
    when: inDiagram,
    enabled: (ctx) => !!ctx.renderer && clipboard.hasEntry,
    run: (ctx) => {
      const entry = clipboard.entry
      if (!entry || !ctx.renderer) return
      // SVG-space position: right-click ctx → screenToSvg, else viewport center.
      const pos = ctx.canvasPos
        ? ctx.renderer.screenToSvg(ctx.canvasPos.x, ctx.canvasPos.y)
        : ctx.renderer.viewportCenter()
      if (entry.elementKind === 'subgraph') {
        ctx.renderer.addNewSubgraph({ id: newId('sg'), label: entry.label, position: pos })
      } else {
        const pastedId = newId('node')
        ctx.renderer.addNewNode({
          id: pastedId,
          label: entry.label,
          spec: entry.spec,
          shape: entry.shape,
          position: pos,
        })
        if (entry.productId) diagramState.bindNodeToProduct(pastedId, entry.productId)
      }
    },
  },
  {
    id: 'edit.duplicate',
    label: 'Duplicate',
    shortcut: `${Mod}+D`,
    icon: CopySimple,
    group: 'edit',
    when: inDiagram,
    enabled: (ctx) =>
      !!ctx.renderer &&
      ctx.selection.ids.length === 1 &&
      (ctx.selection.types[0] === 'node' || ctx.selection.types[0] === 'subgraph'),
    run: (ctx) => {
      const id = ctx.selection.ids[0]
      if (!id || !ctx.renderer) return
      const info = ctx.renderer.getElementInfo(id)
      if (!info) return
      // Duplicate at a slight offset from the source so the copy is
      // visible without clicking.
      const productId = info.kind === 'node' ? diagramState.nodes.get(id)?.productId : undefined
      const label = Array.isArray(info.label) ? info.label.join(', ') : info.label
      if (info.kind === 'subgraph') {
        ctx.renderer.addNewSubgraph({ id: newId('sg'), label })
      } else {
        const dupId = newId('node')
        ctx.renderer.addNewNode({
          id: dupId,
          label,
          spec: info.spec,
          shape: info.shape,
        })
        if (productId) diagramState.bindNodeToProduct(dupId, productId)
      }
    },
  },
  {
    id: 'edit.delete',
    label: 'Delete',
    // Window-level handler — the renderer's local keydown listener
    // is attached to <svg>, which isn't focusable by default, so
    // Delete only fired when the user happened to have the SVG in
    // focus. Owning the shortcut here makes it work everywhere a
    // selection exists; the renderer no longer handles Delete to
    // avoid double-fire.
    shortcut: 'Del',
    shortcutHint: 'Del',
    icon: Trash,
    group: 'edit',
    enabled: hasSelection,
    run: deleteSelection,
  },
  {
    id: 'ui.openDetails',
    label: 'Information',
    icon: Info,
    group: 'misc',
    enabled: (ctx) => ctx.selection.ids.length === 1,
    run: (ctx) => {
      const id = ctx.selection.ids[0]
      const rawType = ctx.selection.types[0]
      if (!id) return
      // Edge / port resolution stays page-side because it needs the
      // editor's stores; the action only opens whatever it's given,
      // so the caller has to pre-resolve to a node / link / subgraph.
      const type =
        rawType === 'edge' || rawType === 'link'
          ? 'link'
          : rawType === 'subgraph'
            ? 'subgraph'
            : 'node'
      detailPanel.show({ id, type })
    },
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

  // ----- UI ---------------------------------------------------------------
  {
    id: 'ui.commandPalette',
    label: 'Command palette',
    shortcut: `${Mod}+K`,
    icon: MagnifyingGlass,
    group: 'misc',
    run: () => openPalette(),
  },
]

let registered = false

/** Register the built-in action set once. Idempotent. */
export function registerBuiltinActions(): void {
  if (registered) return
  registered = true
  for (const a of builtinActions) defineAction(a)
}
