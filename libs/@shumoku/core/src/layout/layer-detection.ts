// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Reconstructs Sugiyama layer info from positioned nodes.
 *
 * The Sugiyama pipeline (`layoutFlat` / `layoutCompound`) drops its
 * internal `layerOf` map once it has converted layers to coordinates,
 * so consumers downstream — like the channel-based edge router below
 * — would have to either thread the layer info through every call
 * site or rebuild it from the geometry. Rebuilding is much cheaper
 * (it's a one-pass sort + cluster), keeps the public layout API
 * unchanged, and works equally well for nodes inside a nested
 * subgraph (each container's layers share the same y in TB).
 *
 * The clustering relies on Sugiyama's invariant: every node in a
 * layer is centred on the layer's coordinate. Two nodes at the same
 * layer therefore have identical centre coordinates on the rank
 * axis (modulo float rounding); two nodes on different layers are
 * separated by at least one inter-layer gap.
 */
import type { Direction, Node } from '../models/types.js'
import { computeNodeSize } from './network-layout.js'

/** Rank-axis info per detected layer, indexed 0 = lowest rank value. */
export interface LayerInfo {
  /** Index of this layer (0 = top-most in TB / leftmost in LR). */
  index: number
  /** Lowest rank-axis edge of any node in this layer (inflated by node halves). */
  rankStart: number
  /** Highest rank-axis edge of any node in this layer. */
  rankEnd: number
  /** Centre coordinate on the rank axis (the y for TB, the x for LR). */
  rankCentre: number
  /** Node ids in this layer (no particular order). */
  nodes: string[]
}

export interface LayerDetectionResult {
  /** Per-node layer index. Nodes with no position are absent. */
  layerOf: Map<string, number>
  /** Each layer's geometry, ordered by ascending rank. */
  layers: LayerInfo[]
  /** Which axis the layers stack along ('y' for TB/BT, 'x' for LR/RL). */
  rankAxis: 'x' | 'y'
}

/**
 * Cluster positioned nodes into Sugiyama layers.
 *
 * Tolerance is set to 1px on the centre coordinate — Sugiyama puts
 * every node in a layer at the same centre coord, so anything bigger
 * than rounding error indicates a different layer.
 */
export function detectLayers(nodes: Map<string, Node>, direction: Direction): LayerDetectionResult {
  const rankAxis: 'x' | 'y' = direction === 'TB' || direction === 'BT' ? 'y' : 'x'

  interface Entry {
    id: string
    rank: number
    halfRank: number
  }
  const entries: Entry[] = []
  for (const [id, n] of nodes) {
    if (!n.position) continue
    const size = computeNodeSize(n)
    const rank = rankAxis === 'y' ? n.position.y : n.position.x
    const halfRank = rankAxis === 'y' ? size.height / 2 : size.width / 2
    entries.push({ id, rank, halfRank })
  }
  entries.sort((a, b) => a.rank - b.rank)

  const layers: LayerInfo[] = []
  const layerOf = new Map<string, number>()
  let current: Entry[] = []
  const TOLERANCE = 1
  for (const e of entries) {
    if (current.length === 0) {
      current.push(e)
      continue
    }
    const ref = current[0]
    if (ref !== undefined && Math.abs(e.rank - ref.rank) <= TOLERANCE) {
      current.push(e)
    } else {
      layers.push(buildLayer(layers.length, current, layerOf))
      current = [e]
    }
  }
  if (current.length > 0) layers.push(buildLayer(layers.length, current, layerOf))

  return { layerOf, layers, rankAxis }
}

function buildLayer(
  index: number,
  entries: Array<{ id: string; rank: number; halfRank: number }>,
  layerOf: Map<string, number>,
): LayerInfo {
  let rankStart = Number.POSITIVE_INFINITY
  let rankEnd = Number.NEGATIVE_INFINITY
  let centreSum = 0
  const nodeIds: string[] = []
  for (const e of entries) {
    layerOf.set(e.id, index)
    rankStart = Math.min(rankStart, e.rank - e.halfRank)
    rankEnd = Math.max(rankEnd, e.rank + e.halfRank)
    centreSum += e.rank
    nodeIds.push(e.id)
  }
  const rankCentre = entries.length > 0 ? centreSum / entries.length : 0
  return { index, rankStart, rankEnd, rankCentre, nodes: nodeIds }
}

/**
 * Inter-layer "channel" geometry — the empty corridor between two
 * adjacent layers where bend segments may live. Both inflated edges
 * exclude `clearance` so segments routed right at the boundary still
 * have a small visual breathing room from the nodes.
 */
export interface Channel {
  /** Lower-rank layer index. The channel sits between layers `index`
   *  and `index + 1`. */
  index: number
  /** Inflated rank-axis lower bound (top side in TB). */
  rankStart: number
  /** Inflated rank-axis upper bound (bottom side in TB). */
  rankEnd: number
}

export function channelsFromLayers(layers: LayerInfo[], clearance = 8): Channel[] {
  const out: Channel[] = []
  for (let i = 0; i < layers.length - 1; i++) {
    const a = layers[i]
    const b = layers[i + 1]
    if (!a || !b) continue
    const rankStart = a.rankEnd + clearance
    const rankEnd = b.rankStart - clearance
    if (rankEnd <= rankStart) continue
    out.push({ index: i, rankStart, rankEnd })
  }
  return out
}
