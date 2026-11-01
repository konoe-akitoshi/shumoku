// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { type Chord, type Chords, countCrossings, crossingsOf, place } from './order-chords.js'
import { type Corridors, infeasible, type Orders } from './order-classes.js'
import { type Paths, type Piece, passing } from './order-paths.js'
import { deriveGroup, firstSlot, type PortGrid, type Ports } from './order-ports.js'
import { parseLineEnd } from './problem.js'

/** A change to the orders: two lines next to each other at a door, swapped at every door they go through together. The ports follow, and are never changed alone. */
export interface Move {
  kind: 'door'
  door: number
  at: number
}

export interface Climb {
  tried: number
  accepted: number
  passes: number
  from: number
  to: number
}

/** What the last stage of the order does, on the orders and the ports it is given and then owns. */
export interface Climbing {
  moves(): Move[]
  /** Makes the change and counts only what it touches. Gives how to undo it, or nothing if it cannot be made. */
  apply(move: Move): (() => void) | undefined
  /** The crossings now, in the cells, as counted by the changes so far. */
  total(): number
  /** The same counted again from the orders alone. */
  recount(): number
  /** Makes the changes that cross less, for as long as there are some. */
  climb(): Climb
  /** What `climb` last did. */
  climbed(): Climb
}

const exchange = <T>(list: T[], i: number, k: number) => {
  const x = list[i] as T
  list[i] = list[k] as T
  list[k] = x
}

/** Whether a run has a door that the other has too. */
const shares = (x: Piece, y: Piece) => [...x.doors.keys()].some((d) => y.doors.has(d))

/**
 * The orders and the ports, changed together along the bundles they belong to. The `orders` and
 * `ports` are changed in place from here: they are the climb's own.
 */
export function climbOf(
  g: Paths,
  corridors: Corridors,
  chords: Chords,
  grid: PortGrid,
  orders: Orders,
  ports: Ports,
): Climbing {
  const { order, classList, pos } = orders
  const { pieces } = g
  const lineIndex = new Map(g.lines.map((p, i) => [p.path.line, i]))
  const chordOfPort = (key: string): Chord | undefined => {
    const { line, end } = parseLineEnd(key)
    const row = chords.rows[lineIndex.get(line) ?? -1]
    return end === 'a' ? row?.[0] : row?.at(-1)
  }
  /** The groups whose ports leave by a run, by the run's name. */
  const leavingBy = new Map<string, number[]>()
  for (const [gi, group] of grid.portGroups.entries()) {
    for (const key of group.keys) {
      const f = firstSlot(g, key)
      if (f)
        leavingBy.set(passing(f.path, f.j), [...(leavingBy.get(passing(f.path, f.j)) ?? []), gi])
    }
  }

  /**
   * The passings to swap to swap two next to each other at a door: those two, and, on along the
   * doors the two lines go through together, the same two lines' runs where they are also next to
   * each other, so that the pair stays one bundle and does not cross itself in between. A run is
   * one passing however many doors it goes through, so what comes after the pair is the next run.
   */
  const stretchOf = (
    door: number,
    i: number,
  ): { centre: [string, string]; along: [string, string][][] } | undefined => {
    const list = order.get(door)
    const x = list?.[i]
    const y = list?.[i + 1]
    if (x === undefined || y === undefined) return undefined
    const px = pieces.get(x)
    const py = pieces.get(y)
    const ja = px?.doors.get(door)
    const jb = py?.doors.get(door)
    const p = px ? g.lines[px.path]?.path : undefined
    const q = py ? g.lines[py.path]?.path : undefined
    if (!px || !py || !p || !q || ja === undefined || jb === undefined || px.path === py.path) {
      return undefined
    }
    const sq = p.cells[ja] === q.cells[jb] ? 1 : -1
    const along = [1, -1].map((dir) => {
      const out: [string, string][] = []
      let last: [string, string] = [x, y]
      for (let t = dir; ; t += dir) {
        const d = p.slots[ja + t]?.door
        if (d === undefined || d !== q.slots[jb + sq * t]?.door) break
        const a = passing(p, ja + t)
        const b = passing(q, jb + sq * t)
        if (a === last[0] && b === last[1]) continue
        last = [a, b]
        out.push(last)
      }
      return out
    })
    return { centre: [x, y], along }
  }
  const moves = (): Move[] => {
    const out: Move[] = []
    // two runs next to each other at several doors are one change, which is made at them all
    const seen = new Set<string>()
    for (const [door, list] of [...order].sort((p, q) => p[0] - q[0])) {
      for (const at of list.slice(1).keys()) {
        const key = `${list[at]}|${list[at + 1]}`
        if (seen.has(key)) continue
        seen.add(key)
        out.push({ kind: 'door', door, at })
      }
    }
    return out
  }

  let cellTotal = 0
  /**
   * Swaps two runs in the order of their corridor, and at every door they go through together,
   * where they must be next to each other. The corridor has one order, so the swap is made only if
   * nothing between the two in it has a door with either, which would be moved past; and only if
   * the rooms let each stand where it is put. Gives how to undo it, or nothing if it cannot be made.
   */
  const swapRuns = (a: string, b: string): (() => void) | undefined => {
    const pa = pieces.get(a)
    const pb = pieces.get(b)
    const ca = pa ? corridors.classOf(pa) : undefined
    if (!pa || !pb || ca === undefined || ca !== corridors.classOf(pb)) return undefined
    const list = classList.get(ca)
    const i = pos.get(a)
    const k = pos.get(b)
    if (!list || i === undefined || k === undefined) return undefined
    const shared = [...pa.doors.keys()].filter((d) => pb.doors.has(d))
    for (const d of shared) {
      const o = order.get(d)
      if (!o || Math.abs(o.indexOf(a) - o.indexOf(b)) !== 1) return undefined
    }
    const [lo, hi] = i < k ? [i, k] : [k, i]
    for (const id of list.slice(lo + 1, hi)) {
      const r = pieces.get(id)
      if (r && (shares(r, pa) || shares(r, pb))) return undefined
    }
    const [early, late] = i < k ? [pb, pa] : [pa, pb]
    if (infeasible(g, early, late)) return undefined
    const flip = () => {
      list[i] = b
      list[k] = a
      pos.set(a, k)
      pos.set(b, i)
      for (const d of shared) {
        const o = order.get(d)
        const x = o?.indexOf(a) ?? -1
        const y = o?.indexOf(b) ?? -1
        if (o && x >= 0 && y >= 0) exchange(o, x, y)
      }
    }
    flip()
    return () => {
      // the same swap again puts them back, with their places as they now are
      const x = list.indexOf(a)
      const y = list.indexOf(b)
      list[x] = b
      list[y] = a
      pos.set(a, y)
      pos.set(b, x)
      for (const d of shared) {
        const o = order.get(d)
        const u = o?.indexOf(a) ?? -1
        const v = o?.indexOf(b) ?? -1
        if (o && u >= 0 && v >= 0) exchange(o, u, v)
      }
    }
  }

  /**
   * Makes a change and counts only what it touches: a swap of two runs moves the chords of the two
   * lines in the cells on either side of every door they go through, a swap of ports one chord
   * each, and a chord crosses only chords of its own cell. Gives how to take the change back, or
   * nothing if it cannot be made.
   */
  const apply = (move: Move): (() => void) | undefined => {
    const stretch = stretchOf(move.door, move.at)
    if (!stretch) return undefined
    const touched = new Set<Chord>()
    const touch = (id: string) => {
      const piece = pieces.get(id)
      const row = piece ? chords.rows[piece.path] : undefined
      for (const j of piece?.slots ?? []) {
        for (const c of [row?.[j - 1], row?.[j]]) if (c) touched.add(c)
      }
    }
    const wanted = [stretch.centre, ...stretch.along.flat()]
    // the ports follow: those of the lines that leave by a run that is swapped are placed again
    const followed = new Set<number>()
    for (const [a, b] of wanted) {
      touch(a)
      touch(b)
      for (const gi of [...(leavingBy.get(a) ?? []), ...(leavingBy.get(b) ?? [])]) followed.add(gi)
    }
    const followers = [...followed].flatMap((gi) => grid.portGroups[gi]?.keys ?? [])
    for (const key of followers) {
      const c = chordOfPort(key)
      if (c) touched.add(c)
    }
    if (touched.size === 0) return undefined
    const was = cellTotal
    const old = [...touched].map((c) => [c, c.p, c.q] as const)
    const oldPorts = followers.map((key) => [key, ports.pos.get(key)] as const)
    const oldUnfit = followers.filter((key) => ports.unfit.has(key))
    const before = crossingsOf(chords, touched)
    const undone: (() => void)[] = []
    const swap = (a: string, b: string) => {
      const undo = swapRuns(a, b)
      if (undo) undone.push(undo)
      return undo !== undefined
    }
    const made = swap(...stretch.centre)
    // each way on from the pair goes as far as the swaps can be made
    if (made) for (const way of stretch.along) for (const [a, b] of way) if (!swap(a, b)) break
    if (!made) {
      for (const undo of undone.reverse()) undo()
      return undefined
    }
    for (const gi of followed) {
      const group = grid.portGroups[gi]
      if (group) deriveGroup(g, grid, order, ports, group)
    }
    for (const c of touched) place(g, ports.pos, order, c)
    cellTotal += crossingsOf(chords, touched) - before
    return () => {
      for (const undo of undone.reverse()) undo()
      for (const [key, v] of oldPorts) {
        if (v === undefined) ports.pos.delete(key)
        else ports.pos.set(key, v)
      }
      for (const key of followers) ports.unfit.delete(key)
      for (const key of oldUnfit) ports.unfit.add(key)
      for (const [c, p, q] of old) {
        c.p = p
        c.q = q
      }
      cellTotal = was
    }
  }

  const recount = () => countCrossings(g, ports.pos, order, chords).total
  const total = () => cellTotal
  let climbed: Climb = { tried: 0, accepted: 0, passes: 0, from: 0, to: 0 }
  return {
    moves,
    apply,
    total,
    recount,
    climbed: () => climbed,
    climb() {
      // the lists are the session's own from here, as they are changed in place
      for (const [door, list] of order) order.set(door, [...list])
      for (const [root, list] of classList) classList.set(root, [...list])
      cellTotal = recount()
      const from = total()
      let tried = 0
      let accepted = 0
      let passes = 0
      let better = true
      while (better) {
        better = false
        passes++
        for (const move of moves()) {
          const was = total()
          const undo = apply(move)
          if (!undo) continue
          tried++
          if (total() < was) {
            accepted++
            better = true
          } else {
            undo()
          }
        }
      }
      climbed = { tried, accepted, passes, from, to: total() }
      return climbed
    },
  }
}
