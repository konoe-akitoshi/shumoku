// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { describe, expect, it } from 'vitest'
import type * as input from '../input/model.js'
import { hostFrameId, withHostFrames } from './hosting.js'

const net = (n: Partial<input.Network>): input.Network =>
  ({ nodes: [], links: [], ...n }) as unknown as input.Network
const groupOf = (n: input.Network, id: string) => n.nodes.find((x) => x.id === id)?.group

describe('hosts drawn as frames', () => {
  it('puts a host and its guests in a frame where the host stands', () => {
    const out = withHostFrames(
      net({
        groups: [{ id: 'dc' }] as input.Group[],
        nodes: [
          { id: 'esx', label: 'ESXi', group: 'dc' },
          { id: 'vm', host: 'esx' },
        ] as input.Node[],
      }),
    )
    expect(out.groups?.[0]?.groups?.map((g) => [g.id, g.label])).toEqual([
      [hostFrameId('esx'), 'ESXi'],
    ])
    expect(groupOf(out, 'esx')).toBe(hostFrameId('esx'))
    expect(groupOf(out, 'vm')).toBe(hostFrameId('esx'))
  })

  it('puts a cluster, its nodes and the guests on it in one frame', () => {
    const out = withHostFrames(
      net({
        redundancy: [{ id: 'prod', label: 'Prod', nodes: ['a', 'b'] }] as input.Redundancy[],
        nodes: [
          { id: 'a' },
          { id: 'b' },
          { id: 'db', host: 'prod' },
          { id: 'web', host: 'a' },
        ] as input.Node[],
      }),
    )
    expect(out.groups?.map((g) => g.id)).toEqual([hostFrameId('prod')])
    for (const id of ['a', 'b', 'db', 'web']) expect(groupOf(out, id)).toBe(hostFrameId('prod'))
  })

  it('leaves a guest that names its own place, and a network with no guests', () => {
    const plain = net({ nodes: [{ id: 'a' }] as input.Node[] })
    expect(withHostFrames(plain)).toBe(plain)
    const out = withHostFrames(
      net({
        groups: [{ id: 'x' }] as input.Group[],
        nodes: [{ id: 'esx' }, { id: 'vm', host: 'esx', group: 'x' }] as input.Node[],
      }),
    )
    expect(groupOf(out, 'vm')).toBe('x')
    expect(out).toEqual(net({ groups: [{ id: 'x' }] as input.Group[], nodes: out.nodes }))
  })

  it('takes in a guest that names the place its host stands in, as NetBox writes VMs', () => {
    const out = withHostFrames(
      net({
        groups: [{ id: 'site' }] as input.Group[],
        nodes: [
          { id: 'esx', group: 'site' },
          { id: 'vm', host: 'esx', group: 'site' },
        ] as input.Node[],
      }),
    )
    expect(groupOf(out, 'vm')).toBe(hostFrameId('esx'))
    expect(out.groups?.[0]?.groups?.[0]?.id).toBe(hostFrameId('esx'))
  })

  it('nests a guest that hosts others inside its own host', () => {
    const out = withHostFrames(
      net({
        nodes: [{ id: 'esx' }, { id: 'vm', host: 'esx' }, { id: 'ct', host: 'vm' }] as input.Node[],
      }),
    )
    expect(out.groups?.[0]?.id).toBe(hostFrameId('esx'))
    expect(out.groups?.[0]?.groups?.[0]?.id).toBe(hostFrameId('vm'))
    expect(groupOf(out, 'vm')).toBe(hostFrameId('vm'))
    expect(groupOf(out, 'ct')).toBe(hostFrameId('vm'))
  })
})
