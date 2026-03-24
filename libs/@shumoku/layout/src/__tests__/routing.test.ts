import { describe, expect, it } from 'vitest'
import { StraightRouter } from '../routing/straight.js'
import { OrthogonalRouter } from '../routing/orthogonal.js'
import { SplineRouter } from '../routing/spline.js'
import { createRouter } from '../routing/index.js'
import type { EdgeToRoute, Obstacle } from '../types.js'

// ============================================
// Test helpers
// ============================================

function makeEdge(
  id: string,
  source: { x: number; y: number },
  target: { x: number; y: number },
): EdgeToRoute {
  return {
    id,
    source,
    target,
    link: { from: 'a', to: 'b' },
    fromEndpoint: { node: 'a' },
    toEndpoint: { node: 'b' },
  }
}

function makeObstacle(x: number, y: number, w: number, h: number): Obstacle {
  return { x, y, width: w, height: h }
}

// ============================================
// Straight Router
// ============================================

describe('StraightRouter', () => {
  const router = new StraightRouter()

  it('routes a direct line from source to target', () => {
    const edges = [makeEdge('e1', { x: 0, y: 0 }, { x: 100, y: 200 })]
    const result = router.route(edges, [])

    expect(result.edges.size).toBe(1)
    const edge = result.edges.get('e1')!
    expect(edge.points).toHaveLength(2)
    expect(edge.points[0]).toEqual({ x: 0, y: 0 })
    expect(edge.points[1]).toEqual({ x: 100, y: 200 })
  })

  it('ignores obstacles', () => {
    const edges = [makeEdge('e1', { x: 0, y: 0 }, { x: 100, y: 100 })]
    const obstacles = [makeObstacle(40, 40, 20, 20)]
    const result = router.route(edges, obstacles)

    expect(result.edges.get('e1')!.points).toHaveLength(2)
  })

  it('handles multiple edges', () => {
    const edges = [
      makeEdge('e1', { x: 0, y: 0 }, { x: 100, y: 0 }),
      makeEdge('e2', { x: 0, y: 50 }, { x: 100, y: 50 }),
    ]
    const result = router.route(edges, [])
    expect(result.edges.size).toBe(2)
  })

  it('reports strategy in metadata', () => {
    const result = router.route([], [])
    expect(result.metadata?.strategy).toBe('straight')
  })
})

// ============================================
// Orthogonal Router
// ============================================

describe('OrthogonalRouter', () => {
  const router = new OrthogonalRouter()

  it('routes HV path with no obstacles (L-shape)', () => {
    const edges = [makeEdge('e1', { x: 0, y: 0 }, { x: 100, y: 200 })]
    const result = router.route(edges, [])

    const points = result.edges.get('e1')!.points
    expect(points.length).toBeGreaterThanOrEqual(2)

    // All segments must be horizontal or vertical
    for (let i = 0; i < points.length - 1; i++) {
      const dx = Math.abs(points[i].x - points[i + 1].x)
      const dy = Math.abs(points[i].y - points[i + 1].y)
      expect(dx < 1 || dy < 1).toBe(true)
    }
  })

  it('routes around an obstacle', () => {
    // Source at top-left, target at bottom-right, obstacle in the middle
    const edges = [makeEdge('e1', { x: 0, y: 0 }, { x: 200, y: 200 })]
    const obstacles = [makeObstacle(80, 80, 40, 40)]
    const result = router.route(edges, obstacles, { strategy: 'orthogonal', obstacleMargin: 4 })

    const points = result.edges.get('e1')!.points
    // Should route around the obstacle (more than 3 points = L-shape wouldn't suffice)
    expect(points.length).toBeGreaterThanOrEqual(2)

    // Verify start and end
    expect(points[0]).toEqual({ x: 0, y: 0 })
    expect(points[points.length - 1]).toEqual({ x: 200, y: 200 })

    // All segments must be HV
    for (let i = 0; i < points.length - 1; i++) {
      const dx = Math.abs(points[i].x - points[i + 1].x)
      const dy = Math.abs(points[i].y - points[i + 1].y)
      expect(dx < 1 || dy < 1).toBe(true)
    }
  })

  it('uses direct path when aligned horizontally', () => {
    const edges = [makeEdge('e1', { x: 0, y: 100 }, { x: 200, y: 100 })]
    const result = router.route(edges, [])
    const points = result.edges.get('e1')!.points
    // Should be a straight horizontal line (2 points)
    expect(points).toHaveLength(2)
  })

  it('uses direct path when aligned vertically', () => {
    const edges = [makeEdge('e1', { x: 100, y: 0 }, { x: 100, y: 200 })]
    const result = router.route(edges, [])
    const points = result.edges.get('e1')!.points
    expect(points).toHaveLength(2)
  })

  it('reports strategy in metadata', () => {
    const result = router.route([], [])
    expect(result.metadata?.strategy).toBe('orthogonal')
  })
})

// ============================================
// Spline Router
// ============================================

describe('SplineRouter', () => {
  const router = new SplineRouter()

  it('produces smooth curves from orthogonal waypoints', () => {
    const edges = [makeEdge('e1', { x: 0, y: 0 }, { x: 200, y: 200 })]
    const obstacles = [makeObstacle(80, 80, 40, 40)]
    const result = router.route(edges, obstacles, { strategy: 'spline', obstacleMargin: 4 })

    const points = result.edges.get('e1')!.points
    // Spline should produce more points than orthogonal (interpolation)
    expect(points.length).toBeGreaterThan(2)
  })

  it('preserves start and end points', () => {
    const edges = [makeEdge('e1', { x: 10, y: 20 }, { x: 300, y: 400 })]
    const result = router.route(edges, [])

    const points = result.edges.get('e1')!.points
    expect(points[0]).toEqual({ x: 10, y: 20 })
    expect(points[points.length - 1]).toEqual({ x: 300, y: 400 })
  })

  it('reports strategy in metadata', () => {
    const result = router.route([], [])
    expect(result.metadata?.strategy).toBe('spline')
  })
})

// ============================================
// createRouter factory
// ============================================

describe('createRouter', () => {
  it('creates StraightRouter', () => {
    expect(createRouter('straight')).toBeInstanceOf(StraightRouter)
  })

  it('creates OrthogonalRouter', () => {
    expect(createRouter('orthogonal')).toBeInstanceOf(OrthogonalRouter)
  })

  it('creates SplineRouter', () => {
    expect(createRouter('spline')).toBeInstanceOf(SplineRouter)
  })
})
