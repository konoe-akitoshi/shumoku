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
