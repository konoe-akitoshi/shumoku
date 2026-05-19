import { describe, expect, it } from 'vitest'
import type { Link, Node } from '../models/types.js'
import { placePorts } from './port-placement.js'

// Test fixture: nodes mimic post-layout state with `.size` already
// attached (as layoutNetwork would do). The old test fixture relied
// on the implicit 180×60 default; now that the default body width is
// 80, layout's footprint is what makes a switch wide enough to fit
// its port bank, so we set size explicitly.
function makeNodes(): Map<string, Node> {
  const size = { width: 180, height: 60 }
  return new Map([
    [
      'sw1',
      {
        id: 'sw1',
        label: 'Switch 1',
        shape: 'rounded' as const,
        position: { x: 200, y: 100 },
        size,
      },
    ],
    [
      'sw2',
      {
        id: 'sw2',
        label: 'Switch 2',
        shape: 'rounded' as const,
        position: { x: 200, y: 300 },
        size,
      },
    ],
    [
      'sw3',
      {
        id: 'sw3',
        label: 'Switch 3',
        shape: 'rounded' as const,
        position: { x: 400, y: 100 },
        size,
      },
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

  describe('placement overrides', () => {
    it('honours per-port side override', () => {
      const nodes = makeNodes()
      // Pin sw1's port to top even though it's the source in TB.
      nodes.set('sw1', {
        ...nodes.get('sw1'),
        ports: [
          {
            id: 'eth0',
            label: 'eth0',
            connectors: [],
            placement: { side: 'top' },
          },
        ],
      })
      const links: Link[] = [
        { from: { node: 'sw1', port: 'eth0' }, to: { node: 'sw2', port: 'eth0' } },
      ]

      const ports = placePorts(nodes, links, 'TB')
      expect(ports.get('sw1:eth0').side).toBe('top')
      // sw2 stays auto (destination → top)
      expect(ports.get('sw2:eth0').side).toBe('top')
    })

    it('orders auto ports by peer position to avoid crossings', () => {
      // sw1 has two bottom ports going to peers at different x — the
      // port whose peer is on the left should land on the left side.
      const nodes = new Map([
        [
          'sw1',
          { id: 'sw1', label: 'Switch 1', shape: 'rounded' as const, position: { x: 300, y: 100 } },
        ],
        [
          'left',
          { id: 'left', label: 'Left', shape: 'rounded' as const, position: { x: 100, y: 300 } },
        ],
        [
          'right',
          { id: 'right', label: 'Right', shape: 'rounded' as const, position: { x: 500, y: 300 } },
        ],
      ])
      // Declare in "wrong" insertion order (right peer first) — the
      // sort must put the left-peer port first.
      const links: Link[] = [
        { from: { node: 'sw1', port: 'A' }, to: { node: 'right', port: 'eth0' } },
        { from: { node: 'sw1', port: 'B' }, to: { node: 'left', port: 'eth0' } },
      ]
      const ports = placePorts(nodes, links, 'TB')
      const pa = ports.get('sw1:A')
      const pb = ports.get('sw1:B')
      // B's peer (x=100) is left of A's peer (x=500), so B should be
      // on the left side of sw1.
      expect(pb.absolutePosition.x).toBeLessThan(pa.absolutePosition.x)
    })

    it('respects explicit order override regardless of peer position', () => {
      const nodes = new Map([
        [
          'sw1',
          { id: 'sw1', label: 'Switch 1', shape: 'rounded' as const, position: { x: 300, y: 100 } },
        ],
        [
          'left',
          { id: 'left', label: 'Left', shape: 'rounded' as const, position: { x: 100, y: 300 } },
        ],
        [
          'right',
          { id: 'right', label: 'Right', shape: 'rounded' as const, position: { x: 500, y: 300 } },
        ],
      ])
      // Pin A (peer on right) to order=0 (first) and B (peer on left)
      // to order=1 (second). The peer-position auto-sort would put B
      // first; the override should override that.
      nodes.set('sw1', {
        ...nodes.get('sw1'),
        ports: [
          { id: 'A', label: 'A', connectors: [], placement: { order: 0 } },
          { id: 'B', label: 'B', connectors: [], placement: { order: 1 } },
        ],
      })
      const links: Link[] = [
        { from: { node: 'sw1', port: 'A' }, to: { node: 'right', port: 'eth0' } },
        { from: { node: 'sw1', port: 'B' }, to: { node: 'left', port: 'eth0' } },
      ]
      const ports = placePorts(nodes, links, 'TB')
      const pa = ports.get('sw1:A')
      const pb = ports.get('sw1:B')
      expect(pa.absolutePosition.x).toBeLessThan(pb.absolutePosition.x)
    })

    it('mixes pinned and auto ports — pinned first, auto fills the rest', () => {
      const nodes = new Map([
        [
          'sw1',
          { id: 'sw1', label: 'Switch 1', shape: 'rounded' as const, position: { x: 300, y: 100 } },
        ],
        ['p1', { id: 'p1', label: 'P1', shape: 'rounded' as const, position: { x: 100, y: 300 } }],
        ['p2', { id: 'p2', label: 'P2', shape: 'rounded' as const, position: { x: 200, y: 300 } }],
        ['p3', { id: 'p3', label: 'P3', shape: 'rounded' as const, position: { x: 500, y: 300 } }],
      ])
      // Only C is pinned (order=0); A and B auto-sort by peer x.
      nodes.set('sw1', {
        ...nodes.get('sw1'),
        ports: [{ id: 'C', label: 'C', connectors: [], placement: { order: 0 } }],
      })
      const links: Link[] = [
        { from: { node: 'sw1', port: 'A' }, to: { node: 'p3', port: 'eth0' } }, // peer x=500
        { from: { node: 'sw1', port: 'B' }, to: { node: 'p1', port: 'eth0' } }, // peer x=100
        { from: { node: 'sw1', port: 'C' }, to: { node: 'p2', port: 'eth0' } }, // peer x=200, pinned first
      ]
      const ports = placePorts(nodes, links, 'TB')
      const pc = ports.get('sw1:C')
      const pb = ports.get('sw1:B')
      const pa = ports.get('sw1:A')
      // C pinned first (leftmost), then B (smaller peer x), then A (larger peer x).
      expect(pc.absolutePosition.x).toBeLessThan(pb.absolutePosition.x)
      expect(pb.absolutePosition.x).toBeLessThan(pa.absolutePosition.x)
    })
  })
})
