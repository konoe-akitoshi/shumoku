'use client'

import { useState } from 'react'
import type { LayoutResult } from 'shumoku'
import { HierarchicalLayout, SVGRenderer, parser } from 'shumoku'
import { enterpriseNetwork, simpleNetwork } from '@/lib/sampleNetworks'
import { cn } from '@/lib/cn'

export default function PlaygroundPage() {
  const [yamlContent, setYamlContent] = useState<string>(enterpriseNetwork)
  const [layoutResult, setLayoutResult] = useState<LayoutResult | null>(null)
  const [svgContent, setSvgContent] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isRendering, setIsRendering] = useState(false)

  const handleParseAndRender = async () => {
    setIsRendering(true)
    try {
      const result = parser.parse(yamlContent)

      if (result.warnings && result.warnings.length > 0) {
        const errors = result.warnings.filter((w) => w.severity === 'error')
        if (errors.length > 0) {
          setError(`Parse errors: ${errors.map((e) => e.message).join(', ')}`)
          setLayoutResult(null)
          setSvgContent(null)
          setIsRendering(false)
          return
        }
      }

      const layout = new HierarchicalLayout()
      const layoutRes = await layout.layoutAsync(result.graph)
      setLayoutResult(layoutRes)

      const renderer = new SVGRenderer()
      const svg = renderer.render(result.graph, layoutRes)
      setSvgContent(svg)
      setError(null)
    } catch (e) {
      setError(`Error: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setIsRendering(false)
    }
  }

  const handleExportSVG = () => {
    if (!svgContent) return
    const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `network-diagram-${new Date().toISOString().slice(0, 10)}.svg`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleOpenSVG = () => {
    if (!svgContent) return
    const win = window.open('', '_blank')
    if (win) {
      win.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Network Diagram</title>
            <style>
              body { margin: 0; background: #f5f5f5; padding: 20px; min-height: 100vh; }
              .container { background: white; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); display: inline-block; padding: 20px; }
            </style>
          </head>
          <body>
            <div class="container">${svgContent}</div>
          </body>
        </html>
      `)
      win.document.close()
    }
  }

  return (
    <div className="flex h-[calc(100vh-64px)] flex-col">
      {/* Header */}
      <div className={cn(
        'flex items-center justify-between px-6 py-4',
        'border-b border-neutral-200 dark:border-neutral-700',
        'bg-white dark:bg-neutral-900'
      )}>
        <h1 className="text-xl font-semibold">Playground</h1>
        <div className="flex items-center gap-3">
          <select
            className={cn(
              'rounded px-3 py-2 text-sm',
              'border border-neutral-300 dark:border-neutral-600',
              'bg-white dark:bg-neutral-800',
              'focus:outline-none focus:ring-2 focus:ring-blue-500'
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
              'hover:bg-blue-700 disabled:opacity-50'
            )}
          >
            {isRendering ? 'Rendering...' : 'Render'}
          </button>

          <button
            onClick={handleOpenSVG}
            disabled={!svgContent}
            className={cn(
              'rounded px-4 py-2 text-sm font-medium',
              'border border-neutral-300 dark:border-neutral-600',
              'bg-white dark:bg-neutral-800',
              'hover:bg-neutral-100 dark:hover:bg-neutral-700 disabled:opacity-50'
            )}
          >
            Open SVG
          </button>

          <button
            onClick={handleExportSVG}
            disabled={!svgContent}
            className={cn(
              'rounded px-4 py-2 text-sm font-medium',
              'border border-neutral-300 dark:border-neutral-600',
              'bg-white dark:bg-neutral-800',
              'hover:bg-neutral-100 dark:hover:bg-neutral-700 disabled:opacity-50'
            )}
          >
            Download
          </button>
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
        <div className={cn(
          'flex w-1/2 flex-col',
          'border-r border-neutral-200 dark:border-neutral-700'
        )}>
          <div className={cn(
            'px-4 py-2',
            'border-b border-neutral-200 dark:border-neutral-700',
            'bg-neutral-50 dark:bg-neutral-800'
          )}>
            <span className="text-sm font-medium text-neutral-600 dark:text-neutral-400">YAML</span>
          </div>
          <textarea
            value={yamlContent}
            onChange={(e) => setYamlContent(e.target.value)}
            className={cn(
              'flex-1 resize-none p-4 font-mono text-sm',
              'bg-white dark:bg-neutral-900',
              'focus:outline-none'
            )}
            spellCheck={false}
          />
        </div>

        {/* Preview */}
        <div className="flex w-1/2 flex-col">
          <div className={cn(
            'px-4 py-2',
            'border-b border-neutral-200 dark:border-neutral-700',
            'bg-neutral-50 dark:bg-neutral-800'
          )}>
            <span className="text-sm font-medium text-neutral-600 dark:text-neutral-400">Preview</span>
          </div>
          <div className="relative flex-1 overflow-hidden bg-neutral-100 dark:bg-neutral-800">
            {svgContent ? (
              <div
                className="h-full w-full overflow-auto p-4"
                dangerouslySetInnerHTML={{ __html: svgContent }}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-neutral-400 dark:text-neutral-500">
                Click "Render" to generate diagram
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
