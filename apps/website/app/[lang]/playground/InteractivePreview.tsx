'use client'

import { useCallback, useEffect, useMemo, useRef } from 'react'
import { cn } from '@/lib/cn'

interface InteractivePreviewProps {
  svgContent: string | null
  className?: string
}

interface ViewBox {
  x: number
  y: number
  w: number
  h: number
}

export function InteractivePreview({ svgContent, className }: InteractivePreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const scaleDisplayRef = useRef<HTMLSpanElement>(null)

  // ViewBox state (using refs to avoid re-renders)
  const vbRef = useRef<ViewBox>({ x: 0, y: 0, w: 0, h: 0 })
  const origVbRef = useRef<ViewBox>({ x: 0, y: 0, w: 0, h: 0 })
  const dragRef = useRef({ active: false, x: 0, y: 0, vx: 0, vy: 0 })

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

  // Update viewBox on SVG element
  const updateViewBox = useCallback(() => {
    const svg = containerRef.current?.querySelector('svg')
    if (!svg) return
    const vb = vbRef.current
    svg.setAttribute('viewBox', `${vb.x} ${vb.y} ${vb.w} ${vb.h}`)

    // Update scale display
    if (scaleDisplayRef.current) {
      const scale = origVbRef.current.w / vb.w
      scaleDisplayRef.current.textContent = `${Math.round(scale * 100)}%`
    }
  }, [])

  // Fit view to container
  const fitView = useCallback(() => {
    const container = containerRef.current
    if (!container) return
    const orig = origVbRef.current
    const cw = container.clientWidth || 800
    const ch = container.clientHeight || 600
    const scale = Math.min(cw / orig.w, ch / orig.h) * 0.9
    vbRef.current = {
      w: cw / scale,
      h: ch / scale,
      x: orig.x + (orig.w - cw / scale) / 2,
      y: orig.y + (orig.h - ch / scale) / 2,
    }
    updateViewBox()
  }, [updateViewBox])

  // Initialize pan/zoom after SVG is rendered
  useEffect(() => {
    if (!svgHtml || !containerRef.current) return

    const container = containerRef.current
    const svg = container.querySelector('svg')
    if (!svg) return

    // Parse original viewBox
    const w = parseFloat(svg.getAttribute('width') || '') || 800
    const h = parseFloat(svg.getAttribute('height') || '') || 600
    const existing = svg.getAttribute('viewBox')
    if (existing) {
      const p = existing.split(/\s+|,/).map(Number)
      origVbRef.current = { x: p[0] || 0, y: p[1] || 0, w: p[2] || w, h: p[3] || h }
    } else {
      origVbRef.current = { x: 0, y: 0, w, h }
    }

    // Initial fit
    fitView()

    // Wheel zoom
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()
      const vb = vbRef.current
      const orig = origVbRef.current
      const rect = container.getBoundingClientRect()
      const mx = (e.clientX - rect.left) / rect.width
      const my = (e.clientY - rect.top) / rect.height
      const px = vb.x + vb.w * mx
      const py = vb.y + vb.h * my
      const f = e.deltaY > 0 ? 1 / 1.2 : 1.2
      const nw = vb.w / f
      const nh = vb.h / f
      const scale = orig.w / nw
      if (scale < 0.1 || scale > 10) return
      vbRef.current = { x: px - nw * mx, y: py - nh * my, w: nw, h: nh }
      updateViewBox()
    }

    // Mouse drag pan
    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 0) {
        dragRef.current = {
          active: true,
          x: e.clientX,
          y: e.clientY,
          vx: vbRef.current.x,
          vy: vbRef.current.y,
        }
        container.style.cursor = 'grabbing'
      }
    }

    const handleMouseMove = (e: MouseEvent) => {
      const drag = dragRef.current
      if (!drag.active) return
      const vb = vbRef.current
      const sx = vb.w / container.clientWidth
      const sy = vb.h / container.clientHeight
      vbRef.current = {
        ...vb,
        x: drag.vx - (e.clientX - drag.x) * sx,
        y: drag.vy - (e.clientY - drag.y) * sy,
      }
      updateViewBox()
    }

    const handleMouseUp = () => {
      dragRef.current.active = false
      container.style.cursor = ''
    }

    container.addEventListener('wheel', handleWheel, { passive: false })
    container.addEventListener('mousedown', handleMouseDown)
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      container.removeEventListener('wheel', handleWheel)
      container.removeEventListener('mousedown', handleMouseDown)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [svgHtml, fitView, updateViewBox])

  const handleReset = useCallback(() => {
    const orig = origVbRef.current
    vbRef.current = { ...orig }
    updateViewBox()
  }, [updateViewBox])

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
            ref={scaleDisplayRef}
            className={cn(
              'min-w-[3.5rem] text-center text-xs tabular-nums',
              'text-neutral-500 dark:text-neutral-400',
            )}
          >
            100%
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
