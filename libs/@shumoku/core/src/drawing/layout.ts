// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import type * as input from '../input/model.js'
import type { NetworkModel } from '../models/network-model.js'
import type { Structure } from '../structure/types.js'
import { type Arrangement, arrangementOf, type OrderIntent, orderKeysOf } from './arrangement.js'
import { assemble } from './assemble.js'
import { type Corridors, corridorsOf } from './corridors.js'
import { diagonalsOf } from './diagonals.js'
import { type Placed, placeAll } from './geometry.js'
import { type Layers, layersOf } from './layers.js'
import type { Metrics } from './metrics.js'
import { needsOf } from './needs.js'
import { type Problem, readProblem } from './problem.js'
import { type Ranks, ranksOf } from './ranks.js'
import { type Routes, routesOf } from './routes.js'
import type { Scene } from './scene.js'
import { type Tracks, tracksOf } from './tracks.js'

/**
 * What a person says of the drawing that the network does not. `siblings` is the order, left to
 * right, of the children of a frame (`''` is the root), as `drawing.order` keeps it: each entry
 * is a node, a redundancy set (or one of its members), a segment, a routing domain or a child
 * group, by id. Only the children it names are held in that order, and those are not moved to cut
 * crossings; the rest are placed around them. A name the drawing has no child for is ignored;
 * one the structure places otherwise is reported in the arrangement's `unmet`.
 */
export interface DrawHints {
  siblings?: OrderIntent
}

/** What `layoutDrawing` may be given beside the configuration. */
export interface LayoutOptions {
  /** What the model says beyond the configuration (icons, speeds, labels), drawn with it. */
  layers?: Omit<NetworkModel, 'config'>
  hints?: DrawHints
}

/** What `layoutDrawing` settled on in each stage, to see why a drawing came out as it did. */
export interface Parts {
  scene: Scene
  /** The relative placement the stages settled on: frames, rows and order, by id. */
  arrangement: Arrangement
  problem: Problem
  ranks: Ranks
  layers: Layers
  corridors: Corridors
  routes: Routes
  tracks: Tracks
  placed: Placed
  /** Lines whose ends the structure does not relate, which place nothing. */
  unrelated: string[]
  /** Milliseconds each stage took. */
  timings: Record<string, number>
}

/**
 * Lays a network out as a scene: where each box stands and how each line runs. `network` is the
 * configuration as written, `structure` what follows from it and the boundary points, and
 * `metrics` every length the drawing may use.
 *
 * Every discrete choice is made from relations and indices before any coordinate, one stage after
 * another, and the coordinates are solved once for each axis at the end: the ranks (`ranksOf`)
 * from the flows, the left-to-right order of every rank (`layersOf`), the free space cut into
 * corridors (`corridorsOf`), each line's way through them (`routesOf`), the order of the lines
 * in each corridor (`tracksOf`), what the ports and corridors ask of the sizes (`needsOf`), and
 * the coordinates (`placeAll`). No stage reads a length to decide, so a font that measures a
 * little differently moves things a little and changes nothing else.
 */
export function layoutDrawing(
  network: input.Network,
  structure: Structure,
  metrics: Metrics,
  options: LayoutOptions = {},
): Scene {
  return layoutParts(network, structure, metrics, options).scene
}

export function layoutParts(
  network: input.Network,
  structure: Structure,
  metrics: Metrics,
  { layers: modelLayers, hints = {} }: LayoutOptions = {},
): Parts {
  const timings: Record<string, number> = {}
  const timed = <T>(name: string, run: () => T): T => {
    const start = performance.now()
    const out = run()
    timings[name] = Math.round(performance.now() - start)
    return out
  }
  const problem = timed('problem', () => readProblem(network, structure, metrics, modelLayers))
  const ranks = timed('ranks', () => ranksOf(problem))
  const layers = timed('layers', () =>
    layersOf(problem, ranks, { order: orderKeysOf(problem, hints.siblings).order }),
  )
  const arrangement = arrangementOf(problem, ranks, layers, hints.siblings)
  const corridors = timed('corridors', () => corridorsOf(problem, layers))
  const routes = timed('routes', () => routesOf(problem, layers, corridors))
  const tracks = timed('tracks', () => tracksOf(problem, layers, corridors, routes))
  const sized = timed('needs', () => needsOf(problem, tracks))
  const placed = timed('geometry', () => placeAll(sized, ranks, layers, corridors, tracks))
  const turns = timed('diagonals', () =>
    diagonalsOf(sized, placed.geometry, placed.wires, placed.ports),
  )
  const scene = assemble(
    sized,
    placed.geometry,
    { wires: placed.wires, ports: placed.ports, turns },
    layers.members,
  )
  return {
    scene,
    arrangement,
    problem: sized,
    ranks,
    layers,
    corridors,
    routes,
    tracks,
    placed,
    timings,
    unrelated: sized.lines.filter((l) => l.role === 'unrelated').map((l) => l.id),
  }
}
