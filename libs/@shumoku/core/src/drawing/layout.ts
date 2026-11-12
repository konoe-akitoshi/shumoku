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
import { type Fold, foldsOf } from './fold.js'
import { type Placed, placeAll } from './geometry.js'
import { type Layers, layersOf } from './layers.js'
import type { Metrics } from './metrics.js'
import { needsOf } from './needs.js'
import {
  composeArrangement,
  composeScene,
  interfaceOf,
  localProblemOf,
  type Nested,
  nestFrames,
  portalSidesOf,
  sizeFrames,
} from './nest.js'
import { type FrameId, type Problem, ROOT, readProblem } from './problem.js'
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
  /** The groups solved on their own, by group; `problem` is then the parent's. */
  children?: ReadonlyMap<FrameId, Parts>
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
  const problem = timed('problem', () => readProblem(network, structure, metrics, modelLayers))
  return layoutNested(problem, hints.siblings, timings, timed)
}

/** The ranks of a problem, with the rows of its wide fans settled. */
interface Settled {
  order: Map<FrameId, string[]>
  folds: Fold
  ranks: Ranks
}

function rankStage(problem: Problem, intent: OrderIntent | undefined, timed: Clock): Settled {
  const { order } = orderKeysOf(problem, intent)
  // the ranks the flows give, then again with the rows a wide fan folds into as floors
  let folds: Fold = { rank: new Map(), under: new Map(), fans: [] }
  const ranks = timed('ranks', () => {
    const flat = ranksOf(problem)
    folds = foldsOf(problem, flat, order)
    const folded =
      folds.rank.size === 0 ? flat : ranksOf(problem, { rank: folds.rank, fans: folds.fans })
    // the portals of a group's bottom edge stand in a row of their own below all it holds
    const bottom = new Set(
      problem.items.flatMap((i) => (i.kind === 'portal' && i.side === 'bottom' ? [i.id] : [])),
    )
    if (bottom.size === 0) return folded
    const last = Math.max(0, ...[...folded.rank].flatMap(([id, r]) => (bottom.has(id) ? [] : [r])))
    const floors = new Map([
      ...folds.rank,
      ...[...bottom].map((id): [string, number] => [id, last + 1]),
    ])
    return ranksOf(problem, { rank: floors, fans: folds.fans })
  })
  return { order, folds, ranks }
}

/** The stages for one flat problem, from the ranks to the scene. */
function layoutProblem(
  problem: Problem,
  intent: OrderIntent | undefined,
  timings: Record<string, number>,
  timed: Clock,
): Parts {
  return stagesFrom(problem, rankStage(problem, intent, timed), intent, timings, timed)
}

function stagesFrom(
  problem: Problem,
  { order, folds, ranks }: Settled,
  intent: OrderIntent | undefined,
  timings: Record<string, number>,
  timed: Clock,
): Parts {
  const layers = timed('layers', () => layersOf(problem, ranks, { order, under: folds.under }))
  const arrangement = arrangementOf(problem, ranks, layers, intent)
  const corridors = timed('corridors', () => corridorsOf(problem, layers))
  const routes = timed('routes', () => routesOf(problem, layers, corridors))
  const { tracks, sized, placed } = timed('geometry', () =>
    placeBending(problem, ranks, layers, corridors, routes),
  )
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

/** The order a person gave for the frames of a problem; `own` is for its root. */
function intentFor(
  siblings: OrderIntent | undefined,
  frames: Problem['frames'],
  own: readonly string[] | undefined,
): OrderIntent | undefined {
  const entries = frames.flatMap((f): [FrameId, readonly string[]][] => {
    const names = f.id === ROOT ? own : siblings?.[f.id]
    return names ? [[f.id, names]] : []
  })
  return entries.length > 0 ? Object.fromEntries(entries) : undefined
}

/**
 * Each group with no group in it is solved on its own first, from the rank relations the parent
 * settles (which edge each of its lines meets the group by), and stands in the parent as a box of
 * the size that came out, its ports where its lines were left. The parent is then solved with
 * those boxes, and the scenes are put together (`composeScene`). `siblings` is the order given
 * for the frames of `problem`.
 */
function layoutNested(
  problem: Problem,
  siblings: OrderIntent | undefined,
  timings: Record<string, number>,
  timed: Clock,
): Parts {
  const { outer, nested } = nestFrames(problem)
  const intent = intentFor(siblings, outer.frames, siblings?.[ROOT])
  if (nested.length === 0) return layoutProblem(problem, intent, timings, timed)
  const settled = rankStage(outer, intent, timed)
  const sides = portalSidesOf(outer, settled.ranks)
  const children = new Map<FrameId, { group: Nested; local: Problem; parts: Parts }>()
  timed('groups', () => {
    for (const group of nested) {
      const local = localProblemOf(problem, group, sides)
      const own: Record<string, number> = {}
      const given = intentFor(siblings, local.frames, siblings?.[group.frame.id])
      const parts = layoutProblem(local, given, own, clockOf(own))
      children.set(group.frame.id, { group, local, parts })
    }
  })
  const interfaces = new Map(
    [...children].map(([id, c]) => [id, interfaceOf(c.group, c.local, c.parts.scene)]),
  )
  const parts = stagesFrom(sizeFrames(outer, interfaces), settled, intent, timings, timed)
  const composed = composeScene(
    problem,
    parts,
    new Map(
      [...children].map(([id, c]) => [id, { leaf: c.group, local: c.local, scene: c.parts.scene }]),
    ),
  )
  const arrangement = composeArrangement(
    parts.arrangement,
    new Map([...children].map(([id, c]) => [id, c.parts.arrangement])),
  )
  return {
    ...parts,
    scene: composed,
    arrangement,
    children: new Map([...children].map(([id, c]) => [id, c.parts])),
  }
}

/** How many times the coordinates are solved again with more lines bent, at most. */
const BEND_ATTEMPTS = 8

/**
 * The order of the lines (`tracksOf`), the sizes it asks for (`needsOf`) and the coordinates
 * (`placeAll`). A line laid straight across between two boxes side by side holds both its ends at
 * one height; where the ports of a side, the boxes held level and those heights leave no
 * solution, the lines whose ports close the ring are bent instead (they turn in the column
 * between) and the coordinates solved again. Every other line stays as it was.
 */
function placeBending(
  problem: Problem,
  ranks: Ranks,
  layers: Layers,
  corridors: Corridors,
  routes: Routes,
  bent: ReadonlySet<string> = new Set(),
  attempt = 0,
): { tracks: Tracks; sized: Problem; placed: Placed } {
  const tracks = tracksOf(problem, layers, corridors, routes, { bent })
  const sized = needsOf(problem, tracks)
  try {
    return { tracks, sized, placed: placeAll(sized, ranks, layers, corridors, tracks) }
  } catch (e) {
    if (!(e instanceof CycleError) || attempt >= BEND_ATTEMPTS) throw e
    const more = new Set(bent)
    const ports = new Map([...tracks.entities.values()].map((p) => [String(p.id), p]))
    for (const name of e.unknowns) {
      const port = /^[xy] p:(.*)$/.exec(name)?.[1]
      for (const end of (port === undefined ? undefined : ports.get(port))?.ends ?? [])
        more.add(end.line)
    }
    if (more.size === bent.size) throw e
    return placeBending(problem, ranks, layers, corridors, routes, more, attempt + 1)
  }
}
