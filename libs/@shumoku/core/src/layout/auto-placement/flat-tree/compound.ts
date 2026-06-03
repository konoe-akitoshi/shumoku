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
  const subgraphsById = new Map((graph.subgraphs ?? []).map((s) => [s.id, s]))

  // Functional domain = hostname suffix; '(none)' when absent.
  const domainOf = (node: Node): string => {
    const host = (node.metadata as { hostname?: unknown } | undefined)?.hostname
    const h = typeof host === 'string' ? host : ''
    const i = h.lastIndexOf('.')
    return i === -1 ? '(none)' : h.slice(i + 1)
  }
  const topSubgraphOf = (sgId: string): string => {
    let cur = sgId
    for (let guard = 0; guard < 100; guard++) {
      const sg = subgraphsById.get(cur)
      if (!sg?.parent || !subgraphsById.has(sg.parent)) return cur
      cur = sg.parent
    }
    return cur
  }
  // Grouping key for THIS level. depth 0 = physical location area
  // (coarse), depth 1 = functional domain (fine). Returns '' for a
  // node with no group at this level → its own (loose) box, so a
  // location-less device floats to its dependency position instead of
  // piling into one bucket.
  const keyOf = (node: Node): string => {
    if (depth === 0) {
      if (node.parent && subgraphsById.has(node.parent)) return `loc:${topSubgraphOf(node.parent)}`
      return ''
    }
    return `dom:${domainOf(node)}`
  }
  const labelOf = (key: string): string => {
    if (key.startsWith('dom:')) return key.slice(4)
    if (key.startsWith('loc:')) return subgraphsById.get(key.slice(4))?.label ?? key.slice(4)
    return key
  }

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
  if (realGroups.length < 2 || depth >= MAX_DEPTH) return autoLayoutFlatTree(graph, engine, options)

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

    const b = sub.bounds
    const cx = b.x + b.width / 2
    const cy = b.y + b.height / 2
    boxSize.set(key, { width: b.width, height: b.height })
    for (const m of members) {
      const sn = sub.nodes.get(m.id)
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

  const pos = new Map<string, Position>()
  let y = 0
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
      pos.set(k, { x: x + s.width / 2, y: y + s.height / 2 })
      x += s.width + gap
      rowH = Math.max(rowH, s.height)
      rowStart = false
    }
    y += rowH + gap * 3
  }
  return pos
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
  const startX = result.bounds.x + padding
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
