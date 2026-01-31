<script lang="ts" module>
// Event types for node selection (exported from module context)
export interface NodeInfo {
  id: string
  label: string
  type?: string
  vendor?: string
  model?: string
}

export interface NodeSelectEvent {
  node: NodeInfo
  connectedLinks: Array<{
    id: string
    from: string
    to: string
    bandwidth?: string
  }>
}

export interface SubgraphInfo {
  id: string
  label: string
  nodeCount: number
  linkCount: number
  canDrillDown: boolean
}

export interface SubgraphSelectEvent {
  subgraph: SubgraphInfo
}
</script>

<script lang="ts">
import { onMount, onDestroy, tick } from 'svelte'
import panzoom from 'panzoom'
import type { PanZoom } from 'panzoom'
import {
  metricsStore,
  metricsData,
  metricsWarnings,
  liveUpdatesEnabled,
  showTrafficFlow,
  showNodeStatus,
} from '$lib/stores'
import { formatTraffic } from '$lib/utils/format'
import ArrowLeft from 'phosphor-svelte/lib/ArrowLeft'
import MagnifyingGlassPlus from 'phosphor-svelte/lib/MagnifyingGlassPlus'
import MagnifyingGlassMinus from 'phosphor-svelte/lib/MagnifyingGlassMinus'
import CornersOut from 'phosphor-svelte/lib/CornersOut'
import ArrowCounterClockwise from 'phosphor-svelte/lib/ArrowCounterClockwise'
import GearSix from 'phosphor-svelte/lib/GearSix'
import MagnifyingGlass from 'phosphor-svelte/lib/MagnifyingGlass'

// Props
export let topologyId: string = ''
export let renderUrl: string = ''
export let readOnly = false
export let onToggleSettings: (() => void) | undefined = undefined
export let onSearchOpen: (() => void) | undefined = undefined
export let settingsOpen = false
export let onNodeSelect: ((event: NodeSelectEvent) => void) | undefined = undefined
export let onSubgraphSelect: ((event: SubgraphSelectEvent) => void) | undefined = undefined

// Compute effective render URL
$: effectiveRenderUrl = renderUrl || `/api/topologies/${topologyId}/render`

// Sheet types for hierarchical navigation
interface SheetInfo {
  svg: string
  css: string
  viewBox: { x: number; y: number; width: number; height: number }
  label: string
  parentId: string | null
}

// State
let container: HTMLDivElement
let styleElement: HTMLStyleElement | null = null
let svgWrapper: HTMLDivElement
let svgElement: SVGSVGElement | null = null
let panzoomInstance: PanZoom | null = null
let loading = true
let error = ''
let scale = 1

// Hierarchical navigation state
let isHierarchical = false
let sheets: Record<string, SheetInfo> = {}
let currentSheetId = 'root'
let navigationStack: string[] = [] // Stack for breadcrumb (excluding current)

// Get current sheet content
$: currentSheet = sheets[currentSheetId]
$: svgContent = currentSheet?.svg || ''

// Build breadcrumb from navigation stack + current
// Explicitly reference reactive variables to ensure updates
$: breadcrumb = (() => {
  const result: Array<{ id: string; label: string }> = []
  for (const sheetId of navigationStack) {
    const sheet = sheets[sheetId]
    if (sheet) {
      result.push({ id: sheetId, label: sheet.label })
    }
  }
  // Reference currentSheet and currentSheetId for reactivity
  if (currentSheet && currentSheetId) {
    result.push({ id: currentSheetId, label: currentSheet.label })
  }
  return result
})()

// Tooltip state
let tooltipVisible = false
let tooltipContent = ''
let tooltipX = 0
let tooltipY = 0

// Hovered element state for dynamic tooltip
let hoveredType: 'node' | 'link' | 'subgraph' | null = null
let hoveredLinkId: string | null = null
let hoveredLinkInfo: { from: string; to: string; bandwidth: string } | null = null
let hoveredNodeInfo: { id: string; label: string; type: string; vendor: string; model: string } | null = null
let hoveredSubgraphInfo: { id: string; label: string; canNavigate: boolean } | null = null

// Dynamic tooltip content - recalculates when metricsData changes
$: if (tooltipVisible && hoveredType === 'link' && hoveredLinkId && hoveredLinkInfo) {
  let content = `<strong>${hoveredLinkInfo.from} → ${hoveredLinkInfo.to}</strong>`
  if (hoveredLinkInfo.bandwidth) {
    content += `<br><span class="muted">Bandwidth: ${hoveredLinkInfo.bandwidth}</span>`
  }

  const metrics = $metricsData?.links?.[hoveredLinkId]
  if (metrics) {
    if (metrics.inBps !== undefined || metrics.outBps !== undefined) {
      const inTraffic = formatTraffic(metrics.inBps || 0)
      const outTraffic = formatTraffic(metrics.outBps || 0)
      content += `<br><span class="muted">In:</span> ${inTraffic} <span class="muted">Out:</span> ${outTraffic}`
    }
    if (metrics.inUtilization !== undefined || metrics.outUtilization !== undefined) {
      const inU = metrics.inUtilization ?? 0
      const outU = metrics.outUtilization ?? 0
      const inColor = getUtilizationColor(inU)
      const outColor = getUtilizationColor(outU)
      content += `<br><span style="color: ${inColor}">In: ${formatUtil(inU)}</span> <span style="color: ${outColor}">Out: ${formatUtil(outU)}</span>`
    } else if (metrics.utilization !== undefined) {
      const color = getUtilizationColor(metrics.utilization)
      content += `<br><span style="color: ${color}">Utilization: ${formatUtil(metrics.utilization)}</span>`
    }
    content += `<br><span class="muted">Status: ${metrics.status}</span>`
  }
  tooltipContent = content
}

// Drag detection — suppress click when user drags to pan
const DRAG_THRESHOLD = 5 // pixels
let mouseDownPos: { x: number; y: number } | null = null

function onPointerDown(e: PointerEvent) {
  mouseDownPos = { x: e.clientX, y: e.clientY }
}

function wasDrag(e: MouseEvent): boolean {
  if (!mouseDownPos) return false
  const dx = e.clientX - mouseDownPos.x
  const dy = e.clientY - mouseDownPos.y
  return Math.hypot(dx, dy) > DRAG_THRESHOLD
}

// Currently hovered/selected elements
let hoveredNodeId: string | null = null
let selectedNodeId: string | null = null

// AbortController for event listeners (prevents leaks on sheet switch)
let interactivityAbort: AbortController | null = null

// Inject CSS into document head
function injectCSS(css: string) {
  if (styleElement) {
    styleElement.remove()
  }
  styleElement = document.createElement('style')
  styleElement.setAttribute('data-shumoku', 'true')
  styleElement.textContent = css
  document.head.appendChild(styleElement)
}

// Fetch rendered content from API
async function loadContent() {
  loading = true
  error = ''
  try {
    const res = await fetch(effectiveRenderUrl)
    if (!res.ok) {
      throw new Error(`Failed to load topology: ${res.status}`)
    }
    const data = await res.json()

    if (data.hierarchical && data.sheets) {
      // Hierarchical topology with multiple sheets
      isHierarchical = true
      sheets = data.sheets
      currentSheetId = data.rootSheetId || 'root'
      navigationStack = []

      // Inject CSS from root sheet (they should all have the same CSS)
      const rootSheet = sheets[currentSheetId]
      if (rootSheet?.css) {
        injectCSS(rootSheet.css)
      }
    } else {
      // Non-hierarchical: single sheet
      isHierarchical = false
      sheets = {
        root: {
          svg: data.svg,
          css: data.css,
          viewBox: data.viewBox,
          label: data.name || 'Root',
          parentId: null,
        },
      }
      currentSheetId = 'root'
      navigationStack = []

      if (data.css) {
        injectCSS(data.css)
      }
    }

    loading = false
    await tick()
    initializeCurrentSheet()
  } catch (e) {
    error = e instanceof Error ? e.message : 'Unknown error'
    loading = false
  }
}

// Initialize current sheet (SVG element and panzoom)
async function initializeCurrentSheet() {
  await tick()

  // Get the SVG element
  svgElement = svgWrapper?.querySelector('svg') || null

  if (svgElement) {
    // Dispose old panzoom if exists
    if (panzoomInstance) {
      panzoomInstance.dispose()
      panzoomInstance = null
    }

    // Initialize panzoom
    initPanZoom()
    // Setup interactivity
    setupInteractivity()
    // Reset weathermap state when switching sheets
    weathermap?.destroy()
    weathermap = null
  }
}

// Expose SVG element for external use (e.g. node search palette)
export function getSvgElement(): SVGSVGElement | null {
  return svgElement
}

// Pan and zoom to center a specific node, then highlight it briefly.
export function panToNode(nodeId: string) {
  if (!svgElement || !panzoomInstance || !container) return

  const nodeEl = svgElement.querySelector(`g.node[data-id="${nodeId}"]`) as SVGGElement | null
  if (!nodeEl) return

  // Pan node to container center
  const { clientWidth: cw, clientHeight: ch } = container
  const cRect = container.getBoundingClientRect()
  const nRect = nodeEl.getBoundingClientRect()
  const t = panzoomInstance.getTransform()
  panzoomInstance.moveTo(
    t.x + (cRect.left + cw / 2) - (nRect.left + nRect.width / 2),
    t.y + (cRect.top + ch / 2) - (nRect.top + nRect.height / 2),
  )

  // Zoom so node area ≈ 5% of container area (consistent across shapes)
  const areaRatio = Math.sqrt((cw * ch * 0.05) / (nRect.width * nRect.height))
  const targetScale = Math.min(Math.max(t.scale * areaRatio, 2), 50)
  panzoomInstance.zoomAbs(cw / 2, ch / 2, targetScale)

  scale = panzoomInstance.getTransform().scale
  updateDotGrid()

  // Pulse highlight for 3 seconds
  nodeEl.classList.add('search-highlight')
  setTimeout(() => nodeEl.classList.remove('search-highlight'), 3000)
}

// Navigate to a child sheet (exported for external drill-down)
export async function navigateToSheet(sheetId: string) {
  if (!sheets[sheetId]) return

  // Push current sheet to stack
  navigationStack = [...navigationStack, currentSheetId]
  currentSheetId = sheetId

  await initializeCurrentSheet()
}

// Navigate back via breadcrumb
async function navigateToBreadcrumb(targetId: string) {
  const targetIndex = navigationStack.findIndex((id) => id === targetId)

  if (targetIndex === -1 && targetId === currentSheetId) {
    // Already at target
    return
  }

  if (targetIndex !== -1) {
    // Navigate to item in stack
    currentSheetId = targetId
    navigationStack = navigationStack.slice(0, targetIndex)
  }

  await initializeCurrentSheet()
}


// Update dot grid background to follow panzoom transform (CAD-style)
// Grid snaps to coarser intervals when zoomed out, finer when zoomed in
const DOT_GRID_MIN_SCREEN_SIZE = 15
const DOT_GRID_BASE_INTERVAL = 20
function updateDotGrid() {
  if (!container || !panzoomInstance) return
  const { x, y, scale: s } = panzoomInstance.getTransform()

  // Find the smallest power-of-2 multiple of base interval
  // whose screen size is >= minimum
  let interval = DOT_GRID_BASE_INTERVAL
  while (interval * s < DOT_GRID_MIN_SCREEN_SIZE) {
    interval *= 2
  }

  const screenSize = interval * s
  container.style.backgroundSize = `${screenSize}px ${screenSize}px`
  container.style.backgroundPosition = `${x % screenSize}px ${y % screenSize}px`
}

// Initialize panzoom
function initPanZoom() {
  if (!svgWrapper || !container) return

  panzoomInstance = panzoom(svgWrapper, {
    maxZoom: 50,
    minZoom: 0.1,
    smoothScroll: false,
    zoomDoubleClickSpeed: 1,
    bounds: false,
    // Default: zoom toward mouse position
  })

  panzoomInstance.on('zoom', () => {
    scale = panzoomInstance?.getTransform().scale ?? 1
    updateDotGrid()
  })

  panzoomInstance.on('pan', () => {
    scale = panzoomInstance?.getTransform().scale ?? 1
    updateDotGrid()
  })

  // Initial fit to view
  fitToView()
}

// Fit SVG to container
// SVG uses width="100%" height="100%" with viewBox, so scale=1 = fully fitted.
// panzoom transforms the wrapper, so resetting to scale=1 at origin fits the view.
function fitToView() {
  if (!svgElement || !container || !panzoomInstance) return

  panzoomInstance.zoomAbs(0, 0, 1)
  panzoomInstance.moveTo(0, 0)
  scale = 1
}

function resetView() {
  if (!panzoomInstance) return
  panzoomInstance.zoomAbs(0, 0, 1)
  panzoomInstance.moveTo(0, 0)
  scale = 1
}

function zoomIn() {
  if (!panzoomInstance || !container) return
  const cx = container.clientWidth / 2
  const cy = container.clientHeight / 2
  panzoomInstance.smoothZoom(cx, cy, 1.5)
}

function zoomOut() {
  if (!panzoomInstance || !container) return
  const cx = container.clientWidth / 2
  const cy = container.clientHeight / 2
  panzoomInstance.smoothZoom(cx, cy, 0.67)
}

// Setup SVG interactivity using event delegation on the SVG element.
// Instead of adding listeners to every node/link/subgraph individually,
// we listen on the SVG root and resolve the target element by walking up
// the DOM. This makes sheet switching O(1) for listener setup.
function setupInteractivity() {
  if (!svgElement) return

  // Abort previous listeners to prevent leaks on sheet switch
  interactivityAbort?.abort()
  interactivityAbort = new AbortController()
  const { signal } = interactivityAbort

  // Apply cursor styles via CSS class instead of per-element style
  svgElement.classList.add('shumoku-interactive')

  // Helper: find the closest interactive ancestor from an event target
  function closestInteractive(target: EventTarget | null): { type: 'node'; el: SVGGElement; id: string }
    | { type: 'subgraph'; el: SVGGElement; id: string }
    | { type: 'link'; el: SVGGElement; id: string }
    | null {
    const el = (target as Element)?.closest?.('g.node, g.subgraph, g.link-group') as SVGGElement | null
    if (!el) return null
    if (el.classList.contains('node')) return { type: 'node', el, id: el.getAttribute('data-id') || '' }
    if (el.classList.contains('subgraph')) return { type: 'subgraph', el, id: el.getAttribute('data-id') || '' }
    if (el.classList.contains('link-group')) return { type: 'link', el, id: el.getAttribute('data-link-id') || '' }
    return null
  }

  // Track what's currently hovered for delegation-based enter/leave
  let currentHover: { type: string; id: string } | null = null

  svgElement.addEventListener('mouseover', (e: MouseEvent) => {
    const hit = closestInteractive(e.target)
    const key = hit ? `${hit.type}:${hit.id}` : null
    const prevKey = currentHover ? `${currentHover.type}:${currentHover.id}` : null
    if (key === prevKey) return

    // Leave previous
    if (currentHover) {
      if (currentHover.type === 'node') handleNodeLeave()
      else if (currentHover.type === 'subgraph') handleSubgraphLeave()
      else if (currentHover.type === 'link') handleLinkLeave()
      currentHover = null
    }

    // Enter new
    if (hit) {
      currentHover = { type: hit.type, id: hit.id }
      if (hit.type === 'node') handleNodeHover(hit.id, e)
      else if (hit.type === 'subgraph') handleSubgraphHover(hit.id, e)
      else if (hit.type === 'link') handleLinkHover(hit.id, e)
    }
  }, { signal })

  svgElement.addEventListener('mouseout', (e: MouseEvent) => {
    // Only clear if we're leaving the SVG entirely
    const related = e.relatedTarget as Element | null
    if (related && svgElement!.contains(related)) return
    if (currentHover) {
      if (currentHover.type === 'node') handleNodeLeave()
      else if (currentHover.type === 'subgraph') handleSubgraphLeave()
      else if (currentHover.type === 'link') handleLinkLeave()
      currentHover = null
    }
  }, { signal })

  svgElement.addEventListener('mousemove', (e: MouseEvent) => {
    updateTooltipPosition(e)
  }, { signal })

  svgElement.addEventListener('click', (e: MouseEvent) => {
    if (wasDrag(e)) return
    const hit = closestInteractive(e.target)
    if (!hit) return
    if (hit.type === 'node') handleNodeClick(hit.id)
    else if (hit.type === 'subgraph') {
      e.stopPropagation()
      handleSubgraphSingleClick(hit.id)
    }
  }, { signal })
}

// Update tooltip position on mouse move
function updateTooltipPosition(event: MouseEvent) {
  if (tooltipVisible) {
    tooltipX = event.clientX + 12
    tooltipY = event.clientY + 12
  }
}

// Node hover handlers
function handleNodeHover(nodeId: string, event: MouseEvent) {
  hoveredNodeId = nodeId
  highlightNode(nodeId, true)
  highlightConnectedLinks(nodeId, true)
  showNodeTooltip(nodeId, event)
}

function handleNodeLeave() {
  if (hoveredNodeId) {
    highlightNode(hoveredNodeId, false)
    highlightConnectedLinks(hoveredNodeId, false)
  }
  hoveredNodeId = null
  hideTooltip()
}

function handleNodeClick(nodeId: string) {
  // Toggle selection state for visual feedback
  selectedNodeId = selectedNodeId === nodeId ? null : nodeId

  // Always call the callback when clicking a node (for modal)
  if (svgElement && onNodeSelect) {
    const nodeEl = svgElement.querySelector(`g.node[data-id="${nodeId}"]`)
    if (nodeEl) {
      // Get label from text element inside the node, or fall back to node id
      const labelEl = nodeEl.querySelector('text.node-label, text')
      const label = labelEl?.textContent?.trim() || nodeId

      const nodeInfo: NodeInfo = {
        id: nodeId,
        label,
        type: nodeEl.getAttribute('data-device-type') || undefined,
        vendor: nodeEl.getAttribute('data-device-vendor') || undefined,
        model: nodeEl.getAttribute('data-device-model') || undefined,
      }

      // Find connected links
      const connectedLinks: NodeSelectEvent['connectedLinks'] = []
      const linkGroups = svgElement.querySelectorAll('g.link-group')
      linkGroups.forEach((link) => {
        const fromRaw = link.getAttribute('data-link-from') || ''
        const toRaw = link.getAttribute('data-link-to') || ''
        // Extract node ID from "node:port" format
        const from = fromRaw.split(':')[0]
        const to = toRaw.split(':')[0]
        if (from === nodeId || to === nodeId) {
          connectedLinks.push({
            id: link.getAttribute('data-link-id') || '',
            from,
            to,
            bandwidth: link.getAttribute('data-link-bandwidth') || undefined,
          })
        }
      })

      onNodeSelect({ node: nodeInfo, connectedLinks })
    }
  }
}

// Subgraph handlers
function handleSubgraphHover(sgId: string, event: MouseEvent) {
  highlightSubgraph(sgId, true)
  showSubgraphTooltip(sgId, event)
}

function handleSubgraphLeave() {
  highlightSubgraph(null, false)
  hideTooltip()
}

function handleSubgraphSingleClick(sgId: string) {
  if (!svgElement || !onSubgraphSelect) return

  const sgEl = svgElement.querySelector(`g.subgraph[data-id="${sgId}"]`)
  if (!sgEl) return

  const label = sgEl.getAttribute('data-label') || sgId

  // Count nodes belonging to this subgraph via data-parent attribute
  const memberNodes = svgElement.querySelectorAll(`g.node[data-parent="${sgId}"]`)
  const memberNodeIds = new Set<string>()
  memberNodes.forEach((n) => {
    const nid = n.getAttribute('data-id')
    if (nid) memberNodeIds.add(nid)
  })

  // Count links where both endpoints belong to this subgraph
  let linkCount = 0
  const allLinks = svgElement.querySelectorAll('g.link-group')
  allLinks.forEach((link) => {
    const from = (link.getAttribute('data-link-from') || '').split(':')[0]
    const to = (link.getAttribute('data-link-to') || '').split(':')[0]
    if (memberNodeIds.has(from) || memberNodeIds.has(to)) {
      linkCount++
    }
  })

  onSubgraphSelect({
    subgraph: {
      id: sgId,
      label,
      nodeCount: memberNodeIds.size,
      linkCount,
      canDrillDown: sheets[sgId] !== undefined,
    },
  })
}

function handleSubgraphClick(sgId: string) {
  // Navigate to child sheet if it exists
  if (sheets[sgId]) {
    navigateToSheet(sgId)
  }
}

// Link handlers
function handleLinkHover(linkId: string, event: MouseEvent) {
  highlightLink(linkId, true)
  showLinkTooltip(linkId, event)
}

function handleLinkLeave() {
  highlightLink(null, false)
  hideTooltip()
}

// Highlight functions
function highlightNode(nodeId: string, highlight: boolean) {
  if (!svgElement) return
  const node = svgElement.querySelector(`g.node[data-id="${nodeId}"]`)
  if (node) {
    node.classList.toggle('highlighted', highlight)
  }
}

function highlightConnectedLinks(nodeId: string, highlight: boolean) {
  if (!svgElement) return
  const links = svgElement.querySelectorAll('g.link-group')
  links.forEach((link) => {
    const linkEl = link as SVGGElement
    const from = (linkEl.getAttribute('data-link-from') || '').split(':')[0]
    const to = (linkEl.getAttribute('data-link-to') || '').split(':')[0]

    if (from === nodeId || to === nodeId) {
      linkEl.classList.toggle('connected', highlight)
    }
  })
}

function highlightSubgraph(sgId: string | null, highlight: boolean) {
  if (!svgElement) return
  const subgraphs = svgElement.querySelectorAll('g.subgraph')
  subgraphs.forEach((sg) => {
    if (sgId && sg.getAttribute('data-id') === sgId && highlight) {
      sg.classList.add('highlighted')
    } else {
      sg.classList.remove('highlighted')
    }
  })
}

function highlightLink(linkId: string | null, highlight: boolean) {
  if (!svgElement) return
  const links = svgElement.querySelectorAll('g.link-group')
  links.forEach((link) => {
    if (linkId && link.getAttribute('data-link-id') === linkId && highlight) {
      link.classList.add('highlighted')
    } else {
      link.classList.remove('highlighted')
    }
  })
}

// Tooltip functions - set hovered state for dynamic content
function showNodeTooltip(nodeId: string, event: MouseEvent) {
  if (!svgElement) return
  const node = svgElement.querySelector(`g.node[data-id="${nodeId}"]`)
  if (!node) return

  const labelEl = node.querySelector('text.node-label, text')
  const label = labelEl?.textContent?.trim() || nodeId
  const type = node.getAttribute('data-device-type') || ''
  const vendor = node.getAttribute('data-device-vendor') || ''
  const model = node.getAttribute('data-device-model') || ''

  hoveredType = 'node'
  hoveredNodeInfo = { id: nodeId, label, type, vendor, model }
  hoveredLinkId = null
  hoveredLinkInfo = null
  hoveredSubgraphInfo = null

  // Build content for nodes (static, no metrics)
  let content = `<strong>${label}</strong>`
  if (type) content += `<br><span class="muted">Type: ${type}</span>`
  if (vendor) content += `<br><span class="muted">Vendor: ${vendor}</span>`
  if (model) content += `<br><span class="muted">Model: ${model}</span>`
  tooltipContent = content

  tooltipX = event.clientX + 12
  tooltipY = event.clientY + 12
  tooltipVisible = true
}

function showSubgraphTooltip(sgId: string, event: MouseEvent) {
  if (!svgElement) return
  const sg = svgElement.querySelector(`g.subgraph[data-id="${sgId}"]`)
  if (!sg) return

  const label = sg.getAttribute('data-label') || sgId
  const canNavigate = sheets[sgId] !== undefined

  hoveredType = 'subgraph'
  hoveredSubgraphInfo = { id: sgId, label, canNavigate }
  hoveredLinkId = null
  hoveredLinkInfo = null
  hoveredNodeInfo = null

  // Build content for subgraphs (static)
  let content = `<strong>${label}</strong>`
  if (canNavigate) content += `<br><span class="action">Double-click to drill down</span>`
  tooltipContent = content

  tooltipX = event.clientX + 12
  tooltipY = event.clientY + 12
  tooltipVisible = true
}

function showLinkTooltip(linkId: string, event: MouseEvent) {
  if (!svgElement) return
  const link = svgElement.querySelector(`g.link-group[data-link-id="${linkId}"]`)
  if (!link) return

  const from = (link.getAttribute('data-link-from') || '').split(':')[0]
  const to = (link.getAttribute('data-link-to') || '').split(':')[0]
  const bandwidth = link.getAttribute('data-link-bandwidth') || ''

  hoveredType = 'link'
  hoveredLinkId = linkId
  hoveredLinkInfo = { from, to, bandwidth }
  hoveredNodeInfo = null
  hoveredSubgraphInfo = null

  // Initial content - will be updated reactively by $: statement
  let content = `<strong>${from} → ${to}</strong>`
  if (bandwidth) content += `<br><span class="muted">Bandwidth: ${bandwidth}</span>`

  const metrics = $metricsData?.links?.[linkId]
  if (metrics) {
    if (metrics.inBps !== undefined || metrics.outBps !== undefined) {
      const inTraffic = formatTraffic(metrics.inBps || 0)
      const outTraffic = formatTraffic(metrics.outBps || 0)
      content += `<br><span class="muted">In:</span> ${inTraffic} <span class="muted">Out:</span> ${outTraffic}`
    }
    if (metrics.inUtilization !== undefined || metrics.outUtilization !== undefined) {
      const inU = metrics.inUtilization ?? 0
      const outU = metrics.outUtilization ?? 0
      const inColor = getUtilizationColor(inU)
      const outColor = getUtilizationColor(outU)
      content += `<br><span style="color: ${inColor}">In: ${formatUtil(inU)}</span> <span style="color: ${outColor}">Out: ${formatUtil(outU)}</span>`
    } else if (metrics.utilization !== undefined) {
      const color = getUtilizationColor(metrics.utilization)
      content += `<br><span style="color: ${color}">Utilization: ${formatUtil(metrics.utilization)}</span>`
    }
    content += `<br><span class="muted">Status: ${metrics.status}</span>`
  }
  tooltipContent = content

  tooltipX = event.clientX + 12
  tooltipY = event.clientY + 12
  tooltipVisible = true
}

function hideTooltip() {
  tooltipVisible = false
  hoveredType = null
  hoveredLinkId = null
  hoveredLinkInfo = null
  hoveredNodeInfo = null
  hoveredSubgraphInfo = null
}

function formatUtil(util: number): string {
  return `${Math.round(util)}%`
}

// Weathermap controller for in/out dual-path rendering
import { WeathermapController, getUtilizationColor } from '$lib/weathermap'
let weathermap: WeathermapController | null = null

function applyMetrics(
  metrics: typeof $metricsData,
  applyTrafficFlow: boolean,
  applyNodeStatus: boolean,
) {
  if (!svgElement || !metrics) return

  if (applyTrafficFlow) {
    if (!weathermap) weathermap = new WeathermapController(svgElement)
    weathermap.apply(metrics.links)
  }

  if (applyNodeStatus && metrics.nodes) {
    for (const [nodeId, nodeMetrics] of Object.entries(metrics.nodes)) {
      const nodeGroup = svgElement.querySelector(`g.node[data-id="${nodeId}"]`)
      if (!nodeGroup) continue

      nodeGroup.classList.remove('status-up', 'status-down', 'status-unknown')
      nodeGroup.classList.add(`status-${nodeMetrics.status}`)
    }
  }
}

function resetLinkStyles() {
  weathermap?.reset()
}

function resetNodeStyles() {
  if (!svgElement) return

  const nodeGroups = svgElement.querySelectorAll('g.node')
  nodeGroups.forEach((node) => {
    node.classList.remove('status-up', 'status-down', 'status-unknown')
  })
}

let prevLiveUpdates = $liveUpdatesEnabled

$: if (!readOnly && topologyId && prevLiveUpdates !== $liveUpdatesEnabled) {
  prevLiveUpdates = $liveUpdatesEnabled
  if ($liveUpdatesEnabled) {
    metricsStore.connect()
    metricsStore.subscribeToTopology(topologyId)
  } else {
    metricsStore.disconnect()
    resetLinkStyles()
    resetNodeStyles()
  }
}

$: if ($liveUpdatesEnabled && $metricsData && svgElement) {
  applyMetrics($metricsData, $showTrafficFlow, $showNodeStatus)
}

$: if (svgElement && $metricsData) {
  if (!$showTrafficFlow) {
    resetLinkStyles()
  } else if ($liveUpdatesEnabled) {
    applyMetrics($metricsData, $showTrafficFlow, $showNodeStatus)
  }
}

$: if (svgElement && $metricsData) {
  if (!$showNodeStatus) {
    resetNodeStyles()
  } else if ($liveUpdatesEnabled) {
    applyMetrics($metricsData, $showTrafficFlow, $showNodeStatus)
  }
}

// Theme switching is handled by CSS variables.
// The .dark class on <html> (set by +layout.svelte / header.svelte) triggers
// the .dark { --shumoku-*: ... } overrides in the embeddable CSS. No action needed here.

onMount(async () => {
  await loadContent()

  if (!readOnly && $liveUpdatesEnabled && topologyId) {
    metricsStore.connect()
    metricsStore.subscribeToTopology(topologyId)
  }
})

onDestroy(() => {
  interactivityAbort?.abort()
  if (!readOnly) {
    metricsStore.unsubscribe()
  }
  weathermap?.destroy()
  weathermap = null
  if (panzoomInstance) {
    panzoomInstance.dispose()
  }
  if (styleElement) {
    styleElement.remove()
  }
})
</script>

<svelte:head>
  <style>
    @keyframes shumoku-edge-flow-in {
      from { stroke-dashoffset: 24; }
      to { stroke-dashoffset: 0; }
    }
    @keyframes shumoku-edge-flow-out {
      from { stroke-dashoffset: 0; }
      to { stroke-dashoffset: 24; }
    }
  </style>
</svelte:head>

<div class="diagram-container" bind:this={container} on:pointerdown={onPointerDown}>
  {#if loading}
    <div class="loading">
      <div class="spinner"></div>
      <span>Loading topology...</span>
    </div>
  {:else if error}
    <div class="error">
      <span class="error-icon">!</span>
      <span>{error}</span>
    </div>
  {:else}
    <!-- Breadcrumb navigation (top-right, only when not at root) -->
    {#if isHierarchical && currentSheetId !== 'root'}
      <div class="breadcrumb">
        <button
          class="breadcrumb-back"
          on:click={() => navigateToBreadcrumb(navigationStack[navigationStack.length - 1] || 'root')}
          title="Go back"
        >
          <ArrowLeft size={14} />
        </button>
        <span class="breadcrumb-current">{currentSheet?.label}</span>
      </div>
    {/if}

    <!-- Warnings banner -->
    {#if $liveUpdatesEnabled && $metricsWarnings.length > 0}
      <div class="warnings-banner">
        {#each $metricsWarnings as warning}
          <span class="warning-text">{warning}</span>
        {/each}
      </div>
    {/if}

    <div class="svg-wrapper" bind:this={svgWrapper}>
      {@html svgContent}
    </div>
  {/if}

  <!-- Tooltip -->
  {#if tooltipVisible}
    <div
      class="tooltip"
      style="left: {tooltipX}px; top: {tooltipY}px;"
    >
      {@html tooltipContent}
    </div>
  {/if}

  <!-- Controls -->
  <div class="controls">
    <div class="control-group">
      <button on:click={zoomIn} title="Zoom In">
        <MagnifyingGlassPlus size={18} />
      </button>
      <span class="zoom-level">{Math.round(scale * 100)}%</span>
      <button on:click={zoomOut} title="Zoom Out">
        <MagnifyingGlassMinus size={18} />
      </button>
    </div>
    <div class="control-group">
      <button on:click={fitToView} title="Fit to View">
        <CornersOut size={18} />
      </button>
      <button on:click={resetView} title="Reset View">
        <ArrowCounterClockwise size={18} />
      </button>
      {#if onSearchOpen}
        <button on:click={onSearchOpen} title="Search Nodes ({navigator?.platform?.includes('Mac') ? '⌘' : 'Ctrl+'}K)">
          <MagnifyingGlass size={18} />
        </button>
      {/if}
      {#if onToggleSettings}
        <button on:click={onToggleSettings} title="Settings" class:active={settingsOpen}>
          <GearSix size={18} />
        </button>
      {/if}
    </div>
  </div>

  <!-- Legend (only shown when traffic flow visualization is enabled) -->
  {#if $liveUpdatesEnabled && $showTrafficFlow}
    <div class="legend">
      <div class="legend-title">Utilization</div>
      <div class="legend-items">
        <div class="legend-item">
          <span class="legend-color" style="background: #22c55e"></span>
          <span>0-25%</span>
        </div>
        <div class="legend-item">
          <span class="legend-color" style="background: #eab308"></span>
          <span>25-50%</span>
        </div>
        <div class="legend-item">
          <span class="legend-color" style="background: #f97316"></span>
          <span>50-75%</span>
        </div>
        <div class="legend-item">
          <span class="legend-color" style="background: #ef4444"></span>
          <span>75%+</span>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .diagram-container {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
    background: var(--color-bg-canvas);
    background-image: radial-gradient(var(--color-border) 1px, transparent 1px);
    background-size: 20px 20px;
    background-position: 0 0;
  }

  .svg-wrapper {
    width: 100%;
    height: 100%;
    cursor: grab;
  }

  .svg-wrapper:active {
    cursor: grabbing;
  }

  .svg-wrapper :global(svg) {
    display: block;
  }

  /* Breadcrumb navigation (top-right, compact) */
  .breadcrumb {
    position: absolute;
    top: 16px;
    right: 16px;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    background: var(--color-bg-elevated);
    border: 1px solid var(--color-border);
    border-radius: 6px;
    backdrop-filter: blur(8px);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    z-index: 10;
    font-size: 12px;
  }

  .breadcrumb-back {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    padding: 2px;
    background: none;
    border: none;
    border-radius: 4px;
    color: var(--color-text-muted);
    cursor: pointer;
    transition: all 0.15s;
  }

  .breadcrumb-back:hover {
    background: var(--color-bg);
    color: var(--color-text);
  }


  .breadcrumb-current {
    color: var(--color-text);
    font-weight: 500;
    max-width: 200px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* Cursor styles for interactive elements (applied via delegation) */
  .svg-wrapper :global(svg.shumoku-interactive g.node),
  .svg-wrapper :global(svg.shumoku-interactive g.subgraph),
  .svg-wrapper :global(svg.shumoku-interactive g.link-group) {
    cursor: pointer;
  }

  /* Interactive highlight styles */
  .svg-wrapper :global(g.node.highlighted .node-bg rect),
  .svg-wrapper :global(g.node:hover .node-bg rect) {
    filter: brightness(1.2);
    stroke: #60a5fa !important;
    stroke-width: 2px !important;
  }

  .svg-wrapper :global(g.link-group.connected path.link),
  .svg-wrapper :global(g.link-group.highlighted path.link) {
    stroke-width: 3px !important;
    filter: brightness(1.3);
  }

  .svg-wrapper :global(g.subgraph.highlighted > rect) {
    stroke: #60a5fa !important;
    stroke-width: 2px !important;
  }

  /* Node status indicators */
  .svg-wrapper :global(g.node.status-up .node-bg rect) {
    stroke: #22c55e;
    stroke-width: 2px;
  }

  .svg-wrapper :global(g.node.status-down .node-bg rect) {
    stroke: #ef4444;
    stroke-width: 2px;
  }

  /* Search highlight pulse */
  .svg-wrapper :global(g.node.search-highlight .node-bg rect) {
    stroke: #f59e0b !important;
    stroke-width: 3px !important;
    animation: search-pulse 0.6s ease-in-out 3;
  }

  @keyframes search-pulse {
    0%, 100% { stroke-opacity: 1; }
    50% { stroke-opacity: 0.3; }
  }

  /* Clickable subgraph indicator */
  .svg-wrapper :global(g.subgraph[data-has-sheet="true"]) {
    cursor: pointer;
  }

  .svg-wrapper :global(g.subgraph[data-has-sheet="true"]:hover > rect) {
    filter: brightness(1.05);
    stroke: var(--color-primary) !important;
    stroke-width: 2px !important;
  }

  /* Loading & Error */
  .loading, .error {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    color: var(--color-text-muted);
    z-index: 5;
  }

  .spinner {
    width: 32px;
    height: 32px;
    border: 2px solid var(--color-border);
    border-top-color: #3b82f6;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .error {
    color: #f87171;
  }

  .error-icon {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #ef4444;
    color: white;
    border-radius: 50%;
    font-weight: bold;
  }

  /* Tooltip */
  .tooltip {
    position: fixed;
    z-index: 1000;
    padding: 8px 12px;
    background: var(--color-bg-elevated);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    color: var(--color-text);
    font-size: 12px;
    line-height: 1.5;
    pointer-events: none;
    backdrop-filter: blur(8px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    max-width: 280px;
  }

  .tooltip :global(.muted) {
    color: var(--color-text-muted);
    font-size: 11px;
  }

  .tooltip :global(.action) {
    color: #3b82f6;
    font-size: 11px;
  }

  /* Controls */
  .controls {
    position: absolute;
    bottom: 16px;
    right: 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    z-index: 10;
  }

  .control-group {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px;
    background: var(--color-bg-elevated);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    backdrop-filter: blur(8px);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  .control-group button {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    border-radius: 6px;
    color: var(--color-text-muted);
    cursor: pointer;
    transition: all 0.15s;
  }

  .control-group button:hover {
    background: var(--color-bg);
    color: var(--color-text);
  }

  .control-group button.active {
    background: var(--color-bg);
    color: var(--color-primary);
  }


  .zoom-level {
    min-width: 48px;
    text-align: center;
    font-size: 11px;
    font-weight: 500;
    color: var(--color-text-muted);
  }

  /* Legend */
  .legend {
    position: absolute;
    bottom: 16px;
    left: 16px;
    padding: 12px;
    background: var(--color-bg-elevated);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    backdrop-filter: blur(8px);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    z-index: 10;
  }

  .legend-title {
    font-size: 10px;
    font-weight: 600;
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 8px;
  }

  .legend-items {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 11px;
    color: var(--color-text);
  }

  .legend-color {
    width: 12px;
    height: 4px;
    border-radius: 2px;
  }

  /* Warnings banner */
  .warnings-banner {
    position: absolute;
    top: 16px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 8px 16px;
    background: #fef3c7;
    border: 1px solid #f59e0b;
    border-radius: 8px;
    z-index: 10;
    font-size: 12px;
    color: #92400e;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  :global(.dark) .warnings-banner {
    background: #451a03;
    border-color: #b45309;
    color: #fcd34d;
  }

  .warning-text {
    white-space: nowrap;
  }

  /* Print: hide UI chrome (main print styles in app.css) */
  @media print {
    .diagram-container {
      overflow: visible !important;
      background: white !important;
      background-image: none !important;
    }

    .controls,
    .tooltip,
    .breadcrumb,
    .legend,
    .warnings-banner {
      display: none !important;
    }
  }
</style>
