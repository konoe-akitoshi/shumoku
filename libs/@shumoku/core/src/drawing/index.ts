// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import type * as input from '../input/model.js'
import type { Structure } from '../structure/types.js'
import { type Placed, placeCoords } from './coords.js'
import { deriveElements, type ElementId, type Elements, elementIdOf } from './elements.js'
import { type Fans, layOutFans } from './fans.js'
import type { Metrics } from './metrics.js'
import { type Ordered, orderElements } from './order.js'
import { rankElements } from './ranks.js'
import { buildScene, type Scene } from './scene.js'

/** What each layer made, for whoever wants to look at the steps. */
export interface Layers {
  elements: Elements
  rank: Map<ElementId, number>
  /** The fans, and the elements the order and the coordinates work on. */
  fans: Fans
  ordered: Ordered
  placed: Placed
}

/** Runs layers 1 to 4, with the fans between the ranks and the order. */
export function layoutLayers(
  network: input.Network,
  structure: Structure,
  metrics: Metrics,
): Layers {
  const elements = deriveElements(network, structure, metrics)
  const rank = rankElements(elements, structure)
  const fans = layOutFans(elements, rank, metrics)
  const ordered = orderElements(fans.elements, fans.rank, {
    start: structure.boundary.map(elementIdOf),
  })
  const placed = placeCoords(fans.elements, ordered, metrics)
  return { elements, rank, fans, ordered, placed }
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
  const { elements, fans, ordered, placed } = layoutLayers(network, structure, metrics)
  return buildScene(network, elements, fans, ordered, placed)
}

export type { Frame, Interval, Placed } from './coords.js'
export type {
  Element,
  ElementId,
  Elements,
  GroupNode,
  Line,
  LineEnd,
  Part,
} from './elements.js'
export type { Fan, Fans } from './fans.js'
export type { Box, Insets, Metrics, Point, Size } from './metrics.js'
export type { Ordered, Slot } from './order.js'
export type { Scene } from './scene.js'
