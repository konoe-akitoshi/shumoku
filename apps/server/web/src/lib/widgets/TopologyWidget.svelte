<script lang="ts">
  import { darkTheme, lightTheme, type NetworkGraph } from '@shumoku/core'
  import { ArrowSquareOutIcon, SpinnerIcon, TreeStructureIcon } from 'phosphor-svelte'
  import { onDestroy, onMount } from 'svelte'
  import { api, isSharedView } from '$lib/api'
  import {
    HighlightOverlay,
    NodeStatusOverlay,
    TopologyViewer,
    WeathermapLinkOverlay,
  } from '$lib/components/topology'
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
  let showSelector = $state(false)

  let rootGraph = $state<NetworkGraph | null>(null)
  let isHierarchical = $state(false)
  let sheets: SheetInfo[] = $state([])

  // Highlight state driven by widget events (dashboard-wide
  // cross-widget triggers like "highlight these hosts").
  let highlightedIds = $state<ReadonlySet<string>>(new Set())
  let highlightColor = $state<string | undefined>(undefined)
  let spotlight = $state(false)
  let highlightTimeout: ReturnType<typeof setTimeout> | null = null
  let unsubscribeEvents: (() => void) | null = null
  let viewer = $state<TopologyViewer | null>(null)
  /** Camera transform snapshot for transient zooms (hover previews). */
  let savedTransform: { x: number; y: number; k: number } | null = null

  const currentTheme = $derived($resolvedTheme === 'dark' ? darkTheme : lightTheme)
  const editMode = $derived($dashboardEditMode)

  // The RESOLVED node→host mapping (metrics-binding attachments ∪ residual).
  // Fetched in authenticated mode; in a shared view `topology.mappingJson`
  // already carries the resolved mapping (server-side publicTopology projection).
  let derivedNodeMapping = $state<Record<string, { hostName?: string }> | null>(null)

  /**
   * Reverse lookup: monitoring host name → topology node id. Built from the
   * resolved mapping. Used to resolve cross-widget highlight events that arrive
   * with hostnames (e.g. from AlertWidget) into node ids that HighlightOverlay
   * can match against `data-id` in the SVG.
   */
  const hostToNodeId = $derived.by(() => {
    const map = new Map<string, string>()
    let nodes = derivedNodeMapping
    if (!nodes && topology?.mappingJson) {
      try {
        nodes =
          (JSON.parse(topology.mappingJson) as { nodes?: Record<string, { hostName?: string }> })
            .nodes ?? null
      } catch {
        // ignore malformed mappingJson
      }
    }
    for (const [nodeId, info] of Object.entries(nodes ?? {})) {
      if (info?.hostName) map.set(info.hostName, nodeId)
    }
    return map
  })

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
      // Authenticated: fetch the resolved mapping (node bindings live as
      // attachments). Shared view relies on topology.mappingJson (already
      // resolved server-side); getMapping isn't reachable there.
      if (!isSharedView()) {
        try {
          derivedNodeMapping = (await api.topologies.getMapping(config.topologyId)).nodes ?? {}
        } catch {
          derivedNodeMapping = null
        }
      }
      const { graph } = await api.topologies.getGraph(config.topologyId)
      if (!graph) {
        // Server is still baking the first layout for this topology.
        error = 'Topology is being prepared — try again shortly'
        return
      }
      rootGraph = graph

      const topLevel = (graph.subgraphs ?? []).filter((sg) => !sg.parent)
      isHierarchical = topLevel.length > 0
      sheets = isHierarchical
        ? [
            { id: 'root', name: topology?.name ?? graph.name ?? 'Root' },
            ...topLevel.map((sg) => ({ id: sg.id, name: sg.label ?? sg.id })),
          ]
        : []
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load topology'
    } finally {
      loading = false
    }
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
  }

  function handleWidgetEvent(event: WidgetEvent) {
    if (event.payload.topologyId !== config.topologyId) return

    switch (event.type) {
      case 'highlight-node':
      case 'select-node':
      case 'zoom-to-node': {
        // Resolve nodeId from either explicit nodeId or a host via mapping.
        const nodeId =
          event.payload.nodeId ??
          (event.payload.host ? hostToNodeId.get(event.payload.host) : undefined)
        if (!nodeId) break
        applyHighlight(new Set([nodeId]), event.payload.duration ?? 3000)
        if (event.type === 'zoom-to-node') {
          if (event.payload.transient) {
            // Snapshot only the first transient pan in a sequence so a chain
            // of hovers restores to the pre-hover view, not the previous
            // hover's target.
            if (savedTransform === null) {
              savedTransform = viewer?.getCameraTransform() ?? null
            }
          } else {
            // Non-transient (committed) zoom — discard the snapshot so a
            // later restore-camera doesn't unwind past this point.
            savedTransform = null
          }
          viewer?.panToNode(nodeId)
        }
        break
      }
      case 'restore-camera': {
        if (savedTransform) {
          viewer?.setCameraTransform(savedTransform)
          savedTransform = null
        }
        break
      }
      case 'highlight-nodes': {
        const resolved = new Set<string>(event.payload.nodeIds ?? [])
        for (const host of event.payload.hosts ?? []) {
          const nodeId = hostToNodeId.get(host)
          if (nodeId) resolved.add(nodeId)
        }
        if (resolved.size === 0) break
        highlightColor = event.payload.highlightColor
        spotlight = event.payload.spotlight ?? false
        applyHighlight(resolved, event.payload.duration)
        break
      }
      case 'clear-highlight':
        clearHighlight()
        break
    }
  }

  function applyHighlight(ids: Set<string>, duration?: number) {
    if (highlightTimeout) clearTimeout(highlightTimeout)
    highlightedIds = ids
    if (duration) {
      highlightTimeout = setTimeout(() => {
        highlightedIds = new Set()
        spotlight = false
        highlightColor = undefined
      }, duration)
    }
  }

  function clearHighlight() {
    if (highlightTimeout) {
      clearTimeout(highlightTimeout)
      highlightTimeout = null
    }
    highlightedIds = new Set()
    spotlight = false
    highlightColor = undefined
  }

  $effect(() => {
    if ($liveUpdatesEnabled && config.topologyId && !loading) {
      metricsStore.connect()
      metricsStore.subscribeToTopology(config.topologyId)
    }
  })

  $effect(() => {
    if (config.topologyId && config.topologyId !== lastTopologyId) {
      lastTopologyId = config.topologyId
      loadTopology()
    }
  })

  onMount(() => {
    // The topology list only feeds the editor's picker; a shared view can't
    // read it (401) and doesn't need it.
    if (!isSharedView()) loadTopologies()
    loadTopology()
    unsubscribeEvents = widgetEvents.on(handleWidgetEvent)
  })

  onDestroy(() => {
    if (unsubscribeEvents) unsubscribeEvents()
    clearHighlight()
    metricsStore.unsubscribe()
  })

  function handleSettings() {
    showSelector = !showSelector
  }

  const currentSheetName = $derived(
    sheets.find((s) => s.id === (config.sheetId || 'root'))?.name || 'root',
  )

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
    {:else if rootGraph}
      <div class="h-full w-full relative group">
        <TopologyViewer
          bind:this={viewer}
          graph={rootGraph}
          sheetId={config.sheetId || 'root'}
          theme={currentTheme}
          mode="view"
          interaction={{
            contextMenu: false,
            keyboard: false,
            dragEdit: false,
          }}
          detail={{
            portLabels: 'auto',
            linkLabels: 'auto',
            nodeShadow: false,
          }}
        >
          {#snippet linkOverlay(edge, context)}
            <WeathermapLinkOverlay
              {context}
              metrics={$metricsData?.links?.[edge.id]}
              enabled={$liveUpdatesEnabled && $showTrafficFlow}
            />
          {/snippet}
          {#snippet children({ svgElement })}
            <NodeStatusOverlay
              {svgElement}
              status={$metricsData?.nodes}
              enabled={$liveUpdatesEnabled && $showNodeStatus}
            />
            <HighlightOverlay
              {svgElement}
              {highlightedIds}
              {highlightColor}
              dimOthers={spotlight}
              pulseAnimation={false}
            />
          {/snippet}
        </TopologyViewer>

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
