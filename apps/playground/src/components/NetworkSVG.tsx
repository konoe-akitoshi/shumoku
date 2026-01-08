/**
 * Network SVG Renderer Component (v2)
 * Renders NetworkGraphV2 using SVG
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import type { NetworkGraphV2, LayoutResult } from '@shumoku/core/models/v2'

interface NetworkSVGProps {
  network: NetworkGraphV2 | null
  layout: LayoutResult | null
  svgContent: string | null
  onNodeClick?: (nodeId: string) => void
}

export const NetworkSVG: React.FC<NetworkSVGProps> = ({
  network,
  layout,
  svgContent,
  onNodeClick,
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [translate, setTranslate] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })

  // Handle wheel zoom
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY * -0.001
    const newScale = Math.min(Math.max(0.2, scale + delta), 3)
    setScale(newScale)
  }, [scale])

  // Handle mouse down for pan
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0) {
      setIsDragging(true)
      setDragStart({ x: e.clientX - translate.x, y: e.clientY - translate.y })
    }
  }, [translate])

  // Handle mouse move for pan
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging) {
      setTranslate({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      })
    }
  }, [isDragging, dragStart])

  // Handle mouse up
  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  // Add wheel listener
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    container.addEventListener('wheel', handleWheel, { passive: false })
    return () => {
      container.removeEventListener('wheel', handleWheel)
    }
  }, [handleWheel])

  // Handle node clicks
  useEffect(() => {
    const container = containerRef.current
    if (!container || !onNodeClick) return

    const handleClick = (e: MouseEvent) => {
      const target = e.target as Element
      const nodeGroup = target.closest('.node')
      if (nodeGroup) {
        const nodeId = nodeGroup.getAttribute('data-id')
        if (nodeId) {
          onNodeClick(nodeId)
        }
      }
    }

    container.addEventListener('click', handleClick)
    return () => {
      container.removeEventListener('click', handleClick)
    }
  }, [onNodeClick])

  // Center the view initially
  useEffect(() => {
    if (!layout || !containerRef.current) return

    const container = containerRef.current
    const { bounds } = layout
    const containerWidth = container.clientWidth
    const containerHeight = container.clientHeight

    // Calculate scale to fit
    const scaleX = containerWidth / bounds.width
    const scaleY = containerHeight / bounds.height
    const fitScale = Math.min(scaleX, scaleY, 1) * 0.9

    // Center
    const centerX = (containerWidth - bounds.width * fitScale) / 2 - bounds.x * fitScale
    const centerY = (containerHeight - bounds.height * fitScale) / 2 - bounds.y * fitScale

    setScale(fitScale)
    setTranslate({ x: centerX, y: centerY })
  }, [layout])

  if (!svgContent) {
    return (
      <div
        ref={containerRef}
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f8fafc',
          color: '#64748b',
        }}
      >
        <p>No network data to display</p>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        backgroundColor: '#ffffff',
        cursor: isDragging ? 'grabbing' : 'grab',
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <div
        style={{
          transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
          transformOrigin: '0 0',
        }}
        dangerouslySetInnerHTML={{ __html: svgContent }}
      />
    </div>
  )
}

export default NetworkSVG
