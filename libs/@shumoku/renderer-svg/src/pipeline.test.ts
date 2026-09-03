import { darkTheme, type NetworkGraph } from '@shumoku/core'
import { describe, expect, it } from 'vitest'
import { prepareRender, renderEmbeddable, renderGraphToSvg, renderSvg } from './pipeline.js'

const graph: NetworkGraph = {
  version: '1',
  name: 'SVG pipeline',
  nodes: [{ id: 'node', label: 'Node' }],
  links: [],
}

describe('canonical SVG pipeline', () => {
  it('uses the canonical renderer from the graph convenience API', async () => {
    const svg = await renderGraphToSvg(graph, { theme: darkTheme })

    expect(svg).toContain('style="background: transparent;"')
    expect(svg).toContain(darkTheme.colors.textSecondary)
  })

  it('uses the canonical renderer for prepared and embeddable resolved layouts', async () => {
    const prepared = await prepareRender(graph)

    expect(await renderSvg(prepared)).toContain('style="background: transparent;"')
    expect(renderEmbeddable(prepared).svg).toContain('style="background: transparent;"')
  })
})
