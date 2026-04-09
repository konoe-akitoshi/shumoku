/**
 * Dev entry point — test the renderer with sample data
 */

import type { NetworkGraph } from '@shumoku/core'
import { computeNetworkLayout } from '@shumoku/core'
import { mount } from 'svelte'
import ShumokuRenderer from './components/ShumokuRenderer.svelte'

const testGraph: NetworkGraph = {
  name: 'Test',
  nodes: [
    { id: 'sw1', label: 'Switch 1', type: 'l2-switch' },
    { id: 'sw2', label: 'Switch 2', type: 'l2-switch' },
    { id: 'srv1', label: 'Server 1', type: 'server' },
  ],
  links: [
    {
      id: 'link1',
      from: { node: 'sw1', port: 'eth0' },
      to: { node: 'sw2', port: 'eth0' },
    },
    {
      id: 'link2',
      from: { node: 'sw2', port: 'eth1' },
      to: { node: 'srv1', port: 'eth0' },
    },
  ],
}

async function main() {
  const { resolved } = await computeNetworkLayout(testGraph)

  mount(ShumokuRenderer, {
    target: document.getElementById('app')!,
    props: {
      layout: resolved,
      graph: testGraph,
    },
  })
}

main()
