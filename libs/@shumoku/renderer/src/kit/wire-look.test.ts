// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { readFileSync } from 'node:fs'
import { drawingArcs, type Link, lightTheme } from '@shumoku/core'
import { describe, expect, it } from 'vitest'
import { kitColors } from './colors'
import { resolveTokens } from './tokens'
import { polylinePath, vlanColors, vlanKey, wireLook } from './wire-look'

const tokens = resolveTokens()
const colors = kitColors()
const palette = lightTheme.colors.vlans
const link = (extra: Partial<Link> = {}): Link => ({
  id: 'l',
  from: { node: 'a', port: 'p' },
  to: { node: 'b', port: 'q' },
  ...extra,
})
const points = [
  { x: 0, y: 0 },
  { x: 100, y: 0 },
  { x: 100, y: 100 },
]
const look = (l: Link, stroke = tokens.stroke, vlans = new Map<string, string>()) =>
  wireLook({ link: l, points, radii: [0, 10, 0], stroke, vlans }, tokens, colors)

describe('wireLook', () => {
  it('takes the stroke the scene gave', () => {
    expect(look(link(), 4.4).stroke).toBe(4.4)
  })

  it('draws a plain link solid', () => {
    expect(look(link()).dash).toBeUndefined()
  })

  it('has dashes equal to the em lengths at the base stroke, and a dot is a cap of no length', () => {
    expect(look(link({ type: 'dashed' })).dash).toEqual([tokens.em / 2, tokens.em / 4])
    expect(look(link({ type: 'dotted' })).dash).toEqual([0, 0.6 * tokens.em])
  })

  it('scales dashes with the line own stroke', () => {
    for (const type of ['dashed', 'dotted'] as const) {
      const thin = look(link({ type }), tokens.stroke).dash ?? []
      const thick = look(link({ type }), tokens.stroke * 3).dash ?? []
      expect(thick).toEqual(thin.map((d) => d * 3))
    }
  })

  it('takes the colour from what the user wrote, else the VLAN, else the theme', () => {
    const vlan = [10]
    const vlans = new Map([[vlanKey(vlan), '#abcdef']])
    expect(look(link({ vlan, style: { stroke: '#123456' } }), 1, vlans).color).toBe('#123456')
    expect(look(link({ vlan }), 1, vlans).color).toBe('#abcdef')
    expect(look(link()).color).toBe(colors.link)
  })

  it('keeps a dash the user wrote on a link whose type names none', () => {
    expect(look(link({ style: { strokeDasharray: '4 2' } })).dash).toEqual([4, 2])
  })

  it('carries the path of the line', () => {
    expect(look(link()).d).toBe(polylinePath(points, [0, 10, 0]))
  })

  it('is drawn by Wire.svelte with no branch on the link type', () => {
    const src = readFileSync(new URL('./Wire.svelte', import.meta.url), 'utf8')
    expect(src).not.toMatch(/link\.type/)
  })
})

describe('polylinePath', () => {
  it('rounds each vertex with its own radius, an arc tangent to both straights', () => {
    expect(polylinePath(points, [0, 0, 0])).toBe('M 0 0 L 100 0 L 100 100')
    expect(polylinePath(points, [0, 10, 0])).toMatch(
      /^M 0 0 L 90 0 A 10 10 0 0 1 100 (10|9\.99\d*) L 100 100$/,
    )
  })

  it('writes the arcs the drawing works out, and works out none itself', () => {
    const chamfer = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 150, y: 50 },
    ]
    const arc = drawingArcs(chamfer, [0, 10, 0])[1]
    expect(arc).toBeDefined()
    // a 135° vertex takes r·tan(22.5°) off each straight
    expect(arc?.from.x).toBeCloseTo(100 - 10 * Math.tan(Math.PI / 8))
    expect(polylinePath(chamfer, [0, 10, 0])).toContain(`L ${arc?.from.x} ${arc?.from.y} A 10 10`)
  })

  it('is empty for no points and a lone move for one', () => {
    expect(polylinePath([], [])).toBe('')
    expect(polylinePath([{ x: 1, y: 2 }], [0])).toBe('M 1 2')
  })
})

describe('vlanColors', () => {
  const carries = (...sets: number[][]) => sets.map((vlan) => ({ vlan }))

  it('gives distinct VLAN sets distinct colours while the palette holds', () => {
    const sets = Array.from({ length: palette.length }, (_, i) => [10 * (i + 1), 7])
    const colours = [...vlanColors(carries(...sets), palette).values()]
    expect(new Set(colours).size).toBe(palette.length)
  })

  it('does not collide on sums: 10+20 and 15+15 are two sets', () => {
    const map = vlanColors(carries([10, 20], [15], [30]), palette)
    expect(new Set(map.values()).size).toBe(3)
  })

  it('is the same whatever order the links or the ids come in', () => {
    const a = vlanColors(carries([30], [10, 20], [20]), palette)
    const b = vlanColors(carries([20], [20, 10], [30]), palette)
    expect([...a].sort()).toEqual([...b].sort())
  })

  it('gives a link with no VLAN nothing, and wraps round a short palette', () => {
    expect(vlanColors([{}, { vlan: [] }], palette).size).toBe(0)
    const short = vlanColors(carries([1], [2], [3]), ['#111111', '#222222'])
    expect(short.get('3')).toBe('#111111')
  })
})
