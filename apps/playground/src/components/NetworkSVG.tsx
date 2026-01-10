/**
 * Network SVG Viewer Component
 * シンプルなズーム・パン機能付きSVGビューアー
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
  layout,
  svgContent,
  onNodeClick,
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  const [scale, setScale] = useState(1)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })

  // ビューをリセット
  const resetView = useCallback(() => {
    if (!layout || !containerRef.current) return

    const container = containerRef.current
    const containerWidth = container.clientWidth
    const containerHeight = container.clientHeight

    const svgWidth = layout.bounds.width
    const svgHeight = layout.bounds.height

    if (svgWidth === 0 || svgHeight === 0) {
      setScale(1)
      setPosition({ x: 0, y: 0 })
      return
    }

    // コンテナに収まるスケールを計算（余白80%）
    const scaleX = containerWidth / svgWidth
    const scaleY = containerHeight / svgHeight
    const fitScale = Math.min(scaleX, scaleY) * 0.8

    // 中央配置
    const centerX = (containerWidth - svgWidth * fitScale) / 2
    const centerY = (containerHeight - svgHeight * fitScale) / 2

    setScale(fitScale)
    setPosition({ x: centerX, y: centerY })
  }, [layout])

  // 初期表示時にビューをリセット
  useEffect(() => {
    if (svgContent && layout && containerRef.current) {
      const container = containerRef.current
      const containerWidth = container.clientWidth
      const containerHeight = container.clientHeight

      const svgWidth = layout.bounds.width
      const svgHeight = layout.bounds.height

      if (svgWidth > 0 && svgHeight > 0) {
        const scaleX = containerWidth / svgWidth
        const scaleY = containerHeight / svgHeight
        const fitScale = Math.min(scaleX, scaleY) * 0.8

        const centerX = (containerWidth - svgWidth * fitScale) / 2
        const centerY = (containerHeight - svgHeight * fitScale) / 2

        setScale(fitScale)
        setPosition({ x: centerX, y: centerY })
      }
    }
  }, [svgContent, layout])

  // ホイールズーム（スクロールアップで拡大、ダウンで縮小）
  const handleWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault()

      const container = containerRef.current
      if (!container) return

      // マウス位置を取得
      const rect = container.getBoundingClientRect()
      const mouseX = e.clientX - rect.left
      const mouseY = e.clientY - rect.top

      // ズーム倍率を計算（スクロールアップで拡大）
      const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9
      const newScale = Math.min(Math.max(0.1, scale * zoomFactor), 5)

      // マウス位置を中心にズーム
      const scaleChange = newScale / scale
      const newX = mouseX - (mouseX - position.x) * scaleChange
      const newY = mouseY - (mouseY - position.y) * scaleChange

      setScale(newScale)
      setPosition({ x: newX, y: newY })
    },
    [scale, position],
  )

  // ホイールイベント登録
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    container.addEventListener('wheel', handleWheel, { passive: false })
    return () => {
      container.removeEventListener('wheel', handleWheel)
    }
  }, [handleWheel])

  // ドラッグ開始
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return // 左クリックのみ
      setIsDragging(true)
      setDragStart({
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      })
    },
    [position],
  )

  // ドラッグ中
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging) return
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      })
    },
    [isDragging, dragStart],
  )

  // ドラッグ終了
  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  // ズームイン
  const zoomIn = useCallback(() => {
    const container = containerRef.current
    if (!container) return

    const centerX = container.clientWidth / 2
    const centerY = container.clientHeight / 2
    const newScale = Math.min(scale * 1.2, 5)
    const scaleChange = newScale / scale

    setScale(newScale)
    setPosition({
      x: centerX - (centerX - position.x) * scaleChange,
      y: centerY - (centerY - position.y) * scaleChange,
    })
  }, [scale, position])

  // ズームアウト
  const zoomOut = useCallback(() => {
    const container = containerRef.current
    if (!container) return

    const centerX = container.clientWidth / 2
    const centerY = container.clientHeight / 2
    const newScale = Math.max(scale / 1.2, 0.1)
    const scaleChange = newScale / scale

    setScale(newScale)
    setPosition({
      x: centerX - (centerX - position.x) * scaleChange,
      y: centerY - (centerY - position.y) * scaleChange,
    })
  }, [scale, position])

  // ノードクリック処理
  useEffect(() => {
    const content = contentRef.current
    if (!content || !onNodeClick) return

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

    content.addEventListener('click', handleClick)
    return () => {
      content.removeEventListener('click', handleClick)
    }
  }, [onNodeClick])

  if (!svgContent) {
    return (
      <div className="network-svg-container network-svg-empty">
        <p>Click "Render" to generate diagram</p>
      </div>
    )
  }

  return (
    <div className="network-svg-wrapper">
      {/* ズームコントロール */}
      <div className="zoom-controls">
        <button onClick={zoomIn} title="Zoom In">+</button>
        <span className="zoom-level">{Math.round(scale * 100)}%</span>
        <button onClick={zoomOut} title="Zoom Out">−</button>
        <button onClick={resetView} title="Reset View" className="reset-btn">
          ⟲
        </button>
      </div>

      {/* SVGビューアー */}
      <div
        ref={containerRef}
        className="network-svg-container"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
      >
        <div
          ref={contentRef}
          className="network-svg-content"
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
            transformOrigin: '0 0',
          }}
          dangerouslySetInnerHTML={{ __html: svgContent }}
        />
      </div>
    </div>
  )
}

export default NetworkSVG
