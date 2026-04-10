'use client'

import {
  computeNetworkLayout,
  createMemoryFileResolver,
  HierarchicalParser,
  lightTheme,
  sampleNetwork,
} from '@shumoku/core'
import { Info, Layers, MousePointer2, Network } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

// ============================================================================
// Parse
// ============================================================================

async function parseSampleNetwork() {
  const fileMap = new Map<string, string>()
  for (const f of sampleNetwork) {
    fileMap.set(f.name, f.content)
    fileMap.set(`./${f.name}`, f.content)
    fileMap.set(`/${f.name}`, f.content)
  }
  const resolver = createMemoryFileResolver(fileMap, '/')
  const hp = new HierarchicalParser(resolver)
  const mainFile = sampleNetwork.find((f) => f.name === 'main.yaml')
  if (!mainFile) throw new Error('main.yaml not found')
  return (await hp.parse(mainFile.content, '/main.yaml')).graph
}

// ============================================================================
// Grid background (CSS)
// ============================================================================

const gridStyle: React.CSSProperties = {
  backgroundImage: `
    linear-gradient(to right, #e2e8f0 1px, transparent 1px),
    linear-gradient(to bottom, #e2e8f0 1px, transparent 1px)
  `,
  backgroundSize: '20px 20px',
  backgroundPosition: 'center center',
}

// ============================================================================
// Editor
// ============================================================================

export default function EditorPage() {
  const wcRef = useRef<HTMLElement | null>(null)
  const canvasRef = useRef<HTMLDivElement | null>(null)
  const [status, setStatus] = useState('Loading...')
  const [selected, setSelected] = useState<{ id: string; type: string } | null>(null)
  const [stats, setStats] = useState({ nodes: 0, links: 0, subgraphs: 0 })

  // Pan/zoom state
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const isPanning = useRef(false)
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 })

  // WebComponent transform
  const wcTransform = `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`

  // --- Pan/Zoom handlers ---

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    const newZoom = Math.max(0.1, Math.min(5, zoom * delta))

    // Zoom toward cursor position
    const rect = canvasRef.current?.getBoundingClientRect()
    if (rect) {
      const cx = e.clientX - rect.left
      const cy = e.clientY - rect.top
      const scale = newZoom / zoom
      setPan({
        x: cx - (cx - pan.x) * scale,
        y: cy - (cy - pan.y) * scale,
      })
    }

    setZoom(newZoom)
  }, [zoom, pan])

  const onCanvasPointerDown = useCallback((e: React.PointerEvent) => {
    // Middle mouse or Space+left for panning
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      e.preventDefault()
      isPanning.current = true
      panStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y }
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    }
  }, [pan])

  const onCanvasPointerMove = useCallback((e: React.PointerEvent) => {
    if (!isPanning.current) return
    setPan({
      x: panStart.current.panX + (e.clientX - panStart.current.x),
      y: panStart.current.panY + (e.clientY - panStart.current.y),
    })
  }, [])

  const onCanvasPointerUp = useCallback((e: React.PointerEvent) => {
    if (isPanning.current) {
      isPanning.current = false
      ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
    }
  }, [])

  // --- WebComponent events ---

  useEffect(() => {
    const el = wcRef.current
    if (!el) return
    function onSelect(e: Event) {
      const { id, type } = (e as CustomEvent).detail
      setSelected(id ? { id, type } : null)
    }
    function onChange(e: Event) {
      const { links } = (e as CustomEvent).detail
      setStats((prev) => ({ ...prev, links: links.length }))
    }
    el.addEventListener('shumoku-select', onSelect)
    el.addEventListener('shumoku-change', onChange)
    return () => {
      el.removeEventListener('shumoku-select', onSelect)
      el.removeEventListener('shumoku-change', onChange)
    }
  }, [])

  // --- Init ---

  useEffect(() => {
    async function init() {
      try {
        setStatus('Loading renderer...')
        await new Promise<void>((resolve, reject) => {
          if (customElements.get('shumoku-renderer')) { resolve(); return }
          const script = document.createElement('script')
          script.type = 'module'
          script.src = '/renderer/shumoku-renderer.js'
          script.onload = () => resolve()
          script.onerror = () => reject(new Error('Failed to load renderer'))
          document.head.appendChild(script)
        })

        setStatus('Parsing network...')
        const graph = await parseSampleNetwork()

        setStatus('Computing layout...')
        const { resolved } = await computeNetworkLayout(graph)

        setStats({
          nodes: resolved.nodes.size,
          links: graph.links.length,
          subgraphs: resolved.subgraphs.size,
        })

        await customElements.whenDefined('shumoku-renderer')
        const el = wcRef.current
        if (el) {
          ;(el as any).graph = graph
          ;(el as any).layout = resolved
          ;(el as any).theme = lightTheme
          ;(el as any).mode = 'edit'
          setStatus('Ready')
        }
      } catch (e) {
        setStatus(`Error: ${e instanceof Error ? e.message : String(e)}`)
      }
    }
    init()
  }, [])

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex flex-col h-screen">
        {/* Toolbar */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-white shadow-sm z-10">
          <Network className="w-5 h-5 text-blue-500" />
          <h1 className="text-base font-semibold text-slate-800">Network Editor</h1>

          <div className="w-px h-5 bg-slate-200 mx-2" />

          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span>{stats.nodes} nodes</span>
            <span>{stats.links} links</span>
            <span>{stats.subgraphs} groups</span>
          </div>

          <div className="flex-1" />

          {selected ? (
            <div className="flex items-center gap-1.5 bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full text-xs font-medium">
              <Layers className="w-3.5 h-3.5" />
              <span className="capitalize">{selected.type}</span>
              <span className="text-blue-400">·</span>
              <span className="font-mono">{selected.id}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <MousePointer2 className="w-3.5 h-3.5" />
              <span>Click to select</span>
            </div>
          )}

          <div className="w-px h-5 bg-slate-200 mx-2" />

          {/* Zoom indicator */}
          <button
            className="text-xs text-slate-500 hover:text-slate-700 px-2 py-1 rounded hover:bg-slate-100"
            onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }) }}
          >
            {Math.round(zoom * 100)}%
          </button>

          <div className="w-px h-5 bg-slate-200 mx-2" />

          <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${status === 'Ready' ? 'bg-green-400' : 'bg-amber-400 animate-pulse'}`} />
            <span className="text-xs text-slate-500">{status}</span>
          </div>
        </div>

        {/* Canvas with grid + pan/zoom */}
        <div
          ref={canvasRef}
          className="flex-1 overflow-hidden relative"
          style={{
            ...gridStyle,
            backgroundSize: `${20 * zoom}px ${20 * zoom}px`,
            backgroundPosition: `${pan.x}px ${pan.y}px`,
            cursor: isPanning.current ? 'grabbing' : 'default',
          }}
          onWheel={onWheel}
          onPointerDown={onCanvasPointerDown}
          onPointerMove={onCanvasPointerMove}
          onPointerUp={onCanvasPointerUp}
        >
          {/* WebComponent with CSS transform for pan/zoom */}
          <div style={{ transform: wcTransform, transformOrigin: '0 0', width: '100%', height: '100%' }}>
            {/* @ts-expect-error WebComponent */}
            <shumoku-renderer ref={wcRef} style={{ width: '100%', height: '100%', display: 'block' }} />
          </div>
        </div>

        {/* Bottom help */}
        <div className="absolute bottom-4 right-4 z-10">
          <Tooltip>
            <TooltipTrigger asChild>
              <button className="p-2 bg-white/80 backdrop-blur-sm rounded-lg border border-slate-200 shadow-sm hover:bg-white transition-colors">
                <Info className="w-4 h-4 text-slate-500" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="left" className="max-w-[260px]">
              <div className="text-xs space-y-1.5">
                <p className="font-semibold">Controls</p>
                <div className="flex justify-between gap-4"><span>Pan</span><kbd className="px-1 bg-slate-100 rounded text-[10px]">Alt + Drag / Middle Mouse</kbd></div>
                <div className="flex justify-between gap-4"><span>Zoom</span><kbd className="px-1 bg-slate-100 rounded text-[10px]">Scroll wheel</kbd></div>
                <div className="flex justify-between gap-4"><span>Reset view</span><span className="text-slate-400">Click zoom %</span></div>
                <div className="flex justify-between gap-4"><span>Delete</span><kbd className="px-1 bg-slate-100 rounded text-[10px]">Del</kbd></div>
                <div className="flex justify-between gap-4"><span>Cancel</span><kbd className="px-1 bg-slate-100 rounded text-[10px]">Esc</kbd></div>
              </div>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </TooltipProvider>
  )
}
