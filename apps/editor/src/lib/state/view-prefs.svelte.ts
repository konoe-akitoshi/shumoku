// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

import type { WheelBehavior } from '@shumoku/renderer'

/**
 * How the diagram is moved, a preference of this browser rather than of a project: what a plain
 * wheel does (`auto` tells a mouse wheel, which zooms, from a trackpad, which pans).
 */

const KEY = 'shumoku.wheelBehavior'
const BEHAVIORS: readonly WheelBehavior[] = ['auto', 'zoom', 'pan']

function load(): WheelBehavior {
  try {
    const stored = localStorage.getItem(KEY)
    return BEHAVIORS.find((b) => b === stored) ?? 'auto'
  } catch {
    return 'auto'
  }
}

export const viewPrefs = $state({ wheelBehavior: load() })

export function setWheelBehavior(behavior: WheelBehavior) {
  viewPrefs.wheelBehavior = behavior
  try {
    localStorage.setItem(KEY, behavior)
  } catch {
    // no storage: this session only
  }
}
