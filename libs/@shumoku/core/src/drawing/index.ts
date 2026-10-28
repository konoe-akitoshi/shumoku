// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import type * as input from '../input/model.js'
import type { Structure } from '../structure/types.js'
import { type Composition, composeLayout } from './compound.js'
import { deriveElements, type Elements } from './elements.js'
import type { Metrics } from './metrics.js'
import { buildScene, type Scene } from './scene.js'

/** What each layer made, for whoever wants to look at the steps. */
export interface Layers {
  elements: Elements
  composition: Composition
}

/** Runs the layers up to the groups' blocks. */
export function layoutLayers(
  network: input.Network,
  structure: Structure,
  metrics: Metrics,
): Layers {
  const elements = deriveElements(network, structure, metrics)
  const composition = composeLayout(elements, structure, metrics)
  return { elements, composition }
}

/**
 * Lays a network out in layers: what is drawn, and then, group by group from the
 * inside out, in which order and at which coordinates, and the scene the renderer's kit draws.
 * The structure is the one derived from the same network; the metrics are the lengths the
 * parts draw with.
 */
export function layoutDrawing(
  network: input.Network,
  structure: Structure,
  metrics: Metrics,
): Scene {
  const { elements, composition } = layoutLayers(network, structure, metrics)
  return buildScene(network, elements, composition)
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
