// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * A scene as a standalone SVG string. It is `Diagram.svelte` rendered on the server, so the
 * static output and the interactive one are the same drawing.
 */

import type { Theme } from '@shumoku/core'
import { render } from 'svelte/server'
import Diagram from './Diagram.svelte'
import type { TextMetrics } from './measure'
import type { Scene } from './scene'
import type { Base } from './tokens'

export interface RenderSceneOptions {
  theme?: Theme
  /** Body font size and base line width; every size follows from them. */
  base?: Partial<Base>
  text?: TextMetrics
  /** How the mouths of bands are marked: a candidate letter, or nothing (B: the chamfer itself). */
  markStyle?: 'A' | 'B' | 'C' | 'D' | 'E'
}

export function renderScene(scene: Scene, options: RenderSceneOptions = {}): string {
  return render(Diagram, { props: { scene, ...options } }).body
}
