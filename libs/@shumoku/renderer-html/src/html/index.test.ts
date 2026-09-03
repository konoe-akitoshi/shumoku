import { computeNetworkLayout, DeviceType, type NetworkGraph } from '@shumoku/core'
import { describe, expect, it } from 'vitest'
import { render, renderHierarchical } from './index.js'

const graph: NetworkGraph = {
  version: '1',
  name: 'HTML renderer',
  nodes: [
    {
      id: 'router',
      label: 'Router',
      parent: 'site',
      spec: {
        kind: 'hardware',
        type: DeviceType.Router,
        vendor: 'Shumoku',
        model: 'R1',
      },
      ports: [{ id: 'uplink', label: 'Gi0/1', connectors: [] }],
    },
    {
      id: 'switch',
      label: 'Switch',
      parent: 'site',
      ports: [{ id: 'uplink', label: 'Gi0/48', connectors: [] }],
    },
  ],
  links: [
    {
      id: 'uplink',
      from: { node: 'router', port: 'uplink' },
      to: { node: 'switch', port: 'uplink' },
      vlan: [10],
    },
  ],
  subgraphs: [{ id: 'site', label: 'Site', file: 'site.yaml' }],
}

describe('standalone HTML themes', () => {
  it('emits shared theme variables and activates the dark theme', async () => {
    const { layout, resolved } = await computeNetworkLayout(graph)

    const html = render(graph, layout, { resolved, theme: 'dark' })

    expect(html).toContain('<body class="dark">')
    expect(html).toContain('--shumoku-text-secondary: #94a3b8;')
  })

  it('uses the canonical static SVG while preserving interactive DOM metadata', async () => {
    const { layout, resolved } = await computeNetworkLayout(graph)

    const html = render(graph, layout, { resolved })

    expect(html).toContain('<svg xmlns="http://www.w3.org/2000/svg"')
    expect(html).toContain('style="background: transparent;"')
    expect(html).toContain('data-device-vendor="Shumoku"')
    expect(html).toContain('data-device-model="R1"')
    expect(html).toContain('data-port-device="router"')
    expect(html).toContain('data-link-from="router:uplink"')
    expect(html).toContain('data-link-to="switch:uplink"')
    expect(html).toContain('data-link-vlan="10"')
    expect(html).toContain('class="link-hit link-hit-area"')
    expect(html).toContain('class="port-hit"')
    expect(html).toContain('data-has-sheet="true"')
    expect(html).toContain('data-sheet-id="site"')
  })

  it('uses the canonical renderer for every resolved hierarchical sheet', async () => {
    const graphWithoutFile: NetworkGraph = {
      ...graph,
      subgraphs: graph.subgraphs?.map(({ file: _file, ...subgraph }) => subgraph),
    }
    const root = await computeNetworkLayout(graphWithoutFile)
    const childGraph: NetworkGraph = {
      ...graph,
      name: 'Child',
      subgraphs: undefined,
      nodes: graph.nodes.map((node) => ({ ...node, parent: undefined })),
    }
    const child = await computeNetworkLayout(childGraph)

    const html = renderHierarchical(
      new Map([
        ['root', { graph: graphWithoutFile, layout: root.layout, resolved: root.resolved }],
        ['site', { graph: childGraph, layout: child.layout, resolved: child.resolved }],
      ]),
    )

    expect(html.match(/style="background: transparent;"/g)).toHaveLength(2)
    expect(html).toContain('data-sheet-id="root"')
    expect(html).toContain('data-sheet-id="site"')
    expect(html).toContain('data-has-sheet="true"')
  })
})
