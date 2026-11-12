// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { describe, expect, it } from 'vitest'
import { createKit } from './measure.js'
import { portSides } from './port-sides.js'

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
