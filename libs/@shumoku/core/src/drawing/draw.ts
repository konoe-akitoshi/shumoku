// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import type * as input from '../input/model.js'
import type { NetworkModel } from '../models/network-model.js'
import { deriveStages, structureOf } from '../structure/index.js'
import { layoutDrawing } from './layout.js'
import type { Metrics } from './metrics.js'
import type { Scene } from './scene.js'

export interface DrawOptions {
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
 * drawing layer's own choice comes first; else the structure's candidates (where the physical
 * meets the virtual); else the external or cloud nodes and the routing domains.
 */
export function boundaryOf(model: NetworkModel): string[] {
  const chosen = model.drawing?.settings?.boundary
  if (chosen && chosen.length > 0) return chosen
  const network = model.config
  const stages = deriveStages(network)
  const units = new Map(stages.units.units.map((u) => [u.id, u]))
  const candidates = stages.candidates.flatMap((ref) => {
    const at = ref.indexOf(':')
    const id = ref.slice(at + 1)
    if (ref.slice(0, at) !== 'unit') return [id]
    const member = units.get(id)?.members[0]
    return member === undefined ? [] : [member]
  })
  if (candidates.length > 0) return candidates
  return beyond(network)
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
  const { config, ...layers } = model
  const stages = deriveStages(config, { boundary: boundaryOf(model) })
  return layoutDrawing(config, structureOf(stages), options.metrics(model), layers)
}
