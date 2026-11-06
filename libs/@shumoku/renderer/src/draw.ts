// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * A model drawn as a scene with the kit's lengths. Free of the server-side renderer, so the
 * browser (editor, viewer) and the server bake share it.
 */

import { type DrawHints, type DrawingScene, drawNetwork, type NetworkModel } from '@shumoku/core'
import { drawingMetrics } from './kit/drawing-metrics.js'
import { createKit, type TextMetrics } from './kit/measure.js'
import type { Base } from './kit/tokens.js'

export interface DrawOptions {
  /** Body font size and base line width; every size follows from them. */
  base?: Partial<Base>
  /** Measures text; a deterministic estimate when absent, so every machine draws the same. */
  text?: TextMetrics
  /** Order hints from the person's drags, which the engine honours where it is free to choose. */
  hints?: DrawHints
}

/** Draws a model as a scene, with the lengths of the kit these options describe. */
export function drawNetworkScene(model: NetworkModel, options: DrawOptions = {}): DrawingScene {
  const kit = createKit(options.base, options.text)
  return drawNetwork(model, {
    metrics: (m) => drawingMetrics(kit, m),
    ...(options.hints ? { hints: options.hints } : {}),
  })
}
