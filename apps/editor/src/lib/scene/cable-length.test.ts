// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

import type { Link, Node } from '@shumoku/core'
import { describe, expect, test } from 'vitest'
import type { Scene } from '../types'
import { cableLengthMeters } from './cable-length'

const link: Link = {
  id: 'wire',
  from: { node: 'a', port: 'a-port' },
  to: { node: 'b', port: 'b-port' },
}

function nodesWithScales(aScale: number, bScale: number): Map<string, Node> {
  return new Map([
    ['a', { id: 'a', label: 'A', metadata: { displayScale: aScale } } as Node],
    ['b', { id: 'b', label: 'B', metadata: { displayScale: bScale } } as Node],
  ])
}

describe('cableLengthMeters', () => {
  test('measures center anchors independently of rendered icon sizes', () => {
    const scene: Scene = {
      id: 'floor',
      name: 'Floor',
      placementOrigin: 'center',
      calibration: { pxPerMeter: 10 },
      nodePlacements: [
        { nodeId: 'a', position: { x: 100, y: 100 } },
        { nodeId: 'b', position: { x: 200, y: 100 } },
      ],
    }

    const smallToLarge = cableLengthMeters(link, [scene], nodesWithScales(0.5, 3))
    const largeToSmall = cableLengthMeters(link, [scene], nodesWithScales(3, 0.5))

    expect(smallToLarge).toEqual({ meters: 10, source: 'scene' })
    expect(largeToSmall).toEqual({ meters: 10, source: 'scene' })
  })
})
