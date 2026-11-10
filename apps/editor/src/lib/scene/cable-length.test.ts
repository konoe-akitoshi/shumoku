// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

import type { Link, Termination } from '@shumoku/core'
import { describe, expect, test } from 'vitest'
import type { Scene } from '../types'
import { cableLengthMeters, cableSegmentLengths } from './cable-length'

const link: Link = {
  id: 'wire',
  from: { node: 'a', port: 'a-port' },
  to: { node: 'b', port: 'b-port' },
}

function floor(aScale: number, bScale: number): Scene {
  return {
    id: 'floor',
    name: 'Floor',
    placementOrigin: 'center',
    calibration: { pxPerMeter: 10 },
    nodePlacements: [
      { nodeId: 'a', position: { x: 100, y: 100 }, scale: aScale },
      { nodeId: 'b', position: { x: 200, y: 100 }, scale: bScale },
    ],
  }
}

describe('cableLengthMeters', () => {
  test('measures center anchors independently of rendered icon sizes', () => {
    expect(cableLengthMeters(link, [floor(0.5, 3)])).toEqual({ meters: 10, source: 'scene' })
    expect(cableLengthMeters(link, [floor(3, 0.5)])).toEqual({ meters: 10, source: 'scene' })
  })

  test("follows the scene's bends and splits the run at a riser", () => {
    const terminations: Termination[] = [
      { id: 'out', label: 'Outlet', role: 'outlet' },
      { id: 'eps', label: 'EPS', role: 'eps' },
    ]
    const routed: Link = { ...link, via: ['out', 'eps'] }
    const scene: Scene = {
      ...floor(1, 1),
      nodePlacements: [
        { nodeId: 'a', position: { x: 0, y: 0 } },
        { nodeId: 'out', position: { x: 0, y: 60 } },
        { nodeId: 'eps', position: { x: 40, y: 60 } },
        { nodeId: 'b', position: { x: 0, y: 40 } },
      ],
      wires: [{ linkId: 'wire', bends: [{ id: 'bd', x: 0, y: 30, afterIndex: -1 }] }],
    }
    // a → bend (30px) → outlet (30px) → eps (40px): one segment; b alone follows the eps.
    expect(cableSegmentLengths(routed, [scene], terminations)).toEqual([
      { fromId: 'a', toId: 'eps', meters: 10 },
    ])
    expect(cableLengthMeters(link, [{ ...scene, calibration: undefined }])).toBeNull()
  })
})
