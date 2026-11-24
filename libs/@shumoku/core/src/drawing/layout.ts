// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import type * as input from '../input/model.js'
import type { NetworkModel } from '../models/network-model.js'
import type { Structure } from '../structure/types.js'
import { type Arrangement, arrangementOf, type OrderIntent, orderKeysOf } from './arrangement.js'
import { assemble } from './assemble.js'
import { CycleError } from './axis.js'
import { type Corridors, corridorsOf } from './corridors.js'
import { diagonalsOf } from './diagonals.js'
import { foldsOf } from './fold.js'
import { type Placed, placeAll } from './geometry.js'
import { varKey } from './keys.js'
import { type Layers, layersOf } from './layers.js'
import { heldLevels, levelClasses } from './level.js'
import type { Metrics } from './metrics.js'
import { InvariantError, must } from './must.js'
import { needsOf } from './needs.js'
import { type Problem, readProblem } from './problem.js'
import { type Ranks, ranksOf } from './ranks.js'
import { type Routes, routesOf } from './routes.js'
import type { DrawingIssue, Scene } from './scene.js'
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

type Clock = <T>(name: string, run: () => T) => T

function clockOf(timings: Record<string, number>): Clock {
  return (name, run) => {
    const start = performance.now()
    const out = run()
    timings[name] = Math.round(performance.now() - start)
    return out
  }
}

export function layoutParts(
  network: input.Network,
  structure: Structure,
  metrics: Metrics,
  { layers: modelLayers, hints = {} }: LayoutOptions = {},
): Parts {
  const timings: Record<string, number> = {}
  const timed = clockOf(timings)
  const intent = hints.siblings
  const problem = timed('problem', () => readProblem(network, structure, metrics, modelLayers))
  const { order } = orderKeysOf(problem, intent)
  // the ranks the flows give, then again with the rows a wide fan folds into as floors
  const { ranks, folds } = timed('ranks', () => {
    const flat = ranksOf(problem)
    const folds = foldsOf(problem, flat, order)
    const ranks =
      folds.rank.size === 0 ? flat : ranksOf(problem, { rank: folds.rank, fans: folds.fans })
    return { ranks, folds }
  })
  const layers = timed('layers', () => layersOf(problem, ranks, { order, under: folds.under }))
  const arrangement = arrangementOf(problem, ranks, layers, intent)
  const corridors = timed('corridors', () => corridorsOf(problem, layers))
  const walked = timed('routes', () => routesOf(problem, layers, corridors))
  const { tracks, sized, placed, routes } = timed('geometry', () =>
    placeBending(problem, ranks, layers, corridors, walked),
  )
  const turns = timed('diagonals', () =>
    diagonalsOf(sized, placed.geometry, placed.wires, placed.ports),
  )
  const assembled = assemble(
    sized,
    placed.geometry,
    { wires: placed.wires, ports: placed.ports, turns },
    layers.members,
  )
  const linkOf = new Map(problem.lines.map((l) => [l.id, l.link]))
  const issues: DrawingIssue[] = [
    ...routes.unrouted.map((id) => ({
      code: 'no-route' as const,
      link: must(linkOf, id, 'link of line'),
    })),
    ...routes.cyclic.map((id) => ({
      code: 'constraint-cycle' as const,
      link: must(linkOf, id, 'link of line'),
    })),
  ]
  const scene = issues.length > 0 ? { ...assembled, issues } : assembled
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

/** How many times the coordinates are solved again, letting levels go or bending lines, at most. */
const BEND_ATTEMPTS = 8

/**
 * The order of the lines (`tracksOf`), the sizes it asks for (`needsOf`) and the coordinates
 * (`placeAll`). A line laid straight across between two boxes side by side holds both its ends at
 * one height, and the items the structure puts level hold their middles at one height. Where the
 * ports of a side and those heights leave no solution, the class of level items the ring's straight
 * lines run within is let go first (`loose`, see `heldLevels`): its straight lines hold it level,
 * at the heights their ports ask for. Only where that is not enough are the lines whose ports close
 * the ring bent instead (they turn in the column between), and where a bundle of bent lines cannot
 * stand the way its ports suggest, it is turned the other way (`flipped`). The coordinates are
 * solved again after each; every other box and line stays as it was.
 */
function placeBending(
  problem: Problem,
  ranks: Ranks,
  layers: Layers,
  corridors: Corridors,
  routes: Routes,
  bent: ReadonlySet<string> = new Set(),
  loose: ReadonlySet<string> = new Set(),
  flipped: ReadonlySet<string> = new Set(),
  attempt = 0,
): { tracks: Tracks; sized: Problem; placed: Placed; routes: Routes } {
  const tracks = tracksOf(problem, layers, corridors, routes, { bent, flipped })
  const sized = needsOf(problem, tracks)
  const straight = sized.lines.flatMap((l): [string, string][] =>
    tracks.across.has(l.id) ? [[l.a.item, l.b.item]] : [],
  )
  const held =
    loose.size === 0 ? sized : { ...sized, level: heldLevels(sized.level, straight, loose) }
  try {
    return { tracks, sized, placed: placeAll(held, ranks, layers, corridors, tracks), routes }
  } catch (e) {
    if (!(e instanceof CycleError)) throw e
    // the lines the ring runs through: those whose chains hold its unknowns, ports and lanes alike
    // (an unknown is named for its axis and then its coordinate, `x p:...` or `y l:...`)
    const linesOfVar = new Map<string, string[]>()
    for (const [line, chain] of tracks.chains)
      for (const v of chain) linesOfVar.set(varKey(v), [...(linesOfVar.get(varKey(v)) ?? []), line])
    const lines = new Set(e.unknowns.flatMap((name) => linesOfVar.get(name.slice(2)) ?? []))
    const again = (next: {
      routes?: Routes
      bent?: ReadonlySet<string>
      loose?: ReadonlySet<string>
      flipped?: ReadonlySet<string>
    }) =>
      placeBending(
        problem,
        ranks,
        layers,
        corridors,
        next.routes ?? routes,
        next.bent ?? bent,
        next.loose ?? loose,
        next.flipped ?? flipped,
        attempt + 1,
      )
    if (attempt < BEND_ATTEMPTS) {
      // first, the classes of level items the ring's straight lines run within
      const classOf = levelClasses(sized.level)
      const release = new Set(loose)
      for (const line of sized.lines) {
        if (!lines.has(line.id) || !tracks.across.has(line.id)) continue
        const c = classOf(line.a.item)
        if (c !== undefined && c === classOf(line.b.item)) release.add(c)
      }
      if (release.size > loose.size) return again({ loose: release })
      // then the lines themselves
      const more = new Set([...bent, ...lines])
      if (more.size > bent.size) return again({ bent: more })
      // then the bundles of bent lines turned the other way
      const turn = new Set(flipped)
      for (const [key, bundle] of tracks.bundles)
        if (!flipped.has(key) && bundle.lines.some((l) => lines.has(l.line))) turn.add(key)
      if (turn.size > flipped.size) return again({ flipped: turn })
    }
    // last, the ring's lines are left out and named, and the rest is drawn; a ring that no line
    // closes is the engine's own failure, not the input's
    const kept = new Map([...routes.routes].filter(([id]) => !lines.has(id)))
    if (kept.size === routes.routes.size)
      throw new InvariantError(`a ring of separations that no line closes: ${e.message}`)
    const left = [...routes.routes.keys()].filter((id) => !kept.has(id))
    return again({ routes: { ...routes, routes: kept, cyclic: [...routes.cyclic, ...left] } })
  }
}
