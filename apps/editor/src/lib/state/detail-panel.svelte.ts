// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

// Global slot for the right-side Detail panel target. Lifted out
// of each canvas page so registry actions (`ui.openDetails`) can
// open the panel without each page having to register a callback.
//
// Edge / port resolution to their owning Node / Link still lives
// in the page's `openDetail` helper because it needs the page's
// state stores.

export type DetailTargetType = 'node' | 'link' | 'subgraph'

export interface DetailTarget {
  id: string
  type: DetailTargetType
}

const slot = $state<{ target: DetailTarget | null }>({ target: null })

export const detailPanel = {
  get target(): DetailTarget | null {
    return slot.target
  },
  get open(): boolean {
    return slot.target !== null
  },
  show(target: DetailTarget): void {
    slot.target = target
  },
  close(): void {
    slot.target = null
  },
}
