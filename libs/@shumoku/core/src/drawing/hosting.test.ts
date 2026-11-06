// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { describe, expect, it } from 'vitest'
import type * as input from '../input/model.js'
import type { Node } from '../models/types.js'
import { drawnInPlace, hostBox, hostingOf } from './hosting.js'

const net = (n: Partial<input.Network>): input.Network =>
  ({ nodes: [], links: [], ...n }) as unknown as input.Network

describe('what is drawn inside what', () => {
  it("puts each node in its outermost host's box, a container on a VM included", () => {
    const h = hostingOf(
      net({
        nodes: [
          { id: 'esx' },
          { id: 'b', host: 'esx' },
          { id: 'a', host: 'esx' },
          { id: 'ct', host: 'a' },
        ] as input.Node[],
      }),
    )
    expect([...h.boxes]).toEqual([['esx', ['a', 'b', 'ct']]])
    expect([...h.contained].sort()).toEqual(['a', 'b', 'ct'])
  })

  it("takes in a guest that names its host's place, as NetBox writes VMs, but not another", () => {
    const h = hostingOf(
      net({
        nodes: [
          { id: 'esx', group: 'site' },
          { id: 'vm', host: 'esx', group: 'site' },
          { id: 'away', host: 'esx', group: 'other' },
        ] as input.Node[],
      }),
    )
    expect(h.boxes.get('esx')).toEqual(['vm'])
    expect(h.contained.has('away')).toBe(false)
  })

  it("puts a guest of a cluster in the cluster's pool, where all its nodes stand", () => {
    const h = hostingOf(
      net({
        redundancy: [
          { id: 'prod', nodes: ['a', 'b'] },
          { id: 'split', nodes: ['a', 'c'] },
        ] as input.Redundancy[],
        nodes: [
          { id: 'a', group: 'dc' },
          { id: 'b', group: 'dc' },
          { id: 'c', group: 'other' },
          { id: 'db', host: 'prod', group: 'dc' },
          { id: 'lost', host: 'split' },
        ] as input.Node[],
      }),
    )
    expect([...h.pools]).toEqual([['prod', { place: 'dc', guests: ['db'] }]])
    expect(h.boxes.size).toBe(0)
    expect([...h.contained]).toEqual(['db'])
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

describe('a card drawn inside what it runs on', () => {
  it('leaves out the facts about where it runs, and keeps every other fact', () => {
    const node: Node = {
      id: 'vm',
      label: 'vm',
      annotations: [
        { kind: 'badge', label: 'Kind', value: 'Hosted', about: 'hosting' },
        { kind: 'relation', label: 'Host', value: 'esx', about: 'hosting' },
        { kind: 'identity', label: 'Software', value: 'Ubuntu' },
      ],
    } as Node
    expect(drawnInPlace(node).annotations).toEqual([
      { kind: 'identity', label: 'Software', value: 'Ubuntu' },
    ])
    const plain = { ...node, annotations: [{ kind: 'badge', label: 'Kind', value: 'VM' }] } as Node
    expect(drawnInPlace(plain)).toBe(plain)
  })
})
