import { darkTheme, readNetworkModel } from '@shumoku/core'
import { describe, expect, it } from 'vitest'
import { renderNetworkSvg } from './index.js'

const model = readNetworkModel(`
nodes:
  - { id: core, label: Core, type: router }
  - { id: sw, label: Switch, type: l2-switch }
links:
  - endpoints: [{ node: core, port: ge-0/0/1 }, { node: sw, port: ge-0/0/24 }]
`)

describe('renderNetworkSvg', () => {
  it('draws a model as a standalone SVG', () => {
    const svg = renderNetworkSvg(model)
    expect(svg).toContain('<svg')
    expect(svg).toContain('Core')
    expect(svg).toContain('ge-0/0/24')
  })

  it('draws in the theme it is given', () => {
    const svg = renderNetworkSvg(model, { theme: darkTheme })
    expect(svg).toContain(darkTheme.colors.textSecondary)
  })

  it('draws the same model the same way twice', () => {
    expect(renderNetworkSvg(model)).toBe(renderNetworkSvg(model))
  })

  it('escapes a URL icon so it cannot break out of the href attribute', () => {
    const evil = readNetworkModel(`
nodes:
  - { id: n, label: N }
links: []
`)
    const svg = renderNetworkSvg({
      ...evil,
      drawing: { nodes: { n: { icon: 'https://x"><script>bad()</script>' } } },
    })
    expect(svg).not.toContain('<script>bad()')
  })
})

describe('renderGraphToSvg', () => {
  it('draws a graph through the same engine, in the graph theme', async () => {
    const { renderGraphToSvg } = await import('./index.js')
    const svg = await renderGraphToSvg({
      version: '1',
      nodes: [{ id: 'n', label: 'Node' }],
      links: [],
      settings: { theme: 'dark' },
    })
    expect(svg).toContain(darkTheme.colors.textSecondary)
  })
})
