// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import type * as input from '../input/model.js'
import type { NetworkModel } from '../models/network-model.js'
import { deriveStages, structureOf } from '../structure/index.js'
import type { Arrangement } from './arrangement.js'
import { layoutParts } from './layout.js'
import type { Metrics } from './metrics.js'
import type { DrawingIssue, Scene } from './scene.js'
import { isBeyond } from './tiers.js'
import { upstreamOf } from './upstream.js'

export interface DrawOptions {
  /**
   * The lengths the drawing works with, from the model being drawn (its display graph carries
   * the icons, speeds and labels the sizes follow from). The renderer's kit provides them.
   */
  metrics: (model: NetworkModel) => Metrics
}

/** What drawing a model settles: the coordinates, and the relative placement they were solved from. */
export interface Drawing {
  scene: Scene
  arrangement: Arrangement
}

/**
 * Where the network meets what lies beyond it, as ids the structure can measure from. The
 * drawing layer's own choice comes first; else the external or cloud nodes and the routing domains
 * that links reach, what the input itself says is outside. A part of the network that none of
 * these reaches gets its own guess (`upstreamOf`), so it still has an up and a down.
 *
 * Where the physical meets the virtual (a node with both a cable and a virtual link) is not taken
 * as the top: a hypervisor with its VMs, a switch with a logical uplink and a router with a tunnel
 * all are, and taking every one of them put them all on the top row.
 */
export function boundaryOf(model: NetworkModel): string[] {
  const named = namedBoundaryOf(model)
  return [...named, ...upstreamOf(model.config, named)]
}

function namedBoundaryOf(model: NetworkModel): string[] {
  const { known } = boundaryNamed(model)
  if (known.length > 0) return known
  const network = model.config
  // What the input says lies beyond the network is the top.
  return beyond(network)
}

/**
 * The boundary the drawing layer names, split into the ids the structure can measure from (a
 * node, or a segment or routing domain on a line) and those it cannot, which are reported and
 * not measured from.
 */
function boundaryNamed(model: NetworkModel): { known: string[]; unknown: string[] } {
  const chosen = model.drawing?.settings?.boundary ?? []
  const network = model.config
  const onLines = new Set([
    ...network.nodes.map((n) => n.id),
    ...network.links.flatMap((l) =>
      l.endpoints.map((e) => ('node' in e ? e.node : 'segment' in e ? e.segment : e.routingDomain)),
    ),
  ])
  return {
    known: chosen.filter((id) => onLines.has(id)),
    unknown: chosen.filter((id) => !onLines.has(id)),
  }
}

function beyond(network: input.Network): string[] {
  const reached = new Set(
    network.links.flatMap((l) =>
      l.endpoints.flatMap((e) => ('routingDomain' in e ? [e.routingDomain] : [])),
    ),
  )
  return [
    ...network.nodes.filter((n) => isBeyond(n.type)).map((n) => n.id),
    ...(network.routingDomains ?? []).filter((d) => reached.has(d.id)).map((d) => d.id),
  ]
}

/**
 * Lays a model out: the one entry from what is written (and what the layers add) to where each
 * box stands and how each line runs, with the arrangement that was solved into those places. The
 * model is the truth; both are its projection, made fresh each time. The order a person put
 * siblings in (`drawing.order`) is read here, so every caller, the Editor and the Server alike,
 * draws the same model the same way.
 */
export function layoutNetwork(model: NetworkModel, options: DrawOptions): Drawing {
  const { config, ...layers } = model
  const stages = deriveStages(config, { boundary: boundaryOf(model) })
  const parts = layoutParts(config, structureOf(stages), options.metrics(model), {
    layers,
    hints: { siblings: model.drawing?.order },
  })
  const unknown = boundaryNamed(model).unknown.map(
    (id): DrawingIssue => ({ code: 'unknown-boundary', id }),
  )
  const issues = [...unknown, ...(parts.scene.issues ?? [])]
  const scene = issues.length > 0 ? { ...parts.scene, issues } : parts.scene
  return { scene, arrangement: parts.arrangement }
}

/** Draws a model as a scene: `layoutNetwork`, keeping the coordinates. */
export function drawNetwork(model: NetworkModel, options: DrawOptions): Scene {
  return layoutNetwork(model, options).scene
}
