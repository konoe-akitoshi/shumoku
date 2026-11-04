// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { readFileSync } from 'node:fs'
import {
  DeviceType,
  darkTheme,
  type Link,
  lightTheme,
  type Node,
  type NodeShape,
  nodeContentScale,
} from '@shumoku/core'
import { describe, expect, it } from 'vitest'
import { captionLook } from './caption-look'
import { cardLook } from './card-look'
import { kitColors } from './colors'
import { captionContent, fit, nodeContent } from './content'
import { groupInsets, groupLook } from './group-look'
import { hullLook } from './hull-look'
import { createKit, nodeSize } from './measure'
import { NODE_SHAPES, shapeOf } from './node-shape'
import { portLook } from './port-look'
import type { Box } from './scene'

const kit = createKit()
const { tokens } = kit
const colors = kitColors()
const box: Box = { x: 100, y: 50, width: 200, height: 90 }

describe('kitColors', () => {
  it('reads every colour off the theme, and follows the theme', () => {
    expect(colors.port).toEqual(lightTheme.colors.port)
    expect(colors.hull).toBe(lightTheme.colors.hull)
    expect(colors.shadow).toBe(lightTheme.colors.shadow)
    expect(colors.lineTone).toBe(lightTheme.colors.lineTone)
    expect(kitColors(darkTheme).port.fill).toBe(darkTheme.colors.port.fill)
    expect(kitColors(darkTheme).background).not.toBe(colors.background)
  })
})

describe('shapes', () => {
  const shapes = Object.keys(NODE_SHAPES) as NodeShape[]

  it('defines an outline, a safe rectangle and a squaring for every shape', () => {
    expect(shapes).toHaveLength(8)
    for (const name of shapes) {
      const shape = shapeOf(name)
      expect(shape.outline(box, 4).length).toBeGreaterThan(0)
      expect(shape.inner.x).toBeGreaterThan(0)
      expect(shape.inner.x).toBeLessThanOrEqual(1)
    }
  })

  it('agrees with the old drawing on the safe rectangle until that is deleted', () => {
    for (const name of shapes) expect(shapeOf(name).inner).toEqual(nodeContentScale(name))
  })

  it('squares only the circle, and takes an unknown shape for a plain card', () => {
    expect(shapes.filter((s) => shapeOf(s).square)).toEqual(['circle'])
    expect(shapeOf('nonsense')).toBe(NODE_SHAPES.rounded)
    expect(shapeOf(undefined)).toBe(NODE_SHAPES.rounded)
    const circle = nodeSize({ id: 'c', label: 'x', shape: 'circle' }, kit)
    expect(circle.width).toBe(circle.height)
  })
})

describe('content', () => {
  it('cuts a text by its width, so full-width characters count for more', () => {
    const limit = tokens.limit.factKey
    expect(fit('short', 'nodeText', limit, kit)).toBe('short')
    const cut = fit('a'.repeat(40), 'nodeText', limit, kit)
    expect(cut.endsWith('…')).toBe(true)
    expect(kit.text.width(cut, 'nodeText')).toBeLessThanOrEqual(limit)
    expect(cut).toHaveLength(14) // the same 14 average characters as before, for ASCII
    expect(fit('あ'.repeat(40), 'nodeText', limit, kit).length).toBeLessThan(cut.length)
  })

  it('decides the role of each title line', () => {
    const { labels } = nodeContent({ id: 'n', label: ['Core', '<b>second</b>', 'third'] }, kit)
    expect(labels).toEqual([
      { text: 'Core', role: 'title' },
      { text: 'second', role: 'strong' },
      { text: 'third', role: 'secondary' },
    ])
  })

  it('shows the most rows the card allows and counts the rest', () => {
    const annotations = Array.from({ length: tokens.card.maxRows + 2 }, (_, i) => ({
      kind: 'note' as const,
      label: `k${i}`,
      value: `v${i}`,
    }))
    const content = nodeContent({ id: 'n', label: 'n', annotations }, kit)
    expect(content.rows).toHaveLength(tokens.card.maxRows)
    expect(content.more).toBe('+2 more')
  })

  it('keeps three short caption lines', () => {
    const link: Link = {
      id: 'l',
      from: { node: 'a', port: '' },
      to: { node: 'b', port: '' },
      label: 'uplink',
      vlan: [10],
      annotations: [{ kind: 'note', label: 'n', value: 'note' }],
    }
    expect(captionContent(link, kit)).toEqual(['uplink', 'VLAN 10', 'note'])
  })
})

describe('cardLook', () => {
  const router: Node = {
    id: 'r',
    label: ['Edge', '<b>core</b>'],
    spec: { kind: 'hardware', type: DeviceType.Router },
    annotations: [
      { kind: 'identity', label: 'AS', value: 'AS65001' },
      { kind: 'address', label: 'VIP', value: '10.0.0.1' },
    ],
  }

  it('places the header, the divider and the rows inside the box', () => {
    const look = cardLook(router, box, kit, colors)
    expect(look.icon?.size).toBe(tokens.card.iconSize)
    expect(look.labels.map((l) => l.className)).toEqual([
      'node-label',
      'node-label node-label-bold',
    ])
    expect(look.subtitle?.text).toBe('AS65001')
    expect(look.facts?.rows).toHaveLength(1)
    const ys = [
      ...look.labels.map((l) => l.y),
      look.subtitle?.y ?? 0,
      look.facts?.divider.y ?? 0,
      look.facts?.rows[0]?.key.y ?? 0,
    ]
    expect(ys).toEqual([...ys].sort((a, b) => a - b))
    for (const y of ys) {
      expect(y).toBeGreaterThan(box.y)
      expect(y).toBeLessThan(box.y + box.height)
    }
  })

  it('centres the content on the box and keeps the rows between its edges', () => {
    const look = cardLook(router, box, kit, colors)
    const cx = box.x + box.width / 2
    const divider = look.facts?.divider
    expect((divider?.x1 ?? 0) + (divider?.x2 ?? 0)).toBeCloseTo(2 * cx)
  })

  it('draws the frame in what the user wrote, else the theme, with the quiet edges named once', () => {
    const plain = cardLook({ id: 'p', label: 'p' }, box, kit, colors)
    expect(plain.frame.parts[0]?.attrs).toMatchObject({
      fill: colors.card.fill,
      stroke: colors.card.stroke,
      'stroke-width': tokens.line.base,
      rx: tokens.card.cornerRadius,
    })
    expect(plain.frame.dash).toBeUndefined()
    const styled = cardLook(
      { id: 's', label: 's', style: { fill: '#111111', strokeWidth: 3 } },
      box,
      kit,
      colors,
    )
    expect(styled.frame.parts[0]?.attrs).toMatchObject({ fill: '#111111', 'stroke-width': 3 })
    expect(cardLook(router, box, kit, colors).facts?.divider.opacity).toBe(tokens.quiet.opacity)
  })

  it('dashes an assumed card by its own rule, not the wire is', () => {
    const assumed = cardLook(
      { id: 'a', label: 'a', annotations: [{ kind: 'status', label: 's', value: 'assumed' }] },
      box,
      kit,
      colors,
    )
    const [dash, gap] = assumed.frame.dash?.split(' ').map(Number) ?? []
    expect(dash).toBeCloseTo(tokens.card.assumedDash[0] * tokens.line.base)
    expect(gap).toBeCloseTo(tokens.card.assumedDash[1] * tokens.line.base)
  })

  it('draws a cylinder as two caps and two sides behind a fill', () => {
    const { frame } = cardLook({ id: 'c', label: 'c', shape: 'cylinder' }, box, kit, colors)
    expect(frame.parts.map((p) => p.tag)).toEqual(['ellipse', 'rect', 'line', 'line', 'ellipse'])
    expect(frame.parts[1]?.attrs['stroke']).toBe('none')
  })

  it('puts the badge at the right edge of the content, on the first line', () => {
    const look = cardLook({ id: 'v', label: 'vm', spec: { kind: 'compute' } }, box, kit, colors)
    expect(look.badge?.text).toBe('VM')
    expect(look.badge?.box.height).toBe(tokens.card.badgeHeight)
    expect(look.badge?.strokeOpacity).toBe(tokens.quiet.opacity)
  })

  it('is drawn by NodeCard.svelte with no shape or role branch', () => {
    const src = readFileSync(new URL('./NodeCard.svelte', import.meta.url), 'utf8')
    expect(src).not.toMatch(/shape ===|<b>|\.test\(/)
  })
})

describe('portLook', () => {
  const at = { x: 200, y: 100 }

  it('sits the chip one offset from the port, reading away from it', () => {
    const offset = tokens.port.labelOffset
    const right = portLook({ at, side: 'right', label: 'Gi1' }, kit, colors).label
    const left = portLook({ at, side: 'left', label: 'Gi1' }, kit, colors).label
    const top = portLook({ at, side: 'top', label: 'Gi1' }, kit, colors).label
    const bottom = portLook({ at, side: 'bottom', label: 'Gi1' }, kit, colors).label
    expect(right?.text).toMatchObject({ x: at.x + offset, anchor: 'start' })
    expect(left?.text).toMatchObject({ x: at.x - offset, anchor: 'end' })
    expect(top?.text).toMatchObject({
      x: at.x,
      y: at.y - offset + tokens.text.portLabel.shift,
      anchor: 'middle',
    })
    expect(bottom?.text.y).toBeCloseTo(at.y + offset + tokens.text.portLabel.shift)
  })

  it('keeps the text inside its chip', () => {
    for (const side of ['top', 'bottom', 'left', 'right'] as const) {
      const { label } = portLook({ at, side, label: 'Gi1/0/24' }, kit, colors)
      if (!label) throw new Error('no label')
      const { box: chip, text } = label
      const width = kit.text.width(text.content, 'portLabel')
      const start =
        text.anchor === 'middle'
          ? text.x - width / 2
          : text.anchor === 'end'
            ? text.x - width
            : text.x
      expect(start).toBeGreaterThanOrEqual(chip.x - 1e-9)
      expect(start + width).toBeLessThanOrEqual(chip.x + chip.width + 1e-9)
      expect(chip.fill).toBe(colors.port.labelBackground)
      expect(text.fill).toBe(colors.port.labelText)
    }
  })

  it('draws the marker centred on the port in the theme colours, and no chip without a name', () => {
    const look = portLook({ at, side: 'right', label: '  ' }, kit, colors)
    expect(look.label).toBeUndefined()
    expect(look.marker.x + look.marker.size / 2).toBe(at.x)
    expect(look.marker.fill).toBe(colors.port.fill)
    expect(look.marker.stroke).toBe(colors.port.stroke)
  })
})

describe('captionLook', () => {
  const link: Link = {
    id: 'l',
    from: { node: 'a', port: '' },
    to: { node: 'b', port: '' },
    label: 'uplink',
    vlan: [10],
  }

  it('is a quiet chip centred on the point, its lines stacked about the centre', () => {
    const at = { x: 300, y: 200 }
    const look = captionLook(link, at, kit, colors)
    expect((look?.box.x ?? 0) + (look?.box.width ?? 0) / 2).toBeCloseTo(at.x)
    expect(look?.box.strokeOpacity).toBe(tokens.quiet.opacity)
    expect(look?.box.strokeWidth).toBe(tokens.quiet.width)
    expect(look?.box.fill).toBe(colors.card.fill)
    const [a, b] = look?.lines ?? []
    expect((b?.y ?? 0) - (a?.y ?? 0)).toBeCloseTo(tokens.caption.lineHeight)
    expect(((a?.y ?? 0) + (b?.y ?? 0)) / 2 - tokens.text.linkCaption.shift).toBeCloseTo(at.y)
  })

  it('has nothing for a link with nothing to say', () => {
    expect(
      captionLook({ ...link, label: undefined, vlan: undefined }, { x: 0, y: 0 }, kit, colors),
    ).toBeUndefined()
  })
})

describe('groupLook', () => {
  const group = { id: 'g', label: 'Rack' }

  it('takes the default surface, a named surface, or what the user wrote', () => {
    expect(groupLook(group, box, tokens, colors).frame).toMatchObject({
      fill: colors.group.fill,
      stroke: colors.group.stroke,
    })
    const blue = groupLook({ ...group, style: { fill: 'accent-blue' } }, box, tokens, colors)
    expect(blue.frame.fill).toBe(lightTheme.colors.surfaces['accent-blue'].fill)
    expect(blue.heading.fill).toBe(lightTheme.colors.surfaces['accent-blue'].text)
    const written = groupLook(
      { ...group, style: { fill: '#fafafa', stroke: '#101010', strokeDasharray: '4 2' } },
      box,
      tokens,
      colors,
    )
    expect(written.frame).toMatchObject({ fill: '#fafafa', stroke: '#101010', dash: '4 2' })
    expect(written.heading.fill).toBe(colors.group.text)
  })

  it('knows every surface the theme has, from the theme, not from a list', () => {
    for (const name of Object.keys(lightTheme.colors.surfaces)) {
      const look = groupLook({ ...group, style: { fill: name } }, box, tokens, colors)
      expect(look.frame.fill).toBe(
        lightTheme.colors.surfaces[name as keyof typeof lightTheme.colors.surfaces].fill,
      )
    }
  })

  it('sets the heading in a band as tall as its line and the air round it', () => {
    const line = tokens.text.groupLabel.fontSize * 1.5
    expect(tokens.group.labelBand).toBeGreaterThan(line)
    expect(tokens.group.labelBand - line).toBeCloseTo(2 * tokens.em * 0.5)
    const look = groupLook(group, box, tokens, colors)
    expect(look.heading.y).toBeCloseTo(
      box.y + tokens.group.labelBand / 2 + tokens.text.groupLabel.shift,
    )
    expect(groupInsets(group, tokens).top).toBe(tokens.group.labelBand)
  })
})

describe('hullLook', () => {
  const boxes: Box[] = [
    { x: 100, y: 100, width: 80, height: 60 },
    { x: 300, y: 100, width: 80, height: 60 },
  ]

  it('fills with the theme hull colour and writes the kind above the corner', () => {
    const look = hullLook({ boxes, seams: [130], kind: 'ha' }, tokens, colors)
    expect(look?.fill).toBe(lightTheme.colors.hull)
    expect(hullLook({ boxes, seams: [130] }, tokens, kitColors(darkTheme))?.fill).toBe(
      darkTheme.colors.hull,
    )
    expect(look?.label?.text).toBe('HA')
    expect(look?.label?.fill).toBe(colors.textSecondary)
    expect(hullLook({ boxes, seams: [130] }, tokens, colors)?.label).toBeUndefined()
  })

  it('has no outline for no members', () => {
    expect(hullLook({ boxes: [], seams: [] }, tokens, colors)).toBeUndefined()
  })
})
