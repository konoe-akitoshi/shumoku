// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { describe, expect, it } from 'vitest'
import { createKit } from './measure.js'
import { headCut, needOf, portSides } from './port-sides.js'

const kit = createKit()
const { port } = kit.tokens
const empty = { top: [], bottom: [], left: [], right: [] }

describe('portSides', () => {
  const names = ['TenGigabitEthernet1/0/1', 'Gi1', 'Management1']
  const sides = portSides(
    {
      bodyWidth: 100,
      bodyHeight: 60,
      sides: {
        ...empty,
        top: names.map((name) => ({ name })),
        left: names.map((name) => ({ name })),
      },
    },
    kit,
  )

  it('shows the shortened names and keeps the list in the order given', () => {
    expect(sides.top.labels.map((l) => l.text)).toEqual(['Te1/0/1', 'Gi1', 'Ma1'])
    expect(sides.top.labels.map((l) => l.row)).toEqual([0, 0, 0])
  })

  it('asks a top edge for half of each chip on either side of the centre between neighbours', () => {
    const [a, b] = sides.top.labels
    const first = sides.top.gaps[0]
    expect(first).toMatchObject({ from: 0, to: 1 })
    expect(first?.min).toBeCloseTo(
      Math.max(port.minSlot, (a?.width ?? 0) / 2 + (b?.width ?? 0) / 2 + port.labelGap),
    )
  })

  it('asks a side edge for the height of a chip alone: the width of a name widens nothing', () => {
    for (const gap of sides.left.gaps) {
      expect(gap.min).toBeCloseTo(Math.max(port.minSlot, port.labelHeight + port.labelGap))
    }
    const long = portSides(
      {
        bodyWidth: 100,
        bodyHeight: 60,
        sides: { ...empty, left: [{ name: 'a-very-long-port-name-indeed' }, { name: 'x' }] },
      },
      kit,
    )
    expect(long.left.gaps[0]?.min).toBeCloseTo(sides.left.gaps[0]?.min ?? 0)
    expect(long.left.depth).toBeGreaterThan(sides.left.depth - 1e-9)
  })

  it('asks no more than a slot between ports with no name', () => {
    const bare = portSides(
      { bodyWidth: 100, bodyHeight: 60, sides: { ...empty, top: [{}, {}, {}] } },
      kit,
    )
    expect(bare.top.gaps.map((g) => g.min)).toEqual([port.minSlot, port.minSlot])
    expect(bare.top.labels.map((l) => l.text)).toEqual(['', '', ''])
    expect(bare.top.leadMargin).toBe(port.minSlot / 2)
  })

  it('lets a wide end chip reach past the corner by the overhang only', () => {
    expect(sides.top.leadMargin).toBeCloseTo(
      Math.max(port.minSlot / 2, (sides.top.labels[0]?.width ?? 0) / 2 - port.labelOverhang),
    )
  })

  it('does not rename the same name differently on two edges of a box', () => {
    const both = portSides(
      {
        bodyWidth: 100,
        bodyHeight: 60,
        sides: { ...empty, top: [{ name: 'Ethernet1' }], bottom: [{ name: 'Et1' }] },
      },
      kit,
    )
    expect(both.top.labels[0]?.text).toBe('Ethernet1')
    expect(both.bottom.labels[0]?.text).toBe('Et1')
  })
})

describe('the steps for a long edge', () => {
  // seven pixels a character, so the widths in these cases are plain numbers
  const fixed = createKit(undefined, { width: (text: string) => text.length * 7 })
  const ports = (n: number) =>
    Array.from({ length: n }, (_, i) => ({ name: `TenGigabitEthernet1/0/${i + 1}` }))
  const top = (n: number, bodyWidth: number) =>
    portSides({ bodyWidth, bodyHeight: 60, sides: { ...empty, top: ports(n) } }, fixed).top

  it('keeps the whole shown names while they fit the edge', () => {
    const edge = top(4, 400)
    expect(edge.caption).toBeUndefined()
    expect(edge.labels.map((l) => l.text)).toEqual(['Te1/0/1', 'Te1/0/2', 'Te1/0/3', 'Te1/0/4'])
  })

  it('writes the shared start once when the names asked for more than the edge may have', () => {
    const edge = top(48, 200)
    expect(edge.caption?.text).toBe('Te1/0/')
    expect(edge.labels[0]?.text).toBe('1')
    expect(edge.labels[47]?.text).toBe('48')
    expect(edge.leadMargin).toBeGreaterThan(edge.caption?.width ?? Infinity)
  })

  it('asks less of the edge with the caption than without it', () => {
    const elided = top(48, 200)
    const plain = top(48, 100000)
    expect(plain.caption).toBeUndefined()
    expect(needOf(elided)).toBeLessThan(needOf(plain))
  })

  it('does not elide an edge with two ports, however long their names', () => {
    expect(top(2, 10).caption).toBeUndefined()
  })
})

describe('two rows', () => {
  const fixed = createKit(undefined, { width: (text: string) => text.length * 7 })
  // names with nothing in common, so the start cannot be taken out
  const words = ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot', 'golf', 'hotel']
  const named = (n: number) =>
    Array.from({ length: n }, (_, i) => ({ name: `${words[i % words.length]}-${i}x` }))
  const edge = (side: 'top' | 'left', n: number, body: number) =>
    portSides({ bodyWidth: body, bodyHeight: body, sides: { ...empty, [side]: named(n) } }, fixed)[
      side
    ]

  it('stays in one row while the edge has the room', () => {
    const one = edge('top', 4, 800)
    expect(one.labels.map((l) => l.row)).toEqual([0, 0, 0, 0])
    expect(one.gaps.every((g) => g.to - g.from === 1)).toBe(true)
  })

  it('sets every other chip in the outer row when one row asks for more than the edge may have', () => {
    const two = edge('top', 12, 100)
    expect(two.labels.map((l) => l.row)).toEqual([0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1])
    expect(two.depth).toBeGreaterThan(edge('top', 4, 800).depth)
  })

  it('asks of a neighbour in the other row only the wire past the chip, and of one two apart a chip and its air', () => {
    const two = edge('top', 12, 100)
    const w = (i: number) => two.labels[i]?.width ?? 0
    const near = two.gaps.find((g) => g.from === 0 && g.to === 1)
    const far = two.gaps.find((g) => g.from === 0 && g.to === 2)
    expect(near?.min).toBeCloseTo(
      Math.max(port.minSlot, Math.max(w(0), w(1)) / 2 + port.labelGap / 2),
    )
    expect(far?.min).toBeCloseTo(w(0) / 2 + w(2) / 2 + port.labelGap)
    expect(two.gaps.filter((g) => g.to - g.from === 2)).toHaveLength(10)
  })

  it('asks less of the edge in two rows than in one', () => {
    const wide = edge('top', 12, 100000)
    expect(wide.labels.every((l) => l.row === 0)).toBe(true)
    expect(needOf(edge('top', 12, 100))).toBeLessThan(needOf(wide))
  })

  it('never staggers a left or right edge', () => {
    const side = edge('left', 12, 20)
    expect(side.labels.every((l) => l.row === 0)).toBe(true)
    expect(side.gaps.every((g) => g.to - g.from === 1)).toBe(true)
  })
})

describe('cutting the front of a name', () => {
  const fixed = createKit(undefined, { width: (text: string) => text.length * 7 })
  const chip = (chars: number) => chars * 7 + fixed.tokens.port.labelPadding

  it('leaves names that fit alone', () => {
    expect(headCut(['Te1/0/1', 'Te1/0/2'], chip(7), fixed)).toEqual(['Te1/0/1', 'Te1/0/2'])
  })

  it('keeps the end of the names and marks the cut', () => {
    expect(headCut(['Te1/0/10', 'Te1/0/22'], chip(4), fixed)).toEqual(
      ['…/10', '…/22'].map((t) => t),
    )
  })

  it('does not let two names collapse into one', () => {
    const [a, b] = headCut(['Te1/0/52', 'Te2/0/52'], chip(5), fixed)
    expect(a).not.toBe(b)
    expect(a).toBe('…1/0/52')
    expect(b).toBe('…2/0/52')
  })

  it('keeps the last octet of a MAC-like name', () => {
    const cut = headCut(
      ['00:11:22:33:44:55', '00:11:22:33:44:56', '00:11:22:33:44:57'],
      chip(4),
      fixed,
    )
    expect(cut.map((t) => t.slice(-2))).toEqual(['55', '56', '57'])
    expect(cut.every((t) => t.startsWith('…'))).toBe(true)
  })

  it('leaves the names of ports with no name empty', () => {
    expect(headCut(['', 'abcdefghij'], chip(4), fixed)).toEqual(['', '…hij'])
  })

  it('cuts the names of a long edge when two rows are still too many', () => {
    const names = Array.from({ length: 30 }, (_, i) => ({
      name: `${['alpha', 'bravo', 'charlie'][i % 3]}-uplink-to-the-core-${i + 1}`,
    }))
    const edge = portSides(
      { bodyWidth: 100, bodyHeight: 100, sides: { ...empty, top: names } },
      fixed,
    ).top
    expect(edge.labels.map((l) => l.row)[1]).toBe(1)
    expect(edge.labels.every((l) => l.text.startsWith('…'))).toBe(true)
    expect(new Set(edge.labels.map((l) => l.text)).size).toBe(30)
  })

  it('holds a chip on a side edge to a fixed length however long the name', () => {
    const edge = portSides(
      {
        bodyWidth: 100,
        bodyHeight: 100,
        sides: { ...empty, left: [{ name: 'a-really-very-long-interface-name-1' }] },
      },
      fixed,
    ).left
    const first = edge.labels[0]
    expect(first?.text.startsWith('…')).toBe(true)
    expect(first?.width ?? 0).toBeLessThanOrEqual(chip(14) + 1e-9)
  })
})
