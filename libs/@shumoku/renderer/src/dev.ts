/**
 * Dev entry point — render full sampleNetwork (same as playground)
 */

import {
  computeNetworkLayout,
  type Link,
  lightTheme,
  sampleNetworkModel,
  toNetworkGraph,
} from '@shumoku/core'
import { mount, unmount } from 'svelte'
import ShumokuRenderer from './components/ShumokuRenderer.svelte'

let currentInstance: ReturnType<typeof mount> | null = null
let currentMode: 'view' | 'edit' = 'edit'

async function parseSampleNetwork() {
  return toNetworkGraph(sampleNetworkModel())
}

async function renderGraph() {
  const target = document.getElementById('app')
  if (!target) return

  if (currentInstance) {
    unmount(currentInstance)
    currentInstance = null
  }

  const graph = await parseSampleNetwork()
  const { resolved } = await computeNetworkLayout(graph)

  currentInstance = mount(ShumokuRenderer, {
    target,
    props: {
      layout: resolved,
      graph,
      theme: lightTheme,
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
  await renderGraph()
})
document.body.appendChild(btn)

// Listen for graph data from parent (iframe embedding)
window.addEventListener('message', async (event) => {
  if (event.data?.type === 'shumoku:graph') {
    await renderGraph()
  }
})

if (window.parent !== window) {
  window.parent.postMessage({ type: 'shumoku:ready' }, '*')
}

renderGraph()
