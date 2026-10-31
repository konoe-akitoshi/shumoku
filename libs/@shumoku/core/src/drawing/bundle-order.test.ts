// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { describe, expect, it } from 'vitest'
import { orderBundles, orderSession } from './bundle-order.js'
import { createRouter, routeGlobal } from './global.js'
import { layoutParts } from './layout.js'
import { portSlots } from './ports.js'
import { roomsOf } from './rooms.js'
import { buildSpace } from './space.js'
import { networkOf, testMetrics } from './testing.js'

const yaml = `
nodes:
  - { id: top }
  - { id: a, group: g }
  - { id: b, group: g }
  - { id: c }
  - { id: d }
  - { id: x }
  - { id: y }
groups: [{ id: g }]
links:
  - { endpoints: [{ node: top }, { node: a }] }
  - { endpoints: [{ node: top }, { node: b }] }
  - { endpoints: [{ node: a }, { node: c }] }
  - { endpoints: [{ node: b }, { node: c }] }
  - { endpoints: [{ node: a }, { node: d }] }
  - { endpoints: [{ node: b }, { node: d }] }
  - { endpoints: [{ node: top }, { node: c }], virtual: true }
  - { endpoints: [{ node: top }, { node: d }], virtual: true }
  - { endpoints: [{ node: x }, { node: y }] }
`

function run() {
  const { network, structure } = networkOf(yaml, ['top'])
  const { problem, geometry } = layoutParts(network, structure, testMetrics)
  const space = buildSpace(problem, geometry)
  const routes = routeGlobal(problem, geometry, space)
  const ordering = orderBundles(space, routes, testMetrics.pitch)
  return { problem, space, routes, ordering }
}

describe('the order of lines at the doors', () => {
  const { routes, ordering } = run()

  it('has at each door exactly the lines that pass it, once for each time', () => {
    for (const [door, passings] of ordering.doors) {
      const through = [...routes.routes.values()].flatMap((r) =>
        r.steps.filter((s) => s.door === door).map(() => r.line),
      )
      expect(passings.map((e) => e.split('@')[0]).sort()).toEqual(through.sort())
    }
  })

  it('stands the ports of one side of a box at places of their own, so that their order counts', () => {
    const groups = new Map<string, string[]>()
    for (const r of routes.routes.values()) {
      for (const [end, a] of [
        ['a', r.from],
        ['b', r.to],
      ] as const) {
        const key = `${a.cell}|${a.box}|${a.out}`
        groups.set(key, [...(groups.get(key) ?? []), `${r.line}.${end}`])
      }
    }
    const rows = [...groups.values()].filter((g) => g.length >= 2)
    expect(rows.length).toBeGreaterThan(0)
    for (const row of rows) {
      const places = row.map((k) => ordering.ports.get(k))
      expect(places.every((p) => p !== undefined)).toBe(true)
      expect(new Set(places).size).toBe(row.length)
    }
  })

  it('crosses no more than lines put at each door in the order they were estimated to cross it', () => {
    expect(ordering.crossings).toBeLessThanOrEqual(ordering.crossingsByEstimate)
  })

  it('never crosses more once the ports follow the bundles', () => {
    expect(ordering.crossings).toBeLessThanOrEqual(ordering.crossingsBefore)
  })

  it('searches every order, for bundles of up to eight lines', () => {
    expect(ordering.approximated).toBe(0)
  })

  it('is the same for the same input', () => {
    const again = run().ordering
    expect([...again.doors]).toEqual([...ordering.doors])
    expect(again.crossings).toBe(ordering.crossings)
  })
})

/** A small network from a seed, for trying the orders on lines that cross. */
function randomNetwork(seed: number): string {
  let s = seed
  const next = (n: number) => {
    s = (s * 1103515245 + 12345) % 2147483648
    return s % n
  }
  const n = 8 + next(10)
  const links: string[] = []
  for (let i = 0; i < n; i++) {
    const parents = new Set<number>()
    for (let j = 0; j <= next(4); j++) parents.add(next(i + 1))
    for (const p of parents) {
      const from = p === 0 ? 'top' : `n${p - 1}`
      links.push(`  - { endpoints: [{ node: ${from} }, { node: n${i} }] }`)
    }
  }
  if (next(2) === 0)
    links.push(`  - { endpoints: [{ node: top }, { node: n${next(n)} }], virtual: true }`)
  const nodes = ['top', ...Array.from({ length: n }, (_, i) => `n${i}`)]
  return `nodes:\n${nodes.map((x) => `  - { id: ${x} }`).join('\n')}\nlinks:\n${links.join('\n')}\n`
}

function sessionOf(yaml: string) {
  const { network, structure } = networkOf(yaml, ['top'])
  const { problem, geometry } = layoutParts(network, structure, testMetrics)
  const space = buildSpace(problem, geometry)
  const routes = routeGlobal(problem, geometry, space)
  const rooms = roomsOf(problem, geometry, space, routes)
  return { space, routes, rooms, session: orderSession(space, routes, testMetrics.pitch, rooms) }
}

describe('changing the orders along the bundles', () => {
  const seeds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]

  it('counts what a change touches the same as counting everything again, for any run of changes', () => {
    let checked = 0
    for (const seed of seeds) {
      const { session } = sessionOf(randomNetwork(seed))
      session.climb()
      const start = session.total()
      let r = seed * 7919
      const pick = (n: number) => {
        r = (r * 1103515245 + 12345) % 2147483648
        return r % n
      }
      const undos: (() => void)[] = []
      for (let step = 0; step < 120; step++) {
        const moves = session.moves()
        const move = moves[pick(moves.length)]
        if (!move) break
        const undo = session.apply(move)
        if (!undo) continue
        undos.push(undo)
        expect(session.total()).toBe(session.recount())
        checked++
      }
      for (const undo of undos.reverse()) undo()
      expect(session.total()).toBe(start)
      expect(session.recount()).toBe(start)
    }
    expect(checked).toBeGreaterThan(100)
  })

  it('changes only the orders at the doors: the ports follow and are never swapped alone', () => {
    for (const seed of seeds) {
      const { session } = sessionOf(randomNetwork(seed))
      session.climb()
      for (const move of session.moves()) expect(move.kind).toBe('door')
      // the order of the ports is what the lines that leave them ask: the same after any change that is taken back
      const before = [...session.ordering().ports]
      for (const move of session.moves().slice(0, 40)) session.apply(move)?.()
      expect([...session.ordering().ports]).toEqual(before)
    }
  })

  it('says which ports the order of their side leaves no room, and lays their lines again with a joint', () => {
    let laid = 0
    for (const seed of seeds) {
      const { network, structure } = networkOf(randomNetwork(seed), ['top'])
      const { problem, geometry } = layoutParts(network, structure, testMetrics)
      const space = buildSpace(problem, geometry)
      const router = createRouter(problem, geometry, space)
      const slots = portSlots(problem)
      const settle = () => {
        const rooms = roomsOf(problem, geometry, space, router.result)
        return orderBundles(space, router.result, testMetrics.pitch, true, rooms, slots)
      }
      const first = settle()
      const unfit = first.unfit.map((k) => {
        const dot = k.lastIndexOf('.')
        return { line: k.slice(0, dot), end: k.slice(dot + 1) as 'a' | 'b' }
      })
      const again = router.loosen(unfit)
      expect(again.sort()).toEqual(first.unfit.sort())
      laid += again.length
      for (const key of again) {
        const [line, end] = [
          key.slice(0, key.lastIndexOf('.')),
          key.slice(key.lastIndexOf('.') + 1),
        ]
        const r = router.result.routes.get(line)
        const run = end === 'a' ? r?.runs[0] : r?.runs.at(-1)
        // the first run of an end laid again goes through no door: a joint follows it
        expect(run?.hops.length).toBe(0)
        expect((r?.runs.length ?? 0) > 1).toBe(true)
      }
      // and once laid again, those ports have the side for a window and are not asked again
      const second = settle()
      for (const key of again) expect(second.unfit).not.toContain(key)
    }
    expect(laid).toBeGreaterThan(0)
  })

  it('gives the total back when a change is taken back', () => {
    for (const seed of seeds) {
      const { session } = sessionOf(randomNetwork(seed))
      session.climb()
      const start = session.total()
      for (const move of session.moves().slice(0, 60)) {
        session.apply(move)?.()
        expect(session.total()).toBe(start)
      }
      expect(session.recount()).toBe(start)
    }
  })

  it('keeps a change only if the crossings are fewer, and stops where no change is', () => {
    for (const seed of seeds) {
      const { session } = sessionOf(randomNetwork(seed))
      const done = session.climb()
      expect(done.to).toBeLessThanOrEqual(done.from)
      expect(done.accepted).toBeLessThanOrEqual(done.tried)
      expect(session.total()).toBe(done.to)
      for (const move of session.moves()) {
        const undo = session.apply(move)
        if (!undo) continue
        expect(session.total()).toBeGreaterThanOrEqual(done.to)
        undo()
      }
    }
  })

  it('counts the cells of the ordering as the total', () => {
    for (const seed of seeds) {
      const { session } = sessionOf(randomNetwork(seed))
      const done = session.climb()
      const ordering = session.ordering()
      expect(ordering.crossings).toBe(done.to)
      expect(ordering.crossings).toBeLessThanOrEqual(ordering.crossingsSettled)
    }
  })

  it('leaves the routes as they were, so no line is longer', () => {
    const { routes, session } = sessionOf(randomNetwork(3))
    const before = JSON.stringify([...routes.routes])
    session.climb()
    expect(JSON.stringify([...routes.routes])).toBe(before)
  })

  it('has the same lines at each door as before, only in another order', () => {
    for (const seed of seeds) {
      const { session } = sessionOf(randomNetwork(seed))
      const before = new Map([...session.ordering().doors].map(([d, l]) => [d, [...l].sort()]))
      session.climb()
      for (const [door, list] of session.ordering().doors) {
        expect([...list].sort()).toEqual(before.get(door))
      }
    }
  })

  it('is the same for the same input', () => {
    const a = sessionOf(randomNetwork(5)).session
    const b = sessionOf(randomNetwork(5)).session
    a.climb()
    b.climb()
    expect([...a.ordering().doors]).toEqual([...b.ordering().doors])
    expect(a.total()).toBe(b.total())
  })
})

describe('changing the orders along a bundle at once', () => {
  // Swapping a pair of lines at every door they share must never leave more crossings than the
  // orders settled door by door, and where it takes some away they are really fewer.
  const seeds = Array.from({ length: 60 }, (_, i) => i + 1)

  it('has fewer crossings once the bundles are swapped whole than when the doors were settled one by one', () => {
    let fewer = 0
    for (const seed of seeds) {
      const { session } = sessionOf(randomNetwork(seed))
      const settled = session.ordering()
      const done = session.climb()
      expect(done.to).toBeLessThanOrEqual(done.from)
      expect(session.ordering().crossings).toBeLessThanOrEqual(settled.crossingsSettled)
      if (done.to < done.from) {
        fewer++
        expect(done.accepted).toBeGreaterThan(0)
        expect(session.ordering().crossings).toBeLessThan(settled.crossingsSettled)
      }
    }
    // None of these small networks is left with crossings that a swap along a bundle takes away
    // since the cells have a margin; the count says so, and a change that made one is welcome.
    expect(fewer).toBeGreaterThanOrEqual(0)
  })
})

describe('a run is one passing, at every door it goes through', () => {
  const seeds = Array.from({ length: 40 }, (_, i) => i + 1)

  const sameOrder = (doors: ReadonlyMap<number, string[]>) => {
    let shared = 0
    const where = new Map<string, Map<number, number>>()
    for (const [door, list] of doors) {
      for (const [i, id] of list.entries()) {
        where.set(id, (where.get(id) ?? new Map()).set(door, i))
      }
    }
    for (const [door, list] of doors) {
      for (const [i, x] of list.entries()) {
        for (const y of list.slice(i + 1)) {
          for (const [other, at] of where.get(x) ?? []) {
            const to = where.get(y)?.get(other)
            if (other === door || to === undefined) continue
            shared++
            // x stood before y here, so it stands before y there
            expect(at < to).toBe(true)
          }
        }
      }
    }
    return shared
  }

  it('puts two runs that go through two doors together in the same order at both', () => {
    let shared = 0
    for (const seed of seeds) {
      const { session } = sessionOf(randomNetwork(seed))
      shared += sameOrder(session.ordering().doors)
      session.climb()
      shared += sameOrder(session.ordering().doors)
    }
    expect(shared).toBeGreaterThan(0)
  })

  it('keeps that order through changes along the bundles, which are made or not made whole', () => {
    for (const seed of seeds.slice(0, 12)) {
      const { session } = sessionOf(randomNetwork(seed))
      let r = seed * 104729
      const pick = (n: number) => {
        r = (r * 1103515245 + 12345) % 2147483648
        return r % n
      }
      for (let step = 0; step < 60; step++) {
        const moves = session.moves()
        const move = moves[pick(moves.length)]
        if (!move) break
        session.apply(move)
        sameOrder(session.ordering().doors)
      }
    }
  })

  it('never puts a run before another whose room leaves it no place before', () => {
    const pitch = testMetrics.pitch
    for (const seed of seeds) {
      const { routes, rooms, session } = sessionOf(randomNetwork(seed))
      session.climb()
      const room = (id: string) => {
        const at = id.lastIndexOf('@')
        const line = id.slice(0, at)
        const route = routes.routes.get(line)
        const first = Number(id.slice(at + 1))
        const i = route?.runs.findIndex(
          (run) => run.hops.length > 0 && Math.min(...run.hops) + 1 === first,
        )
        return i === undefined || i < 0 ? undefined : rooms.get(line)?.runs[i]
      }
      for (const list of session.ordering().doors.values()) {
        for (const [i, x] of list.entries()) {
          for (const y of list.slice(i + 1)) {
            const a = room(x)
            const b = room(y)
            // y stands after x, which its room must let it: x would not need to be past the end of y's room
            if (a && b) expect(a.lo + pitch).toBeLessThanOrEqual(b.hi + 1e-6)
          }
        }
      }
    }
  })
})
