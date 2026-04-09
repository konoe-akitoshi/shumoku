/**
 * Dev/embed entry point
 * Accepts graph data via:
 * 1. Built-in test graph (default)
 * 2. postMessage from parent window (for iframe embedding)
 */

import type { NetworkGraph } from '@shumoku/core'
import { computeNetworkLayout } from '@shumoku/core'
import { mount, unmount } from 'svelte'
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

let currentInstance: ReturnType<typeof mount> | null = null

async function renderGraph(graph: NetworkGraph) {
  const target = document.getElementById('app')
  if (!target) return

  // Unmount previous instance
  if (currentInstance) {
    unmount(currentInstance)
    currentInstance = null
  }

  const { resolved } = await computeNetworkLayout(graph)

  currentInstance = mount(ShumokuRenderer, {
    target,
    props: {
      layout: resolved,
      graph,
    },
  })
}

// Listen for graph data from parent (iframe embedding)
window.addEventListener('message', async (event) => {
  if (event.data?.type === 'shumoku:graph') {
    await renderGraph(event.data.graph as NetworkGraph)
  }
})

// Signal ready to parent
if (window.parent !== window) {
  window.parent.postMessage({ type: 'shumoku:ready' }, '*')
}

// Default: render test graph
renderGraph(testGraph)
