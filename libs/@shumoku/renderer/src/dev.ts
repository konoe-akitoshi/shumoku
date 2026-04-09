/**
 * Dev entry point — test the renderer with sample data
 */

import { computeNetworkLayout, DeviceType, type Link, type NetworkGraph } from '@shumoku/core'
import { mount, unmount } from 'svelte'
import ShumokuRenderer from './components/ShumokuRenderer.svelte'

const testGraph: NetworkGraph = {
  version: '1',
  name: 'Test',
  nodes: [
    { id: 'sw1', label: 'Switch 1', type: DeviceType.L2Switch, shape: 'rect' },
    { id: 'sw2', label: 'Switch 2', type: DeviceType.L2Switch, shape: 'rect' },
    { id: 'srv1', label: 'Server 1', type: DeviceType.Server, shape: 'rect' },
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
let currentMode: 'view' | 'edit' = 'edit'

async function renderGraph(graph: NetworkGraph) {
  const target = document.getElementById('app')
  if (!target) return

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
      mode: currentMode,
      onchange: (links: Link[]) => {
        console.log('Links updated:', links.length)
      },
    },
  })
}

// Mode toggle button
const btn = document.createElement('button')
btn.textContent = `Mode: ${currentMode}`
Object.assign(btn.style, {
  position: 'fixed',
  top: '12px',
  right: '12px',
  zIndex: '100',
  padding: '6px 14px',
  borderRadius: '6px',
  border: '1px solid #cbd5e1',
  background: 'white',
  cursor: 'pointer',
  fontSize: '13px',
  boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
})
btn.addEventListener('click', async () => {
  currentMode = currentMode === 'edit' ? 'view' : 'edit'
  btn.textContent = `Mode: ${currentMode}`
  await renderGraph(testGraph)
})
document.body.appendChild(btn)

// Listen for graph data from parent (iframe embedding)
window.addEventListener('message', async (event) => {
  if (event.data?.type === 'shumoku:graph') {
    await renderGraph(event.data.graph as NetworkGraph)
  }
})

if (window.parent !== window) {
  window.parent.postMessage({ type: 'shumoku:ready' }, '*')
}

renderGraph(testGraph)
