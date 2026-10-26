// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { compare } from '../structure/keys.js'
import type { GroupId } from '../structure/types.js'
import type { Element, ElementId, Elements, Line } from './elements.js'
import type { Metrics, Point, Size } from './metrics.js'

/**
 * Layer 2b, between the ranks and the order. A rank can hold dozens of elements side by side
 * that all hang from one parent and go nowhere else (peers under an IX LAN, servers under a
 * switch, VMs under their host). In one row they make the drawing as wide as the row.
 *
 * A fan is the elements of one parent that are leaves: every line they have goes to the parent,
 * which stands one rank nearer the boundary, and they stand in one group. Two or more form a
 * fan. A fan is laid out as a block, its members in a grid inside the rank's band, and the
 * block is one slot for the order and the coordinates; the scene puts the members at their
 * cells. The grid's columns are chosen for the drawing's shape: every fan starts as one row,
 * then a fan in the widest rank gets one more row at a time while the drawing is wider than
 * `metrics.aspect` (width over height) allows.
 */
export interface Fan {
  /** The block's id as a slot: `fan:<parent>@<rank>`, with `/<group>` when the fan is in one. */
  readonly id: ElementId
  readonly parent: ElementId
  /** The members in the order they are written. */
  readonly members: readonly ElementId[]
  readonly rank: number
  readonly place?: GroupId
  readonly rows: number
  readonly columns: number
  readonly size: Size
  /** Where each member's box goes inside `size`, from the block's top-left corner. */
  readonly cells: readonly { readonly element: ElementId; readonly x: number; readonly y: number }[]
}

export interface Fans {
  readonly fans: readonly Fan[]
  /** The elements with each fan's members replaced by its block, one line from the parent. */
  readonly elements: Elements
  /** The ranks of `elements`. */
  readonly rank: ReadonlyMap<ElementId, number>
  /** For each line of the original elements, its index in `elements`; none for a fan's lines. */
  readonly lineOf: readonly (number | undefined)[]
  /** The fan each member is in. */
  readonly fanOf: ReadonlyMap<ElementId, Fan>
}

export interface Candidate {
  readonly parent: ElementId
  readonly rank: number
  readonly place?: GroupId
  readonly members: readonly Element[]
}

/**
 * The fans: for each parent, rank and group, the unit elements that have no line but to the
 * parent and stand one rank beyond it. A hosted element counts under its host through its
 * layout line. Fewer than two is not a fan.
 */
export function detectFans(elements: Elements, rank: ReadonlyMap<ElementId, number>): Candidate[] {
  const joined = new Map<ElementId, Set<ElementId>>()
  for (const line of elements.lines) {
    const [a, b] = line.ends
    joined.set(a.element, (joined.get(a.element) ?? new Set()).add(b.element))
    joined.set(b.element, (joined.get(b.element) ?? new Set()).add(a.element))
  }
  const groups = new Map<string, { parent: ElementId; rank: number; members: Element[] }>()
  for (const e of elements.elements) {
    if (e.kind !== 'unit') continue
    const near = joined.get(e.id)
    const parent = near?.size === 1 ? [...near][0] : undefined
    const mine = rank.get(e.id)
    const theirs = parent === undefined ? undefined : rank.get(parent)
    if (parent === undefined || mine === undefined || theirs === undefined) continue
    const beyond = theirs === 0 ? Math.abs(mine) === 1 : mine === theirs + Math.sign(theirs)
    if (!beyond) continue
    const key = `${parent}@${mine}/${e.place ?? ''}`
    const group = groups.get(key) ?? { parent, rank: mine, members: [] }
    group.members.push(e)
    groups.set(key, group)
  }
  const found: Candidate[] = []
  for (const group of groups.values()) {
    if (group.members.length < 2) continue
    const place = group.members[0]?.place
    found.push({ ...group, ...(place === undefined ? {} : { place }) })
  }
  return found
}

/**
 * Members in a grid of `columns`, row by row in the order given. Every cell is as large as the
 * largest member; a member is centred in its cell, and a last row that is not full is centred.
 */
export function gridOf(
  sizes: readonly Size[],
  columns: number,
  gap: number,
): { size: Size; offsets: Point[] } {
  const count = sizes.length
  const across = Math.max(1, Math.min(columns, count))
  const rows = Math.ceil(count / across)
  const cellWidth = Math.max(0, ...sizes.map((s) => s.width))
  const cellHeight = Math.max(0, ...sizes.map((s) => s.height))
  const offsets: Point[] = []
  for (const [i, size] of sizes.entries()) {
    const row = Math.floor(i / across)
    const inRow = Math.min(across, count - row * across)
    const shift = ((across - inRow) * (cellWidth + gap)) / 2
    offsets.push({
      x: shift + (i % across) * (cellWidth + gap) + (cellWidth - size.width) / 2,
      y: row * (cellHeight + gap) + (cellHeight - size.height) / 2,
    })
  }
  return {
    size: {
      width: across * cellWidth + (across - 1) * gap,
      height: rows * cellHeight + (rows - 1) * gap,
    },
    offsets,
  }
}

const columnsFor = (count: number, rows: number) => Math.ceil(count / rows)

/** How the drawing came out for one choice of rows: its shape and how wide each rank is. */
export interface Shape {
  readonly width: number
  readonly height: number
  /** The extent across of each rank in use, by rank. */
  readonly across: ReadonlyMap<number, number>
}

/**
 * Chooses the grid of every fan, then folds them. `measure` lays the folded elements out and
 * reports the shape: the widest rank is not the sum of its slots, because the coordinates keep
 * each element near its parent and groups keep their distance, so the shape has to be seen.
 */
export function layOutFans(
  elements: Elements,
  rank: ReadonlyMap<ElementId, number>,
  metrics: Metrics,
  measure: (fans: Fans) => Shape,
): Fans {
  const candidates = detectFans(elements, rank)
  const build = (rows: readonly number[]) =>
    foldFans(
      elements,
      rank,
      candidates.map((c, i) => fanOf(c, rows[i] ?? 1, metrics)),
    )

  // Every fan starts as one row. While the drawing is wider than the target, one more row goes
  // to a fan, the fans in the widest rank first and the widest block first. A row is kept only
  // if the drawing comes out narrower and nearer the target shape; a fan whose row did not help is passed over until some
  // other row does, and the choice stops when no fan is left to try.
  let rows = candidates.map(() => 1)
  let fans = build(rows)
  let shape = measure(fans)
  let passed = new Set<number>()
  while (shape.height > 0 && shape.width / shape.height > metrics.aspect) {
    const next = candidates
      .map((c, i) => ({ c, i }))
      .filter(({ c, i }) => !passed.has(i) && (rows[i] ?? 1) < c.members.length)
      .sort(
        (a, b) =>
          (shape.across.get(b.c.rank) ?? 0) - (shape.across.get(a.c.rank) ?? 0) ||
          (fans.fans[b.i]?.size.width ?? 0) - (fans.fans[a.i]?.size.width ?? 0) ||
          a.i - b.i,
      )[0]
    if (next === undefined) break
    const have = rows[next.i] ?? 1
    const columns = columnsFor(next.c.members.length, have)
    let more = have + 1
    while (more < next.c.members.length && columnsFor(next.c.members.length, more) >= columns) {
      more++
    }
    const trial = rows.map((v, i) => (i === next.i ? more : v))
    const tried = build(trial)
    const after = measure(tried)
    const closer = after.height > 0 && after.width / after.height < shape.width / shape.height
    if (after.width >= shape.width || !closer) {
      passed = new Set(passed).add(next.i)
      continue
    }
    rows = trial
    fans = tried
    shape = after
    passed = new Set()
  }
  return fans
}

/** A fan with `rows` rows of grid. */
function fanOf(c: Candidate, rows: number, metrics: Metrics): Fan {
  const columns = columnsFor(c.members.length, rows)
  const grid = gridOf(
    c.members.map((m) => m.size),
    columns,
    metrics.gap,
  )
  return {
    id: `fan:${c.parent}@${c.rank}${c.place === undefined ? '' : `/${c.place}`}`,
    parent: c.parent,
    members: c.members.map((m) => m.id),
    rank: c.rank,
    ...(c.place === undefined ? {} : { place: c.place }),
    rows: Math.ceil(c.members.length / columns),
    columns,
    size: grid.size,
    cells: c.members.map((m, k) => ({
      element: m.id,
      x: grid.offsets[k]?.x ?? 0,
      y: grid.offsets[k]?.y ?? 0,
    })),
  }
}

/** The elements as the order and the coordinates see them: a fan is one element. */
function foldFans(elements: Elements, rank: ReadonlyMap<ElementId, number>, fans: Fan[]): Fans {
  const fanOf = new Map(fans.flatMap((f) => f.members.map((m) => [m, f] as const)))
  const folded: Element[] = []
  const made = new Set<ElementId>()
  for (const e of elements.elements) {
    const fan = fanOf.get(e.id)
    if (!fan) {
      folded.push(e)
    } else if (!made.has(fan.id)) {
      made.add(fan.id)
      folded.push({
        id: fan.id,
        kind: 'fan',
        members: [],
        ...(fan.place === undefined ? {} : { place: fan.place }),
        size: fan.size,
        parts: [],
      })
    }
  }
  const lines: Line[] = []
  const lineOf: (number | undefined)[] = []
  for (const line of elements.lines) {
    if (line.ends.some((end) => fanOf.has(end.element))) {
      lineOf.push(undefined)
      continue
    }
    lineOf.push(lines.length)
    lines.push({ ...line, index: lines.length })
  }
  for (const fan of [...fans].sort((a, b) => compare(a.id, b.id))) {
    lines.push({
      index: lines.length,
      ends: [{ element: fan.parent }, { element: fan.id }],
      virtual: false,
    })
  }
  const foldedRank = new Map(
    [...rank].filter(([id]) => !fanOf.has(id)).concat(fans.map((f) => [f.id, f.rank] as const)),
  )
  return {
    fans,
    elements: { ...elements, elements: folded, lines },
    rank: foldedRank,
    lineOf,
    fanOf,
  }
}
