import { computeNetworkLayout, type NetworkGraph } from '@shumoku/core'
import { describe, expect, it } from 'vitest'
import type { ParsedTopology } from '../services/topology.js'
import { buildTopologyExport } from './topology-queries.js'

const graph: NetworkGraph = {
  version: '1',
  name: 'Core Network',
  nodes: [
    { id: 'router', label: 'Router', rank: 0 },
    { id: 'switch', label: 'Switch', rank: 1 },
  ],
  links: [{ id: 'uplink', from: { node: 'router' }, to: { node: 'switch' } }],
}

const hierarchicalGraph: NetworkGraph = {
  version: '1',
  name: 'Campus',
  nodes: [
    { id: 'core', label: 'Core', rank: 0 },
    { id: 'branch-switch', label: 'Branch switch', parent: 'branch', rank: 1 },
  ],
  links: [{ id: 'branch-uplink', from: { node: 'core' }, to: { node: 'branch-switch' } }],
  subgraphs: [{ id: 'branch', label: 'Branch' }],
}

async function parsedTopology(input: NetworkGraph = graph): Promise<ParsedTopology> {
  const { layout, resolved } = await computeNetworkLayout(input)
  return {
    id: 'topology-1',
    name: 'Core / Network',
    graph: input,
    layout,
    resolved,
    iconDimensions: new Map(),
    metrics: { nodes: {}, links: {}, timestamp: 1 },
  }
}

describe('buildTopologyExport', () => {
  it('exports canonical SVG with a filesystem-safe filename', async () => {
    const artifact = await buildTopologyExport(await parsedTopology(), { format: 'svg' })

    expect(artifact?.contentType).toBe('image/svg+xml')
    expect(artifact?.filename).toBe('Core-Network.svg')
    expect(artifact?.body).toEqual(expect.stringContaining('class="node"'))
  })

  it('exports PNG at the requested scale', async () => {
    const artifact = await buildTopologyExport(await parsedTopology(), {
      format: 'png',
      scale: 1,
    })

    expect(artifact?.contentType).toBe('image/png')
    expect(artifact?.body).toBeInstanceOf(Uint8Array)
    expect((artifact?.body as Uint8Array).subarray(0, 8)).toEqual(
      new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    )
  })

  it('exports standalone interactive HTML', async () => {
    const artifact = await buildTopologyExport(await parsedTopology(), { format: 'html' })

    expect(artifact?.contentType).toBe('text/html')
    expect(artifact?.filename).toBe('Core-Network.html')
    expect(artifact?.body).toEqual(expect.stringContaining('<!DOCTYPE html>'))
    expect(artifact?.body).toEqual(expect.stringContaining('ShumokuInteractive'))
  })

  it('exports a selected sheet and keeps every sheet in interactive HTML', async () => {
    const parsed = await parsedTopology(hierarchicalGraph)
    const svg = await buildTopologyExport(parsed, { format: 'svg', sheet: 'branch' })
    const html = await buildTopologyExport(parsed, { format: 'html' })

    expect(svg?.filename).toBe('Core-Network-Branch.svg')
    expect(svg?.body).toEqual(expect.stringContaining('data-id="branch-switch"'))
    expect(html?.body).toEqual(expect.stringContaining('data-sheet-id="root"'))
    expect(html?.body).toEqual(expect.stringContaining('data-sheet-id="branch"'))
  })

  it('rejects an unknown hierarchical sheet', async () => {
    const artifact = await buildTopologyExport(await parsedTopology(), {
      format: 'svg',
      sheet: 'missing',
    })

    expect(artifact).toBeNull()
  })
})
