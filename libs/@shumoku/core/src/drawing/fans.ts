// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { compare } from '../structure/keys.js'
import type { Element, ElementId, Elements, Line } from './elements.js'
import type { Metrics, Point, Size } from './metrics.js'

/**
 * Layer 2b, between the ranks and the order. A rank can hold dozens of elements side by side
 * that all hang from one parent and go nowhere else (peers under an IX LAN, servers under a
 * switch, VMs under their host). In one row they make the drawing as wide as the row.
 *
 * A fan is the elements of one parent that are leaves: every line they have goes to the parent,
 * which stands one rank nearer the boundary. Two or more form a
 * fan. A fan is laid out as a block, its members in a grid inside the rank's band, and the
 * block is one slot for the order and the coordinates; the scene puts the members at their
 * cells. The grid's columns are chosen from the fan's own shape: the block comes out about as
 * wide as `metrics.aspect` (width over height) says, whatever else is in the drawing.
 */
export interface Fan {
  /** The block's id as a slot: `fan:<parent>@<rank>`. */
  readonly id: ElementId
  readonly parent: ElementId
  /** The members in the order they are written. */
  readonly members: readonly ElementId[]
  readonly rank: number
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
  readonly members: readonly Element[]
}

/**
 * The fans: for each parent and rank, the unit elements that have no line but to the
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
    const key = `${parent}@${mine}`
    const group = groups.get(key) ?? { parent, rank: mine, members: [] }
    group.members.push(e)
    groups.set(key, group)
  }
  const found: Candidate[] = []
  for (const group of groups.values()) {
    if (group.members.length < 2) continue
    found.push(group)
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

/**
 * The columns that make a block of `count` members come out as wide as the target says. A
 * cell repeats every cell width plus a gap across and every cell height plus a gap down, so
 * with c columns the block is about c cells wide and count / c cells tall, and
 * width / height = aspect gives c = sqrt(count * aspect * pitchDown / pitchAcross). Capped at one
 * row of every member, and at least one column.
 */
export function columnsFor(count: number, cell: Size, gap: number, aspect: number): number {
  const wanted = Math.round(Math.sqrt((count * aspect * (cell.height + gap)) / (cell.width + gap)))
  return Math.min(count, Math.max(1, wanted))
}

/** The largest member's size: what a cell of the grid is. */
function cellOf(members: readonly Element[]): Size {
  return {
    width: Math.max(0, ...members.map((m) => m.size.width)),
    height: Math.max(0, ...members.map((m) => m.size.height)),
  }
}

/**
 * Chooses the grid of every fan from the fan's own members and the target shape, then folds
 * them. Each block comes out near the target ratio by itself; nothing is laid out twice.
 */
export function layOutFans(
  elements: Elements,
  rank: ReadonlyMap<ElementId, number>,
  metrics: Metrics,
): Fans {
  const fans = detectFans(elements, rank).map((c) => fanOf(c, metrics))
  return foldFans(elements, rank, fans)
}

/** A fan with the columns its members' shape asks for. */
function fanOf(c: Candidate, metrics: Metrics): Fan {
  const columns = columnsFor(c.members.length, cellOf(c.members), metrics.gap, metrics.aspect)
  const grid = gridOf(
    c.members.map((m) => m.size),
    columns,
    metrics.gap,
  )
  return {
    id: `fan:${c.parent}@${c.rank}`,
    parent: c.parent,
    members: c.members.map((m) => m.id),
    rank: c.rank,
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
