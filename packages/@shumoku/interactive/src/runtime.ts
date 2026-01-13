/**
 * Interactive Runtime - Hover tooltip with touch support and pan/zoom
 */

import type { InteractiveInstance, InteractiveOptions } from './types.js'

let tooltip: HTMLDivElement | null = null
let overlay: HTMLDivElement | null = null
let currentHighlight: Element | null = null
let isTouchDevice = false

function getTooltip(): HTMLDivElement {
  if (!tooltip) {
    tooltip = document.createElement('div')
    tooltip.style.cssText = `
      position: fixed;
      z-index: 10000;
      padding: 6px 10px;
      background: #1e293b;
      color: #fff;
      font-size: 12px;
      border-radius: 4px;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.15s;
      font-family: system-ui, sans-serif;
      max-width: 300px;
      white-space: pre-line;
    `
    document.body.appendChild(tooltip)
  }
  return tooltip
}

function showTooltip(text: string, x: number, y: number): void {
  const t = getTooltip()
  t.textContent = text

  // Position tooltip, keeping it within viewport
  const pad = 12
  let left = x + pad
  let top = y + pad

  // Adjust if tooltip would go off-screen
  requestAnimationFrame(() => {
    const rect = t.getBoundingClientRect()
    if (left + rect.width > window.innerWidth - pad) {
      left = x - rect.width - pad
    }
    if (top + rect.height > window.innerHeight - pad) {
      top = y - rect.height - pad
    }
    t.style.left = `${Math.max(pad, left)}px`
    t.style.top = `${Math.max(pad, top)}px`
  })

  t.style.left = `${left}px`
  t.style.top = `${top}px`
  t.style.opacity = '1'
}

function hideTooltip(): void {
  if (tooltip) {
    tooltip.style.opacity = '0'
  }
}

function getOverlay(): HTMLDivElement {
  if (!overlay) {
    overlay = document.createElement('div')
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.15s ease;
      z-index: 9998;
    `
    document.body.appendChild(overlay)
  }
  return overlay
}

let highlightContainer: HTMLDivElement | null = null
let currentMiniSvg: SVGSVGElement | null = null

function getHighlightContainer(): HTMLDivElement {
  if (!highlightContainer) {
    highlightContainer = document.createElement('div')
    highlightContainer.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      pointer-events: none;
      z-index: 9999;
    `
    document.body.appendChild(highlightContainer)
  }
  return highlightContainer
}

function updateHighlightPosition(): void {
  if (!currentHighlight || !currentMiniSvg) return

  // Check if element is still in DOM (React may have replaced it)
  if (!document.contains(currentHighlight)) {
    // Element was removed, clear highlight
    highlightElement(null)
    return
  }

  const svg = currentHighlight.closest('svg') as SVGSVGElement | null
  if (!svg) return

  // Use getBoundingClientRect for screen position
  const rect = svg.getBoundingClientRect()

  // Update viewBox to match current zoom level
  const viewBox = svg.getAttribute('viewBox')
  if (viewBox) {
    currentMiniSvg.setAttribute('viewBox', viewBox)
  }

  currentMiniSvg.style.left = `${rect.left}px`
  currentMiniSvg.style.top = `${rect.top}px`
  currentMiniSvg.style.width = `${rect.width}px`
  currentMiniSvg.style.height = `${rect.height}px`
}

function highlightElement(el: Element | null): void {
  // Skip if already highlighting the same element
  if (el === currentHighlight) {
    return
  }

  // Remove previous highlight
  if (currentHighlight) {
    currentHighlight.classList.remove('shumoku-highlight')
  }

  // Clear previous mini SVG
  const container = getHighlightContainer()
  container.innerHTML = ''
  currentMiniSvg = null

  currentHighlight = el
  const ov = getOverlay()

  if (el) {
    el.classList.add('shumoku-highlight')

    const svg = el.closest('svg') as SVGSVGElement | null
    if (svg) {
      const viewBox = svg.getAttribute('viewBox')
      if (viewBox) {
        // Clone the highlighted element
        const clone = el.cloneNode(true) as Element
        clone.classList.remove('shumoku-highlight')

        // Create mini SVG with same viewBox
        const miniSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
        miniSvg.setAttribute('viewBox', viewBox)
        miniSvg.style.cssText = `
          position: absolute;
          overflow: visible;
          filter: drop-shadow(0 0 4px #fff) drop-shadow(0 0 8px #fff) drop-shadow(0 0 12px rgba(100, 150, 255, 0.8));
        `

        // Copy defs (for gradients, patterns, etc.)
        const defs = svg.querySelector('defs')
        if (defs) {
          miniSvg.appendChild(defs.cloneNode(true))
        }

        miniSvg.appendChild(clone)
        container.appendChild(miniSvg)
        currentMiniSvg = miniSvg

        // Update position
        updateHighlightPosition()
      }
    }

    ov.style.opacity = '1'
  } else {
    ov.style.opacity = '0'
  }
}

function injectHighlightStyles(): void {
  // No styles needed for current approach
}

interface TooltipInfo {
  text: string
  element: Element
}

function getTooltipInfo(el: Element): TooltipInfo | null {
  // Port tooltip (ports are now separate layer)
  const port = el.closest('.port[data-port]')
  if (port) {
    const portId = port.getAttribute('data-port') || ''
    const deviceId = port.getAttribute('data-port-device') || ''
    return { text: `${deviceId}:${portId}`, element: port }
  }

  // Link tooltip
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

  // Device tooltip (single label only)
  const node = el.closest('.node[data-id]')
  if (node) {
    const json = node.getAttribute('data-device-json')
    let text: string
    if (json) {
      try {
        const data = JSON.parse(json)
        text = data.label || data.id
      } catch {
        text = node.getAttribute('data-id') || ''
      }
    } else {
      text = node.getAttribute('data-id') || ''
    }
    return { text, element: node }
  }

  return null
}

// ViewBox utilities
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
  if (parts.length !== 4 || parts.some(isNaN)) return null
  return { x: parts[0], y: parts[1], width: parts[2], height: parts[3] }
}

function setViewBox(svg: SVGSVGElement, vb: ViewBox): void {
  svg.setAttribute('viewBox', `${vb.x} ${vb.y} ${vb.width} ${vb.height}`)
}

export function initInteractive(options: InteractiveOptions): InteractiveInstance {
  const target = typeof options.target === 'string'
    ? document.querySelector(options.target)
    : options.target

  if (!target) throw new Error('Target not found')

  const svg = target.closest('svg') || target.querySelector('svg') || target as SVGSVGElement
  if (!(svg instanceof SVGSVGElement)) throw new Error('SVG element not found')

  // Inject highlight styles
  injectHighlightStyles()

  // Pan/Zoom settings
  const panZoomEnabled = options.panZoom?.enabled ?? true
  const minScale = options.panZoom?.minScale ?? 0.1
  const maxScale = options.panZoom?.maxScale ?? 10
  const ZOOM_FACTOR = 1.2

  // Store original viewBox for reset and scale calculation
  let originalViewBox: ViewBox | null = null
  const initViewBox = () => {
    originalViewBox = parseViewBox(svg)
    if (!originalViewBox) {
      // Fallback: use SVG bounding box
      const bbox = svg.getBBox()
      originalViewBox = { x: bbox.x, y: bbox.y, width: bbox.width, height: bbox.height }
      setViewBox(svg, originalViewBox)
    }
  }
  initViewBox()

  // Calculate current scale
  const getScale = (): number => {
    if (!originalViewBox) return 1
    const current = parseViewBox(svg)
    if (!current) return 1
    return originalViewBox.width / current.width
  }

  // Track if we're currently showing a touch tooltip
  let touchTooltipActive = false

  // Pan state
  let isPanning = false
  let panStartX = 0
  let panStartY = 0
  let panStartViewBox: ViewBox | null = null

  // Pinch state
  let initialPinchDistance = 0
  let pinchStartViewBox: ViewBox | null = null
  let pinchCenter: { x: number; y: number } | null = null

  // Mouse move handler (desktop hover)
  const handleMouseMove = (e: Event) => {
    if (isPanning) return
    if (isTouchDevice) return // Skip on touch devices

    const me = e as MouseEvent
    const info = getTooltipInfo(me.target as Element)
    if (info) {
      showTooltip(info.text, me.clientX, me.clientY)
      highlightElement(info.element)
    } else {
      hideTooltip()
      highlightElement(null)
    }
  }

  // Mouse leave handler
  const handleMouseLeave = () => {
    if (isTouchDevice) return
    if (isPanning) return
    hideTooltip()
    highlightElement(null)
  }

  // Mouse down - start pan
  const handleMouseDown = (e: Event) => {
    if (!panZoomEnabled) return
    const me = e as MouseEvent
    if (me.button !== 0) return // Left button only

    // Don't start pan if clicking on interactive element
    const info = getTooltipInfo(me.target as Element)
    if (info) return

    isPanning = true
    panStartX = me.clientX
    panStartY = me.clientY
    panStartViewBox = parseViewBox(svg)
    svg.style.cursor = 'grabbing'
    e.preventDefault()
  }

  // Mouse move - pan
  const handlePan = (e: Event) => {
    if (!isPanning || !panStartViewBox) return
    const me = e as MouseEvent

    const rect = svg.getBoundingClientRect()
    const dx = me.clientX - panStartX
    const dy = me.clientY - panStartY

    // Convert screen delta to viewBox delta
    const scaleX = panStartViewBox.width / rect.width
    const scaleY = panStartViewBox.height / rect.height

    setViewBox(svg, {
      x: panStartViewBox.x - dx * scaleX,
      y: panStartViewBox.y - dy * scaleY,
      width: panStartViewBox.width,
      height: panStartViewBox.height,
    })
  }

  // Mouse up - end pan
  const handleMouseUp = () => {
    if (isPanning) {
      isPanning = false
      panStartViewBox = null
      svg.style.cursor = ''
    }
  }

  // Wheel zoom
  const handleWheel = (e: Event) => {
    if (!panZoomEnabled) return
    const we = e as WheelEvent
    we.preventDefault()

    const vb = parseViewBox(svg)
    if (!vb || !originalViewBox) return

    const rect = svg.getBoundingClientRect()
    const mouseXRatio = (we.clientX - rect.left) / rect.width
    const mouseYRatio = (we.clientY - rect.top) / rect.height

    const mouseX = vb.x + vb.width * mouseXRatio
    const mouseY = vb.y + vb.height * mouseYRatio

    const zoomFactor = we.deltaY > 0 ? ZOOM_FACTOR : 1 / ZOOM_FACTOR
    const newWidth = vb.width * zoomFactor
    const newHeight = vb.height * zoomFactor

    // Check scale limits
    const newScale = originalViewBox.width / newWidth
    if (newScale < minScale || newScale > maxScale) return

    setViewBox(svg, {
      x: mouseX - newWidth * mouseXRatio,
      y: mouseY - newHeight * mouseYRatio,
      width: newWidth,
      height: newHeight,
    })
  }

  // Touch start handler
  const handleTouchStart = (e: Event) => {
    isTouchDevice = true
    const te = e as TouchEvent

    if (te.touches.length === 1 && panZoomEnabled) {
      // Single touch - check if on interactive element first
      const touch = te.touches[0]
      const targetEl = document.elementFromPoint(touch.clientX, touch.clientY)
      const info = targetEl ? getTooltipInfo(targetEl) : null

      if (!info) {
        // Start pan
        isPanning = true
        panStartX = touch.clientX
        panStartY = touch.clientY
        panStartViewBox = parseViewBox(svg)
      }
    } else if (te.touches.length === 2 && panZoomEnabled) {
      // Two touches - start pinch
      isPanning = false
      const t1 = te.touches[0]
      const t2 = te.touches[1]
      initialPinchDistance = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY)
      pinchStartViewBox = parseViewBox(svg)

      // Calculate pinch center in viewBox coordinates
      const rect = svg.getBoundingClientRect()
      const centerX = (t1.clientX + t2.clientX) / 2
      const centerY = (t1.clientY + t2.clientY) / 2
      const vb = pinchStartViewBox
      if (vb) {
        const xRatio = (centerX - rect.left) / rect.width
        const yRatio = (centerY - rect.top) / rect.height
        pinchCenter = {
          x: vb.x + vb.width * xRatio,
          y: vb.y + vb.height * yRatio,
        }
      }
    }
  }

  // Touch move handler
  const handleTouchMove = (e: Event) => {
    const te = e as TouchEvent

    if (te.touches.length === 1 && isPanning && panStartViewBox) {
      // Pan
      const touch = te.touches[0]
      const rect = svg.getBoundingClientRect()
      const dx = touch.clientX - panStartX
      const dy = touch.clientY - panStartY

      const scaleX = panStartViewBox.width / rect.width
      const scaleY = panStartViewBox.height / rect.height

      setViewBox(svg, {
        x: panStartViewBox.x - dx * scaleX,
        y: panStartViewBox.y - dy * scaleY,
        width: panStartViewBox.width,
        height: panStartViewBox.height,
      })

      te.preventDefault()
    } else if (te.touches.length === 2 && pinchStartViewBox && pinchCenter && originalViewBox) {
      // Pinch zoom
      const t1 = te.touches[0]
      const t2 = te.touches[1]
      const distance = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY)
      const scale = distance / initialPinchDistance

      const newWidth = pinchStartViewBox.width / scale
      const newHeight = pinchStartViewBox.height / scale

      // Check scale limits
      const newScale = originalViewBox.width / newWidth
      if (newScale < minScale || newScale > maxScale) return

      // Zoom towards pinch center
      const rect = svg.getBoundingClientRect()
      const centerX = (t1.clientX + t2.clientX) / 2
      const centerY = (t1.clientY + t2.clientY) / 2
      const xRatio = (centerX - rect.left) / rect.width
      const yRatio = (centerY - rect.top) / rect.height

      setViewBox(svg, {
        x: pinchCenter.x - newWidth * xRatio,
        y: pinchCenter.y - newHeight * yRatio,
        width: newWidth,
        height: newHeight,
      })

      te.preventDefault()
    }
  }

  // Touch end handler
  const handleTouchEnd = (e: Event) => {
    const te = e as TouchEvent

    if (te.touches.length === 0) {
      isPanning = false
      panStartViewBox = null
      pinchStartViewBox = null
      pinchCenter = null
    } else if (te.touches.length === 1) {
      // Switched from pinch to pan
      pinchStartViewBox = null
      pinchCenter = null
      isPanning = true
      const touch = te.touches[0]
      panStartX = touch.clientX
      panStartY = touch.clientY
      panStartViewBox = parseViewBox(svg)
    }
  }

  // Touch/click handler for mobile tooltip
  const handleTap = (e: Event) => {
    if (!isTouchDevice) return
    if (isPanning) return

    const me = e as MouseEvent
    const targetEl = e.target as Element
    const info = getTooltipInfo(targetEl)

    if (info) {
      // Show tooltip at tap position
      showTooltip(info.text, me.clientX, me.clientY)
      highlightElement(info.element)
      touchTooltipActive = true
      e.preventDefault()
    } else if (touchTooltipActive) {
      // Tap on empty area - hide tooltip
      hideTooltip()
      highlightElement(null)
      touchTooltipActive = false
    }
  }

  // Position update handler for scroll/resize events
  const handlePositionUpdate = () => {
    updateHighlightPosition()
  }

  // Track viewBox changes for pan/zoom
  let rafId: number | null = null
  let lastViewBox = ''
  const trackViewBox = () => {
    if (currentHighlight) {
      const viewBox = svg.getAttribute('viewBox') || ''
      if (viewBox !== lastViewBox) {
        lastViewBox = viewBox
        updateHighlightPosition()
      }
    }
    rafId = requestAnimationFrame(trackViewBox)
  }
  rafId = requestAnimationFrame(trackViewBox)

  // Reset view
  const resetView = () => {
    if (originalViewBox) {
      setViewBox(svg, originalViewBox)
    }
  }

  // Set touch-action to prevent browser gestures
  if (panZoomEnabled) {
    svg.style.touchAction = 'none'
  }

  // Add event listeners
  svg.addEventListener('mousemove', handleMouseMove)
  svg.addEventListener('mouseleave', handleMouseLeave)
  svg.addEventListener('mousedown', handleMouseDown)
  svg.addEventListener('click', handleTap)
  svg.addEventListener('wheel', handleWheel, { passive: false })
  svg.addEventListener('touchstart', handleTouchStart, { passive: true })
  svg.addEventListener('touchmove', handleTouchMove, { passive: false })
  svg.addEventListener('touchend', handleTouchEnd)

  // Global mouse events for pan
  document.addEventListener('mousemove', handlePan)
  document.addEventListener('mouseup', handleMouseUp)

  // Listen for scroll/resize to update highlight position
  window.addEventListener('scroll', handlePositionUpdate, true)
  window.addEventListener('resize', handlePositionUpdate)

  return {
    destroy: () => {
      svg.removeEventListener('mousemove', handleMouseMove)
      svg.removeEventListener('mouseleave', handleMouseLeave)
      svg.removeEventListener('mousedown', handleMouseDown)
      svg.removeEventListener('click', handleTap)
      svg.removeEventListener('wheel', handleWheel)
      svg.removeEventListener('touchstart', handleTouchStart)
      svg.removeEventListener('touchmove', handleTouchMove)
      svg.removeEventListener('touchend', handleTouchEnd)
      document.removeEventListener('mousemove', handlePan)
      document.removeEventListener('mouseup', handleMouseUp)
      window.removeEventListener('scroll', handlePositionUpdate, true)
      window.removeEventListener('resize', handlePositionUpdate)
      if (rafId !== null) cancelAnimationFrame(rafId)
      highlightElement(null)
      if (tooltip) {
        tooltip.remove()
        tooltip = null
      }
      if (overlay) {
        overlay.remove()
        overlay = null
      }
      if (highlightContainer) {
        highlightContainer.remove()
        highlightContainer = null
      }
    },
    showDeviceModal: () => {},
    hideModal: () => {},
    showLinkTooltip: () => {},
    hideTooltip: () => {
      hideTooltip()
      highlightElement(null)
      touchTooltipActive = false
    },
    resetView,
    getScale,
  }
}
