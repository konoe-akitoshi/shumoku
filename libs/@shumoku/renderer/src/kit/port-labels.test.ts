// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { readNetworkModel } from '@shumoku/core'
import { describe, expect, it } from 'vitest'
import { drawNetworkScene, renderNetworkSvg } from '../static.js'
import { kitColors } from './colors.js'
import { createKit } from './measure.js'
import { portCaptionLook, portLook } from './port-look.js'

/** A switch with `n` ports named the way an H3C switch names them, each cabled to its own host. */
function switchYaml(n: number): string {
  const ports = Array.from({ length: n }, (_, i) => i + 1)
  const hosts = ports.map((i) => `  - { id: h${i} }`)
  const down = ports.map(
    (i) => `  - { endpoints: [{ node: sw, port: Ten-GigabitEthernet1/0/${i} }, { node: h${i} }] }`,
  )
  return [
    'nodes:',
    '  - { id: core }',
    '  - { id: sw }',
    ...hosts,
    'links:',
    '  - { endpoints: [{ node: core }, { node: sw }] }',
    ...down,
    '',
  ].join('\n')
}

const kit = createKit()
const colors = kitColors()

describe('a dense switch drawn by the kit', () => {
  const model = readNetworkModel(switchYaml(24))
  const scene = drawNetworkScene(model)
  const ports = (scene.ports ?? []).filter((p) => p.name?.startsWith('Ten-Gigabit'))

  it('keeps the stored name and shows the abbreviation', () => {
    expect(ports).toHaveLength(24)
    expect(ports.every((p) => p.name?.startsWith('Ten-GigabitEthernet1/0/'))).toBe(true)
    expect(ports.every((p) => !p.label?.startsWith('Ten-'))).toBe(true)
  })

  it('writes what the edge shares once, on a caption', () => {
    expect(scene.captions?.some((c) => c.text.startsWith('XGE1/0/'))).toBe(true)
  })

  it('has no two chips touching on one row of one edge', () => {
    const chips = ports.flatMap((p) => {
      const look = portLook({ at: p.at, side: p.side, label: p.label, row: p.row }, kit, colors)
      return look.label ? [{ p, box: look.label.box }] : []
    })
    for (const [i, a] of chips.entries()) {
      for (const b of chips.slice(i + 1)) {
        if (a.p.nodeId !== b.p.nodeId || a.p.side !== b.p.side || (a.p.row ?? 0) !== (b.p.row ?? 0))
          continue
        const apart =
          a.box.x + a.box.width <= b.box.x + 1e-6 ||
          b.box.x + b.box.width <= a.box.x + 1e-6 ||
          a.box.y + a.box.height <= b.box.y + 1e-6 ||
          b.box.y + b.box.height <= a.box.y + 1e-6
        expect(apart).toBe(true)
      }
    }
  })

  it('keeps the caption clear of the chips on its edge', () => {
    for (const c of scene.captions ?? []) {
      const caption = portCaptionLook(c, kit, colors)
      if (!caption) throw new Error('no caption chip')
      for (const p of ports.filter((p) => p.nodeId === c.nodeId && p.side === c.side && !p.row)) {
        const chip = portLook({ at: p.at, side: p.side, label: p.label }, kit, colors).label?.box
        if (!chip) continue
        const apart =
          caption.box.x + caption.box.width <= chip.x + 1e-6 ||
          chip.x + chip.width <= caption.box.x + 1e-6 ||
          caption.box.y + caption.box.height <= chip.y + 1e-6 ||
          chip.y + chip.height <= caption.box.y + 1e-6
        expect(apart).toBe(true)
      }
    }
  })

  it('puts the full name in the title of every port in the SVG', () => {
    const svg = renderNetworkSvg(model)
    expect(svg).toContain('<title>Ten-GigabitEthernet1/0/24</title>')
    expect(svg).not.toContain('>Ten-GigabitEthernet1/0/24</text>')
  })
})
