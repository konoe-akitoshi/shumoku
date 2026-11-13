// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { describe, expect, it } from 'vitest'
import { linkSpeedBps, portsSpeedBps, standardSpeedBps } from './link-speed.js'
import { readNetworkModel, toNetworkGraph } from './network-model-graph.js'
import type { Link, LinkPlug } from './types.js'

const plug = (standard: string): LinkPlug => ({ module: { standard } }) as unknown as LinkPlug
const link = (from?: LinkPlug, to?: LinkPlug, speedBps?: number): Link =>
  ({
    from: { node: 'a', ...(from && { plug: from }) },
    to: { node: 'b', ...(to && { plug: to }) },
    ...(speedBps !== undefined && { speedBps }),
  }) as Link

describe('linkSpeedBps', () => {
  it('is the slower of the two standards when the ends differ', () => {
    expect(linkSpeedBps(link(plug('10GBASE-T'), plug('1000BASE-T')))).toBe(1e9)
  })

  it('is the one standard that names a speed', () => {
    expect(linkSpeedBps(link(plug('10GBASE-T'), undefined))).toBe(10e9)
  })

  it('prefers the standards to the speed the link carries', () => {
    expect(linkSpeedBps(link(plug('1000BASE-T'), undefined, 40e9))).toBe(1e9)
  })

  it('falls back to the speed the link carries', () => {
    expect(linkSpeedBps(link(undefined, undefined, 25e9))).toBe(25e9)
  })

  it('names nothing for no speed, zero, or a number that is not one', () => {
    expect(linkSpeedBps(link())).toBeUndefined()
    expect(linkSpeedBps(link(undefined, undefined, 0))).toBeUndefined()
    expect(linkSpeedBps(link(undefined, undefined, Number.NaN))).toBeUndefined()
    expect(linkSpeedBps(undefined)).toBeUndefined()
  })
})

describe('standardSpeedBps', () => {
  it('names nothing when no plug has a standard', () => {
    expect(standardSpeedBps([undefined, {}])).toBeUndefined()
  })
})

describe('portsSpeedBps', () => {
  it('is the slower of the two ends', () => {
    expect(portsSpeedBps(['10G', '1G'])).toBe(1e9)
  })
  it('is the one end that names it', () => {
    expect(portsSpeedBps([undefined, '2.5g'])).toBe(2.5e9)
  })
  it('is nothing when neither end names one or the text is not a rate', () => {
    expect(portsSpeedBps([undefined, 'fast'])).toBeUndefined()
  })
})

describe('toNetworkGraph link speed from ports', () => {
  const graphOf = (yaml: string) => toNetworkGraph(readNetworkModel(yaml))
  const base = (link: string) => `
nodes:
  - id: a
    ports: [{ name: p1, speed: 10G }]
  - id: b
    ports: [{ name: p1, speed: 1G }]
links:
  - ${link}
`
  it('takes the slower of the ends port speeds', () => {
    const l = graphOf(base('endpoints: [{ node: a, port: p1 }, { node: b, port: p1 }]')).links[0]
    expect(linkSpeedBps(l)).toBe(1e9)
  })
  it('keeps the link speed over the ports', () => {
    const l = graphOf(
      base('{ speed: 40G, endpoints: [{ node: a, port: p1 }, { node: b, port: p1 }] }'),
    ).links[0]
    expect(linkSpeedBps(l)).toBe(40e9)
  })
})
