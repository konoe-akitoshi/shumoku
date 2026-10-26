// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import type { GroupId } from '../structure/types.js'
import type { Elements } from './elements.js'
import type { Box, Metrics } from './metrics.js'
import type { Ordered } from './order.js'
import { type Separation, solveVpsc } from './vpsc.js'

/**
 * Layer 4. Coordinates for the ordered slots and the groups' frames.
 *
 * Across a layer, the sum of the squares of how far each line runs sideways is made least, with
 * the spacing as separation constraints that VPSC meets exactly: neighbours in a layer keep
 * their half widths and a gap apart; a group's frame is a pair of variables, left and right,
 * that hold the group's slots with the group's insets, hold the frames of the groups inside it,
 * and keep clear of whatever else stands in the layers the group spans (one constraint on each
 * side in each layer is enough, because the order inside a layer is already kept). Sibling
 * groups that share a layer keep their frames a group gap apart across all the layers they
 * span. The objective is solved by repeating: every slot wants the weighted mean of the slots
 * it is joined to (a line between two real elements weighs 1, one with a dummy end 2, between
 * two dummies 8, so that long lines run straight), VPSC finds the nearest positions that keep
 * the constraints, and the next round starts from there.
 *
 * Down the page, a layer is as tall as its tallest element and the gap between layers is at
 * least the lead-outs at both ends and one line pitch, and more where a group's frame starts or
 * ends: the frame's insets (label band included) are added once for each frame that starts there.
 */
export interface Placed {
  /** The centre of each slot, across. */
  readonly x: ReadonlyMap<string, number>
  /** The centre line of each layer, down. */
  readonly y: readonly number[]
  /** The frame of each group that has anything in it. */
  readonly frames: ReadonlyMap<GroupId, Box>
}

export function placeCoords(elements: Elements, ordered: Ordered, metrics: Metrics): Placed {
  const sizes = new Map(elements.elements.map((e) => [e.id, e.size]))
  const parents = new Map(elements.groups.map((g) => [g.id, g.parent]))
  const chainOf = (group: GroupId | undefined): GroupId[] => {
    const chain: GroupId[] = []
    for (let g = group; g !== undefined; g = parents.get(g)) chain.push(g)
    return chain
  }

  const flat = ordered.layers.flat()
  const index = new Map(flat.map((s, i) => [s.id, i]))
  const width = flat.map((s) => (s.kind === 'element' ? (sizes.get(s.id)?.width ?? 0) : 0))
  const height = flat.map((s) => (s.kind === 'element' ? (sizes.get(s.id)?.height ?? 0) : 0))
  const real = flat.map((s) => s.kind === 'element')

  // ---- groups in use, their variables ----
  const members = new Map<GroupId, number[]>()
  for (const [i, s] of flat.entries()) {
    for (const g of chainOf(s.group)) members.set(g, [...(members.get(g) ?? []), i])
  }
  const used = elements.groups.filter((g) => members.has(g.id))
  const depth = (g: GroupId) => chainOf(g).length
  const left = new Map<GroupId, number>()
  const right = new Map<GroupId, number>()
  for (const [k, g] of used.entries()) {
    left.set(g.id, flat.length + 2 * k)
    right.set(g.id, flat.length + 2 * k + 1)
  }
  const inset = (g: GroupId) => metrics.group(g)

  // ---- constraints ----
  const apart = (a: number, b: number) => {
    const bothReal = real[a] && real[b]
    const neither = !real[a] && !real[b]
    const spacing = bothReal
      ? metrics.gap
      : neither
        ? metrics.pitch
        : Math.max(metrics.pitch, metrics.gap / 2)
    return (width[a] ?? 0) / 2 + (width[b] ?? 0) / 2 + spacing
  }
  const outside = (s: number) => (width[s] ?? 0) / 2 + (real[s] ? metrics.gap : metrics.pitch)
  const constraints: Separation[] = []
  const must = (l: number | undefined, r: number | undefined, gap: number) => {
    if (l !== undefined && r !== undefined) constraints.push({ left: l, right: r, gap })
  }
  for (const layer of ordered.layers) {
    for (const [i, s] of layer.entries()) {
      const next = layer[i + 1]
      if (next)
        must(
          index.get(s.id),
          index.get(next.id),
          apart(index.get(s.id) ?? 0, index.get(next.id) ?? 0),
        )
    }
  }
  for (const g of used) {
    const l = left.get(g.id)
    const r = right.get(g.id)
    const pad = inset(g.id)
    for (const m of members.get(g.id) ?? []) {
      if (flat[m]?.group !== g.id) continue
      must(l, m, (width[m] ?? 0) / 2 + pad.left)
      must(m, r, (width[m] ?? 0) / 2 + pad.right)
    }
    if (g.parent !== undefined) {
      const outer = inset(g.parent)
      must(left.get(g.parent), l, outer.left)
      must(r, right.get(g.parent), outer.right)
    }
  }
  // Where each group stands in each layer it has slots in.
  const runs = new Map<GroupId, Map<number, [number, number]>>()
  for (const [layerIndex, layer] of ordered.layers.entries()) {
    for (const g of used) {
      const at = layer.flatMap((s, i) => (chainOf(s.group).includes(g.id) ? [i] : []))
      const first = at[0]
      const last = at[at.length - 1]
      if (first === undefined || last === undefined) continue
      if (last - first + 1 !== at.length) {
        throw new Error(`group ${g.id} is not contiguous in layer ${layerIndex}`)
      }
      runs.set(g.id, (runs.get(g.id) ?? new Map()).set(layerIndex, [first, last]))
      const before = layer[first - 1]
      const after = layer[last + 1]
      const beforeAt = before === undefined ? undefined : index.get(before.id)
      const afterAt = after === undefined ? undefined : index.get(after.id)
      if (beforeAt !== undefined) must(beforeAt, left.get(g.id), outside(beforeAt))
      if (afterAt !== undefined) must(right.get(g.id), afterAt, outside(afterAt))
    }
  }
  for (const [i, g] of used.entries()) {
    for (const h of used.slice(i + 1)) {
      if (g.parent !== h.parent) continue
      const shared = [...(runs.get(g.id)?.keys() ?? [])].find((l) => runs.get(h.id)?.has(l))
      if (shared === undefined) continue
      const a = runs.get(g.id)?.get(shared)?.[0] ?? 0
      const b = runs.get(h.id)?.get(shared)?.[0] ?? 0
      if (a < b) must(right.get(g.id), left.get(h.id), metrics.groupGap)
      else must(right.get(h.id), left.get(g.id), metrics.groupGap)
    }
  }

  // ---- across ----
  // The lines between adjacent layers, with how much each is worth keeping straight.
  const joined: [number, number, number][] = []
  for (const path of ordered.paths) {
    for (const [i, id] of path.entries()) {
      const next = path[i + 1]
      const a = index.get(id)
      const b = next === undefined ? undefined : index.get(next)
      if (a === undefined || b === undefined || flat[a]?.layer === flat[b]?.layer) continue
      const dummies = Number(!real[a]) + Number(!real[b])
      joined.push([a, b, dummies === 0 ? 1 : dummies === 1 ? 2 : 8])
    }
  }
  const pulls: [number, number][][] = flat.map(() => [])
  for (const [a, b, w] of joined) {
    pulls[a]?.push([b, w])
    pulls[b]?.push([a, w])
  }

  // Each layer packed to its smallest, centred on 0.
  const x = flat.map(() => 0)
  for (const layer of ordered.layers) {
    let at = 0
    for (const [i, s] of layer.entries()) {
      const here = index.get(s.id) ?? 0
      const before = layer[i - 1]
      if (before) at += apart(index.get(before.id) ?? 0, here)
      x[here] = at
    }
    for (const s of layer) x[index.get(s.id) ?? 0] = (x[index.get(s.id) ?? 0] ?? 0) - at / 2
  }

  /** Where each frame would like its edges: tight around its slots. */
  const frameWants = (current: readonly number[]) =>
    used.flatMap((g) => {
      const pad = inset(g.id)
      const own = members.get(g.id) ?? []
      return [
        Math.min(...own.map((m) => (current[m] ?? 0) - (width[m] ?? 0) / 2)) - pad.left,
        Math.max(...own.map((m) => (current[m] ?? 0) + (width[m] ?? 0) / 2)) + pad.right,
      ]
    })
  const solve = (desired: readonly number[]) => solveVpsc({ desired, separations: constraints })

  let solution = solve([...x, ...frameWants(x)])
  const anchor = 1
  const tolerance = metrics.pitch / 100
  for (let round = 0; round < 80; round++) {
    const current = solution.slice(0, flat.length)
    const wanted = current.map((position, s) => {
      let weight = anchor
      let sum = anchor * position
      for (const [t, w] of pulls[s] ?? []) {
        weight += w
        sum += w * (current[t] ?? 0)
      }
      return sum / weight
    })
    const next = solve([...wanted, ...frameWants(current)])
    const moved = Math.max(
      ...next.slice(0, flat.length).map((v, s) => Math.abs(v - (current[s] ?? 0))),
    )
    solution = next
    if (moved < tolerance) break
  }

  const centre = new Map(flat.map((s, i) => [s.id, solution[i] ?? 0]))

  // ---- down ----
  const layerHeight = ordered.layers.map((layer) =>
    Math.max(0, ...layer.map((s) => height[index.get(s.id) ?? 0] ?? 0)),
  )
  const span = new Map<GroupId, [number, number]>()
  for (const g of used) {
    const layers = (members.get(g.id) ?? []).map((m) => flat[m]?.layer ?? 0)
    span.set(g.id, [Math.min(...layers), Math.max(...layers)])
  }
  // What a frame that starts (or ends) in a layer adds: its own inset and those of the frames
  // around it that start (or end) there too; the deepest chain counts.
  const extra = (side: 'top' | 'bottom', layer: number) => {
    let most = 0
    for (const g of used) {
      let sum = 0
      for (const h of chainOf(g.id)) {
        const [first, last] = span.get(h) ?? [0, 0]
        if ((side === 'top' ? first : last) !== layer) break
        sum += inset(h)[side]
      }
      most = Math.max(most, sum)
    }
    return most
  }
  const y: number[] = []
  for (const [l, h] of layerHeight.entries()) {
    const before = y[l - 1]
    if (before === undefined) {
      y.push(extra('top', 0) + h / 2)
      continue
    }
    const gap = 2 * metrics.leadOut + metrics.pitch + extra('bottom', l - 1) + extra('top', l)
    y.push(before + (layerHeight[l - 1] ?? 0) / 2 + gap + h / 2)
  }

  const frames = new Map<GroupId, Box>()
  const top = new Map<GroupId, number>()
  const bottom = new Map<GroupId, number>()
  for (const g of [...used].sort((a, b) => depth(b.id) - depth(a.id))) {
    const own = (members.get(g.id) ?? []).filter((m) => flat[m]?.group === g.id && real[m])
    const pad = inset(g.id)
    const tops = [
      ...own.map((m) => (y[flat[m]?.layer ?? 0] ?? 0) - (height[m] ?? 0) / 2),
      ...used.filter((c) => c.parent === g.id).map((c) => top.get(c.id) ?? 0),
    ]
    const bottoms = [
      ...own.map((m) => (y[flat[m]?.layer ?? 0] ?? 0) + (height[m] ?? 0) / 2),
      ...used.filter((c) => c.parent === g.id).map((c) => bottom.get(c.id) ?? 0),
    ]
    const t = Math.min(...tops) - pad.top
    const b = Math.max(...bottoms) + pad.bottom
    top.set(g.id, t)
    bottom.set(g.id, b)
    const l = solution[left.get(g.id) ?? 0] ?? 0
    const r = solution[right.get(g.id) ?? 0] ?? 0
    frames.set(g.id, { x: l, y: t, width: r - l, height: b - t })
  }
  return { x: centre, y, frames }
}
