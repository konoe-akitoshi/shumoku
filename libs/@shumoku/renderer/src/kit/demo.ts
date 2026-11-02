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
import { createKit, groupInsets, type Kit, nodeSize } from './measure'
import type { Box, Point, Scene } from './scene'
import { lineWidths } from './wire-width'

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
const { DEFAULT_BASE } = await import('./tokens')

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

const link = (id: string, from: string, to: string, extra: Partial<Link> = {}): Link => ({
  id,
  from: { node: from, port: '' },
  to: { node: to, port: '' },
  ...extra,
})

/**
 * The same hand-placed scene for any base. The kit measures; the position is ours, and it is
 * given in em, so that doubling the em doubles the whole drawing, gaps included.
 */
function buildScene(kit: Kit): Scene {
  const { em } = kit.tokens
  const point = (x: number, y: number): Point => ({ x: x * em, y: y * em })

  // A column per tier, centred on its x.
  function place(node: Node, centre: Point): { node: Node; box: Box } {
    const size = nodeSize(node, kit)
    return {
      node,
      box: { x: centre.x - size.width / 2, y: centre.y - size.height / 2, ...size },
    }
  }
  const placed = [
    place(defs[0] as Node, point(29, 10)),
    place(defs[1] as Node, point(15, 26)),
    place(defs[2] as Node, point(43, 26)),
    place(defs[3] as Node, point(15, 43)),
    place(defs[4] as Node, point(43, 43)),
    place(defs[5] as Node, point(69, 43)),
  ]
  const at = (id: string): Box => {
    const found = placed.find((p) => p.node.id === id)
    if (!found) throw new Error(`no node ${id}`)
    return found.box
  }
  const bottom = (id: string, dx = 0): Point => {
    const b = at(id)
    return { x: b.x + b.width / 2 + dx * em, y: b.y + b.height }
  }
  const top = (id: string, dx = 0): Point => {
    const b = at(id)
    return { x: b.x + b.width / 2 + dx * em, y: b.y }
  }
  const side = (id: string, which: 'left' | 'right'): Point => {
    const b = at(id)
    return { x: which === 'left' ? b.x : b.x + b.width, y: b.y + b.height / 2 }
  }

  // A group frame around some boxes, using the kit's insets.
  function frame(id: string, label: string, members: Box[]): Scene['groups'][number] {
    const group = { id, label }
    const inset = groupInsets(group, kit.tokens)
    const x = Math.min(...members.map((m) => m.x)) - inset.left
    const y = Math.min(...members.map((m) => m.y)) - inset.top
    const right = Math.max(...members.map((m) => m.x + m.width)) + inset.right
    const lower = Math.max(...members.map((m) => m.y + m.height)) + inset.bottom
    return { group, box: { x, y, width: right - x, height: lower - y } }
  }

  const midY = 18 * em
  const groups = [
    frame('dc', 'Datacenter', [at('edge'), at('core-a'), at('core-b'), at('sw1'), at('sw2')]),
    frame('rack', 'Rack 2', [at('sw1'), at('sw2')]),
  ]
  const boxes = [...placed.map((p) => p.box), ...groups.map((g) => g.box)]
  const x = Math.min(...boxes.map((b) => b.x))
  const y = Math.min(...boxes.map((b) => b.y))
  const wires: { link: Link; points: Point[] }[] = [
    {
      link: link('e-a', 'edge', 'core-a', { label: '10G uplink', vlan: [10] }),
      points: [
        bottom('edge', -4),
        { x: bottom('edge', -4).x, y: midY },
        { x: top('core-a').x, y: midY },
        top('core-a'),
      ],
    },
    {
      link: link('e-b', 'edge', 'core-b', { vlan: [20] }),
      points: [
        bottom('edge', 4),
        { x: bottom('edge', 4).x, y: midY },
        { x: top('core-b').x, y: midY },
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
      points: [side('core-b', 'right'), point(69, 26), top('vm')],
    },
  ]
  return {
    nodes: placed,
    groups,
    hulls: [{ members: ['core-a', 'core-b'], kind: 'vpc' }],
    wires: wires.map((w) => ({
      ...w,
      radii: w.points.map((_, i) =>
        i > 0 && i + 1 < w.points.length ? kit.tokens.wire.cornerRadius : 0,
      ),
      ...lineWidths(w.link, kit, kit.tokens.line.bold),
    })),
    ports: [
      { id: 'edge:1', nodeId: 'edge', label: 'Te0/1', at: bottom('edge', -4), side: 'bottom' },
      { id: 'edge:2', nodeId: 'edge', label: 'Te0/2', at: bottom('edge', 4), side: 'bottom' },
      { id: 'a:1', nodeId: 'core-a', label: 'Eth1/1', at: bottom('core-a'), side: 'bottom' },
      {
        id: 'a:peer',
        nodeId: 'core-a',
        label: 'Eth1/48',
        at: side('core-a', 'right'),
        side: 'right',
      },
    ],
    bounds: {
      x,
      y,
      width: Math.max(...boxes.map((b) => b.x + b.width)) - x,
      height: Math.max(...boxes.map((b) => b.y + b.height)) - y,
    },
  }
}

mkdirSync(outDir, { recursive: true })
// resvg lives with the PNG renderer, not with this package.
const { Resvg } = await import('../../../renderer-png/node_modules/@resvg/resvg-js/index.js')

// The same scene at the default em and at twice that: only the base differs.
for (const [name, em] of [
  ['demo', undefined],
  ['demo-2x', 2 * DEFAULT_BASE.em],
] as const) {
  const base = em ? { em } : {}
  const svg = renderScene(buildScene(createKit(base)), { base })
  writeFileSync(path.join(outDir, `${name}.svg`), svg)
  const png = new Resvg(svg, { fitTo: { mode: 'zoom', value: 2 } }).render().asPng()
  writeFileSync(path.join(outDir, `${name}.png`), png)
  console.log(`wrote ${path.join(outDir, `${name}.png`)}`)
}
