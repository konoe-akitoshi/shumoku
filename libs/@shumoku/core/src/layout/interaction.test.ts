import { describe, expect, it } from 'vitest'
import type { Link, Node, ResolvedPort, Subgraph } from '../models/types.js'
import { isPortLinked, linkExists, rebalanceSubgraphs } from './interaction.js'

it('derives nested enclosures without moving overlapping saved nodes or ports', () => {
  const nodes = new Map<string, Node>([
    [
      'a',
      {
        id: 'a',
        label: 'A',
        parent: 'inner',
        position: { x: 100, y: 100 },
        size: { width: 100, height: 80 },
      },
    ],
    [
      'b',
      {
        id: 'b',
        label: 'B',
        parent: 'sibling',
        position: { x: 100, y: 100 },
        size: { width: 100, height: 80 },
      },
    ],
  ])
  const groups = new Map<string, Subgraph>([
    ['outer', { id: 'outer', label: 'Outer' }],
    ['inner', { id: 'inner', label: 'Inner', parent: 'outer' }],
    ['sibling', { id: 'sibling', label: 'Sibling' }],
    ['empty', { id: 'empty', label: 'Empty', bounds: { x: -9999, y: -9999, width: 1, height: 1 } }],
  ])
  const ports = new Map<string, ResolvedPort>()
  const before = structuredClone(nodes)
  rebalanceSubgraphs(nodes, groups, ports, {
    resolveCollisions: false,
    direction: 'LR',
    subgraphPadding: 10,
    subgraphLabelHeight: 20,
  })
  expect(nodes).toEqual(before)
  expect(ports.size).toBe(0)
  expect(groups.get('inner')?.bounds).toEqual({ x: 20, y: 50, width: 140, height: 100 })
  expect(groups.get('outer')?.bounds).toEqual({ x: -10, y: 40, width: 180, height: 120 })
  expect(groups.get('empty')).not.toHaveProperty('bounds')
})

const link = (id: string, fromN: string, fromP: string, toN: string, toP: string): Link => ({
  id,
  from: { node: fromN, port: fromP },
  to: { node: toN, port: toP },
})

describe('isPortLinked', () => {
  it('returns false for an empty link set', () => {
    expect(isPortLinked([], 'sw1', 'eth0')).toBe(false)
  })

  it('returns true when the port appears as the from endpoint', () => {
    const links = [link('l1', 'sw1', 'eth0', 'sw2', 'eth0')]
    expect(isPortLinked(links, 'sw1', 'eth0')).toBe(true)
  })

  it('returns true when the port appears as the to endpoint', () => {
    const links = [link('l1', 'sw1', 'eth0', 'sw2', 'eth0')]
    expect(isPortLinked(links, 'sw2', 'eth0')).toBe(true)
  })

  it('returns false for an unrelated port on a linked node', () => {
    const links = [link('l1', 'sw1', 'eth0', 'sw2', 'eth0')]
    expect(isPortLinked(links, 'sw1', 'eth1')).toBe(false)
  })

  it('returns false for the same port id on a different node', () => {
    const links = [link('l1', 'sw1', 'eth0', 'sw2', 'eth0')]
    expect(isPortLinked(links, 'sw3', 'eth0')).toBe(false)
  })
})

describe('linkExists vs isPortLinked', () => {
  // Sanity check: linkExists only guards exact-link duplicates, while
  // isPortLinked enforces the "one link per port" invariant. The
  // multi-link-per-port bug came from conflating the two.
  it('linkExists is false when a port already has a different partner', () => {
    const links = [link('l1', 'sw1', 'eth0', 'sw2', 'eth0')]
    // Try a brand-new link from sw3 onto sw1:eth0 (already in use).
    expect(linkExists(links, 'sw3', 'eth0', 'sw1', 'eth0')).toBe(false)
    expect(isPortLinked(links, 'sw1', 'eth0')).toBe(true)
  })
})
