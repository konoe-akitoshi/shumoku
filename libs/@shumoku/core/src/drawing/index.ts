// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import type * as input from '../input/model.js'
import type { Structure } from '../structure/types.js'
import { type Placed, placeCoords } from './coords.js'
import { deriveElements, type ElementId, type Elements, elementIdOf } from './elements.js'
import { type Fans, layOutFans, type Shape } from './fans.js'
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
  const start = structure.boundary.map(elementIdOf)
  const arrange = (fans: Fans) => {
    const ordered = orderElements(fans.elements, fans.rank, { start })
    return { ordered, placed: placeCoords(fans.elements, ordered, metrics) }
  }
  const fans = layOutFans(elements, rank, metrics, (folded) => {
    const { ordered, placed } = arrange(folded)
    return shapeOf(folded.elements, ordered, placed)
  })
  const { ordered, placed } = arrange(fans)
  return { elements, rank, fans, ordered, placed }
}

/** How wide and tall a placement came out, and how far across each rank spreads. */
function shapeOf(elements: Elements, ordered: Ordered, placed: Placed): Shape {
  const sizes = new Map(elements.elements.map((e) => [e.id, e.size]))
  const across = new Map<number, number>()
  let left = Number.POSITIVE_INFINITY
  let right = Number.NEGATIVE_INFINITY
  let top = Number.POSITIVE_INFINITY
  let bottom = Number.NEGATIVE_INFINITY
  for (const [layer, slots] of ordered.layers.entries()) {
    const y = placed.y[layer] ?? 0
    let low = Number.POSITIVE_INFINITY
    let high = Number.NEGATIVE_INFINITY
    for (const slot of slots) {
      const size = sizes.get(slot.id)
      if (!size) continue
      const x = placed.x.get(slot.id) ?? 0
      low = Math.min(low, x - size.width / 2)
      high = Math.max(high, x + size.width / 2)
      top = Math.min(top, y - size.height / 2)
      bottom = Math.max(bottom, y + size.height / 2)
    }
    across.set(ordered.ranks[layer] ?? 0, Math.max(0, high - low))
    left = Math.min(left, low)
    right = Math.max(right, high)
  }
  for (const frame of placed.frames.values()) {
    left = Math.min(left, frame.x)
    right = Math.max(right, frame.x + frame.width)
    top = Math.min(top, frame.y)
    bottom = Math.max(bottom, frame.y + frame.height)
  }
  return { width: Math.max(0, right - left), height: Math.max(0, bottom - top), across }
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
export type { Fan, Fans } from './fans.js'
export type { Box, Insets, Metrics, Point, Size } from './metrics.js'
export type { Ordered, Slot } from './order.js'
export type { Scene } from './scene.js'
