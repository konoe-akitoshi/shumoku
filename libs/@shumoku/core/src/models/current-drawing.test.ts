// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { describe, expect, it } from 'vitest'
import { currentDrawing, type DrawingLayer } from './network-model.js'

describe('currentDrawing', () => {
  it('keeps what the drawing holds today', () => {
    const drawing: DrawingLayer = {
      nodes: { a: { icon: '<svg/>' } },
      links: { l: { label: 'uplink', type: 'dashed' } },
      groups: { g: { spec: { kind: 'service', vendor: 'aws' }, style: { padding: 12 } } },
      settings: { theme: 'dark' },
      order: { '': ['b', 'a'] },
    }
    expect(currentDrawing(drawing)).toEqual(drawing)
  })

  it('drops the shapes, colours, edges and coordinates an older store kept, and what that empties', () => {
    const stored = JSON.parse(
      JSON.stringify({
        nodes: {
          a: { shape: 'cylinder', style: { fill: '#123456' }, position: { x: 1, y: 2 } },
          b: { shape: 'circle', icon: '<svg/>' },
        },
        links: { l: { style: { stroke: '#234567', minLength: 300 } }, m: { label: 'trunk' } },
        groups: {
          g: { style: { fill: 'accent-blue', stroke: '#101010' }, direction: 'LR' },
          h: { style: { fill: 'accent-red', padding: 8 } },
        },
        order: {},
      }),
    ) as DrawingLayer
    expect(currentDrawing(stored)).toEqual({
      nodes: { b: { icon: '<svg/>' } },
      links: { m: { label: 'trunk' } },
      groups: { h: { style: { padding: 8 } } },
    })
  })

  it('has nothing for a drawing left with nothing', () => {
    const stored = JSON.parse(JSON.stringify({ nodes: { a: { shape: 'rect' } } })) as DrawingLayer
    expect(currentDrawing(stored)).toBeUndefined()
    expect(currentDrawing(undefined)).toBeUndefined()
  })
})
