import { describe, expect, it } from 'vitest'
import { polylineOffsetPath, polylinePath } from './svg-coords.js'

// ============================================================================
// polylinePath (smoke tests — the function is also tested indirectly via
// polylineOffsetPath which calls it on the resulting offset points)
// ============================================================================

describe('polylinePath', () => {
  it('returns empty string for empty input', () => {
    expect(polylinePath([])).toBe('')
  })

  it('returns M command for single point', () => {
    expect(polylinePath([{ x: 10, y: 20 }])).toBe('M 10 20')
  })

  it('returns M + L for two points', () => {
    const d = polylinePath([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ])
    expect(d).toMatch(/^M 0 0/)
    expect(d).toContain('L 100 0')
  })
})

// ============================================================================
// polylineOffsetPath
// ============================================================================

describe('polylineOffsetPath', () => {
  // Helper to parse the first M x y from a path string
  function parseFirstM(d: string): { x: number; y: number } {
    const m = /M ([\d.e+-]+) ([\d.e+-]+)/.exec(d)
    if (!m) throw new Error(`No M command in: ${d}`)
    return { x: Number(m[1]), y: Number(m[2]) }
  }

  // Helper to parse the last L x y (or last coord) from a path string
  function parseLastPoint(d: string): { x: number; y: number } {
    // Find the last L or final numbers in the path
    const matches = [...d.matchAll(/[ML] ([\d.e+-]+) ([\d.e+-]+)/g)]
    const last = matches[matches.length - 1]
    if (!last) throw new Error(`No L/M commands in: ${d}`)
    return { x: Number(last[1]), y: Number(last[2]) }
  }

  it('returns base polylinePath for offset=0', () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ]
    expect(polylineOffsetPath(pts, 0)).toBe(polylinePath(pts))
  })

  it('returns base polylinePath for non-finite offset', () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ]
    expect(polylineOffsetPath(pts, Number.NaN)).toBe(polylinePath(pts))
    expect(polylineOffsetPath(pts, Number.POSITIVE_INFINITY)).toBe(polylinePath(pts))
  })

  it('returns base polylinePath for fewer than 2 points', () => {
    const single = [{ x: 5, y: 5 }]
    expect(polylineOffsetPath(single, 10)).toBe(polylinePath(single))
  })

  // 1. Straight horizontal segment — +offset shifts y downward
  it('offsets a horizontal segment correctly in y', () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ]
    const offset = 5
    const d = polylineOffsetPath(pts, offset)
    // For rightward travel (dx=100, dy=0), right-hand normal = (-dy/len, dx/len) * offset
    // = (0, 1) * 5 = (0, 5) → start and end shift from y=0 to y=5
    const start = parseFirstM(d)
    const end = parseLastPoint(d)
    expect(start.y).toBeCloseTo(5, 5)
    expect(start.x).toBeCloseTo(0, 5)
    expect(end.y).toBeCloseTo(5, 5)
    expect(end.x).toBeCloseTo(100, 5)
  })

  // 2. L-shaped polyline: corner joins at intersection of offset lines
  it('miters an L-shaped (right then down) polyline correctly', () => {
    // Segment 1: (0,0) → (100,0) rightward
    //   offset normal: (0, +offset) → start (0, offset), end (100, offset)
    //   offset line 1: horizontal at y = offset
    // Segment 2: (100,0) → (100,100) downward
    //   direction: (0,1), right-hand normal: (-1,0)*offset = (-offset, 0)
    //   start (100-offset, 0), end (100-offset, 100)
    //   offset line 2: vertical at x = 100-offset
    // Intersection: (100-offset, offset)
    const pts = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
    ]
    const offset = 10
    const d = polylineOffsetPath(pts, offset)
    // Start point should be (0, 10)
    const start = parseFirstM(d)
    expect(start.x).toBeCloseTo(0, 4)
    expect(start.y).toBeCloseTo(10, 4)
    // End point should be (90, 100)
    const end = parseLastPoint(d)
    expect(end.x).toBeCloseTo(90, 4)
    expect(end.y).toBeCloseTo(100, 4)
  })

  // 3. +offset and -offset produce mirror images
  it('positive and negative offset are y-axis mirrors for horizontal segment', () => {
    const pts = [
      { x: 0, y: 50 },
      { x: 100, y: 50 },
    ]
    const offset = 8
    const pos = polylineOffsetPath(pts, offset)
    const neg = polylineOffsetPath(pts, -offset)
    const posStart = parseFirstM(pos)
    const negStart = parseFirstM(neg)
    // Positive offset goes to y=50+8=58, negative to y=50-8=42
    expect(posStart.y).toBeCloseTo(50 + offset, 4)
    expect(negStart.y).toBeCloseTo(50 - offset, 4)
    // x should be the same
    expect(posStart.x).toBeCloseTo(negStart.x, 4)
  })

  // 4. Degenerate: two identical points must not throw
  it('does not throw for two identical points', () => {
    const pts = [
      { x: 50, y: 50 },
      { x: 50, y: 50 },
    ]
    expect(() => polylineOffsetPath(pts, 5)).not.toThrow()
  })

  // 5. Lane separation on horizontal segment
  it('two lanes on a horizontal segment are at least 2.5px apart', () => {
    // With laneWidth=2 (min), laneOffset = laneWidth/2 + 0.5 = 1.5
    // The two lanes are offset by +1.5 and -1.5 → separation = 3 ≥ 2.5
    const pts = [
      { x: 0, y: 0 },
      { x: 200, y: 0 },
    ]
    const laneWidth = 2
    const laneOffset = laneWidth / 2 + 0.5
    const inPath = polylineOffsetPath(pts, laneOffset)
    const outPath = polylineOffsetPath(pts, -laneOffset)
    const inY = parseFirstM(inPath).y
    const outY = parseFirstM(outPath).y
    expect(Math.abs(inY - outY)).toBeGreaterThanOrEqual(2.5)
  })

  // 6. Single-segment vertical line
  it('offsets a vertical segment correctly in x', () => {
    // Upward travel: (0,100) → (0,0), direction (0,-1)
    // Right-hand normal: (-(-1)/1, 0/1) * offset = (1, 0) * offset
    // So +offset shifts x by +offset
    const pts = [
      { x: 0, y: 100 },
      { x: 0, y: 0 },
    ]
    const offset = 7
    const d = polylineOffsetPath(pts, offset)
    const start = parseFirstM(d)
    expect(start.x).toBeCloseTo(offset, 4)
    expect(start.y).toBeCloseTo(100, 4)
  })
})
