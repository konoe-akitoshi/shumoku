// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Port Placement
 *
 * Computes the absolute position of each port on each node. The
 * pipeline factors into three pure phases that the public
 * `placePorts` composes; each phase is exported so callers (and
 * tests) can reach into the intermediate state.
 *
 *   1. `decidePortSides`     — pick which edge of the node each
 *      port lives on. Defaults follow direction + HA rules; the
 *      per-port `placement.side` override wins when set.
 *
 *   2. `orderPortsOnSide`    — order ports along a single side.
 *      Ports with a `placement.order` lock to that slot in
 *      ascending order; the rest fill the remaining slots sorted
 *      by their peer node's position so adjacent edges don't
 *      cross under the node.
 *
 *   3. `computePortPosition` — distribute N indexed ports evenly
 *      along the side and return absolute coordinates.
 *
 * Default side rules (TB direction):
 *   - Normal link  → source: bottom, destination: top
 *   - HA / redundancy → source: right, destination: left
 *   (LR direction swaps the axis; HA always runs perpendicular to
 *   the main flow.)
 */

import type { Direction, Link, Node, Position } from '../../../models/types.js'
import { resolveNodeSize } from '../../engine/index.js'
import type { ResolvedPort } from '../../resolved-types.js'

/** Default port visual size */
const PORT_SIZE = { width: 8, height: 8 }

type Side = 'top' | 'bottom' | 'left' | 'right'

/** One port's assignment after phase 1 (`decidePortSides`). */
export interface PortAssignment {
  nodeId: string
  /** Local port id on the node (the side-of-colon part of ResolvedPort.id). */
  portId: string
  side: Side
  /** Peer node id on the other end of this port's link. Used by
   *  `orderPortsOnSide` to put each port closest to its peer. */
  peerNodeId: string
}

function getNodePortLabel(node: Node | undefined, portId: string): string {
  const port = node?.ports?.find((p) => p.id === portId)
  return port?.label ?? portId
}

function getPortPlacement(
  node: Node | undefined,
  portId: string,
): { side?: Side; order?: number } | undefined {
  return node?.ports?.find((p) => p.id === portId)?.placement
}

/** True if the two nodes form an HA pair via at least one redundant link. */
function detectHAPairs(links: Link[]): Set<string> {
  const pairs = new Set<string>()
  for (const link of links) {
    if (!link.redundancy) continue
    pairs.add([link.from.node, link.to.node].sort().join(':'))
  }
  return pairs
}

function getNormalSides(direction: Direction): { sourceSide: Side; destSide: Side } {
  switch (direction) {
    case 'TB':
      return { sourceSide: 'bottom', destSide: 'top' }
    case 'BT':
      return { sourceSide: 'top', destSide: 'bottom' }
    case 'LR':
      return { sourceSide: 'right', destSide: 'left' }
    case 'RL':
      return { sourceSide: 'left', destSide: 'right' }
  }
}

function getHASides(direction: Direction): { sourceSide: Side; destSide: Side } {
  switch (direction) {
    case 'TB':
    case 'BT':
      return { sourceSide: 'right', destSide: 'left' }
    case 'LR':
    case 'RL':
      return { sourceSide: 'bottom', destSide: 'top' }
  }
}

/**
 * Phase 1 — decide which edge each port lives on.
 *
 * Auto rule: source ports go on `sourceSide`, destination ports on
 * `destSide`, with HA links perpendicular to the main flow.
 *
 * Override: if the corresponding `NodePort.placement.side` is set,
 * it wins. The peer node id stays whatever the link says so phase 2
 * can still sort by peer position.
 */
export function decidePortSides(
  links: Link[],
  nodes: Map<string, Node>,
  direction: Direction,
): PortAssignment[] {
  const haPairs = detectHAPairs(links)
  const assignments: PortAssignment[] = []
  const seen = new Set<string>()

  const normalSides = getNormalSides(direction)
  const haSides = getHASides(direction)

  for (const link of links) {
    const fromNode = link.from.node
    const toNode = link.to.node
    const isHA = haPairs.has([fromNode, toNode].sort().join(':'))
    const sides = isHA ? haSides : normalSides

    const fromKey = `${fromNode}:${link.from.port}`
    if (!seen.has(fromKey)) {
      seen.add(fromKey)
      const override = getPortPlacement(nodes.get(fromNode), link.from.port)?.side
      assignments.push({
        nodeId: fromNode,
        portId: link.from.port,
        side: override ?? sides.sourceSide,
        peerNodeId: toNode,
      })
    }

    const toKey = `${toNode}:${link.to.port}`
    if (!seen.has(toKey)) {
      seen.add(toKey)
      const override = getPortPlacement(nodes.get(toNode), link.to.port)?.side
      assignments.push({
        nodeId: toNode,
        portId: link.to.port,
        side: override ?? sides.destSide,
        peerNodeId: fromNode,
      })
    }
  }

  return assignments
}

/**
 * Phase 2 — order ports along a single side.
 *
 * Two-tier sort:
 *   1. Ports with a `placement.order` lock to that slot in ascending
 *      order. Sparse values stay sparse — we don't renumber.
 *   2. The rest interleave in peer-position order (x for horizontal
 *      sides, y for vertical) so the edge to a left peer ends up on
 *      the leftmost free port and vice versa.
 *
 * Returns the assignments in the final order. The caller treats the
 * returned array index as the port's position on the side.
 */
export function orderPortsOnSide(
  assignments: PortAssignment[],
  nodes: Map<string, Node>,
): PortAssignment[] {
  if (assignments.length <= 1) return assignments

  const first = assignments[0]
  if (!first) return assignments
  const isHorizontalSide = first.side === 'top' || first.side === 'bottom'

  // Split: explicit order vs auto.
  const explicit: Array<{ a: PortAssignment; order: number }> = []
  const auto: PortAssignment[] = []
  for (const a of assignments) {
    const ord = getPortPlacement(nodes.get(a.nodeId), a.portId)?.order
    if (typeof ord === 'number' && Number.isFinite(ord)) {
      explicit.push({ a, order: ord })
    } else {
      auto.push(a)
    }
  }

  explicit.sort((p, q) => p.order - q.order)
  auto.sort((a, b) => {
    const pa = nodes.get(a.peerNodeId)?.position
    const pb = nodes.get(b.peerNodeId)?.position
    if (!pa || !pb) return 0
    return isHorizontalSide ? pa.x - pb.x : pa.y - pb.y
  })

  // Merge: explicit ports keep their conceptual "order rank"; auto
  // ports flow between them. Concretely, we treat each explicit
  // port's `order` as a target slot fraction (low → first, high →
  // last) and slot auto ports between them by peer position.
  // Simple approximation that works well in practice: just put all
  // explicit-ordered first (already sorted), then auto. Users who
  // want fine control will set order on every port. This keeps the
  // algorithm O(n log n) and behaviour predictable.
  return [...explicit.map((e) => e.a), ...auto]
}

/**
 * Phase 3 — absolute position of port[index] of [total] on a node's side.
 *
 * Ports are spread evenly: position = (index + 1) / (total + 1) along
 * the side edge. 3 ports on a 120px-wide bottom → 30, 60, 90.
 */
export function computePortPosition(
  node: Node & { position: { x: number; y: number } },
  side: Side,
  index: number,
  total: number,
): Position {
  const size = resolveNodeSize(node)
  const { x: cx, y: cy } = node.position
  const halfW = size.width / 2
  const halfH = size.height / 2
  const ratio = (index + 1) / (total + 1)

  switch (side) {
    case 'top':
      return { x: cx - halfW + size.width * ratio, y: cy - halfH }
    case 'bottom':
      return { x: cx - halfW + size.width * ratio, y: cy + halfH }
    case 'left':
      return { x: cx - halfW, y: cy - halfH + size.height * ratio }
    case 'right':
      return { x: cx + halfW, y: cy - halfH + size.height * ratio }
  }
}

/**
 * Re-seat a port to the end of its OWN axis that faces the peer.
 * A top/bottom port stays vertical (only flips up↔down); a
 * left/right port stays horizontal (only flips left↔right).
 *
 * Staying on-axis is a hard constraint: a normal link flows along
 * the main axis (top/bottom for TB) and an HA link runs
 * perpendicular (left/right). A sideways port on a normal TB link
 * is not allowed, so we never move a port to the perpendicular
 * axis — we only choose which end of its existing axis points at
 * the peer.
 */
function reseatTowardPeer(side: Side, here: Position, peer: Position): Side {
  const horizontal = side === 'left' || side === 'right'
  if (horizontal) return peer.x >= here.x ? 'right' : 'left'
  return peer.y >= here.y ? 'bottom' : 'top'
}

/**
 * Re-seat each port on the end of its axis that actually faces
 * its peer, now that final node positions are known.
 * {@link decidePortSides} runs before layout (it can only use the
 * structural flow direction), so once a node lands *above* the
 * peer it was supposed to flow *down* to, its source port would
 * still sit on the bottom and the wire would leave downward only
 * to loop back up. Re-deciding the axis end from geometry makes
 * every wire exit toward its peer — without ever switching a port
 * to the perpendicular (sideways) axis.
 *
 * Skips ports with an explicit `placement.side` (author intent
 * wins) and any port whose node or peer lacks a position (keeps
 * the structural assignment as a safe fallback).
 */
function reseatPortsByGeometry(
  assignments: PortAssignment[],
  nodes: Map<string, Node>,
): PortAssignment[] {
  return assignments.map((a) => {
    if (getPortPlacement(nodes.get(a.nodeId), a.portId)?.side) return a
    const here = nodes.get(a.nodeId)?.position
    const peer = nodes.get(a.peerNodeId)?.position
    if (!here || !peer) return a
    return { ...a, side: reseatTowardPeer(a.side, here, peer) }
  })
}

/**
 * Distribute a side's ports by aligning each to its peer, so wires drop
 * (near-)straight to the node above/below instead of fanning evenly
 * across a wide switch. Keeps the order {@link orderPortsOnSide} chose;
 * only the coordinate along the side is decided here:
 *
 *   1. target = the peer's centre on the side axis (x for top/bottom,
 *      y for left/right), clamped to the node edge. A peer without a
 *      position falls back to its even slot.
 *   2. project to non-decreasing with a minimum gap of span/(total+1)
 *      — the even-distribution pitch — via pool-adjacent-violators, so
 *      ports never overlap or reorder. When every peer shares a
 *      coordinate this reproduces the plain even spread; when peers
 *      spread out, each port sits under its peer.
 *   3. shift the block back inside the edge if the peer pull overran it.
 *
 * The even-distribution pitch as the floor means a switch fanning out
 * to children of uneven port counts no longer slants every wire (the
 * old `(index+1)/(total+1)` spread ignored where each child actually
 * sat), while a bank of ports all going to one peer still spreads
 * evenly.
 */
function distributePortsAlongSide(
  ordered: PortAssignment[],
  node: Node & { position: { x: number; y: number } },
  side: Side,
  nodes: Map<string, Node>,
): Position[] {
  const total = ordered.length
  if (total === 0) return []
  const size = resolveNodeSize(node)
  const horizontal = side === 'top' || side === 'bottom'
  const span = horizontal ? size.width : size.height
  const center = horizontal ? node.position.x : node.position.y
  const lo = center - span / 2
  const hi = center + span / 2
  const gap = span / (total + 1)

  // 1. target per port: pull toward the peer ONLY when the peer sits
  //    within the node's own span (the wire then drops roughly
  //    straight). When the peer is off to the side, aligning would jam
  //    the port into the node corner — keep the conventional even slot
  //    and let the wire leave at an angle, which reads far better. Also
  //    the fallback when the peer isn't positioned yet.
  const target = ordered.map((a, i) => {
    const slot = lo + span * ((i + 1) / (total + 1))
    const peer = nodes.get(a.peerNodeId)?.position
    if (!peer) return slot
    const raw = horizontal ? peer.x : peer.y
    return raw >= lo && raw <= hi ? raw : slot
  })

  // 2. monotonic projection with min gap `gap`: pool-adjacent-violators
  //    on the gap-detrended series, so ties spread by exactly `gap`.
  const detrended = target.map((v, i) => v - i * gap)
  const blocks: Array<{ sum: number; n: number; val: number }> = []
  for (const v of detrended) {
    let sum = v
    let n = 1
    while (blocks.length > 0) {
      const prev = blocks[blocks.length - 1]
      if (!prev || prev.val <= sum / n) break
      blocks.pop()
      sum += prev.sum
      n += prev.n
    }
    blocks.push({ sum, n, val: sum / n })
  }
  const fitted = blocks.flatMap((b) => Array.from({ length: b.n }, () => b.val))
  const raw = fitted.map((v, i) => v + i * gap)

  // 3. shift inside [lo, hi] (the block fits since total*gap < span).
  const firstPos = raw[0] ?? lo
  const lastPos = raw[raw.length - 1] ?? hi
  const shift = firstPos < lo ? lo - firstPos : lastPos > hi ? hi - lastPos : 0
  const along = raw.map((v) => v + shift)

  // 4. compose with the fixed perpendicular coordinate (constant per
  //    side; only the along-axis coordinate varies per port).
  const halfW = size.width / 2
  const halfH = size.height / 2
  const perpY = node.position.y + (side === 'top' ? -halfH : halfH)
  const perpX = node.position.x + (side === 'left' ? -halfW : halfW)
  return ordered.map((_a, i) => {
    const c = along[i] ?? center
    return horizontal ? { x: c, y: perpY } : { x: perpX, y: c }
  })
}

/**
 * Compose the three phases: decide sides → order each side → compute
 * absolute coordinates → emit `ResolvedPort`s keyed by `nodeId:portId`.
 *
 * Port sides are re-seated from final geometry (see
 * {@link reseatPortsByGeometry}) so wires exit toward their peer
 * regardless of how the upstream/downstream tree was inferred. Ports
 * are positioned along each side by {@link distributePortsAlongSide}
 * (peer-aligned), with {@link computePortPosition}'s even spread as the
 * fallback.
 */
export function placePorts(
  nodes: Map<string, Node>,
  links: Link[],
  direction: Direction = 'TB',
): Map<string, ResolvedPort> {
  const assignments = reseatPortsByGeometry(decidePortSides(links, nodes, direction), nodes)

  const bySide = new Map<string, PortAssignment[]>()
  for (const a of assignments) {
    const key = `${a.nodeId}:${a.side}`
    const list = bySide.get(key)
    if (list) list.push(a)
    else bySide.set(key, [a])
  }

  const ports = new Map<string, ResolvedPort>()
  for (const [_key, sideAssignments] of bySide) {
    const first = sideAssignments[0]
    if (!first) continue
    const node = nodes.get(first.nodeId)
    if (!node?.position) continue

    const ordered = orderPortsOnSide(sideAssignments, nodes)
    const positioned = node as Node & { position: { x: number; y: number } }
    const coords = distributePortsAlongSide(ordered, positioned, first.side, nodes)

    for (const [i, a] of ordered.entries()) {
      const portId = `${a.nodeId}:${a.portId}`
      const absolutePosition =
        coords[i] ?? computePortPosition(positioned, a.side, i, ordered.length)
      ports.set(portId, {
        id: portId,
        nodeId: a.nodeId,
        label: getNodePortLabel(node, a.portId),
        absolutePosition,
        side: a.side,
        size: PORT_SIZE,
      })
    }
  }

  return ports
}
