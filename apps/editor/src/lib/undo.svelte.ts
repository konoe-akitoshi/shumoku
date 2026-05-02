// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

import type { Link, Node, Subgraph } from '@shumoku/core'
import type { Product, Scene } from './types'

/**
 * Snapshot of the project's persistent state — what export / load
 * round-trips through. Selection, camera, scene-authoring transients,
 * and derived fields (ports / edges / bounds) are intentionally out;
 * they're rebuilt from this on apply.
 */
export interface ProjectSnapshot {
  nodes: [string, Node][]
  subgraphs: [string, Subgraph][]
  links: Link[]
  products: Product[]
  scenes: Scene[]
}

interface UndoEntry {
  label: string
  snap: ProjectSnapshot
}

const MAX_HISTORY = 200

/**
 * Project-wide undo/redo via state snapshots. One stack per editor
 * session; covers every mutation made through `commit()`. Cheap to
 * implement and easy to reason about — the cost is memory, capped
 * at MAX_HISTORY × snapshot size.
 */
class UndoManager {
  past = $state<UndoEntry[]>([])
  future = $state<UndoEntry[]>([])

  /** True if there's an action to undo. */
  get canUndo(): boolean {
    return this.past.length > 0
  }
  get canRedo(): boolean {
    return this.future.length > 0
  }
  /** The label of the next undo target ("Add node", etc). */
  get undoLabel(): string | undefined {
    return this.past[this.past.length - 1]?.label
  }
  get redoLabel(): string | undefined {
    return this.future[this.future.length - 1]?.label
  }

  /**
   * Record `before` as the pre-mutation state, paired with the label
   * describing the action that's about to happen. Clears redo —
   * branching off a past state invalidates the previously-undone tail.
   */
  push(label: string, before: ProjectSnapshot): void {
    this.past = [...this.past, { label, snap: before }]
    if (this.past.length > MAX_HISTORY) {
      // drop oldest to bound memory
      this.past = this.past.slice(this.past.length - MAX_HISTORY)
    }
    this.future = []
  }

  /**
   * Pop the most recent past snapshot. Caller is responsible for
   * snapshotting the *current* state into the future stack so redo
   * can return to it.
   */
  undo(currentSnap: ProjectSnapshot): ProjectSnapshot | undefined {
    if (this.past.length === 0) return undefined
    const entry = this.past[this.past.length - 1]
    if (!entry) return undefined
    this.past = this.past.slice(0, -1)
    this.future = [...this.future, { label: entry.label, snap: currentSnap }]
    return entry.snap
  }

  /** Symmetric to `undo`. */
  redo(currentSnap: ProjectSnapshot): ProjectSnapshot | undefined {
    if (this.future.length === 0) return undefined
    const entry = this.future[this.future.length - 1]
    if (!entry) return undefined
    this.future = this.future.slice(0, -1)
    this.past = [...this.past, { label: entry.label, snap: currentSnap }]
    return entry.snap
  }

  reset(): void {
    this.past = []
    this.future = []
  }
}

export const undoManager = new UndoManager()
