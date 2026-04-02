// libavoid-js spike test — Phase 0 (#71)
// Validates WASM loading, API, parallel edge nudging, port connections, and performance
//
// API notes (v0.5.0-beta.5):
// - Enum values are objects with .value property: Avoid.RouterFlag.OrthogonalRouting.value
// - Router constructor takes numeric flag, not enum object
// - ConnDirFlags are numeric: Up=1, Down=2, Left=4, Right=8, All=15
// - ShapeConnectionPin: (shape, classId, xOffset, yOffset, proportional, insideOffset, visDirs)
// - ConnEnd with pin: new Avoid.ConnEnd(shape, classId)

import { describe, it, expect, beforeAll } from 'vitest'
import { AvoidLib, type Avoid } from 'libavoid-js'

// Direction flag constants (from libavoid C++ source)
const ConnDirUp = 1
const ConnDirDown = 2
const ConnDirLeft = 4
const ConnDirRight = 8

let Avoid: Avoid

beforeAll(async () => {
  await AvoidLib.load()
  Avoid = AvoidLib.getInstance()
})

function getRoutePoints(conn: any): Array<{ x: number; y: number }> {
  const route = conn.displayRoute()
  const pts: Array<{ x: number; y: number }> = []
  for (let i = 0; i < route.size(); i++) {
    const pt = route.at(i)
    pts.push({ x: pt.x, y: pt.y })
  }
  return pts
}

describe('libavoid-js spike', () => {
  describe('WASM initialization', () => {
    it('loads WASM and provides Avoid instance with expected API', () => {
      expect(Avoid).toBeDefined()
      expect(Avoid.Router).toBeDefined()
      expect(Avoid.ShapeRef).toBeDefined()
      expect(Avoid.ConnRef).toBeDefined()
      expect(Avoid.ShapeConnectionPin).toBeDefined()
      expect(Avoid.RouterFlag.OrthogonalRouting).toBeDefined()
      expect(Avoid.RouterFlag.PolyLineRouting).toBeDefined()
      expect(Avoid.RoutingParameter.shapeBufferDistance).toBeDefined()
      expect(Avoid.RoutingParameter.idealNudgingDistance).toBeDefined()
      expect(Avoid.RoutingOption.nudgeOrthogonalSegmentsConnectedToShapes).toBeDefined()
    })
  })

  describe('basic orthogonal routing', () => {
    it('routes an edge between two nodes avoiding an obstacle', () => {
      const router = new Avoid.Router(Avoid.RouterFlag.OrthogonalRouting.value)
      router.setRoutingParameter(Avoid.RoutingParameter.shapeBufferDistance.value, 10)

      // Node A at center (50, 30), 100x60
      new Avoid.ShapeRef(router, new Avoid.Rectangle(new Avoid.Point(50, 30), 100, 60))
      // Node B at center (350, 230), 100x60
      new Avoid.ShapeRef(router, new Avoid.Rectangle(new Avoid.Point(350, 230), 100, 60))
      // Obstacle in between
      new Avoid.ShapeRef(router, new Avoid.Rectangle(new Avoid.Point(190, 140), 80, 80))

      const conn = new Avoid.ConnRef(
        router,
        new Avoid.ConnEnd(new Avoid.Point(50, 60)),
        new Avoid.ConnEnd(new Avoid.Point(350, 200)),
      )

      router.processTransaction()

      const points = getRoutePoints(conn)

      // Should route around obstacle (more than 2 points)
      expect(points.length).toBeGreaterThan(2)
      expect(points[0].x).toBeCloseTo(50, 0)
      expect(points[0].y).toBeCloseTo(60, 0)
      expect(points[points.length - 1].x).toBeCloseTo(350, 0)
      expect(points[points.length - 1].y).toBeCloseTo(200, 0)

      router.delete()
    })
  })

  describe('ShapeConnectionPin (port-based connections)', () => {
    it('connects via specific ports on shapes', () => {
      const router = new Avoid.Router(Avoid.RouterFlag.OrthogonalRouting.value)
      router.setRoutingParameter(Avoid.RoutingParameter.shapeBufferDistance.value, 10)

      // Node A at center (100, 100), 120x80
      const shapeA = new Avoid.ShapeRef(router, new Avoid.Rectangle(new Avoid.Point(100, 100), 120, 80))
      // Node B at center (400, 100), 120x80
      const shapeB = new Avoid.ShapeRef(router, new Avoid.Rectangle(new Avoid.Point(400, 100), 120, 80))

      // Pin on right of A (proportional: x=1.0=right, y=0.5=center)
      const pinA = new Avoid.ShapeConnectionPin(shapeA, 1, 1.0, 0.5, true, 0, ConnDirRight)
      pinA.setExclusive(false)

      // Pin on left of B
      const pinB = new Avoid.ShapeConnectionPin(shapeB, 2, 0.0, 0.5, true, 0, ConnDirLeft)
      pinB.setExclusive(false)

      const conn = new Avoid.ConnRef(router, new Avoid.ConnEnd(shapeA, 1), new Avoid.ConnEnd(shapeB, 2))

      router.processTransaction()

      const points = getRoutePoints(conn)

      expect(points.length).toBeGreaterThanOrEqual(2)
      // Source: right edge of A (100 + 60 = 160)
      expect(points[0].x).toBeCloseTo(160, 0)
      expect(points[0].y).toBeCloseTo(100, 0)
      // Dest: left edge of B (400 - 60 = 340)
      expect(points[points.length - 1].x).toBeCloseTo(340, 0)
      expect(points[points.length - 1].y).toBeCloseTo(100, 0)

      router.delete()
    })

    it('supports multiple ports per side', () => {
      const router = new Avoid.Router(Avoid.RouterFlag.OrthogonalRouting.value)
      router.setRoutingParameter(Avoid.RoutingParameter.shapeBufferDistance.value, 10)

      const shape = new Avoid.ShapeRef(router, new Avoid.Rectangle(new Avoid.Point(200, 200), 120, 100))

      // 3 ports on bottom
      for (let i = 0; i < 3; i++) {
        const pin = new Avoid.ShapeConnectionPin(shape, 10 + i, (i + 1) / 4, 1.0, true, 0, ConnDirDown)
        pin.setExclusive(false)
      }

      // Connect to 3 different destinations
      const dests = [
        new Avoid.ShapeRef(router, new Avoid.Rectangle(new Avoid.Point(100, 400), 60, 40)),
        new Avoid.ShapeRef(router, new Avoid.Rectangle(new Avoid.Point(200, 400), 60, 40)),
        new Avoid.ShapeRef(router, new Avoid.Rectangle(new Avoid.Point(300, 400), 60, 40)),
      ]

      const conns = dests.map((dest, i) =>
        new Avoid.ConnRef(
          router,
          new Avoid.ConnEnd(shape, 10 + i),
          new Avoid.ConnEnd(new Avoid.Point(dest.position().x, dest.position().y - 20)),
        ),
      )

      router.processTransaction()

      // All routes should be valid with distinct start X positions
      const startXs = conns.map((c) => getRoutePoints(c)[0].x)
      expect(new Set(startXs.map((x) => Math.round(x))).size).toBe(3)

      router.delete()
    })
  })

  describe('parallel edge nudging', () => {
    it('separates parallel edges between the same node pair', () => {
      const router = new Avoid.Router(Avoid.RouterFlag.OrthogonalRouting.value)
      router.setRoutingParameter(Avoid.RoutingParameter.shapeBufferDistance.value, 10)
      router.setRoutingParameter(Avoid.RoutingParameter.idealNudgingDistance.value, 20)
      router.setRoutingOption(
        Avoid.RoutingOption.nudgeOrthogonalSegmentsConnectedToShapes.value,
        true,
      )

      const shapeA = new Avoid.ShapeRef(router, new Avoid.Rectangle(new Avoid.Point(200, 50), 120, 80))
      const shapeB = new Avoid.ShapeRef(router, new Avoid.Rectangle(new Avoid.Point(200, 300), 120, 80))

      // 3 pins on bottom of A, 3 on top of B
      for (let i = 0; i < 3; i++) {
        const xRatio = (i + 1) / 4
        const pA = new Avoid.ShapeConnectionPin(shapeA, 10 + i, xRatio, 1.0, true, 0, ConnDirDown)
        pA.setExclusive(false)
        const pB = new Avoid.ShapeConnectionPin(shapeB, 20 + i, xRatio, 0.0, true, 0, ConnDirUp)
        pB.setExclusive(false)
      }

      const conns = Array.from({ length: 3 }, (_, i) =>
        new Avoid.ConnRef(router, new Avoid.ConnEnd(shapeA, 10 + i), new Avoid.ConnEnd(shapeB, 20 + i)),
      )

      router.processTransaction()

      const allPoints = conns.map(getRoutePoints)

      // All routes valid
      for (const pts of allPoints) {
        expect(pts.length).toBeGreaterThanOrEqual(2)
      }

      // Start X positions should be distinct (separated by pins)
      const startXs = allPoints.map((pts) => Math.round(pts[0].x))
      expect(new Set(startXs).size).toBe(3)

      router.delete()
    })
  })

  describe('polyline routing', () => {
    it('routes with non-orthogonal segments', () => {
      const router = new Avoid.Router(Avoid.RouterFlag.PolyLineRouting.value)
      router.setRoutingParameter(Avoid.RoutingParameter.shapeBufferDistance.value, 10)

      new Avoid.ShapeRef(router, new Avoid.Rectangle(new Avoid.Point(100, 100), 80, 60))
      new Avoid.ShapeRef(router, new Avoid.Rectangle(new Avoid.Point(400, 300), 80, 60))

      const conn = new Avoid.ConnRef(
        router,
        new Avoid.ConnEnd(new Avoid.Point(140, 130)),
        new Avoid.ConnEnd(new Avoid.Point(400, 270)),
      )

      router.processTransaction()

      const points = getRoutePoints(conn)
      expect(points.length).toBeGreaterThanOrEqual(2)

      router.delete()
    })
  })

  describe('performance', () => {
    it('routes 180 edges across 100 nodes in under 2 seconds', () => {
      const router = new Avoid.Router(Avoid.RouterFlag.OrthogonalRouting.value)
      router.setRoutingParameter(Avoid.RoutingParameter.shapeBufferDistance.value, 8)
      router.setRoutingParameter(Avoid.RoutingParameter.idealNudgingDistance.value, 12)

      const cols = 10
      const rows = 10
      const shapes: any[] = []
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          shapes.push(
            new Avoid.ShapeRef(
              router,
              new Avoid.Rectangle(new Avoid.Point(100 + c * 200, 100 + r * 150), 80, 60),
            ),
          )
        }
      }

      const conns: any[] = []
      // Horizontal
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols - 1; c++) {
          conns.push(
            new Avoid.ConnRef(
              router,
              new Avoid.ConnEnd(new Avoid.Point(140 + c * 200, 100 + r * 150)),
              new Avoid.ConnEnd(new Avoid.Point(160 + (c + 1) * 200, 100 + r * 150)),
            ),
          )
        }
      }
      // Vertical
      for (let r = 0; r < rows - 1; r++) {
        for (let c = 0; c < cols; c++) {
          conns.push(
            new Avoid.ConnRef(
              router,
              new Avoid.ConnEnd(new Avoid.Point(100 + c * 200, 130 + r * 150)),
              new Avoid.ConnEnd(new Avoid.Point(100 + c * 200, 70 + (r + 1) * 150)),
            ),
          )
        }
      }

      const start = performance.now()
      router.processTransaction()
      const elapsed = performance.now() - start

      expect(elapsed).toBeLessThan(2000)

      let validRoutes = 0
      for (const conn of conns) {
        if (conn.displayRoute().size() >= 2) validRoutes++
      }
      expect(validRoutes).toBe(conns.length)

      console.log(`[libavoid perf] ${conns.length} edges, ${shapes.length} nodes: ${elapsed.toFixed(1)}ms`)

      router.delete()
    })

    it('incremental re-route after node move completes under 100ms', () => {
      const router = new Avoid.Router(Avoid.RouterFlag.OrthogonalRouting.value)
      router.setRoutingParameter(Avoid.RoutingParameter.shapeBufferDistance.value, 10)

      const shapeA = new Avoid.ShapeRef(router, new Avoid.Rectangle(new Avoid.Point(100, 100), 80, 60))
      new Avoid.ShapeRef(router, new Avoid.Rectangle(new Avoid.Point(400, 100), 80, 60))
      const obstacle = new Avoid.ShapeRef(router, new Avoid.Rectangle(new Avoid.Point(250, 100), 60, 60))

      const conn = new Avoid.ConnRef(
        router,
        new Avoid.ConnEnd(new Avoid.Point(140, 100)),
        new Avoid.ConnEnd(new Avoid.Point(360, 100)),
      )

      router.processTransaction()

      // Move obstacle
      const start = performance.now()
      router.moveShape_delta(obstacle, 0, 80)
      router.processTransaction()
      const elapsed = performance.now() - start

      expect(elapsed).toBeLessThan(100)

      const route = conn.displayRoute()
      expect(route.size()).toBeGreaterThanOrEqual(2)

      console.log(`[libavoid perf] incremental re-route: ${elapsed.toFixed(1)}ms`)

      router.delete()
    })
  })
})
