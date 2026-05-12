// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Channel-based edge bend placement.
 *
 * The post-process spread (`spreadOverlappingSegments`) treats the
 * symptom — segments that happen to share a fixed coordinate — and
 * fights libavoid for the result. That breaks down in two ways
 * when dozens of edges cross the same Sugiyama layer transition:
 *
 *   1. The visible "wall of bends" stays packed because spreading
 *      can only push adjacent overlapping segments by minDist; it
 *      has no notion of where the routing channel actually ends.
 *   2. Lane membership depends on the runtime geometry, so dragging
 *      a node shifts ranges, reshuffles clusters, and snaps every
 *      affected edge to a new lane.
 *
 * The stable thing to plan around is layer topology, not segment
 * geometry. Each edge crossing layer boundary k lives in **channel
 * k**, an interval between the inflated bottom of layer k and the
 * inflated top of layer k+1. Within a channel, edges get a
 * deterministic ordinal computed from their source / target port
 * positions, and the ordinal maps to a Y (TB) or X (LR) lane that
 * we hand to libavoid as a checkpoint. Same input → same lanes,
 * regardless of which way you dragged the rest of the diagram.
 *
 * Long edges that span multiple layers get one checkpoint per
 * boundary they cross. Single-rank edges (the common case) get a
 * single checkpoint at the channel midpoint of their assigned lane.
 */

import type { Direction, Link, Node, Position } from '../models/types.js'
import type { Channel, LayerDetectionResult } from './layer-detection.js'
import type { ResolvedPort } from './resolved-types.js'

/**
 * For one edge, per-boundary checkpoint coordinates. A regular
 * single-rank edge has one entry; an edge crossing N rank
 * boundaries has N entries, in low-rank → high-rank order.
 */
export interface LaneAssignment {
  /** Rank-axis coordinate of each checkpoint. */
  rankCoords: number[]
  /** The channel indices these checkpoints sit in. */
  channelIndices: number[]
}

/**
 * Allocate a lane in every channel each link traverses. Returns a
 * map keyed by link id; links with no id or whose endpoints can't
 * be located in the layer map are absent (caller falls back to
 * un-channelled routing for those).
 *
 * Sort order within a channel:
 *
 *   1. **Source cross-axis coordinate** (ascending) — groups edges
 *      coming from the same source switch contiguously and keeps
 *      the global left-to-right reading order Sugiyama already
 *      established for its layers.
 *   2. **Distance from source to target** (descending, within a
 *      source group) — for a switch fanning out to multiple peers,
 *      this puts the FARTHEST peer at the shallowest lane (just
 *      below the source) and the CLOSEST peer at the deepest lane
 *      (just above the target row). Visually the route turns into
 *      a tree silhouette with the trunk anchored under the source
 *      as long as possible, instead of all lines weaving past each
 *      other. The closest-first order produced a bend right next to
 *      the source for the closest target, which forced every other
 *      cable to cross over it on the way out.
 *   3. **Target cross-axis coordinate** (ascending) — tie-break for
 *      same-source same-distance edges; reads left-to-right.
 *   4. **Link id** (string compare) — final deterministic tiebreak.
 */
export function assignChannelLanes(
  links: readonly Link[],
  nodes: Map<string, Node>,
  ports: Map<string, ResolvedPort>,
  layers: LayerDetectionResult,
  channels: Channel[],
  // biome-ignore lint/correctness/noUnusedFunctionParameters: kept for API symmetry; everything direction-dependent flows in via layers.rankAxis
  _direction: Direction,
): Map<string, LaneAssignment> {
  const result = new Map<string, LaneAssignment>()
  if (channels.length === 0 || layers.layers.length < 2) return result

  const crossAxis: 'x' | 'y' = layers.rankAxis === 'y' ? 'x' : 'y'

  /** Cross-axis coord of a node's CENTRE — used to group fan-out
   *  edges by their source node. Falls back to 0 if the node has
   *  no position (shouldn't happen at routing time but be safe). */
  const nodeCenter = (nodeId: string): number => {
    const n = nodes.get(nodeId)
    const p = n?.position
    if (!p) return 0
    return crossAxis === 'x' ? p.x : p.y
  }

  interface ChannelEdge {
    linkId: string
    /** Source NODE centre cross-axis coord — groups all fan-out
     *  edges from the same node into a single sort cluster. The
     *  port coord (`srcCross`) varies per port, which would split
     *  one fan-out into several "groups" of size 1 and disable the
     *  same-source far-first rule. */
    srcNodeCross: number
    srcCross: number
    dstCross: number
    /** Channel indices this edge crosses (sorted ascending). */
    crossings: number[]
  }
  const perChannel = new Map<number, ChannelEdge[]>()

  for (const link of links) {
    if (!link.id) continue
    const fromLayer = layers.layerOf.get(link.from.node)
    const toLayer = layers.layerOf.get(link.to.node)
    if (fromLayer === undefined || toLayer === undefined) continue
    if (fromLayer === toLayer) continue // intra-layer edges (HA etc.) skip channel routing

    const fromPort = ports.get(`${link.from.node}:${link.from.port}`)
    const toPort = ports.get(`${link.to.node}:${link.to.port}`)
    if (!fromPort || !toPort) continue
    const srcCross = crossAxis === 'x' ? fromPort.absolutePosition.x : fromPort.absolutePosition.y
    const dstCross = crossAxis === 'x' ? toPort.absolutePosition.x : toPort.absolutePosition.y
    // Pick the "upstream" node (lower rank) for fan-out grouping —
    // a switch's downstream APs all share the switch's centre as
    // their srcNodeCross even if the link is declared reversed.
    const srcNodeId = fromLayer < toLayer ? link.from.node : link.to.node
    const srcNodeCross = nodeCenter(srcNodeId)

    const [low, high] = fromLayer < toLayer ? [fromLayer, toLayer] : [toLayer, fromLayer]
    const crossings: number[] = []
    for (let k = low; k < high; k++) crossings.push(k)

    const entry: ChannelEdge = { linkId: link.id, srcNodeCross, srcCross, dstCross, crossings }
    for (const k of crossings) {
      const list = perChannel.get(k) ?? []
      list.push(entry)
      perChannel.set(k, list)
    }
  }

  // For each channel, sort by stable key and assign a lane.
  const rankCoordByEdgeAndChannel = new Map<string, Map<number, number>>()
  for (const channel of channels) {
    const edges = perChannel.get(channel.index)
    if (!edges || edges.length === 0) continue
    edges.sort((a, b) => {
      // Primary: source NODE x — groups same-source fan-outs together
      // and keeps overall left-to-right reading order.
      if (a.srcNodeCross !== b.srcNodeCross) return a.srcNodeCross - b.srcNodeCross
      // Within one fan-out, far peers branch off at shallower lanes
      // (Codex / yFiles convention). Distance measured against the
      // source node's centre, not the port, so paired ports on the
      // same node don't fight for the same priority.
      const aDist = Math.abs(a.dstCross - a.srcNodeCross)
      const bDist = Math.abs(b.dstCross - b.srcNodeCross)
      if (aDist !== bDist) return bDist - aDist
      if (a.dstCross !== b.dstCross) return a.dstCross - b.dstCross
      if (a.srcCross !== b.srcCross) return a.srcCross - b.srcCross
      return a.linkId.localeCompare(b.linkId)
    })
    const span = channel.rankEnd - channel.rankStart
    const count = edges.length
    for (const [i, edge] of edges.entries()) {
      const lane = channel.rankStart + ((i + 1) * span) / (count + 1)
      const map = rankCoordByEdgeAndChannel.get(edge.linkId) ?? new Map<number, number>()
      map.set(channel.index, lane)
      rankCoordByEdgeAndChannel.set(edge.linkId, map)
    }
  }

  // Materialise per-link checkpoint lists (ordered by channel index).
  for (const link of links) {
    if (!link.id) continue
    const fromLayer = layers.layerOf.get(link.from.node)
    const toLayer = layers.layerOf.get(link.to.node)
    if (fromLayer === undefined || toLayer === undefined) continue
    if (fromLayer === toLayer) continue
    const map = rankCoordByEdgeAndChannel.get(link.id)
    if (!map) continue
    const [low, high] = fromLayer < toLayer ? [fromLayer, toLayer] : [toLayer, fromLayer]
    const channelIndices: number[] = []
    const rankCoords: number[] = []
    // If the edge runs "high → low" (e.g. flipped direction), emit
    // the checkpoints in the order the route walks them, so libavoid
    // visits them sequentially.
    const order = fromLayer < toLayer ? 1 : -1
    if (order === 1) {
      for (let k = low; k < high; k++) {
        const lane = map.get(k)
        if (lane === undefined) continue
        channelIndices.push(k)
        rankCoords.push(lane)
      }
    } else {
      for (let k = high - 1; k >= low; k--) {
        const lane = map.get(k)
        if (lane === undefined) continue
        channelIndices.push(k)
        rankCoords.push(lane)
      }
    }
    if (rankCoords.length > 0) {
      result.set(link.id, { channelIndices, rankCoords })
    }
  }

  return result
}

/**
 * Turn a (rankCoord, port positions, rankAxis) tuple into the
 * concrete (x, y) point that goes to libavoid as a routing
 * checkpoint. The non-rank axis lands on whichever side of the
 * source port is closer to the destination — keeps the bend
 * geometry symmetric instead of pushing the route long-ways.
 */
export function checkpointFromLane(
  rankCoord: number,
  fromPort: ResolvedPort,
  toPort: ResolvedPort,
  rankAxis: 'x' | 'y',
): Position {
  if (rankAxis === 'y') {
    // TB / BT: rank coord is the Y; X lives halfway between the two
    // ports so libavoid bends near the middle of the horizontal span.
    return { x: (fromPort.absolutePosition.x + toPort.absolutePosition.x) / 2, y: rankCoord }
  }
  return { x: rankCoord, y: (fromPort.absolutePosition.y + toPort.absolutePosition.y) / 2 }
}
