// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

import type { Link, Node, Subgraph, Termination } from '@shumoku/core'
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
  /** Physical cabling registry (EPS / Outlet / Panel). Captured here
   *  so undo / redo / persistence round-trip preserves them — they're
   *  not under `nodes` after the registry refactor. */
  terminations: Termination[]
  products: Product[]
  scenes: Scene[]
}

interface UndoEntry {
  label: string
  snap: ProjectSnapshot
}

const MAX_HISTORY = 200

let past = $state<UndoEntry[]>([])
let future = $state<UndoEntry[]>([])

/**
 * Project-wide undo/redo via state snapshots. One stack per editor
 * session; covers every mutation made through `commit()`. Module-level
 * $state (not class fields) so the runes preprocessor handles it
 * cleanly under SSR.
 */
export const undoManager = {
  get canUndo(): boolean {
    return past.length > 0
  },
  get canRedo(): boolean {
    return future.length > 0
  },
  get undoLabel(): string | undefined {
    return past[past.length - 1]?.label
  },
  get redoLabel(): string | undefined {
    return future[future.length - 1]?.label
  },

  /** Record `before` as the pre-mutation state; clears redo. */
  push(label: string, before: ProjectSnapshot): void {
    past = [...past, { label, snap: before }]
    if (past.length > MAX_HISTORY) past = past.slice(past.length - MAX_HISTORY)
    future = []
  },

  /** Pop the most recent past snapshot, parking `currentSnap` in redo. */
  undo(currentSnap: ProjectSnapshot): ProjectSnapshot | undefined {
    if (past.length === 0) return undefined
    const entry = past[past.length - 1]
    if (!entry) return undefined
    past = past.slice(0, -1)
    future = [...future, { label: entry.label, snap: currentSnap }]
    return entry.snap
  },

  redo(currentSnap: ProjectSnapshot): ProjectSnapshot | undefined {
    if (future.length === 0) return undefined
    const entry = future[future.length - 1]
    if (!entry) return undefined
    future = future.slice(0, -1)
    past = [...past, { label: entry.label, snap: currentSnap }]
    return entry.snap
  },

  reset(): void {
    past = []
    future = []
  },
}
