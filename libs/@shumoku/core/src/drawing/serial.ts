// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import type * as input from '../input/model.js'
import type { Structure } from '../structure/types.js'
import { assemble } from './assemble.js'
import { type Corridors, corridorsOf } from './corridors.js'
import { diagonalsOf } from './diagonals.js'
import { type Placed, placeAll } from './geometry.js'
import { type Layers, layersOf } from './layers.js'
import type { Metrics } from './metrics.js'
import { needsOf } from './needs.js'
import { type Problem, readProblem } from './problem.js'
import { type Hints, type Ranks, ranksOf } from './ranks.js'
import { type Routes, routesOf } from './routes.js'
import type { Scene } from './scene.js'
import { type Tracks, tracksOf } from './tracks.js'

export interface SerialParts {
  scene: Scene
  problem: Problem
  ranks: Ranks
  layers: Layers
  corridors: Corridors
  routes: Routes
  tracks: Tracks
  placed: Placed
  unrelated: string[]
  /** Milliseconds each stage took. */
  timings: Record<string, number>
}

export function layoutSerial(
  network: input.Network,
  structure: Structure,
  metrics: Metrics,
  hints: Hints = {},
): SerialParts {
  const timings: Record<string, number> = {}
  const timed = <T>(name: string, run: () => T): T => {
    const start = performance.now()
    const out = run()
    timings[name] = Math.round(performance.now() - start)
    return out
  }
  const read = timed('problem', () => readProblem(network, structure, metrics))
  const ranks = timed('ranks', () => ranksOf(read, hints))
  const layers = timed('layers', () => layersOf(read, ranks, hints))
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
    { wires: placed.wires, ports: placed.ports, demands: [], violations: [], turns },
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
