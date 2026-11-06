import { sampleNetworkModel } from '@shumoku/core'
import { render } from 'svelte/server'
import { describe, expect, it } from 'vitest'
import { drawNetworkScene } from '../draw.js'
import ShumokuRenderer from './ShumokuRenderer.svelte'

describe('ShumokuRenderer', () => {
  const scene = drawNetworkScene(sampleNetworkModel())

  it('draws the scene with the DOM contract hosts attach to', () => {
    const { body } = render(ShumokuRenderer, { props: { scene } })
    for (const { node } of scene.nodes) expect(body).toContain(`data-id="${node.id}"`)
    expect(body).toContain('class="link-group"')
    expect(body).toContain('data-port=')
    expect(body).toContain('class="viewport"')
  })

  it('fills its container rather than the size of the drawing', () => {
    const { body } = render(ShumokuRenderer, { props: { scene } })
    expect(body).toContain('width: 100%; height: 100%')
  })

  it('draws nothing without a scene', () => {
    const { body } = render(ShumokuRenderer, { props: {} })
    expect(body).not.toContain('<svg')
  })

  it('leaves out the nodes the host hides, and their ports', () => {
    const hidden = scene.nodes[0]?.node.id ?? ''
    const { body } = render(ShumokuRenderer, {
      props: { scene, hideNode: (n: { id: string }) => n.id === hidden },
    })
    expect(body).not.toContain(`data-id="${hidden}"`)
    expect(body).not.toContain(`data-port-device="${hidden}"`)
  })
})
