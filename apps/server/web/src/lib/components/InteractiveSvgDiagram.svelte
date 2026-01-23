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
</script>

<script lang="ts">
import { onMount, onDestroy, tick } from 'svelte'
import panzoom from 'panzoom'
import type { PanZoom } from 'panzoom'
import {
  metricsStore,
  metricsData,
  liveUpdatesEnabled,
  showTrafficFlow,
  showNodeStatus,
} from '$lib/stores'
import ArrowLeft from 'phosphor-svelte/lib/ArrowLeft'
import MagnifyingGlassPlus from 'phosphor-svelte/lib/MagnifyingGlassPlus'
import MagnifyingGlassMinus from 'phosphor-svelte/lib/MagnifyingGlassMinus'
import CornersOut from 'phosphor-svelte/lib/CornersOut'
import ArrowCounterClockwise from 'phosphor-svelte/lib/ArrowCounterClockwise'
import GearSix from 'phosphor-svelte/lib/GearSix'

// Props
export let topologyId: string
export let onToggleSettings: (() => void) | undefined = undefined
export let settingsOpen = false
export let onNodeSelect: ((event: NodeSelectEvent) => void) | undefined = undefined

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

// Currently hovered/selected elements
let hoveredNodeId: string | null = null
let selectedNodeId: string | null = null

// Utilization color scale (weathermap style)
const utilizationColors = [
  { max: 0, color: '#6b7280' },
  { max: 1, color: '#22c55e' },
  { max: 25, color: '#84cc16' },
  { max: 50, color: '#eab308' },
  { max: 75, color: '#f97316' },
  { max: 90, color: '#ef4444' },
  { max: 100, color: '#dc2626' },
]

function getUtilizationColor(utilization: number): string {
  for (const t of utilizationColors) {
    if (utilization <= t.max) return t.color
  }
  return '#dc2626'
}

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
    const res = await fetch(`/api/topologies/${topologyId}/render`)
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
    // Clear original styles cache when switching sheets
    originalLinkStyles.clear()
  }
}

// Navigate to a child sheet
async function navigateToSheet(sheetId: string) {
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

// Initialize panzoom
function initPanZoom() {
  if (!svgWrapper) return

  panzoomInstance = panzoom(svgWrapper, {
    maxZoom: 10,
    minZoom: 0.1,
    smoothScroll: false,
    zoomDoubleClickSpeed: 1,
    bounds: false,
    transformOrigin: { x: 0.5, y: 0.5 },
  })

  panzoomInstance.on('zoom', () => {
    scale = panzoomInstance?.getTransform().scale ?? 1
  })

  panzoomInstance.on('pan', () => {
    scale = panzoomInstance?.getTransform().scale ?? 1
  })

  // Initial fit to view
  fitToView()
}

// Fit SVG to container
function fitToView() {
  if (!svgElement || !container || !panzoomInstance) return

  const containerRect = container.getBoundingClientRect()
  const viewBox = svgElement.viewBox.baseVal
  if (!viewBox || viewBox.width === 0) return

  const svgWidth = viewBox.width
  const svgHeight = viewBox.height

  const scaleX = containerRect.width / svgWidth
  const scaleY = containerRect.height / svgHeight
  const newScale = Math.min(scaleX, scaleY) * 0.85

  panzoomInstance.zoomAbs(0, 0, newScale)

  const scaledWidth = svgWidth * newScale
  const scaledHeight = svgHeight * newScale
  const offsetX = (containerRect.width - scaledWidth) / 2 - viewBox.x * newScale
  const offsetY = (containerRect.height - scaledHeight) / 2 - viewBox.y * newScale

  panzoomInstance.moveTo(offsetX, offsetY)
  scale = newScale
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

// Setup SVG interactivity
function setupInteractivity() {
  if (!svgElement) return

  // Node hover/click
  const nodes = svgElement.querySelectorAll('g.node')
  nodes.forEach((node) => {
    const nodeEl = node as SVGGElement
    const nodeId = nodeEl.getAttribute('data-id') || ''

    nodeEl.addEventListener('mouseenter', (e) => handleNodeHover(nodeId, e))
    nodeEl.addEventListener('mouseleave', () => handleNodeLeave())
    nodeEl.addEventListener('click', () => handleNodeClick(nodeId))
    nodeEl.style.cursor = 'pointer'
  })

  // Subgraph hover/click for hierarchical navigation
  const subgraphs = svgElement.querySelectorAll('g.subgraph')
  subgraphs.forEach((sg) => {
    const sgEl = sg as SVGGElement
    const sgId = sgEl.getAttribute('data-id') || ''
    const hasFile = sgEl.getAttribute('data-has-file') === 'true'

    sgEl.addEventListener('mouseenter', (e) => handleSubgraphHover(sgId, e))
    sgEl.addEventListener('mouseleave', () => handleSubgraphLeave())

    // Enable click navigation if this subgraph has a corresponding sheet
    if (hasFile || sheets[sgId]) {
      sgEl.addEventListener('click', (e) => {
        e.stopPropagation()
        handleSubgraphClick(sgId)
      })
      sgEl.style.cursor = 'pointer'
    }
  })

  // Link hover
  const links = svgElement.querySelectorAll('g.link-group')
  links.forEach((link) => {
    const linkEl = link as SVGGElement
    const linkId = linkEl.getAttribute('data-link-id') || ''

    linkEl.addEventListener('mouseenter', (e) => handleLinkHover(linkId, e))
    linkEl.addEventListener('mouseleave', () => handleLinkLeave())
    linkEl.style.cursor = 'pointer'
  })
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
    const from = linkEl.getAttribute('data-from') || ''
    const to = linkEl.getAttribute('data-to') || ''

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

// Tooltip functions
function showNodeTooltip(nodeId: string, event: MouseEvent) {
  if (!svgElement) return
  const node = svgElement.querySelector(`g.node[data-id="${nodeId}"]`)
  if (!node) return

  // Get label from text element inside the node, or fall back to node id
  const labelEl = node.querySelector('text.node-label, text')
  const label = labelEl?.textContent?.trim() || nodeId
  const type = node.getAttribute('data-device-type') || ''
  const vendor = node.getAttribute('data-device-vendor') || ''
  const model = node.getAttribute('data-device-model') || ''

  let content = `<strong>${label}</strong>`
  if (type) content += `<br><span class="muted">Type: ${type}</span>`
  if (vendor) content += `<br><span class="muted">Vendor: ${vendor}</span>`
  if (model) content += `<br><span class="muted">Model: ${model}</span>`

  showTooltip(content, event)
}

function showSubgraphTooltip(sgId: string, event: MouseEvent) {
  if (!svgElement) return
  const sg = svgElement.querySelector(`g.subgraph[data-id="${sgId}"]`)
  if (!sg) return

  const label = sg.getAttribute('data-label') || sgId
  const canNavigate = sheets[sgId] !== undefined

  let content = `<strong>${label}</strong>`
  if (canNavigate) content += `<br><span class="action">Click to drill down</span>`

  showTooltip(content, event)
}

function showLinkTooltip(linkId: string, event: MouseEvent) {
  if (!svgElement) return
  const link = svgElement.querySelector(`g.link-group[data-link-id="${linkId}"]`)
  if (!link) return

  const from = link.getAttribute('data-from') || ''
  const to = link.getAttribute('data-to') || ''
  const bandwidth = link.getAttribute('data-bandwidth') || ''

  let content = `<strong>${from} → ${to}</strong>`
  if (bandwidth) content += `<br><span class="muted">Bandwidth: ${bandwidth}</span>`

  const metrics = $metricsData?.links?.[linkId]
  if (metrics) {
    if (metrics.utilization !== undefined) {
      const color = getUtilizationColor(metrics.utilization)
      content += `<br><span style="color: ${color}">Utilization: ${metrics.utilization.toFixed(1)}%</span>`
    }
    content += `<br><span class="muted">Status: ${metrics.status}</span>`
  }

  showTooltip(content, event)
}

function showTooltip(content: string, event: MouseEvent) {
  tooltipContent = content
  tooltipX = event.clientX + 12
  tooltipY = event.clientY + 12
  tooltipVisible = true
}

function hideTooltip() {
  tooltipVisible = false
}

// Store original link styles for restoration
const originalLinkStyles = new Map<
  string,
  Map<SVGPathElement, { stroke: string; strokeDasharray: string }>
>()

function saveOriginalLinkStyles() {
  if (!svgElement) return

  const linkGroups = svgElement.querySelectorAll('g.link-group')
  linkGroups.forEach((linkGroup) => {
    const linkId = linkGroup.getAttribute('data-link-id') || ''
    const paths = linkGroup.querySelectorAll('path.link') as NodeListOf<SVGPathElement>

    const pathStyles = new Map<SVGPathElement, { stroke: string; strokeDasharray: string }>()
    paths.forEach((path) => {
      pathStyles.set(path, {
        stroke: path.getAttribute('stroke') || '',
        strokeDasharray: path.style.strokeDasharray || '',
      })
    })
    originalLinkStyles.set(linkId, pathStyles)
  })
}

function applyMetrics(
  metrics: typeof $metricsData,
  applyTrafficFlow: boolean,
  applyNodeStatus: boolean,
) {
  if (!svgElement || !metrics) return

  if (originalLinkStyles.size === 0) {
    saveOriginalLinkStyles()
  }

  if (applyTrafficFlow && metrics.links) {
    for (const [linkId, linkMetrics] of Object.entries(metrics.links)) {
      const linkGroup = svgElement.querySelector(`g.link-group[data-link-id="${linkId}"]`)
      if (!linkGroup) continue

      const paths = Array.from(linkGroup.querySelectorAll('path.link')) as SVGPathElement[]
      if (paths.length === 0) continue

      const inUtil = linkMetrics.inUtilization ?? linkMetrics.utilization ?? 0
      const outUtil = linkMetrics.outUtilization ?? linkMetrics.utilization ?? 0

      if (linkMetrics.status === 'down') {
        paths.forEach((path) => {
          path.setAttribute('stroke', '#ef4444')
          path.style.strokeDasharray = '8 4'
          path.style.animation = ''
        })
      } else {
        const midPoint = Math.ceil(paths.length / 2)

        paths.forEach((path, index) => {
          const isInGroup = index < midPoint
          const util = isInGroup ? inUtil : outUtil
          const color = getUtilizationColor(util)
          const animName = isInGroup ? 'shumoku-edge-flow-in' : 'shumoku-edge-flow-out'

          path.setAttribute('stroke', color)

          if (util > 0) {
            path.style.strokeDasharray = '16 8'
            const duration = Math.max(0.5, 2.5 - (util / 100) * 2)
            path.style.animation = `${animName} ${duration.toFixed(2)}s linear infinite`
          } else {
            path.style.strokeDasharray = ''
            path.style.animation = ''
          }
        })
      }
    }
  }

  if (applyNodeStatus && metrics.nodes) {
    for (const [nodeId, nodeMetrics] of Object.entries(metrics.nodes)) {
      const nodeGroup = svgElement.querySelector(`g.node[data-id="${nodeId}"]`)
      if (!nodeGroup) continue

      nodeGroup.classList.remove('status-up', 'status-down', 'status-unknown')
      nodeGroup.classList.add(`status-${nodeMetrics.status}`)

      const rect = nodeGroup.querySelector('.node-bg rect, rect.node-bg') as SVGRectElement
      if (rect) {
        if (nodeMetrics.status === 'down') {
          rect.setAttribute('stroke', '#ef4444')
          rect.setAttribute('stroke-width', '2')
        } else if (nodeMetrics.status === 'up') {
          rect.setAttribute('stroke', '#22c55e')
          rect.setAttribute('stroke-width', '2')
        }
      }
    }
  }
}

function resetLinkStyles() {
  if (!svgElement) return

  for (const [, pathStyles] of originalLinkStyles) {
    for (const [path, styles] of pathStyles) {
      path.setAttribute('stroke', styles.stroke)
      path.style.strokeDasharray = styles.strokeDasharray
      path.style.animation = ''
    }
  }
}

function resetNodeStyles() {
  if (!svgElement) return

  const nodeGroups = svgElement.querySelectorAll('g.node')
  nodeGroups.forEach((node) => {
    node.classList.remove('status-up', 'status-down', 'status-unknown')
    const rect = node.querySelector('.node-bg rect, rect.node-bg') as SVGRectElement
    if (rect) {
      rect.removeAttribute('stroke')
      rect.removeAttribute('stroke-width')
    }
  })
}

let prevLiveUpdates = $liveUpdatesEnabled

$: if (topologyId && prevLiveUpdates !== $liveUpdatesEnabled) {
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

onMount(async () => {
  await loadContent()

  if ($liveUpdatesEnabled && topologyId) {
    metricsStore.connect()
    metricsStore.subscribeToTopology(topologyId)
  }
})

onDestroy(() => {
  metricsStore.disconnect()
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

<div class="diagram-container" bind:this={container}>
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

  /* Clickable subgraph indicator */
  .svg-wrapper :global(g.subgraph[data-has-file="true"]) {
    cursor: pointer;
  }

  .svg-wrapper :global(g.subgraph[data-has-file="true"]:hover > rect) {
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
</style>
