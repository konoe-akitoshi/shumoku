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

  // Props
  export let topologyId: string

  let svgContent = ''
  let container: HTMLDivElement
  let styleElement: HTMLStyleElement | null = null
  let svgWrapper: HTMLDivElement
  let svgElement: SVGSVGElement | null = null
  let panzoomInstance: PanZoom | null = null
  let loading = true
  let error = ''
  let scale = 1

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
  async function loadContent(skipFitToView = false) {
    loading = true
    error = ''
    try {
      const res = await fetch(`/api/topologies/${topologyId}/render`)
      if (!res.ok) {
        throw new Error(`Failed to load topology: ${res.status}`)
      }
      const data = await res.json()
      svgContent = data.svg

      // Inject CSS
      if (data.css) {
        injectCSS(data.css)
      }

      loading = false
      await tick()

      // Get the SVG element
      svgElement = svgWrapper?.querySelector('svg') || null

      if (svgElement) {
        // Initialize panzoom
        initPanZoom(skipFitToView)
        // Setup interactivity
        setupInteractivity()
      }
    } catch (e) {
      error = e instanceof Error ? e.message : 'Unknown error'
      loading = false
    }
  }

  // Initialize panzoom
  function initPanZoom(skipFitToView = false) {
    if (!svgWrapper || panzoomInstance) return

    panzoomInstance = panzoom(svgWrapper, {
      maxZoom: 10,
      minZoom: 0.1,
      smoothScroll: false,
      zoomDoubleClickSpeed: 1,
      // Don't use bounds - it causes zoom restrictions
      bounds: false,
      // Use transform origin at center for more intuitive zooming
      transformOrigin: { x: 0.5, y: 0.5 },
    })

    panzoomInstance.on('zoom', () => {
      scale = panzoomInstance?.getTransform().scale ?? 1
    })

    panzoomInstance.on('pan', () => {
      // Update scale display on pan too
      scale = panzoomInstance?.getTransform().scale ?? 1
    })

    // Initial fit to view (skip when restoring transform)
    if (!skipFitToView) {
      fitToView()
    }
  }

  // Fit SVG to container
  function fitToView() {
    if (!svgElement || !container || !panzoomInstance) return

    const containerRect = container.getBoundingClientRect()

    // Get viewBox dimensions from SVG
    const viewBox = svgElement.viewBox.baseVal
    if (!viewBox || viewBox.width === 0) return

    const svgWidth = viewBox.width
    const svgHeight = viewBox.height

    // Calculate scale to fit with padding
    const scaleX = containerRect.width / svgWidth
    const scaleY = containerRect.height / svgHeight
    const newScale = Math.min(scaleX, scaleY) * 0.85

    // Reset transform first
    panzoomInstance.zoomAbs(0, 0, newScale)

    // Center the SVG
    const scaledWidth = svgWidth * newScale
    const scaledHeight = svgHeight * newScale
    const offsetX = (containerRect.width - scaledWidth) / 2 - viewBox.x * newScale
    const offsetY = (containerRect.height - scaledHeight) / 2 - viewBox.y * newScale

    panzoomInstance.moveTo(offsetX, offsetY)
    scale = newScale
  }

  // Reset view to 100% zoom at origin
  function resetView() {
    if (!panzoomInstance) return
    panzoomInstance.zoomAbs(0, 0, 1)
    panzoomInstance.moveTo(0, 0)
    scale = 1
  }

  // Zoom controls
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

      // Hover events
      nodeEl.addEventListener('mouseenter', (e) => handleNodeHover(nodeId, e))
      nodeEl.addEventListener('mouseleave', () => handleNodeLeave())
      nodeEl.addEventListener('click', () => handleNodeClick(nodeId))

      // Make cursor pointer
      nodeEl.style.cursor = 'pointer'
    })

    // Subgraph hover/click
    const subgraphs = svgElement.querySelectorAll('g.subgraph')
    subgraphs.forEach((sg) => {
      const sgEl = sg as SVGGElement
      const sgId = sgEl.getAttribute('data-id') || ''
      const hasFile = sgEl.getAttribute('data-has-file') === 'true'

      sgEl.addEventListener('mouseenter', (e) => handleSubgraphHover(sgId, e))
      sgEl.addEventListener('mouseleave', () => handleSubgraphLeave())

      if (hasFile) {
        sgEl.addEventListener('click', () => handleSubgraphClick(sgId))
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
    selectedNodeId = selectedNodeId === nodeId ? null : nodeId
    console.log('Node clicked:', nodeId)
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
    console.log('Subgraph clicked (drill-down):', sgId)
    // TODO: Implement drill-down navigation
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
      if (highlight) {
        node.classList.add('highlighted')
      } else {
        node.classList.remove('highlighted')
      }
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
        if (highlight) {
          linkEl.classList.add('connected')
        } else {
          linkEl.classList.remove('connected')
        }
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

    const label = node.getAttribute('data-label') || nodeId
    const type = node.getAttribute('data-type') || ''
    const vendor = node.getAttribute('data-vendor') || ''
    const model = node.getAttribute('data-model') || ''

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
    const hasFile = sg.getAttribute('data-has-file') === 'true'

    let content = `<strong>${label}</strong>`
    if (hasFile) content += `<br><span class="action">Click to drill down</span>`

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

    // Add metrics if available
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
  const originalLinkStyles = new Map<string, Map<SVGPathElement, { stroke: string; strokeDasharray: string }>>()

  // Save original styles for all link paths
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

  // Apply metrics directly to original link paths
  // Respects display settings for traffic flow and node status
  function applyMetrics(
    metrics: typeof $metricsData,
    applyTrafficFlow: boolean,
    applyNodeStatus: boolean
  ) {
    if (!svgElement || !metrics) return

    // Save original styles on first call
    if (originalLinkStyles.size === 0) {
      saveOriginalLinkStyles()
    }

    // Update link colors based on utilization (only if showTrafficFlow is enabled)
    if (applyTrafficFlow && metrics.links) {
      // Split lines into two groups: half for in, half for out (bidirectional)
      for (const [linkId, linkMetrics] of Object.entries(metrics.links)) {
        const linkGroup = svgElement.querySelector(`g.link-group[data-link-id="${linkId}"]`)
        if (!linkGroup) continue

        const paths = Array.from(linkGroup.querySelectorAll('path.link')) as SVGPathElement[]
        if (paths.length === 0) continue

        const inUtil = linkMetrics.inUtilization ?? linkMetrics.utilization ?? 0
        const outUtil = linkMetrics.outUtilization ?? linkMetrics.utilization ?? 0

        if (linkMetrics.status === 'down') {
          // Down state - red with dashed pattern, no animation
          paths.forEach((path) => {
            path.setAttribute('stroke', '#ef4444')
            path.style.strokeDasharray = '8 4'
            path.style.animation = ''
          })
        } else {
          // Split paths into two groups for bidirectional animation
          // First half: in direction, Second half: out direction
          const midPoint = Math.ceil(paths.length / 2)

          paths.forEach((path, index) => {
            const isInGroup = index < midPoint
            // Each group uses its own utilization for color and speed
            const util = isInGroup ? inUtil : outUtil
            const color = getUtilizationColor(util)
            const animName = isInGroup ? 'shumoku-edge-flow-in' : 'shumoku-edge-flow-out'

            path.setAttribute('stroke', color)

            if (util > 0) {
              path.style.strokeDasharray = '16 8'  // Larger dash for better visibility
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

    // Update node status indicators (only if showNodeStatus is enabled)
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

  // Reset link styles when metrics disabled
  function resetLinkStyles() {
    if (!svgElement) return

    // Restore original styles
    for (const [linkId, pathStyles] of originalLinkStyles) {
      for (const [path, styles] of pathStyles) {
        path.setAttribute('stroke', styles.stroke)
        path.style.strokeDasharray = styles.strokeDasharray
        path.style.animation = ''
      }
    }
  }

  // Reset node styles when metrics disabled
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

  // Track previous liveUpdates state for reactive connection management
  let prevLiveUpdates = $liveUpdatesEnabled

  // Watch for liveUpdates toggle - manages WebSocket connection
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

  // Apply metrics when data changes (respects individual display settings)
  $: if ($liveUpdatesEnabled && $metricsData && svgElement) {
    applyMetrics($metricsData, $showTrafficFlow, $showNodeStatus)
  }

  // Watch for display setting changes to reset/apply visualizations
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
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"/>
          <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          <line x1="11" y1="8" x2="11" y2="14"/>
          <line x1="8" y1="11" x2="14" y2="11"/>
        </svg>
      </button>
      <span class="zoom-level">{Math.round(scale * 100)}%</span>
      <button on:click={zoomOut} title="Zoom Out">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"/>
          <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          <line x1="8" y1="11" x2="14" y2="11"/>
        </svg>
      </button>
    </div>
    <div class="control-group">
      <button on:click={fitToView} title="Fit to View">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
        </svg>
      </button>
      <button on:click={resetView} title="Reset View">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
          <path d="M3 3v5h5"/>
        </svg>
      </button>
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

  .control-group button svg {
    width: 18px;
    height: 18px;
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
