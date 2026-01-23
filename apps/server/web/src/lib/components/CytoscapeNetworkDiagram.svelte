<script lang="ts">
import { onMount, onDestroy, createEventDispatcher } from 'svelte'
import cytoscape from 'cytoscape'
import type { Core, EventObject, NodeSingular, EdgeSingular } from 'cytoscape'
import { metricsStore, metricsData } from '$lib/stores'
import { createDarkStylesheet, getUtilizationColor, statusColors } from '$lib/cytoscape/theme'
import { convertToCytoscapeElements } from '$lib/cytoscape/converter'
import type { ParsedTopologyResponse } from '$lib/types'

// Props
export let topologyId: string
export let enableMetrics = true

const dispatch = createEventDispatcher<{
  nodeClick: { nodeId: string; nodeData: Record<string, unknown> }
  subgraphClick: { subgraphId: string; file?: string }
}>()

// Cytoscape instance
let cy: Core | null = null
let container: HTMLDivElement

// State
let loading = true
let error = ''
let currentSheet = 'root'
let breadcrumb: { id: string; label: string }[] = [{ id: 'root', label: 'Root' }]
let scale = 1
let hoveredNode: string | null = null
let selectedNode: string | null = null

// Tooltip state
let tooltipVisible = false
let tooltipContent = ''
let tooltipX = 0
let tooltipY = 0

// Highlight neighbors on hover
function highlightNeighbors(node: NodeSingular) {
  const neighborhood = node.closedNeighborhood()

  cy?.elements().addClass('faded')
  neighborhood.removeClass('faded').addClass('highlighted')
}

function clearHighlight() {
  cy?.elements().removeClass('faded').removeClass('highlighted')
}

// Show tooltip
function showTooltip(node: NodeSingular, event: EventObject) {
  const data = node.data()
  const pos = event.renderedPosition || { x: 0, y: 0 }

  let content = `<strong>${data.label || data.id}</strong>`

  if (data.type) {
    content += `<br><span class="text-xs text-gray-400">Type: ${data.type}</span>`
  }
  if (data.status) {
    const statusColor =
      statusColors[data.status as keyof typeof statusColors] || statusColors.unknown
    content += `<br><span class="text-xs" style="color: ${statusColor}">Status: ${data.status}</span>`
  }
  if (data.sourcePort || data.targetPort) {
    content += `<br><span class="text-xs text-gray-400">Ports: ${data.sourcePort || '?'} → ${data.targetPort || '?'}</span>`
  }

  tooltipContent = content
  tooltipX = pos.x + 15
  tooltipY = pos.y + 15
  tooltipVisible = true
}

function hideTooltip() {
  tooltipVisible = false
}

// Edge tooltip
function showEdgeTooltip(edge: EdgeSingular, event: EventObject) {
  const data = edge.data()
  const pos = event.renderedPosition || { x: 0, y: 0 }

  let content = `<strong>${data.label || data.id}</strong>`

  if (data.utilization !== undefined) {
    const color = getUtilizationColor(data.utilization)
    content += `<br><span class="text-xs" style="color: ${color}">Utilization: ${data.utilization.toFixed(1)}%</span>`
  }
  if (data.vlan) {
    content += `<br><span class="text-xs text-gray-400">VLAN: ${data.vlan}</span>`
  }
  if (data.status) {
    const statusColor =
      statusColors[data.status as keyof typeof statusColors] || statusColors.unknown
    content += `<br><span class="text-xs" style="color: ${statusColor}">Status: ${data.status}</span>`
  }

  tooltipContent = content
  tooltipX = pos.x + 15
  tooltipY = pos.y + 15
  tooltipVisible = true
}

// Handle node click
function handleNodeClick(node: NodeSingular) {
  const data = node.data()

  // If it's a subgraph with a file, drill down
  if (data.hasFile === 'true' && data.file) {
    dispatch('subgraphClick', { subgraphId: data.id, file: data.file })
    // For now, just log - actual navigation would require API changes
    console.log('Drill down to:', data.id, data.file)
  }

  // If it's an export connector, could navigate to destination
  if (data.isExport === 'true' && data.destSubgraphId) {
    console.log('Navigate to:', data.destSubgraphId)
  }

  selectedNode = data.id
  dispatch('nodeClick', { nodeId: data.id, nodeData: data })
}

// Fit view
function fitView() {
  cy?.fit(undefined, 50)
  scale = cy?.zoom() || 1
}

// Reset view
function resetView() {
  cy?.fit(undefined, 50)
  cy?.center()
  scale = 1
}

// Zoom controls
function zoomIn() {
  const currentZoom = cy?.zoom() || 1
  cy?.zoom(currentZoom * 1.2)
  scale = cy?.zoom() || 1
}

function zoomOut() {
  const currentZoom = cy?.zoom() || 1
  cy?.zoom(currentZoom / 1.2)
  scale = cy?.zoom() || 1
}

// Load topology data
async function loadTopology() {
  loading = true
  error = ''

  try {
    const response = await fetch(`/api/topologies/${topologyId}/parsed`)
    if (!response.ok) {
      throw new Error(`Failed to load topology: ${response.status}`)
    }

    const data: ParsedTopologyResponse = await response.json()

    // Convert to Cytoscape elements
    const elements = convertToCytoscapeElements(data)

    // Initialize or update Cytoscape
    if (cy) {
      cy.elements().remove()
      cy.add(elements.nodes)
      cy.add(elements.edges)
    } else {
      cy = cytoscape({
        container,
        elements: [...elements.nodes, ...elements.edges],
        style: createDarkStylesheet(),
        layout: { name: 'preset' }, // Use positions from layout
        minZoom: 0.1,
        maxZoom: 4,
        wheelSensitivity: 0.3,
        boxSelectionEnabled: true,
        selectionType: 'single',
      })

      // Event handlers
      cy.on('mouseover', 'node', (e) => {
        const node = e.target as NodeSingular
        hoveredNode = node.id()
        highlightNeighbors(node)
        showTooltip(node, e)
      })

      cy.on('mouseout', 'node', () => {
        hoveredNode = null
        clearHighlight()
        hideTooltip()
      })

      cy.on('mouseover', 'edge', (e) => {
        const edge = e.target as EdgeSingular
        edge.addClass('highlighted')
        showEdgeTooltip(edge, e)
      })

      cy.on('mouseout', 'edge', (e) => {
        const edge = e.target as EdgeSingular
        edge.removeClass('highlighted')
        hideTooltip()
      })

      cy.on('tap', 'node', (e) => {
        const node = e.target as NodeSingular
        handleNodeClick(node)
      })

      cy.on('tap', 'node:parent', (e) => {
        const node = e.target as NodeSingular
        handleNodeClick(node)
      })

      cy.on('zoom', () => {
        scale = cy?.zoom() || 1
      })

      // Background click to deselect
      cy.on('tap', (e) => {
        if (e.target === cy) {
          selectedNode = null
        }
      })
    }

    // Fit to view
    setTimeout(() => {
      fitView()
    }, 100)

    loading = false
  } catch (e) {
    error = e instanceof Error ? e.message : 'Unknown error'
    loading = false
  }
}

// Apply metrics from WebSocket
function applyMetrics(metrics: typeof $metricsData) {
  if (!cy || !metrics) return

  // Apply node status
  if (metrics.nodes) {
    for (const [nodeId, nodeMetrics] of Object.entries(metrics.nodes)) {
      const node = cy.getElementById(nodeId)
      if (node.length) {
        node.data('status', nodeMetrics.status)
      }
    }
  }

  // Apply link status and utilization with animation
  if (metrics.links) {
    for (const [linkId, linkMetrics] of Object.entries(metrics.links)) {
      const edge = cy.getElementById(linkId)
      if (edge.length) {
        edge.data('status', linkMetrics.status)

        if (linkMetrics.utilization !== undefined) {
          edge.data('utilization', linkMetrics.utilization)
          const color = getUtilizationColor(linkMetrics.utilization)

          // Animate color change
          edge.animate({
            style: {
              'line-color': color,
              'target-arrow-color': color,
              width: linkMetrics.utilization > 75 ? 4 : linkMetrics.utilization > 50 ? 3 : 2,
            },
            duration: 300,
            easing: 'ease-out',
          })
        }
      }
    }
  }
}

// Watch for metrics toggle
let prevEnableMetrics = enableMetrics
$: if (topologyId && prevEnableMetrics !== enableMetrics) {
  prevEnableMetrics = enableMetrics
  if (enableMetrics) {
    metricsStore.connect()
    metricsStore.subscribeToTopology(topologyId)
  } else {
    metricsStore.disconnect()
    // Reset edge styles
    cy?.edges().animate({
      style: {
        'line-color': '#64748b',
        'target-arrow-color': '#64748b',
        width: 2,
      },
      duration: 300,
    })
  }
}

// Apply metrics when data changes
$: if (enableMetrics && $metricsData && cy) {
  applyMetrics($metricsData)
}

onMount(async () => {
  await loadTopology()

  // Initial metrics connection
  if (enableMetrics && topologyId) {
    metricsStore.connect()
    metricsStore.subscribeToTopology(topologyId)
  }
})

onDestroy(() => {
  metricsStore.disconnect()
  cy?.destroy()
  cy = null
})
</script>

<div class="cytoscape-container">
  <!-- Breadcrumb -->
  {#if breadcrumb.length > 1}
    <div class="breadcrumb">
      {#each breadcrumb as crumb, i}
        {#if i > 0}
          <span class="separator">›</span>
        {/if}
        <button
          class="crumb"
          class:active={i === breadcrumb.length - 1}
          on:click={() => {
            // Navigate to this level
            breadcrumb = breadcrumb.slice(0, i + 1)
            currentSheet = crumb.id
          }}
        >
          {crumb.label}
        </button>
      {/each}
    </div>
  {/if}

  <!-- Main canvas -->
  <div class="canvas-wrapper">
    {#if loading}
      <div class="loading">
        <div class="spinner"></div>
        <span>Loading topology...</span>
      </div>
    {:else if error}
      <div class="error">
        <span class="error-icon">⚠</span>
        <span>{error}</span>
      </div>
    {/if}

    <div bind:this={container} class="cytoscape-canvas"></div>
  </div>

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
      <button on:click={fitView} title="Fit to View">
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

  <!-- Legend -->
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
</div>

<style>
  .cytoscape-container {
    position: relative;
    width: 100%;
    height: 100%;
    background: #0f172a;
    overflow: hidden;
  }

  .canvas-wrapper {
    width: 100%;
    height: 100%;
    position: relative;
  }

  .cytoscape-canvas {
    width: 100%;
    height: 100%;
    background: #0f172a;
    background-image:
      radial-gradient(rgba(255,255,255,0.03) 1px, transparent 1px);
    background-size: 20px 20px;
  }

  /* Breadcrumb */
  .breadcrumb {
    position: absolute;
    top: 12px;
    left: 12px;
    z-index: 10;
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 8px 12px;
    background: rgba(30, 41, 59, 0.9);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    backdrop-filter: blur(8px);
  }

  .crumb {
    padding: 4px 8px;
    background: transparent;
    border: none;
    border-radius: 4px;
    color: #94a3b8;
    font-size: 12px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .crumb:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #e2e8f0;
  }

  .crumb.active {
    color: #60a5fa;
    font-weight: 500;
  }

  .separator {
    color: #475569;
    font-size: 12px;
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
    color: #64748b;
    z-index: 5;
    background: rgba(15, 23, 42, 0.8);
  }

  .spinner {
    width: 32px;
    height: 32px;
    border: 2px solid #334155;
    border-top-color: #60a5fa;
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
    font-size: 24px;
  }

  /* Tooltip */
  .tooltip {
    position: absolute;
    z-index: 100;
    padding: 8px 12px;
    background: rgba(30, 41, 59, 0.95);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    color: #e2e8f0;
    font-size: 12px;
    line-height: 1.5;
    pointer-events: none;
    backdrop-filter: blur(8px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    max-width: 250px;
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
    background: rgba(30, 41, 59, 0.9);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    backdrop-filter: blur(8px);
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
    color: #94a3b8;
    cursor: pointer;
    transition: all 0.15s;
  }

  .control-group button:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #e2e8f0;
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
    color: #94a3b8;
  }

  /* Legend */
  .legend {
    position: absolute;
    bottom: 16px;
    left: 16px;
    padding: 12px;
    background: rgba(30, 41, 59, 0.9);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    backdrop-filter: blur(8px);
    z-index: 10;
  }

  .legend-title {
    font-size: 10px;
    font-weight: 600;
    color: #64748b;
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
    color: #94a3b8;
  }

  .legend-color {
    width: 12px;
    height: 4px;
    border-radius: 2px;
  }
</style>
