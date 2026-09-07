import type { NetworkGraph } from '@shumoku/core'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { generateContent, renderFiles } from './render'

const pipeline = vi.hoisted(() => ({ prepare: vi.fn(), svg: vi.fn() }))
vi.mock('@shumoku/renderer-svg', () => ({
  prepareRender: pipeline.prepare,
  renderSvg: pipeline.svg,
}))

beforeEach(() => {
  pipeline.prepare.mockReset().mockImplementation(async (graph: NetworkGraph) => ({ graph }))
  pipeline.svg.mockReset().mockResolvedValue('<svg />')
})

describe('Playground in-memory files', () => {
  it('renders a single file and reuses its prepared result for SVG export', async () => {
    const result = await renderFiles([
      { name: 'main.yaml', content: 'name: Example\nnodes: []\nlinks: []' },
    ])
    expect(result.prepared.graph.name).toBe('Example')
    expect(result.sheets).toBeNull()
    expect(await generateContent(result, 'svg')).toBe('<svg />')
    expect(pipeline.svg).toHaveBeenCalledWith(result.prepared)
  })
  it('resolves child sheets from the editor files', async () => {
    const result = await renderFiles([
      {
        name: 'main.yaml',
        content: 'name: Root\nsubgraphs:\n  - id: child\n    file: "./child.yaml"\n',
      },
      {
        name: 'child.yaml',
        content: 'name: Child\nnodes:\n  - id: router\n    type: router\nlinks: []',
      },
    ])
    expect(result.sheets?.size).toBeGreaterThan(0)
    expect(pipeline.prepare).toHaveBeenCalledOnce()
  })
  it('rejects missing main.yaml instead of exporting stale content', async () => {
    await expect(renderFiles([{ name: 'other.yaml', content: 'nodes: []' }])).rejects.toThrow(
      'main.yaml not found',
    )
    expect(pipeline.prepare).not.toHaveBeenCalled()
  })
  it('rejects malformed YAML', async () => {
    await expect(renderFiles([{ name: 'main.yaml', content: 'nodes: [' }])).rejects.toThrow()
    expect(pipeline.prepare).not.toHaveBeenCalled()
  })
  it('rejects unresolved file references even when main is the only file', async () => {
    await expect(
      renderFiles([
        { name: 'main.yaml', content: 'subgraphs:\n  - id: child\n    file: "./missing.yaml"' },
      ]),
    ).rejects.toThrow()
    expect(pipeline.prepare).not.toHaveBeenCalled()
  })
})
