// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Hosting drawn as containment, the way vSphere, Proxmox and cloud diagrams nest a VM in its host
 * and a host in its cluster: what runs where is a box inside a box, never a line.
 *
 * - A node that others run on is drawn as one box: its own card at the top as the heading, its
 *   guests in a grid below. The box is still the node (its ports, its state, what is selected).
 * - A redundancy set that guests name as their host (a cluster a VM runs somewhere in) is drawn
 *   as a frame round its nodes and those guests.
 *
 * `hostingOf` decides both, once, from the network as written; everything else reads its answer.
 * The network is not changed.
 */

import type * as input from '../input/model.js'
import type { Node } from '../models/types.js'
import { compare, sorted } from '../structure/keys.js'

export interface Hosting {
  /** By host node, the guests drawn inside its box, in id order. */
  boxes: ReadonlyMap<string, readonly string[]>
  /** By redundancy set, the place its frame stands in and the guests drawn inside it. */
  pools: ReadonlyMap<string, { place: string | undefined; guests: readonly string[] }>
  /** Every node drawn inside what it runs on, in a box or a pool's frame. */
  contained: ReadonlySet<string>
}

/**
 * What is drawn inside what. A guest goes in with what it runs on unless it names another place;
 * one that names the place its host stands in still goes in, as a source such as NetBox gives
 * each VM its site. A guest's guest (a container on a VM) goes in the outermost host's box.
 */
export function hostingOf(network: input.Network): Hosting {
  const nodes = new Map(network.nodes.map((n) => [n.id, n]))

  // Where a set stands: the one place all its nodes share; nodes in different places have none.
  const placeOfSet = new Map<string, string | undefined>()
  for (const set of network.redundancy ?? []) {
    const placed = new Set(set.nodes.map((m) => nodes.get(m)?.group))
    if (placed.size === 1) placeOfSet.set(set.id, [...placed][0])
  }
  /** The outermost node a node runs on, through its chain of hosts. */
  const outermost = (id: string): string | undefined => {
    let top: string | undefined
    let at = nodes.get(id)?.host
    const seen = new Set([id])
    while (at !== undefined && nodes.has(at) && !seen.has(at)) {
      top = at
      seen.add(at)
      at = nodes.get(at)?.host
    }
    return top
  }

  const boxes = new Map<string, string[]>()
  const pools = new Map<string, { place: string | undefined; guests: string[] }>()
  const contained = new Set<string>()
  for (const n of sorted(network.nodes.map((x) => x.id))) {
    const node = nodes.get(n)
    if (node?.host === undefined) continue
    const top = outermost(n)
    if (top !== undefined) {
      if (node.group !== undefined && node.group !== nodes.get(top)?.group) continue
      boxes.set(top, [...(boxes.get(top) ?? []), n])
    } else if (placeOfSet.has(node.host)) {
      const place = placeOfSet.get(node.host)
      if (node.group !== undefined && node.group !== place) continue
      const pool = pools.get(node.host) ?? { place, guests: [] }
      pools.set(node.host, { place, guests: [...pool.guests, n] })
    } else continue
    contained.add(n)
  }
  return { boxes, pools, contained }
}

/** Where a guest stands inside its host's box, from the box's top-left corner. */
export interface Seated {
  id: string
  size: { width: number; height: number }
  at: { x: number; y: number }
}

/**
 * A host's box: its own card as the heading, and its guests below in a grid of as many columns as
 * the square root of their count (a count, not a length, decides it), in the order given.
 */
export function hostBox(
  heading: { width: number; height: number },
  guests: { id: string; size: { width: number; height: number } }[],
  room: { gap: number; pad: number },
): { size: { width: number; height: number }; seated: Seated[] } {
  const columns = Math.max(1, Math.ceil(Math.sqrt(guests.length)))
  const rows = Math.ceil(guests.length / columns)
  const cell = {
    width: Math.max(0, ...guests.map((g) => g.size.width)),
    height: Math.max(0, ...guests.map((g) => g.size.height)),
  }
  const seated = guests.map((g, i) => ({
    id: g.id,
    size: cell,
    at: {
      x: room.pad + (i % columns) * (cell.width + room.gap),
      y: heading.height + room.pad + Math.floor(i / columns) * (cell.height + room.gap),
    },
  }))
  const gridWidth = columns * cell.width + (columns - 1) * room.gap + 2 * room.pad
  const gridHeight = rows * cell.height + (rows - 1) * room.gap + 2 * room.pad
  return {
    size: { width: Math.max(heading.width, gridWidth), height: heading.height + gridHeight },
    seated,
  }
}

/**
 * A node as its card is drawn inside what it runs on: without the facts about where it runs
 * (`about: 'hosting'`), which the box or frame round it already says. The node keeps them for
 * details and tooltips; only the card leaves them out.
 */
export function drawnInPlace(node: Node): Node {
  const kept = node.annotations?.filter((a) => a.about !== 'hosting')
  if (kept === undefined || kept.length === node.annotations?.length) return node
  const { annotations: _, ...rest } = node
  return kept.length > 0 ? { ...rest, annotations: kept } : rest
}

/** The id of a pool's frame. People write group ids; none is led by `/`. */
export const poolFrameId = (set: string): string => `/pool/${set}`

/** Pools by the place their frame stands in, for hanging the frames in the tree of groups. */
export function poolsByPlace(hosting: Hosting): Map<string | undefined, string[]> {
  const out = new Map<string | undefined, string[]>()
  for (const [set, { place }] of [...hosting.pools].sort(([a], [b]) => compare(a, b)))
    out.set(place, [...(out.get(place) ?? []), set])
  return out
}
