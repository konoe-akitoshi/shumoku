'use client'

import type { SheetData } from '@shumoku/renderer'
import { html } from '@shumoku/renderer'
import { INTERACTIVE_IIFE } from '@shumoku/renderer/iife-string'
import { useEffect, useRef, useState } from 'react'
import type { LayoutResult, NetworkGraph } from 'shumoku'
import {
  createMemoryFileResolver,
  HierarchicalLayout,
  HierarchicalParser,
  parser,
  sampleNetwork,
  svg,
} from 'shumoku'
import { cn } from '@/lib/cn'
import { InteractivePreview } from './InteractivePreview'

// Set IIFE once at module load
html.setIIFE(INTERACTIVE_IIFE)

// File type for multi-file editor
interface EditorFile {
  name: string
  content: string
}

// Format dropdown component
function FormatDropdown({
  label,
  disabled,
  onSelect,
}: {
  label: string
  disabled: boolean
  onSelect: (format: 'svg' | 'html') => void
}) {
  const [show, setShow] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setShow(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setShow(!show)}
        disabled={disabled}
        className={cn(
          'flex items-center gap-1 rounded px-4 py-2 text-sm font-medium',
          'border border-neutral-300 dark:border-neutral-600',
          'bg-white dark:bg-neutral-800',
          'hover:bg-neutral-100 dark:hover:bg-neutral-700 disabled:opacity-50',
        )}
      >
        {label}
        <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
          <path d="M3 5l3 3 3-3" />
        </svg>
      </button>
      {show && (
        <div
          className={cn(
            'absolute right-0 top-full z-10 mt-1 w-40',
            'rounded border border-neutral-200 dark:border-neutral-600',
            'bg-white dark:bg-neutral-800',
            'shadow-lg',
          )}
        >
          <button
            onClick={() => {
              onSelect('svg')
              setShow(false)
            }}
            className={cn(
              'flex w-full items-center gap-2 px-3 py-2 text-left text-sm',
              'hover:bg-neutral-100 dark:hover:bg-neutral-700',
            )}
          >
            <span className="text-neutral-500">.svg</span>
            <span>Pure SVG</span>
          </button>
          <button
            onClick={() => {
              onSelect('html')
              setShow(false)
            }}
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
  )
}

// File tabs component
function FileTabs({
  files,
  activeFile,
  onSelect,
  onAdd,
  onDelete,
}: {
  files: EditorFile[]
  activeFile: string
  onSelect: (name: string) => void
  onAdd: () => void
  onDelete: (name: string) => void
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-1 px-2',
        'border-b border-neutral-200 dark:border-neutral-700',
        'bg-neutral-50 dark:bg-neutral-800',
        'overflow-x-auto',
      )}
    >
      {files.map((file) => (
        <div
          key={file.name}
          role="tab"
          tabIndex={0}
          className={cn(
            'group flex items-center gap-1 px-3 py-2 text-sm cursor-pointer',
            'border-b-2 -mb-[1px]',
            activeFile === file.name
              ? 'border-blue-500 text-blue-600 dark:text-blue-400 bg-white dark:bg-neutral-900'
              : 'border-transparent text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200',
          )}
          onClick={() => onSelect(file.name)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              onSelect(file.name)
            }
          }}
        >
          <span className="font-mono">{file.name}</span>
          {files.length > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onDelete(file.name)
              }}
              className={cn(
                'ml-1 p-0.5 rounded opacity-0 group-hover:opacity-100',
                'hover:bg-neutral-200 dark:hover:bg-neutral-700',
                'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300',
              )}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.5" fill="none" />
              </svg>
            </button>
          )}
        </div>
      ))}
      <button
        onClick={onAdd}
        className={cn(
          'flex items-center gap-1 px-3 py-2 text-sm',
          'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300',
        )}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
          <path d="M7 3v8M3 7h8" stroke="currentColor" strokeWidth="1.5" fill="none" />
        </svg>
        <span>Add</span>
      </button>
    </div>
  )
}

export default function PlaygroundClient() {
  const [files, setFiles] = useState<EditorFile[]>(sampleNetwork)
  const [activeFile, setActiveFile] = useState('main.yaml')
  const [svgContent, setSvgContent] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isRendering, setIsRendering] = useState(false)

  // Store graph and layout for export
  const graphRef = useRef<NetworkGraph | null>(null)
  const layoutRef = useRef<LayoutResult | null>(null)
  const sheetsRef = useRef<Map<string, NetworkGraph> | null>(null)

  const activeFileContent = files.find((f) => f.name === activeFile)?.content || ''

  const updateFileContent = (content: string) => {
    setFiles(files.map((f) => (f.name === activeFile ? { ...f, content } : f)))
  }

  const addFile = () => {
    let newName = 'new-file.yaml'
    let counter = 1
    while (files.some((f) => f.name === newName)) {
      newName = `new-file-${counter}.yaml`
      counter++
    }
    setFiles([
      ...files,
      { name: newName, content: `name: "${newName.replace('.yaml', '')}"\n\nnodes: []\nlinks: []` },
    ])
    setActiveFile(newName)
  }

  const deleteFile = (name: string) => {
    if (files.length <= 1) return
    const newFiles = files.filter((f) => f.name !== name)
    setFiles(newFiles)
    if (activeFile === name) {
      setActiveFile(newFiles[0].name)
    }
  }

  const handleParseAndRender = async () => {
    setIsRendering(true)
    try {
      const mainFile = files.find((f) => f.name === 'main.yaml')
      if (!mainFile) {
        setError('main.yaml not found')
        setIsRendering(false)
        return
      }

      // Check if we need hierarchical parsing (has file references)
      const hasFileRefs = files.some((f) => f.content.includes('file:'))

      let graph: NetworkGraph

      if (hasFileRefs && files.length > 1) {
        // Use hierarchical parser with memory resolver
        const fileMap = new Map<string, string>()
        for (const f of files) {
          // Map both with and without ./ prefix
          fileMap.set(f.name, f.content)
          fileMap.set(`./${f.name}`, f.content)
          fileMap.set(`/${f.name}`, f.content)
        }

        const resolver = createMemoryFileResolver(fileMap, '/')
        const hierarchicalParser = new HierarchicalParser(resolver)
        const result = await hierarchicalParser.parse(mainFile.content, '/main.yaml')

        if (result.warnings && result.warnings.length > 0) {
          const errors = result.warnings.filter((w) => w.severity === 'error')
          if (errors.length > 0) {
            setError(`Parse errors: ${errors.map((e) => e.message).join(', ')}`)
            graphRef.current = null
            layoutRef.current = null
            sheetsRef.current = null
            setSvgContent(null)
            setIsRendering(false)
            return
          }
        }

        graph = result.graph
        sheetsRef.current = result.sheets
      } else {
        // Use simple parser for single file
        const result = parser.parse(mainFile.content)

        if (result.warnings && result.warnings.length > 0) {
          const errors = result.warnings.filter((w) => w.severity === 'error')
          if (errors.length > 0) {
            setError(`Parse errors: ${errors.map((e) => e.message).join(', ')}`)
            graphRef.current = null
            layoutRef.current = null
            sheetsRef.current = null
            setSvgContent(null)
            setIsRendering(false)
            return
          }
        }

        graph = result.graph
        sheetsRef.current = null
      }

      const layout = new HierarchicalLayout()
      const layoutRes = await layout.layoutAsync(graph)

      // Store for Open Viewer
      graphRef.current = graph
      layoutRef.current = layoutRes

      const svgOutput = svg.render(graph, layoutRes)
      setSvgContent(svgOutput)
      setError(null)
    } catch (e) {
      setError(`Error: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setIsRendering(false)
    }
  }

  const buildHierarchicalSheets = async (): Promise<Map<string, SheetData> | null> => {
    if (!graphRef.current || !layoutRef.current || !sheetsRef.current) return null
    if (sheetsRef.current.size === 0) return null

    const layout = new HierarchicalLayout()
    const sheetDataMap = new Map<string, SheetData>()

    // Add root sheet
    sheetDataMap.set('root', {
      graph: graphRef.current,
      layout: layoutRef.current,
    })

    // Layout and add each child sheet
    for (const [sheetId, sheetGraph] of sheetsRef.current) {
      try {
        const sheetLayout = await layout.layoutAsync(sheetGraph)
        sheetDataMap.set(sheetId, {
          graph: sheetGraph,
          layout: sheetLayout,
        })
      } catch (e) {
        console.error(`Failed to layout sheet ${sheetId}:`, e)
      }
    }

    return sheetDataMap
  }

  const handleDownload = async (format: 'svg' | 'html') => {
    if (!graphRef.current || !layoutRef.current) return
    const date = new Date().toISOString().slice(0, 10)
    const name = graphRef.current.name?.replace(/\s+/g, '-').toLowerCase() || 'network-diagram'

    let content: string
    if (format === 'svg') {
      content = svg.render(graphRef.current, layoutRef.current)
    } else {
      // Check if we have hierarchical sheets
      const sheetDataMap = await buildHierarchicalSheets()
      if (sheetDataMap && sheetDataMap.size > 1) {
        content = html.renderHierarchical(sheetDataMap)
      } else {
        content = html.render(graphRef.current, layoutRef.current)
      }
    }

    const blob = new Blob([content], {
      type: format === 'svg' ? 'image/svg+xml;charset=utf-8' : 'text/html;charset=utf-8',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${name}-${date}.${format}`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleOpen = async (format: 'svg' | 'html') => {
    if (!graphRef.current || !layoutRef.current) return
    const win = window.open('', '_blank')
    if (!win) return

    if (format === 'svg') {
      const svgOutput = svg.render(graphRef.current, layoutRef.current)
      const title = graphRef.current.name || 'Network Diagram'
      win.document.write(
        `<!DOCTYPE html><html><head><title>${title}</title><style>body{margin:0;display:flex;justify-content:center;align-items:center;min-height:100vh;background:#f5f5f5}</style></head><body>${svgOutput}</body></html>`,
      )
    } else {
      // Check if we have hierarchical sheets
      const sheetDataMap = await buildHierarchicalSheets()
      if (sheetDataMap && sheetDataMap.size > 1) {
        win.document.write(html.renderHierarchical(sheetDataMap))
      } else {
        win.document.write(html.render(graphRef.current, layoutRef.current))
      }
    }
    win.document.close()
  }

  const resetSample = () => {
    setFiles([...sampleNetwork])
    setActiveFile('main.yaml')
    setSvgContent(null)
    setError(null)
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
          <button
            onClick={resetSample}
            className={cn(
              'rounded px-3 py-2 text-sm',
              'border border-neutral-300 dark:border-neutral-600',
              'bg-white dark:bg-neutral-800',
              'hover:bg-neutral-100 dark:hover:bg-neutral-700',
            )}
          >
            Reset
          </button>

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

          <FormatDropdown label="Open" disabled={!svgContent} onSelect={handleOpen} />
          <FormatDropdown label="Download" disabled={!svgContent} onSelect={handleDownload} />
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
          <FileTabs
            files={files}
            activeFile={activeFile}
            onSelect={setActiveFile}
            onAdd={addFile}
            onDelete={deleteFile}
          />
          <textarea
            value={activeFileContent}
            onChange={(e) => updateFileContent(e.target.value)}
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
