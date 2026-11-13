import { readFileSync } from 'node:fs'
import { type NetworkModel, readNetworkModel } from '@shumoku/core'
import { describe, expect, it } from 'vitest'
import { drawNetworkScene } from './draw.js'

// Read from a live network (names replaced): a short box beside a switch whose left side holds
// three ports, one of them a line straight across to that box. At the kit's sizes the straight
// end cannot reach the short box's height, which left the heights with no solution.
const straightAcrossToShortBox = `
groups:
  - { id: g1 }
  - { id: g0 }
nodes:
  - { id: n0, group: g0 }
  - { id: n1 }
  - { id: n2 }
${Array.from({ length: 11 }, (_, i) => `  - { id: m${i}, group: g0 }`).join('\n')}
${Array.from({ length: 10 }, (_, i) => `  - { id: k${i}, group: g0 }`).join('\n')}
${Array.from({ length: 4 }, (_, i) => `  - { id: r${i} }`).join('\n')}
${Array.from({ length: 12 }, (_, i) => `  - { id: s${i} }`).join('\n')}
links:
  - endpoints: [{ node: n1, port: Ethernet10 }, { node: s3, port: ptp1 }]
  - endpoints: [{ node: n1, port: Ethernet11 }, { node: n0, port: eno2 }]
  - endpoints: [{ node: n1, port: Ethernet12 }, { node: s5, port: 0/22 }]
  - endpoints: [{ node: n1, port: Ethernet15 }, { node: n2, port: Ethernet15 }]
  - endpoints: [{ node: n2, port: Ethernet10 }, { node: s3, port: ptp2 }]
  - endpoints: [{ node: n2, port: Ethernet51/1 }, { node: n0, port: mlnx2 }]
  - endpoints: [{ node: n2, port: Ethernet37 }, { node: s4, port: Eth1/3 }]
  - endpoints: [{ node: m0, port: Ethernet54/1 }, { node: s2, port: mlnx1 }]
  - endpoints: [{ node: m1, port: Ethernet1 }, { node: s0, port: port128 }]
  - endpoints: [{ node: m1, port: Ethernet2 }, { node: s1, port: port124 }]
`

describe('drawNetworkScene', () => {
  it('bends a line straight across that the heights cannot hold, and draws every line', () => {
    const scene = drawNetworkScene(readNetworkModel(straightAcrossToShortBox))
    expect(scene.wires).toHaveLength(10)
  })

  // Read from a live network (names replaced): six ports report a speed, so their lines are drawn
  // at different widths. Two groups' ports on facing sides were then left a step too small for a
  // jog that nothing around them could widen, and asking the least of it anyway made the
  // separations of the columns a ring ("the constraints contain a cycle").
  it('draws lines of different widths where a jog has no room to be widened', () => {
    const model = JSON.parse(
      readFileSync(new URL('./wide-lines.fixture.json', import.meta.url), 'utf8'),
    ) as NetworkModel
    const scene = drawNetworkScene(model)
    expect(scene.wires).toHaveLength(model.config.links?.length ?? 0)
    expect(new Set(scene.wires.map((w) => w.stroke)).size).toBeGreaterThan(1)
  })
})
