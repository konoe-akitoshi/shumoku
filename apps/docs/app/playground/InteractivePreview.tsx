'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { initInteractive, type InteractiveInstance } from '@shumoku/interactive'
import { cn } from '@/lib/cn'

interface InteractivePreviewProps {
  svgContent: string | null
  className?: string
}

interface ViewBox {
  x: number
  y: number
  width: number
  height: number
}

const MIN_SCALE = 0.1
const MAX_SCALE = 10
const ZOOM_FACTOR = 1.2

export function InteractivePreview({ svgContent, className }: InteractivePreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [viewBox, setViewBox] = useState<ViewBox>({ x: 0, y: 0, width: 0, height: 0 })
  const [originalViewBox, setOriginalViewBox] = useState<ViewBox>({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, viewBoxX: 0, viewBoxY: 0 })

  // Parse SVG and extract original viewBox
  const svgData = useMemo(() => {
    if (!svgContent) return null

    const parser = new DOMParser()
    const doc = parser.parseFromString(svgContent, 'image/svg+xml')
    const svg = doc.querySelector('svg')
    if (!svg) return null

    const width = Number.parseFloat(svg.getAttribute('width') || '0')
    const height = Number.parseFloat(svg.getAttribute('height') || '0')
    const existingViewBox = svg.getAttribute('viewBox')

    let vb: ViewBox
    if (existingViewBox) {
      const parts = existingViewBox.split(/\s+|,/).map(Number)
      vb = { x: parts[0], y: parts[1], width: parts[2], height: parts[3] }
    } else {
      vb = { x: 0, y: 0, width, height }
    }

    // Remove width/height attributes and viewBox from SVG for manipulation
    svg.removeAttribute('width')
    svg.removeAttribute('height')
    svg.removeAttribute('viewBox')

    return {
      svgElement: svg.outerHTML,
      originalViewBox: vb,
      width,
      height,
    }
  }, [svgContent])

  const handleFit = useCallback(() => {
    if (!containerRef.current || !svgData) return

    const container = containerRef.current
    const containerWidth = container.clientWidth
    const containerHeight = container.clientHeight
    const { originalViewBox: ovb } = svgData

    const scaleX = containerWidth / ovb.width
    const scaleY = containerHeight / ovb.height
    const scale = Math.min(scaleX, scaleY) * 0.9 // 90% to add some padding

    const newWidth = containerWidth / scale
    const newHeight = containerHeight / scale

    const newX = ovb.x + (ovb.width - newWidth) / 2
    const newY = ovb.y + (ovb.height - newHeight) / 2

    setViewBox({ x: newX, y: newY, width: newWidth, height: newHeight })
  }, [svgData])

  // Initialize viewBox when SVG changes
  useEffect(() => {
    if (svgData) {
      setOriginalViewBox(svgData.originalViewBox)
      // Auto-fit on load
      setTimeout(() => handleFit(), 0)
    }
  }, [svgData, handleFit])

  // Initialize interactive runtime
  const interactiveRef = useRef<InteractiveInstance | null>(null)

  const currentScale = useMemo(() => {
    if (originalViewBox.width === 0) return 1
    return originalViewBox.width / viewBox.width
  }, [originalViewBox.width, viewBox.width])

  const handleZoomIn = useCallback(() => {
    if (!containerRef.current) return
    const _container = containerRef.current
    const centerX = viewBox.x + viewBox.width / 2
    const centerY = viewBox.y + viewBox.height / 2

    const newWidth = viewBox.width / ZOOM_FACTOR
    const newHeight = viewBox.height / ZOOM_FACTOR

    if (originalViewBox.width / newWidth > MAX_SCALE) return

    setViewBox({
      x: centerX - newWidth / 2,
      y: centerY - newHeight / 2,
      width: newWidth,
      height: newHeight,
    })
  }, [viewBox, originalViewBox])

  const handleZoomOut = useCallback(() => {
    const centerX = viewBox.x + viewBox.width / 2
    const centerY = viewBox.y + viewBox.height / 2

    const newWidth = viewBox.width * ZOOM_FACTOR
    const newHeight = viewBox.height * ZOOM_FACTOR

    if (originalViewBox.width / newWidth < MIN_SCALE) return

    setViewBox({
      x: centerX - newWidth / 2,
      y: centerY - newHeight / 2,
      width: newWidth,
      height: newHeight,
    })
  }, [viewBox, originalViewBox])

  const handleReset = useCallback(() => {
    if (svgData) {
      setViewBox(svgData.originalViewBox)
    }
  }, [svgData])

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault()
      if (!containerRef.current || viewBox.width === 0) return

      const container = containerRef.current
      const rect = container.getBoundingClientRect()

      // Mouse position relative to container (0-1)
      const mouseXRatio = (e.clientX - rect.left) / rect.width
      const mouseYRatio = (e.clientY - rect.top) / rect.height

      // Mouse position in viewBox coordinates
      const mouseX = viewBox.x + viewBox.width * mouseXRatio
      const mouseY = viewBox.y + viewBox.height * mouseYRatio

      const zoomFactor = e.deltaY > 0 ? ZOOM_FACTOR : 1 / ZOOM_FACTOR
      const newWidth = viewBox.width * zoomFactor
      const newHeight = viewBox.height * zoomFactor

      // Check scale limits
      const newScale = originalViewBox.width / newWidth
      if (newScale < MIN_SCALE || newScale > MAX_SCALE) return

      // Keep mouse position fixed
      setViewBox({
        x: mouseX - newWidth * mouseXRatio,
        y: mouseY - newHeight * mouseYRatio,
        width: newWidth,
        height: newHeight,
      })
    },
    [viewBox, originalViewBox],
  )

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return
      setIsDragging(true)
      setDragStart({
        x: e.clientX,
        y: e.clientY,
        viewBoxX: viewBox.x,
        viewBoxY: viewBox.y,
      })
    },
    [viewBox],
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging || !containerRef.current) return

      const container = containerRef.current
      const dx = e.clientX - dragStart.x
      const dy = e.clientY - dragStart.y

      // Convert screen pixels to viewBox units
      const scaleX = viewBox.width / container.clientWidth
      const scaleY = viewBox.height / container.clientHeight

      setViewBox((prev) => ({
        ...prev,
        x: dragStart.viewBoxX - dx * scaleX,
        y: dragStart.viewBoxY - dy * scaleY,
      }))
    },
    [isDragging, dragStart, viewBox.width, viewBox.height],
  )

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  const handleMouseLeave = useCallback(() => {
    setIsDragging(false)
  }, [])

  // Build the initial SVG (only when svgContent changes)
  const initialSvg = useMemo(() => {
    if (!svgData) return null

    // Insert placeholder viewBox into SVG
    return svgData.svgElement.replace(
      '<svg',
      '<svg viewBox="0 0 0 0" width="100%" height="100%" preserveAspectRatio="xMidYMid meet"',
    )
  }, [svgData])

  // Update viewBox attribute directly on SVG element (without re-rendering DOM)
  useEffect(() => {
    if (!containerRef.current || viewBox.width === 0) return

    const svgElement = containerRef.current.querySelector('svg')
    if (!svgElement) return

    const viewBoxStr = `${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`
    svgElement.setAttribute('viewBox', viewBoxStr)
  }, [viewBox])

  // Initialize interactive after SVG is rendered
  useEffect(() => {
    // Cleanup previous instance
    if (interactiveRef.current) {
      interactiveRef.current.destroy()
      interactiveRef.current = null
    }

    // Initialize after SVG is rendered
    if (!initialSvg || !containerRef.current) return

    const svgElement = containerRef.current.querySelector('svg')
    if (!svgElement) return

    // Small delay to ensure DOM is ready
    const timeoutId = setTimeout(() => {
      interactiveRef.current = initInteractive({
        target: svgElement as SVGElement,
        modal: { enabled: true },
        tooltip: { enabled: true },
      })
    }, 50)

    return () => {
      clearTimeout(timeoutId)
      if (interactiveRef.current) {
        interactiveRef.current.destroy()
        interactiveRef.current = null
      }
    }
  }, [initialSvg])

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
          <button
            onClick={handleZoomOut}
            disabled={!svgContent}
            className={cn(
              'rounded p-1.5 text-neutral-600 dark:text-neutral-400',
              'hover:bg-neutral-200 dark:hover:bg-neutral-700',
              'disabled:opacity-30 disabled:cursor-not-allowed',
            )}
            title="Zoom Out"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            </svg>
          </button>
          <span
            className={cn(
              'min-w-[3.5rem] text-center text-xs tabular-nums',
              'text-neutral-500 dark:text-neutral-400',
            )}
          >
            {Math.round(currentScale * 100)}%
          </span>
          <button
            onClick={handleZoomIn}
            disabled={!svgContent}
            className={cn(
              'rounded p-1.5 text-neutral-600 dark:text-neutral-400',
              'hover:bg-neutral-200 dark:hover:bg-neutral-700',
              'disabled:opacity-30 disabled:cursor-not-allowed',
            )}
            title="Zoom In"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
          </button>
          <div className="mx-1 h-4 w-px bg-neutral-300 dark:bg-neutral-600" />
          <button
            onClick={handleFit}
            disabled={!svgContent}
            className={cn(
              'rounded p-1.5 text-neutral-600 dark:text-neutral-400',
              'hover:bg-neutral-200 dark:hover:bg-neutral-700',
              'disabled:opacity-30 disabled:cursor-not-allowed',
            )}
            title="Fit to View"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
              />
            </svg>
          </button>
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
          isDragging ? 'cursor-grabbing' : svgContent ? 'cursor-grab' : 'cursor-default',
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
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      >
        {initialSvg ? (
          <div
            className="h-full w-full select-none [&>svg]:h-full [&>svg]:w-full"
            dangerouslySetInnerHTML={{ __html: initialSvg }}
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
