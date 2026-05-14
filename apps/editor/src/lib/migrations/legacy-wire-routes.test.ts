// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

import type { Link } from '@shumoku/core'
import { describe, expect, it } from 'vitest'
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
  let counter = 0
  return {
    links,
    newBendId: () => `bend-${++counter}`,
  }
}

describe('migrateLegacyWireRoutes', () => {
  it('converts each controlPoint into a Link.bends entry at afterIndex -1', () => {
    const links = [makeLink('L1', ['existing-tp'])]
    const deps = makeDeps(links)
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

    expect(links[0]?.bends).toEqual([
      { id: 'bend-1', x: 10, y: 20, afterIndex: -1 },
      { id: 'bend-2', x: 30, y: 40, afterIndex: -1 },
    ])
    // The existing via chain is untouched — bends migrated to their
    // own field, not interleaved into via.
    expect(links[0]?.via).toEqual(['existing-tp'])
  })

  it('no-ops for scenes without wireRoutes, empty routes, or empty points', () => {
    const links = [makeLink('L1')]
    const deps = makeDeps(links)
    migrateLegacyWireRoutes(
      [
        { id: 'S1' } as LegacyScene,
        { id: 'S2', wireRoutes: [] } as LegacyScene,
        { id: 'S3', wireRoutes: [{ linkId: 'L1' }] } as LegacyScene,
        { id: 'S4', wireRoutes: [{ linkId: 'L1', controlPoints: [] }] } as LegacyScene,
      ],
      deps,
    )
    expect(links[0]?.bends).toBeUndefined()
  })

  it('skips routes whose link is missing (orphan reference)', () => {
    const links = [makeLink('L1')]
    const deps = makeDeps(links)
    const scene: LegacyScene = {
      id: 'S1',
      wireRoutes: [{ linkId: 'L-missing', controlPoints: [{ x: 1, y: 2 }] }],
    }
    migrateLegacyWireRoutes([scene], deps)
    expect(links[0]?.bends).toBeUndefined()
  })

  it('handles a link without prior via (undefined)', () => {
    const links = [makeLink('L1')]
    const deps = makeDeps(links)
    const scene: LegacyScene = {
      id: 'S1',
      wireRoutes: [{ linkId: 'L1', controlPoints: [{ x: 1, y: 2 }] }],
    }
    migrateLegacyWireRoutes([scene], deps)
    expect(links[0]?.bends).toEqual([{ id: 'bend-1', x: 1, y: 2, afterIndex: -1 }])
    expect(links[0]?.via).toBeUndefined()
  })
})
