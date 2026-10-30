// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { describe, expect, it } from 'vitest'
import { routeGlobal } from './global.js'
import { layoutParts } from './layout.js'
import { portEntities } from './ports.js'
import { meet, roomsOf } from './rooms.js'
import { buildSpace } from './space.js'
import { networkOf, testMetrics } from './testing.js'

const yaml = `
nodes:
  - { id: top }
  - { id: a, group: g }
  - { id: b, group: g }
  - { id: c }
links:
  - { endpoints: [{ node: top }, { node: a }] }
  - { endpoints: [{ node: top }, { node: b }] }
  - { endpoints: [{ node: a }, { node: c }] }
  - { endpoints: [{ node: b }, { node: c }] }
  - { endpoints: [{ node: top }, { node: c }], virtual: true }
groups: [{ id: g }]
`

function setup() {
  const { network, structure } = networkOf(yaml, ['top'])
  const { problem, geometry } = layoutParts(network, structure, testMetrics)
  const space = buildSpace(problem, geometry)
  const routes = routeGlobal(problem, geometry, space)
  const ports = portEntities(problem, geometry, routes)
  return {
    problem,
    geometry,
    space,
    routes,
    rooms: roomsOf(problem, geometry, space, routes, ports),
  }
}

describe('the room of a run', () => {
  const { space, routes, rooms } = setup()

  it('has a room for every run of every route, and one across for every joint', () => {
    for (const [id, r] of routes.routes) {
      const got = rooms.get(id)
      expect(got?.runs).toHaveLength(r.runs.length)
      expect(got?.across).toHaveLength(r.runs.length)
      for (const [i, run] of r.runs.entries()) {
        expect(got?.across[i] !== undefined).toBe(i > 0 && run.kind === 'joint')
      }
    }
  })

  it('lies within the doors that the run goes through', () => {
    for (const [id, r] of routes.routes) {
      for (const [i, run] of r.runs.entries()) {
        const room = rooms.get(id)?.runs[i]
        for (const h of run.hops) {
          const d = space.doors[r.steps[h]?.door ?? -1]
          expect(d).toBeDefined()
          if (!d || !room) continue
          expect(room.lo).toBeGreaterThanOrEqual(d.reach[0] - 1e-6)
          expect(room.hi).toBeLessThanOrEqual(d.reach[1] + 1e-6)
        }
      }
    }
  })

  it('names the items that bound it, at the end where a card does', () => {
    let named = 0
    for (const [id, r] of routes.routes) {
      for (const [i] of r.runs.entries()) {
        const room = rooms.get(id)?.runs[i]
        if (room?.loBy) {
          named++
          expect(room.loBy.item).not.toBe('')
        }
        if (room?.hiBy) {
          named++
          expect(room.hiBy.item).not.toBe('')
        }
      }
    }
    expect(named).toBeGreaterThan(0)
  })

  it('is what two rooms leave, with the items that make the tighter ends', () => {
    const got = meet(
      { lo: 0, hi: 10, loBy: { item: 'p', edge: -1 } },
      { lo: 4, hi: 20, loBy: { item: 'q', edge: 3 }, hiBy: { item: 'r', edge: 21 } },
    )
    expect(got).toEqual({ lo: 4, hi: 10, loBy: { item: 'q', edge: 3 } })
  })
})
