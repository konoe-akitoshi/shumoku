'use client'

import type { NetworkGraph } from '@shumoku/core'
import { computeNetworkLayout } from '@shumoku/core'
import { useEffect, useRef, useState } from 'react'

const sampleGraph: NetworkGraph = {
  name: 'Sample',
  nodes: [
    { id: 'rt1', label: 'Router 1', type: 'router' },
    { id: 'sw1', label: 'Switch 1', type: 'l2-switch' },
    { id: 'sw2', label: 'Switch 2', type: 'l2-switch' },
    { id: 'srv1', label: 'Server 1', type: 'server' },
    { id: 'srv2', label: 'Server 2', type: 'server' },
  ],
  links: [
    {
      id: 'l1',
      from: { node: 'rt1', port: 'eth0' },
      to: { node: 'sw1', port: 'uplink' },
      bandwidth: '10G',
    },
    {
      id: 'l2',
      from: { node: 'rt1', port: 'eth1' },
      to: { node: 'sw2', port: 'uplink' },
      bandwidth: '10G',
    },
    {
      id: 'l3',
      from: { node: 'sw1', port: 'eth1' },
      to: { node: 'srv1', port: 'eth0' },
      bandwidth: '1G',
    },
    {
      id: 'l4',
      from: { node: 'sw2', port: 'eth1' },
      to: { node: 'srv2', port: 'eth0' },
      bandwidth: '1G',
    },
  ],
}

export default function EditorPage() {
  const wcRef = useRef<HTMLElement | null>(null)
  const [status, setStatus] = useState('Loading...')

  useEffect(() => {
    // Dynamic import of the WebComponent bundle
    async function init() {
      try {
        setStatus('Loading renderer...')
        // Load WC module via script tag (dynamic import doesn't work with public paths in Next.js)
        await new Promise<void>((resolve, reject) => {
          if (customElements.get('shumoku-renderer')) {
            resolve()
            return
          }
          const script = document.createElement('script')
          script.type = 'module'
          script.src = '/renderer/shumoku-renderer.js'
          script.onload = () => resolve()
          script.onerror = () => reject(new Error('Failed to load renderer'))
          document.head.appendChild(script)
        })
        setStatus('Computing layout...')

        const { resolved } = await computeNetworkLayout(sampleGraph)
        setStatus('Setting layout...')

        // Wait for custom element to be available
        await customElements.whenDefined('shumoku-renderer')

        const el = wcRef.current
        if (el) {
          // Set graph first, then layout (layout triggers render)
          ;(el as any).graph = sampleGraph
          ;(el as any).layout = resolved
          setStatus('Ready')
        } else {
          setStatus('Error: element not found')
        }
      } catch (e) {
        setStatus(`Error: ${e instanceof Error ? e.message : String(e)}`)
        console.error('Editor init error:', e)
      }
    }

    init()
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <div style={{ padding: '16px', borderBottom: '1px solid #e5e7eb', background: '#fff' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 600 }}>Network Editor</h1>
        <p style={{ fontSize: '13px', color: '#94a3b8', marginTop: '4px' }}>
          {status} — Drag nodes to rearrange.
        </p>
      </div>
      <div style={{ flex: 1, background: '#f8fafc' }}>
        {/* @ts-expect-error WebComponent */}
        <shumoku-renderer ref={wcRef} style={{ width: '100%', height: '100%', display: 'block' }} />
      </div>
    </div>
  )
}
