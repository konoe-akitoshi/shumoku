// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { readFileSync } from 'node:fs'
import type { Link } from '@shumoku/core'
import { describe, expect, it } from 'vitest'
import { themeToColors } from '../lib/render-colors'
import { vlanStroke } from './geometry'
import { resolveTokens } from './tokens'
import { wireLook } from './wire-look'

const tokens = resolveTokens()
const colors = themeToColors()
const link = (extra: Partial<Link> = {}): Link => ({
  id: 'l',
  from: { node: 'a', port: 'p' },
  to: { node: 'b', port: 'q' },
  ...extra,
})
const look = (l: Link, stroke = tokens.stroke) => wireLook({ link: l, stroke }, tokens, colors)

describe('wireLook', () => {
  it('takes the stroke the scene gave', () => {
    expect(look(link(), 4.4).stroke).toBe(4.4)
  })

  it('draws a plain link solid', () => {
    expect(look(link()).dash).toBeUndefined()
  })

  it('has dashes equal to the em lengths at the base stroke', () => {
    expect(look(link({ type: 'dashed' })).dash).toEqual([tokens.em / 2, tokens.em / 4])
    expect(look(link({ type: 'dotted' })).dash?.[0]).toBeCloseTo(0.1 * tokens.em)
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
    expect(look(link({ vlan, style: { stroke: '#123456' } })).color).toBe('#123456')
    expect(look(link({ vlan })).color).toBe(vlanStroke(vlan))
    expect(look(link()).color).toBe(colors.linkStroke)
  })

  it('keeps a dash the user wrote on a link whose type names none', () => {
    expect(look(link({ style: { strokeDasharray: '4 2' } })).dash).toEqual([4, 2])
  })

  it('is drawn by Wire.svelte with no branch on the link type', () => {
    const src = readFileSync(new URL('./Wire.svelte', import.meta.url), 'utf8')
    expect(src).not.toMatch(/link\.type/)
  })
})
