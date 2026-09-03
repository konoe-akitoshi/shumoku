import {
  computeNetworkLayout,
  DeviceType,
  darkTheme,
  lightTheme,
  type NetworkGraph,
  type ResolvedLayout,
  type Theme,
} from '@shumoku/core'
import { render } from 'svelte/server'
import { describe, expect, it } from 'vitest'
import SvgCanvas from './components/svg/SvgCanvas.svelte'
import { themeToColors } from './lib/render-colors.js'
import { renderSvgString } from './static.js'

function elementAfter(markup: string, selector: string, tag: string): string {
  const selectorStart = markup.indexOf(selector)
  expect(selectorStart).toBeGreaterThanOrEqual(0)
  const start = markup.indexOf(`<${tag}`, selectorStart)
  expect(start).toBeGreaterThanOrEqual(0)
  return markup.slice(start, markup.indexOf('>', start) + 1)
}

function attribute(element: string, name: string): string {
  const match = element.match(new RegExp(`${name}="([^"]*)"`))
  expect(match?.[1], `${name} missing from ${element}`).toBeDefined()
  return match?.[1] ?? ''
}

function primaryLinkPath(markup: string, edgeId: string): string {
  return elementAfter(markup, `data-link-id="${edgeId}"`, 'path')
}

function portBox(markup: string, portId: string): string {
  const groupStart = markup.indexOf(`data-port="${portId}"`)
  expect(groupStart).toBeGreaterThanOrEqual(0)
  const classStart = markup.indexOf('class="port-box"', groupStart)
  expect(classStart).toBeGreaterThanOrEqual(0)
  const start = markup.lastIndexOf('<rect', classStart)
  return markup.slice(start, markup.indexOf('>', classStart) + 1)
}

function haHullPath(markup: string): string {
  return elementAfter(markup, 'class="ha-hull"', 'path')
}

function renderInteractive(layout: ResolvedLayout, theme: Theme): string {
  return render(SvgCanvas, {
    props: {
      nodes: layout.nodes,
      ports: layout.ports,
      edges: layout.edges,
      subgraphs: layout.subgraphs,
      bounds: layout.bounds,
      colors: themeToColors(theme),
      theme,
    },
  }).body
}

describe('static and interactive renderer parity', () => {
  it.each([
    ['light', lightTheme],
    ['dark', darkTheme],
  ] as const)('keeps resolved geometry and semantic elements aligned in %s mode', async (_name, theme) => {
    const graph: NetworkGraph = {
      version: '1',
      name: 'Parity topology',
      nodes: [
        {
          id: 'router-a',
          label: ['Router A', 'Primary'],
          rank: 0,
          spec: { kind: 'hardware', type: DeviceType.Router },
          ports: [
            { id: 'ha', label: 'HA', connectors: [] },
            { id: 'lan', label: 'Gi0/1', connectors: [] },
          ],
        },
        {
          id: 'router-b',
          label: 'Router B',
          rank: 0,
          spec: { kind: 'hardware', type: DeviceType.Router },
          ports: [{ id: 'ha', label: 'HA', connectors: [] }],
        },
        {
          id: 'switch',
          label: 'Access Switch',
          rank: 1,
          spec: { kind: 'hardware', type: DeviceType.L2Switch },
          ports: [{ id: 'uplink', label: 'Gi0/48', connectors: [] }],
        },
      ],
      links: [
        {
          id: 'ha-link',
          from: { node: 'router-a', port: 'ha' },
          to: { node: 'router-b', port: 'ha' },
          label: 'Heartbeat',
          redundancy: 'ha',
        },
        {
          id: 'uplink',
          from: { node: 'router-a', port: 'lan' },
          to: { node: 'switch', port: 'uplink' },
          label: 'Uplink',
          vlan: [10, 20],
        },
      ],
    }
    const { resolved } = await computeNetworkLayout(graph, { composite: true })
    const interactive = renderInteractive(resolved, theme)
    const staticallyRendered = renderSvgString(resolved, { theme })

    expect(resolved.edges.get('ha-link')?.coupling).toBe(true)
    for (const node of resolved.nodes.values()) {
      expect(interactive).toContain(`data-id="${node.id}"`)
      expect(staticallyRendered).toContain(`data-id="${node.id}"`)
    }
    for (const port of resolved.ports.values()) {
      const selector = `data-port="${port.id}"`
      expect(interactive).toContain(selector)
      expect(staticallyRendered).toContain(selector)
      const interactivePort = portBox(interactive, port.id)
      const staticPort = portBox(staticallyRendered, port.id)
      for (const name of ['x', 'y', 'width', 'height', 'rx']) {
        expect(attribute(staticPort, name)).toBe(attribute(interactivePort, name))
      }
    }
    for (const edge of resolved.edges.values()) {
      const interactivePath = primaryLinkPath(interactive, edge.id)
      const staticPath = primaryLinkPath(staticallyRendered, edge.id)
      for (const name of ['d', 'stroke', 'stroke-width']) {
        expect(attribute(staticPath, name)).toBe(attribute(interactivePath, name))
      }
    }

    const interactiveHull = haHullPath(interactive)
    const staticHull = haHullPath(staticallyRendered)
    expect(attribute(staticHull, 'd')).toBe(attribute(interactiveHull, 'd'))
    expect(interactive).toContain('class="ha-hull"')
    expect(staticallyRendered).toContain('class="ha-hull"')
  })
})
