'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { initInteractive, type InteractiveInstance } from '@shumoku/interactive'
import { cn } from '@/lib/cn'

interface InteractivePreviewProps {
  svgContent: string | null
  className?: string
}

export function InteractivePreview({ svgContent, className }: InteractivePreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const interactiveRef = useRef<InteractiveInstance | null>(null)
  const [scale, setScale] = useState(1)

  // Build the SVG with full width/height
  const svgHtml = useMemo(() => {
    if (!svgContent) return null

    const parser = new DOMParser()
    const doc = parser.parseFromString(svgContent, 'image/svg+xml')
    const svg = doc.querySelector('svg')
    if (!svg) return null

    // Ensure SVG fills container
    svg.setAttribute('width', '100%')
    svg.setAttribute('height', '100%')
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet')

    return svg.outerHTML
  }, [svgContent])

  // Initialize interactive after SVG is rendered
  useEffect(() => {
    // Cleanup previous instance
    if (interactiveRef.current) {
      interactiveRef.current.destroy()
      interactiveRef.current = null
    }

    if (!svgHtml || !containerRef.current) return

    const svgElement = containerRef.current.querySelector('svg')
    if (!svgElement) return

    // Small delay to ensure DOM is ready
    const timeoutId = setTimeout(() => {
      interactiveRef.current = initInteractive({
        target: svgElement as SVGElement,
        modal: { enabled: true },
        tooltip: { enabled: true },
        panZoom: { enabled: true },
      })

      // Update scale display periodically
      const updateScale = () => {
        if (interactiveRef.current) {
          setScale(interactiveRef.current.getScale())
        }
      }
      updateScale()

      // Update scale on viewBox changes
      const observer = new MutationObserver(updateScale)
      observer.observe(svgElement, { attributes: true, attributeFilter: ['viewBox'] })

      return () => observer.disconnect()
    }, 50)

    return () => {
      clearTimeout(timeoutId)
      if (interactiveRef.current) {
        interactiveRef.current.destroy()
        interactiveRef.current = null
      }
    }
  }, [svgHtml])

  const handleReset = () => {
    interactiveRef.current?.resetView()
  }

  return (
    <div className={cn('relative flex flex-col', className)}>
      {/* Toolbar */}
      <div
        className={cn(
          'flex items-center justify-between px-4 py-2',
          'border-b border-neutral-200 dark:border-neutral-700',
          'bg-neutral-50 dark:bg-neutral-800',
        )}
      >
        <span className="text-sm font-medium text-neutral-600 dark:text-neutral-400">Preview</span>
        <div className="flex items-center gap-1">
          <span
            className={cn(
              'min-w-[3.5rem] text-center text-xs tabular-nums',
              'text-neutral-500 dark:text-neutral-400',
            )}
          >
            {Math.round(scale * 100)}%
          </span>
          <div className="mx-1 h-4 w-px bg-neutral-300 dark:bg-neutral-600" />
          <button
            onClick={handleReset}
            disabled={!svgContent}
            className={cn(
              'rounded p-1.5 text-neutral-600 dark:text-neutral-400',
              'hover:bg-neutral-200 dark:hover:bg-neutral-700',
              'disabled:opacity-30 disabled:cursor-not-allowed',
            )}
            title="Reset View (100%)"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div
        ref={containerRef}
        className={cn(
          'relative flex-1 overflow-hidden',
          'bg-neutral-100 dark:bg-neutral-800',
          svgContent ? 'cursor-grab' : 'cursor-default',
        )}
        style={{
          backgroundImage: `
            linear-gradient(45deg, rgba(0,0,0,0.03) 25%, transparent 25%),
            linear-gradient(-45deg, rgba(0,0,0,0.03) 25%, transparent 25%),
            linear-gradient(45deg, transparent 75%, rgba(0,0,0,0.03) 75%),
            linear-gradient(-45deg, transparent 75%, rgba(0,0,0,0.03) 75%)
          `,
          backgroundSize: '20px 20px',
          backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
        }}
      >
        {svgHtml ? (
          <div
            className="h-full w-full select-none [&>svg]:h-full [&>svg]:w-full"
            dangerouslySetInnerHTML={{ __html: svgHtml }}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-neutral-400 dark:text-neutral-500">
            <div className="text-center">
              <svg
                className="mx-auto h-12 w-12 mb-3 opacity-50"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"
                />
              </svg>
              <p>Click "Render" to generate diagram</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
