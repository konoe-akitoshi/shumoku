<script lang="ts">
import { onMount, onDestroy } from 'svelte'
import { api } from '$lib/api'
import type { Topology } from '$lib/types'
import { dashboardStore, dashboardEditMode } from '$lib/stores/dashboards'
import { widgetEvents, type WidgetEvent } from '$lib/stores/widgetEvents'
import { highlightNodes, highlightByAttribute, clearHighlight as clearHighlightUtil } from '$lib/highlight'
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
let renderSheets: Record<string, { svg: string }> = {}

// Highlight support for widget events
let highlightTimeout: ReturnType<typeof setTimeout> | null = null
let containerElement = $state<HTMLDivElement | null>(null)
let styleElement: HTMLStyleElement | null = null
let unsubscribeEvents: (() => void) | null = null
let savedViewBox: string | null = null

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
      renderSheets = renderData.sheets
      const sheetId = config.sheetId || 'root'
      svgContent = renderSheets[sheetId]?.svg || ''
      // All sheets share the same theme CSS; pick from any sheet
      const firstSheet = Object.values(renderData.sheets)[0] as any
      injectCSS(firstSheet?.css)
    } else {
      isHierarchical = false
      sheets = []
      renderSheets = {}
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
  if (renderSheets[sheetId]) {
    svgContent = renderSheets[sheetId].svg
  }
}

function handleWidgetEvent(event: WidgetEvent) {
  // Only handle events for this topology
  if (event.payload.topologyId !== config.topologyId) return
  if (!containerElement) return

  switch (event.type) {
    case 'zoom-to-node':
    case 'highlight-node': {
      const nodeId = event.payload.nodeId
      if (!nodeId) break
      clearCurrentHighlight()
      highlightNodes(containerElement, [nodeId])
      autoExpireHighlight(event.payload.duration || 3000)
      scrollToNode(nodeId)
      break
    }
    case 'select-node': {
      const nodeId = event.payload.nodeId
      if (!nodeId) break
      clearCurrentHighlight()
      highlightNodes(containerElement, [nodeId])
      scrollToNode(nodeId)
      break
    }
    case 'highlight-nodes': {
      const ids = event.payload.nodeIds
      if (!ids?.length) break
      clearCurrentHighlight()
      if (event.payload.highlightColor && containerElement) {
        containerElement.style.setProperty('--highlight-color', event.payload.highlightColor)
      }
      highlightNodes(containerElement, ids, { spotlight: event.payload.spotlight })
      zoomToFitHighlighted()
      if (event.payload.duration) autoExpireHighlight(event.payload.duration)
      break
    }
    case 'highlight-by-attribute': {
      const attr = event.payload.attribute
      if (!attr) break
      clearCurrentHighlight()
      highlightByAttribute(containerElement, attr.key, attr.value, {
        spotlight: event.payload.spotlight,
      })
      zoomToFitHighlighted()
      if (event.payload.duration) autoExpireHighlight(event.payload.duration)
      break
    }
    case 'clear-highlight':
      clearCurrentHighlight()
      break
  }
}

function clearCurrentHighlight() {
  if (highlightTimeout) {
    clearTimeout(highlightTimeout)
    highlightTimeout = null
  }
  if (containerElement) {
    clearHighlightUtil(containerElement)
    containerElement.style.removeProperty('--highlight-color')
  }
  restoreViewBox()
}

function autoExpireHighlight(duration: number) {
  highlightTimeout = setTimeout(() => clearCurrentHighlight(), duration)
}

function scrollToNode(nodeId: string) {
  if (!containerElement) return

  const nodeElement = containerElement.querySelector(
    `.node[data-id="${nodeId}"]`,
  ) as SVGGElement | null
  if (!nodeElement) return

  const bbox = nodeElement.getBBox?.()
  if (!bbox) return

  const svg = containerElement.querySelector('svg')
  if (!svg) return

  const viewBox = svg.viewBox.baseVal
  if (!viewBox) return

  const nodeCenterX = bbox.x + bbox.width / 2
  const nodeCenterY = bbox.y + bbox.height / 2

  const padding = 100
  const newWidth = Math.max(bbox.width + padding * 2, viewBox.width / 2)
  const newHeight = Math.max(bbox.height + padding * 2, viewBox.height / 2)

  const newViewBox = `${nodeCenterX - newWidth / 2} ${nodeCenterY - newHeight / 2} ${newWidth} ${newHeight}`

  svg.style.transition = 'all 0.3s ease-out'
  svg.setAttribute('viewBox', newViewBox)

  setTimeout(() => {
    svg.style.transition = 'all 0.5s ease-in-out'
    svg.setAttribute('viewBox', `${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`)
  }, 2000)
}

/**
 * Zoom to fit multiple highlighted nodes.
 * The highlighted nodes will occupy ~70% of the viewport.
 */
function zoomToFitHighlighted() {
  if (!containerElement) return

  const svg = containerElement.querySelector('svg')
  if (!svg) return

  const highlighted = containerElement.querySelectorAll('.node-highlighted') as NodeListOf<SVGGElement>
  if (highlighted.length === 0) return

  // Save original viewBox (only if not already saved)
  const vb = svg.viewBox.baseVal
  if (!savedViewBox && vb) {
    savedViewBox = `${vb.x} ${vb.y} ${vb.width} ${vb.height}`
  }

  // Compute union bounding box of highlighted nodes
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const el of highlighted) {
    const bbox = el.getBBox?.()
    if (!bbox) continue
    minX = Math.min(minX, bbox.x)
    minY = Math.min(minY, bbox.y)
    maxX = Math.max(maxX, bbox.x + bbox.width)
    maxY = Math.max(maxY, bbox.y + bbox.height)
  }

  if (!isFinite(minX)) return

  const contentW = maxX - minX
  const contentH = maxY - minY
  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2

  if (!vb || !vb.width || !vb.height) return

  // How much we'd need to scale the original viewBox to fit content at 70%
  const fillRatio = 0.7
  const scaleX = contentW > 0 ? (fillRatio * vb.width) / contentW : 1
  const scaleY = contentH > 0 ? (fillRatio * vb.height) / contentH : 1
  const scale = Math.min(scaleX, scaleY)

  // scale < 1 means we'd need to zoom out — skip
  if (scale < 1) return

  // New viewBox always matches display aspect ratio
  const vbW = vb.width / scale
  const vbH = vb.height / scale

  svg.style.transition = 'all 0.3s ease-out'
  svg.setAttribute('viewBox', `${cx - vbW / 2} ${cy - vbH / 2} ${vbW} ${vbH}`)
}

function restoreViewBox() {
  if (!savedViewBox || !containerElement) return
  const svg = containerElement.querySelector('svg')
  if (!svg) return
  svg.style.transition = 'all 0.3s ease-in-out'
  svg.setAttribute('viewBox', savedViewBox)
  savedViewBox = null
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
  clearCurrentHighlight()
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
  if (sheetId !== lastSheetId && renderSheets[sheetId]) {
    lastSheetId = sheetId
    svgContent = renderSheets[sheetId].svg
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
    stroke: var(--highlight-color, #f59e0b) !important;
    stroke-width: 3px !important;
    filter: drop-shadow(0 0 8px color-mix(in srgb, var(--highlight-color, #f59e0b) 60%, transparent));
  }

  .topology-container :global(.node-dimmed) {
    opacity: 0.15;
    transition: opacity 0.2s ease;
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
