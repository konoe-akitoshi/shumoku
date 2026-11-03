// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { describe, expect, it } from 'vitest'
import type * as input from '../input/model.js'
import { upstreamOf } from './upstream.js'

const link = (a: string, b: string, speed?: input.Rate): input.Link => ({
  endpoints: [{ node: a }, { node: b }],
  ...(speed && { speed }),
})

const net = (nodes: input.Node[], links: input.Link[]): input.Network => ({ nodes, links })

describe('the upstream guessed where no boundary is named', () => {
  it('takes the node type nearest the way out', () => {
    const n = net(
      [
        { id: 'sw', type: 'l2-switch' },
        { id: 'rt', type: 'router' },
        { id: 'srv', type: 'server' },
      ],
      [link('sw', 'rt'), link('sw', 'srv')],
    )
    expect(upstreamOf(n, [])).toEqual(['rt'])
  })

  it('takes the fastest link when the types tell nothing apart', () => {
    const n = net(
      [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
      [link('a', 'b', '1G'), link('b', 'c', '100G'), link('c', 'a', '1G')],
    )
    expect(upstreamOf(n, []).sort()).toEqual(['b', 'c'])
  })

  it('takes the centre when nothing else tells the nodes apart', () => {
    const n = net(
      [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }, { id: 'e' }],
      [link('a', 'b'), link('b', 'c'), link('c', 'd'), link('d', 'e')],
    )
    expect(upstreamOf(n, [])).toEqual(['c'])
  })

  it('leaves alone a part a named boundary reaches, and guesses for the others', () => {
    const n = net(
      [{ id: 'isp' }, { id: 'x' }, { id: 'rt', type: 'router' }, { id: 'sw', type: 'l2-switch' }],
      [link('isp', 'x'), link('rt', 'sw')],
    )
    expect(upstreamOf(n, ['isp'])).toEqual(['rt'])
  })

  it('guesses nothing for a lone node', () => {
    expect(upstreamOf(net([{ id: 'a' }], []), [])).toEqual([])
  })
})

describe('the upstream guessed, for any network', () => {
  /** A scattering of small networks: several parts of random size, some types and speeds. */
  function scattered(seed: number): input.Network {
    let state = seed
    const next = (n: number) => {
      state = (state * 1103515245 + 12345) % 2147483648
      return state % n
    }
    const types = ['router', 'l2-switch', 'l3-switch', 'server', undefined]
    const count = 6 + next(14)
    const nodes: input.Node[] = Array.from({ length: count }, (_, i) => {
      const type = types[next(types.length)]
      return { id: `n${i}`, ...(type && { type }) }
    })
    const speeds: input.Rate[] = ['1G', '10G', '100G']
    const links = Array.from({ length: next(count) }, () => {
      const a = next(count)
      const b = (a + 1 + next(count - 1)) % count
      return link(`n${a}`, `n${b}`, speeds[next(speeds.length)])
    })
    return net(nodes, links)
  }

  /** The parts of the network, found without the code under test: nodes are joined by links. */
  function partsOf(n: input.Network): Map<string, number> {
    const part = new Map(n.nodes.map((node, i) => [node.id, i]))
    const ends = (l: input.Link) => l.endpoints.flatMap((e) => ('node' in e ? [e.node] : []))
    for (const l of n.links) {
      const [a, b] = ends(l)
      const [pa, pb] = [part.get(a ?? ''), part.get(b ?? '')]
      if (pa === undefined || pb === undefined || pa === pb) continue
      for (const [id, p] of part) if (p === pb) part.set(id, pa)
    }
    return part
  }

  it.each(Array.from({ length: 60 }, (_, k) => k + 1))(
    'seed %i: holds no node of a part that already holds a named boundary',
    (seed) => {
      const n = scattered(seed)
      const part = partsOf(n)
      const named = n.nodes.filter((_, i) => (seed + i) % 5 === 0).map((node) => node.id)
      const taken = new Set(named.map((id) => part.get(id)))
      for (const id of upstreamOf(n, named)) {
        expect(part.has(id)).toBe(true)
        expect(taken.has(part.get(id))).toBe(false)
      }
    },
  )
})
