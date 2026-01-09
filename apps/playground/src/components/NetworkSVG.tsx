/**
 * Network SVG Renderer Component
 * Renders NetworkGraph using SVG
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import type { NetworkGraph, LayoutResult } from '@shumoku/core/models'

interface NetworkSVGProps {
  network: NetworkGraph | null
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

  // Handle wheel zoom (scroll down = zoom in, like diving into content)
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY * 0.001
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
    if (!layout || !containerRef.current || !svgContent) return

    const container = containerRef.current
    const containerWidth = container.clientWidth
    const containerHeight = container.clientHeight

    if (containerWidth === 0 || containerHeight === 0) return

    // Use layout bounds for sizing
    const svgWidth = layout.bounds.width
    const svgHeight = layout.bounds.height

    if (svgWidth === 0 || svgHeight === 0) return

    // Calculate scale to fit within container
    const scaleX = containerWidth / svgWidth
    const scaleY = containerHeight / svgHeight
    const fitScale = Math.min(scaleX, scaleY, 1) * 0.85 // Cap at 1x, 85% to add margin

    // Center
    const centerX = (containerWidth - svgWidth * fitScale) / 2
    const centerY = (containerHeight - svgHeight * fitScale) / 2

    setScale(fitScale)
    setTranslate({ x: centerX, y: centerY })
  }, [layout, svgContent])

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
        backgroundColor: '#f8fafc',
        cursor: isDragging ? 'grabbing' : 'grab',
        position: 'relative',
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <div
        style={{
          position: 'absolute',
          transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
          transformOrigin: '0 0',
        }}
        dangerouslySetInnerHTML={{ __html: svgContent }}
      />
    </div>
  )
}

export default NetworkSVG
