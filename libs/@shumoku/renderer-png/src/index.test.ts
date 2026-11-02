import { darkTheme, readNetworkModel } from '@shumoku/core'
import { describe, expect, it } from 'vitest'
import { renderNetworkPng } from './index.js'

const model = readNetworkModel(`
nodes:
  - { id: a, label: Router A, type: router }
  - { id: b, label: Switch B, type: l2-switch }
links:
  - endpoints: [{ node: a }, { node: b }]
`)

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

describe('renderNetworkPng', () => {
  it('rasterizes the drawn model', async () => {
    const output = await renderNetworkPng(model, { scale: 1, loadSystemFonts: false })
    expect(output.subarray(0, 8)).toEqual(PNG)
  })

  it('draws in the theme it is given', async () => {
    const light = await renderNetworkPng(model, { scale: 1, loadSystemFonts: false })
    const dark = await renderNetworkPng(model, {
      scale: 1,
      loadSystemFonts: false,
      theme: darkTheme,
    })
    expect(dark.equals(light)).toBe(false)
  })
})

describe('renderGraphToPng', () => {
  it('rasterizes a graph', async () => {
    const { renderGraphToPng } = await import('./index.js')
    const out = await renderGraphToPng(
      { version: '1', nodes: [{ id: 'n', label: 'Node' }], links: [] },
      { scale: 1, loadSystemFonts: false },
    )
    expect(out.subarray(0, 8)).toEqual(PNG)
  })
})
