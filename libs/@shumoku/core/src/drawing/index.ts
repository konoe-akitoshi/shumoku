// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import type * as input from '../input/model.js'
import type { Structure } from '../structure/types.js'
import { type Placed, placeCoords } from './coords.js'
import { deriveElements, type ElementId, type Elements, elementIdOf } from './elements.js'
import type { Metrics } from './metrics.js'
import { type Ordered, orderElements } from './order.js'
import { rankElements } from './ranks.js'
import { buildScene, type Scene } from './scene.js'

/** What each layer made, for whoever wants to look at the steps. */
export interface Layers {
  elements: Elements
  rank: Map<ElementId, number>
  ordered: Ordered
  placed: Placed
}

/** Runs layers 1 to 4. */
export function layoutLayers(
  network: input.Network,
  structure: Structure,
  metrics: Metrics,
): Layers {
  const elements = deriveElements(network, structure, metrics)
  const rank = rankElements(elements, structure)
  const ordered = orderElements(elements, rank, { start: structure.boundary.map(elementIdOf) })
  const placed = placeCoords(elements, ordered, metrics)
  return { elements, rank, ordered, placed }
}

/**
 * Lays a network out in layers: what is drawn, in which rank, in which order, at which
 * coordinates, and the scene the renderer's kit draws. The structure is the one derived from the
 * same network; the metrics are the lengths the parts draw with.
 */
export function layoutDrawing(
  network: input.Network,
  structure: Structure,
  metrics: Metrics,
): Scene {
  const { elements, ordered, placed } = layoutLayers(network, structure, metrics)
  return buildScene(network, elements, ordered, placed)
}

export type { Placed } from './coords.js'
export type {
  Element,
  ElementId,
  Elements,
  GroupNode,
  Line,
  LineEnd,
  Part,
} from './elements.js'
export type { Box, Insets, Metrics, Point, Size } from './metrics.js'
export type { Ordered, Slot } from './order.js'
export type { Scene } from './scene.js'
