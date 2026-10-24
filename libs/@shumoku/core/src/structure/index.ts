// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import type * as input from '../input/model.js'
import { analysisGraph } from './analysis-graph.js'
import { decompose } from './decompose.js'
import { derivePartTree } from './parts.js'
import { deriveShapes } from './shapes.js'
import { findTwins } from './twins.js'
import type { Structure } from './types.js'
import { deriveUnits } from './units.js'

/**
 * The structure a written network implies. A network is the `config` of a read model
 * (`readNetworkModel(yaml).config`); the result refers to it by its written ids.
 */
export function deriveStructure(network: input.Network): Structure {
  const analysis = analysisGraph(network)
  const units = deriveUnits(network)
  const decomposition = decompose(analysis, units)
  const twins = findTwins(decomposition)
  const parts = derivePartTree(network, analysis, units, decomposition, twins)
  const shapes = deriveShapes(decomposition, parts)
  return { analysis, units, decomposition, twins, parts, shapes }
}

export { analysisGraph } from './analysis-graph.js'
export { decompose } from './decompose.js'
export { setKey } from './keys.js'
export { derivePartTree } from './parts.js'
export { canonicalForm, deriveShapes, SHAPE_LIMIT } from './shapes.js'
export { findTwins } from './twins.js'
export type * from './types.js'
export { deriveUnits } from './units.js'
