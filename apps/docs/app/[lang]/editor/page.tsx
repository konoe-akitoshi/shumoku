'use client'

import { computeNetworkLayout, lightTheme, parser, sampleNetwork } from '@shumoku/core'
import { useEffect, useRef, useState } from 'react'

function parseCampusGraph() {
  const campusYaml = sampleNetwork.find((f) => f.name === 'campus.yaml')
  if (!campusYaml) throw new Error('campus.yaml not found')
  return parser.parse(campusYaml.content).graph
}

export default function EditorPage() {
  const wcRef = useRef<HTMLElement | null>(null)
  const [status, setStatus] = useState('Loading...')

  useEffect(() => {
    async function init() {
      try {
        setStatus('Loading renderer...')
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
        const graph = parseCampusGraph()
        const { resolved } = await computeNetworkLayout(graph)

        setStatus('Setting layout...')
        await customElements.whenDefined('shumoku-renderer')

        const el = wcRef.current
        if (el) {
          ;(el as any).graph = graph
          ;(el as any).layout = resolved
          ;(el as any).theme = lightTheme
          ;(el as any).mode = 'edit'
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
          {status} — Drag nodes, add ports, draw links.
        </p>
      </div>
      <div style={{ flex: 1, background: '#f8fafc' }}>
        {/* @ts-expect-error WebComponent */}
        <shumoku-renderer ref={wcRef} style={{ width: '100%', height: '100%', display: 'block' }} />
      </div>
    </div>
  )
}
