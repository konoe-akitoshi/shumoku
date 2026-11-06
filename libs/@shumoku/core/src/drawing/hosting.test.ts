// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { describe, expect, it } from 'vitest'
import type * as input from '../input/model.js'
import { guestsByHost, hostBox, hostFrameId, withHostFrames } from './hosting.js'

const net = (n: Partial<input.Network>): input.Network =>
  ({ nodes: [], links: [], ...n }) as unknown as input.Network
const groupOf = (n: input.Network, id: string) => n.nodes.find((x) => x.id === id)?.group

describe('guests drawn inside their host', () => {
  it('gives each host the nodes that run on it, a container on a VM included', () => {
    const guests = guestsByHost(
      net({
        nodes: [
          { id: 'esx' },
          { id: 'b', host: 'esx' },
          { id: 'a', host: 'esx' },
          { id: 'ct', host: 'a' },
        ] as input.Node[],
      }),
    )
    expect([...guests]).toEqual([['esx', ['a', 'b', 'ct']]])
  })

  it("takes in a guest that names its host's place, as NetBox writes VMs, but not another", () => {
    const guests = guestsByHost(
      net({
        nodes: [
          { id: 'esx', group: 'site' },
          { id: 'vm', host: 'esx', group: 'site' },
          { id: 'away', host: 'esx', group: 'other' },
        ] as input.Node[],
      }),
    )
    expect(guests.get('esx')).toEqual(['vm'])
  })

  it("leaves a guest of a cluster to the cluster's frame", () => {
    const guests = guestsByHost(
      net({
        redundancy: [{ id: 'prod', nodes: ['a', 'b'] }] as input.Redundancy[],
        nodes: [{ id: 'a' }, { id: 'b' }, { id: 'db', host: 'prod' }] as input.Node[],
      }),
    )
    expect(guests.size).toBe(0)
  })

  it('lays guests below the heading in a grid of sqrt(count) columns', () => {
    const size = { width: 100, height: 40 }
    const box = hostBox(
      { width: 120, height: 50 },
      ['a', 'b', 'c', 'd', 'e'].map((id) => ({ id, size })),
      { gap: 10, pad: 5 },
    )
    expect(box.seated.map((s) => s.at)).toEqual([
      { x: 5, y: 55 },
      { x: 115, y: 55 },
      { x: 225, y: 55 },
      { x: 5, y: 105 },
      { x: 115, y: 105 },
    ])
    expect(box.size).toEqual({ width: 330, height: 50 + 2 * 40 + 10 + 10 })
  })
})

describe('a cluster named as a host drawn as a frame', () => {
  it('puts the cluster, its nodes and the guests on it in one frame where the cluster stands', () => {
    const out = withHostFrames(
      net({
        groups: [{ id: 'dc' }] as input.Group[],
        redundancy: [{ id: 'prod', label: 'Prod', nodes: ['a', 'b'] }] as input.Redundancy[],
        nodes: [
          { id: 'a', group: 'dc' },
          { id: 'b', group: 'dc' },
          { id: 'db', host: 'prod', group: 'dc' },
        ] as input.Node[],
      }),
    )
    expect(out.groups?.[0]?.groups?.map((g) => [g.id, g.label])).toEqual([
      [hostFrameId('prod'), 'Prod'],
    ])
    for (const id of ['a', 'b', 'db']) expect(groupOf(out, id)).toBe(hostFrameId('prod'))
  })

  it('leaves a network with no guest of a cluster as it is', () => {
    const plain = net({ nodes: [{ id: 'esx' }, { id: 'vm', host: 'esx' }] as input.Node[] })
    expect(withHostFrames(plain)).toBe(plain)
  })
})
