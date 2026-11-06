// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * The kit catalog's specimens: small networks that each show one part of the kit. Plain JS so
 * the page imports it as it is.
 */

import { DeviceType } from '@shumoku/core'

const deviceNodes = Object.values(DeviceType)
  .map((type) => `  - { id: ${type}, label: ${type}, type: ${type} }`)
  .join('\n')

/** @type {{ id: string, title: string, note: string, files: string[], yaml: string }[]} */
export const specimens = [
  {
    id: 'cards',
    title: 'NodeCard: 機器の種類',
    note: 'DeviceType ごとのカードの形・アイコン。形は node-shape.ts、中身は content.ts / card-look.ts。',
    files: ['kit/NodeCard.svelte', 'kit/card-look.ts', 'kit/node-shape.ts', 'kit/content.ts'],
    yaml: `name: cards\nnodes:\n${deviceNodes}\nlinks: []\n`,
  },
  {
    id: 'card-states',
    title: 'NodeCard: 状態とラベル',
    note: '製品付き、日本語の長いラベル、assumed（未観測）のカード。',
    files: ['kit/NodeCard.svelte', 'kit/card-look.ts', 'kit/measure.ts'],
    yaml: `name: card-states
nodes:
  - { id: rt, label: Edge-RT-1, type: router, product: yamaha/rtx3510 }
  - { id: multi, label: 'Core-SW (10.0.0.1)', type: l3-switch }
  - { id: jp, label: 本社3階フロアスイッチ（東側ラック）, type: l2-switch }
  - { id: onu, label: ONU, type: cpe, assumed: true }
links: []
`,
  },
  {
    id: 'wires',
    title: 'Wire / Port: 線の種類',
    note: '速度で太さ（wire-width.ts）、virtual は点線、assumed は破線、VLAN で色（wire-look.ts）。両端の四角と名札が Port。',
    files: [
      'kit/Wire.svelte',
      'kit/wire-look.ts',
      'kit/wire-width.ts',
      'kit/Port.svelte',
      'kit/port-look.ts',
    ],
    yaml: `name: wires
segments:
  - { id: users, vlan: 20 }
  - { id: mgmt, vlan: 10 }
nodes:
  - { id: core, label: Core, type: l3-switch }
  - { id: a, label: 1G, type: l2-switch }
  - { id: b, label: 10G, type: l2-switch }
  - { id: c, label: 100G, type: l2-switch }
  - { id: d, label: virtual, type: server }
  - { id: e, label: assumed, type: cpe }
  - { id: f, label: vlan 20, type: access-point }
  - { id: g, label: vlan 10, type: access-point }
links:
  - { endpoints: [{ node: core, port: ge-0/0/1 }, { node: a, port: uplink }], speed: 1G }
  - { endpoints: [{ node: core, port: xe-0/0/2 }, { node: b, port: uplink }], speed: 10G }
  - { endpoints: [{ node: core, port: et-0/0/3 }, { node: c, port: uplink }], speed: 100G }
  - { endpoints: [{ node: core, port: tun0 }, { node: d, port: tun0 }], virtual: true }
  - { endpoints: [{ node: core, port: ge-0/0/5 }, { node: e }], assumed: true }
  - { endpoints: [{ node: core, port: ge-0/0/6 }, { node: f, port: eth0 }], segments: [users] }
  - { endpoints: [{ node: core, port: ge-0/0/7 }, { node: g, port: eth0 }], segments: [mgmt] }
`,
  },
  {
    id: 'captions',
    title: 'WireCaption: 線の名札',
    note: 'ケーブル種別・長さが線の中ほどに出る。caption-look.ts / content.ts の captionContent。',
    files: ['kit/WireCaption.svelte', 'kit/caption-look.ts', 'kit/content.ts'],
    yaml: `name: captions
nodes:
  - { id: rt-1, label: RT-1, type: router }
  - { id: sw-1, label: SW-1, type: l3-switch }
  - { id: sw-2, label: SW-2, type: l2-switch }
links:
  - { endpoints: [{ node: rt-1, port: lan3 }, { node: sw-1, port: xe-0/2/3 }], speed: 10G, cable: mmf-om4, length: 3m }
  - { endpoints: [{ node: sw-1, port: xe-0/1/0 }, { node: sw-2, port: xe-0/1/0 }], speed: 10G, cable: dac, length: 1m }
`,
  },
  {
    id: 'groups',
    title: 'GroupFrame / Hull: 枠と冗長ペア',
    note: '入れ子のグループ枠（group-look.ts）と、冗長ペアを囲む Hull（hull-look.ts / hull-geometry.ts）。',
    files: [
      'kit/GroupFrame.svelte',
      'kit/group-look.ts',
      'kit/Hull.svelte',
      'kit/hull-look.ts',
      'kit/hull-geometry.ts',
    ],
    yaml: `name: groups
groups:
  - id: dc
    label: Data Center
    groups:
      - { id: edge, label: Edge }
      - { id: rack, label: Rack A }
redundancy:
  - { id: fw-pair, nodes: [fw1, fw2] }
nodes:
  - { id: isp, label: ISP, type: internet }
  - { id: fw1, label: FW-1, type: firewall, group: edge }
  - { id: fw2, label: FW-2, type: firewall, group: edge }
  - { id: sw, label: ToR, type: l2-switch, group: rack }
  - { id: srv, label: Server, type: server, group: rack }
links:
  - { endpoints: [{ node: isp, port: a }, { node: fw1, port: wan }] }
  - { endpoints: [{ node: isp, port: b }, { node: fw2, port: wan }] }
  - { endpoints: [{ node: fw1, port: lan }, { node: sw, port: p1 }], speed: 10G }
  - { endpoints: [{ node: fw2, port: lan }, { node: sw, port: p2 }], speed: 10G }
  - { endpoints: [{ node: sw, port: p3 }, { node: srv, port: eth0 }] }
`,
  },
]
