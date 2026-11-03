import { type NetworkGraph, sampleNetworkModel } from '@shumoku/core'
import { drawNetworkScene } from '@shumoku/renderer/static'
import { describe, expect, it } from 'vitest'
import type { ParsedTopology } from '../services/topology.js'
import { buildRenderOutput, buildTopologyExport } from './topology-queries.js'

function parsedTopology(): ParsedTopology {
  const model = sampleNetworkModel()
  return {
    id: 'topology-1',
    name: 'Core / Network',
    graph: { version: '1', name: 'Core Network', nodes: [], links: [] } satisfies NetworkGraph,
    scene: drawNetworkScene(model),
    metrics: { nodes: {}, links: {}, timestamp: 1 },
  }
}

describe('buildTopologyExport', () => {
  it('exports the drawn SVG with a filesystem-safe filename', async () => {
    const artifact = await buildTopologyExport(parsedTopology(), { format: 'svg' })

    expect(artifact.contentType).toBe('image/svg+xml')
    expect(artifact.filename).toBe('Core-Network.svg')
    expect(artifact.body).toEqual(expect.stringContaining('class="node"'))
  })

  it('exports PNG at the requested scale', async () => {
    const artifact = await buildTopologyExport(parsedTopology(), { format: 'png', scale: 1 })

    expect(artifact.contentType).toBe('image/png')
    expect(artifact.body).toBeInstanceOf(Uint8Array)
    expect((artifact.body as Uint8Array).subarray(0, 8)).toEqual(
      new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    )
  })

  it('exports standalone interactive HTML', async () => {
    const artifact = await buildTopologyExport(parsedTopology(), { format: 'html' })

    expect(artifact.contentType).toBe('text/html')
    expect(artifact.filename).toBe('Core-Network.html')
    expect(artifact.body).toEqual(expect.stringContaining('<!DOCTYPE html>'))
    expect(artifact.body).toEqual(expect.stringContaining('ShumokuInteractive'))
  })
})

describe('buildRenderOutput', () => {
  it('renders the scene whole, with a view box around its bounds', () => {
    const parsed = parsedTopology()
    const output = buildRenderOutput(parsed)

    expect(output.svg).toContain('class="node"')
    expect(output.viewBox.width).toBe(parsed.scene.bounds.width + 100)
  })
})
