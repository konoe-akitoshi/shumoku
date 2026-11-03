import { sampleNetworkModel } from '@shumoku/core'
import { describe, expect, it } from 'vitest'
import { renderGraphToHtml, renderHtml, renderSceneHtml } from './pipeline.js'

describe('HTML pipeline', () => {
  const model = sampleNetworkModel()

  it('wraps the drawn SVG in a page with the interactive runtime hooks', () => {
    const html = renderHtml(model, { title: 'Sample' })

    expect(html).toContain('<title>Sample</title>')
    expect(html).toContain('<div class="container" id="container">')
    expect(html).toContain('class="link-group"')
    expect(html).toContain('data-id=')
    expect(html).not.toContain('data-has-sheet')
  })

  it('emits shared theme variables and activates the dark theme', () => {
    const html = renderHtml(model, { theme: 'dark' })

    expect(html).toContain('<body class="dark">')
    expect(html).toContain('--shumoku-text-secondary: #94a3b8;')
  })

  it('draws a graph through the same path', async () => {
    const html = await renderGraphToHtml({
      version: '1',
      name: 'Pipeline',
      nodes: [{ id: 'node', label: 'Node' }],
      links: [],
    })

    expect(html).toContain('data-id="node"')
  })

  it('takes a scene drawn elsewhere', async () => {
    const { drawNetworkScene } = await import('@shumoku/renderer/static')
    const html = renderSceneHtml(drawNetworkScene(model), { branding: false, toolbar: false })

    expect(html).not.toContain('class="branding"')
    expect(html).not.toContain('class="toolbar"')
  })
})
