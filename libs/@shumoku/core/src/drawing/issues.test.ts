// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { afterEach, describe, expect, it, vi } from 'vitest'
import { CycleError } from './axis.js'
import * as geometry from './geometry.js'
import { varKey } from './keys.js'
import { layoutParts } from './layout.js'
import * as routing from './routes.js'
import { networkOf, testMetrics } from './testing/support.js'

// The two fallbacks of the drawing, taken on purpose: what a real network asks for here is rare
// and depends on lengths, so the stage that would fail is made to fail for one line.
vi.mock('./geometry.js', async (original) => {
  const real = await original<typeof import('./geometry.js')>()
  return { ...real, placeAll: vi.fn(real.placeAll) }
})
vi.mock('./routes.js', async (original) => {
  const real = await original<typeof import('./routes.js')>()
  return { ...real, routesOf: vi.fn(real.routesOf) }
})

const yaml = `
nodes:
  - { id: core, type: router }
  - { id: a, type: l2-switch }
  - { id: b, type: l2-switch }
  - { id: c, type: server }
links:
  - endpoints: [{ node: core, port: p1 }, { node: a, port: up }]
  - endpoints: [{ node: core, port: p2 }, { node: b, port: up }]
  - endpoints: [{ node: a, port: p1 }, { node: c, port: e0 }]
`
const { network, structure } = networkOf(yaml, ['core'])
const draw = () => layoutParts(network, structure, testMetrics)
const lastLine = 'link:000002'

afterEach(async () => {
  const realRoutes = await vi.importActual<typeof import('./routes.js')>('./routes.js')
  const realGeometry = await vi.importActual<typeof import('./geometry.js')>('./geometry.js')
  vi.mocked(routing.routesOf).mockImplementation(realRoutes.routesOf)
  vi.mocked(geometry.placeAll).mockImplementation(realGeometry.placeAll)
})

describe('a line the drawing cannot give', () => {
  it('is left out and named when the corridors give it no way', async () => {
    const real = await vi.importActual<typeof import('./routes.js')>('./routes.js')
    vi.mocked(routing.routesOf).mockImplementation((...args) => {
      const walked = real.routesOf(...args)
      const routes = new Map([...walked.routes].filter(([id]) => id !== lastLine))
      return { ...walked, routes, unrouted: [lastLine] }
    })
    const parts = draw()
    expect(parts.scene.wires).toHaveLength(2)
    expect(parts.scene.issues?.map((i) => i.code)).toEqual(['no-route'])
  })

  it('is left out and named when its places close a ring every relaxation leaves', async () => {
    const real = await vi.importActual<typeof import('./geometry.js')>('./geometry.js')
    vi.mocked(geometry.placeAll).mockImplementation((problem, ranks, layers, corridors, tracks) => {
      const chain = tracks.chains.get(lastLine)
      const port = chain?.[0]
      if (port) throw new CycleError([0], 1, [`x ${varKey(port)}`])
      return real.placeAll(problem, ranks, layers, corridors, tracks)
    })
    const parts = draw()
    expect(parts.scene.wires).toHaveLength(2)
    expect(parts.scene.issues?.map((i) => i.code)).toEqual(['constraint-cycle'])
    expect(parts.routes.routes.has(lastLine)).toBe(false)
    expect(parts.routes.cyclic).toEqual([lastLine])
  })
})
