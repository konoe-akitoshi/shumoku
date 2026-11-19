// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

import type { WheelChoice } from '@shumoku/renderer'

/**
 * How the diagram is moved, a preference of this browser rather than of a project: what a plain
 * wheel does, `pan` (scroll the view, the default) or `zoom`. Ctrl/⌘ + wheel and pinch zoom
 * either way.
 */

const KEY = 'shumoku.wheelBehavior'

function load(): WheelChoice {
  try {
    return localStorage.getItem(KEY) === 'zoom' ? 'zoom' : 'pan'
  } catch {
    return 'pan'
  }
}

export const viewPrefs = $state({ wheelBehavior: load() })

export function setWheelBehavior(behavior: WheelChoice) {
  viewPrefs.wheelBehavior = behavior
  try {
    localStorage.setItem(KEY, behavior)
  } catch {
    // no storage: this session only
  }
}
