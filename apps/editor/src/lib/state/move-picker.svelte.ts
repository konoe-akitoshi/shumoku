// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

// Reactive slot for the "Move to group" picker popover. The
// registry action (`node.move-to-group`) writes here; the diagram
// page reads `request` and mounts `MoveToGroupPicker.svelte`
// when it's set. Pattern mirrors `detail-panel.svelte.ts`.
//
// The action layer can't render its own UI — actions are pure
// command functions — so this state lives in the editor's state
// tree and the page handles presentation.

export interface MovePickerRequest {
  /** Node id to reparent. */
  nodeId: string
  /** Screen coords where the menu was triggered — popover anchors here. */
  x: number
  y: number
}

const slot = $state<{ request: MovePickerRequest | null }>({ request: null })

export const movePicker = {
  get request(): MovePickerRequest | null {
    return slot.request
  },
  get open(): boolean {
    return slot.request !== null
  },
  show(request: MovePickerRequest): void {
    slot.request = request
  },
  close(): void {
    slot.request = null
  },
}
