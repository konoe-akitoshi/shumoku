/**
 * Interactive Runtime - Hover tooltip with touch support
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

export function initInteractive(options: InteractiveOptions): InteractiveInstance {
  const target = typeof options.target === 'string'
    ? document.querySelector(options.target)
    : options.target

  if (!target) throw new Error('Target not found')

  // Inject highlight styles
  injectHighlightStyles()

  // Track if we're currently showing a touch tooltip
  let touchTooltipActive = false

  // Mouse move handler (desktop hover)
  const handleMouseMove = (e: Event) => {
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
    hideTooltip()
    highlightElement(null)
  }

  // Touch start handler - detect touch device
  const handleTouchStart = () => {
    isTouchDevice = true
  }

  // Touch/click handler for mobile
  const handleTap = (e: Event) => {
    if (!isTouchDevice) return

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
      const svg = currentHighlight.closest('svg')
      if (svg) {
        const viewBox = svg.getAttribute('viewBox') || ''
        if (viewBox !== lastViewBox) {
          lastViewBox = viewBox
          updateHighlightPosition()
        }
      }
    }
    rafId = requestAnimationFrame(trackViewBox)
  }
  rafId = requestAnimationFrame(trackViewBox)

  // Add event listeners
  target.addEventListener('mousemove', handleMouseMove)
  target.addEventListener('mouseleave', handleMouseLeave)
  target.addEventListener('touchstart', handleTouchStart, { passive: true })
  target.addEventListener('click', handleTap)
  // Listen for zoom/scroll to update highlight position
  window.addEventListener('scroll', handlePositionUpdate, true)
  window.addEventListener('resize', handlePositionUpdate)
  window.addEventListener('wheel', handlePositionUpdate, { passive: true })

  return {
    destroy: () => {
      target.removeEventListener('mousemove', handleMouseMove)
      target.removeEventListener('mouseleave', handleMouseLeave)
      target.removeEventListener('touchstart', handleTouchStart)
      target.removeEventListener('click', handleTap)
      window.removeEventListener('scroll', handlePositionUpdate, true)
      window.removeEventListener('resize', handlePositionUpdate)
      window.removeEventListener('wheel', handlePositionUpdate)
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
  }
}
