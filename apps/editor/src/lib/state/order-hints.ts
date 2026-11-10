// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

import { type ArrangedChild, type Arrangement, type OrderIntent, ROOT_FRAME } from '@shumoku/core'
import type { Box, Scene } from '@shumoku/renderer'

/**
 * The one place a pointer becomes a place in the drawing. A drop is read against the last solved
 * arrangement (frames, rows, order; no coordinate) and the scene it was drawn as: the frame the
 * element landed in, the row of that frame nearest to it, and the children of that row it fell
 * between. What goes back to the model is what changed, and only that: the group it now sits in
 * (a configuration edit) and the order of its new frame (an intent, `drawing.order`). A drop in
 * the original slot changes nothing. Coordinates are never kept.
 */

/** A place a dropped element can take: a frame, a row of it, and the children it stands between. */
export interface Slot {
  frame: string
  row: number
  /** The child of the row it follows, none when it is first; the one it precedes, none when last. */
  after: string | undefined
  before: string | undefined
}

/** What a drop changed; `undefined` from `readDrop` when nothing did. */
export interface DropChange {
  /** The group the element now sits in (`undefined` for the top level), when that changed. */
  parent?: { to: string | undefined }
  /** `drawing.order` after the drop, when the order changed: the frames the drop touched replaced, the rest kept. */
  order?: Record<string, string[]>
}

export interface Dragged {
  id: string
  type: 'node' | 'subgraph'
}

const centre = (b: Box) => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 })
const inside = (b: Box, p: { x: number; y: number }) =>
  p.x >= b.x && p.x <= b.x + b.width && p.y >= b.y && p.y <= b.y + b.height
const union = (boxes: Box[]): Box | undefined => {
  if (boxes.length === 0) return undefined
  const x0 = Math.min(...boxes.map((b) => b.x))
  const y0 = Math.min(...boxes.map((b) => b.y))
  const x1 = Math.max(...boxes.map((b) => b.x + b.width))
  const y1 = Math.max(...boxes.map((b) => b.y + b.height))
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 }
}

/** The box a child of the arrangement is drawn as: a node's, a group's, or round a unit's members. */
function boxOf(scene: Scene, child: ArrangedChild): Box | undefined {
  if (child.kind === 'group') return scene.groups.find((g) => g.group.id === child.id)?.box
  const nodeBox = (id: string) => scene.nodes.find((n) => n.node.id === id)?.box
  if (child.kind === 'unit') {
    return union((child.members ?? []).flatMap((m) => nodeBox(m) ?? []))
  }
  return nodeBox(child.id)
}

/** Whether a dragged element is this child: the group, the node, or a member of the unit. */
const isDragged = (child: ArrangedChild, drag: Dragged) =>
  drag.type === 'subgraph'
    ? child.kind === 'group' && child.id === drag.id
    : child.kind !== 'group' && (child.id === drag.id || child.members?.includes(drag.id) === true)

/** The child a dragged element is, and the frame it is a child of. */
function placeOf(
  arrangement: Arrangement,
  drag: Dragged,
): { frame: string; child: ArrangedChild } | undefined {
  for (const [frame, children] of Object.entries(arrangement.frames)) {
    const child = children.find((c) => isDragged(c, drag))
    if (child) return { frame, child }
  }
  return undefined
}

/** The innermost group frame a point is in, never the dragged group itself or one inside it. */
function frameAt(scene: Scene, drag: Dragged, at: { x: number; y: number }): string {
  const groups = scene.groups.map((g) => ({ id: g.group.id, parent: g.group.parent, box: g.box }))
  const inner = new Set<string>(drag.type === 'subgraph' ? [drag.id] : [])
  if (drag.type === 'subgraph') {
    for (let grew = true; grew; ) {
      grew = false
      for (const g of groups) {
        if (g.parent !== undefined && inner.has(g.parent) && !inner.has(g.id)) {
          inner.add(g.id)
          grew = true
        }
      }
    }
  }
  return (
    groups
      .filter((g) => !inner.has(g.id) && inside(g.box, at))
      .sort((a, b) => a.box.width * a.box.height - b.box.width * b.box.height)[0]?.id ?? ROOT_FRAME
  )
}

/**
 * The children of a frame that can stand in an order, the dragged one aside: what the structure
 * places (a free item, a node beside its host) is no neighbour a slot can be read against, since
 * the engine would not hold the dragged element beside it.
 */
const neighboursOf = (arrangement: Arrangement, frame: string, drag: Dragged) =>
  (arrangement.frames[frame] ?? []).filter((c) => c.movable && !isDragged(c, drag))

/**
 * The slot a point is over: the frame it is in, the row of that frame whose children stand
 * nearest to it, and the two children of that row it falls between, left to right in the frame's
 * order. Only the pointer's place against the drawn boxes is read here; the engine decides the
 * rest from the order alone.
 */
export function slotAt(
  arrangement: Arrangement,
  scene: Scene,
  drag: Dragged,
  at: { x: number; y: number },
): Slot {
  const frame = frameAt(scene, drag, at)
  const others = neighboursOf(arrangement, frame, drag).flatMap((c) => {
    const b = boxOf(scene, c)
    return b ? [{ id: c.id, rows: c.rows, box: b }] : []
  })
  const rows = new Set(others.flatMap((c) => range(c.rows[0], c.rows[1])))
  let row = placeOf(arrangement, drag)?.child.rows[0] ?? 0
  let nearest = Number.POSITIVE_INFINITY
  for (const r of rows) {
    const members = others.filter((c) => c.rows[0] <= r && r <= c.rows[1])
    const own = members.filter((c) => c.rows[0] === r && c.rows[1] === r)
    const ys = (own.length > 0 ? own : members).map((c) => centre(c.box).y)
    const y = ys.reduce((s, v) => s + v, 0) / Math.max(1, ys.length)
    const d = Math.abs(y - at.y)
    if (d < nearest) {
      nearest = d
      row = r
    }
  }
  const inRow = others.filter((c) => c.rows[0] <= row && row <= c.rows[1])
  const left = inRow.filter((c) => centre(c.box).x < at.x)
  const after = left[left.length - 1]?.id
  const before = inRow[left.length]?.id
  return { frame, row, after, before }
}

const range = (lo: number, hi: number) => Array.from({ length: hi - lo + 1 }, (_, i) => lo + i)

/**
 * The order list of a frame after one child moved: the list as it was, less that child, with
 * the two it now stands between added where the frame's order puts them if the list lacked them,
 * and the child put just after the one it follows (before the one it precedes when it is first).
 * Ids the list has that the frame no longer shows keep their places.
 */
export function mergeOrder(
  list: readonly string[],
  frameOrder: readonly string[],
  moved: string,
  after: string | undefined,
  before: string | undefined,
): string[] {
  const at = new Map(frameOrder.map((id, i) => [id, i] as const))
  let out = list.filter((id) => id !== moved)
  const admit = (id: string | undefined) => {
    if (id === undefined || out.includes(id)) return
    const rank = at.get(id)
    if (rank === undefined) return
    let pos = 0
    for (const [i, x] of out.entries()) {
      const r = at.get(x)
      if (r !== undefined && r < rank) pos = i + 1
    }
    out = [...out.slice(0, pos), id, ...out.slice(pos)]
  }
  admit(after)
  admit(before)
  const pos =
    after !== undefined ? out.indexOf(after) + 1 : before !== undefined ? out.indexOf(before) : 0
  return [...out.slice(0, pos), moved, ...out.slice(pos)]
}

/**
 * What dropping an element changed. The frame it landed in is its group (`parent`, a change of
 * the configuration); its place among that frame's children is an order (`order`). Neither is
 * written when it did not change, and an element the structure places (a free item, a node
 * beside its host) takes no order. Returns `undefined` when nothing changed.
 */
export function readDrop(
  arrangement: Arrangement,
  scene: Scene,
  order: OrderIntent | undefined,
  drop: Dragged & { box: Box },
): DropChange | undefined {
  const at = centre(drop.box)
  const slot = slotAt(arrangement, scene, drop, at)
  const was = placeOf(arrangement, drop)
  const change: DropChange = {}
  const drawnParent =
    drop.type === 'subgraph'
      ? scene.groups.find((g) => g.group.id === drop.id)?.group.parent
      : scene.nodes.find((n) => n.node.id === drop.id)?.node.parent
  const wasFrame = was?.frame ?? drawnParent ?? ROOT_FRAME
  if (wasFrame !== slot.frame)
    change.parent = { to: slot.frame === ROOT_FRAME ? undefined : slot.frame }

  // The order is one list for the whole frame; a drop says where the element stands in its row.
  // So the row's sequence is what changes or does not, and the element is put between its two
  // neighbours in the frame's order, where the children of other rows do not matter.
  const name = was?.child.id ?? drop.id
  const inRow = (c: ArrangedChild) => c.rows[0] <= slot.row && slot.row <= c.rows[1]
  const rowWas = (arrangement.frames[slot.frame] ?? [])
    .filter((c) => c.movable && inRow(c))
    .map((c) => c.id)
  const others = neighboursOf(arrangement, slot.frame, drop)
  const place = (ids: readonly string[]) =>
    slot.after !== undefined
      ? ids.indexOf(slot.after) + 1
      : slot.before !== undefined
        ? ids.indexOf(slot.before)
        : 0
  const rowIds = others.filter(inRow).map((c) => c.id)
  const rowNow = [...rowIds.slice(0, place(rowIds)), name, ...rowIds.slice(place(rowIds))]
  const same = rowNow.length === rowWas.length && rowNow.every((id, i) => id === rowWas[i])
  const frameIds = others.map((c) => c.id)
  const next = [...frameIds.slice(0, place(frameIds)), name, ...frameIds.slice(place(frameIds))]
  if ((was?.child.movable ?? false) && !same && next.length > 1) {
    const merged: Record<string, string[]> = {}
    for (const [frame, ids] of Object.entries(order ?? {})) merged[frame] = [...ids]
    if (change.parent) {
      // the old frame's say about it is withdrawn with it; a list left with one id says nothing
      const left = (merged[wasFrame] ?? []).filter((id) => id !== name)
      if (left.length > 1) merged[wasFrame] = left
      else delete merged[wasFrame]
    }
    merged[slot.frame] = mergeOrder(merged[slot.frame] ?? [], next, name, slot.after, slot.before)
    change.order = merged
  }
  return change.parent || change.order ? change : undefined
}
