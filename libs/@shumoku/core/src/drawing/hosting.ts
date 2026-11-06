// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Hosting drawn as containment, the way vSphere, Proxmox and cloud diagrams nest a VM in its host
 * and a host in its cluster: what runs where is a box inside a box, never a line. A node that
 * others run on is drawn as one box, its own card the heading and its guests in a grid below; the
 * box is still the node (its ports, its state, what is selected). A cluster that guests name as
 * their host becomes a frame round its nodes and those guests.
 *
 * The network the person wrote is not changed. A guest that names a place of its own stays there.
 */

import type * as input from '../input/model.js'

/** The id of the frame a host is drawn as. Group ids are written by people, who do not write `/`-led ids. */
export const hostFrameId = (host: string): string => `/host/${host}`

export function isHostFrame(id: string): boolean {
  return id.startsWith('/host/')
}

/**
 * The network with a frame for every redundancy set that guests name as their host (a cluster a
 * VM runs somewhere in): it holds the set's nodes and those guests. A guest of a single node is
 * not framed here; it is drawn inside its host's own box (`guestsByHost`).
 */
export function withHostFrames(network: input.Network): input.Network {
  const nodes = new Map(network.nodes.map((n) => [n.id, n]))
  const sets = new Map((network.redundancy ?? []).map((r) => [r.id, r]))

  // A set's frame stands where all its nodes are; nodes in different places have none. A guest
  // goes in unless it names another place (one that names the set's own place still goes in, as
  // a source such as NetBox writes each VM's site).
  const placeOfSet = new Map<string, string | undefined>()
  for (const [id, set] of sets) {
    const placed = new Set(set.nodes.map((m) => nodes.get(m)?.group))
    if (placed.size === 1) placeOfSet.set(id, [...placed][0])
  }
  const guestsOf = new Map<string, string[]>()
  for (const n of network.nodes) {
    if (n.host === undefined || !placeOfSet.has(n.host)) continue
    if (n.group !== undefined && n.group !== placeOfSet.get(n.host)) continue
    guestsOf.set(n.host, [...(guestsOf.get(n.host) ?? []), n.id])
  }
  if (guestsOf.size === 0) return network

  const inFrame = new Map<string, string>()
  const children = new Map<string | undefined, input.Group[]>()
  for (const id of [...guestsOf.keys()].sort()) {
    const set = sets.get(id)
    if (!set) continue
    const frame = hostFrameId(id)
    for (const m of set.nodes) inFrame.set(m, frame)
    for (const g of guestsOf.get(id) ?? []) inFrame.set(g, frame)
    const parent = placeOfSet.get(id)
    const group: input.Group = { id: frame, label: set.label ?? id }
    children.set(parent, [...(children.get(parent) ?? []), group])
  }
  const attach = (group: input.Group): input.Group => {
    const inner = [...(group.groups ?? []), ...(children.get(group.id) ?? [])].map(attach)
    return inner.length > 0 ? { ...group, groups: inner } : group
  }
  return {
    ...network,
    groups: [...(network.groups ?? []), ...(children.get(undefined) ?? [])].map(attach),
    nodes: network.nodes.map((n) => {
      const frame = inFrame.get(n.id)
      return frame === undefined ? n : { ...n, group: frame }
    }),
  }
}

/**
 * The guests drawn inside each host's own box, by host node: every node whose chain of hosts
 * leads to that node (a container on a VM on it too), unless it names a place other than the
 * host's. A guest of a redundancy set is not here: it goes in the set's frame.
 */
export function guestsByHost(network: input.Network): Map<string, string[]> {
  const nodes = new Map(network.nodes.map((n) => [n.id, n]))
  const topOf = (id: string): string | undefined => {
    let at = nodes.get(id)?.host
    let top: string | undefined
    const seen = new Set([id])
    while (at !== undefined && nodes.has(at) && !seen.has(at)) {
      top = at
      seen.add(at)
      at = nodes.get(at)?.host
    }
    return top
  }
  const out = new Map<string, string[]>()
  for (const n of [...network.nodes].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))) {
    const top = topOf(n.id)
    if (top === undefined) continue
    if (n.group !== undefined && n.group !== nodes.get(top)?.group) continue
    out.set(top, [...(out.get(top) ?? []), n.id])
  }
  return out
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
