// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

import { ROOT_FRAME } from '@shumoku/core'
import type { Box, Scene } from '@shumoku/renderer'

/** What a drop means for the model: the frame the dragged element now sits in, and its order. */
export interface DropResult {
  /** The group the element sits in after the drop; undefined for the top level. */
  parent: string | undefined
  /** `drawing.order` after the drop: the frames the drop touched replaced, the rest kept. */
  order: Record<string, string[]>
}

interface Member {
  id: string
  parent: string | undefined
  box: Box
}

const centre = (b: Box) => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 })
const inside = (b: Box, p: { x: number; y: number }) =>
  p.x >= b.x && p.x <= b.x + b.width && p.y >= b.y && p.y <= b.y + b.height

/**
 * What dropping an element means. Positions are never kept; a drop is read for two things only:
 * the group frame the element's centre landed in (the innermost one, never the element itself
 * or one inside it), and its place among the siblings of that frame, left to right.
 *
 * The order recorded for a frame lists every node and group in it by the centre of its box, the
 * dropped one by where it landed. The drawing reads it as the order within a row; two siblings
 * in different rows are not ordered by it. A frame the drop did not touch keeps its list.
 */
export function readDrop(
  scene: Scene,
  order: Readonly<Record<string, readonly string[]>> | undefined,
  drop: { id: string; type: 'node' | 'subgraph'; box: Box },
): DropResult {
  const nodes: Member[] = scene.nodes
    .filter((n) => !n.node.termination)
    .map((n) => ({ id: n.node.id, parent: n.node.parent, box: n.box }))
  const groups: Member[] = scene.groups.map((g) => ({
    id: g.group.id,
    parent: g.group.parent,
    box: g.box,
  }))
  const members = [...nodes, ...groups]
  const was = members.find((m) => m.id === drop.id)
  const wasParent = was?.parent

  // A group cannot go inside itself or anything inside it.
  const inner = new Set<string>([drop.id])
  if (drop.type === 'subgraph') {
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
  const at = centre(drop.box)
  const parent = groups
    .filter((g) => !inner.has(g.id) && inside(g.box, at))
    .sort((a, b) => a.box.width * a.box.height - b.box.width * b.box.height)[0]?.id

  const next: Record<string, string[]> = {}
  for (const [frame, ids] of Object.entries(order ?? {})) next[frame] = [...ids]
  const frames = new Set<string>([parent ?? ROOT_FRAME])
  if (wasParent !== parent) frames.add(wasParent ?? ROOT_FRAME)
  for (const frame of frames) {
    const key = frame === ROOT_FRAME ? undefined : frame
    const siblings = members
      .filter((m) => m.parent === key && m.id !== drop.id)
      .map((m) => ({ id: m.id, x: centre(m.box).x }))
    if (key === parent) siblings.push({ id: drop.id, x: at.x })
    const ids = siblings.sort((a, b) => a.x - b.x || a.id.localeCompare(b.id)).map((m) => m.id)
    if (ids.length > 1) next[frame] = ids
    else delete next[frame]
  }
  return { parent, order: next }
}

/** The order hints that still name something in the diagram. */
export function liveOrder(
  order: Readonly<Record<string, readonly string[]>> | undefined,
  ids: ReadonlySet<string>,
): Record<string, string[]> | undefined {
  if (!order) return undefined
  const live: Record<string, string[]> = {}
  for (const [frame, list] of Object.entries(order)) {
    if (frame !== ROOT_FRAME && !ids.has(frame)) continue
    const kept = list.filter((id) => ids.has(id))
    if (kept.length > 1) live[frame] = kept
  }
  return Object.keys(live).length > 0 ? live : undefined
}
