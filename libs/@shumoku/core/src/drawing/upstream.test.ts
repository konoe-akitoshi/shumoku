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
