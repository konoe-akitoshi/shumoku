'use client'

import { useEffect, useRef, useState } from 'react'
import type { LayoutResult, NetworkGraph } from 'shumoku'
import { HierarchicalLayout, parser, svg } from 'shumoku'
import { html } from '@shumoku/renderer'
import { INTERACTIVE_IIFE } from '@shumoku/renderer/iife-string'
import { cn } from '@/lib/cn'
import { enterpriseNetwork, simpleNetwork } from '@/lib/sampleNetworks'
import { InteractivePreview } from './InteractivePreview'

// Set IIFE once at module load
html.setIIFE(INTERACTIVE_IIFE)

export default function PlaygroundClient() {
  const [yamlContent, setYamlContent] = useState<string>(enterpriseNetwork)
  const [svgContent, setSvgContent] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isRendering, setIsRendering] = useState(false)
  const [showDownloadMenu, setShowDownloadMenu] = useState(false)
  const downloadMenuRef = useRef<HTMLDivElement>(null)

  // Store graph and layout for Open Viewer
  const graphRef = useRef<NetworkGraph | null>(null)
  const layoutRef = useRef<LayoutResult | null>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (downloadMenuRef.current && !downloadMenuRef.current.contains(e.target as Node)) {
        setShowDownloadMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleParseAndRender = async () => {
    setIsRendering(true)
    try {
      const result = parser.parse(yamlContent)

      if (result.warnings && result.warnings.length > 0) {
        const errors = result.warnings.filter((w) => w.severity === 'error')
        if (errors.length > 0) {
          setError(`Parse errors: ${errors.map((e) => e.message).join(', ')}`)
          graphRef.current = null
          layoutRef.current = null
          setSvgContent(null)
          setIsRendering(false)
          return
        }
      }

      const layout = new HierarchicalLayout()
      const layoutRes = await layout.layoutAsync(result.graph)

      // Store for Open Viewer
      graphRef.current = result.graph
      layoutRef.current = layoutRes

      const svgOutput = svg.render(result.graph, layoutRes)
      setSvgContent(svgOutput)
      setError(null)
    } catch (e) {
      setError(`Error: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setIsRendering(false)
    }
  }

  const handleDownload = (format: 'svg' | 'html') => {
    if (!graphRef.current || !layoutRef.current) return
    const date = new Date().toISOString().slice(0, 10)

    if (format === 'svg') {
      const svgOutput = svg.render(graphRef.current, layoutRef.current)
      const blob = new Blob([svgOutput], { type: 'image/svg+xml;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `network-diagram-${date}.svg`
      a.click()
      URL.revokeObjectURL(url)
    } else {
      const htmlOutput = html.render(graphRef.current, layoutRef.current)
      const blob = new Blob([htmlOutput], { type: 'text/html;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `network-diagram-${date}.html`
      a.click()
      URL.revokeObjectURL(url)
    }
    setShowDownloadMenu(false)
  }

  const handleOpenViewer = () => {
    if (!graphRef.current || !layoutRef.current) return
    const htmlOutput = html.render(graphRef.current, layoutRef.current)
    const win = window.open('', '_blank')
    if (win) {
      win.document.write(htmlOutput)
      win.document.close()
    }
  }

  return (
    <div className="flex h-[calc(100vh-64px)] flex-col">
      {/* Header */}
      <div
        className={cn(
          'flex items-center justify-between px-6 py-4',
          'border-b border-neutral-200 dark:border-neutral-700',
          'bg-white dark:bg-neutral-900',
        )}
      >
        <h1 className="text-xl font-semibold">Playground</h1>
        <div className="flex items-center gap-3">
          <select
            className={cn(
              'rounded px-3 py-2 text-sm',
              'border border-neutral-300 dark:border-neutral-600',
              'bg-white dark:bg-neutral-800',
              'focus:outline-none focus:ring-2 focus:ring-blue-500',
            )}
            onChange={(e) => {
              if (e.target.value === 'enterprise') setYamlContent(enterpriseNetwork)
              else if (e.target.value === 'simple') setYamlContent(simpleNetwork)
            }}
          >
            <option value="enterprise">Enterprise Network</option>
            <option value="simple">Simple Network</option>
          </select>

          <button
            onClick={handleParseAndRender}
            disabled={isRendering}
            className={cn(
              'rounded px-4 py-2 text-sm font-medium',
              'bg-blue-600 text-white',
              'hover:bg-blue-700 disabled:opacity-50',
            )}
          >
            {isRendering ? 'Rendering...' : 'Render'}
          </button>

          <button
            onClick={handleOpenViewer}
            disabled={!svgContent}
            className={cn(
              'rounded px-4 py-2 text-sm font-medium',
              'border border-neutral-300 dark:border-neutral-600',
              'bg-white dark:bg-neutral-800',
              'hover:bg-neutral-100 dark:hover:bg-neutral-700 disabled:opacity-50',
            )}
          >
            Open Viewer
          </button>

          <div className="relative" ref={downloadMenuRef}>
            <button
              onClick={() => setShowDownloadMenu(!showDownloadMenu)}
              disabled={!svgContent}
              className={cn(
                'flex items-center gap-1 rounded px-4 py-2 text-sm font-medium',
                'border border-neutral-300 dark:border-neutral-600',
                'bg-white dark:bg-neutral-800',
                'hover:bg-neutral-100 dark:hover:bg-neutral-700 disabled:opacity-50',
              )}
            >
              Download
              <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                <path d="M3 5l3 3 3-3" />
              </svg>
            </button>
            {showDownloadMenu && (
              <div
                className={cn(
                  'absolute right-0 top-full z-10 mt-1 w-40',
                  'rounded border border-neutral-200 dark:border-neutral-600',
                  'bg-white dark:bg-neutral-800',
                  'shadow-lg',
                )}
              >
                <button
                  onClick={() => handleDownload('svg')}
                  className={cn(
                    'flex w-full items-center gap-2 px-3 py-2 text-left text-sm',
                    'hover:bg-neutral-100 dark:hover:bg-neutral-700',
                  )}
                >
                  <span className="text-neutral-500">.svg</span>
                  <span>Pure SVG</span>
                </button>
                <button
                  onClick={() => handleDownload('html')}
                  className={cn(
                    'flex w-full items-center gap-2 px-3 py-2 text-left text-sm',
                    'hover:bg-neutral-100 dark:hover:bg-neutral-700',
                  )}
                >
                  <span className="text-neutral-500">.html</span>
                  <span>Interactive</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="border-b border-red-300 bg-red-100 px-6 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* YAML Editor */}
        <div
          className={cn(
            'flex w-1/2 flex-col',
            'border-r border-neutral-200 dark:border-neutral-700',
          )}
        >
          <div
            className={cn(
              'px-4 py-2',
              'border-b border-neutral-200 dark:border-neutral-700',
              'bg-neutral-50 dark:bg-neutral-800',
            )}
          >
            <span className="text-sm font-medium text-neutral-600 dark:text-neutral-400">YAML</span>
          </div>
          <textarea
            value={yamlContent}
            onChange={(e) => setYamlContent(e.target.value)}
            className={cn(
              'flex-1 resize-none p-4 font-mono text-sm',
              'bg-white dark:bg-neutral-900',
              'focus:outline-none',
            )}
            spellCheck={false}
          />
        </div>

        {/* Preview */}
        <InteractivePreview svgContent={svgContent} className="w-1/2" />
      </div>
    </div>
  )
}
