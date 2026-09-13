import { itemAt } from '../utils/collections'

export interface WeightedNeighbor {
  readonly index: number
  readonly distance: number
}

/**
 * Dijkstra's algorithm with a linear scan for the closest unsettled vertex.
 * Ties resolve to the lowest vertex index and neighbors relax in iteration order,
 * so identical inputs always produce the identical path.
 *
 * @returns vertex indices from `start` to `end`, or `null` when `end` is unreachable
 */
export function shortestPathIndices(
  vertexCount: number,
  start: number,
  end: number,
  neighborsOf: (vertex: number) => Iterable<WeightedNeighbor>,
): number[] | null {
  const distances = new Array<number>(vertexCount).fill(Number.POSITIVE_INFINITY)
  const previous = new Array<number>(vertexCount).fill(-1)
  const settled = new Array<boolean>(vertexCount).fill(false)
  distances[start] = 0
  let current = closestUnsettled(distances, settled)
  while (current >= 0 && Number.isFinite(itemAt(distances, current))) {
    if (current === end) return tracePath(previous, end)
    settled[current] = true
    const reached = itemAt(distances, current)
    for (const { index, distance } of neighborsOf(current)) {
      const candidate = reached + distance
      if (candidate < itemAt(distances, index)) {
        distances[index] = candidate
        previous[index] = current
      }
    }
    current = closestUnsettled(distances, settled)
  }
  return null
}

function closestUnsettled(distances: readonly number[], settled: readonly boolean[]): number {
  let closest = -1
  for (const [vertex, distance] of distances.entries())
    if (!settled[vertex] && (closest < 0 || distance < itemAt(distances, closest))) closest = vertex
  return closest
}

function tracePath(previous: readonly number[], end: number): number[] {
  const path: number[] = []
  let vertex = end
  while (vertex !== -1) {
    path.push(vertex)
    vertex = itemAt(previous, vertex)
  }
  return path.reverse()
}
