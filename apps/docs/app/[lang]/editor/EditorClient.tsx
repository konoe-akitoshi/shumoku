'use client'

import {
  computeNetworkLayout,
  createMemoryFileResolver,
  darkTheme,
  HierarchicalParser,
  lightTheme,
  sampleNetwork,
} from '@shumoku/core'
import {
  Box,
  Download,
  Eye,
  Info,
  Layers,
  MousePointer2,
  Network,
  Pencil,
  Plus,
  SquareDashed,
  Upload,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

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

// Map ↔ plain object conversion for JSON serialization
function mapToObj(layout: any) {
  return {
    nodes: Object.fromEntries(layout.nodes),
    ports: Object.fromEntries(layout.ports),
    edges: Object.fromEntries(layout.edges),
    subgraphs: Object.fromEntries(layout.subgraphs),
    bounds: layout.bounds,
  }
}

function objToMap(data: any) {
  return {
    nodes: new Map(Object.entries(data.nodes ?? {})),
    ports: new Map(Object.entries(data.ports ?? {})),
    edges: new Map(Object.entries(data.edges ?? {})),
    subgraphs: new Map(Object.entries(data.subgraphs ?? {})),
    bounds: data.bounds ?? { x: 0, y: 0, width: 800, height: 600 },
  }
}

// ============================================================================
// Grid background (CSS)
// ============================================================================

// ============================================================================
// Editor
// ============================================================================

export default function EditorClient() {
  const wcRef = useRef<HTMLElement | null>(null)
  const canvasRef = useRef<HTMLDivElement | null>(null)
  const [status, setStatus] = useState('Loading...')
  const [mode, setMode] = useState<'edit' | 'view'>('view')
  const [selected, setSelected] = useState<{ id: string; type: string } | null>(null)
  const [stats, setStats] = useState({ nodes: 0, links: 0, subgraphs: 0 })
  const [isDark, setIsDark] = useState(() =>
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark'),
  )

  // Watch for dark mode changes
  useEffect(() => {
    const obs = new MutationObserver(() =>
      setIsDark(document.documentElement.classList.contains('dark')),
    )
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [])
  const [labelEdit, setLabelEdit] = useState<{
    portId: string
    label: string
    x: number
    y: number
  } | null>(null)
  const labelInputRef = useRef<HTMLInputElement | null>(null)

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
    function onLabelEdit(e: Event) {
      const { portId, label, screenX, screenY } = (e as CustomEvent).detail
      setLabelEdit({ portId, label, x: screenX, y: screenY })
      setTimeout(() => labelInputRef.current?.focus(), 0)
    }
    el.addEventListener('shumoku-select', onSelect)
    el.addEventListener('shumoku-change', onChange)
    el.addEventListener('shumoku-label-edit', onLabelEdit)
    return () => {
      el.removeEventListener('shumoku-select', onSelect)
      el.removeEventListener('shumoku-change', onChange)
      el.removeEventListener('shumoku-label-edit', onLabelEdit)
    }
  }, [])

  // --- Theme sync (event, no remount) ---
  useEffect(() => {
    const el = wcRef.current
    if (el) {
      el.dispatchEvent(
        new CustomEvent('shumoku-theme-change', {
          detail: { theme: isDark ? darkTheme : lightTheme },
        }),
      )
    }
  }, [isDark])

  // --- Mode toggle (event, no remount) ---
  useEffect(() => {
    const el = wcRef.current
    if (el) {
      el.dispatchEvent(new CustomEvent('shumoku-mode-change', { detail: { mode } }))
    }
  }, [mode])

  // --- Init ---

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
          // Set graph, theme, mode BEFORE layout (layout triggers render)
          ;(el as any).graph = graph
          ;(el as any).theme = isDark ? darkTheme : lightTheme
          ;(el as any).mode = mode
          ;(el as any).layout = resolved
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
      <div className="flex flex-col h-[calc(100vh-64px)]">
        {/* Toolbar */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-700 shadow-sm z-10">
          <Network className="w-5 h-5 text-blue-500" />
          <h1 className="text-base font-semibold text-slate-800 dark:text-neutral-100">Network Editor</h1>

          <div className="w-px h-5 bg-slate-200 dark:bg-neutral-700 mx-2" />

          {/* Mode toggle */}
          <div className="flex items-center bg-slate-100 dark:bg-neutral-800 rounded-md p-0.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                    mode === 'edit'
                      ? 'bg-white dark:bg-neutral-700 text-blue-600 dark:text-blue-400 shadow-sm'
                      : 'text-slate-500 dark:text-neutral-400 hover:text-slate-700 dark:hover:text-neutral-200'
                  }`}
                  onClick={() => setMode('edit')}
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Edit
                </button>
              </TooltipTrigger>
              <TooltipContent>Edit mode — drag, add, delete</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                    mode === 'view'
                      ? 'bg-white dark:bg-neutral-700 text-blue-600 dark:text-blue-400 shadow-sm'
                      : 'text-slate-500 dark:text-neutral-400 hover:text-slate-700 dark:hover:text-neutral-200'
                  }`}
                  onClick={() => setMode('view')}
                >
                  <Eye className="w-3.5 h-3.5" />
                  View
                </button>
              </TooltipTrigger>
              <TooltipContent>View mode — pan and zoom only</TooltipContent>
            </Tooltip>
          </div>

          <div className="w-px h-5 bg-slate-200 dark:bg-neutral-700 mx-2" />

          <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-neutral-400">
            <span>{stats.nodes} nodes</span>
            <span>{stats.links} links</span>
            <span>{stats.subgraphs} groups</span>
          </div>

          <div className="w-px h-5 bg-slate-200 dark:bg-neutral-700 mx-2" />

          {/* Add buttons (edit mode only) */}
          {mode === 'edit' && (
            <div className="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-slate-600 dark:text-neutral-300 hover:bg-slate-100 dark:hover:bg-neutral-700 transition-colors"
                    onClick={() => {
                      wcRef.current?.dispatchEvent(
                        new CustomEvent('shumoku-add-node', { detail: {} }),
                      )
                      setStats((s) => ({ ...s, nodes: s.nodes + 1 }))
                    }}
                  >
                    <Box className="w-3.5 h-3.5" />
                    <Plus className="w-3 h-3" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Add node</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-slate-600 dark:text-neutral-300 hover:bg-slate-100 dark:hover:bg-neutral-700 transition-colors"
                    onClick={() => {
                      wcRef.current?.dispatchEvent(
                        new CustomEvent('shumoku-add-subgraph', { detail: {} }),
                      )
                      setStats((s) => ({ ...s, subgraphs: s.subgraphs + 1 }))
                    }}
                  >
                    <SquareDashed className="w-3.5 h-3.5" />
                    <Plus className="w-3 h-3" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Add group</TooltipContent>
              </Tooltip>
            </div>
          )}

          <div className="w-px h-5 bg-slate-200 dark:bg-neutral-700 mx-2" />

          {/* Save/Load */}
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-slate-600 dark:text-neutral-300 hover:bg-slate-100 dark:hover:bg-neutral-700 transition-colors"
                  onClick={() => {
                    const el = wcRef.current
                    if (!el) return
                    // Request snapshot from WebComponent
                    const handler = (e: Event) => {
                      el.removeEventListener('shumoku-snapshot', handler)
                      const { layout, links } = (e as CustomEvent).detail
                      const data = JSON.stringify({ layout: mapToObj(layout), links }, null, 2)
                      const blob = new Blob([data], { type: 'application/json' })
                      const url = URL.createObjectURL(blob)
                      const a = document.createElement('a')
                      a.href = url
                      a.download = 'network-diagram.json'
                      a.click()
                      URL.revokeObjectURL(url)
                    }
                    el.addEventListener('shumoku-snapshot', handler)
                    el.dispatchEvent(new CustomEvent('shumoku-get-snapshot'))
                  }}
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Save</span>
                </button>
              </TooltipTrigger>
              <TooltipContent>Save diagram as JSON</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-slate-600 dark:text-neutral-300 hover:bg-slate-100 dark:hover:bg-neutral-700 transition-colors"
                  onClick={() => {
                    const input = document.createElement('input')
                    input.type = 'file'
                    input.accept = '.json'
                    input.onchange = async () => {
                      const file = input.files?.[0]
                      if (!file) return
                      const text = await file.text()
                      const data = JSON.parse(text)
                      const layout = objToMap(data.layout)
                      const el = wcRef.current
                      if (el) {
                        ;(el as any).graph = { links: data.links }
                        ;(el as any).layout = layout
                        setStats({
                          nodes: layout.nodes.size,
                          links: data.links?.length ?? 0,
                          subgraphs: layout.subgraphs.size,
                        })
                      }
                    }
                    input.click()
                  }}
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Load</span>
                </button>
              </TooltipTrigger>
              <TooltipContent>Load diagram from JSON</TooltipContent>
            </Tooltip>
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

          <div className="w-px h-5 bg-slate-200 dark:bg-neutral-700 mx-2" />

          <div className="flex items-center gap-1.5">
            <div
              className={`w-2 h-2 rounded-full ${status === 'Ready' ? 'bg-green-400' : 'bg-amber-400 animate-pulse'}`}
            />
            <span className="text-xs text-slate-500 dark:text-neutral-400">{status}</span>
          </div>
        </div>

        {/* Canvas: WebComponent handles grid + pan/zoom internally via d3-zoom */}
        <div className="flex-1 overflow-hidden">
          {/* @ts-expect-error WebComponent */}
          <shumoku-renderer
            ref={wcRef}
            style={{ width: '100%', height: '100%', display: 'block' }}
          />
        </div>

        {/* Label edit popover */}
        {labelEdit && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setLabelEdit(null)} />
            <div
              className="fixed z-50 bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-600 rounded-lg shadow-lg p-2"
              style={{ top: labelEdit.y - 10, left: labelEdit.x - 4 }}
            >
              <input
                ref={labelInputRef}
                type="text"
                defaultValue={labelEdit.label}
                className="text-sm px-2 py-1 border border-blue-300 rounded outline-none focus:ring-2 focus:ring-blue-200 w-32 text-slate-900 dark:text-neutral-100 bg-white dark:bg-neutral-700"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const value = (e.target as HTMLInputElement).value.trim()
                    if (value) {
                      wcRef.current?.dispatchEvent(
                        new CustomEvent('shumoku-label-commit', {
                          detail: { portId: labelEdit.portId, label: value },
                        }),
                      )
                    }
                    setLabelEdit(null)
                  }
                  if (e.key === 'Escape') setLabelEdit(null)
                }}
                onBlur={(e) => {
                  const value = e.target.value.trim()
                  if (value && value !== labelEdit.label) {
                    wcRef.current?.dispatchEvent(
                      new CustomEvent('shumoku-label-commit', {
                        detail: { portId: labelEdit.portId, label: value },
                      }),
                    )
                  }
                  setLabelEdit(null)
                }}
              />
            </div>
          </>
        )}

        {/* Bottom help */}
        <div className="absolute bottom-4 right-4 z-10">
          <Tooltip>
            <TooltipTrigger asChild>
              <button className="p-2 bg-white/80 dark:bg-neutral-800/80 backdrop-blur-sm rounded-lg border border-slate-200 dark:border-neutral-600 shadow-sm hover:bg-white dark:hover:bg-neutral-700 transition-colors">
                <Info className="w-4 h-4 text-slate-500 dark:text-neutral-400" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="left" className="max-w-[260px]">
              <div className="text-xs space-y-1.5">
                <p className="font-semibold">Controls</p>
                <div className="flex justify-between gap-4">
                  <span>Pan</span>
                  <kbd className="px-1 bg-slate-100 dark:bg-neutral-700 rounded text-[10px]">
                    Alt + Drag / Middle Mouse
                  </kbd>
                </div>
                <div className="flex justify-between gap-4">
                  <span>Zoom</span>
                  <kbd className="px-1 bg-slate-100 dark:bg-neutral-700 rounded text-[10px]">Scroll wheel</kbd>
                </div>
                <div className="flex justify-between gap-4">
                  <span>Reset view</span>
                  <span className="text-slate-400 dark:text-neutral-500">Click zoom %</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span>Delete</span>
                  <kbd className="px-1 bg-slate-100 dark:bg-neutral-700 rounded text-[10px]">Del</kbd>
                </div>
                <div className="flex justify-between gap-4">
                  <span>Cancel</span>
                  <kbd className="px-1 bg-slate-100 dark:bg-neutral-700 rounded text-[10px]">Esc</kbd>
                </div>
              </div>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </TooltipProvider>
  )
}
