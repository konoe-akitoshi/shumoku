import type { NetworkGraph } from '@shumoku/core'
import { describe, expect, it } from 'vitest'
import { renderGraphToHtml } from './pipeline.js'

describe('HTML pipeline', () => {
  it('forwards the resolved layout to the canonical renderer', async () => {
    const graph: NetworkGraph = {
      version: '1',
      name: 'Pipeline',
      nodes: [{ id: 'node', label: 'Node' }],
      links: [],
    }

    const html = await renderGraphToHtml(graph)

    expect(html).toContain('style="background: transparent;"')
    expect(html).toContain('data-id="node"')
  })
})
