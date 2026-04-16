import { describe, expect, it } from 'vitest'
import type { Link, Node } from '../models/types.js'
import { placePorts } from './port-placement.js'

function makeNodes(): Map<string, Node> {
  return new Map([
    [
      'sw1',
      { id: 'sw1', label: 'Switch 1', shape: 'rounded' as const, position: { x: 200, y: 100 } },
    ],
    [
      'sw2',
      { id: 'sw2', label: 'Switch 2', shape: 'rounded' as const, position: { x: 200, y: 300 } },
    ],
    [
      'sw3',
      { id: 'sw3', label: 'Switch 3', shape: 'rounded' as const, position: { x: 400, y: 100 } },
    ],
  ])
}

describe('placePorts', () => {
  it('places ports on correct sides for TB direction', () => {
    const nodes = makeNodes()
    const links: Link[] = [
      { from: { node: 'sw1', port: 'eth0' }, to: { node: 'sw2', port: 'eth0' } },
    ]

    const ports = placePorts(nodes, links, 'TB')

    // sw1:eth0 should be on bottom (source in TB)
    const p1 = ports.get('sw1:eth0')
    expect(p1.side).toBe('bottom')
    expect(p1.nodeId).toBe('sw1')
    // Bottom center of sw1 (size 180x60): y = 100 + 30 = 130
    expect(p1.absolutePosition.y).toBe(130)
    // Single port centered: x = 200 - 90 + 180 * 0.5 = 200
    expect(p1.absolutePosition.x).toBe(200)

    // sw2:eth0 should be on top (destination in TB)
    const p2 = ports.get('sw2:eth0')
    expect(p2.side).toBe('top')
    // Top center of sw2 (size 180x60): y = 300 - 30 = 270
    expect(p2.absolutePosition.y).toBe(270)
  })

  it('distributes multiple ports evenly', () => {
    const nodes = makeNodes()
    const links: Link[] = [
      { from: { node: 'sw1', port: 'eth0' }, to: { node: 'sw2', port: 'eth0' } },
      { from: { node: 'sw1', port: 'eth1' }, to: { node: 'sw2', port: 'eth1' } },
      { from: { node: 'sw1', port: 'eth2' }, to: { node: 'sw2', port: 'eth2' } },
    ]

    const ports = placePorts(nodes, links, 'TB')

    // 3 ports on bottom of sw1 (size 180x60, center x=200)
    // Positions: 200-90 + 180*(1/4) = 155, 200-90 + 180*(2/4) = 200, 200-90 + 180*(3/4) = 245
    const p0 = ports.get('sw1:eth0')
    const p1 = ports.get('sw1:eth1')
    const p2 = ports.get('sw1:eth2')

    expect(p0.absolutePosition.x).toBe(155)
    expect(p1.absolutePosition.x).toBe(200)
    expect(p2.absolutePosition.x).toBe(245)

    // All on bottom (y = 100 + 30 = 130)
    expect(p0.absolutePosition.y).toBe(130)
    expect(p1.absolutePosition.y).toBe(130)
    expect(p2.absolutePosition.y).toBe(130)
  })

  it('assigns HA ports to perpendicular sides', () => {
    const nodes = makeNodes()
    const links: Link[] = [
      {
        from: { node: 'sw1', port: 'ha0' },
        to: { node: 'sw3', port: 'ha0' },
        redundancy: 'ha',
      },
    ]

    const ports = placePorts(nodes, links, 'TB')

    // HA in TB: source → right, dest → left
    expect(ports.get('sw1:ha0').side).toBe('right')
    expect(ports.get('sw3:ha0').side).toBe('left')
  })

  it('handles LR direction', () => {
    const nodes = makeNodes()
    const links: Link[] = [
      { from: { node: 'sw1', port: 'eth0' }, to: { node: 'sw2', port: 'eth0' } },
    ]

    const ports = placePorts(nodes, links, 'LR')

    // LR: source → right, dest → left
    expect(ports.get('sw1:eth0').side).toBe('right')
    expect(ports.get('sw2:eth0').side).toBe('left')
  })

  it('handles mixed normal and HA links', () => {
    const nodes = makeNodes()
    const links: Link[] = [
      { from: { node: 'sw1', port: 'eth0' }, to: { node: 'sw2', port: 'eth0' } },
      {
        from: { node: 'sw1', port: 'ha0' },
        to: { node: 'sw3', port: 'ha0' },
        redundancy: 'vpc',
      },
    ]

    const ports = placePorts(nodes, links, 'TB')

    // Normal: bottom/top
    expect(ports.get('sw1:eth0').side).toBe('bottom')
    expect(ports.get('sw2:eth0').side).toBe('top')
    // HA: right/left
    expect(ports.get('sw1:ha0').side).toBe('right')
    expect(ports.get('sw3:ha0').side).toBe('left')
  })

  it('returns empty map for portless links', () => {
    const nodes = makeNodes()
    const links: Link[] = [{ from: 'sw1', to: 'sw2' }]

    const ports = placePorts(nodes, links, 'TB')
    expect(ports.size).toBe(0)
  })
})
