/**
 * Spotlight Module
 * Handles element highlighting with overlay and glow effect
 */

let overlay: HTMLDivElement | null = null
let highlightContainer: HTMLDivElement | null = null
let currentHighlight: Element | null = null
let currentMiniSvg: SVGSVGElement | null = null

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

export function updateHighlightPosition(): void {
  if (!currentHighlight || !currentMiniSvg) return

  if (!document.contains(currentHighlight)) {
    highlightElement(null)
    return
  }

  const svg = currentHighlight.closest('svg') as SVGSVGElement | null
  if (!svg) return

  const rect = svg.getBoundingClientRect()
  const viewBox = svg.getAttribute('viewBox')
  if (viewBox) {
    currentMiniSvg.setAttribute('viewBox', viewBox)
  }

  currentMiniSvg.style.left = `${rect.left}px`
  currentMiniSvg.style.top = `${rect.top}px`
  currentMiniSvg.style.width = `${rect.width}px`
  currentMiniSvg.style.height = `${rect.height}px`
}

export function highlightElement(el: Element | null): void {
  if (el === currentHighlight) return

  if (currentHighlight) {
    currentHighlight.classList.remove('shumoku-highlight')
  }

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
        const clone = el.cloneNode(true) as Element
        clone.classList.remove('shumoku-highlight')

        const miniSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
        miniSvg.setAttribute('viewBox', viewBox)
        miniSvg.style.cssText = `
          position: absolute;
          overflow: visible;
          filter: drop-shadow(0 0 4px #fff) drop-shadow(0 0 8px #fff) drop-shadow(0 0 12px rgba(100, 150, 255, 0.8));
        `

        const defs = svg.querySelector('defs')
        if (defs) {
          miniSvg.appendChild(defs.cloneNode(true))
        }

        miniSvg.appendChild(clone)
        container.appendChild(miniSvg)
        currentMiniSvg = miniSvg

        updateHighlightPosition()
      }
    }

    ov.style.opacity = '1'
  } else {
    ov.style.opacity = '0'
  }
}

export function getCurrentHighlight(): Element | null {
  return currentHighlight
}

export function destroySpotlight(): void {
  if (overlay) {
    overlay.remove()
    overlay = null
  }
  if (highlightContainer) {
    highlightContainer.remove()
    highlightContainer = null
  }
  currentHighlight = null
  currentMiniSvg = null
}
