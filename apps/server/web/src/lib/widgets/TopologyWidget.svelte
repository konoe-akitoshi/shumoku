<script lang="ts">
import { onMount, onDestroy } from 'svelte'
import { api } from '$lib/api'
import type { Topology } from '$lib/types'
import { dashboardStore, dashboardEditMode } from '$lib/stores/dashboards'
import { widgetEvents, type WidgetEvent } from '$lib/stores/widgetEvents'
import WidgetWrapper from './WidgetWrapper.svelte'
import TreeStructure from 'phosphor-svelte/lib/TreeStructure'
import Spinner from 'phosphor-svelte/lib/Spinner'
import ArrowSquareOut from 'phosphor-svelte/lib/ArrowSquareOut'

interface SheetInfo {
  id: string
  name: string
}

interface Props {
  id: string
  config: {
    topologyId?: string
    sheetId?: string
  }
  onRemove?: () => void
}

let { id, config, onRemove }: Props = $props()

let topology: Topology | null = $state(null)
let topologies: Topology[] = $state([])
let svgContent = $state('')
let loading = $state(true)
let error = $state('')
let lastTopologyId = $state('')
let lastSheetId = $state('')
let showSelector = $state(false)

// Hierarchical topology support
let isHierarchical = $state(false)
let sheets: SheetInfo[] = $state([])
let renderCache: Record<string, string> = {}

// Highlight support for widget events
let highlightedNodeId = $state<string | null>(null)
let highlightTimeout: ReturnType<typeof setTimeout> | null = null
let containerElement = $state<HTMLDivElement | null>(null)
let styleElement: HTMLStyleElement | null = null
let unsubscribeEvents: (() => void) | null = null

async function loadTopologies() {
  try {
    topologies = await api.topologies.list()
  } catch (err) {
    console.error('Failed to load topologies:', err)
  }
}

async function loadTopology() {
  if (!config.topologyId) {
    loading = false
    return
  }

  loading = true
  error = ''

  try {
    topology = await api.topologies.get(config.topologyId)

    // Fetch rendered SVG
    const renderResult = await fetch(`/api/topologies/${config.topologyId}/render`)
    const renderData = await renderResult.json()

    if (renderData.hierarchical) {
      isHierarchical = true
      sheets = Object.entries(renderData.sheets).map(([sheetId, sheet]: [string, any]) => ({
        id: sheetId,
        name: sheet.name || sheetId,
      }))
      renderCache = {}
      for (const [sheetId, sheet] of Object.entries(renderData.sheets) as [string, any][]) {
        renderCache[sheetId] = sheet.svg
      }
      const sheetId = config.sheetId || 'root'
      svgContent = renderCache[sheetId] || ''
      // All sheets share the same theme CSS; pick from any sheet
      const firstSheet = Object.values(renderData.sheets)[0] as any
      injectCSS(firstSheet?.css)
    } else {
      isHierarchical = false
      sheets = []
      renderCache = {}
      svgContent = renderData.svg
      injectCSS(renderData.css)
    }
  } catch (err) {
    error = err instanceof Error ? err.message : 'Failed to load topology'
  } finally {
    loading = false
  }
}

function injectCSS(css: string | undefined) {
  if (!css) return
  if (styleElement) {
    styleElement.remove()
  }
  styleElement = document.createElement('style')
  styleElement.setAttribute('data-shumoku-widget', id)
  styleElement.textContent = css
  document.head.appendChild(styleElement)
}

function selectTopology(topologyId: string) {
  if (!topologyId) return
  // Reset sheet when changing topology
  dashboardStore.updateWidgetConfig(id, { topologyId, sheetId: 'root' })
  config = { ...config, topologyId, sheetId: 'root' }
  showSelector = false
}

function selectSheet(sheetId: string) {
  if (!sheetId) return
  dashboardStore.updateWidgetConfig(id, { sheetId })
  config = { ...config, sheetId }
  // Update SVG from cache
  if (renderCache[sheetId]) {
    svgContent = renderCache[sheetId]
  }
}

function handleWidgetEvent(event: WidgetEvent) {
  // Only handle events for this topology
  if (event.payload.topologyId !== config.topologyId) return

  const nodeId = event.payload.nodeId

  switch (event.type) {
    case 'zoom-to-node':
    case 'highlight-node':
      highlightNode(nodeId, event.payload.duration || 3000)
      scrollToNode(nodeId)
      break
    case 'select-node':
      highlightNode(nodeId)
      scrollToNode(nodeId)
      break
    case 'clear-highlight':
      clearHighlight()
      break
  }
}

function highlightNode(nodeId: string, duration?: number) {
  // Clear any existing highlight
  clearHighlight()

  highlightedNodeId = nodeId

  // Apply highlight style to the node element
  if (containerElement) {
    const nodeElement = containerElement.querySelector(
      `[data-node-id="${nodeId}"]`,
    ) as HTMLElement | null
    if (nodeElement) {
      nodeElement.classList.add('node-highlighted')
    }
  }

  // Auto-clear after duration
  if (duration) {
    highlightTimeout = setTimeout(() => {
      clearHighlight()
    }, duration)
  }
}

function clearHighlight() {
  if (highlightTimeout) {
    clearTimeout(highlightTimeout)
    highlightTimeout = null
  }

  if (highlightedNodeId && containerElement) {
    const nodeElement = containerElement.querySelector(
      `[data-node-id="${highlightedNodeId}"]`,
    ) as HTMLElement | null
    if (nodeElement) {
      nodeElement.classList.remove('node-highlighted')
    }
  }

  highlightedNodeId = null
}

function scrollToNode(nodeId: string) {
  if (!containerElement) return

  // Find the node element in the SVG
  const nodeElement = containerElement.querySelector(
    `[data-node-id="${nodeId}"]`,
  ) as SVGGElement | null
  if (!nodeElement) return

  // Get the bounding box of the node
  const bbox = nodeElement.getBBox?.()
  if (!bbox) return

  // Find the SVG element
  const svg = containerElement.querySelector('svg')
  if (!svg) return

  // Get current viewBox
  const viewBox = svg.viewBox.baseVal
  if (!viewBox) return

  // Calculate the center of the node
  const nodeCenterX = bbox.x + bbox.width / 2
  const nodeCenterY = bbox.y + bbox.height / 2

  // Calculate new viewBox to center on the node with some padding
  const padding = 100
  const newWidth = Math.max(bbox.width + padding * 2, viewBox.width / 2)
  const newHeight = Math.max(bbox.height + padding * 2, viewBox.height / 2)

  const newViewBox = `${nodeCenterX - newWidth / 2} ${nodeCenterY - newHeight / 2} ${newWidth} ${newHeight}`

  // Animate the viewBox change
  svg.style.transition = 'all 0.3s ease-out'
  svg.setAttribute('viewBox', newViewBox)

  // Reset viewBox after a delay
  setTimeout(() => {
    svg.style.transition = 'all 0.5s ease-in-out'
    svg.setAttribute('viewBox', `${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`)
  }, 2000)
}

onMount(() => {
  loadTopologies()
  loadTopology()

  // Subscribe to widget events
  unsubscribeEvents = widgetEvents.on(handleWidgetEvent)
})

onDestroy(() => {
  if (unsubscribeEvents) {
    unsubscribeEvents()
  }
  if (highlightTimeout) {
    clearTimeout(highlightTimeout)
  }
  if (styleElement) {
    styleElement.remove()
    styleElement = null
  }
})

// Watch for topology ID changes
$effect(() => {
  if (config.topologyId && config.topologyId !== lastTopologyId) {
    lastTopologyId = config.topologyId
    loadTopology()
  }
})

// Watch for sheet ID changes (when topology is already loaded)
$effect(() => {
  const sheetId = config.sheetId || 'root'
  if (sheetId !== lastSheetId && renderCache[sheetId]) {
    lastSheetId = sheetId
    svgContent = renderCache[sheetId]
  }
})

function handleSettings() {
  showSelector = !showSelector
}

// Get display name for current sheet
let currentSheetName = $derived(
  sheets.find((s) => s.id === (config.sheetId || 'root'))?.name || 'root',
)

let editMode = $derived($dashboardEditMode)
</script>

<WidgetWrapper
  title={topology?.name ? (isHierarchical ? `${topology.name} / ${currentSheetName}` : topology.name) : 'Topology'}
  {onRemove}
  onSettings={handleSettings}
>
  <div class="h-full w-full relative">
    {#if showSelector}
      <!-- Settings panel -->
      <div class="absolute inset-0 bg-theme-bg-elevated z-10 p-4 flex flex-col overflow-auto">
        <div class="text-sm font-medium text-theme-text-emphasis mb-3">Widget Settings</div>

        <label class="text-xs text-theme-text-muted mb-1">Topology</label>
        <select
          value={config.topologyId || ''}
          onchange={(e) => selectTopology(e.currentTarget.value)}
          class="px-3 py-2 bg-theme-bg-canvas border border-theme-border rounded text-sm text-theme-text mb-4"
        >
          <option value="">Select topology...</option>
          {#each topologies as t}
            <option value={t.id}>{t.name}</option>
          {/each}
        </select>

        {#if isHierarchical && sheets.length > 0}
          <label class="text-xs text-theme-text-muted mb-1">Sheet (Hierarchy Level)</label>
          <select
            value={config.sheetId || 'root'}
            onchange={(e) => selectSheet(e.currentTarget.value)}
            class="px-3 py-2 bg-theme-bg-canvas border border-theme-border rounded text-sm text-theme-text mb-4"
          >
            {#each sheets as sheet}
              <option value={sheet.id}>{sheet.name}</option>
            {/each}
          </select>
        {/if}

        <div class="mt-auto">
          <button
            onclick={() => showSelector = false}
            class="w-full px-3 py-1.5 bg-primary text-white rounded text-sm hover:bg-primary-dark transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    {:else if !config.topologyId}
      <!-- No topology selected -->
      <div class="h-full flex flex-col items-center justify-center text-theme-text-muted gap-3">
        <TreeStructure size={32} />
        <span class="text-sm">No topology selected</span>
        <button
          onclick={() => showSelector = true}
          class="px-3 py-1.5 bg-primary text-white rounded text-sm hover:bg-primary-dark transition-colors"
        >
          Configure
        </button>
      </div>
    {:else if loading}
      <div class="h-full flex items-center justify-center">
        <Spinner size={24} class="animate-spin text-theme-text-muted" />
      </div>
    {:else if error}
      <div class="h-full flex flex-col items-center justify-center text-danger gap-2">
        <span class="text-sm">{error}</span>
        <button
          onclick={loadTopology}
          class="text-xs text-primary hover:underline"
        >
          Retry
        </button>
      </div>
    {:else if svgContent}
      <div class="h-full w-full overflow-hidden topology-container relative group" bind:this={containerElement}>
        {@html svgContent}
        {#if !editMode && config.topologyId}
          <a
            href="/topologies/{config.topologyId}"
            class="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-theme-bg-elevated border border-theme-border rounded-lg px-3 py-1.5 flex items-center gap-1.5 text-xs text-theme-text hover:bg-theme-bg-canvas hover:border-primary/50 shadow-sm no-underline"
          >
            <ArrowSquareOut size={14} />
            <span>Open</span>
          </a>
        {/if}
      </div>
    {:else}
      <div class="h-full flex items-center justify-center text-theme-text-muted">
        <span class="text-sm">No content</span>
      </div>
    {/if}
  </div>
</WidgetWrapper>

<style>
  .topology-container :global(svg) {
    width: 100%;
    height: 100%;
    max-width: 100%;
    max-height: 100%;
  }

  /* Node highlight animation */
  .topology-container :global(.node-highlighted) {
    animation: node-pulse 0.5s ease-in-out infinite alternate;
  }

  .topology-container :global(.node-highlighted rect),
  .topology-container :global(.node-highlighted circle),
  .topology-container :global(.node-highlighted path) {
    stroke: #f59e0b !important;
    stroke-width: 3px !important;
    filter: drop-shadow(0 0 8px rgba(245, 158, 11, 0.6));
  }

  @keyframes node-pulse {
    from {
      opacity: 1;
    }
    to {
      opacity: 0.7;
    }
  }
</style>
