// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Compound (container-aware) layout.
 *
 * The flat-tree engine deliberately treats every node as a peer in
 * one big tidy-tree and draws subgraphs as post-hoc hulls (see
 * `./README.md`). That reads well for small hand-authored diagrams
 * but blows up for large auto-discovered ones: a single dependency
 * tier (e.g. ~150 access devices) is laid as one row, so the canvas
 * stretches into a thin ~100k-px strip and the group hulls overlap.
 *
 * This pass restores the "container" reading for grouped graphs
 * **without changing the base engine**, by running it recursively
 * over a coarse→fine grouping hierarchy:
 *
 *   depth 0 — **functional domain** (the hostname suffix .noc / .dc /
 *             .svc / .ap …). This is the *coarse* axis: it tracks the
 *             dependency tiers (core / service / access) and, unlike
 *             physical location, isn't blank for ~half the fleet — so
 *             a location-less device still lands in its real domain
 *             box instead of piling into one false "(未入力)" hub.
 *   depth 1 — **physical location** subgraph (rack), where present, so
 *             a dense domain like .noc folds its own racks.
 *   depth 2 — flat.
 *
 * At each level it (1) folds every group by laying out its members
 * recursively → a compact box + size; (2) builds a meta-graph of the
 * boxes (aggregated cross-box links, box tier = max member tier) and
 * lays it out with `layoutFlatTree` directly — NOT the rebalancing
 * wrapper — so the tier order can't be reordered; (3) composes the
 * box-internal positions into the placed slots. Boxes are compact and
 * placed as whole units, so the width collapses and the overlap
 * instability goes away.
 *
 * Falls back to the plain engine when a level has nothing to compound
 * (fewer than two real groups) or the recursion bottoms out.
 */

import type { Bounds, NetworkGraph, Node, Position, Size, Subgraph } from '../../../models/types.js'
import type { LayoutEngine } from '../../engine/index.js'
import { linkSpeedBps } from '../../link-utils.js'
import { type AutoLayoutOptions, type AutoLayoutResult, autoLayoutFlatTree } from './auto-layout.js'
import { placePorts } from './port-placement.js'

/** Grouping levels: 0 = domain, 1 = location, then flat. */
const MAX_DEPTH = 2

/**
 * Public entry. Pulls out information-less **ghost** devices — no
 * hostname *and* no links, i.e. inventory placeholders that can be ~a
 * third of an auto-discovered fleet — and tucks them into a compact
 * labelled grid below the real topology, so they don't bloat the
 * domain boxes or dominate the canvas. Everything else goes through
 * the recursive compound layout. Same signature/return as
 * {@link autoLayoutFlatTree}.
 */
export function layoutCompound(
  graph: NetworkGraph,
  engine: LayoutEngine,
  options: AutoLayoutOptions = {},
): AutoLayoutResult {
  const deg = new Map<string, number>()
  for (const l of graph.links) {
    deg.set(l.from.node, (deg.get(l.from.node) ?? 0) + 1)
    deg.set(l.to.node, (deg.get(l.to.node) ?? 0) + 1)
  }
  const hostnameOf = (n: Node): string => {
    const h = (n.metadata as { hostname?: unknown } | undefined)?.hostname
    return typeof h === 'string' ? h : ''
  }
  const isGhost = (n: Node): boolean => !(deg.get(n.id) ?? 0) && hostnameOf(n) === ''
  const ghosts = graph.nodes.filter(isGhost)
  if (ghosts.length === 0) return layoutCompoundCore(graph, engine, options, 0)

  const mainGraph: NetworkGraph = { ...graph, nodes: graph.nodes.filter((n) => !isGhost(n)) }
  const result = layoutCompoundCore(mainGraph, engine, options, 0)
  return appendGhostGrid(result, ghosts, engine, options)
}

/**
 * Lay out a grouped graph as compact boxes arranged by dependency.
 * Recurses over the grouping levels (domain → location → flat).
 */
function layoutCompoundCore(
  graph: NetworkGraph,
  engine: LayoutEngine,
  options: AutoLayoutOptions,
  depth: number,
): AutoLayoutResult {
  const direction = options.direction ?? 'TB'
  const padding = options.subgraphPadding ?? 20
  const labelHeight = options.subgraphLabelHeight ?? 28
  // Functional domain = hostname suffix; '(none)' when absent. This is
  // the single grouping axis: every member of a domain lands in one
  // box, so a domain-scoped view reads as "one box for the domain" and
  // its link-less members band together (via the inner flat layout's
  // repack) instead of scattering across physical-location sub-boxes.
  const domainOf = (node: Node): string => {
    const host = (node.metadata as { hostname?: unknown } | undefined)?.hostname
    const h = typeof host === 'string' ? host : ''
    const i = h.lastIndexOf('.')
    // Normalise (trim/lowercase) so a stray "noc " doesn't split into a
    // second box from the real "noc".
    return i === -1
      ? '(none)'
      : h
          .slice(i + 1)
          .trim()
          .toLowerCase()
  }
  const keyOf = (node: Node): string => `dom:${domainOf(node)}`
  const labelOf = (key: string): string => (key.startsWith('dom:') ? key.slice(4) : key)

  // 1. Partition by this level's key ('' → its own singleton box).
  const groups = new Map<string, Node[]>()
  const keyById = new Map<string, string>()
  for (const n of graph.nodes) {
    const k = keyOf(n) || `node:${n.id}`
    keyById.set(n.id, k)
    const m = groups.get(k)
    if (m) m.push(n)
    else groups.set(k, [n])
  }

  // Nothing meaningful to compound, or out of levels → plain engine.
  const realGroups = [...groups].filter(([k, m]) => !k.startsWith('node:') && m.length > 1)
  // At the top level a single domain group still earns its own box (so a
  // domain-scoped view reads as "one box for the domain"); deeper levels
  // need ≥2 groups to be worth nesting.
  const minGroups = depth === 0 ? 1 : 2
  if (realGroups.length < minGroups || depth >= MAX_DEPTH) {
    return autoLayoutFlatTree(graph, engine, options)
  }

  // Per-node tier (fastest incident link); a box's tier is the max of
  // its members, which orients the boxes in the meta layout.
  const nodeTier = new Map<string, number>()
  for (const l of graph.links) {
    if (l.redundancy) continue
    const bps = linkSpeedBps(l) ?? 0
    if (bps > (nodeTier.get(l.from.node) ?? 0)) nodeTier.set(l.from.node, bps)
    if (bps > (nodeTier.get(l.to.node) ?? 0)) nodeTier.set(l.to.node, bps)
  }

  // 2. Fold each group, recursing into the next grouping level.
  const memberRelPos = new Map<string, Position>()
  const memberSize = new Map<string, Size>()
  const boxSize = new Map<string, Size>()
  const boxTier = new Map<string, number>()

  for (const [key, members] of groups) {
    let tier = 0
    for (const m of members) tier = Math.max(tier, nodeTier.get(m.id) ?? 0)
    boxTier.set(key, tier)

    if (key.startsWith('node:')) {
      const n = members[0]
      if (!n) continue
      const size = engine.nodeFootprint(n)
      memberSize.set(n.id, size)
      memberRelPos.set(n.id, { x: 0, y: 0 })
      boxSize.set(key, size)
      continue
    }

    const memberIds = new Set(members.map((m) => m.id))
    const subLinks = graph.links.filter(
      (l) => memberIds.has(l.from.node) && memberIds.has(l.to.node),
    )
    const subGraph: NetworkGraph = {
      version: '1.0',
      name: key,
      nodes: members.map((m) => ({ ...m, position: undefined })),
      links: subLinks,
      subgraphs: [],
      settings: { direction },
    }
    const sub = layoutCompoundCore(
      subGraph,
      engine,
      { direction, nodeGap: options.nodeGap, layerGap: options.layerGap },
      depth + 1,
    )

    // Re-pack this group's link-less members into a compact band under
    // its connected core BEFORE measuring the box. autoLayoutFlatTree
    // lays isolated nodes as tidy-tree roots strewn across the top row,
    // which both wastes width and — since we fold this result into a box
    // next — inflates the box and throws off the meta-layout's band
    // centring and vertical stacking. Doing it here keeps the box size
    // honest, so the centring below lands true.
    const subDegree = new Map<string, number>()
    for (const l of subLinks) {
      subDegree.set(l.from.node, (subDegree.get(l.from.node) ?? 0) + 1)
      subDegree.set(l.to.node, (subDegree.get(l.to.node) ?? 0) + 1)
    }
    const packed = bandIsolatedBelowCore(sub.nodes, subDegree, labelHeight)

    const b = computeBounds(packed, new Map())
    const cx = b.x + b.width / 2
    const cy = b.y + b.height / 2
    boxSize.set(key, { width: b.width, height: b.height })
    for (const m of members) {
      const sn = packed.get(m.id)
      memberSize.set(m.id, sn?.size ?? engine.nodeFootprint(m))
      memberRelPos.set(
        m.id,
        sn?.position ? { x: sn.position.x - cx, y: sn.position.y - cy } : { x: 0, y: 0 },
      )
    }
  }

  // 3. Place the boxes in dependency-tier bands (highest tier on top),
  //    wrapping each band into a grid so a wide tier (many same-tier
  //    boxes) stacks instead of stretching into one long row, and
  //    link-less boxes fall to the tier-0 band at the bottom.
  const metaPos = layoutTierGrid([...groups.keys()], boxSize, boxTier, (options.nodeGap ?? 30) + 60)

  // 4. Compose box-internal positions into their placed slots.
  const finalNodes = new Map<string, Node>()
  for (const n of graph.nodes) {
    const key = keyById.get(n.id) ?? `node:${n.id}`
    const boxCentre = metaPos.get(key) ?? { x: 0, y: 0 }
    const rel = memberRelPos.get(n.id) ?? { x: 0, y: 0 }
    finalNodes.set(n.id, {
      ...n,
      // Parent = the box at this level (the outermost call's boxes are
      // the functional-domain hulls). Ungrouped singletons stay loose.
      parent: key.startsWith('node:') ? undefined : key,
      position: { x: boxCentre.x + rel.x, y: boxCentre.y + rel.y },
      size: memberSize.get(n.id) ?? engine.nodeFootprint(n),
    })
  }

  // 5. Ports + group hulls + root bounds.
  const ports = placePorts(finalNodes, graph.links, direction)
  const subgraphs = new Map<string, Subgraph>()
  for (const key of groups.keys()) {
    if (key.startsWith('node:')) continue
    const bounds = hullForGroup(key, finalNodes, padding, labelHeight, direction)
    subgraphs.set(key, { id: key, label: labelOf(key), ...(bounds ? { bounds } : {}) })
  }

  const bounds = computeBounds(finalNodes, subgraphs)
  return { nodes: finalNodes, ports, subgraphs, bounds }
}

/**
 * Place boxes in dependency-tier bands. Boxes are grouped by tier
 * (highest first → top) and each band is shelf-packed into a grid
 * targeting a roughly-square overall area, so a tier with many boxes
 * wraps instead of stretching into one wide row. Returns box centres.
 */
function layoutTierGrid(
  keys: string[],
  boxSize: Map<string, Size>,
  boxTier: Map<string, number>,
  gap: number,
): Map<string, Position> {
  let totalArea = 0
  for (const k of keys) {
    const s = boxSize.get(k)
    if (s) totalArea += s.width * s.height
  }
  const targetWidth = Math.max(1, Math.sqrt(totalArea) * 2.1)

  const byTier = new Map<number, string[]>()
  for (const k of keys) {
    const t = boxTier.get(k) ?? 0
    const arr = byTier.get(t)
    if (arr) arr.push(k)
    else byTier.set(t, [k])
  }
  const tiers = [...byTier.keys()].sort((a, b) => b - a)

  // First pass: pack each tier band left-aligned, recording each box's
  // (x, y) and its band index.
  const placed: Array<{ k: string; x: number; y: number; w: number; h: number; band: number }> = []
  let y = 0
  let band = 0
  for (const t of tiers) {
    const boxes = (byTier.get(t) ?? []).sort((a, b) => a.localeCompare(b))
    let x = 0
    let rowH = 0
    let rowStart = true
    for (const k of boxes) {
      const s = boxSize.get(k) ?? { width: 0, height: 0 }
      if (!rowStart && x + s.width > targetWidth) {
        y += rowH + gap
        x = 0
        rowH = 0
        rowStart = true
      }
      placed.push({ k, x, y, w: s.width, h: s.height, band })
      x += s.width + gap
      rowH = Math.max(rowH, s.height)
      rowStart = false
    }
    // Separate tiers by a bit more than the intra-tier wrap gap so the
    // dependency bands read distinctly — but not by the full link-width
    // scaling (that term sizes horizontal sibling clearance; applied
    // vertically it inflates into a large empty void that the cross-tier
    // backbone links have to span).
    y += rowH + Math.round(gap * 1.5)
    band++
  }

  // Second pass: centre each band on the widest one, so a narrow tier
  // sits in the middle instead of clustering against the left edge.
  const bandWidth = new Map<number, number>()
  for (const p of placed) bandWidth.set(p.band, Math.max(bandWidth.get(p.band) ?? 0, p.x + p.w))
  const maxWidth = Math.max(1, ...bandWidth.values())

  const pos = new Map<string, Position>()
  for (const p of placed) {
    const shift = (maxWidth - (bandWidth.get(p.band) ?? 0)) / 2
    pos.set(p.k, { x: shift + p.x + p.w / 2, y: p.y + p.h / 2 })
  }
  return pos
}

/**
 * Re-pack a folded group's link-less members into a compact grid
 * directly below its connected core. autoLayoutFlatTree lays isolated
 * nodes as tidy-tree roots strewn across the top row, which wastes
 * width and inflates the box this result is folded into. `degree`
 * counts intra-group links only — a node wired solely to *other* groups
 * still reads as isolated inside this box, so it bands too. Returns a
 * new map; the input is not mutated.
 */
function bandIsolatedBelowCore(
  nodes: Map<string, Node>,
  degree: Map<string, number>,
  labelHeight: number,
): Map<string, Node> {
  const positioned = [...nodes.values()].filter((n) => n.position)
  const isol = positioned.filter((n) => !((degree.get(n.id) ?? 0) > 0))
  const conn = positioned.filter((n) => (degree.get(n.id) ?? 0) > 0)
  if (isol.length < 2 || conn.length === 0) return nodes

  let cMinX = Number.POSITIVE_INFINITY
  let cMaxX = Number.NEGATIVE_INFINITY
  let cMaxY = Number.NEGATIVE_INFINITY
  for (const n of conn) {
    const s = n.size ?? { width: 0, height: 0 }
    const p = n.position
    if (!p) continue
    cMinX = Math.min(cMinX, p.x - s.width / 2)
    cMaxX = Math.max(cMaxX, p.x + s.width / 2)
    cMaxY = Math.max(cMaxY, p.y + s.height / 2)
  }
  const gap = 30
  const cellW = Math.max(1, ...isol.map((n) => n.size?.width ?? 0)) + gap
  const cellH = Math.max(1, ...isol.map((n) => n.size?.height ?? 0)) + gap
  // Wrap the isolated band to roughly the connected core's width so it
  // sits as a tidy block under the wiring, not a single long row.
  const cols = Math.max(1, Math.min(isol.length, Math.floor((cMaxX - cMinX) / cellW) || 1))
  const startX = (cMinX + cMaxX) / 2 - (cols * cellW) / 2
  const startY = cMaxY + gap + labelHeight

  const out = new Map(nodes)
  for (const [i, n] of isol.entries()) {
    const s = n.size ?? { width: 0, height: 0 }
    out.set(n.id, {
      ...n,
      position: {
        x: startX + (i % cols) * cellW + s.width / 2,
        y: startY + Math.floor(i / cols) * cellH + s.height / 2,
      },
    })
  }
  return out
}

/** Tight bbox of a box's members + padding + a direction-placed label band. */
function hullForGroup(
  key: string,
  nodes: Map<string, Node>,
  padding: number,
  labelHeight: number,
  direction: string,
): Bounds | undefined {
  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  let any = false
  for (const n of nodes.values()) {
    if (n.parent !== key || !n.position) continue
    const size = n.size ?? { width: 0, height: 0 }
    minX = Math.min(minX, n.position.x - size.width / 2)
    minY = Math.min(minY, n.position.y - size.height / 2)
    maxX = Math.max(maxX, n.position.x + size.width / 2)
    maxY = Math.max(maxY, n.position.y + size.height / 2)
    any = true
  }
  if (!any) return undefined
  const labelTop = direction === 'TB' ? labelHeight : 0
  const labelBottom = direction === 'BT' ? labelHeight : 0
  const labelLeft = direction === 'LR' ? labelHeight : 0
  const labelRight = direction === 'RL' ? labelHeight : 0
  return {
    x: minX - padding - labelLeft,
    y: minY - padding - labelTop,
    width: maxX - minX + padding * 2 + labelLeft + labelRight,
    height: maxY - minY + padding * 2 + labelTop + labelBottom,
  }
}

/** Pack ghost nodes into a compact ~square grid below the main layout. */
function appendGhostGrid(
  result: AutoLayoutResult,
  ghosts: Node[],
  engine: LayoutEngine,
  options: AutoLayoutOptions,
): AutoLayoutResult {
  const padding = options.subgraphPadding ?? 20
  const labelHeight = options.subgraphLabelHeight ?? 28
  const gap = 40
  const sizeById = new Map(ghosts.map((g) => [g.id, engine.nodeFootprint(g)]))
  const dims = [...sizeById.values()]
  const cellW = Math.max(1, ...dims.map((s) => s.width)) + gap
  const cellH = Math.max(1, ...dims.map((s) => s.height)) + gap
  const cols = Math.max(1, Math.ceil(Math.sqrt(ghosts.length)))
  // Centre the grid under the topology rather than left-aligning it.
  const gridWidth = Math.min(ghosts.length, cols) * cellW
  const startX = result.bounds.x + result.bounds.width / 2 - gridWidth / 2
  const startY = result.bounds.y + result.bounds.height + gap + labelHeight

  const nodes = new Map(result.nodes)
  let minX = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  for (const [i, g] of ghosts.entries()) {
    const size = sizeById.get(g.id)
    if (!size) continue
    const cx = startX + (i % cols) * cellW + size.width / 2
    const cy = startY + Math.floor(i / cols) * cellH + size.height / 2
    nodes.set(g.id, { ...g, parent: '__unmapped__', position: { x: cx, y: cy }, size })
    minX = Math.min(minX, cx - size.width / 2)
    maxX = Math.max(maxX, cx + size.width / 2)
    maxY = Math.max(maxY, cy + size.height / 2)
  }

  const subgraphs = new Map(result.subgraphs)
  if (Number.isFinite(minX)) {
    subgraphs.set('__unmapped__', {
      id: '__unmapped__',
      label: `未マップ ${ghosts.length}台`,
      bounds: {
        x: minX - padding,
        y: startY - padding - labelHeight,
        width: maxX - minX + padding * 2,
        height: maxY - startY + padding * 2 + labelHeight,
      },
    })
  }
  return { nodes, ports: result.ports, subgraphs, bounds: computeBounds(nodes, subgraphs) }
}

/** Bbox over every positioned node + every subgraph hull, with margin. */
function computeBounds(nodes: Map<string, Node>, subgraphs: Map<string, Subgraph>): Bounds {
  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  let any = false
  for (const n of nodes.values()) {
    if (!n.position) continue
    const size = n.size ?? { width: 0, height: 0 }
    minX = Math.min(minX, n.position.x - size.width / 2)
    minY = Math.min(minY, n.position.y - size.height / 2)
    maxX = Math.max(maxX, n.position.x + size.width / 2)
    maxY = Math.max(maxY, n.position.y + size.height / 2)
    any = true
  }
  for (const sg of subgraphs.values()) {
    if (!sg.bounds) continue
    minX = Math.min(minX, sg.bounds.x)
    minY = Math.min(minY, sg.bounds.y)
    maxX = Math.max(maxX, sg.bounds.x + sg.bounds.width)
    maxY = Math.max(maxY, sg.bounds.y + sg.bounds.height)
    any = true
  }
  if (!any) return { x: 0, y: 0, width: 400, height: 300 }
  const margin = 50
  return {
    x: minX - margin,
    y: minY - margin,
    width: maxX - minX + margin * 2,
    height: maxY - minY + margin * 2,
  }
}
