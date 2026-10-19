import { describe, expect, it } from 'vitest'
import type { Node } from '../models/types.js'
import { hostingInversions, hostingLinks } from './hosting.js'

const nodes: Node[] = [
  { id: 'h1' },
  { id: 'h2' },
  { id: 'v1', host: 'h1' },
  { id: 'v2', host: 'h2' },
  { id: 'gone', host: 'not-drawn' },
]
const at = (xs: Record<string, number>) =>
  new Map(Object.entries(xs).map(([id, x]) => [id, { position: { x, y: 0 } }]))

describe('hosting as layout structure', () => {
  it('links only to a drawn host', () => {
    expect(hostingLinks(nodes).map((l) => `${l.from.node}>${l.to.node}`)).toEqual([
      'h1>v1',
      'h2>v2',
    ])
  })

  it('counts hosted nodes drawn in the reverse order of their hosts', () => {
    expect(hostingInversions(nodes, at({ h1: 0, h2: 100, v1: 0, v2: 100 }))).toBe(0)
    expect(hostingInversions(nodes, at({ h1: 0, h2: 100, v1: 100, v2: 0 }))).toBe(1)
  })
})
