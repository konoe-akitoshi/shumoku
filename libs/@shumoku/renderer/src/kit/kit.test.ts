// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { createEngine, DeviceType, type Link, type Node } from '@shumoku/core'
import { describe, expect, it } from 'vitest'
import { estimateText, groupInsets, nodeSize, portLabelSize, portSlot } from './measure'
import type { Scene } from './scene'
import { renderScene } from './static'

// The engine measures with the same numbers, so any difference is a rule that did not move.
const engine = createEngine({
  textMeasurer: {
    measure: (text, kind) =>
      estimateText.width(
        text,
        kind === 'body' ? 'nodeTitle' : kind === 'port' ? 'portLabel' : 'nodeText',
      ),
  },
})

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

describe('nodeSize', () => {
  it.each(Object.entries(nodes))('matches the layout engine for %s', (_name, node) => {
    expect(nodeSize(node, estimateText)).toEqual(engine.nodeBodySize(node))
  })

  it('floors short labels and grows with the icon lane', () => {
    expect(nodeSize(nodes['plain'] as Node, estimateText)).toEqual({ width: 80, height: 60 })
    const withIcon = nodeSize(nodes['icon'] as Node, estimateText)
    expect(withIcon.height).toBeGreaterThanOrEqual(60)
  })

  it('is deterministic and measures wide characters wider', () => {
    const ascii = estimateText.width('abcd', 'nodeTitle')
    const wide = estimateText.width('ルータ機', 'nodeTitle')
    expect(wide).toBeGreaterThan(ascii)
    expect(estimateText.width('abcd', 'nodeTitle')).toBe(ascii)
  })
})

describe('port and group measures', () => {
  it('sizes a label and floors the slot', () => {
    expect(portLabelSize('', estimateText)).toBeUndefined()
    const box = portLabelSize('Gi1/0/24', estimateText)
    expect(box?.height).toBe(12)
    expect(box?.width).toBeCloseTo(8 * 5.6 + 4)
    expect(portSlot(10)).toBe(40)
    expect(portSlot(100)).toBe(112)
  })

  it('keeps a band for the label above a group', () => {
    expect(groupInsets({ id: 'g', label: 'G' })).toEqual({
      top: 28,
      right: 20,
      bottom: 20,
      left: 20,
    })
    expect(groupInsets({ id: 'g', label: 'G', style: { padding: 8 } }).left).toBe(8)
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
      },
      {
        link: virtual,
        points: [
          { x: 140, y: 160 },
          { x: 140, y: 190 },
          { x: 340, y: 190 },
          { x: 340, y: 160 },
        ],
      },
    ],
    ports: [{ id: 'a:1', nodeId: 'a', label: 'Gi1', at: { x: 180, y: 130 }, side: 'right' }],
    hulls: [{ members: ['a', 'b'], kind: 'ha' }],
    bounds: { x: 60, y: 50, width: 360, height: 160 },
  }
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
    expect(svg).toContain('x="60" y="50" width="360" height="160"')
    expect(svg).toContain('M 180 130 L 300 130')
  })

  it('draws a virtual link dashed and a physical one solid', () => {
    const virt = svg.slice(svg.indexOf('data-link-id="virt"'))
    expect(virt.slice(0, virt.indexOf('</g>'))).toContain('stroke-dasharray="5 3"')
    const phys = svg.slice(svg.indexOf('data-link-id="phys"'))
    expect(phys.slice(0, phys.indexOf('</g>'))).not.toContain('stroke-dasharray')
  })
})
