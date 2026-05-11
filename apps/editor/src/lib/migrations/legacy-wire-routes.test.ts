// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

import type { Link } from '@shumoku/core'
import { describe, expect, it, vi } from 'vitest'
import { type LegacyScene, migrateLegacyWireRoutes } from './legacy-wire-routes'

function makeLink(id: string, via?: string[]): Link {
  return {
    id,
    from: { node: 'a', port: 'p1' },
    to: { node: 'b', port: 'p1' },
    via,
  }
}

function makeDeps(links: Link[] = []) {
  const added: Array<{ sceneId: string; position: { x: number; y: number }; role: string }> = []
  const updated: Array<{ linkId: string; via: string[] }> = []
  let counter = 0
  return {
    added,
    updated,
    deps: {
      links,
      addTerminationInScene: vi.fn((sceneId: string, position, role) => {
        counter++
        const id = `bend-${counter}`
        added.push({ sceneId, position, role })
        return id
      }),
      updateLink: vi.fn((linkId: string, updates: { via: string[] }) => {
        updated.push({ linkId, via: updates.via })
      }),
    },
  }
}

describe('migrateLegacyWireRoutes', () => {
  it('converts each controlPoint into a bend Node and prepends to Link.via', () => {
    const link = makeLink('L1', ['existing-tp'])
    const { deps, added, updated } = makeDeps([link])
    const scene: LegacyScene = {
      id: 'S1',
      wireRoutes: [
        {
          linkId: 'L1',
          controlPoints: [
            { x: 10, y: 20 },
            { x: 30, y: 40 },
          ],
        },
      ],
    }

    migrateLegacyWireRoutes([scene], deps)

    expect(added).toEqual([
      { sceneId: 'S1', position: { x: 10, y: 20 }, role: 'bend' },
      { sceneId: 'S1', position: { x: 30, y: 40 }, role: 'bend' },
    ])
    // Bends placed BEFORE the pre-existing via entry — preserves the
    // visual order from when bends were first-class waypoints.
    expect(updated).toEqual([{ linkId: 'L1', via: ['bend-1', 'bend-2', 'existing-tp'] }])
  })

  it('no-ops for scenes without wireRoutes, empty routes, or empty points', () => {
    const { deps, added, updated } = makeDeps([makeLink('L1')])
    migrateLegacyWireRoutes(
      [
        { id: 'S1' } as LegacyScene,
        { id: 'S2', wireRoutes: [] } as LegacyScene,
        { id: 'S3', wireRoutes: [{ linkId: 'L1' }] } as LegacyScene,
        { id: 'S4', wireRoutes: [{ linkId: 'L1', controlPoints: [] }] } as LegacyScene,
      ],
      deps,
    )
    expect(added).toEqual([])
    expect(updated).toEqual([])
  })

  it('skips routes whose link is missing (orphan reference)', () => {
    const { deps, added, updated } = makeDeps([makeLink('L1')])
    const scene: LegacyScene = {
      id: 'S1',
      wireRoutes: [{ linkId: 'L-missing', controlPoints: [{ x: 1, y: 2 }] }],
    }
    migrateLegacyWireRoutes([scene], deps)
    expect(added).toEqual([])
    expect(updated).toEqual([])
  })

  it('handles a link without prior via (undefined)', () => {
    const link = makeLink('L1')
    const { deps, updated } = makeDeps([link])
    const scene: LegacyScene = {
      id: 'S1',
      wireRoutes: [{ linkId: 'L1', controlPoints: [{ x: 1, y: 2 }] }],
    }
    migrateLegacyWireRoutes([scene], deps)
    expect(updated).toEqual([{ linkId: 'L1', via: ['bend-1'] }])
  })
})
