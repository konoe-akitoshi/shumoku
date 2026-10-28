// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import type * as input from '../input/model.js'
import type { Structure } from '../structure/types.js'
import type { Metrics } from './metrics.js'
import type { Scene } from './scene.js'

/**
 * Lays a network out as a scene: where each box stands and how each line runs. `network` is
 * the configuration as written, `structure` what follows from it and the boundary points, and
 * `metrics` every length the drawing may use.
 */
export function layoutDrawing(
  _network: input.Network,
  _structure: Structure,
  _metrics: Metrics,
): Scene {
  throw new Error('not implemented')
}
