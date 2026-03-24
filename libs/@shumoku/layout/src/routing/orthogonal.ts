// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Orthogonal (HV) routing engine
 *
 * Routes edges using only horizontal and vertical segments.
 * Uses a visibility-graph approach with Dijkstra's shortest path
 * to find obstacle-avoiding HV routes.
 *
 * Algorithm:
 *   1. Expand obstacles by margin to create clearance
 *   2. Build a set of candidate HV lines from obstacle corners + endpoints
 *   3. Construct a visibility graph (nodes connected if HV-visible)
 *   4. Run Dijkstra from source to target
 *   5. Simplify path (merge collinear segments)
 */

import type { Position } from '@shumoku/core'
import type {
  EdgeToRoute,
  Obstacle,
  RoutedEdge,
  RoutingEngine,
  RoutingOptions,
  RoutingResult,
} from '../types.js'

interface ExpandedRect {
  x1: number
  y1: number
  x2: number
  y2: number
}

/** Check if a horizontal or vertical segment intersects any obstacle */
function segmentBlockedByObstacle(
  a: Position,
  b: Position,
  obstacles: ExpandedRect[],
): boolean {
  // Only handles axis-aligned segments
  const isHorizontal = Math.abs(a.y - b.y) < 0.5
  const isVertical = Math.abs(a.x - b.x) < 0.5

  if (!isHorizontal && !isVertical) return true // non-HV = blocked

  if (isHorizontal) {
    const y = a.y
    const minX = Math.min(a.x, b.x)
    const maxX = Math.max(a.x, b.x)
    for (const rect of obstacles) {
      if (y > rect.y1 && y < rect.y2 && maxX > rect.x1 && minX < rect.x2) {
        return true
      }
    }
  } else {
    const x = a.x
    const minY = Math.min(a.y, b.y)
    const maxY = Math.max(a.y, b.y)
    for (const rect of obstacles) {
      if (x > rect.x1 && x < rect.x2 && maxY > rect.y1 && minY < rect.y2) {
        return true
      }
    }
  }

  return false
}

/** Encode a position as a string key for maps */
function posKey(p: Position): string {
  return `${Math.round(p.x)},${Math.round(p.y)}`
}

/** Simplify a path by merging collinear segments */
function simplifyPath(path: Position[]): Position[] {
  if (path.length <= 2) return path

  const result: Position[] = [path[0]]

  for (let i = 1; i < path.length - 1; i++) {
    const prev = result[result.length - 1]
    const curr = path[i]
    const next = path[i + 1]

    // Skip if collinear (all on same H or V line)
    const sameH = Math.abs(prev.y - curr.y) < 0.5 && Math.abs(curr.y - next.y) < 0.5
    const sameV = Math.abs(prev.x - curr.x) < 0.5 && Math.abs(curr.x - next.x) < 0.5

    if (!sameH && !sameV) {
      result.push(curr)
    }
  }

  result.push(path[path.length - 1])
  return result
}

/** Priority queue (min-heap) for Dijkstra */
class MinHeap {
  private heap: { key: string; dist: number }[] = []

  push(key: string, dist: number): void {
    this.heap.push({ key, dist })
    this.bubbleUp(this.heap.length - 1)
  }

  pop(): { key: string; dist: number } | undefined {
    if (this.heap.length === 0) return undefined
    const top = this.heap[0]
    const last = this.heap.pop()!
    if (this.heap.length > 0) {
      this.heap[0] = last
      this.sinkDown(0)
    }
    return top
  }

  get size(): number {
    return this.heap.length
  }

  private bubbleUp(i: number): void {
    while (i > 0) {
      const parent = (i - 1) >> 1
      if (this.heap[parent].dist <= this.heap[i].dist) break
      ;[this.heap[parent], this.heap[i]] = [this.heap[i], this.heap[parent]]
      i = parent
    }
  }

  private sinkDown(i: number): void {
    const n = this.heap.length
    while (true) {
      let smallest = i
      const left = 2 * i + 1
      const right = 2 * i + 2
      if (left < n && this.heap[left].dist < this.heap[smallest].dist) smallest = left
      if (right < n && this.heap[right].dist < this.heap[smallest].dist) smallest = right
      if (smallest === i) break
      ;[this.heap[smallest], this.heap[i]] = [this.heap[i], this.heap[smallest]]
      i = smallest
    }
  }
}

/**
 * Find shortest HV path from source to target avoiding obstacles.
 *
 * Builds a grid of candidate coordinates from obstacle corners
 * and source/target, then searches for shortest Manhattan path.
 */
function findOrthogonalPath(
  source: Position,
  target: Position,
  obstacles: ExpandedRect[],
): Position[] {
  // Quick check: can we go direct with one bend?
  const midH: Position = { x: target.x, y: source.y }
  const midV: Position = { x: source.x, y: target.y }

  // Try L-shaped paths first (much faster than full graph search)
  if (
    !segmentBlockedByObstacle(source, midH, obstacles) &&
    !segmentBlockedByObstacle(midH, target, obstacles)
  ) {
    return simplifyPath([source, midH, target])
  }
  if (
    !segmentBlockedByObstacle(source, midV, obstacles) &&
    !segmentBlockedByObstacle(midV, target, obstacles)
  ) {
    return simplifyPath([source, midV, target])
  }

  // Collect candidate X and Y coordinates from obstacle corners + endpoints
  const xCoords = new Set<number>([source.x, target.x])
  const yCoords = new Set<number>([source.y, target.y])

  for (const rect of obstacles) {
    xCoords.add(rect.x1)
    xCoords.add(rect.x2)
    yCoords.add(rect.y1)
    yCoords.add(rect.y2)
  }

  const xs = [...xCoords].sort((a, b) => a - b)
  const ys = [...yCoords].sort((a, b) => a - b)

  // Build grid nodes
  const gridNodes: Position[] = []
  for (const x of xs) {
    for (const y of ys) {
      // Skip points inside obstacles
      let inside = false
      for (const rect of obstacles) {
        if (x > rect.x1 && x < rect.x2 && y > rect.y1 && y < rect.y2) {
          inside = true
          break
        }
      }
      if (!inside) {
        gridNodes.push({ x, y })
      }
    }
  }

  // Ensure source and target are in the grid
  const srcKey = posKey(source)
  const tgtKey = posKey(target)
  if (!gridNodes.some((n) => posKey(n) === srcKey)) gridNodes.push(source)
  if (!gridNodes.some((n) => posKey(n) === tgtKey)) gridNodes.push(target)

  // Build adjacency: connect nodes that share X or Y and have clear HV line
  const nodeByKey = new Map<string, Position>()
  const adj = new Map<string, { key: string; dist: number }[]>()

  for (const node of gridNodes) {
    const key = posKey(node)
    nodeByKey.set(key, node)
    adj.set(key, [])
  }

  // Group by X and Y for efficient neighbor finding
  const byX = new Map<number, Position[]>()
  const byY = new Map<number, Position[]>()

  for (const node of gridNodes) {
    const rx = Math.round(node.x)
    const ry = Math.round(node.y)
    if (!byX.has(rx)) byX.set(rx, [])
    byX.get(rx)!.push(node)
    if (!byY.has(ry)) byY.set(ry, [])
    byY.get(ry)!.push(node)
  }

  // Connect vertical neighbors (same X)
  for (const [, nodes] of byX) {
    nodes.sort((a, b) => a.y - b.y)
    for (let i = 0; i < nodes.length - 1; i++) {
      const a = nodes[i]
      const b = nodes[i + 1]
      if (!segmentBlockedByObstacle(a, b, obstacles)) {
        const d = Math.abs(b.y - a.y)
        const ka = posKey(a)
        const kb = posKey(b)
        adj.get(ka)!.push({ key: kb, dist: d })
        adj.get(kb)!.push({ key: ka, dist: d })
      }
    }
  }

  // Connect horizontal neighbors (same Y)
  for (const [, nodes] of byY) {
    nodes.sort((a, b) => a.x - b.x)
    for (let i = 0; i < nodes.length - 1; i++) {
      const a = nodes[i]
      const b = nodes[i + 1]
      if (!segmentBlockedByObstacle(a, b, obstacles)) {
        const d = Math.abs(b.x - a.x)
        const ka = posKey(a)
        const kb = posKey(b)
        adj.get(ka)!.push({ key: kb, dist: d })
        adj.get(kb)!.push({ key: ka, dist: d })
      }
    }
  }

  // Dijkstra
  const dist = new Map<string, number>()
  const prev = new Map<string, string>()
  const heap = new MinHeap()

  dist.set(srcKey, 0)
  heap.push(srcKey, 0)

  while (heap.size > 0) {
    const { key: uKey, dist: uDist } = heap.pop()!

    if (uKey === tgtKey) break
    if (uDist > (dist.get(uKey) ?? Infinity)) continue

    for (const { key: vKey, dist: edgeDist } of adj.get(uKey) ?? []) {
      // Add bend penalty to prefer fewer turns
      const uNode = nodeByKey.get(uKey)!
      const vNode = nodeByKey.get(vKey)!
      const prevKey = prev.get(uKey)
      let bendPenalty = 0
      if (prevKey) {
        const prevNode = nodeByKey.get(prevKey)!
        const prevH = Math.abs(prevNode.y - uNode.y) < 0.5
        const currH = Math.abs(uNode.y - vNode.y) < 0.5
        if (prevH !== currH) bendPenalty = 20 // penalty for each bend
      }

      const newDist = uDist + edgeDist + bendPenalty
      if (newDist < (dist.get(vKey) ?? Infinity)) {
        dist.set(vKey, newDist)
        prev.set(vKey, uKey)
        heap.push(vKey, newDist)
      }
    }
  }

  // Reconstruct path
  if (!prev.has(tgtKey) && srcKey !== tgtKey) {
    // No path found - fall back to L-shape ignoring obstacles
    return [source, { x: target.x, y: source.y }, target]
  }

  const path: Position[] = []
  let current: string | undefined = tgtKey
  while (current !== undefined) {
    path.unshift(nodeByKey.get(current)!)
    current = prev.get(current)
  }

  return simplifyPath(path)
}

export class OrthogonalRouter implements RoutingEngine {
  route(
    edges: EdgeToRoute[],
    obstacles: Obstacle[],
    options?: Partial<RoutingOptions>,
  ): RoutingResult {
    const start = performance.now()
    const margin = options?.obstacleMargin ?? 8
    const result = new Map<string, RoutedEdge>()

    // Expand obstacles by margin
    const expanded: ExpandedRect[] = obstacles.map((o) => ({
      x1: o.x - (o.margin ?? margin),
      y1: o.y - (o.margin ?? margin),
      x2: o.x + o.width + (o.margin ?? margin),
      y2: o.y + o.height + (o.margin ?? margin),
    }))

    for (const edge of edges) {
      const points = findOrthogonalPath(edge.source, edge.target, expanded)

      result.set(edge.id, {
        id: edge.id,
        from: edge.fromEndpoint.node,
        to: edge.toEndpoint.node,
        fromEndpoint: edge.fromEndpoint,
        toEndpoint: edge.toEndpoint,
        sourcePort: edge.source,
        targetPort: edge.target,
        points,
        link: edge.link,
      })
    }

    return {
      edges: result,
      metadata: {
        strategy: 'orthogonal',
        duration: performance.now() - start,
      },
    }
  }
}
