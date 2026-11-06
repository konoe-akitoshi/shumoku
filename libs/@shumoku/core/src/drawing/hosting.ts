// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Hosting drawn as containment. A node that others run on (a hypervisor, a cluster) becomes a
 * frame holding itself and its guests, the way vSphere, Proxmox and cloud diagrams nest a VM in
 * its host and a host in its cluster: what runs where is a box inside a box, never a line.
 *
 * The frames are places the drawing adds to the network it draws; the network the person wrote
 * is not changed. A guest that names a place of its own stays there.
 */

import type * as input from '../input/model.js'

/** The id of the frame a host is drawn as. Group ids are written by people, who do not write `/`-led ids. */
export const hostFrameId = (host: string): string => `/host/${host}`

export function isHostFrame(id: string): boolean {
  return id.startsWith('/host/')
}

/**
 * The network with a frame for every host that has a guest to hold: a node's frame holds the
 * node and the guests on it; a redundancy set's frame (a cluster that VMs name as their host)
 * holds the set's nodes and the guests on the set or on any of its nodes.
 */
export function withHostFrames(network: input.Network): input.Network {
  const nodes = new Map(network.nodes.map((n) => [n.id, n]))
  const sets = new Map((network.redundancy ?? []).map((r) => [r.id, r]))
  const setOf = new Map<string, string>()
  for (const r of network.redundancy ?? []) for (const m of r.nodes) setOf.set(m, r.id)

  // Where a host is written to stand: a node's group, or the one group all of a set's nodes share.
  const writtenPlace = (host: string): { place: string | undefined } | undefined => {
    const set = sets.get(host)
    if (!set) return nodes.has(host) ? { place: nodes.get(host)?.group } : undefined
    const placed = new Set(set.nodes.map((m) => nodes.get(m)?.group))
    return placed.size === 1 ? { place: [...placed][0] } : undefined
  }

  // A guest goes in with its host unless it names another place: one that names the place its
  // host stands in (as a source such as NetBox does, giving each VM its site) still goes in.
  const guestsOf = new Map<string, string[]>()
  const guests = new Set<string>()
  for (const n of network.nodes) {
    if (n.host === undefined) continue
    const at = writtenPlace(n.host)
    if (!at || (n.group !== undefined && n.group !== at.place)) continue
    guestsOf.set(n.host, [...(guestsOf.get(n.host) ?? []), n.id])
    guests.add(n.id)
  }

  // A cluster's frame stands where all its nodes are; nodes in different places have none.
  const pools = new Map<string, string | undefined>()
  for (const [id, set] of sets) {
    const placed = new Set(set.nodes.map((m) => nodes.get(m)?.group))
    const hasGuests = guestsOf.has(id) || set.nodes.some((m) => (guestsOf.get(m)?.length ?? 0) > 0)
    if (hasGuests && placed.size === 1) pools.set(id, [...placed][0])
  }

  /** The frame a host's guests go into, if the host has one. */
  const frameOfHost = (host: string): string | undefined => {
    if (pools.has(host)) return hostFrameId(host)
    const pool = setOf.get(host)
    if (pool !== undefined && pools.has(pool)) return hostFrameId(pool)
    return guestsOf.has(host) ? hostFrameId(host) : undefined
  }

  // Where each node is drawn and where each frame stands, resolved through hosts.
  const placeMemo = new Map<string, string | undefined>()
  const placeOf = (id: string, seen: ReadonlySet<string> = new Set()): string | undefined => {
    if (placeMemo.has(id)) return placeMemo.get(id)
    const node = nodes.get(id)
    if (!node || seen.has(id)) return node?.group
    const next = new Set(seen).add(id)
    const pool = setOf.get(id)
    let place: string | undefined
    if (pool !== undefined && pools.has(pool)) place = hostFrameId(pool)
    else if (guestsOf.has(id)) place = hostFrameId(id)
    else if (guests.has(id) && node.host !== undefined)
      place = frameOfHost(node.host) ?? outerOf(node.host, next)
    else place = node.group
    placeMemo.set(id, place)
    return place
  }
  /** Where a host's own frame stands. */
  const outerOf = (host: string, seen: ReadonlySet<string> = new Set()): string | undefined => {
    if (pools.has(host)) return pools.get(host)
    const node = nodes.get(host)
    if (!node || seen.has(host)) return node?.group
    if (!guests.has(host) || node.host === undefined) return node.group
    return frameOfHost(node.host) ?? outerOf(node.host, new Set(seen).add(host))
  }

  const frames = [
    ...[...pools.keys()].map((id) => ({ host: id, label: sets.get(id)?.label ?? id })),
    ...[...guestsOf.keys()]
      .filter((h) => nodes.has(h) && !pools.has(setOf.get(h) ?? ''))
      .map((id) => ({ host: id, label: labelOf(nodes.get(id)) ?? id })),
  ].sort((a, b) => (a.host < b.host ? -1 : a.host > b.host ? 1 : 0))
  if (frames.length === 0) return network

  // Hang each frame under the place it stands in.
  const children = new Map<string | undefined, input.Group[]>()
  for (const f of frames) {
    const parent = outerOf(f.host)
    const group: input.Group = { id: hostFrameId(f.host), label: f.label }
    children.set(parent, [...(children.get(parent) ?? []), group])
  }
  const attach = (group: input.Group): input.Group => {
    const inner = [...(group.groups ?? []), ...(children.get(group.id) ?? [])].map(attach)
    return inner.length > 0 ? { ...group, groups: inner } : group
  }
  const groups = [...(network.groups ?? []), ...(children.get(undefined) ?? [])].map(attach)

  return {
    ...network,
    groups,
    nodes: network.nodes.map((n) => {
      const place = placeOf(n.id)
      return place === n.group ? n : { ...n, group: place }
    }),
  }
}

function labelOf(node: input.Node | undefined): string | undefined {
  const label = node?.label
  return Array.isArray(label) ? label.join(' ') : label
}
