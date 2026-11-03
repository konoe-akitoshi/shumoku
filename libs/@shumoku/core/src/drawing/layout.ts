// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import type * as input from '../input/model.js'
import type { NetworkModel } from '../models/network-model.js'
import type { Structure } from '../structure/types.js'
import { assemble } from './assemble.js'
import { type Corridors, corridorsOf } from './corridors.js'
import { diagonalsOf } from './diagonals.js'
import { type Placed, placeAll } from './geometry.js'
import { type Layers, layersOf } from './layers.js'
import type { Metrics } from './metrics.js'
import { needsOf } from './needs.js'
import { frameKey, type Problem, readProblem } from './problem.js'
import { type Ranks, ranksOf } from './ranks.js'
import { type Routes, routesOf } from './routes.js'
import type { Scene } from './scene.js'
import { type Tracks, tracksOf } from './tracks.js'

/**
 * What the reader says of the drawing that the network does not. `siblings` fixes the order, left
 * to right, of the children of a frame (`''` is the root): each entry is an item (a node or a
 * unit) or a child frame, by id. Children the structure leaves free stand in that order and are
 * not moved to cut crossings; the children it does not name are placed around them.
 */
export interface DrawHints {
  siblings?: Readonly<Record<string, readonly string[]>>
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
  const read = timed('problem', () => readProblem(network, structure, metrics, modelLayers))
  const ranks = timed('ranks', () => ranksOf(read))
  const layers = timed('layers', () => layersOf(read, ranks, { order: orderOf(read, hints) }))
  const corridors = timed('corridors', () => corridorsOf(read, layers))
  const routes = timed('routes', () => routesOf(read, layers, corridors))
  const tracks = timed('tracks', () => tracksOf(read, layers, corridors, routes))
  const problem = timed('needs', () => needsOf(read, tracks))
  const placed = timed('geometry', () =>
    placeAll(problem, ranks, layers, corridors, routes, tracks),
  )
  const turns = timed('diagonals', () =>
    diagonalsOf(problem, placed.geometry, placed.wires, placed.ports),
  )
  const scene = assemble(
    problem,
    placed.geometry,
    { wires: placed.wires, ports: placed.ports, turns },
    {
      siblings: new Map(layers.siblings as Map<string, string[]>),
      members: new Map(layers.members as Map<string, string[]>),
    },
  )
  return {
    scene,
    problem,
    ranks,
    layers,
    corridors,
    routes,
    tracks,
    placed,
    timings,
    unrelated: problem.lines.filter((l) => l.role === 'unrelated').map((l) => l.id),
  }
}

/** The siblings the reader ordered, by the keys the order stage knows them by. */
function orderOf(problem: Problem, hints: DrawHints): Map<string, string[]> {
  const out = new Map<string, string[]>()
  const owner = new Map<string, string>()
  for (const item of problem.items) {
    owner.set(item.id, item.id)
    for (const m of item.members ?? []) owner.set(m.node.id, item.id)
  }
  const parent = new Map(problem.frames.map((f) => [f.id, f.parent]))
  for (const [frame, names] of Object.entries(hints.siblings ?? {})) {
    const keys = names.flatMap((name) => {
      if (parent.get(name) === frame && name !== frame) return [frameKey(name)]
      const item = owner.get(name)
      return item === undefined ? [] : [item]
    })
    if (keys.length > 0) out.set(frame, [...new Set(keys)])
  }
  return out
}
