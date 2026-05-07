// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

// Action / command pattern. UI surfaces (right-click context menu,
// keyboard shortcuts, toolbar buttons, future Cmd+K palette) all
// consume the same registry instead of each duplicating the
// "what does Delete do here?" wiring.
//
// An Action is metadata + a `run` function. Surfaces ask the
// registry for actions matching a given context, render whatever
// fits their affordance (icon button vs menu item vs keystroke
// match), and call `run(ctx)` when the user picks one.

import type { NodeShape, NodeSpec } from '@shumoku/core'
import type { Component } from 'svelte'

/** Where the user invoked the action. Drives `when` / `enabled`. */
export interface ActionContext {
  /** Which canvas is active. */
  mode: 'diagram' | 'scene'
  /**
   * Snapshot of the current selection (ids + element types). Empty
   * arrays when nothing is selected.
   */
  selection: {
    ids: string[]
    types: ('node' | 'subgraph' | 'edge' | 'link' | 'port')[]
  }
  /**
   * Canvas-space *screen* coordinates where the action was invoked,
   * when applicable (right-click position for "paste here", etc.).
   * `undefined` for keyboard / toolbar / palette invocations —
   * `RendererHandle.viewportCenter()` is a sensible fallback.
   */
  canvasPos?: { x: number; y: number }
  /**
   * Camera handle exposed by whichever canvas is active. Diagram
   * supplies `attachCamera`'s API; scene supplies a Svelte Flow
   * adapter. Optional — actions that need it should use `enabled`
   * to gate themselves.
   */
  camera?: CameraHandle
  /**
   * Renderer handle for copy / paste / duplicate that need to call
   * into the ShumokuRenderer instance (only diagram view supplies
   * this; scene actions go through the SceneCanvas store).
   */
  renderer?: RendererHandle
}

/** Subset of the diagram camera (and Svelte Flow's useSvelteFlow) shared by both canvases. */
export interface CameraHandle {
  fitAll(): void
  zoomIn(): void
  zoomOut(): void
  reset(): void
}

/** Diagram renderer methods callable by Action `run` functions. */
export interface RendererHandle {
  /** Snapshot a node / subgraph's display info for the clipboard. */
  getElementInfo(id: string): {
    kind: 'node' | 'subgraph'
    label: string | string[]
    shape?: NodeShape
    spec?: NodeSpec
  } | null
  /** Convert a screen-space (clientX/Y) point to SVG-space coords. */
  screenToSvg(clientX: number, clientY: number): { x: number; y: number } | undefined
  /** Add a new node at the given SVG-space position. */
  addNewNode(init: {
    id: string
    label?: string
    shape?: NodeShape
    spec?: NodeSpec
    position?: { x: number; y: number }
  }): void
  addNewSubgraph(init: { id: string; label?: string; position?: { x: number; y: number } }): void
  /** Center of the visible canvas in SVG-space — fallback for keyboard paste. */
  viewportCenter(): { x: number; y: number } | undefined
}

/** Visual grouping in a context menu / palette. */
export type ActionGroup = 'edit' | 'view' | 'arrange' | 'misc'

export interface Action {
  /** Stable id, dot-namespaced (`edit.undo`, `view.fitAll`). */
  id: string
  /** Human label for menu / palette entries. */
  label: string
  /**
   * Keyboard shortcut, simplified syntax: `Mod+Z` (Mod = Cmd on
   * macOS, Ctrl elsewhere). Display only for v1 — actual key
   * dispatch lands in PR-2.
   */
  shortcut?: string
  /** Icon component (Phosphor Svelte) — optional. */
  icon?: Component
  /** Group for menu sectioning. Defaults to `misc`. */
  group?: ActionGroup
  /**
   * Hide the action when this returns false. Use for mode-specific
   * (`mode === 'diagram'`) or selection-specific actions.
   */
  when?: (ctx: ActionContext) => boolean
  /**
   * Render the action but disabled when this returns false. Use
   * for "available but not actionable right now" cases (e.g.
   * Delete with empty selection).
   */
  enabled?: (ctx: ActionContext) => boolean
  /** Side-effecting work — calls into editor state or camera. */
  run: (ctx: ActionContext) => void | Promise<void>
}
