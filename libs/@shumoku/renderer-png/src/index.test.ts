import { darkTheme, type NetworkGraph } from '@shumoku/core'
import { prepareRender } from '@shumoku/renderer-svg'
import { describe, expect, it } from 'vitest'
import { renderGraphToPng, renderPng } from './index.js'

const graph: NetworkGraph = {
  version: '1',
  name: 'PNG renderer',
  nodes: [
    { id: 'a', label: 'Router A', rank: 0 },
    { id: 'b', label: 'Switch B', rank: 1 },
  ],
  links: [{ id: 'uplink', from: { node: 'a' }, to: { node: 'b' }, label: 'Uplink' }],
}

describe('renderGraphToPng', () => {
  it('renders a graph through the canonical resolved-layout path', async () => {
    const output = await renderGraphToPng(graph, { scale: 1, loadSystemFonts: false })

    expect(output.subarray(0, 8)).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    )
  })

  it('honors graph theme and an explicit theme override', async () => {
    const darkFromGraph = await renderGraphToPng(
      { ...graph, settings: { ...graph.settings, theme: 'dark' } },
      { scale: 1, loadSystemFonts: false },
    )
    const darkFromOption = await renderGraphToPng(graph, {
      scale: 1,
      loadSystemFonts: false,
      theme: darkTheme,
    })

    expect(darkFromGraph).toEqual(darkFromOption)
  })

  it('uses the canonical renderer for prepared resolved layouts', async () => {
    const prepared = await prepareRender(graph)
    const fromPrepared = await renderPng(prepared, { scale: 1, loadSystemFonts: false })
    const fromGraph = await renderGraphToPng(graph, { scale: 1, loadSystemFonts: false })

    expect(fromPrepared).toEqual(fromGraph)
  })
})
