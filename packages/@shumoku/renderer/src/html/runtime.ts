/**
 * Interactive Runtime - Mobile-first pan/zoom with tap tooltips and spotlight effect
 * Google Maps style touch: 1 finger = page scroll (in HTML) / pan (here), 2 fingers = pinch zoom
 */

import type { InteractiveInstance, InteractiveOptions } from '../types.js'
import {
  destroySpotlight,
  getCurrentHighlight,
  highlightElement,
  updateHighlightPosition,
} from './spotlight.js'
import { destroyTooltip, getTooltipInfo, hideTooltip, showTooltip } from './tooltip.js'
import { cloneViewBox, parseViewBox, setViewBox, type ViewBox } from './viewbox.js'

const ZOOM_FACTOR = 1.2

export function initInteractive(options: InteractiveOptions): InteractiveInstance {
  const target =
    typeof options.target === 'string' ? document.querySelector(options.target) : options.target

  if (!target) throw new Error('Target not found')

  const svg = target.closest('svg') || target.querySelector('svg') || (target as SVGSVGElement)
  if (!(svg instanceof SVGSVGElement)) throw new Error('SVG element not found')

  const panZoomEnabled = options.panZoom?.enabled ?? true
  const minScale = options.panZoom?.minScale ?? 0.1
  const maxScale = options.panZoom?.maxScale ?? 10

  let originalViewBox: ViewBox | null = parseViewBox(svg)
  if (!originalViewBox) {
    const bbox = svg.getBBox()
    originalViewBox = { x: bbox.x, y: bbox.y, width: bbox.width, height: bbox.height }
    setViewBox(svg, originalViewBox, updateHighlightPosition)
  }

  let tooltipActive = false
  const mouseDrag = {
    active: false,
    startX: 0,
    startY: 0,
    startViewBox: null as ViewBox | null,
  }

  let pinchState: {
    initialDist: number
    startViewBox: ViewBox
    centerX: number
    centerY: number
  } | null = null

  const getScale = (): number => {
    if (!originalViewBox) return 1
    const current = parseViewBox(svg)
    if (!current) return 1
    return originalViewBox.width / current.width
  }

  const resetView = () => {
    if (originalViewBox) {
      setViewBox(svg, originalViewBox, updateHighlightPosition)
    }
  }

  // ============================================
  // Touch Events (Mobile: 2-finger for pan/zoom)
  // ============================================

  const getTouchDistance = (touches: TouchList): number => {
    if (touches.length < 2) return 0
    const dx = touches[1].clientX - touches[0].clientX
    const dy = touches[1].clientY - touches[0].clientY
    return Math.hypot(dx, dy)
  }

  const getTouchCenter = (touches: TouchList): { x: number; y: number } => ({
    x: (touches[0].clientX + touches[1].clientX) / 2,
    y: (touches[0].clientY + touches[1].clientY) / 2,
  })

  const handleTouchStart = (e: TouchEvent) => {
    if (e.touches.length >= 2 && panZoomEnabled) {
      e.preventDefault()
      const dist = getTouchDistance(e.touches)
      const center = getTouchCenter(e.touches)
      const vb = parseViewBox(svg)
      if (vb) {
        const rect = svg.getBoundingClientRect()
        pinchState = {
          initialDist: dist,
          startViewBox: cloneViewBox(vb),
          centerX: vb.x + vb.width * ((center.x - rect.left) / rect.width),
          centerY: vb.y + vb.height * ((center.y - rect.top) / rect.height),
        }
      }
      if (tooltipActive) {
        hideTooltip()
        highlightElement(null)
        tooltipActive = false
      }
    }
  }

  const handleTouchMove = (e: TouchEvent) => {
    if (e.touches.length >= 2 && pinchState && panZoomEnabled) {
      e.preventDefault()

      const dist = getTouchDistance(e.touches)
      const center = getTouchCenter(e.touches)

      if (dist === 0 || pinchState.initialDist === 0) return

      const scale = dist / pinchState.initialDist
      const newWidth = pinchState.startViewBox.width / scale
      const newHeight = pinchState.startViewBox.height / scale

      if (!originalViewBox) return
      const newScale = originalViewBox.width / newWidth
      if (newScale < minScale || newScale > maxScale) return

      const rect = svg.getBoundingClientRect()
      const mx = (center.x - rect.left) / rect.width
      const my = (center.y - rect.top) / rect.height

      setViewBox(
        svg,
        {
          x: pinchState.centerX - newWidth * mx,
          y: pinchState.centerY - newHeight * my,
          width: newWidth,
          height: newHeight,
        },
        updateHighlightPosition,
      )
    }
  }

  const handleTouchEnd = (e: TouchEvent) => {
    if (e.touches.length < 2) {
      pinchState = null
    }
  }

  // ============================================
  // Mouse Events (Desktop)
  // ============================================

  const handleMouseDown = (e: MouseEvent) => {
    if (e.button !== 0 || !panZoomEnabled) return

    const vb = parseViewBox(svg)
    if (!vb) return

    mouseDrag.active = true
    mouseDrag.startX = e.clientX
    mouseDrag.startY = e.clientY
    mouseDrag.startViewBox = cloneViewBox(vb)
    svg.style.cursor = 'grabbing'

    if (tooltipActive) {
      hideTooltip()
      highlightElement(null)
      tooltipActive = false
    }
  }

  const handleMouseMove = (e: MouseEvent) => {
    if (mouseDrag.active && mouseDrag.startViewBox && panZoomEnabled) {
      const dx = e.clientX - mouseDrag.startX
      const dy = e.clientY - mouseDrag.startY
      const rect = svg.getBoundingClientRect()
      const scaleX = mouseDrag.startViewBox.width / rect.width
      const scaleY = mouseDrag.startViewBox.height / rect.height

      setViewBox(
        svg,
        {
          x: mouseDrag.startViewBox.x - dx * scaleX,
          y: mouseDrag.startViewBox.y - dy * scaleY,
          width: mouseDrag.startViewBox.width,
          height: mouseDrag.startViewBox.height,
        },
        updateHighlightPosition,
      )
    } else if (!mouseDrag.active) {
      // Hover: show tooltip and highlight
      const info = getTooltipInfo(e.target as Element)
      if (info) {
        showTooltip(info.text, e.clientX, e.clientY)
        highlightElement(info.element)
      } else {
        hideTooltip()
        highlightElement(null)
      }
    }
  }

  const handleMouseUp = () => {
    mouseDrag.active = false
    mouseDrag.startViewBox = null
    svg.style.cursor = ''
  }

  const handleMouseLeave = () => {
    if (!mouseDrag.active && !tooltipActive) {
      hideTooltip()
      highlightElement(null)
    }
  }

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

    const newScale = originalViewBox.width / newWidth
    if (newScale < minScale || newScale > maxScale) return

    const xRatio = (e.clientX - rect.left) / rect.width
    const yRatio = (e.clientY - rect.top) / rect.height

    setViewBox(
      svg,
      {
        x: mouseX - newWidth * xRatio,
        y: mouseY - newHeight * yRatio,
        width: newWidth,
        height: newHeight,
      },
      updateHighlightPosition,
    )
  }

  // ============================================
  // Tap for tooltip (touch devices)
  // ============================================

  let tapStart: { x: number; y: number; time: number } | null = null

  const handleTouchStartForTap = (e: TouchEvent) => {
    if (e.touches.length === 1) {
      tapStart = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        time: Date.now(),
      }
    } else {
      tapStart = null
    }
  }

  const handleTouchEndForTap = (e: TouchEvent) => {
    if (!tapStart || e.touches.length > 0) {
      tapStart = null
      return
    }

    const touch = e.changedTouches[0]
    const dx = touch.clientX - tapStart.x
    const dy = touch.clientY - tapStart.y
    const dt = Date.now() - tapStart.time

    if (Math.hypot(dx, dy) < 10 && dt < 300) {
      const targetEl = document.elementFromPoint(touch.clientX, touch.clientY)
      if (targetEl) {
        const info = getTooltipInfo(targetEl)
        if (info) {
          showTooltip(info.text, touch.clientX, touch.clientY)
          highlightElement(info.element)
          tooltipActive = true
        } else if (tooltipActive) {
          hideTooltip()
          highlightElement(null)
          tooltipActive = false
        }
      }
    }

    tapStart = null
  }

  // ============================================
  // Track viewBox changes for smooth highlight during pan/zoom
  // ============================================

  let rafId: number | null = null
  let lastViewBox = ''

  const trackViewBox = () => {
    if (getCurrentHighlight()) {
      const viewBox = svg.getAttribute('viewBox') || ''
      if (viewBox !== lastViewBox) {
        lastViewBox = viewBox
        updateHighlightPosition()
      }
    }
    rafId = requestAnimationFrame(trackViewBox)
  }

  const handlePositionUpdate = () => {
    updateHighlightPosition()
  }

  // Start tracking
  rafId = requestAnimationFrame(trackViewBox)

  // ============================================
  // Setup Event Listeners
  // ============================================

  svg.addEventListener('touchstart', handleTouchStart, { passive: false })
  svg.addEventListener('touchmove', handleTouchMove, { passive: false })
  svg.addEventListener('touchend', handleTouchEnd)
  svg.addEventListener('touchcancel', handleTouchEnd)

  svg.addEventListener('touchstart', handleTouchStartForTap, { passive: true })
  svg.addEventListener('touchend', handleTouchEndForTap)

  svg.addEventListener('mousedown', handleMouseDown)
  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('mouseup', handleMouseUp)
  svg.addEventListener('mouseleave', handleMouseLeave)
  svg.addEventListener('wheel', handleWheel, { passive: false })

  // Listen for scroll/resize to update highlight position
  window.addEventListener('scroll', handlePositionUpdate, true)
  window.addEventListener('resize', handlePositionUpdate)

  return {
    destroy: () => {
      if (rafId !== null) cancelAnimationFrame(rafId)
      svg.removeEventListener('touchstart', handleTouchStart)
      svg.removeEventListener('touchmove', handleTouchMove)
      svg.removeEventListener('touchend', handleTouchEnd)
      svg.removeEventListener('touchcancel', handleTouchEnd)
      svg.removeEventListener('touchstart', handleTouchStartForTap)
      svg.removeEventListener('touchend', handleTouchEndForTap)
      svg.removeEventListener('mousedown', handleMouseDown)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      svg.removeEventListener('mouseleave', handleMouseLeave)
      svg.removeEventListener('wheel', handleWheel)
      window.removeEventListener('scroll', handlePositionUpdate, true)
      window.removeEventListener('resize', handlePositionUpdate)
      destroyTooltip()
      destroySpotlight()
    },
    showDeviceModal: () => {},
    hideModal: () => {},
    showLinkTooltip: () => {},
    hideTooltip: () => {
      hideTooltip()
      highlightElement(null)
      tooltipActive = false
    },
    resetView,
    getScale,
  }
}
