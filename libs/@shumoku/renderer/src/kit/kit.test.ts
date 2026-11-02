// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { DeviceType, type Link, type Node } from '@shumoku/core'
import { describe, expect, it } from 'vitest'
import { polylineMiddle, polylinePath, roundedPolygonPath, vlanStroke } from './geometry'
import { captionSize, createKit, groupInsets, nodeSize, portLabelSize, portSlot } from './measure'
import type { Scene } from './scene'
import { renderScene } from './static'
import { type Base, resolveTokens } from './tokens'
import { dashOf } from './wire-look'

const nodes: Record<string, Node> = {
  plain: { id: 'plain', label: 'sw' },
  long: { id: 'long', label: 'a-rather-long-device-name-01' },
  icon: { id: 'icon', label: 'Router', spec: { kind: 'hardware', type: DeviceType.Router } },
  multi: { id: 'multi', label: ['Core', '<b>secondary</b>', 'third'] },
  badge: { id: 'badge', label: 'guest', spec: { kind: 'compute' } },
  rows: {
    id: 'rows',
    label: 'Edge',
    spec: { kind: 'hardware', type: DeviceType.Router },
    annotations: [
      { kind: 'identity', label: 'AS', value: 'AS65001' },
      { kind: 'address', label: 'VIP', value: '10.0.0.1' },
      { kind: 'note', label: 'Description', value: 'Full router description' },
      { kind: 'relation', label: 'Peer', value: 'upstream' },
      { kind: 'note', label: 'Extra', value: 'hidden one' },
      { kind: 'note', label: 'Extra2', value: 'hidden two' },
    ],
  },
  circle: { id: 'circle', label: 'cloud', shape: 'circle' },
  diamond: { id: 'diamond', label: 'decision', shape: 'diamond' },
}

const linked: Link = {
  id: 'l',
  from: { node: 'a', port: '' },
  to: { node: 'b', port: '' },
  label: 'uplink',
}

/** Every measure the kit offers, for a base. */
function measures(base?: Partial<Base>) {
  const kit = createKit(base)
  return {
    nodes: Object.values(nodes).map((node) => nodeSize(node, kit)),
    port: portLabelSize('Gi1/0/24', kit),
    slot: portSlot(10 * kit.tokens.em, kit.tokens),
    insets: groupInsets({ id: 'g', label: 'G' }, kit.tokens),
    caption: captionSize(linked, kit),
  }
}

/** Paths of the leaves that differ between two token trees. */
function changedPaths(a: unknown, b: unknown, prefix = ''): string[] {
  if (typeof a === 'object' && a !== null && typeof b === 'object' && b !== null) {
    return Object.keys(a).flatMap((key) =>
      changedPaths(
        (a as Record<string, unknown>)[key],
        (b as Record<string, unknown>)[key],
        prefix ? `${prefix}.${key}` : key,
      ),
    )
  }
  return JSON.stringify(a) === JSON.stringify(b) ? [] : [prefix]
}

/** A copy of a measure result with every number multiplied. */
function scaled<T>(value: T, factor: number): T {
  return JSON.parse(JSON.stringify(value), (_key, v) =>
    typeof v === 'number' ? v * factor : v,
  ) as T
}

/** Numbers rounded so float noise does not decide a comparison. */
function rounded<T>(value: T): unknown {
  return JSON.parse(JSON.stringify(value), (_key, v) =>
    typeof v === 'number' ? Math.round(v * 1e6) / 1e6 : v,
  )
}

describe('base quantities', () => {
  it('scales every measure linearly with em', () => {
    expect(rounded(measures({ em: 22 }))).toEqual(rounded(scaled(measures({ em: 11 }), 2)))
  })

  it('scales every non-line token with em', () => {
    const one = resolveTokens({ em: 11 })
    const two = resolveTokens({ em: 22 })
    for (const changed of changedPaths(one, two)) expect(changed).not.toMatch(/^(line|stroke)/)
    expect(two.card.padding).toBeCloseTo(one.card.padding * 2)
    expect(two.text.nodeTitle.fontSize).toBeCloseTo(one.text.nodeTitle.fontSize * 2)
    expect(two.line).toEqual(one.line)
  })

  it('changes only line widths when stroke changes', () => {
    const one = resolveTokens({ stroke: 1 })
    const two = resolveTokens({ stroke: 2 })
    const changed = changedPaths(one, two)
    expect(changed.length).toBeGreaterThan(0)
    for (const key of changed) expect(key).toMatch(/^(line|stroke|shadow|wire.d)/)
    expect(two.line.bold).toBeCloseTo(one.line.bold * 2)
    expect(measures({ stroke: 2 })).toEqual(measures({ stroke: 1 }))
  })
})

describe('measures', () => {
  it('is deterministic', () => {
    for (const node of Object.values(nodes)) {
      expect(nodeSize(node, createKit())).toEqual(nodeSize(node, createKit()))
    }
  })

  it('measures wide characters wider', () => {
    const { text } = createKit()
    const ascii = text.width('abcd', 'nodeTitle')
    expect(text.width('ルータ機', 'nodeTitle')).toBeGreaterThan(ascii)
    expect(text.width('abcd', 'nodeTitle')).toBe(ascii)
  })

  it('floors short labels and grows with content', () => {
    const kit = createKit()
    const { minWidth, minHeight } = kit.tokens.card
    expect(nodeSize(nodes['plain'] as Node, kit)).toEqual({ width: minWidth, height: minHeight })
    expect(nodeSize(nodes['long'] as Node, kit).width).toBeGreaterThan(minWidth)
    expect(nodeSize(nodes['rows'] as Node, kit).height).toBeGreaterThan(minHeight)
  })

  it('sizes a port label and floors the slot', () => {
    const kit = createKit()
    expect(portLabelSize('', kit)).toBeUndefined()
    const box = portLabelSize('Gi1/0/24', kit)
    expect(box?.height).toBe(kit.tokens.port.labelHeight)
    expect(box?.width).toBeCloseTo(
      kit.text.width('Gi1/0/24', 'portLabel') + kit.tokens.port.labelPadding,
    )
    expect(portSlot(0, kit.tokens)).toBe(kit.tokens.port.minSlot)
    expect(portSlot(1000, kit.tokens)).toBe(1000 + kit.tokens.port.labelGap)
  })

  it('keeps a band for the label above a group', () => {
    const { tokens } = createKit()
    const insets = groupInsets({ id: 'g', label: 'G' }, tokens)
    expect(insets.top).toBe(tokens.group.labelBand)
    expect(insets.left).toBe(tokens.group.padding)
    expect(groupInsets({ id: 'g', label: 'G', style: { padding: 8 } }, tokens).left).toBe(8)
  })
})

describe('no hardcoded sizes', () => {
  const dir = path.dirname(fileURLToPath(import.meta.url))
  const files = readdirSync(dir).filter((name) => name.endsWith('.svelte'))

  /** A bare number, not part of a word, colour, percentage or decimal. */
  const NUMBER = /(?<![\w#.%/-])-?\d+(?:\.\d+)?(?![\w%])/g
  /** Not sizes: opacity or multiplier, a half (`/ 2`). */
  const STRUCTURAL = new Set(['0', '1', '2'])
  const ATTRIBUTE =
    /\b(font-size|stroke-width|stroke-dasharray|letter-spacing|rx|ry|r|x|y|cx|cy|x1|y1|x2|y2|width|height|dx|dy|stdDeviation)="-?\d*\.?\d+"/g

  it('finds the components', () => {
    expect(files.length).toBeGreaterThan(5)
  })

  it.each(files)('%s carries no numeric size attribute', (name) => {
    const source = readFileSync(path.join(dir, name), 'utf8')
    const hits = [...source.matchAll(ATTRIBUTE)].map((m) => m[0]).filter((a) => !/="0"$/.test(a))
    expect(hits).toEqual([])
  })

  it.each(files)('%s names no length in its script or expressions', (name) => {
    const source = readFileSync(path.join(dir, name), 'utf8')
      .replace(/viewBox="[^"]*"/g, '') // the icon's own coordinate system, not a size
      .replace(/\/\*[\s\S]*?\*\//g, '')
    const literals = (source.match(NUMBER) ?? []).filter((n) => !STRUCTURAL.has(n))
    expect(literals).toEqual([])
  })
})

describe('polylineMiddle', () => {
  it('is half the length from either end, wherever the vertices are', () => {
    // an L with a short 45° straight at its corner: the middle stays on the longer leg
    const pts = [
      { x: 0, y: 0 },
      { x: 0, y: 290 },
      { x: 10, y: 300 },
      { x: 100, y: 300 },
    ]
    const at = polylineMiddle(pts)
    const total = 290 + Math.SQRT2 * 10 + 90
    expect(at?.x).toBe(0)
    expect(at?.y).toBeCloseTo(total / 2)
    expect(polylineMiddle([{ x: 3, y: 4 }])).toEqual({ x: 3, y: 4 })
    expect(polylineMiddle([])).toBeUndefined()
  })
})

describe('roundedPolygonPath', () => {
  const box = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 60 },
    { x: 0, y: 60 },
  ]
  const arcs = (d: string) =>
    [...d.matchAll(/A ([^ ]+) [^ ]+ 0 0 ([01])/g)].map((m) => [m[1], m[2]])

  it('rounds the four corners of a rectangle clockwise', () => {
    const d = roundedPolygonPath(box, 10)
    expect(d.startsWith('M 10 0')).toBe(true)
    expect(d.endsWith('Z')).toBe(true)
    expect(arcs(d)).toEqual([
      ['10', '1'],
      ['10', '1'],
      ['10', '1'],
      ['10', '1'],
    ])
  })

  it('turns the other way at a corner that points into the shape', () => {
    const l = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 40 },
      { x: 50, y: 40 },
      { x: 50, y: 100 },
      { x: 0, y: 100 },
    ]
    expect(arcs(roundedPolygonPath(l, 10)).map((a) => a[1])).toEqual(['1', '1', '0', '1', '1', '1'])
  })

  it('takes no more of an edge than half of it, and skips repeated and collinear points', () => {
    const tight = roundedPolygonPath(box, 1000)
    expect(arcs(tight).map((a) => a[0])).toEqual(['30', '30', '30', '30'])
    const padded = [box[0], box[0], { x: 50, y: 0 }, ...box.slice(1)].filter(Boolean) as {
      x: number
      y: number
    }[]
    expect(roundedPolygonPath(padded, 10)).toBe(roundedPolygonPath(box, 10))
    expect(roundedPolygonPath(box.slice(0, 2), 10)).toBe('')
  })
})

describe('renderScene', () => {
  const a: Node = { id: 'a', label: 'Alpha' }
  const b: Node = { id: 'b', label: 'Beta' }
  const physical: Link = { id: 'phys', from: { node: 'a', port: '' }, to: { node: 'b', port: '' } }
  const virtual: Link = {
    id: 'virt',
    from: { node: 'a', port: '' },
    to: { node: 'b', port: '' },
    type: 'dashed',
  }
  const scene: Scene = {
    nodes: [
      { node: a, box: { x: 100, y: 100, width: 80, height: 60 } },
      { node: b, box: { x: 300, y: 100, width: 80, height: 60 } },
    ],
    groups: [
      { group: { id: 'g1', label: 'Rack' }, box: { x: 60, y: 50, width: 360, height: 160 } },
    ],
    wires: [
      {
        link: { ...physical, label: 'uplink' },
        points: [
          { x: 180, y: 130 },
          { x: 300, y: 130 },
        ],
        radii: [0, 0],
        stroke: 2,
      },
      {
        link: virtual,
        points: [
          { x: 140, y: 160 },
          { x: 140, y: 190 },
          { x: 340, y: 190 },
          { x: 340, y: 160 },
        ],
        radii: [0, 4, 4, 0],
        stroke: 2,
      },
    ],
    ports: [{ id: 'a:1', nodeId: 'a', label: 'Gi1', at: { x: 180, y: 130 }, side: 'right' }],
    hulls: [{ members: ['a', 'b'], kind: 'ha' }],
    bounds: { x: 60, y: 50, width: 360, height: 160 },
  }
  const tokens = resolveTokens()
  const svg = renderScene(scene)
  const count = (needle: string) => svg.split(needle).length - 1

  it('draws every part once', () => {
    expect(count('data-id="a"')).toBe(1)
    expect(count('data-id="b"')).toBe(1)
    expect(count('data-id="g1"')).toBe(1)
    expect(count('data-link-id="phys"')).toBe(2) // wire + caption
    expect(count('data-link-id="virt"')).toBe(1)
    expect(count('data-port="a:1"')).toBe(1)
    expect(count('class="ha-hull"')).toBe(1)
    expect(svg).toContain('>HA<')
  })

  it('places parts at the given coordinates', () => {
    expect(svg).toContain('x="100" y="100" width="80" height="60"')
    expect(svg).toContain('M 180 130 L 300 130')
  })

  it('draws a wire as wide as its stroke', () => {
    const drawn = (link: Link, stroke: number): string => {
      const out = renderScene({
        ...scene,
        wires: [{ link, points: scene.wires[0]?.points ?? [], radii: [0, 0], stroke }],
      })
      return out.slice(out.indexOf('data-link-id="phys"'), out.indexOf('data-link-id="phys"') + 600)
    }
    const widths = (svg: string) => [...svg.matchAll(/stroke-width="([\d.]+)"/g)].map((m) => m[1])
    expect(widths(drawn(physical, 4.4)).slice(0, 1)).toEqual(['4.4'])
  })

  it('rounds each vertex with its own radius, an arc tangent to both straights', () => {
    const corner = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
    ]
    expect(polylinePath(corner, [0, 0, 0])).toBe('M 0 0 L 100 0 L 100 100')
    expect(polylinePath(corner, [0, 10, 0])).toMatch(
      /^M 0 0 L 90 0 A 10 10 0 0 1 100 (10|9\.99\d*) L 100 100$/,
    )
    // a 135° vertex takes r·tan(22.5°) off each straight
    const chamfer = polylinePath(
      [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 150, y: 50 },
      ],
      [0, 10, 0],
    )
    expect(chamfer).toMatch(/^M 0 0 L 95\.85\d* 0 A 10 10 0 0 1 /)
  })

  it('colours a wire by what the user wrote, else by its VLAN, else by the theme', () => {
    const colourOf = (link: Link): string | undefined => {
      const out = renderScene({
        ...scene,
        wires: [{ link, points: scene.wires[0]?.points ?? [], radii: [0, 0], stroke: 2 }],
      })
      const from = out.indexOf('data-link-id="phys"')
      return /stroke="([^"]+)"/.exec(out.slice(from))?.[1]
    }
    const vlan = [10]
    expect(colourOf({ ...physical, vlan, style: { stroke: '#123456' } })).toBe('#123456')
    expect(colourOf({ ...physical, vlan })).toBe(vlanStroke(vlan))
    expect(colourOf(physical)).not.toBe(vlanStroke(vlan))
  })

  it('draws a group as its box', () => {
    const r = tokens.group.cornerRadius
    expect(svg).toContain(`d="M ${60 + r} 50 L ${420 - r} 50 A ${r} ${r} 0 0 1 420 ${50 + r}`)
    expect(svg).toContain(`x="${60 + tokens.group.labelX}"`)
  })

  it('draws a virtual link dashed and a physical one solid', () => {
    const dash = dashOf(tokens.wire.dashed, 2).join(' ')
    expect(dash).not.toBe('')
    const virt = svg.slice(svg.indexOf('data-link-id="virt"'))
    expect(virt.slice(0, virt.indexOf('</g>'))).toContain(`stroke-dasharray="${dash}"`)
    const phys = svg.slice(svg.indexOf('data-link-id="phys"'))
    expect(phys.slice(0, phys.indexOf('</g>'))).not.toContain('stroke-dasharray')
  })

  it('scales the drawing with em but not the given coordinates', () => {
    const big = renderScene(scene, { base: { em: tokens.em * 2 } })
    expect(big).toContain('x="100" y="100" width="80" height="60"')
    expect(big).toContain(`font-size: ${tokens.text.nodeTitle.fontSize * 2}px`)
    expect(big).toContain(`stroke-width="${tokens.line.bold}"`)
  })
})
