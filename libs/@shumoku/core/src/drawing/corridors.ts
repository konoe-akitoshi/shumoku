// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import {
  type CellSlotKey,
  type ColumnSlotKey,
  cellSlotKey,
  columnKey,
  columnSlotKey,
  type DummyKey,
  dummyIn,
  frameIn,
  frameKey,
  hasDummy,
  type RowKey,
  rowKey,
  type SideKey,
  sideKey,
} from './keys.js'
import type { Layers } from './layers.js'
import { must } from './must.js'
import type { FrameId, ItemId, Problem } from './problem.js'
import type { Side } from './scene.js'

/**
 * The free space as a graph, with no coordinate in it. A frame has, between two ranks, a row
 * (a `cell`) that walls cut where a child frame reaches across the gap, and at each rank a
 * `column` between each two of its children (and at either end) where lines run up and down;
 * a box has a `side` node for each of its four edges. Cells and columns meet at doors; a line is
 * a walk through the doors, and what the walk is made of is all that later stages read.
 */

/** What stands next to a cell on one of its walls, or above or below it. */
export interface Block {
  /** The item (the unit, for a unit's members) or the `frameKey`. */
  key: string
  frame: boolean
  /** The stretch of the rank's slots (`Corridors.slots`) the block covers. */
  from: number
  to: number
}

export type CNode =
  | {
      kind: 'cell'
      frame: FrameId
      /** The gap below this rank; -1 is above rank 0. */
      gap: number
      interval: number
      /** Whether this is the row above what the frame holds, or below it: the frame's margin. */
      topMargin: boolean
      bottomMargin: boolean
      /** The stretch of slots of the rank above and of the rank below that the row spans. */
      above?: [number, number]
      below?: [number, number]
      /** The children of the frame, or items, that stand directly over / under the row. */
      over: Block[]
      under: Block[]
    }
  | { kind: 'column'; frame: FrameId; rank: number; slot: number }
  | { kind: 'side'; box: string; side: Side }

export interface Door {
  id: number
  a: number
  wallA: Side
  /** The place along the wall of `a`, in the slot numbers of the rank the wall faces. */
  posA: number
  b: number
  wallB: Side
  posB: number
  /** The edge of a frame the door crosses. */
  frameEdge?: { frame: FrameId; edge: Side }
}

/** One place in a rank's row of slots: a box or a column. */
export type Slot = { kind: 'box'; key: string; item: ItemId } | { kind: 'column'; node: number }

export interface Corridors {
  nodes: readonly CNode[]
  doors: readonly Door[]
  /** The doors of each node. */
  doorsOf: readonly (readonly number[])[]
  /** The column a dummy runs down. */
  columnOfDummy: ReadonlyMap<DummyKey, number>
  /** Each rank's row of boxes and columns, left to right. */
  slots: readonly (readonly Slot[])[]
  /** Where a box or a column node stands in its rank's slots. */
  slotOf: ReadonlyMap<string, number>
  /** The node of a box's edge. */
  sideOf(box: string, side: Side): number | undefined
  /** What stands on either side of a column: an item (the unit, for a unit's members) or a `frameKey`. */
  around: ReadonlyMap<number, { left?: string; right?: string }>
  /** The rank and frame of each box. */
  boxes: ReadonlyMap<string, { item: ItemId; frame: FrameId; rank: number }>
}

/** The other wall of a node's walls: opposite. */
export const opposite: Record<Side, Side> = {
  top: 'bottom',
  bottom: 'top',
  left: 'right',
  right: 'left',
}

export function corridorsOf(problem: Problem, layers: Layers): Corridors {
  const { ranks } = layers
  const items = new Map(problem.items.map((i) => [i.id, i]))
  const frameOfKey = new Map(problem.frames.map((f) => [frameKey(f.id), f.id]))
  const spanOf = (key: string) => must(ranks.span, key, 'span of item or frame')
  const frameSpan = (f: FrameId) => spanOf(frameKey(f))
  const reaches = (f: FrameId, r: number) => {
    const s = frameSpan(f)
    return s[0] <= r && r <= s[1]
  }
  const kidsOf = (f: FrameId): readonly string[] => must(layers.siblings, f, 'children of frame')
  const isDummy = (k: string) => hasDummy(layers.dummies, k)
  const rankOfItem = (k: string) => must(ranks.rank, k, 'rank of item')

  /** The children of a frame that stand in rank r, the dummies aside, in order. */
  const colKids = (f: FrameId, r: number): string[] =>
    kidsOf(f).filter((k) => {
      if (isDummy(k)) return false
      const inner = frameIn(frameOfKey, k)
      return inner !== undefined ? reaches(inner, r) : rankOfItem(k) === r
    })
  /** Whether a child frame reaches across the gap g (both ranks g and g+1). */
  const wall = (k: string, g: number) => {
    const inner = frameIn(frameOfKey, k)
    if (inner === undefined) return false
    const s = frameSpan(inner)
    return s[0] <= g && g + 1 <= s[1]
  }

  const nodes: CNode[] = []
  const doors: Door[] = []
  const add = (n: CNode) => nodes.push(n) - 1
  const door = (
    a: number,
    wallA: Side,
    posA: number,
    b: number,
    wallB: Side,
    posB: number,
    frameEdge?: Door['frameEdge'],
  ) => {
    doors.push({
      id: doors.length,
      a,
      wallA,
      posA,
      b,
      wallB,
      posB,
      ...(frameEdge && { frameEdge }),
    })
  }

  // ---- the slots of every rank, and the columns in them
  const slots: Slot[][] = Array.from({ length: ranks.max + 1 }, () => [])
  const slotOf = new Map<string, number>()
  const columns = new Map<ColumnSlotKey, number>()
  const colId = (f: FrameId, r: number, k: number) => columns.get(columnSlotKey(f, r, k))
  const first = new Map<RowKey, number>()
  const last = new Map<RowKey, number>()
  const boxes = new Map<string, { item: ItemId; frame: FrameId; rank: number }>()
  const columnOfDummy = new Map<DummyKey, number>()
  const around = new Map<number, { left?: string; right?: string }>()
  const visitFrame = (f: FrameId, r: number) => {
    if (!reaches(f, r)) return
    const row = slots[r] ?? []
    const kids = colKids(f, r)
    const put = (slot: Slot, key: string) => {
      slotOf.set(key, row.length)
      row.push(slot)
    }
    const column = (k: number) => {
      const id = add({ kind: 'column', frame: f, rank: r, slot: k })
      columns.set(columnSlotKey(f, r, k), id)
      const l = kids[k - 1]
      const rt = kids[k]
      around.set(id, {
        ...(l !== undefined && { left: l }),
        ...(rt !== undefined && { right: rt }),
      })
      put({ kind: 'column', node: id }, columnKey(id))
      return id
    }
    first.set(rowKey(f, r), row.length)
    column(0)
    for (const [j, k] of kids.entries()) {
      const inner = frameIn(frameOfKey, k)
      if (inner !== undefined) visitFrame(inner, r)
      else {
        const item = items.get(k)
        const keys =
          item?.kind === 'unit' ? [...must(layers.members, k, 'members of unit')] : item ? [k] : []
        for (const m of keys) {
          put({ kind: 'box', key: m, item: k }, m)
          boxes.set(m, { item: k, frame: f, rank: r })
        }
      }
      column(j + 1)
    }
    last.set(rowKey(f, r), row.length - 1)
  }
  for (let r = 0; r <= ranks.max; r++) visitFrame('', r)
  // the dummies run down the column they stand in
  for (const f of problem.frames) {
    for (let r = 0; r <= ranks.max; r++) {
      if (!reaches(f.id, r)) continue
      const kids = kidsOf(f.id)
      const solid = colKids(f.id, r)
      for (const [i, k] of kids.entries()) {
        const d = dummyIn(layers.dummies, k)
        if (!d || d.rank !== r) continue
        const before = kids.slice(0, i).filter((x) => solid.includes(x)).length
        const id = colId(f.id, r, before)
        if (id !== undefined) columnOfDummy.set(d.key, id)
      }
    }
  }

  // ---- the rows: a cell between each two ranks of a frame, cut by the children that reach across
  const cells = new Map<CellSlotKey, number>()
  const cellId = (f: FrameId, g: number, i: number) => cells.get(cellSlotKey(f, g, i))
  const slotRange = (f: FrameId, r: number): [number, number] | undefined => {
    const a = first.get(rowKey(f, r))
    const b = last.get(rowKey(f, r))
    return a === undefined || b === undefined ? undefined : [a, b]
  }
  const blockOf = (k: string, r: number): Block | undefined => {
    const inner = frameIn(frameOfKey, k)
    if (inner !== undefined) {
      const rg = slotRange(inner, r)
      return rg && { key: k, frame: true, from: rg[0], to: rg[1] }
    }
    const item = items.get(k)
    if (!item || rankOfItem(k) !== r) return undefined
    const keys = item.kind === 'unit' ? must(layers.members, k, 'members of unit') : [k]
    const at = keys.flatMap((m) => slotOf.get(m) ?? [])
    return at.length === 0
      ? undefined
      : { key: k, frame: false, from: Math.min(...at), to: Math.max(...at) }
  }
  for (const f of problem.frames) {
    const [lo, hi] = frameSpan(f.id)
    for (let g = lo - 1; g <= hi; g++) {
      const kids = kidsOf(f.id)
      const walls = kids.filter((k) => wall(k, g))
      const upper = slotRange(f.id, g)
      const lower = slotRange(f.id, g + 1)
      for (let i = 0; i <= walls.length; i++) {
        const before = walls[i - 1]
        const after = walls[i]
        const within = (rg: [number, number] | undefined, r: number) => {
          if (!rg) return undefined
          const lo_ =
            before === undefined ? rg[0] : (last.get(rowKey(frameOf(before), r)) ?? rg[0]) + 1
          const hi_ =
            after === undefined ? rg[1] : (first.get(rowKey(frameOf(after), r)) ?? rg[1]) - 1
          return [lo_, hi_] as [number, number]
        }
        const over: Block[] = []
        const under: Block[] = []
        let seen = 0
        for (const k of kids) {
          if (wall(k, g)) {
            seen++
            continue
          }
          if (seen !== i) continue
          const inner = frameIn(frameOfKey, k)
          if (inner !== undefined) {
            const s = frameSpan(inner)
            const ends = s[1] === g ? blockOf(k, g) : undefined
            const starts = s[0] === g + 1 ? blockOf(k, g + 1) : undefined
            if (ends) over.push(ends)
            if (starts) under.push(starts)
          } else if (!isDummy(k)) {
            const rk = rankOfItem(k)
            const b = rk === g ? blockOf(k, g) : rk === g + 1 ? blockOf(k, g + 1) : undefined
            if (b) (rk === g ? over : under).push(b)
          }
        }
        const id = add({
          kind: 'cell',
          frame: f.id,
          gap: g,
          interval: i,
          topMargin: g === lo - 1,
          bottomMargin: g === hi,
          ...(within(upper, g) && { above: within(upper, g) as [number, number] }),
          ...(within(lower, g + 1) && { below: within(lower, g + 1) as [number, number] }),
          over,
          under,
        })
        cells.set(cellSlotKey(f.id, g, i), id)
      }
    }
  }
  function frameOf(k: string): FrameId {
    return frameIn(frameOfKey, k) ?? ''
  }
  /** The row cell of f, in the gap g, that the child k of f stands in (the walls before it). */
  const intervalOf = (f: FrameId, g: number, k: string): number => {
    let n = 0
    for (const x of kidsOf(f)) {
      if (x === k) break
      if (wall(x, g)) n++
    }
    return n
  }
  const wallsBefore = (g: number, kids: readonly string[]): number =>
    kids.filter((k) => wall(k, g)).length

  // ---- the sides of the boxes
  const sides = new Map<SideKey, number>()
  for (const [key] of boxes) {
    for (const side of ['top', 'bottom', 'left', 'right'] as const) {
      sides.set(sideKey(key, side), add({ kind: 'side', box: key, side }))
    }
  }
  const sideNode = (box: string, side: Side) => sides.get(sideKey(box, side))

  // ---- the doors
  for (const [id, n] of nodes.entries()) {
    if (n.kind !== 'column') continue
    const { frame: f, rank: r, slot: k } = n
    const kids = colKids(f, r)
    const here = must(slotOf, columnKey(id), 'slot of column')
    const above = cellId(f, r - 1, wallsBefore(r - 1, kids.slice(0, k)))
    const below = cellId(f, r, wallsBefore(r, kids.slice(0, k)))
    if (above !== undefined) door(id, 'top', 0, above, 'bottom', here)
    if (below !== undefined) door(id, 'bottom', 0, below, 'top', here)
    // a child frame beside the column: the column across its edge
    const left = kids[k - 1]
    const right = kids[k]
    const lf = left === undefined ? undefined : frameIn(frameOfKey, left)
    const rf = right === undefined ? undefined : frameIn(frameOfKey, right)
    if (lf !== undefined) {
      const c = colId(lf, r, colKids(lf, r).length)
      if (c !== undefined) door(id, 'left', 0, c, 'right', 0, { frame: lf, edge: 'right' })
    }
    if (rf !== undefined) {
      const c = colId(rf, r, 0)
      if (c !== undefined) door(id, 'right', 0, c, 'left', 0, { frame: rf, edge: 'left' })
    }
  }
  for (const [key, b] of boxes) {
    const kids = colKids(b.frame, b.rank)
    const j = kids.indexOf(b.item)
    const at = must(slotOf, key, 'slot of box')
    const unit = items.get(b.item)?.kind === 'unit'
    const members = unit ? must(layers.members, b.item, 'members of unit') : [key]
    const outerLeft = members[0] === key
    const outerRight = members[members.length - 1] === key
    const g0 = b.rank - 1
    const g1 = b.rank
    const up = cellId(b.frame, g0, wallsBefore(g0, kids.slice(0, j)))
    const down = cellId(b.frame, g1, wallsBefore(g1, kids.slice(0, j)))
    const top = sideNode(key, 'top')
    const bottom = sideNode(key, 'bottom')
    if (up !== undefined && top !== undefined) door(top, 'top', 0, up, 'bottom', at)
    if (down !== undefined && bottom !== undefined) door(bottom, 'bottom', 0, down, 'top', at)
    const left = sideNode(key, 'left')
    const right = sideNode(key, 'right')
    const cl = colId(b.frame, b.rank, j)
    const cr = colId(b.frame, b.rank, j + 1)
    if (outerLeft && left !== undefined && cl !== undefined) door(left, 'left', 0, cl, 'right', 0)
    if (outerRight && right !== undefined && cr !== undefined)
      door(right, 'right', 0, cr, 'left', 0)
  }
  // a row beside or against a child frame's row
  for (const f of problem.frames) {
    for (const k of kidsOf(f.id)) {
      const g = frameIn(frameOfKey, k)
      if (g === undefined) continue
      const [lo, hi] = frameSpan(g)
      for (let gap = lo - 1; gap <= hi; gap++) {
        const mine = cellId(f.id, gap, intervalOf(f.id, gap, k))
        if (wall(k, gap)) {
          const n = kidsOf(g).filter((x) => wall(x, gap)).length
          const left = cellId(f.id, gap, intervalOf(f.id, gap, k))
          const right = cellId(f.id, gap, intervalOf(f.id, gap, k) + 1)
          const innerFirst = cellId(g, gap, 0)
          const innerLast = cellId(g, gap, n)
          if (left !== undefined && innerFirst !== undefined)
            door(left, 'right', 0, innerFirst, 'left', 0, { frame: g, edge: 'left' })
          if (right !== undefined && innerLast !== undefined)
            door(innerLast, 'right', 0, right, 'left', 0, { frame: g, edge: 'right' })
        } else if (gap === lo - 1) {
          const inner = cellId(g, gap, 0)
          const at = must(first, rowKey(g, gap + 1), 'first slot of frame')
          if (mine !== undefined && inner !== undefined)
            door(mine, 'bottom', at, inner, 'top', 0, { frame: g, edge: 'top' })
        } else if (gap === hi) {
          const inner = cellId(g, gap, 0)
          const at = must(first, rowKey(g, gap), 'first slot of frame')
          if (mine !== undefined && inner !== undefined)
            door(mine, 'top', at, inner, 'bottom', 0, { frame: g, edge: 'bottom' })
        }
      }
    }
  }

  const doorsOf: number[][] = nodes.map(() => [])
  for (const d of doors) {
    doorsOf[d.a]?.push(d.id)
    doorsOf[d.b]?.push(d.id)
  }
  return {
    nodes,
    doors,
    doorsOf,
    columnOfDummy,
    slots,
    slotOf,
    sideOf: sideNode,
    around,
    boxes,
  }
}
