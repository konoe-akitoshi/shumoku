import { describe, expect, it } from 'vitest'
import { orientPlanes } from './orientation.js'
import type { Orientation, PlaneGraph, Side, VertexRef } from './stage-types.js'

const plane = (side: Side, pairs: string, id = 'default'): PlaneGraph => {
  const edges = pairs
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => {
      const [a, b] = p.split('-') as [string, string]
      return { a, b, multiplicity: 1, lines: [] }
    })
  return { plane: id, side, vertices: [...new Set(edges.flatMap((e) => [e.a, e.b]))], edges }
}

// The orientation as it was written before the spaces were split into sets with exits: one
// search for what the boundary reaches, a second from the grounds for what it does not, and a
// branch per side in `near`. Kept as the reference the new form must agree with line for line.
function previousOrientPlanes(
  planes: readonly PlaneGraph[],
  boundary: readonly VertexRef[],
): Orientation[] {
  const at = new Set(boundary)
  const cabled = new Set(
    planes.filter((p) => p.side === 'physical').flatMap((p) => p.edges.flatMap((e) => [e.a, e.b])),
  )
  const virtual = planes.filter((p) => p.side === 'virtual')
  const reached = previousDistances(virtual, boundary, (v) => at.has(v) || !cabled.has(v))
  const beyond = (v: VertexRef) => !cabled.has(v) && !reached.has(v)
  const grounds = new Set<VertexRef>()
  for (const e of virtual.flatMap((p) => p.edges)) {
    if (cabled.has(e.a) && beyond(e.b)) grounds.add(e.a)
    if (cabled.has(e.b) && beyond(e.a)) grounds.add(e.b)
  }
  const outward = previousDistances(virtual, [...grounds].sort(), beyond)
  const distance = {
    physical: previousDistances(
      planes.filter((p) => p.side === 'physical'),
      boundary,
      () => true,
    ),
    virtual: reached,
  }
  const near = (side: Side, v: VertexRef, other: VertexRef): number | undefined => {
    const own = distance[side].get(v)
    if (own !== undefined || side === 'physical') return own
    if (beyond(v)) return outward.get(v)
    return cabled.has(v) && beyond(other) ? 0 : undefined
  }
  return planes.map((p) => {
    const flows: [VertexRef, VertexRef][] = []
    const even: [VertexRef, VertexRef][] = []
    for (const e of p.edges) {
      const da = near(p.side, e.a, e.b)
      const db = near(p.side, e.b, e.a)
      if (da === undefined || db === undefined) continue
      if (da < db) flows.push([e.a, e.b])
      else if (db < da) flows.push([e.b, e.a])
      else even.push([e.a, e.b])
    }
    return { plane: p.plane, side: p.side, flows, even }
  })
}

function previousDistances(
  graphs: readonly PlaneGraph[],
  from: readonly VertexRef[],
  may: (v: VertexRef) => boolean,
): Map<VertexRef, number> {
  const neighbours = new Map<VertexRef, VertexRef[]>()
  for (const g of graphs) {
    for (const e of g.edges) {
      neighbours.set(e.a, [...(neighbours.get(e.a) ?? []), e.b])
      neighbours.set(e.b, [...(neighbours.get(e.b) ?? []), e.a])
    }
  }
  const distance = new Map(from.map((v) => [v, 0]))
  const queue = [...from]
  for (let v = queue.shift(); v !== undefined; v = queue.shift()) {
    const here = distance.get(v) ?? 0
    for (const w of neighbours.get(v) ?? []) {
      if (distance.has(w) || !may(w)) continue
      distance.set(w, here + 1)
      queue.push(w)
    }
  }
  return distance
}

/** A seeded generator, so a failure can be run again. */
function seeded(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function randomPlanes(rnd: () => number): { planes: PlaneGraph[]; names: VertexRef[] } {
  const names = Array.from({ length: 4 + Math.floor(rnd() * 7) }, (_, i) => `v${i}`)
  const pairs = (count: number) =>
    Array.from({ length: count }, () => {
      const a = names[Math.floor(rnd() * names.length)] as string
      const b = names[Math.floor(rnd() * names.length)] as string
      return a === b ? '' : `${a}-${b}`
    }).join(' ')
  const planes = [
    plane('physical', pairs(Math.floor(rnd() * names.length * 1.2))),
    plane('virtual', pairs(Math.floor(rnd() * names.length))),
    plane('physical', pairs(Math.floor(rnd() * 4)), 'rd'),
    plane('virtual', pairs(Math.floor(rnd() * 3)), 'rd'),
  ]
  return { planes, names }
}

describe('orientPlanes agrees with the form it replaced', () => {
  it('on random planes and random boundary points', () => {
    for (let seed = 1; seed <= 400; seed++) {
      const rnd = seeded(seed)
      const { planes, names } = randomPlanes(rnd)
      const boundary = names.filter(() => rnd() < 0.3)
      expect(orientPlanes(planes, boundary), `seed ${seed}`).toEqual(
        previousOrientPlanes(planes, boundary),
      )
    }
  })
})

describe('orientPlanes, the spaces told by the network and the reader', () => {
  const virtualOf = (o: Orientation[]) => o.filter((x) => x.side === 'virtual')
  const flows = (o: Orientation[]) => virtualOf(o).flatMap((x) => x.flows.map((f) => f.join('>')))
  const even = (o: Orientation[]) => virtualOf(o).flatMap((x) => x.even.map((f) => f.join('=')))

  it('measures from the exits the reader named, and leaves the others as lines laid over', () => {
    // fw has a cable and a virtual line to tgw, which cc1 reaches through dxgw.
    const planes = [plane('physical', 'cc1-fw'), plane('virtual', 'cc1-dxgw dxgw-tgw fw-tgw')]
    const o = orientPlanes(planes, ['cc1'])
    expect(flows(o)).toEqual(['cc1>dxgw', 'dxgw>tgw'])
    expect(even(o)).toEqual([])
  })

  it('measures from every exit when the reader named none of them', () => {
    const planes = [plane('physical', 'g1-g2'), plane('virtual', 'g1-x g2-x x-y')]
    expect(flows(orientPlanes(planes, []))).toEqual(['g1>x', 'g2>x', 'x>y'])
  })

  it('moves a whole set when the reader names one of its exits', () => {
    const planes = [plane('physical', 'g1-g2'), plane('virtual', 'g1-x g2-x x-y')]
    expect(flows(orientPlanes(planes, ['g1']))).toEqual(['g1>x', 'x>y'])
  })

  it('does not change a set when a boundary point that does not touch it is added', () => {
    const planes = [plane('physical', 'g1-g2 g2-h'), plane('virtual', 'g1-x x-y h-z')]
    const before = orientPlanes(planes, ['h'])
    const after = orientPlanes(planes, ['h', 'g2'])
    expect(flows(before)).toEqual(['g1>x', 'x>y', 'h>z'])
    expect(flows(after)).toEqual(flows(before))
  })

  it('measures from a boundary point that is itself a space', () => {
    const planes = [plane('physical', 'g1-g2'), plane('virtual', 'g1-x x-y y-z')]
    expect(flows(orientPlanes(planes, ['y']))).toEqual(['y>x', 'y>z'])
  })

  it('lets two sets share one ground without either changing the other', () => {
    const planes = [plane('physical', 'g-h'), plane('virtual', 'g-x g-y y-z')]
    expect(flows(orientPlanes(planes, []))).toEqual(['g>x', 'g>y', 'y>z'])
    // {x} and {y, z} are two sets joined only through g; naming y moves {y, z} alone.
    expect(flows(orientPlanes(planes, ['y']))).toEqual(['g>x', 'y>z'])
  })

  it('leaves a line between two grounds out, exits included, unless both are boundary points', () => {
    const planes = [plane('physical', 'g1-g2 g2-g3'), plane('virtual', 'g1-x g2-x g1-g2 g2-g3')]
    const o = orientPlanes(planes, [])
    expect(even(o)).toEqual([])
    expect(flows(o)).toEqual(['g1>x', 'g2>x'])
    expect(even(orientPlanes(planes, ['g1', 'g2']))).toEqual(['g1=g2'])
  })

  it('never makes a cycle among the lines it lists', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const rnd = seeded(seed)
      const { planes, names } = randomPlanes(rnd)
      const boundary = names.filter(() => rnd() < 0.3)
      for (const side of ['physical', 'virtual'] as const) {
        const out = new Map<string, string[]>()
        for (const o of orientPlanes(planes, boundary).filter((x) => x.side === side)) {
          for (const [a, b] of o.flows) out.set(a, [...(out.get(a) ?? []), b])
        }
        const state = new Map<string, 1 | 2>()
        const cyclic = (v: string): boolean => {
          if (state.get(v) === 2) return false
          if (state.get(v) === 1) return true
          state.set(v, 1)
          const found = (out.get(v) ?? []).some(cyclic)
          state.set(v, 2)
          return found
        }
        expect([...out.keys()].some(cyclic), `seed ${seed} ${side}`).toBe(false)
      }
    }
  })
})
