import { describe, expect, it } from 'vitest'
import { buildHaHullPath, groupCouplingPairs } from './ha-hull.js'

// The approved mockup's hero geometry: two 148×112 cards at (62,44) and
// (290,44), seam link at y=100 — expected hull hand-verified in the design.
const A = { x: 62, y: 44, width: 148, height: 112 }
const B = { x: 290, y: 44, width: 148, height: 112 }

describe('buildHaHullPath', () => {
  it('renders the approved two-lens glasses for the mockup pair', () => {
    const { d, bounds, fallback } = buildHaHullPath({
      members: [A, B],
      seams: [{ y: 100 }],
    })
    expect(fallback).toBe(false)
    expect(d).toBe(
      'M72,34 H200 Q220,34 220,54 V76 Q220,84 228,84 H272 Q280,84 280,76 V54 Q280,34 300,34 ' +
        'H428 Q448,34 448,54 V146 Q448,166 428,166 H300 Q280,166 280,146 V124 Q280,116 272,116 ' +
        'H228 Q220,116 220,124 V146 Q220,166 200,166 H72 Q52,166 52,146 V54 Q52,34 72,34 Z',
    )
    expect(bounds).toEqual({ x: 52, y: 34, width: 396, height: 132 })
  })

  it('sorts members by center x (input order must not matter)', () => {
    const sorted = buildHaHullPath({ members: [A, B], seams: [{ y: 100 }] })
    const reversed = buildHaHullPath({ members: [B, A], seams: [{ y: 100 }] })
    expect(reversed.d).toBe(sorted.d)
  })

  it('chains three members into a three-lens hull with two seams', () => {
    const C = { x: 518, y: 44, width: 148, height: 112 }
    const { d, fallback } = buildHaHullPath({
      members: [A, B, C],
      seams: [{ y: 100 }, { y: 100 }],
    })
    expect(fallback).toBe(false)
    // 3 lenses × 4 outer corners + 2 notches × 4 concave fillets = 20 Q arcs;
    // count Q commands as a structural check.
    const qCount = (d.match(/Q/g) ?? []).length
    expect(qCount).toBe(20)
    expect(d.endsWith('Z')).toBe(true)
  })

  it('clamps the seam center into the lane instead of breaking the path', () => {
    // Seam far above the nodes: the notch must clamp inside the lens walls.
    const { d, fallback } = buildHaHullPath({ members: [A, B], seams: [{ y: -500 }] })
    expect(fallback).toBe(false)
    // Notch top edge can never rise above lensTop + outerR + fillet = 34+20+8.
    expect(d).toContain('V54') // right wall still reaches the corner arc end
    expect(d.endsWith('Z')).toBe(true)
  })

  it('shrinks the notch when the lenses are too short for the default', () => {
    const shortA = { x: 0, y: 0, width: 100, height: 48 }
    const shortB = { x: 160, y: 0, width: 100, height: 48 }
    const { fallback } = buildHaHullPath({ members: [shortA, shortB] })
    // 48+2*pad=68 tall lenses: 68 − 2*(outerR+fillet) = 12 ≥ MIN_NOTCH → still glasses.
    expect(fallback).toBe(false)
  })

  it('falls back to a rounded union rect when members are stacked vertically', () => {
    const top = { x: 0, y: 0, width: 100, height: 60 }
    const below = { x: 0, y: 120, width: 100, height: 60 }
    const { d, bounds, fallback } = buildHaHullPath({ members: [top, below] })
    expect(fallback).toBe(true)
    expect(bounds).toEqual({ x: -10, y: -10, width: 120, height: 200 })
    expect((d.match(/Q/g) ?? []).length).toBe(4) // plain rounded rect
  })

  it('falls back when lenses overlap horizontally', () => {
    const left = { x: 0, y: 0, width: 100, height: 100 }
    const overlapping = { x: 90, y: 0, width: 100, height: 100 }
    const { fallback } = buildHaHullPath({ members: [left, overlapping] })
    expect(fallback).toBe(true)
  })

  it('renders a single member as a plain rounded lens', () => {
    const { d, fallback } = buildHaHullPath({ members: [A] })
    expect(fallback).toBe(false)
    expect((d.match(/Q/g) ?? []).length).toBe(4)
  })

  it('defaults the seam to the vertical center when none is given', () => {
    const withSeam = buildHaHullPath({ members: [A, B], seams: [{ y: 100 }] })
    const without = buildHaHullPath({ members: [A, B] })
    // Cards are vertically centered on y=100, so the default matches.
    expect(without.d).toBe(withSeam.d)
  })
})

describe('groupCouplingPairs', () => {
  it('groups a chain of pairs into one component', () => {
    const groups = groupCouplingPairs([
      { a: 'sw1', b: 'sw2', kind: 'stack' },
      { a: 'sw2', b: 'sw3', kind: 'stack' },
      { a: 'fw1', b: 'fw2', kind: 'ha' },
    ])
    const byLen = [...groups].sort((x, y) => x.members.length - y.members.length)
    expect(byLen).toHaveLength(2)
    expect([...(byLen[0]?.members ?? [])].sort()).toEqual(['fw1', 'fw2'])
    expect(byLen[0]?.kind).toBe('ha')
    expect([...(byLen[1]?.members ?? [])].sort()).toEqual(['sw1', 'sw2', 'sw3'])
    expect(byLen[1]?.kind).toBe('stack')
  })
})
