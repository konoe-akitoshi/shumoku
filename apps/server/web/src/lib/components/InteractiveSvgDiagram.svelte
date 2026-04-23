<script lang="ts" module>
  // Event types for node selection (exported from module context)
  export interface NodeInfo {
    id: string
    label: string
    spec?: {
      type?: string
      vendor?: string
      model?: string
    }
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
  /**
   * Detail-page view of a topology. Composes the shared TopologyViewer
   * with the standard overlay set, plus detail-page chrome (breadcrumb,
   * zoom toolbar, legend, warnings).
   *
   * Kept as a named component (rather than inlined in the route) so
   * external imperative APIs (`panToNode`, `navigateToSheet`,
   * `getSvgElement`) used by the search palette and drill-down flows
   * continue to work without refactoring callers.
   */
  import { darkTheme, lightTheme, type NetworkGraph } from '@shumoku/core'
  import {
    ArrowLeftIcon,
    CornersOutIcon,
    GearSixIcon,
    MagnifyingGlassIcon,
    MagnifyingGlassMinusIcon,
    MagnifyingGlassPlusIcon,
  } from 'phosphor-svelte'
  import { onDestroy, onMount } from 'svelte'
  import { api } from '$lib/api'
  import {
    HighlightOverlay,
    type HoveredElement,
    NodeStatusOverlay,
    TooltipOverlay,
    TopologyViewer,
    WeathermapOverlay,
  } from '$lib/components/topology'
  import {
    liveUpdatesEnabled,
    metricsData,
    metricsStore,
    metricsWarnings,
    showNodeStatus,
    showTrafficFlow,
  } from '$lib/stores'
  import { resolvedTheme } from '$lib/stores/theme'
  import { formatTraffic } from '$lib/utils/format'
  import { getUtilizationColor } from '$lib/weathermap'

  // --- Props (Svelte 5 runes) ---
  interface Props {
    topologyId?: string
    readOnly?: boolean
    onToggleSettings?: () => void
    onSearchOpen?: () => void
    settingsOpen?: boolean
    onNodeSelect?: (event: NodeSelectEvent) => void
    onSubgraphSelect?: (event: SubgraphSelectEvent) => void
    /**
     * Override how the underlying NetworkGraph is fetched. Detail page
     * uses `topologyId` and the default fetcher. Share page passes a
     * token-scoped fetcher via this prop.
     */
    graphLoader?: () => Promise<{ graph: NetworkGraph }>
  }
  let {
    topologyId = '',
    readOnly = false,
    onToggleSettings,
    onSearchOpen,
    settingsOpen = false,
    onNodeSelect,
    onSubgraphSelect,
    graphLoader,
  }: Props = $props()

  // --- State ---
  let graph = $state<NetworkGraph | undefined>(undefined)
  let loading = $state(true)
  let error = $state('')

  // Drill-down navigation stack. `currentSheetId === null` means root.
  let currentSheetId = $state<string | null>(null)
  let navigationStack = $state<string[]>([])

  let viewer: ReturnType<typeof TopologyViewer> | undefined = $state()

  const currentTheme = $derived($resolvedTheme === 'dark' ? darkTheme : lightTheme)

  // --- Data loading ---

  async function loadGraph() {
    loading = true
    error = ''
    try {
      const loader = graphLoader ?? (() => api.topologies.getGraph(topologyId))
      const res = await loader()
      graph = res.graph
    } catch (e) {
      error = e instanceof Error ? e.message : 'Unknown error'
    } finally {
      loading = false
    }
  }

  const sheetsAvailable = $derived.by(() => {
    if (!graph?.subgraphs) return new Map<string, string>()
    const m = new Map<string, string>()
    for (const sg of graph.subgraphs) {
      if (!sg.parent) m.set(sg.id, sg.label ?? sg.id)
    }
    return m
  })

  const isHierarchical = $derived(sheetsAvailable.size > 0)

  const currentSheetLabel = $derived(
    currentSheetId ? (sheetsAvailable.get(currentSheetId) ?? currentSheetId) : 'Root',
  )

  // --- External imperative API (preserved from old implementation) ---

  export function getSvgElement(): SVGSVGElement | null {
    return viewer?.getSvgElement() ?? null
  }

  export function panToNode(nodeId: string): void {
    viewer?.panToNode(nodeId)
  }

  export function navigateToSheet(sheetId: string): void {
    if (!sheetsAvailable.has(sheetId)) return
    if (currentSheetId) navigationStack = [...navigationStack, currentSheetId]
    currentSheetId = sheetId
  }

  function navigateBack() {
    if (navigationStack.length === 0) {
      currentSheetId = null
      return
    }
    const prev = navigationStack[navigationStack.length - 1] ?? null
    navigationStack = navigationStack.slice(0, -1)
    currentSheetId = prev
  }

  // --- Selection handling ---

  function handleSelect(id: string | null, type: string | null) {
    if (!id || !type || !graph) return
    if (type === 'node') emitNodeSelect(id)
    else if (type === 'subgraph') emitSubgraphSelect(id)
  }

  function emitNodeSelect(nodeId: string) {
    if (!graph || !onNodeSelect) return
    const node = graph.nodes.find((n) => n.id === nodeId)
    if (!node) return
    const connectedLinks = graph.links
      .filter((l) => {
        const from = typeof l.from === 'string' ? l.from : l.from.node
        const to = typeof l.to === 'string' ? l.to : l.to.node
        return from === nodeId || to === nodeId
      })
      .map((l) => {
        const from = typeof l.from === 'string' ? l.from : l.from.node
        const to = typeof l.to === 'string' ? l.to : l.to.node
        return {
          id: l.id ?? `${from}->${to}`,
          from,
          to,
          bandwidth: l.bandwidth,
        }
      })
    const nodeLabel = Array.isArray(node.label) ? node.label.join(' ') : (node.label ?? node.id)
    onNodeSelect({
      node: {
        id: node.id,
        label: nodeLabel,
        spec: node.spec
          ? {
              type: 'type' in node.spec ? node.spec.type : undefined,
              vendor: 'vendor' in node.spec ? node.spec.vendor : undefined,
              model: 'model' in node.spec ? node.spec.model : undefined,
            }
          : undefined,
      },
      connectedLinks,
    })
  }

  function emitSubgraphSelect(sgId: string) {
    if (!graph || !onSubgraphSelect) return
    const sg = graph.subgraphs?.find((s) => s.id === sgId)
    if (!sg) return

    const memberNodes = graph.nodes.filter(
      (n) => n.parent === sgId || n.parent?.startsWith(`${sgId}/`),
    )
    const memberIds = new Set(memberNodes.map((n) => n.id))
    const linkCount = graph.links.filter((l) => {
      const from = typeof l.from === 'string' ? l.from : l.from.node
      const to = typeof l.to === 'string' ? l.to : l.to.node
      return memberIds.has(from) || memberIds.has(to)
    }).length

    onSubgraphSelect({
      subgraph: {
        id: sgId,
        label: sg.label ?? sgId,
        nodeCount: memberNodes.length,
        linkCount,
        canDrillDown: sheetsAvailable.has(sgId),
      },
    })
  }

  // --- Tooltip content: live metrics-aware for links ---

  function buildTooltip(hovered: HoveredElement, g: NetworkGraph): string {
    if (hovered.kind === 'node') {
      const n = g.nodes.find((x) => x.id === hovered.id)
      const label = Array.isArray(n?.label) ? n?.label.join(' / ') : n?.label
      return `<strong>${escapeHtml(label ?? hovered.id)}</strong>`
    }
    if (hovered.kind === 'subgraph') {
      const sg = g.subgraphs?.find((x) => x.id === hovered.id)
      return `<strong>${escapeHtml(sg?.label ?? hovered.id)}</strong>`
    }
    // Link: show endpoints + live metrics if available
    const link = g.links.find((x) => x.id === hovered.id)
    if (!link) return `<strong>${escapeHtml(hovered.id)}</strong>`
    const from = typeof link.from === 'string' ? link.from : link.from.node
    const to = typeof link.to === 'string' ? link.to : link.to.node
    let out = `<strong>${escapeHtml(from)} → ${escapeHtml(to)}</strong>`
    if (link.bandwidth)
      out += `<br><span class="muted">Bandwidth: ${escapeHtml(link.bandwidth)}</span>`

    const m = $metricsData?.links?.[hovered.id]
    if (m) {
      if (m.inBps !== undefined || m.outBps !== undefined) {
        out += `<br><span class="muted">In:</span> ${formatTraffic(m.inBps ?? 0)} <span class="muted">Out:</span> ${formatTraffic(m.outBps ?? 0)}`
      }
      if (m.inUtilization !== undefined || m.outUtilization !== undefined) {
        const inU = m.inUtilization ?? 0
        const outU = m.outUtilization ?? 0
        out += `<br><span style="color: ${getUtilizationColor(inU)}">In: ${inU.toFixed(1)}%</span> <span style="color: ${getUtilizationColor(outU)}">Out: ${outU.toFixed(1)}%</span>`
      } else if (m.utilization !== undefined) {
        out += `<br><span style="color: ${getUtilizationColor(m.utilization)}">Utilization: ${m.utilization.toFixed(1)}%</span>`
      }
      out += `<br><span class="muted">Status: ${escapeHtml(String(m.status))}</span>`
    }
    return out
  }

  function escapeHtml(s: string): string {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  }

  // --- Live metrics subscription ---

  onMount(async () => {
    await loadGraph()
    if (!readOnly && $liveUpdatesEnabled && topologyId) {
      metricsStore.connect()
      metricsStore.subscribeToTopology(topologyId)
    }
  })

  onDestroy(() => {
    if (!readOnly) metricsStore.unsubscribe()
  })

  // --- Keyboard shortcut for search palette ---

  function handleKeydown(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k' && onSearchOpen) {
      e.preventDefault()
      onSearchOpen()
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="diagram-container">
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
  {:else if graph}
    {#if isHierarchical && currentSheetId !== null}
      <div class="breadcrumb">
        <button class="breadcrumb-back" onclick={navigateBack} title="Go back">
          <ArrowLeftIcon size={14} />
        </button>
        <span class="breadcrumb-current">{currentSheetLabel}</span>
      </div>
    {/if}

    {#if $liveUpdatesEnabled && $metricsWarnings.length > 0}
      <div class="warnings-banner">
        {#each $metricsWarnings as warning}
          <span class="warning-text">{warning}</span>
        {/each}
      </div>
    {/if}

    <TopologyViewer
      bind:this={viewer}
      {graph}
      sheetId={currentSheetId}
      theme={currentTheme}
      mode="view"
      sheetCacheStrategy="eager"
      onselect={handleSelect}
    >
      {#snippet children({ svgElement, graph: activeGraph })}
        <WeathermapOverlay
          {svgElement}
          metrics={$metricsData?.links}
          enabled={$liveUpdatesEnabled && $showTrafficFlow}
        />
        <NodeStatusOverlay
          {svgElement}
          status={$metricsData?.nodes}
          enabled={$liveUpdatesEnabled && $showNodeStatus}
        />
        <HighlightOverlay {svgElement} />
        <TooltipOverlay {svgElement} graph={activeGraph} contentBuilder={buildTooltip} />
      {/snippet}
    </TopologyViewer>
  {/if}

  <!-- Zoom / utility controls -->
  <div class="controls">
    <div class="control-group">
      <button onclick={() => viewer?.zoomBy(1.5)} title="Zoom In">
        <MagnifyingGlassPlusIcon size={18} />
      </button>
      <button onclick={() => viewer?.zoomBy(1 / 1.5)} title="Zoom Out">
        <MagnifyingGlassMinusIcon size={18} />
      </button>
    </div>
    <div class="control-group">
      <button onclick={() => viewer?.resetZoom()} title="Fit to View">
        <CornersOutIcon size={18} />
      </button>
      {#if onSearchOpen}
        <button onclick={onSearchOpen} title="Search Nodes (Cmd/Ctrl+K)">
          <MagnifyingGlassIcon size={18} />
        </button>
      {/if}
      {#if onToggleSettings}
        <button onclick={onToggleSettings} title="Settings" class:active={settingsOpen}>
          <GearSixIcon size={18} />
        </button>
      {/if}
    </div>
  </div>

  <!-- Legend (only when traffic flow is on) -->
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
    background: var(--color-bg-canvas, #fafafa);
  }

  .loading,
  .error {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    color: var(--color-text-muted, #6b7280);
  }

  .error-icon {
    color: #dc2626;
    font-weight: bold;
    font-size: 20px;
  }

  .spinner {
    width: 32px;
    height: 32px;
    border: 3px solid var(--border, #e5e7eb);
    border-top-color: var(--primary, #3b82f6);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .breadcrumb {
    position: absolute;
    top: 16px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 12px;
    background: var(--color-bg-elevated, #ffffff);
    border: 1px solid var(--border, #e5e7eb);
    border-radius: 6px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
    z-index: 5;
    font-size: 13px;
  }

  .breadcrumb-back {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    background: transparent;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    color: var(--color-text-muted, #6b7280);
  }

  .breadcrumb-back:hover {
    background: var(--color-bg, #f3f4f6);
    color: var(--color-text, #111827);
  }

  .breadcrumb-current {
    font-weight: 500;
    color: var(--color-text, #111827);
  }

  .warnings-banner {
    position: absolute;
    top: 16px;
    left: 16px;
    right: 16px;
    padding: 8px 12px;
    background: #fffbeb;
    border: 1px solid #fde68a;
    border-radius: 6px;
    color: #92400e;
    font-size: 12px;
    z-index: 5;
  }

  .warning-text {
    display: block;
  }

  .controls {
    position: absolute;
    bottom: 16px;
    right: 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    z-index: 5;
  }

  .control-group {
    display: flex;
    flex-direction: column;
    background: var(--color-bg-elevated, #ffffff);
    border: 1px solid var(--border, #e5e7eb);
    border-radius: 6px;
    overflow: hidden;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  }

  .control-group button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    background: transparent;
    border: none;
    cursor: pointer;
    color: var(--color-text, #111827);
    transition: background 0.15s;
  }

  .control-group button:hover {
    background: var(--color-bg, #f3f4f6);
  }

  .control-group button.active {
    background: var(--primary, #3b82f6);
    color: white;
  }

  .legend {
    position: absolute;
    bottom: 16px;
    left: 16px;
    padding: 8px 12px;
    background: var(--color-bg-elevated, #ffffff);
    border: 1px solid var(--border, #e5e7eb);
    border-radius: 6px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
    z-index: 5;
  }

  .legend-title {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-text-muted, #6b7280);
    margin-bottom: 6px;
  }

  .legend-items {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
  }

  .legend-color {
    display: inline-block;
    width: 16px;
    height: 3px;
    border-radius: 2px;
  }
</style>
