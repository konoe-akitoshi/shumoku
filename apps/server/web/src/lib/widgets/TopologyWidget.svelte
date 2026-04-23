<script lang="ts">
  import {
    buildChildSheetGraph,
    computeNetworkLayout,
    darkTheme,
    lightTheme,
    type NetworkGraph,
    type ResolvedLayout,
  } from '@shumoku/core'
  import { ShumokuRenderer } from '@shumoku/renderer'
  import { ArrowSquareOutIcon, SpinnerIcon, TreeStructureIcon } from 'phosphor-svelte'
  import { onDestroy, onMount } from 'svelte'
  import { api } from '$lib/api'
  import {
    clearHighlight as clearHighlightUtil,
    highlightByAttribute,
    highlightNodes,
  } from '$lib/highlight'
  import {
    liveUpdatesEnabled,
    metricsData,
    metricsStore,
    showNodeStatus,
    showTrafficFlow,
  } from '$lib/stores'
  import { dashboardEditMode, dashboardStore } from '$lib/stores/dashboards'
  import { resolvedTheme } from '$lib/stores/theme'
  import { type WidgetEvent, widgetEvents } from '$lib/stores/widgetEvents'
  import type { Topology } from '$lib/types'
  import { WeathermapController } from '$lib/weathermap'
  import WidgetWrapper from './WidgetWrapper.svelte'

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
  let loading = $state(true)
  let error = $state('')
  let lastTopologyId = $state('')
  let lastSheetId = $state('')
  let showSelector = $state(false)

  // Graph + client-side layouts (one per sheet, cached)
  let rootGraph = $state<NetworkGraph | null>(null)
  let layoutsBySheet = $state<Record<string, ResolvedLayout>>({})
  let activeLayout = $state<ResolvedLayout | null>(null)

  // Hierarchical topology support
  let isHierarchical = $state(false)
  let sheets: SheetInfo[] = $state([])

  // Highlight support for widget events
  let highlightTimeout: ReturnType<typeof setTimeout> | null = null
  let containerElement = $state<HTMLDivElement | null>(null)
  let unsubscribeEvents: (() => void) | null = null
  let savedViewBox: string | null = null

  // Renderer instance / rendered SVG root
  let svgElement = $state<SVGSVGElement | null>(null)

  // Live metrics — weathermap overlay
  let weathermap: WeathermapController | null = null

  const currentTheme = $derived($resolvedTheme === 'dark' ? darkTheme : lightTheme)

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
      const { graph } = await api.topologies.getGraph(config.topologyId)

      // Reset weathermap — the previous SVG is gone.
      weathermap?.destroy()
      weathermap = null
      layoutsBySheet = {}

      rootGraph = graph
      const topLevelSubgraphs = (graph.subgraphs ?? []).filter((sg) => !sg.parent)
      isHierarchical = topLevelSubgraphs.length > 0
      sheets = isHierarchical
        ? [
            { id: 'root', name: topology?.name ?? graph.name ?? 'Root' },
            ...topLevelSubgraphs.map((sg) => ({ id: sg.id, name: sg.label ?? sg.id })),
          ]
        : []

      await ensureSheetLayout(config.sheetId || 'root')
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load topology'
    } finally {
      loading = false
    }
  }

  /**
   * Compute (and cache) the resolved layout for the requested sheet.
   * Editor-style pattern: sheet 'root' renders the full graph, any
   * other id drills into `buildChildSheetGraph(root, id)`.
   */
  async function ensureSheetLayout(sheetId: string): Promise<void> {
    if (!rootGraph) return
    const cached = layoutsBySheet[sheetId]
    if (cached) {
      activeLayout = cached
      return
    }
    const targetGraph =
      sheetId === 'root' ? rootGraph : (buildChildSheetGraph(rootGraph, sheetId) ?? rootGraph)
    const { resolved } = await computeNetworkLayout(targetGraph)
    layoutsBySheet = { ...layoutsBySheet, [sheetId]: resolved }
    activeLayout = resolved
  }

  function selectTopology(topologyId: string) {
    if (!topologyId) return
    dashboardStore.updateWidgetConfig(id, { topologyId, sheetId: 'root' })
    config = { ...config, topologyId, sheetId: 'root' }
    showSelector = false
  }

  function selectSheet(sheetId: string) {
    if (!sheetId) return
    dashboardStore.updateWidgetConfig(id, { sheetId })
    config = { ...config, sheetId }
    weathermap?.reset()
    void ensureSheetLayout(sheetId)
  }

  function handleWidgetEvent(event: WidgetEvent) {
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
    if (!svgElement) return
    const nodeElement = svgElement.querySelector(`.node[data-id="${nodeId}"]`) as SVGGElement | null
    if (!nodeElement) return
    const bbox = nodeElement.getBBox?.()
    if (!bbox) return
    const viewBox = svgElement.viewBox.baseVal
    if (!viewBox) return

    const nodeCenterX = bbox.x + bbox.width / 2
    const nodeCenterY = bbox.y + bbox.height / 2
    const padding = 100
    const newWidth = Math.max(bbox.width + padding * 2, viewBox.width / 2)
    const newHeight = Math.max(bbox.height + padding * 2, viewBox.height / 2)
    const newViewBox = `${nodeCenterX - newWidth / 2} ${nodeCenterY - newHeight / 2} ${newWidth} ${newHeight}`

    svgElement.style.transition = 'all 0.3s ease-out'
    svgElement.setAttribute('viewBox', newViewBox)

    setTimeout(() => {
      if (!svgElement) return
      svgElement.style.transition = 'all 0.5s ease-in-out'
      svgElement.setAttribute(
        'viewBox',
        `${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`,
      )
    }, 2000)
  }

  /** Zoom to fit highlighted nodes at ~70% of viewport. */
  function zoomToFitHighlighted() {
    if (!svgElement || !containerElement) return
    const svg = svgElement
    const highlighted = containerElement.querySelectorAll(
      '.node-highlighted',
    ) as NodeListOf<SVGGElement>
    if (highlighted.length === 0) return

    const vb = svg.viewBox.baseVal
    if (!savedViewBox && vb) {
      savedViewBox = `${vb.x} ${vb.y} ${vb.width} ${vb.height}`
    }

    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const el of highlighted) {
      const bbox = el.getBBox?.()
      if (!bbox) continue
      minX = Math.min(minX, bbox.x)
      minY = Math.min(minY, bbox.y)
      maxX = Math.max(maxX, bbox.x + bbox.width)
      maxY = Math.max(maxY, bbox.y + bbox.height)
    }
    if (!Number.isFinite(minX)) return

    const contentW = maxX - minX
    const contentH = maxY - minY
    const cx = (minX + maxX) / 2
    const cy = (minY + maxY) / 2

    if (!vb?.width || !vb.height) return

    const fillRatio = 0.7
    const scaleX = contentW > 0 ? (fillRatio * vb.width) / contentW : 1
    const scaleY = contentH > 0 ? (fillRatio * vb.height) / contentH : 1
    const scale = Math.min(scaleX, scaleY)
    if (scale < 1) return

    const vbW = vb.width / scale
    const vbH = vb.height / scale

    svg.style.transition = 'all 0.3s ease-out'
    svg.setAttribute('viewBox', `${cx - vbW / 2} ${cy - vbH / 2} ${vbW} ${vbH}`)
  }

  function restoreViewBox() {
    if (!savedViewBox || !svgElement) return
    svgElement.style.transition = 'all 0.3s ease-in-out'
    svgElement.setAttribute('viewBox', savedViewBox)
    savedViewBox = null
  }

  // Connect to live metrics when topology is ready
  $effect(() => {
    if ($liveUpdatesEnabled && config.topologyId && !loading) {
      metricsStore.connect()
      metricsStore.subscribeToTopology(config.topologyId)
    }
  })

  // Apply live metrics (weathermap flow overlay + node status classes)
  $effect(() => {
    const metrics = $metricsData
    const live = $liveUpdatesEnabled
    const flow = $showTrafficFlow
    const status = $showNodeStatus
    const svg = svgElement
    if (!svg || !live) return

    if (flow && metrics?.links) {
      if (!weathermap) weathermap = new WeathermapController(svg)
      weathermap.apply(metrics.links)
    } else {
      weathermap?.reset()
    }

    if (status && metrics?.nodes) {
      for (const [nodeId, nodeMetrics] of Object.entries(metrics.nodes)) {
        const nodeGroup = svg.querySelector(`g.node[data-id="${nodeId}"]`)
        if (!nodeGroup) continue
        nodeGroup.classList.remove('status-up', 'status-down', 'status-unknown')
        nodeGroup.classList.add(`status-${nodeMetrics.status}`)
      }
    } else {
      for (const node of svg.querySelectorAll('g.node')) {
        node.classList.remove('status-up', 'status-down', 'status-unknown')
      }
    }
  })

  onMount(() => {
    loadTopologies()
    loadTopology()
    unsubscribeEvents = widgetEvents.on(handleWidgetEvent)
  })

  onDestroy(() => {
    if (unsubscribeEvents) unsubscribeEvents()
    clearCurrentHighlight()
    weathermap?.destroy()
    weathermap = null
    metricsStore.unsubscribe()
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
    if (sheetId !== lastSheetId && rootGraph) {
      lastSheetId = sheetId
      void ensureSheetLayout(sheetId)
    }
  })

  function handleSettings() {
    showSelector = !showSelector
  }

  let currentSheetName = $derived(
    sheets.find((s) => s.id === (config.sheetId || 'root'))?.name || 'root',
  )

  let editMode = $derived($dashboardEditMode)

  const componentId = $props.id()
  const selectorId = `${componentId}:selector`
  const hierarchicalSelectorId = `${componentId}:hierarchicalSelector`
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

        <label for={selectorId} class="text-xs text-theme-text-muted mb-1">Topology</label>
        <select
          id={selectorId}
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
          <label for={hierarchicalSelectorId} class="text-xs text-theme-text-muted mb-1">
            Sheet (Hierarchy Level)
          </label>
          <select
            id={hierarchicalSelectorId}
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
            class="w-full px-3 py-1.5 bg-primary text-primary-foreground rounded text-sm hover:bg-primary-dark transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    {:else if !config.topologyId}
      <!-- No topology selected -->
      <div class="h-full flex flex-col items-center justify-center text-theme-text-muted gap-3">
        <TreeStructureIcon size={32} />
        <span class="text-sm">No topology selected</span>
        <button
          onclick={() => showSelector = true}
          class="px-3 py-1.5 bg-primary text-primary-foreground rounded text-sm hover:bg-primary-dark transition-colors"
        >
          Configure
        </button>
      </div>
    {:else if loading}
      <div class="h-full flex items-center justify-center">
        <SpinnerIcon size={24} class="animate-spin text-theme-text-muted" />
      </div>
    {:else if error}
      <div class="h-full flex flex-col items-center justify-center text-danger gap-2">
        <span class="text-sm">{error}</span>
        <button onclick={loadTopology} class="text-xs text-primary hover:underline">Retry</button>
      </div>
    {:else if activeLayout}
      <div
        class="h-full w-full overflow-hidden topology-container relative group"
        bind:this={containerElement}
      >
        <ShumokuRenderer layout={activeLayout} theme={currentTheme} mode="view" bind:svgElement />
        {#if !editMode && config.topologyId}
          <a
            href="/topologies/{config.topologyId}"
            class="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-theme-bg-elevated border border-theme-border rounded-lg px-3 py-1.5 flex items-center gap-1.5 text-xs text-theme-text hover:bg-theme-bg-canvas hover:border-primary/50 shadow-sm no-underline"
          >
            <ArrowSquareOutIcon size={14} />
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
    filter: drop-shadow(
      0 0 8px color-mix(in srgb, var(--highlight-color, #f59e0b) 60%, transparent)
    );
  }

  .topology-container :global(.node-dimmed) {
    opacity: 0.15;
    transition: opacity 0.2s ease;
  }

  /* Node status indicators */
  .topology-container :global(g.node.status-up .node-bg rect) {
    stroke: #22c55e;
    stroke-width: 2px;
  }

  .topology-container :global(g.node.status-down .node-bg rect) {
    stroke: #ef4444;
    stroke-width: 2px;
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
