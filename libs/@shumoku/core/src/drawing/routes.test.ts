// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { describe, expect, it } from 'vitest'
import { layoutParts } from './layout.js'
import { routesOf } from './routes.js'
import { networkOf, testMetrics } from './testing/support.js'

const yaml = `
nodes:
  - { id: core, type: router }
  - { id: a, type: l2-switch }
  - { id: b, type: l2-switch }
links:
  - endpoints: [{ node: core, port: p1 }, { node: a, port: p1 }]
  - endpoints: [{ node: core, port: p2 }, { node: b, port: p1 }]
  - endpoints: [{ node: a, port: p2 }, { node: b, port: p2 }]
`

describe('routesOf', () => {
  it('names a line it finds no way for instead of stopping the drawing', () => {
    const { network, structure } = networkOf(yaml, ['core'])
    const parts = layoutParts(network, structure, testMetrics)
    expect(parts.routes.unrouted).toEqual([])
    // the same problem with every door shut: no line has a way
    const shut = { ...parts.corridors, doorsOf: parts.corridors.doorsOf.map(() => []) }
    const routes = routesOf(parts.problem, parts.layers, shut)
    expect(routes.routes.size).toBe(0)
    expect([...routes.unrouted].sort()).toEqual(parts.problem.lines.map((l) => l.id).sort())
  })
})
