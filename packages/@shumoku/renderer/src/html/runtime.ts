/**
 * Interactive Runtime - Mobile-first pan/zoom with tap tooltips
 * Based on Panzoom best practices: Pointer Events, CSS transform, map-style UX
 */

import type { InteractiveInstance, InteractiveOptions } from '../types.js'

// ============================================
// Tooltip (HTML overlay, not inside SVG)
// ============================================

let tooltip: HTMLDivElement | null = null

function getTooltip(): HTMLDivElement {
  if (!tooltip) {
    tooltip = document.createElement('div')
    tooltip.style.cssText = `
      position: fixed;
      z-index: 10000;
      padding: 8px 12px;
      background: rgba(30, 41, 59, 0.95);
      color: #fff;
      font-size: 13px;
      line-height: 1.4;
      border-radius: 6px;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.15s;
      font-family: system-ui, -apple-system, sans-serif;
      max-width: 280px;
      white-space: pre-line;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    `
    document.body.appendChild(tooltip)
  }
  return tooltip
}

function showTooltip(text: string, x: number, y: number): void {
  const t = getTooltip()
  t.textContent = text
  t.style.opacity = '1'

  // Position with viewport bounds check
  requestAnimationFrame(() => {
    const rect = t.getBoundingClientRect()
    const pad = 12
    let left = x + pad
    let top = y - rect.height - pad

    // Flip if off-screen
    if (left + rect.width > window.innerWidth - pad) {
      left = x - rect.width - pad
    }
    if (top < pad) {
      top = y + pad
    }

    t.style.left = `${Math.max(pad, left)}px`
    t.style.top = `${Math.max(pad, top)}px`
  })
}

function hideTooltip(): void {
  if (tooltip) {
    tooltip.style.opacity = '0'
  }
}

// ============================================
// Tooltip Info Extraction
// ============================================

interface TooltipInfo {
  text: string
  element: Element
}

function getTooltipInfo(el: Element): TooltipInfo | null {
  // Port
  const port = el.closest('.port[data-port]')
  if (port) {
    const portId = port.getAttribute('data-port') || ''
    const deviceId = port.getAttribute('data-port-device') || ''
    return { text: `${deviceId}:${portId}`, element: port }
  }

  // Link
  const linkGroup = el.closest('.link-group[data-link-id]')
  if (linkGroup) {
    const from = linkGroup.getAttribute('data-link-from') || ''
    const to = linkGroup.getAttribute('data-link-to') || ''
    const bw = linkGroup.getAttribute('data-link-bandwidth')
    const vlan = linkGroup.getAttribute('data-link-vlan')

    let text = `${from} ↔ ${to}`
    if (bw) text += `\n${bw}`
    if (vlan) text += `\nVLAN: ${vlan}`
    return { text, element: linkGroup }
  }

  // Device
  const node = el.closest('.node[data-id]')
  if (node) {
    const json = node.getAttribute('data-device-json')
    if (json) {
      try {
        const data = JSON.parse(json)
        const lines: string[] = []
        if (data.label) lines.push(Array.isArray(data.label) ? data.label.join(' ') : data.label)
        if (data.type) lines.push(`Type: ${data.type}`)
        if (data.vendor) lines.push(`Vendor: ${data.vendor}`)
        if (data.model) lines.push(`Model: ${data.model}`)
        return { text: lines.join('\n'), element: node }
      } catch {
        // fallthrough
      }
    }
    return { text: node.getAttribute('data-id') || '', element: node }
  }

  return null
}

// ============================================
// ViewBox Utilities
// ============================================

interface ViewBox {
  x: number
  y: number
  width: number
  height: number
}

function parseViewBox(svg: SVGSVGElement): ViewBox | null {
  const vb = svg.getAttribute('viewBox')
  if (!vb) return null
  const parts = vb.split(/\s+|,/).map(Number)
  if (parts.length !== 4 || parts.some(Number.isNaN)) return null
  return { x: parts[0], y: parts[1], width: parts[2], height: parts[3] }
}

function setViewBox(svg: SVGSVGElement, vb: ViewBox): void {
  svg.setAttribute('viewBox', `${vb.x} ${vb.y} ${vb.width} ${vb.height}`)
}

// ============================================
// Main Interactive Runtime
// ============================================

export function initInteractive(options: InteractiveOptions): InteractiveInstance {
  const target =
    typeof options.target === 'string' ? document.querySelector(options.target) : options.target

  if (!target) throw new Error('Target not found')

  const svg = target.closest('svg') || target.querySelector('svg') || (target as SVGSVGElement)
  if (!(svg instanceof SVGSVGElement)) throw new Error('SVG element not found')

  // Settings
  const panZoomEnabled = options.panZoom?.enabled ?? true
  const minScale = options.panZoom?.minScale ?? 0.1
  const maxScale = options.panZoom?.maxScale ?? 10
  const ZOOM_FACTOR = 1.2
  const DRAG_THRESHOLD = 10 // px - if moved more than this, it's a drag not a tap

  // Store original viewBox
  let originalViewBox: ViewBox | null = parseViewBox(svg)
  if (!originalViewBox) {
    const bbox = svg.getBBox()
    originalViewBox = { x: bbox.x, y: bbox.y, width: bbox.width, height: bbox.height }
    setViewBox(svg, originalViewBox)
  }

  // State
  let tooltipActive = false
  const activePointers = new Map<number, { x: number; y: number }>()
  let pointerStartPos: { x: number; y: number } | null = null
  let hasMoved = false
  let isPanning = false
  let panStartViewBox: ViewBox | null = null

  // Pinch state
  let initialPinchDistance = 0
  let pinchStartViewBox: ViewBox | null = null
  let pinchCenter: { x: number; y: number } | null = null

  // Get current scale
  const getScale = (): number => {
    if (!originalViewBox) return 1
    const current = parseViewBox(svg)
    if (!current) return 1
    return originalViewBox.width / current.width
  }

  // Reset view
  const resetView = () => {
    if (originalViewBox) {
      setViewBox(svg, originalViewBox)
    }
  }

  // Calculate distance between two pointers
  const getPointerDistance = (): number => {
    const pointers = Array.from(activePointers.values())
    if (pointers.length < 2) return 0
    return Math.hypot(pointers[1].x - pointers[0].x, pointers[1].y - pointers[0].y)
  }

  // Calculate center between two pointers
  const getPointerCenter = (): { x: number; y: number } | null => {
    const pointers = Array.from(activePointers.values())
    if (pointers.length < 2) return null
    return {
      x: (pointers[0].x + pointers[1].x) / 2,
      y: (pointers[0].y + pointers[1].y) / 2,
    }
  }

  // Convert screen coords to viewBox coords
  const screenToViewBox = (
    screenX: number,
    screenY: number,
    vb: ViewBox,
  ): { x: number; y: number } => {
    const rect = svg.getBoundingClientRect()
    const xRatio = (screenX - rect.left) / rect.width
    const yRatio = (screenY - rect.top) / rect.height
    return {
      x: vb.x + vb.width * xRatio,
      y: vb.y + vb.height * yRatio,
    }
  }

  // ============================================
  // Pointer Events (unified touch/mouse)
  // ============================================

  const handlePointerDown = (e: PointerEvent) => {
    activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
    svg.setPointerCapture(e.pointerId)

    if (activePointers.size === 1) {
      // Single pointer - potential tap or pan start
      pointerStartPos = { x: e.clientX, y: e.clientY }
      hasMoved = false
      panStartViewBox = parseViewBox(svg)
    } else if (activePointers.size === 2 && panZoomEnabled) {
      // Two pointers - pinch start
      isPanning = false
      initialPinchDistance = getPointerDistance()
      pinchStartViewBox = parseViewBox(svg)
      const center = getPointerCenter()
      if (center && pinchStartViewBox) {
        pinchCenter = screenToViewBox(center.x, center.y, pinchStartViewBox)
      }
      // Close tooltip when starting pinch
      if (tooltipActive) {
        hideTooltip()
        tooltipActive = false
      }
    }
  }

  const handlePointerMove = (e: PointerEvent) => {
    if (!activePointers.has(e.pointerId)) return
    activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY })

    // Check if moved beyond threshold
    if (pointerStartPos && !hasMoved) {
      const dx = e.clientX - pointerStartPos.x
      const dy = e.clientY - pointerStartPos.y
      if (Math.hypot(dx, dy) > DRAG_THRESHOLD) {
        hasMoved = true
        isPanning = true
        // Close tooltip when starting pan
        if (tooltipActive) {
          hideTooltip()
          tooltipActive = false
        }
      }
    }

    if (!panZoomEnabled) return

    if (activePointers.size === 1 && isPanning && panStartViewBox) {
      // Single pointer pan
      const dx = e.clientX - pointerStartPos!.x
      const dy = e.clientY - pointerStartPos!.y
      const rect = svg.getBoundingClientRect()
      const scaleX = panStartViewBox.width / rect.width
      const scaleY = panStartViewBox.height / rect.height

      setViewBox(svg, {
        x: panStartViewBox.x - dx * scaleX,
        y: panStartViewBox.y - dy * scaleY,
        width: panStartViewBox.width,
        height: panStartViewBox.height,
      })
    } else if (activePointers.size === 2 && pinchStartViewBox && pinchCenter && originalViewBox) {
      // Pinch zoom
      const distance = getPointerDistance()
      if (distance === 0 || initialPinchDistance === 0) return

      const scale = distance / initialPinchDistance
      const newWidth = pinchStartViewBox.width / scale
      const newHeight = pinchStartViewBox.height / scale

      // Check scale limits
      const newScale = originalViewBox.width / newWidth
      if (newScale < minScale || newScale > maxScale) return

      // Zoom towards pinch center
      const center = getPointerCenter()
      if (center) {
        const rect = svg.getBoundingClientRect()
        const xRatio = (center.x - rect.left) / rect.width
        const yRatio = (center.y - rect.top) / rect.height

        setViewBox(svg, {
          x: pinchCenter.x - newWidth * xRatio,
          y: pinchCenter.y - newHeight * yRatio,
          width: newWidth,
          height: newHeight,
        })
      }
    }
  }

  const handlePointerUp = (e: PointerEvent) => {
    const wasMultiTouch = activePointers.size >= 2
    activePointers.delete(e.pointerId)
    svg.releasePointerCapture(e.pointerId)

    if (activePointers.size === 0) {
      // All pointers released
      // Handle tap only if: single touch, didn't move, wasn't multi-touch
      if (!hasMoved && !wasMultiTouch && pointerStartPos) {
        const targetEl = document.elementFromPoint(e.clientX, e.clientY)
        if (targetEl) {
          const info = getTooltipInfo(targetEl)
          if (info) {
            showTooltip(info.text, e.clientX, e.clientY)
            tooltipActive = true
          } else if (tooltipActive) {
            // Tap on empty area - close tooltip
            hideTooltip()
            tooltipActive = false
          }
        }
      }

      // Reset state
      isPanning = false
      panStartViewBox = null
      pointerStartPos = null
      hasMoved = false
    } else if (activePointers.size === 1) {
      // Switched from pinch to pan
      pinchStartViewBox = null
      pinchCenter = null
      const remaining = Array.from(activePointers.values())[0]
      pointerStartPos = { x: remaining.x, y: remaining.y }
      panStartViewBox = parseViewBox(svg)
      hasMoved = true // Already moving, so it's a pan
      isPanning = true
    }
  }

  const handlePointerCancel = (e: PointerEvent) => {
    activePointers.delete(e.pointerId)
    if (activePointers.size === 0) {
      isPanning = false
      panStartViewBox = null
      pinchStartViewBox = null
      pinchCenter = null
      pointerStartPos = null
      hasMoved = false
    }
  }

  // ============================================
  // Mouse Wheel Zoom
  // ============================================

  const handleWheel = (e: WheelEvent) => {
    if (!panZoomEnabled) return
    e.preventDefault()

    const vb = parseViewBox(svg)
    if (!vb || !originalViewBox) return

    const rect = svg.getBoundingClientRect()
    const mouseX = vb.x + vb.width * ((e.clientX - rect.left) / rect.width)
    const mouseY = vb.y + vb.height * ((e.clientY - rect.top) / rect.height)

    const zoomFactor = e.deltaY > 0 ? ZOOM_FACTOR : 1 / ZOOM_FACTOR
    const newWidth = vb.width * zoomFactor
    const newHeight = vb.height * zoomFactor

    // Check scale limits
    const newScale = originalViewBox.width / newWidth
    if (newScale < minScale || newScale > maxScale) return

    const xRatio = (e.clientX - rect.left) / rect.width
    const yRatio = (e.clientY - rect.top) / rect.height

    setViewBox(svg, {
      x: mouseX - newWidth * xRatio,
      y: mouseY - newHeight * yRatio,
      width: newWidth,
      height: newHeight,
    })
  }

  // ============================================
  // Desktop Hover (mouse only, not touch)
  // ============================================

  const handleMouseMove = (e: MouseEvent) => {
    // Skip if touch device or panning
    if (activePointers.size > 0 || isPanning) return

    const info = getTooltipInfo(e.target as Element)
    if (info) {
      showTooltip(info.text, e.clientX, e.clientY)
    } else {
      hideTooltip()
    }
  }

  const handleMouseLeave = () => {
    if (activePointers.size === 0 && !tooltipActive) {
      hideTooltip()
    }
  }

  // ============================================
  // Setup
  // ============================================

  // Prevent default touch behaviors
  if (panZoomEnabled) {
    svg.style.touchAction = 'none'
  }

  // Add event listeners
  svg.addEventListener('pointerdown', handlePointerDown)
  svg.addEventListener('pointermove', handlePointerMove)
  svg.addEventListener('pointerup', handlePointerUp)
  svg.addEventListener('pointercancel', handlePointerCancel)
  svg.addEventListener('wheel', handleWheel, { passive: false })
  svg.addEventListener('mousemove', handleMouseMove)
  svg.addEventListener('mouseleave', handleMouseLeave)

  return {
    destroy: () => {
      svg.removeEventListener('pointerdown', handlePointerDown)
      svg.removeEventListener('pointermove', handlePointerMove)
      svg.removeEventListener('pointerup', handlePointerUp)
      svg.removeEventListener('pointercancel', handlePointerCancel)
      svg.removeEventListener('wheel', handleWheel)
      svg.removeEventListener('mousemove', handleMouseMove)
      svg.removeEventListener('mouseleave', handleMouseLeave)
      if (tooltip) {
        tooltip.remove()
        tooltip = null
      }
    },
    showDeviceModal: () => {},
    hideModal: () => {},
    showLinkTooltip: () => {},
    hideTooltip: () => {
      hideTooltip()
      tooltipActive = false
    },
    resetView,
    getScale,
  }
}
