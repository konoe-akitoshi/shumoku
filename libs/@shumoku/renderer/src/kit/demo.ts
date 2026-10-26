// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * A hand-placed scene, drawn with the kit and written out as SVG and PNG.
 *
 *   bun src/kit/demo.ts [outDir]
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { DeviceType, type Link, type Node } from '@shumoku/core'
import { estimateText, groupInsets, nodeSize } from './measure'
import type { Box, Point, Scene } from './scene'

declare const Bun: { plugin(p: unknown): void; file(path: string): { text(): Promise<string> } }

// Bun does not compile .svelte on its own; do it for the server build before loading the kit.
Bun.plugin({
  name: 'svelte-server',
  setup(build: {
    onLoad(o: { filter: RegExp }, f: (a: { path: string }) => Promise<unknown>): void
  }) {
    build.onLoad({ filter: /\.svelte$/ }, async ({ path: file }) => {
      const { compile } = await import('svelte/compiler')
      const source = await Bun.file(file).text()
      const { js } = compile(source, { generate: 'server', filename: file })
      return { contents: js.code, loader: 'js' }
    })
  },
})
const { renderScene } = await import('./static')

const outDir =
  process.argv[2] ??
  'C:\\Users\\akitoshi\\AppData\\Local\\Temp\\claude\\C--Users-akitoshi-Documents-GitHub-shumoku\\168c38d6-0434-4032-b83c-44e2fabc8b88\\scratchpad\\kit'

const router = { kind: 'hardware', type: DeviceType.Router } as const
const sw = { kind: 'hardware', type: DeviceType.L3Switch } as const

const defs: Node[] = [
  {
    id: 'edge',
    label: ['edge-rt', 'Edge router'],
    spec: router,
    annotations: [{ kind: 'address', label: 'Mgmt', value: '10.0.0.1' }],
  },
  { id: 'core-a', label: 'core-a', spec: sw },
  { id: 'core-b', label: 'core-b', spec: sw },
  { id: 'sw1', label: 'access-sw1' },
  { id: 'sw2', label: 'access-sw2' },
  { id: 'vm', label: 'web-01', spec: { kind: 'compute' } },
]

// The kit measures; the position is ours: a column per tier, centred on its x.
function place(node: Node, centre: Point): { node: Node; box: Box } {
  const size = nodeSize(node, estimateText)
  return {
    node,
    box: { x: centre.x - size.width / 2, y: centre.y - size.height / 2, ...size },
  }
}

const placed = [
  place(defs[0] as Node, { x: 300, y: 110 }),
  place(defs[1] as Node, { x: 170, y: 290 }),
  place(defs[2] as Node, { x: 430, y: 290 }),
  place(defs[3] as Node, { x: 170, y: 470 }),
  place(defs[4] as Node, { x: 430, y: 470 }),
  place(defs[5] as Node, { x: 720, y: 470 }),
]
const at = (id: string): Box => {
  const found = placed.find((p) => p.node.id === id)
  if (!found) throw new Error(`no node ${id}`)
  return found.box
}
const bottom = (id: string, dx = 0): Point => {
  const b = at(id)
  return { x: b.x + b.width / 2 + dx, y: b.y + b.height }
}
const top = (id: string, dx = 0): Point => {
  const b = at(id)
  return { x: b.x + b.width / 2 + dx, y: b.y }
}
const side = (id: string, which: 'left' | 'right'): Point => {
  const b = at(id)
  return { x: which === 'left' ? b.x : b.x + b.width, y: b.y + b.height / 2 }
}

// A group frame around some boxes, using the kit's insets.
function frame(id: string, label: string, members: Box[]): Scene['groups'][number] {
  const group = { id, label }
  const inset = groupInsets(group)
  const x = Math.min(...members.map((m) => m.x)) - inset.left
  const y = Math.min(...members.map((m) => m.y)) - inset.top
  const right = Math.max(...members.map((m) => m.x + m.width)) + inset.right
  const lower = Math.max(...members.map((m) => m.y + m.height)) + inset.bottom
  return { group, box: { x, y, width: right - x, height: lower - y } }
}

const link = (id: string, from: string, to: string, extra: Partial<Link> = {}): Link => ({
  id,
  from: { node: from, port: '' },
  to: { node: to, port: '' },
  ...extra,
})

const midY = 200
const scene: Scene = {
  nodes: placed,
  groups: [
    frame('dc', 'Datacenter', [at('edge'), at('core-a'), at('core-b'), at('sw1'), at('sw2')]),
    frame('rack', 'Rack 2', [at('sw1'), at('sw2')]),
  ],
  hulls: [{ members: ['core-a', 'core-b'], kind: 'vpc' }],
  wires: [
    {
      link: link('e-a', 'edge', 'core-a', { label: '10G uplink', vlan: [10] }),
      points: [
        bottom('edge', -40),
        { x: bottom('edge', -40).x, y: midY },
        { x: 170, y: midY },
        top('core-a'),
      ],
    },
    {
      link: link('e-b', 'edge', 'core-b', { vlan: [20] }),
      points: [
        bottom('edge', 40),
        { x: bottom('edge', 40).x, y: midY },
        { x: 430, y: midY },
        top('core-b'),
      ],
    },
    {
      link: link('a-b', 'core-a', 'core-b', { redundancy: 'vpc', label: 'peer-link' }),
      points: [side('core-a', 'right'), side('core-b', 'left')],
    },
    { link: link('a-1', 'core-a', 'sw1'), points: [bottom('core-a'), top('sw1')] },
    { link: link('b-2', 'core-b', 'sw2'), points: [bottom('core-b'), top('sw2')] },
    {
      link: link('virt', 'core-b', 'vm', { type: 'dashed', label: 'overlay' }),
      points: [side('core-b', 'right'), { x: 720, y: 290 }, top('vm')],
      captionAt: { x: 650, y: 360 },
    },
  ],
  ports: [
    { id: 'edge:1', nodeId: 'edge', label: 'Te0/1', at: bottom('edge', -40), side: 'bottom' },
    { id: 'edge:2', nodeId: 'edge', label: 'Te0/2', at: bottom('edge', 40), side: 'bottom' },
    { id: 'a:1', nodeId: 'core-a', label: 'Eth1/1', at: bottom('core-a'), side: 'bottom' },
    {
      id: 'a:peer',
      nodeId: 'core-a',
      label: 'Eth1/48',
      at: side('core-a', 'right'),
      side: 'right',
    },
  ],
  bounds: { x: 60, y: 10, width: 760, height: 520 },
}

mkdirSync(outDir, { recursive: true })
const svg = renderScene(scene)
writeFileSync(path.join(outDir, 'demo.svg'), svg)

// resvg lives with the PNG renderer, not with this package.
const { Resvg } = await import('../../../renderer-png/node_modules/@resvg/resvg-js/index.js')
const png = new Resvg(svg, { fitTo: { mode: 'width', value: 1600 } }).render().asPng()
writeFileSync(path.join(outDir, 'demo.png'), png)
console.log(`wrote ${path.join(outDir, 'demo.png')}`)
