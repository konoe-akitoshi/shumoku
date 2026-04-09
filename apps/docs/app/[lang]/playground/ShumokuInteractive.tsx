'use client'

import type { NetworkGraph, ResolvedLayout } from '@shumoku/core'
import { computeNetworkLayout } from '@shumoku/core'
import { useEffect, useRef, useState } from 'react'

// Load WebComponent script once
let wcLoaded = false
function loadWebComponent() {
  if (wcLoaded) return
  wcLoaded = true
  const script = document.createElement('script')
  script.type = 'module'
  script.src = '/renderer/shumoku-renderer.js'
  document.head.appendChild(script)
}

export function ShumokuInteractive({ graph }: { graph: NetworkGraph | null }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [layout, setLayout] = useState<ResolvedLayout | null>(null)

  useEffect(() => {
    loadWebComponent()
  }, [])

  useEffect(() => {
    if (!graph) {
      setLayout(null)
      return
    }
    let cancelled = false
    computeNetworkLayout(graph).then(({ resolved }) => {
      if (!cancelled) setLayout(resolved)
    })
    return () => {
      cancelled = true
    }
  }, [graph])

  useEffect(() => {
    if (!containerRef.current || !layout) return
    // Set layout on WebComponent
    const el = containerRef.current.querySelector('shumoku-renderer') as any
    if (el) {
      el.layout = layout
    }
  }, [layout])

  if (!graph) {
    return (
      <div className="flex h-full items-center justify-center text-neutral-500">
        Parse YAML to see interactive preview
      </div>
    )
  }

  return (
    <div ref={containerRef} className="h-full w-full">
      {/* @ts-expect-error WebComponent */}
      <shumoku-renderer style={{ width: '100%', height: '100%' }} />
    </div>
  )
}
