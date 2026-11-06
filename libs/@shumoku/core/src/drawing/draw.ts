// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import type * as input from '../input/model.js'
import type { NetworkModel } from '../models/network-model.js'
import { deriveStages, structureOf } from '../structure/index.js'
import { withHostFrames } from './hosting.js'
import { type DrawHints, layoutDrawing } from './layout.js'
import type { Metrics } from './metrics.js'
import type { Scene } from './scene.js'
import { upstreamOf } from './upstream.js'

export interface DrawOptions {
  /**
   * What a person dragged siblings into (`siblings`), kept in the model's `drawing.order`: the
   * engine honours it where the drawing is free to choose.
   */
  hints?: DrawHints

  /**
   * The lengths the drawing works with, from the model being drawn (its display graph carries
   * the icons, speeds and labels the sizes follow from). The renderer's kit provides them.
   */
  metrics: (model: NetworkModel) => Metrics
}

/** Node types that stand for what lies beyond the network. */
const BEYOND = new Set(['external', 'cloud'])

/**
 * Where the network meets what lies beyond it, as ids the structure can measure from. The
 * drawing layer's own choice comes first; else the external or cloud nodes and the routing domains
 * that links reach, what the input itself says is outside; else the structure's candidates (where
 * the physical meets the virtual). A part of the
 * network that none of these reaches gets its own guess (`upstreamOf`), so it still has an up
 * and a down.
 */
export function boundaryOf(model: NetworkModel): string[] {
  const named = namedBoundaryOf(model)
  return [...named, ...upstreamOf(model.config, named)]
}

function namedBoundaryOf(model: NetworkModel): string[] {
  const chosen = model.drawing?.settings?.boundary
  if (chosen && chosen.length > 0) return [...chosen]
  const network = model.config
  // What the input says lies beyond the network is the top; only where it says nothing is the
  // structure asked where the physical meets the virtual.
  const outside = beyond(network)
  if (outside.length > 0) return outside
  const stages = deriveStages(network)
  const units = new Map(stages.units.units.map((u) => [u.id, u]))
  const candidates = stages.candidates.flatMap((ref) => {
    const at = ref.indexOf(':')
    const id = ref.slice(at + 1)
    if (ref.slice(0, at) !== 'unit') return [id]
    const member = units.get(id)?.members[0]
    return member === undefined ? [] : [member]
  })
  return candidates
}

function beyond(network: input.Network): string[] {
  const reached = new Set(
    network.links.flatMap((l) =>
      l.endpoints.flatMap((e) => ('routingDomain' in e ? [e.routingDomain] : [])),
    ),
  )
  return [
    ...network.nodes.filter((n) => n.type !== undefined && BEYOND.has(n.type)).map((n) => n.id),
    ...(network.routingDomains ?? []).filter((d) => reached.has(d.id)).map((d) => d.id),
  ]
}

/**
 * Draws a model as a scene: the one entry from what is written (and what the layers add) to
 * where each box stands and how each line runs. The model is the truth; the scene is only its
 * projection, made fresh each time.
 */
export function drawNetwork(model: NetworkModel, options: DrawOptions): Scene {
  const { config: written, ...layers } = model
  // Hosts are drawn as frames round their guests: the network drawn has those frames as places.
  const config = withHostFrames(written)
  const drawn = config === written ? model : { ...model, config }
  const stages = deriveStages(config, { boundary: boundaryOf(model) })
  return layoutDrawing(config, structureOf(stages), options.metrics(drawn), {
    layers,
    hints: options.hints,
  })
}
