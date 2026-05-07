// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

import type { NodeShape, NodeSpec } from '@shumoku/core'

// Editor clipboard for copy / paste of diagram elements. Lives in
// `state/` so it's accessible from Action `run` functions in
// `actions/builtin.ts` — previously the diagram page owned a
// local `clipboard` $state which made keyboard / palette
// invocations of copy/paste impossible.
//
// Only diagram-side elements (Node / Subgraph) for now. Scene
// uses a different model (placements + assets) and isn't covered.

export type ClipboardEntry = {
  label: string
  shape?: NodeShape
  spec?: NodeSpec
  productId?: string
  elementKind: 'node' | 'subgraph'
}

const slot = $state<{ entry: ClipboardEntry | null }>({ entry: null })

export const clipboard = {
  get entry(): ClipboardEntry | null {
    return slot.entry
  },
  get hasEntry(): boolean {
    return slot.entry !== null
  },
  set(entry: ClipboardEntry | null): void {
    slot.entry = entry
  },
  clear(): void {
    slot.entry = null
  },
}
