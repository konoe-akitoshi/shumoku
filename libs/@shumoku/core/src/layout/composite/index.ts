// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Composite zone layout — the v3 placement pipeline (engine-v3-migration.md
 * B1+A7, #432; algorithm history in docs/engine-v3-design.md §23-40).
 *
 * Macro structure comes from a layered quotient over ZONES (location
 * metadata), not over nodes: each zone is laid out locally (sibling rows
 * with deterministic jitter), zones stack in bands by hierarchy depth,
 * and zones that share a primary feeder pack as a grid block under it.
 * Redundant pairs (link.redundancy, with a naming/structure fallback)
 * collapse to one unit during placement and expand side-by-side.
 *
 * Deterministic by construction: no RNG, no time — jitter comes from a
 * golden-ratio sequence keyed by stable node order.
 */

import type { Bounds, Direction, NetworkGraph, Node, Subgraph } from '../../models/types.js'
import { resolveNodeSize } from '../engine/index.js'
import { getLinkWidthForMode, linkSpeedBps } from '../link-utils.js'
import { PORT_LABEL_BOX_OFFSET, portLabelLength, shortIfName } from '../port-geometry.js'
import { resolveTierFromSpec } from '../role-tiers.js'

export interface CompositeLayoutOptions {
  direction?: Direction
  /**
   * Enable local adaptive refinement after the semantic macro structure
   * is formed. Defaults to true. The false branch exists so experiments
   * can isolate the contribution of jitter, barycenter ordering, neighbor
   * pull, alignment, and vertical compaction without maintaining a fork.
   */
  microAdaptation?: boolean
  /**
   * Treat rendered stroke width as geometry during sizing and spacing.
   * Defaults to true. False keeps every link at unit width for controlled
   * ablation experiments.
   */
  widthAware?: boolean
  /** Horizontal gap between zone boxes in a band. */
  zoneGap?: number
  /** Vertical gap between bands (also the wiring channel height). */
  bandGap?: number
  /** Gap between rows inside a zone. */
  rowGap?: number
  /** Horizontal gap between units in a row. */
  cellGapX?: number
  /** Zone box padding. */
  zonePad?: number
  /**
   * Pair unit ids (from `CompositeLayoutResult.pairs`) whose member
   * order should be mirrored. Search move vocabulary: the left/right
   * order inside a redundant pair is a real degree of freedom — the v3
   * rounds found exactly the pair a human flagged by eye (§35).
   */
  pairFlips?: ReadonlySet<string>
  /**
   * Extra vertical space inserted BEFORE band index i — congestion
   * feedback from routing (a channel overflowing with wire tracks
   * widens its road bed on the next pass).
   */
  bandExtra?: ReadonlyMap<number, number>
  /**
   * Explicit block order per band index (block keys from
   * `CompositeLayoutResult.bandBlocks`). Search move vocabulary: the
   * v3 simultaneous place-and-route arbitrated band orderings by
   * actually routing them (§33).
   */
  bandOrder?: ReadonlyMap<number, readonly string[]>
  /**
   * Per-unit horizontal nudges (unit id → dx), applied after port
   * refinement. Search move vocabulary (v3 hill-climb ±x, §32).
   */
  nudges?: ReadonlyMap<string, number>
  /** Bands wider than this wrap into sub-rows (v3 §24). */
  maxBandW?: number
  /**
   * Per-node width floors fed back from the previous routing round
   * (alignPortsToPeers reports faces that had to compress their port
   * slots). Growing the node is the correct resolution for an
   * over-subscribed face; this closes that feedback loop.
   */
  minNodeWidths?: ReadonlyMap<string, number>
  /** Same feedback for side faces (left/right port slots). */
  minNodeHeights?: ReadonlyMap<string, number>
}

export interface CompositeLayoutResult {
  /** Copies of the input nodes with `position` (center) set. */
  nodes: Map<string, Node>
  /** Original subgraphs (with bounds) plus synthetic zone boxes. */
  subgraphs: Map<string, Subgraph>
  bounds: Bounds
  /** zone name → member node ids (for invariant checks / diagnostics). */
  zones: Map<string, string[]>
  /** Redundant-pair unit ids (search flip candidates). */
  pairs: string[]
  /** Band y-ranges (top/bottom, final coordinates) for congestion measurement. */
  bands: { top: number; bottom: number }[]
  /** Node pair-keys (`a|b`, sorted) belonging to the primary dependency tree. */
  primaryEdges: Set<string>
  /** Shared-service sink nodes placed on the bottom rail. */
  sinks: string[]
  /** Heartbeat links between pair members (`a|b` keys) — couplings, not wires. */
  heartbeats: Set<string>
  /** Hierarchy depth per node (BFS from the apex). */
  depths: Map<string, number>
  /** Block keys per band, in placed order (band-order search handles). */
  bandBlocks: string[][]
  /**
   * Ids of enclosing scope subgraphs (outer frames). Routing happens
   * after layout, and gutters/ramps may run outside the node extents —
   * the router pass stretches these frames to keep the wiring inside.
   */
  scopes: string[]
}

/** Synthetic zone subgraphs get this id prefix. */
export const ZONE_SUBGRAPH_PREFIX = '__zone:'

const PHI = 1.618033988749895

/**
 * Heuristic gate for enabling the composite layout automatically: enough
 * nodes that flat-tree gets crowded, and zone metadata present on most of
 * them so the zone quotient has something to work with.
 */
export function shouldUseComposite(graph: NetworkGraph): boolean {
  if (graph.nodes.length < 10) return false
  let located = 0
  for (const node of graph.nodes) {
    if (typeof node.metadata?.['location'] === 'string' && node.metadata['location'] !== '')
      located++
  }
  return located / graph.nodes.length >= 0.5
}

// ============================================================================
// Internal structures
// ============================================================================

interface LogicalEdge {
  a: string
  b: string
  bw: number
  count: number
  redundancy: boolean
}

interface Unit {
  id: string
  members: string[]
  width: number
  height: number
  zone: string
  depth: number
}

export const pairKey = (a: string, b: string): string => (a < b ? `${a}|${b}` : `${b}|${a}`)

const labelOf = (node: Node): string => {
  const label = node.label
  if (Array.isArray(label)) return label[0] ?? node.id
  return label ?? node.id
}

/** "thunder8665s-1.noc" → "thunder8665s.noc" (trailing -N member index). */
const stemOf = (label: string): string => label.replace(/-\d+(?=\.|$)/, '')
/** Host part before the first dot. */
const hostOf = (label: string): string => {
  const dot = label.indexOf('.')
  return dot === -1 ? label : label.slice(0, dot)
}

// ============================================================================
// Pipeline
// ============================================================================

export function layoutComposite(
  graph: NetworkGraph,
  options: CompositeLayoutOptions = {},
): CompositeLayoutResult {
  const microAdaptation = options.microAdaptation ?? true
  const widthAware = options.widthAware ?? true
  // Gaps clear the thickest ribbon (the engine-era rule from
  // unified-engine: fixed gaps + bandwidth-derived stroke widths meant a
  // fat trunk overran the nodes it passed between). Caller values still
  // raise the floor; they can't shrink below the wire clearance.
  let maxLinkWidth = 0
  for (const link of graph.links) {
    maxLinkWidth = Math.max(maxLinkWidth, widthAware ? getLinkWidthForMode(link, 'linear') : 1)
  }
  const wireClear = Math.round(maxLinkWidth)
  const zoneGap = Math.max(options.zoneGap ?? 90, wireClear + 16)
  const bandGap = Math.max(options.bandGap ?? 150, wireClear + 24)
  const zonePad = options.zonePad ?? 26

  // -- nodes (copies; we set position) + deterministic jitter source --------
  const nodes = new Map<string, Node>()
  for (const node of graph.nodes) nodes.set(node.id, { ...node })
  const ids = [...nodes.keys()].sort()
  const idIndex = new Map<string, number>()
  for (const [i, id] of ids.entries()) idIndex.set(id, i)
  const jitter = (id: string, salt: number): number => {
    if (!microAdaptation) return 0
    const seq = (((idIndex.get(id) ?? 0) + 1) * (1 / PHI) + salt * 0.3719) % 1
    return seq - 0.5
  }

  // -- logical edges (parallel links aggregated) -----------------------------
  const logical = new Map<string, LogicalEdge>()
  for (const link of graph.links) {
    const a = link.from.node
    const b = link.to.node
    if (a === b || !nodes.has(a) || !nodes.has(b)) continue
    const key = pairKey(a, b)
    const bw = linkSpeedBps(link) ?? 0
    const existing = logical.get(key)
    if (existing) {
      existing.bw += bw
      existing.count++
      existing.redundancy = existing.redundancy || link.redundancy !== undefined
    } else {
      logical.set(key, {
        a: a < b ? a : b,
        b: a < b ? b : a,
        bw,
        count: 1,
        redundancy: link.redundancy !== undefined,
      })
    }
  }
  const edges = [...logical.values()].sort((x, y) =>
    pairKey(x.a, x.b) < pairKey(y.a, y.b) ? -1 : 1,
  )
  const neighbors = new Map<string, Map<string, LogicalEdge>>()
  for (const id of ids) neighbors.set(id, new Map())
  for (const edge of edges) {
    neighbors.get(edge.a)?.set(edge.b, edge)
    neighbors.get(edge.b)?.set(edge.a, edge)
  }

  // -- zones ------------------------------------------------------------------
  // The placement quotient follows the GRAPH's own grouping first: a node's
  // `parent` subgraph is the priority-merged grouping (the strongest source's
  // declaration — e.g. Zabbix host groups), so it wins over the `location`
  // metadata a weaker source contributed. Without this, a merged graph got
  // PLACED by rack location while its host-group boxes were drawn as
  // member-bboxes over scattered members — 46 giant overlapping rectangles.
  // `location` remains the fallback for graphs whose nodes carry no parent
  // (the original TTDB-style input), then solo.
  const subgraphById = new Map<string, Subgraph>()
  for (const sg of graph.subgraphs ?? []) subgraphById.set(sg.id, sg)
  const PARENT_ZONE_PREFIX = '__sg:'
  const zoneOf = (id: string): string => {
    const node = nodes.get(id)
    const parent = node?.parent
    if (parent && subgraphById.has(parent)) return `${PARENT_ZONE_PREFIX}${parent}`
    const loc = node?.metadata?.['location']
    return typeof loc === 'string' && loc !== '' ? loc : `__solo:${id}`
  }

  // -- bandwidth classes + shared-service sinks --------------------------------
  // A sink (default-route firewall, shared service) touches everything over
  // thin links: high degree, no trunk-class bandwidth. It must not anchor
  // the hierarchy (v2 §7.5 sink guard), must not shortcut BFS depths, and
  // lives on its own rail below the zones instead of bloating one zone box.
  let globalMaxBw = 0
  const maxBwOf = new Map<string, number>()
  for (const id of ids) {
    let best = 0
    for (const edge of neighbors.get(id)?.values() ?? []) best = Math.max(best, edge.bw)
    maxBwOf.set(id, best)
    globalMaxBw = Math.max(globalMaxBw, best)
  }
  const trunkClass = (id: string): boolean =>
    globalMaxBw <= 0 || (maxBwOf.get(id) ?? 0) >= globalMaxBw * 0.5
  const sinkSet = new Set<string>()
  for (const id of ids) {
    if ((neighbors.get(id)?.size ?? 0) >= 8 && !trunkClass(id)) sinkSet.add(id)
  }

  // -- hierarchy depth: apex from role tiers, then undirected BFS -------------
  const depth = computeDepths(ids, nodes, neighbors, trunkClass, sinkSet)

  // -- port-aware node sizing (engine-era consideration, composite form) ------
  // The flat-tree engine grew each node so every face could seat its
  // ports (nodeFootprint). The composite path bypassed that, so dense
  // nodes crammed ports and the router's width-aware slot pass had to
  // scale them down. Restored with the ROUTER'S slot model (not the
  // 40px label slots of the flat tree — those blow up a schematic this
  // dense): each link claims max(16, width+6) on its face, faces
  // estimated from hierarchy (shallower neighbor → top, deeper →
  // bottom, same depth → sides), which is the same convention
  // alignPortsToPeers enforces after placement. Explicit node.size
  // always wins (hand-drawn diagrams).
  {
    interface FaceDemand {
      top: number
      bottom: number
      left: number
      right: number
    }
    const demand = new Map<string, FaceDemand>()
    const seat = (selfId: string, otherId: string, slot: number): void => {
      if (!nodes.has(selfId) || !nodes.has(otherId)) return
      const faces = demand.get(selfId) ?? { top: 0, bottom: 0, left: 0, right: 0 }
      // sinks live on the bottom rail: everything reaches them from above
      const dSelf = sinkSet.has(selfId) ? Number.POSITIVE_INFINITY : (depth.get(selfId) ?? 0)
      const dOther = sinkSet.has(otherId) ? Number.POSITIVE_INFINITY : (depth.get(otherId) ?? 0)
      if (dOther < dSelf) faces.top += slot
      else if (dOther > dSelf) faces.bottom += slot
      else if (faces.left <= faces.right) faces.left += slot
      else faces.right += slot
      demand.set(selfId, faces)
    }
    for (const link of graph.links) {
      const linkWidth = widthAware ? getLinkWidthForMode(link, 'linear') : 1
      const slot = Math.max(16, linkWidth + 6)
      seat(link.from.node, link.to.node, slot)
      seat(link.to.node, link.from.node, slot)
    }
    for (const [id, faces] of demand) {
      const node = nodes.get(id)
      if (!node || node.size) continue
      const body = resolveNodeSize(node)
      const width = Math.max(
        body.width,
        faces.top + 16,
        faces.bottom + 16,
        options.minNodeWidths?.get(id) ?? 0,
      )
      const height = Math.max(
        body.height,
        faces.left + 12,
        faces.right + 12,
        options.minNodeHeights?.get(id) ?? 0,
      )
      if (width > body.width || height > body.height) node.size = { width, height }
    }
  }

  // -- label-aware corridors ----------------------------------------------------
  // Ports own labels, and labels are geometry: the corridor between two
  // facing rows must hold BOTH rows' label lanes (vertical labels run
  // along the wire), and the gap between side-by-side units must hold a
  // side label. Derived from the actual longest names per direction —
  // pathological data (machine-id port names) makes the figure larger,
  // never overlapping; clean data tightens it automatically.
  // Resolve the DISPLAY label exactly like port placement does (port id
  // → NodePort.label); link endpoints carry port IDs, which can be long
  // machine identifiers that are never rendered.
  const displayPortLabel = (nodeId: string, portRef: unknown): string | undefined => {
    if (typeof portRef !== 'string' || portRef.length === 0) return undefined
    const owner = nodes.get(nodeId)
    const port = owner?.ports?.find((p) => p.id === portRef)
    return shortIfName(port?.label ?? portRef)
  }
  // DIRECTIONAL reach: a label occupies space only on the face it sits
  // on. A leaf whose links all go UP has top labels only — reserving
  // room below it would put whitespace where no label can ever exist
  // (that exact defect shipped once: every row paid for both directions).
  const reachUpOf = new Map<string, number>() // top-face labels (links to shallower peers)
  const reachDownOf = new Map<string, number>() // bottom-face labels (links to deeper peers)
  const lateralReachOf = new Map<string, number>()
  for (const link of graph.links) {
    const dFrom = depth.get(link.from.node) ?? 0
    const dTo = depth.get(link.to.node) ?? 0
    for (const [nodeId, portRef, dSelf, dPeer] of [
      [link.from.node, link.from.port, dFrom, dTo],
      [link.to.node, link.to.port, dTo, dFrom],
    ] as const) {
      const label = displayPortLabel(nodeId, portRef)
      if (label === undefined) continue
      const reach = PORT_LABEL_BOX_OFFSET + portLabelLength(label)
      if (dSelf === dPeer) {
        lateralReachOf.set(nodeId, Math.max(lateralReachOf.get(nodeId) ?? 0, reach))
      } else if (dPeer < dSelf) {
        reachUpOf.set(nodeId, Math.max(reachUpOf.get(nodeId) ?? 0, reach))
      } else {
        reachDownOf.set(nodeId, Math.max(reachDownOf.get(nodeId) ?? 0, reach))
      }
    }
  }
  // Bases; the zone-local layout raises them per zone from that zone's
  // own longest labels, so one verbose vendor naming scheme doesn't
  // inflate every zone in the figure.
  const rowGapBase = Math.max(options.rowGap ?? 56, wireClear + 16)
  const cellGapXBase = Math.max(options.cellGapX ?? 32, wireClear + 12)

  // -- redundant pairs ---------------------------------------------------------
  const pairedWith = detectPairs(ids, nodes, edges, neighbors, zoneOf, depth)

  // -- units -------------------------------------------------------------------
  const PAIR_GAP = 16
  const units: Unit[] = []
  const unitOf = new Map<string, string>()
  // Containment beats the rail heuristic: a sink that BELONGS to a group
  // (has a real zone) seats inside that group's box — on its bottom row —
  // instead of being exiled to the global rail 10k+ px away from the box
  // that claims it. Only group-less sinks still rail. Sink semantics for
  // depth anchoring / zone ordering are unchanged (they're about graph
  // traversal, not seating).
  let maxFiniteDepth = 0
  for (const d of depth.values()) {
    if (Number.isFinite(d)) maxFiniteDepth = Math.max(maxFiniteDepth, d)
  }
  const railSink = (id: string): boolean => sinkSet.has(id) && zoneOf(id).startsWith('__solo:')
  for (const id of ids) {
    if (railSink(id)) continue // group-less sinks live on their own rail
    const partner = pairedWith.get(id)
    if (partner !== undefined && partner < id) continue
    const members = partner !== undefined ? [id, partner].sort() : [id]
    const unitId = members.join('+')
    let width = (members.length - 1) * PAIR_GAP
    let height = 0
    let minDepth = Number.POSITIVE_INFINITY
    for (const member of members) {
      const node = nodes.get(member)
      if (!node) continue
      const size = resolveNodeSize(node)
      width += size.width
      height = Math.max(height, size.height)
      // A seated sink goes to its zone's LAST row — it feeds everything,
      // so it reads as the zone's collector shelf.
      minDepth = Math.min(
        minDepth,
        sinkSet.has(member) ? maxFiniteDepth + 1 : (depth.get(member) ?? 0),
      )
    }
    units.push({ id: unitId, members, width, height, zone: zoneOf(id), depth: minDepth })
    for (const member of members) unitOf.set(member, unitId)
  }
  const unitById = new Map<string, Unit>()
  for (const unit of units) unitById.set(unit.id, unit)

  // unit-level adjacency (skip intra-unit edges) and primary parents
  const unitEdges = new Map<string, { a: string; b: string; bw: number }>()
  for (const edge of edges) {
    const ua = unitOf.get(edge.a)
    const ub = unitOf.get(edge.b)
    if (ua === undefined || ub === undefined || ua === ub) continue
    const key = pairKey(ua, ub)
    const existing = unitEdges.get(key)
    if (existing) existing.bw += edge.bw
    else unitEdges.set(key, { a: ua < ub ? ua : ub, b: ua < ub ? ub : ua, bw: edge.bw })
  }
  const primaryParent = new Map<string, string>()
  for (const unit of units) {
    let best: { parent: string; bw: number } | undefined
    for (const edge of unitEdges.values()) {
      const other = edge.a === unit.id ? edge.b : edge.b === unit.id ? edge.a : undefined
      if (other === undefined) continue
      const otherUnit = unitById.get(other)
      if (!otherUnit || otherUnit.depth >= unit.depth) continue
      if (!best || edge.bw > best.bw || (edge.bw === best.bw && other < best.parent)) {
        best = { parent: other, bw: edge.bw }
      }
    }
    if (best) primaryParent.set(unit.id, best.parent)
  }

  // -- per-zone local layout (rows by relative depth) --------------------------
  const zoneIds = [...new Set(units.map((u) => u.zone))].sort()
  const zoneUnits = new Map<string, Unit[]>()
  for (const zone of zoneIds) zoneUnits.set(zone, [])
  for (const unit of units) zoneUnits.get(unit.zone)?.push(unit)
  for (const list of zoneUnits.values()) list.sort((a, b) => (a.id < b.id ? -1 : 1))

  const localX = new Map<string, number>()
  const localY = new Map<string, number>()
  const zoneBox = new Map<string, { w: number; h: number }>()
  const zoneRows = new Map<string, Unit[][]>()
  // Label-aware corridors are PER ADJACENT PAIR, not per zone: the gap
  // between two specific units (or rows) holds exactly the labels that
  // actually face each other. A single verbose name pays only where it
  // sits instead of inflating the whole zone.
  const unitLReach = (unit: Unit): number =>
    Math.max(0, ...unit.members.map((m) => lateralReachOf.get(m) ?? 0))
  const unitUpReach = (unit: Unit): number =>
    Math.max(0, ...unit.members.map((m) => reachUpOf.get(m) ?? 0))
  const unitDownReach = (unit: Unit): number =>
    Math.max(0, ...unit.members.map((m) => reachDownOf.get(m) ?? 0))
  const pairGap = (a: Unit, b: Unit): number =>
    Math.max(cellGapXBase, unitLReach(a) + unitLReach(b) + 8)
  const rowDownReach = (row: Unit[]): number => Math.max(0, ...row.map(unitDownReach))
  const rowUpReach = (row: Unit[]): number => Math.max(0, ...row.map(unitUpReach))
  for (const zone of zoneIds) {
    const members = zoneUnits.get(zone) ?? []
    const minDepth = Math.min(...members.map((u) => u.depth))
    const rowMap = new Map<number, Unit[]>()
    for (const unit of members) {
      const row = unit.depth - minDepth
      const list = rowMap.get(row)
      if (list) list.push(unit)
      else rowMap.set(row, [unit])
    }
    const rowKeys = [...rowMap.keys()].sort((a, b) => a - b)
    // Wrap each depth-row at a max width. Depth alone decided the row, so a
    // zone with 100+ same-depth members (a big host group) became one
    // figure-wide strip — the "everything in a single line" defect.
    //
    // The wrap target scales with the ZONE's content (landscape-ish aspect),
    // not a fixed constant: a fixed cap made every box equally wide, so the
    // band packer fit only ONE box per band and the whole figure degenerated
    // into a single vertical column. Small groups now wrap into compact
    // boxes that pack several per band. Deterministic: chunks are cut in
    // the original sort order.
    let contentArea = 0
    let widestUnit = 0
    for (const unit of members) {
      contentArea += (unit.width + cellGapXBase) * (unit.height + rowGapBase / 2)
      widestUnit = Math.max(widestUnit, unit.width)
    }
    // The only principled floor: a row must fit its widest unit (anything
    // narrower just breaks every row anyway). No artificial cap — the
    // content-derived target is already aspect-balanced, and the global
    // proportion is the search cost's job, not a constant's.
    const zoneRowMaxW = Math.max(widestUnit, Math.round(Math.sqrt(contentArea * PHI)))
    const rows: Unit[][] = []
    for (const key of rowKeys) {
      const depthRow = rowMap.get(key) ?? []
      let current: Unit[] = []
      let width = 0
      for (const unit of depthRow) {
        const prev = current[current.length - 1]
        const addition = unit.width + (prev ? pairGap(prev, unit) : 0)
        if (current.length > 0 && width + addition > zoneRowMaxW) {
          rows.push(current)
          current = [unit]
          width = unit.width
        } else {
          current.push(unit)
          width += addition
        }
      }
      if (current.length > 0) rows.push(current)
    }
    let maxRowWidth = 0
    let y = zonePad
    const placeRow = (row: Unit[], rowY: number, rowHeight: number): void => {
      let x = zonePad
      for (const [i, unit] of row.entries()) {
        localX.set(unit.id, x + unit.width / 2 + jitter(unit.members[0] ?? unit.id, 3) * 8)
        localY.set(unit.id, rowY + rowHeight / 2 + jitter(unit.members[0] ?? unit.id, 7) * 6)
        x += unit.width
        const next = row[i + 1]
        if (next) x += pairGap(unit, next)
      }
    }
    const rowYs: number[] = []
    const rowHeights: number[] = []
    for (const [rowIndex, row] of rows.entries()) {
      let rowWidth = 0
      for (const [i, unit] of row.entries()) {
        rowWidth += unit.width
        const next = row[i + 1]
        if (next) rowWidth += pairGap(unit, next)
      }
      maxRowWidth = Math.max(maxRowWidth, rowWidth)
      const rowHeight = Math.max(...row.map((u) => u.height))
      rowYs.push(y)
      rowHeights.push(rowHeight)
      placeRow(row, y, rowHeight)
      const nextRow = rows[rowIndex + 1]
      y += rowHeight
      // only the labels that actually FACE this gap pay for it: the
      // upper row's bottom labels + the lower row's top labels
      if (nextRow) y += Math.max(rowGapBase, rowDownReach(row) + rowUpReach(nextRow) + 8)
    }
    // intra-zone barycenter ordering (v3 §24): two sweeps pulling each
    // unit next to its in-zone neighbors before global refinement
    const intraNeighborX = (unit: Unit): number => {
      let sum = 0
      let count = 0
      for (const member of unit.members) {
        for (const [other] of neighbors.get(member) ?? []) {
          const otherUnit = unitById.get(unitOf.get(other) ?? '')
          if (!otherUnit || otherUnit.zone !== zone || otherUnit.id === unit.id) continue
          sum += localX.get(otherUnit.id) ?? 0
          count++
        }
      }
      return count > 0 ? sum / count : (localX.get(unit.id) ?? 0)
    }
    if (microAdaptation) {
      for (let sweep = 0; sweep < 2; sweep++) {
        for (const [i, row] of rows.entries()) {
          if (row.length < 2) continue
          row.sort((a, b) => intraNeighborX(a) - intraNeighborX(b) || (a.id < b.id ? -1 : 1))
          placeRow(row, rowYs[i] ?? zonePad, rowHeights[i] ?? 0)
        }
      }
    }
    zoneRows.set(zone, rows)
    // Box width from the FINAL unit positions: the barycenter sweeps re-lay
    // rows with order-dependent pair gaps, so a row can end up wider than
    // the pre-sweep measurement — sizing the box from the stale width left
    // the rightmost units sticking out of their own zone box.
    let finalMaxX = maxRowWidth + zonePad
    for (const unit of members) {
      finalMaxX = Math.max(finalMaxX, (localX.get(unit.id) ?? 0) + unit.width / 2)
    }
    // The box reserves its OWN outer-face port-label reach: labels are
    // node-owned geometry that must sit INSIDE the box, and the band packer
    // can only keep boxes apart if it knows their true extent. Inner-face
    // labels are already paid for by the pair/row corridors.
    const latReach = Math.max(0, ...members.map(unitLReach))
    const firstRow = rows[0]
    const lastRow = rows[rows.length - 1]
    const topReach = firstRow ? rowUpReach(firstRow) : 0
    const botReach = lastRow ? rowDownReach(lastRow) : 0
    if (latReach > 0 || topReach > 0) {
      for (const unit of members) {
        localX.set(unit.id, (localX.get(unit.id) ?? 0) + latReach)
        localY.set(unit.id, (localY.get(unit.id) ?? 0) + topReach)
      }
    }
    zoneBox.set(zone, {
      w: finalMaxX + zonePad + latReach * 2,
      h: y + zonePad + topReach + botReach,
    })
  }

  // -- quotient: bands by zone rank, child-block packing under feeders ---------
  const zoneRank = new Map<string, number>()
  for (const zone of zoneIds) {
    const members = zoneUnits.get(zone) ?? []
    zoneRank.set(zone, Math.min(...members.map((u) => u.depth)))
  }
  const zoneAdj = new Map<string, Map<string, number>>()
  for (const zone of zoneIds) zoneAdj.set(zone, new Map())
  for (const edge of unitEdges.values()) {
    const za = unitById.get(edge.a)?.zone
    const zb = unitById.get(edge.b)?.zone
    if (za === undefined || zb === undefined || za === zb) continue
    const weight =
      primaryParent.get(edge.a) === edge.b || primaryParent.get(edge.b) === edge.a ? 3 : 1
    zoneAdj.get(za)?.set(zb, (zoneAdj.get(za)?.get(zb) ?? 0) + weight)
    zoneAdj.get(zb)?.set(za, (zoneAdj.get(zb)?.get(za) ?? 0) + weight)
  }
  const zoneParent = new Map<string, string | undefined>()
  for (const zone of zoneIds) {
    const counts = new Map<string, number>()
    for (const unit of zoneUnits.get(zone) ?? []) {
      const parent = primaryParent.get(unit.id)
      if (parent === undefined) continue
      const parentZone = unitById.get(parent)?.zone
      if (parentZone === undefined || parentZone === zone) continue
      counts.set(parentZone, (counts.get(parentZone) ?? 0) + 1)
    }
    let best: string | undefined
    let bestCount = 0
    for (const [zone2, count] of [...counts].sort()) {
      if (count > bestCount) {
        best = zone2
        bestCount = count
      }
    }
    zoneParent.set(zone, best)
  }

  // Label corridors at band boundaries are PER BOUNDARY: only the links
  // that actually cross boundary i pay for it (the global-max version
  // inflated every band gap to the single worst label in the graph —
  // the "giant whitespace" defect). Down-labels from the upper band and
  // up-labels from the lower band share the corridor, so reserve their
  // sum where it exceeds the base gap. Goes through the same bandExtra
  // channel as routing congestion feedback.
  const rankValues = [...new Set([...zoneRank.values()])].sort((a, b) => a - b)
  const bandIndexOfRank = new Map(rankValues.map((rank, i) => [rank, i]))
  const bandOfZone = (zone: string): number => bandIndexOfRank.get(zoneRank.get(zone) ?? 0) ?? 0
  const downNeed = new Map<number, number>() // boundary above band i
  const upNeed = new Map<number, number>()
  for (const link of graph.links) {
    const za = zoneOf(link.from.node)
    const zb = zoneOf(link.to.node)
    if (za === zb || sinkSet.has(link.from.node) || sinkSet.has(link.to.node)) continue
    const ba = bandOfZone(za)
    const bb = bandOfZone(zb)
    if (ba === bb) continue
    const upperNode = ba < bb ? link.from.node : link.to.node
    const lowerNode = ba < bb ? link.to.node : link.from.node
    const upperBand = Math.min(ba, bb)
    const lowerBand = Math.max(ba, bb)
    const upperReach = reachDownOf.get(upperNode) ?? 0
    const lowerReach = reachUpOf.get(lowerNode) ?? 0
    downNeed.set(upperBand + 1, Math.max(downNeed.get(upperBand + 1) ?? 0, upperReach))
    upNeed.set(lowerBand, Math.max(upNeed.get(lowerBand) ?? 0, lowerReach))
  }
  const labelBandExtra = new Map<number, number>(options.bandExtra ?? [])
  for (const i of new Set([...downNeed.keys(), ...upNeed.keys()])) {
    const need = (downNeed.get(i) ?? 0) + (upNeed.get(i) ?? 0) + 8 - bandGap
    if (need > 0) labelBandExtra.set(i, (labelBandExtra.get(i) ?? 0) + Math.ceil(need))
  }
  // per-zone DIRECTIONAL label reach, so compaction can't squeeze the
  // corridor the band extras just reserved (down-labels of the upper
  // block + up-labels of the lower block)
  const zoneDownReach = new Map<string, number>()
  const zoneUpReach = new Map<string, number>()
  for (const zone of zoneIds) {
    let down = 0
    let up = 0
    for (const unit of zoneUnits.get(zone) ?? []) {
      down = Math.max(down, unitDownReach(unit))
      up = Math.max(up, unitUpReach(unit))
    }
    zoneDownReach.set(zone, down)
    zoneUpReach.set(zone, up)
  }

  // Band width budget scales with CONTENT: zones widened (port slots,
  // label corridors) while a fixed 1700px budget stayed — bands wrapped
  // into ever more stacked sub-rows and the figure exploded vertically
  // (5000px tall, 1:2.7 aspect). Target a landscape-ish aspect instead:
  // budget = sqrt(total packed zone area × aspect), floored at 1700.
  let zoneArea = 0
  for (const [, box] of zoneBox) zoneArea += (box.w + zoneGap) * (box.h + bandGap)
  const maxBandW = options.maxBandW ?? Math.max(1700, Math.round(Math.sqrt(zoneArea * 1.5)))

  const zoneX = new Map<string, number>()
  const zoneY = new Map<string, number>()
  // Re-assigned when refinement widens a zone box (containment re-pack below).
  let { bandRanges, bandBlocks } = placeZoneBands(
    zoneIds,
    zoneRank,
    zoneAdj,
    zoneParent,
    zoneBox,
    zoneX,
    zoneY,
    zoneGap,
    bandGap,
    maxBandW,
    labelBandExtra,
    options.bandOrder,
    zoneDownReach,
    zoneUpReach,
    microAdaptation,
  )

  // -- port refine: pull units toward their cross-zone neighbors ---------------

  if (microAdaptation) {
    for (let pass = 0; pass < 2; pass++) {
      for (const zone of zoneIds) {
        const rows = zoneRows.get(zone) ?? []
        const box = zoneBox.get(zone)
        const originX = zoneX.get(zone)
        if (!box || originX === undefined) continue
        for (const row of rows) {
          for (const unit of row) {
            let sum = 0
            let weight = 0
            for (const edge of unitEdges.values()) {
              const other = edge.a === unit.id ? edge.b : edge.b === unit.id ? edge.a : undefined
              if (other === undefined) continue
              const otherUnit = unitById.get(other)
              if (!otherUnit || otherUnit.zone === zone) continue
              const otherX = (zoneX.get(otherUnit.zone) ?? 0) + (localX.get(other) ?? 0)
              const w =
                primaryParent.get(unit.id) === other || primaryParent.get(other) === unit.id ? 4 : 1
              sum += otherX * w
              weight += w
            }
            if (weight === 0) continue
            const target = sum / weight - originX
            const lo = unit.width / 2 + 8
            const hi = box.w - unit.width / 2 - 8
            const current = localX.get(unit.id) ?? lo
            localX.set(unit.id, Math.max(lo, Math.min(hi, current + (target - current) * 0.6)))
          }
          resolveRow(row, localX, box.w, pairGap)
        }
      }
    }
  }

  // -- search nudges (hill-climb ±x moves, v3 §32) -------------------------------
  if (options.nudges) {
    for (const [unitId, dx] of options.nudges) {
      const unit = unitById.get(unitId)
      const box = unit ? zoneBox.get(unit.zone) : undefined
      if (!unit || !box) continue
      const lo = unit.width / 2 + 8
      const hi = box.w - unit.width / 2 - 8
      const current = localX.get(unitId) ?? lo
      localX.set(unitId, Math.max(lo, Math.min(hi, current + dx)))
    }
    for (const zone of zoneIds) {
      const box = zoneBox.get(zone)
      if (!box) continue
      for (const row of zoneRows.get(zone) ?? []) resolveRow(row, localX, box.w, pairGap)
    }
  }

  // -- snap under primary parent, then re-separate ------------------------------
  if (microAdaptation) {
    const sortedUnits = [...units].sort((a, b) => a.depth - b.depth || (a.id < b.id ? -1 : 1))
    for (const unit of sortedUnits) {
      const parent = primaryParent.get(unit.id)
      if (parent === undefined) continue
      const parentUnit = unitById.get(parent)
      const box = zoneBox.get(unit.zone)
      if (!parentUnit || !box) continue
      const parentGlobal = (zoneX.get(parentUnit.zone) ?? 0) + (localX.get(parent) ?? 0)
      const selfGlobal = (zoneX.get(unit.zone) ?? 0) + (localX.get(unit.id) ?? 0)
      const diff = parentGlobal - selfGlobal
      if (Math.abs(diff) <= 0.5 || Math.abs(diff) >= 40) continue
      const lo = unit.width / 2 + 8
      const hi = box.w - unit.width / 2 - 8
      const current = localX.get(unit.id) ?? lo
      localX.set(unit.id, Math.max(lo, Math.min(hi, current + diff)))
    }
    for (const zone of zoneIds) {
      const box = zoneBox.get(zone)
      if (!box) continue
      for (const row of zoneRows.get(zone) ?? []) resolveRow(row, localX, box.w, pairGap)
    }
  }

  // -- containment repair: refinement (cross-zone pulls, nudges, snap) reorders
  // rows, and the label-aware pair gaps are ORDER-DEPENDENT — a re-ordered row
  // can need more width than the box measured at zone-local time, and
  // resolveRow's left-shift can only reclaim the leading slack. Grow each box
  // to its final content extent and re-pack the bands so widened boxes don't
  // collide; a unit must never sit outside its own zone box.
  {
    let widened = false
    for (const zone of zoneIds) {
      const box = zoneBox.get(zone)
      if (!box) continue
      let maxExtent = 0
      for (const unit of zoneUnits.get(zone) ?? []) {
        maxExtent = Math.max(maxExtent, (localX.get(unit.id) ?? 0) + unit.width / 2)
      }
      const needed = maxExtent + zonePad
      if (needed > box.w + 0.5) {
        zoneBox.set(zone, { w: needed, h: box.h })
        widened = true
      }
    }
    if (widened) {
      zoneX.clear()
      zoneY.clear()
      // Same aspect-targeted band budget formula, fed the WIDENED areas —
      // reusing the stale budget squeezed the wider boxes into more stacked
      // bands and the figure went 1:5 portrait.
      let widenedArea = 0
      for (const [, box] of zoneBox) widenedArea += (box.w + zoneGap) * (box.h + bandGap)
      const repackBandW =
        options.maxBandW ?? Math.max(1700, Math.round(Math.sqrt(widenedArea * 1.5)))
      ;({ bandRanges, bandBlocks } = placeZoneBands(
        zoneIds,
        zoneRank,
        zoneAdj,
        zoneParent,
        zoneBox,
        zoneX,
        zoneY,
        zoneGap,
        bandGap,
        repackBandW,
        labelBandExtra,
        options.bandOrder,
        zoneDownReach,
        zoneUpReach,
        microAdaptation,
      ))
    }
  }

  // -- compose to absolute centers ----------------------------------------------
  for (const unit of units) {
    const gx = (zoneX.get(unit.zone) ?? 0) + (localX.get(unit.id) ?? 0)
    const gy = (zoneY.get(unit.zone) ?? 0) + (localY.get(unit.id) ?? 0)
    if (unit.members.length === 1) {
      const member = unit.members[0]
      const node = member === undefined ? undefined : nodes.get(member)
      if (node) node.position = { x: gx, y: gy }
      continue
    }
    const order = options.pairFlips?.has(unit.id) ? [...unit.members].reverse() : unit.members
    let x = gx - unit.width / 2
    for (const member of order) {
      const node = nodes.get(member)
      if (!node) continue
      const size = resolveNodeSize(node)
      node.position = { x: x + size.width / 2, y: gy }
      x += size.width + PAIR_GAP
    }
  }

  // -- normalize to positive coordinates ------------------------------------------
  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  for (const zone of zoneIds) {
    const box = zoneBox.get(zone)
    const x = zoneX.get(zone)
    const y = zoneY.get(zone)
    if (!box || x === undefined || y === undefined) continue
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x + box.w)
    maxY = Math.max(maxY, y + box.h)
  }
  const PAD = 60
  const shiftX = PAD - minX
  const shiftY = PAD - minY
  for (const node of nodes.values()) {
    if (!node.position) continue
    node.position = { x: node.position.x + shiftX, y: node.position.y + shiftY }
  }

  // -- sink rail: GROUP-LESS shared-service sinks sit on their own row below
  //    the zones (v3 collector rail). Sinks that belong to a group were
  //    seated inside their zone above — containment wins over the rail.
  let railBottom = maxY - minY + PAD
  const railSinkIds = [...sinkSet].filter((id) => railSink(id)).sort()
  if (railSinkIds.length > 0) {
    const railY = maxY - minY + PAD + 110
    const sinkIds = railSinkIds
    let railWidth = 0
    let railHeight = 0
    for (const id of sinkIds) {
      const node = nodes.get(id)
      if (!node) continue
      const size = resolveNodeSize(node)
      railWidth += size.width + 40
      railHeight = Math.max(railHeight, size.height)
    }
    railWidth -= 40
    const contentWidth = maxX - minX
    let x = PAD + Math.max(0, (contentWidth - railWidth) / 2)
    for (const id of sinkIds) {
      const node = nodes.get(id)
      if (!node) continue
      const size = resolveNodeSize(node)
      node.position = { x: x + size.width / 2, y: railY + railHeight / 2 }
      x += size.width + 40
    }
    railBottom = railY + railHeight
  }

  // -- subgraphs: synthetic zone boxes + original subgraph bounds ------------------
  const subgraphs = new Map<string, Subgraph>()
  const zoneMembers = new Map<string, string[]>()
  for (const zone of zoneIds) {
    const members: string[] = []
    for (const unit of zoneUnits.get(zone) ?? []) members.push(...unit.members)
    zoneMembers.set(zone, members)
    if (zone.startsWith('__solo:') || members.length < 2) continue
    const box = zoneBox.get(zone)
    const x = zoneX.get(zone)
    const y = zoneY.get(zone)
    if (!box || x === undefined || y === undefined) continue
    const bounds = { x: x + shiftX, y: y + shiftY, width: box.w, height: box.h }
    // A parent-subgraph zone IS that subgraph: give the original its zone
    // box (label/style preserved) instead of drawing a synthetic twin plus
    // a member-bbox later.
    const original = zone.startsWith('__sg:') ? subgraphById.get(zone.slice(5)) : undefined
    if (original) {
      subgraphs.set(original.id, { ...original, bounds })
      continue
    }
    subgraphs.set(`${ZONE_SUBGRAPH_PREFIX}${zone}`, {
      id: `${ZONE_SUBGRAPH_PREFIX}${zone}`,
      label: zone,
      bounds,
      style: { strokeDasharray: '5 4' },
    })
  }
  // Subgraphs nest. A grouping that contains most of the graph is not
  // noise to drop — it is the OUTER scope (e.g. the discovered topology
  // boundary), so it becomes the enclosing parent box around the zones
  // instead of a member-bounds box that would swallow them. (#438 used
  // to skip these entirely; that silently discarded scope semantics.)
  const enclosing: { sg: Subgraph; count: number }[] = []
  for (const original of graph.subgraphs ?? []) {
    // Already placed as a zone box above — don't overwrite it with a
    // member-bbox (that was the giant-overlapping-rectangles bug).
    if (subgraphs.has(original.id)) continue
    let memberCount = 0
    for (const node of nodes.values()) if (node.parent === original.id) memberCount++
    if (memberCount >= nodes.size * 0.6) {
      enclosing.push({ sg: original, count: memberCount })
      continue
    }
    subgraphs.set(original.id, { ...original, bounds: boundsOfMembers(original, nodes) })
  }
  let allSubgraphs = subgraphs
  if (enclosing.length > 0) {
    let ux1 = Number.POSITIVE_INFINITY
    let uy1 = Number.POSITIVE_INFINITY
    let ux2 = Number.NEGATIVE_INFINITY
    let uy2 = Number.NEGATIVE_INFINITY
    for (const node of nodes.values()) {
      if (!node.position) continue
      const size = resolveNodeSize(node)
      ux1 = Math.min(ux1, node.position.x - size.width / 2)
      uy1 = Math.min(uy1, node.position.y - size.height / 2)
      ux2 = Math.max(ux2, node.position.x + size.width / 2)
      uy2 = Math.max(uy2, node.position.y + size.height / 2)
    }
    for (const sg of subgraphs.values()) {
      if (!sg.bounds) continue
      ux1 = Math.min(ux1, sg.bounds.x)
      uy1 = Math.min(uy1, sg.bounds.y)
      ux2 = Math.max(ux2, sg.bounds.x + sg.bounds.width)
      uy2 = Math.max(uy2, sg.bounds.y + sg.bounds.height)
    }
    // wider membership = outer ring; outermost first in the map so it
    // renders behind the zones it contains
    enclosing.sort((a, b) => a.count - b.count || (a.sg.id < b.sg.id ? -1 : 1))
    const frames: [string, Subgraph][] = []
    for (const [level, entry] of enclosing.entries()) {
      const pad = 24 + 18 * level
      frames.unshift([
        entry.sg.id,
        {
          ...entry.sg,
          bounds: {
            x: ux1 - pad,
            y: uy1 - pad,
            width: ux2 - ux1 + pad * 2,
            height: uy2 - uy1 + pad * 2,
          },
        },
      ])
    }
    allSubgraphs = new Map([...frames, ...subgraphs])
  }

  // primary dependency edges at node level (for emphasis styling / search)
  const primaryEdges = new Set<string>()
  for (const unit of units) {
    const parent = primaryParent.get(unit.id)
    if (parent === undefined) continue
    const parentUnit = unitById.get(parent)
    if (!parentUnit) continue
    for (const m of unit.members) {
      for (const p of parentUnit.members) {
        if (neighbors.get(m)?.has(p)) primaryEdges.add(pairKey(m, p))
      }
    }
  }

  return {
    nodes,
    subgraphs: allSubgraphs,
    bounds: {
      x: 0,
      y: 0,
      width: maxX - minX + PAD * 2,
      height: railBottom + PAD,
    },
    zones: zoneMembers,
    pairs: units.filter((u) => u.members.length === 2).map((u) => u.id),
    bands: bandRanges.map((b) => ({ top: b.top + shiftY, bottom: b.bottom + shiftY })),
    primaryEdges,
    sinks: [...sinkSet].sort(),
    heartbeats: collectHeartbeats(units, neighbors),
    depths: depth,
    bandBlocks,
    scopes: enclosing.map((e) => e.sg.id),
  }
}

/** Direct links between the two members of a pair are couplings, not wires. */
function collectHeartbeats(
  units: readonly Unit[],
  neighbors: Map<string, Map<string, LogicalEdge>>,
): Set<string> {
  const heartbeats = new Set<string>()
  for (const unit of units) {
    if (unit.members.length !== 2) continue
    const [a, b] = unit.members
    if (a !== undefined && b !== undefined && neighbors.get(a)?.has(b)) {
      heartbeats.add(pairKey(a, b))
    }
  }
  return heartbeats
}

// ============================================================================
// Helpers
// ============================================================================

function computeDepths(
  ids: readonly string[],
  nodes: Map<string, Node>,
  neighbors: Map<string, Map<string, LogicalEdge>>,
  trunkClass: (id: string) => boolean,
  sinkSet: ReadonlySet<string>,
): Map<string, number> {
  // Apex candidates must carry trunk-class bandwidth (v3 sink guard:
  // a shared last-resort firewall has a low device tier and 17 thin
  // links — without the gate it out-ranks the border routers).
  let bestTier = Number.POSITIVE_INFINITY
  const tierOf = new Map<string, number>()
  for (const id of ids) {
    if ((neighbors.get(id)?.size ?? 0) === 0) continue
    if (!trunkClass(id)) continue
    const hint = resolveTierFromSpec(nodes.get(id)?.spec)
    if (!hint) continue
    tierOf.set(id, hint.tier)
    bestTier = Math.min(bestTier, hint.tier)
  }
  let roots = ids.filter((id) => tierOf.get(id) === bestTier)
  // v3 apex rule (§16, generalized): within the top device tier, the
  // LOCATION hierarchy picks the border group. Split each location into
  // (prefix, trailing number), take the DOMINANT prefix family among the
  // candidates (most top-tier devices live in the network-core rooms),
  // and keep only the lowest two numbers in that family — on the
  // reference network that is exactly the three border routers.
  if (roots.length > 2) {
    const parseLoc = (id: string): { prefix: string; num: number } | undefined => {
      const loc = nodes.get(id)?.metadata?.['location']
      if (typeof loc !== 'string' || loc === '') return undefined
      const match = /^(.*?)(\d+)\s*$/.exec(loc)
      if (!match) return { prefix: loc, num: 0 }
      return { prefix: match[1] ?? loc, num: Number(match[2]) }
    }
    const familyCount = new Map<string, number>()
    for (const id of roots) {
      const parsed = parseLoc(id)
      if (!parsed) continue
      familyCount.set(parsed.prefix, (familyCount.get(parsed.prefix) ?? 0) + 1)
    }
    let family: string | undefined
    let familySize = 0
    for (const [prefix, count] of [...familyCount].sort()) {
      if (count > familySize) {
        family = prefix
        familySize = count
      }
    }
    if (family !== undefined && familySize >= 2) {
      const nums = [
        ...new Set(
          roots
            .map(parseLoc)
            .filter((p): p is { prefix: string; num: number } => p?.prefix === family)
            .map((p) => p.num),
        ),
      ].sort((a, b) => a - b)
      const keep = new Set(nums.slice(0, 2))
      const familyRoots = roots.filter((id) => {
        const parsed = parseLoc(id)
        return parsed?.prefix === family && keep.has(parsed.num)
      })
      if (familyRoots.length > 0) roots = familyRoots
    }
  }
  if (roots.length === 0) {
    let maxDegree = -1
    let best: string | undefined
    for (const id of ids) {
      const degree = neighbors.get(id)?.size ?? 0
      if (degree > maxDegree) {
        maxDegree = degree
        best = id
      }
    }
    roots = best === undefined ? [] : [best]
  }
  const depth = new Map<string, number>()
  const queue: string[] = []
  for (const root of roots) {
    depth.set(root, 0)
    queue.push(root)
  }
  while (queue.length > 0) {
    const current = queue.shift()
    if (current === undefined) break
    // never traverse THROUGH a sink — it touches everything and would
    // shortcut every depth to root+2
    if (sinkSet.has(current)) continue
    const currentDepth = depth.get(current) ?? 0
    const adj = neighbors.get(current)
    if (!adj) continue
    for (const next of [...adj.keys()].sort()) {
      if (depth.has(next)) continue
      depth.set(next, currentDepth + 1)
      queue.push(next)
    }
  }
  for (const id of ids) if (!depth.has(id)) depth.set(id, 0)
  return depth
}

function detectPairs(
  ids: readonly string[],
  nodes: Map<string, Node>,
  edges: readonly LogicalEdge[],
  neighbors: Map<string, Map<string, LogicalEdge>>,
  zoneOf: (id: string) => string,
  depth: Map<string, number>,
): Map<string, string> {
  const paired = new Map<string, string>()
  const tryPair = (a: string, b: string): void => {
    if (paired.has(a) || paired.has(b)) return
    paired.set(a, b)
    paired.set(b, a)
  }
  // 1) explicit redundancy field — the typed source of truth
  for (const edge of edges) {
    if (!edge.redundancy) continue
    if (zoneOf(edge.a) !== zoneOf(edge.b)) continue
    tryPair(edge.a, edge.b)
  }
  // 2) naming + structure fallback: same zone, twin-style names (stem or
  //    host part match), similar depth, and structural evidence — a direct
  //    interconnect OR a shared uplink. Jaccard/direct-only is wrong both
  //    ways (v3 §24/§30): true HA pairs often uplink to DIFFERENT routers
  //    on purpose, and some pairs have no direct heartbeat link at all.
  const candidates: { a: string; b: string; direct: boolean }[] = []
  for (const a of ids) {
    const nodeA = nodes.get(a)
    if (!nodeA) continue
    const labelA = labelOf(nodeA)
    for (const b of ids) {
      if (b <= a) continue
      if (zoneOf(a) !== zoneOf(b)) continue
      if (Math.abs((depth.get(a) ?? 0) - (depth.get(b) ?? 0)) > 1) continue
      const nodeB = nodes.get(b)
      if (!nodeB) continue
      const labelB = labelOf(nodeB)
      if (stemOf(labelA) !== stemOf(labelB) && hostOf(labelA) !== hostOf(labelB)) continue
      const direct = neighbors.get(a)?.has(b) ?? false
      let shared = false
      if (!direct) {
        for (const n of neighbors.get(a)?.keys() ?? []) {
          if (n !== b && neighbors.get(b)?.has(n)) {
            shared = true
            break
          }
        }
      }
      if (direct || shared) candidates.push({ a, b, direct })
    }
  }
  candidates.sort(
    (x, y) =>
      Number(y.direct) - Number(x.direct) || (pairKey(x.a, x.b) < pairKey(y.a, y.b) ? -1 : 1),
  )
  for (const candidate of candidates) tryPair(candidate.a, candidate.b)
  return paired
}

function placeZoneBands(
  zoneIds: readonly string[],
  zoneRank: Map<string, number>,
  zoneAdj: Map<string, Map<string, number>>,
  zoneParent: Map<string, string | undefined>,
  zoneBox: Map<string, { w: number; h: number }>,
  zoneX: Map<string, number>,
  zoneY: Map<string, number>,
  zoneGap: number,
  bandGap: number,
  maxBandW: number,
  bandExtra?: ReadonlyMap<number, number>,
  bandOrder?: ReadonlyMap<number, readonly string[]>,
  zoneDownReach?: ReadonlyMap<string, number>,
  zoneUpReach?: ReadonlyMap<string, number>,
  microAdaptation = true,
): { bandRanges: { top: number; bottom: number }[]; bandBlocks: string[][] } {
  const ranks = [...new Set(zoneIds.map((z) => zoneRank.get(z) ?? 0))].sort((a, b) => a - b)
  const centerOf = new Map<string, number>()
  for (const zone of zoneIds) centerOf.set(zone, 0)
  const bandRanges: { top: number; bottom: number }[] = []
  const bandBlocks: string[][] = []

  let y = 0
  const placed = new Set<string>()
  const placedBlocks: {
    x: number
    y: number
    w: number
    h: number
    zones: string[]
    rects: { x: number; relY: number; w: number; h: number }[]
  }[] = []
  for (const [bandIndex, rank] of ranks.entries()) {
    y += bandExtra?.get(bandIndex) ?? 0
    const bandZones = zoneIds.filter((z) => (zoneRank.get(z) ?? 0) === rank)
    // group zones under their (already placed) feeder zone
    const groups = new Map<string, string[]>()
    for (const zone of bandZones) {
      const parent = zoneParent.get(zone)
      const key = parent !== undefined && placed.has(parent) ? parent : `~${zone}`
      const list = groups.get(key)
      if (list) list.push(zone)
      else groups.set(key, [zone])
    }
    interface Block {
      key: string
      zones: string[]
      w: number
      h: number
      offsets: Map<string, { x: number; y: number }>
      desired: number
    }
    const blocks: Block[] = []
    for (const [key, members] of [...groups].sort()) {
      if (!key.startsWith('~') && members.length >= 2) {
        // order siblings by connectivity (barycenter over placed zones),
        // not by raw centerOf — unplaced zones all carry centerOf 0, which
        // silently degraded the order to alphabetical (test6: N-6 landed
        // at the grid's right end by name, and the pod band inherited it)
        if (microAdaptation) {
          const sortKey = new Map<string, number>()
          for (const zone of members) sortKey.set(zone, barycenter(zone, zoneAdj, centerOf))
          members.sort((a, b) => (sortKey.get(a) ?? 0) - (sortKey.get(b) ?? 0) || (a < b ? -1 : 1))
        }
        // pick the column count whose widest grid row still fits the band
        // budget — a single block wider than maxBandW set the canvas width
        // for the whole figure (band wrap only splits BETWEEN blocks)
        let cols = Math.min(4, Math.ceil(Math.sqrt(members.length * 1.7)))
        const rowWidthFor = (c: number): number => {
          let widest = 0
          for (let start = 0; start < members.length; start += c) {
            const row = members.slice(start, start + c)
            let w = 0
            for (const zone of row) w += (zoneBox.get(zone)?.w ?? 0) + Math.round(zoneGap * 0.55)
            widest = Math.max(widest, w)
          }
          return widest
        }
        while (cols > 1 && rowWidthFor(cols) > maxBandW) cols--
        const gapInner = Math.round(zoneGap * 0.55)
        const offsets = new Map<string, { x: number; y: number }>()
        let blockW = 0
        let blockY = 0
        for (let start = 0; start < members.length; start += cols) {
          const row = members.slice(start, start + cols)
          let x = 0
          let rowH = 0
          for (const zone of row) {
            const box = zoneBox.get(zone)
            if (!box) continue
            offsets.set(zone, { x, y: blockY })
            x += box.w + gapInner
            rowH = Math.max(rowH, box.h)
          }
          blockW = Math.max(blockW, x - gapInner)
          blockY += rowH + gapInner
        }
        blocks.push({
          key,
          zones: members,
          w: blockW,
          h: blockY - gapInner,
          offsets,
          desired: centerOf.get(key) ?? 0,
        })
      } else {
        for (const zone of members) {
          const box = zoneBox.get(zone)
          if (!box) continue
          blocks.push({
            key: `~${zone}`,
            zones: [zone],
            w: box.w,
            h: box.h,
            offsets: new Map([[zone, { x: 0, y: 0 }]]),
            desired: microAdaptation ? barycenter(zone, zoneAdj, centerOf) : 0,
          })
        }
      }
    }
    blocks.sort((a, b) =>
      microAdaptation ? a.desired - b.desired || (a.key < b.key ? -1 : 1) : a.key < b.key ? -1 : 1,
    )
    // explicit search-supplied order overrides the barycenter sort (§33)
    const requested = bandOrder?.get(bandIndex)
    if (requested) {
      const rank = new Map<string, number>()
      for (const [i, key] of requested.entries()) rank.set(key, i)
      blocks.sort(
        (a, b) =>
          (rank.get(a.key) ?? Number.MAX_SAFE_INTEGER) -
            (rank.get(b.key) ?? Number.MAX_SAFE_INTEGER) || (a.key < b.key ? -1 : 1),
      )
    }
    bandBlocks.push(blocks.map((b) => b.key))
    // wrap the band into sub-rows when it exceeds maxBandW (v3 §24)
    const subRows: Block[][] = [[]]
    let rowWidth = 0
    for (const block of blocks) {
      const need = block.w + zoneGap
      const current = subRows[subRows.length - 1]
      if (current && current.length > 0 && rowWidth + need > maxBandW) {
        subRows.push([block])
        rowWidth = need
      } else {
        current?.push(block)
        rowWidth += need
      }
    }
    const bandTop = y
    for (const rowBlocks of subRows) {
      if (rowBlocks.length === 0) continue
      // Two-sided 1D legalization (Abacus-style): each block sits at its
      // desired x; on overlap, colliding blocks merge into a cluster
      // placed at the mean of member desires (order-preserving least
      // squares). The earlier push-right-only sweep shoved late blocks
      // rightward and their descendant bands followed — the diagonal
      // drift that left big empty corners on test6. Blocks now spill
      // BOTH ways into free space, so alignment survives without the
      // staircase silhouette.
      interface XCluster {
        x: number
        w: number
        sum: number
        n: number
        members: { index: number; offset: number }[]
      }
      const clusters: XCluster[] = []
      for (const [i, block] of rowBlocks.entries()) {
        const desiredLeft = block.desired - block.w / 2
        let cluster: XCluster = {
          x: desiredLeft,
          w: block.w + zoneGap,
          sum: desiredLeft,
          n: 1,
          members: [{ index: i, offset: 0 }],
        }
        let prev = clusters[clusters.length - 1]
        while (prev && prev.x + prev.w > cluster.x) {
          for (const m of cluster.members) {
            prev.members.push({ index: m.index, offset: prev.w + m.offset })
          }
          prev.sum += cluster.sum - cluster.n * prev.w
          prev.n += cluster.n
          prev.w += cluster.w
          prev.x = prev.sum / prev.n
          cluster = prev
          clusters.pop()
          prev = clusters[clusters.length - 1]
        }
        clusters.push(cluster)
      }
      const xs: number[] = []
      for (const cluster of clusters) {
        for (const m of cluster.members) {
          xs[m.index] = cluster.x + m.offset
        }
      }
      let rowHeight = 0
      for (const [i, block] of rowBlocks.entries()) {
        const blockX = xs[i] ?? 0
        for (const zone of block.zones) {
          const offset = block.offsets.get(zone)
          const box = zoneBox.get(zone)
          if (!offset || !box) continue
          zoneX.set(zone, blockX + offset.x)
          zoneY.set(zone, y + offset.y)
          centerOf.set(zone, blockX + offset.x + box.w / 2)
          placed.add(zone)
        }
        // per-grid-row rectangles: the block's bbox includes empty cells
        // (a 2-col grid's short rows leave the right side hollow), so
        // compaction obstacles must be the actual row extents
        const rowRects = new Map<number, { minX: number; maxX: number; h: number }>()
        for (const zone of block.zones) {
          const offset = block.offsets.get(zone)
          const box = zoneBox.get(zone)
          if (!offset || !box) continue
          const r = rowRects.get(offset.y) ?? {
            minX: Number.POSITIVE_INFINITY,
            maxX: Number.NEGATIVE_INFINITY,
            h: 0,
          }
          r.minX = Math.min(r.minX, offset.x)
          r.maxX = Math.max(r.maxX, offset.x + box.w)
          r.h = Math.max(r.h, box.h)
          rowRects.set(offset.y, r)
        }
        placedBlocks.push({
          x: blockX,
          y,
          w: block.w,
          h: block.h,
          zones: block.zones,
          rects: [...rowRects].map(([relY, r]) => ({
            x: blockX + r.minX,
            relY,
            w: r.maxX - r.minX,
            h: r.h,
          })),
        })
        rowHeight = Math.max(rowHeight, block.h)
      }
      y += rowHeight + Math.round(bandGap * 0.55)
    }
    y -= Math.round(bandGap * 0.55)
    bandRanges.push({ top: bandTop, bottom: y })
    y += bandGap
  }

  // -- column-wise vertical compaction (pull-up, block-rigid) -----------------
  // Bands stack as full-width strips, so a block gets pushed below sub-rows
  // that occupy entirely different columns (test6: the pod grid hung
  // ~1200px under its hub because the intermediate sub-rows all sat in the
  // left columns). Pull each BLOCK up — rigidly, so feeder grids keep their
  // shape — until it would collide with an x-overlapping block above it.
  // Blocks with nothing overlapping above keep their band y, so the rank
  // discipline survives where it matters.
  const downOfZones = (zones: readonly string[]): number =>
    Math.max(0, ...zones.map((z) => zoneDownReach?.get(z) ?? 0))
  const upOfZones = (zones: readonly string[]): number =>
    Math.max(0, ...zones.map((z) => zoneUpReach?.get(z) ?? 0))
  if (microAdaptation) {
    placedBlocks.sort((a, b) => a.y - b.y || a.x - b.x)
    const settled: typeof placedBlocks = []
    for (const block of placedBlocks) {
      // the corridor between two stacked blocks holds the upper block's
      // DOWN labels and the lower (moving) block's UP labels — direction
      // matters, or whitespace appears where no label can exist
      const moverUp = upOfZones(block.zones)
      let target: number | undefined
      for (const other of settled) {
        const vGap = Math.max(bandGap, downOfZones(other.zones) + moverUp + 8)
        for (const obstacle of other.rects) {
          const obstacleBottom = other.y + obstacle.relY + obstacle.h
          for (const mover of block.rects) {
            if (mover.x + mover.w <= obstacle.x - 24 || mover.x >= obstacle.x + obstacle.w + 24) {
              continue
            }
            const candidate = obstacleBottom + vGap - mover.relY
            target = target === undefined ? candidate : Math.max(target, candidate)
          }
        }
      }
      if (target !== undefined && target < block.y) {
        const dy = target - block.y
        for (const zone of block.zones) zoneY.set(zone, (zoneY.get(zone) ?? 0) + dy)
        block.y = target
      }
      settled.push(block)
    }
  }
  // blocks moved — refresh the per-rank ranges used by congestion feedback
  for (const [i, rank] of ranks.entries()) {
    let top = Number.POSITIVE_INFINITY
    let bottom = Number.NEGATIVE_INFINITY
    for (const zone of zoneIds) {
      if ((zoneRank.get(zone) ?? 0) !== rank) continue
      const zy = zoneY.get(zone)
      const box = zoneBox.get(zone)
      if (zy === undefined || !box) continue
      top = Math.min(top, zy)
      bottom = Math.max(bottom, zy + box.h)
    }
    if (Number.isFinite(top) && bandRanges[i]) bandRanges[i] = { top, bottom }
  }
  return { bandRanges, bandBlocks }
}

function barycenter(
  zone: string,
  zoneAdj: Map<string, Map<string, number>>,
  centerOf: Map<string, number>,
): number {
  let sum = 0
  let weight = 0
  for (const [other, w] of zoneAdj.get(zone) ?? new Map<string, number>()) {
    sum += (centerOf.get(other) ?? 0) * w
    weight += w
  }
  return weight > 0 ? sum / weight : 0
}

/** Sort a row by x and enforce minimum separation inside the zone box.
 *  `minSep` may be a per-pair function (label-aware corridors). */
function resolveRow(
  row: Unit[],
  localX: Map<string, number>,
  boxWidth: number,
  minSep: number | ((a: Unit, b: Unit) => number),
): void {
  const sepOf = typeof minSep === 'number' ? () => minSep : minSep
  const sorted = [...row].sort(
    (a, b) => (localX.get(a.id) ?? 0) - (localX.get(b.id) ?? 0) || (a.id < b.id ? -1 : 1),
  )
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]
    const curr = sorted[i]
    if (!prev || !curr) continue
    const minX = (localX.get(prev.id) ?? 0) + prev.width / 2 + sepOf(prev, curr) + curr.width / 2
    if ((localX.get(curr.id) ?? 0) < minX) localX.set(curr.id, minX)
  }
  const last = sorted[sorted.length - 1]
  if (!last) return
  const over = (localX.get(last.id) ?? 0) + last.width / 2 + 8 - boxWidth
  if (over <= 0) return
  const first = sorted[0]
  const slack = first ? Math.max(0, (localX.get(first.id) ?? 0) - (first.width / 2 + 8)) : 0
  const shift = Math.min(over, slack)
  for (const unit of sorted) localX.set(unit.id, (localX.get(unit.id) ?? 0) - shift)
}

function boundsOfMembers(subgraph: Subgraph, nodes: Map<string, Node>): Bounds {
  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  for (const node of nodes.values()) {
    if (node.parent !== subgraph.id || !node.position) continue
    const size = resolveNodeSize(node)
    minX = Math.min(minX, node.position.x - size.width / 2)
    minY = Math.min(minY, node.position.y - size.height / 2)
    maxX = Math.max(maxX, node.position.x + size.width / 2)
    maxY = Math.max(maxY, node.position.y + size.height / 2)
  }
  if (!Number.isFinite(minX)) return subgraph.bounds ?? { x: 0, y: 0, width: 0, height: 0 }
  const pad = 20
  return {
    x: minX - pad,
    y: minY - pad,
    width: maxX - minX + pad * 2,
    height: maxY - minY + pad * 2,
  }
}
