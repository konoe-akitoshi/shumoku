import {
  DeviceType,
  darkTheme,
  type Node,
  type ResolvedLayout,
  type ResolvedPort,
} from '@shumoku/core'
import { describe, expect, it } from 'vitest'
import { renderSvgString } from './static.js'

describe('renderSvgString', () => {
  it('exports full escaped details while keeping address rows compact', () => {
    const node: Node = {
      id: 'router',
      label: 'Router',
      position: { x: 150, y: 100 },
      annotations: [
        { kind: 'identity', label: 'Model', value: 'RTX3510' },
        { kind: 'address', label: 'VIP', value: '10.0.0.1' },
        {
          kind: 'note',
          label: 'Description',
          value: 'First line\n<script>full details</script>',
        },
        { kind: 'status', label: 'Presence', value: 'Assumed' },
      ],
    }
    const layout: ResolvedLayout = {
      nodes: new Map([[node.id, node]]),
      ports: new Map(),
      edges: new Map(),
      subgraphs: new Map(),
      bounds: { x: 0, y: 0, width: 300, height: 200 },
    }
    const svg = renderSvgString(layout)
    expect(svg).toContain('Description: First line\n&lt;script&gt;full details&lt;/script&gt;')
    expect(svg).not.toContain('<script>')
    expect(svg).toContain('class="node-fact-key">VIP')
    expect(svg).toContain('class="node-fact-key">Description')
    expect(svg).toContain('stroke-dasharray="4 3"')
  })

  it('centres the content block in a box drawn wider than it', () => {
    const node: Node = {
      id: 'sw',
      label: 'sw',
      position: { x: 0, y: 0 },
      size: { width: 400, height: 60 },
    }
    const layout: ResolvedLayout = {
      nodes: new Map([[node.id, node]]),
      ports: new Map(),
      edges: new Map(),
      subgraphs: new Map(),
      bounds: { x: -200, y: -30, width: 400, height: 60 },
    }
    const x = Number(
      /<text x="([-\d.]+)"[^>]*class="node-label"/.exec(renderSvgString(layout))?.[1],
    )
    // Left-aligned at the start of a block centred on the node, not at the box's left padding.
    expect(x).toBeLessThan(0)
    expect(x).toBeGreaterThan(-40)
  })

  it('renders a legacy resolved port whose label is missing', () => {
    const port: ResolvedPort = {
      id: 'node:legacy-port',
      nodeId: 'node',
      label: undefined as unknown as string,
      absolutePosition: { x: 10, y: 10 },
      side: 'top',
      size: { width: 8, height: 8 },
    }
    const layout: ResolvedLayout = {
      nodes: new Map(),
      ports: new Map([[port.id, port]]),
      edges: new Map(),
      subgraphs: new Map(),
      bounds: { x: 0, y: 0, width: 20, height: 20 },
      metadata: { algorithm: 'test', duration: 0 },
    }

    expect(renderSvgString(layout)).toContain('data-port="node:legacy-port"')
  })

  it.each([
    ['URL', 'https://example.com/device.svg', '<image href="https://example.com/device.svg"'],
    ['inline', '<path d="M1 1h22v22H1z"/>', '<path d="M1 1h22v22H1z"/>'],
  ])('uses the resolved %s icon just like the interactive renderer', (_kind, icon, expected) => {
    const node: Node = {
      id: 'router',
      label: 'Router',
      position: { x: 50, y: 50 },
      size: { width: 100, height: 80 },
      spec: { kind: 'hardware', type: DeviceType.Router, icon },
    }
    const layout: ResolvedLayout = {
      nodes: new Map([[node.id, node]]),
      ports: new Map(),
      edges: new Map(),
      subgraphs: new Map(),
      bounds: { x: 0, y: 0, width: 100, height: 100 },
    }

    const svg = renderSvgString(layout)
    expect(svg).toContain(expected)
    expect(svg).toContain('data-device-type="router"')
  })

  it('applies the requested theme to static output', () => {
    const layout: ResolvedLayout = {
      nodes: new Map(),
      ports: new Map(),
      edges: new Map(),
      subgraphs: new Map(),
      bounds: { x: 0, y: 0, width: 100, height: 100 },
    }

    expect(renderSvgString(layout, { theme: darkTheme })).toContain(darkTheme.colors.textSecondary)
  })
})
