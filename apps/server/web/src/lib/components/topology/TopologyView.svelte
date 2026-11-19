<script lang="ts" module>
  import type { NodePort } from '@shumoku/core'
  // Event types for node selection (exported from module context)
  export interface NodeInfo {
    ports?: NodePort[]
    metadata?: Record<string, unknown>
    id: string
    label: string
    spec?: {
      type?: string
      vendor?: string
      model?: string
    }
    /** Observation-model provenance / state, stamped by the server's
     *  resolver. Optional — undefined for graphs that pre-date the model. */
    provenance?: {
      source: string
      state?: 'confirmed' | 'intrinsic-only' | 'discovered-only' | 'conflicting'
      observedAt?: number
    }
    /** Identity keys used by the resolver to match this node across
     *  sources / re-scans. */
    identity?: {
      mgmtIp?: string
      chassisId?: string
      sysName?: string
      ifIndex?: number
      ifName?: string
      mac?: string
      vendorIds?: Record<string, string>
    }
  }

  export interface ConnectedLinkEndpoint {
    /** Node id (used to match against metrics / mapping data). */
    id: string
    /** Human-readable node label (falls back to id when no label is set). */
    label: string
  }

  export interface NodeSelectEvent {
    node: NodeInfo
    connectedLinks: Array<{
      id: string
      from: ConnectedLinkEndpoint
      to: ConnectedLinkEndpoint
      standard?: string
    }>
  }

  export interface SubgraphInfo {
    id: string
    label: string
    nodeCount: number
    linkCount: number
  }

  export interface SubgraphSelectEvent {
    subgraph: SubgraphInfo
  }
</script>

<script lang="ts">
  /**
   * A topology, as every page shows one: the detail page, the share page and a dashboard widget.
   * Loads the drawing the Server baked (polling while it is baked again), draws it with the
   * standard overlays (live traffic, node status, marks, tooltips) and the camera buttons.
   *
   * `compact` is the dashboard widget's form: the camera buttons appear on hover, and the legend
   * and the warnings banner give the room to the drawing. A host passes `marks` to highlight
   * nodes and adds its own buttons with `controls`.
   */
  import { darkTheme, diagramTitle, lightTheme, type NetworkGraph, type Node } from '@shumoku/core'
  import {
    type CameraOptions,
    connectSpaceMouse,
    onSpaceMouseChange,
    type Scene,
    spaceMouseConnected,
    spaceMouseOffer,
  } from '@shumoku/renderer'
  import { GearSixIcon, JoystickIcon, MagnifyingGlassIcon } from 'phosphor-svelte'
  import { onDestroy, type Snippet } from 'svelte'
  import { api } from '$lib/api'
  import {
    type LiveSource,
    linkMapping,
    liveSourceOf,
    nodeMapping,
    preferences,
    watchTopologyLive,
  } from '$lib/stores'
  import { identityOf, type ResolvedRecordView } from '$lib/types'
  import { formatTraffic } from '$lib/utils/format'
  import { nodeLabel, nodeLabelById } from '$lib/utils/node-label'
  import {
    IDLE_LINK_METRICS,
    isLinkInstrumented,
    UTILIZATION_STEPS,
    utilizationColor,
  } from '$lib/weathermap'
  import HighlightOverlay from './HighlightOverlay.svelte'
  import NodeStatusOverlay from './NodeStatusOverlay.svelte'
  import TooltipOverlay, { type HoveredElement } from './TooltipOverlay.svelte'
  import TopologyViewer from './TopologyViewer.svelte'
  import ViewerControls from './ViewerControls.svelte'
  import WeathermapLinkOverlay from './WeathermapLinkOverlay.svelte'

  // --- Props (Svelte 5 runes) ---
  interface Props {
    topologyId?: string
    onToggleSettings?: () => void
    onSearchOpen?: () => void
    settingsOpen?: boolean
    onNodeSelect?: (event: NodeSelectEvent) => void
    onSubgraphSelect?: (event: SubgraphSelectEvent) => void
    /**
     * Override how the underlying NetworkGraph is fetched. Detail page
     * uses `topologyId` and the default fetcher. Share page passes a
     * token-scoped fetcher via this prop. The response may instead signal
     * `deriving` (server is still baking the first layout) or carry
     * `stale: true` (last-good diagram served while a re-bake runs) — both
     * make this component poll until the fresh bake lands.
     */
    graphLoader?: () => Promise<{
      graph?: NetworkGraph
      record?: ResolvedRecordView
      /** The drawing the Server baked; the diagram shows only this. */
      scene?: Scene
      stale?: boolean
      deriving?: boolean
    }>
    /**
     * Where the live metrics come from. Absent, the topology's own feed (`topologyId`); the
     * share page names its token-scoped stream; `null` shows the drawing without them.
     */
    liveSource?: LiveSource | null
    /** The dashboard widget's form: camera buttons on hover, no legend or warnings banner. */
    compact?: boolean
    /** Who a plain wheel belongs to (`TopologyViewer`): `cooperative` inside a scrolling page. */
    wheel?: 'preference' | 'cooperative'
    /** Nodes to highlight: node id → colour (`undefined`: the default highlight colour). */
    marks?: ReadonlyMap<string, string | undefined>
    /** Dim what `marks` leaves out. */
    dimOthers?: boolean
    /** Marked nodes that are new: they beat with a glow. */
    fresh?: ReadonlySet<string>
    /** The host's own buttons, added below the camera buttons. */
    controls?: Snippet
    /** Called whenever a drawing has been shown (first load, and each one drawn again). */
    onloaded?: (graph: NetworkGraph) => void
  }
  let {
    topologyId = '',
    onToggleSettings,
    onSearchOpen,
    settingsOpen = false,
    onNodeSelect,
    onSubgraphSelect,
    graphLoader,
    liveSource,
    compact = false,
    wheel = 'preference',
    marks,
    dimOthers = false,
    fresh,
    controls,
    onloaded,
  }: Props = $props()

  // --- State ---
  let graph = $state<NetworkGraph | undefined>(undefined)
  // What the Server knows of each element beyond the drawn graph, by served id.
  let record = $state<ResolvedRecordView | undefined>(undefined)
  // The drawing the Server baked. The browser never lays a network out: a large layout on the
  // main thread froze the tab for minutes, and one drawn from the graph loses the chosen order.
  let serverScene = $state<Scene | undefined>(undefined)
  let loading = $state(true)
  let error = $state('')
  // Server is baking the layout in the background (large topology). While a
  // previous diagram exists we keep showing it; otherwise the loading state
  // says what's happening instead of a bare spinner.
  let building = $state(false)

  let viewer: ReturnType<typeof TopologyViewer> | undefined = $state()
  // A SpaceMouse (WebHID) is picked once from a click; afterwards it reconnects by itself. Known
  // only in the browser, so the button appears after hydration. Over plain HTTP the button stays,
  // and says that HTTPS is needed.
  let spaceMouseOffered = $state<'ok' | 'insecure' | 'none'>('none')
  let spaceMouseOn = $state(false)
  $effect(() => {
    spaceMouseOffered = spaceMouseOffer()
    spaceMouseOn = spaceMouseConnected()
    return onSpaceMouseChange(() => {
      spaceMouseOn = spaceMouseConnected()
    })
  })
  async function handleConnectSpaceMouse() {
    const problem = await connectSpaceMouse()
    if (problem) alert(problem)
  }

  /** The full-page view: a plain left drag pans, as on a map (a click still selects). */
  const cameraOptions: CameraOptions = { leftDrag: 'pan' }

  const currentTheme = $derived(preferences.resolvedTheme === 'dark' ? darkTheme : lightTheme)

  // --- Live metrics: the topology's feed, which also says when it was drawn again ---

  const live = watchTopologyLive(
    () => {
      if (!preferences.liveUpdates) return null
      if (liveSource !== undefined) return liveSource
      return topologyId ? liveSourceOf(topologyId) : null
    },
    () => void loadGraph(),
  )

  // --- Freshness: a screen nobody watches must say when what it shows has stopped updating ---

  /** Live values older than this are stale (the Server polls far more often). */
  const LIVE_STALE_MS = 3 * 60_000
  /** A lost connection is said once it has lasted this long (a reconnect is quicker). */
  const DISCONNECT_GRACE_MS = 15_000
  let clock = $state(Date.now())
  let disconnectedSince = $state<number | null>(null)
  $effect(() => {
    const timer = setInterval(() => {
      clock = Date.now()
    }, 5_000)
    return () => clearInterval(timer)
  })
  $effect(() => {
    // Only a feed that had data can go quiet; a topology with no metrics source never has any.
    if (!preferences.liveUpdates || !live.metrics || live.connected) disconnectedSince = null
    else disconnectedSince ??= Date.now()
  })
  /** When the live values stopped, or null while they are current. */
  const liveStoppedAt = $derived.by(() => {
    if (!preferences.liveUpdates || !live.metrics) return null
    if (disconnectedSince !== null && clock - disconnectedSince > DISCONNECT_GRACE_MS) {
      return Math.min(disconnectedSince, live.metrics.timestamp ?? disconnectedSince)
    }
    const at = live.metrics.timestamp
    return at && clock - at > LIVE_STALE_MS ? at : null
  })

  // --- Data loading ---

  // Poll timer for server-side bakes: short interval while the first layout
  // is being built (no diagram yet), longer while a stale diagram is shown.
  let refreshTimer: ReturnType<typeof setTimeout> | undefined
  function scheduleRefresh(ms: number) {
    clearTimeout(refreshTimer)
    refreshTimer = setTimeout(() => void loadGraph(), ms)
  }
  onDestroy(() => clearTimeout(refreshTimer))

  // Non-reactive mirror of "a graph has been shown at least once". loadGraph
  // is invoked from a $effect; reading the `graph` $state there would register
  // it as a dependency, and since loadGraph also WRITES `graph`, that loops
  // forever (refetch → new graph → effect refires → refetch …).
  let hasGraph = false

  async function loadGraph() {
    // Keep the current diagram visible during a stale-refresh poll — only
    // show the loading state when there is nothing on screen yet.
    loading = !hasGraph
    error = ''
    try {
      const loader = graphLoader ?? (() => api.topologies.getView(topologyId))
      const res = await loader()
      if (res.deriving) {
        building = true
        loading = !hasGraph
        scheduleRefresh(3000)
        return
      }
      if (res.graph && res.scene) {
        graph = res.graph
        record = res.record
        serverScene = res.scene
        hasGraph = true
        onloaded?.(res.graph)
      }
      building = res.stale === true
      if (res.stale) scheduleRefresh(5000)
      loading = false
    } catch (e) {
      error = e instanceof Error ? e.message : 'Unknown error'
      loading = false
    }
  }

  // --- External imperative API (preserved from old implementation) ---

  export function getSvgElement(): SVGSVGElement | null {
    return viewer?.getSvgElement() ?? null
  }

  export function getGraph(): NetworkGraph | undefined {
    return graph
  }

  export async function refreshGraph(): Promise<void> {
    await loadGraph()
  }

  export function panToNode(nodeId: string): void {
    viewer?.panToNode(nodeId)
  }

  /** The whole drawing back in view, followed again as the drawing and the box change. */
  export function fit(): void {
    viewer?.resetZoom()
  }

  export function getCameraTransform(): { x: number; y: number; k: number } | null {
    return viewer?.getCameraTransform() ?? null
  }

  export function setCameraTransform(t: { x: number; y: number; k: number }): void {
    viewer?.setCameraTransform(t)
  }

  /** Fly smoothly to these nodes (shown whole, with room around), or back to the fit. */
  export function flyTo(
    target: readonly string[] | 'fit',
    options?: { padding?: number; maxScale?: number },
  ): boolean {
    return viewer?.flyTo(target, options) ?? false
  }

  /**
   * Listen for a person moving the view (not the host's calls). Returns the unsubscribe. Works
   * before the drawing has loaded: the listener is kept here and joined to the viewer once it is.
   */
  export function onUserMove(listener: () => void): () => void {
    userMoveListeners.add(listener)
    return () => {
      userMoveListeners.delete(listener)
    }
  }
  const userMoveListeners = new Set<() => void>()
  $effect(() => {
    const current = viewer
    if (!current) return
    return current.onUserMove(() => {
      for (const listener of userMoveListeners) listener()
    })
  })

  /** Whether the pointer is over the diagram. */
  export function isPointerOver(): boolean {
    return viewer?.isPointerOver() ?? false
  }

  // Sheets removed in the engine swap; revisit as a view.

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
    const nodes = graph.nodes
    const connectedLinks = graph.links
      .filter((l) => {
        const from = typeof l.from === 'string' ? l.from : l.from.node
        const to = typeof l.to === 'string' ? l.to : l.to.node
        return from === nodeId || to === nodeId
      })
      .map((l) => {
        const fromId = l.from.node
        const toId = l.to.node
        return {
          id: l.id ?? `${fromId}->${toId}`,
          from: { id: fromId, label: nodeLabelById(nodes, fromId) },
          to: { id: toId, label: nodeLabelById(nodes, toId) },
          standard: l.from.plug?.module?.standard ?? l.to.plug?.module?.standard,
        }
      })
    onNodeSelect({
      node: {
        id: node.id,
        label: nodeLabel(node),
        spec: node.spec
          ? {
              type: 'type' in node.spec ? node.spec.type : undefined,
              vendor: 'vendor' in node.spec ? node.spec.vendor : undefined,
              model: 'model' in node.spec ? node.spec.model : undefined,
            }
          : undefined,
        provenance: record?.nodes[node.id]?.provenance,
        identity: identityOf(record?.nodes[node.id]),
        ports: node.ports,
        metadata: record?.nodes[node.id]?.metadata,
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
      },
    })
  }

  // --- Metrics-layer membership (mapping) vs live values (metrics) ---
  // An overlay is shown when the element BELONGS to the metrics layer (is mapped);
  // live values only decide its appearance. Membership and values are two inputs,
  // composed here so the overlays stay pure renderers. A mapped node the live feed
  // omits gets a neutral 'unknown' marker (present, but no value yet). Where the
  // mapping store isn't hydrated (widgets, shared views) `$nodeMapping` is empty,
  // so this collapses to exactly the previous values-only behaviour.
  const nodeStatusView = $derived.by(() => {
    const liveNodes = live.metrics?.nodes
    const mapped = $nodeMapping
    if (!mapped || Object.keys(mapped).length === 0) return liveNodes
    const out: Record<string, { status: string; monitoring?: string }> = { ...(liveNodes ?? {}) }
    for (const [nodeId, m] of Object.entries(mapped)) {
      if (m?.hostId && !out[nodeId]) out[nodeId] = { status: 'unknown' }
    }
    return out
  })

  // --- Tooltip content: live metrics-aware for links ---

  function annotationDetails(item: Pick<Node, 'annotations'>): string {
    const text = diagramTitle({ annotations: item.annotations })
    return text
      ? `<div style="white-space: pre-line; overflow-wrap: anywhere">${escapeHtml(text)}</div>`
      : ''
  }

  function buildTooltip(hovered: HoveredElement, g: NetworkGraph): string {
    if (hovered.kind === 'node') {
      const node = g.nodes.find((n) => n.id === hovered.id)
      return `<strong>${escapeHtml(nodeLabelById(g.nodes, hovered.id))}</strong>${node ? annotationDetails(node) : ''}`
    }
    if (hovered.kind === 'subgraph') {
      const sg = g.subgraphs?.find((x) => x.id === hovered.id)
      return `<strong>${escapeHtml(sg?.label ?? hovered.id)}</strong>`
    }
    // Link: show endpoints + live metrics if available
    const link = g.links.find((x) => x.id === hovered.id)
    if (!link) return `<strong>${escapeHtml(hovered.id)}</strong>`
    const from = nodeLabelById(g.nodes, link.from.node)
    const to = nodeLabelById(g.nodes, link.to.node)
    let out = `<strong>${escapeHtml(from)} → ${escapeHtml(to)}</strong>`
    const std = link.from.plug?.module?.standard ?? link.to.plug?.module?.standard
    if (std) out += `<br><span class="muted">Standard: ${escapeHtml(String(std))}</span>`

    out += annotationDetails(link)
    const m = live.metrics?.links?.[hovered.id]
    if (m) {
      if (m.inBps !== undefined || m.outBps !== undefined) {
        out += `<br><span class="muted">In:</span> ${formatTraffic(m.inBps ?? 0)} <span class="muted">Out:</span> ${formatTraffic(m.outBps ?? 0)}`
      }
      if (m.inUtilization !== undefined || m.outUtilization !== undefined) {
        const inU = m.inUtilization ?? 0
        const outU = m.outUtilization ?? 0
        out += `<br>${swatch(inU)}In: ${inU.toFixed(1)}% ${swatch(outU)}Out: ${outU.toFixed(1)}%`
      } else if (m.utilization !== undefined) {
        out += `<br>${swatch(m.utilization)}Utilization: ${m.utilization.toFixed(1)}%`
      }
      out += `<br><span class="muted">Status: ${escapeHtml(String(m.status))}</span>`
    }
    return out
  }

  /** A dot in a utilization's colour beside its figure; the figure stays in the text colour. */
  function swatch(utilization: number): string {
    return `<span style="display:inline-block;width:8px;height:8px;margin-right:4px;border-radius:50%;background:${utilizationColor(utilization)}"></span>`
  }

  function escapeHtml(s: string): string {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  }

  // --- Data loading: re-fetch when topologyId changes (component reused on
  // same-route navigation) ---

  $effect(() => {
    // Track topologyId so the effect re-runs when the route id changes.
    topologyId
    hasGraph = false
    loadGraph()
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

<div class="diagram-container topology-view">
  {#if loading}
    <div class="loading">
      <div class="spinner"></div>
      <span>{building ? 'Computing layout… (large topology)' : 'Loading topology...'}</span>
    </div>
  {:else if error}
    <div class="error">
      <span class="error-icon">!</span>
      <span>{error}</span>
    </div>
  {:else if graph && serverScene}
    {#if !compact && preferences.liveUpdates && live.warnings.length > 0}
      <div class="warnings-banner">
        {#each live.warnings as warning}
          <span class="warning-text">{warning}</span>
        {/each}
      </div>
    {/if}

    {#if liveStoppedAt !== null}
      <div class="live-stopped" role="status">
        Live data stopped · last {new Date(liveStoppedAt).toLocaleTimeString()}
      </div>
    {/if}

    <TopologyViewer
      bind:this={viewer}
      {graph}
      scene={serverScene}
      theme={currentTheme}
      mode="view"
      camera={cameraOptions}
      {wheel}
      interaction={compact ? { contextMenu: false, keyboard: false } : {}}
      detail={compact ? { portLabels: 'auto', linkLabels: 'auto', nodeShadow: false } : {}}
      onselect={handleSelect}
    >
      {#snippet linkOverlay(
    link,
    context,
  )}
        <WeathermapLinkOverlay
          {context}
          metrics={link.id === undefined
    ? undefined
    : (live.metrics?.links?.[link.id] ??
      (isLinkInstrumented($linkMapping?.[link.id]) ? IDLE_LINK_METRICS : undefined))}
          enabled={preferences.liveUpdates && preferences.showTrafficFlow}
        />
      {/snippet}
      {#snippet children({
    svgElement,
    graph: activeGraph,
  })}
        <NodeStatusOverlay
          {svgElement}
          status={nodeStatusView}
          enabled={preferences.liveUpdates && preferences.showNodeStatus}
        />
        <HighlightOverlay {svgElement} {marks} {dimOthers} {fresh} pulseAnimation={!compact} />
        <TooltipOverlay {svgElement} graph={activeGraph} contentBuilder={buildTooltip} />
      {/snippet}
    </TopologyViewer>
  {/if}

  {#if graph && serverScene}
    <ViewerControls {compact} onzoom={(f) => viewer?.zoomBy(f)} onfit={fit}>
      {#if spaceMouseOffered !== 'none'}
        <button
          type="button"
          onclick={handleConnectSpaceMouse}
          title={spaceMouseOn
            ? 'SpaceMouse connected'
            : spaceMouseOffered === 'insecure'
              ? 'SpaceMouse needs HTTPS'
              : 'Connect SpaceMouse'}
          class:active={spaceMouseOn}
        >
          <JoystickIcon size={18} />
        </button>
      {/if}
      {#if onSearchOpen}
        <button type="button" onclick={onSearchOpen} title="Search Nodes (Cmd/Ctrl+K)">
          <MagnifyingGlassIcon size={18} />
        </button>
      {/if}
      {#if onToggleSettings}
        <button type="button" onclick={onToggleSettings} title="Settings" class:active={settingsOpen}>
          <GearSixIcon size={18} />
        </button>
      {/if}
      {@render controls?.()}
    </ViewerControls>
  {/if}

  <!-- Legend (only when traffic flow is on) -->
  {#if !compact && preferences.liveUpdates && preferences.showTrafficFlow}
    <div class="legend">
      <div class="legend-title">Utilization</div>
      <div class="legend-items">
        {#each UTILIZATION_STEPS as step (step.key)}
          <div class="legend-item">
            <span class="legend-color" style="background: var(--shumoku-util-{step.key})"></span>
            <span>{step.label}</span>
          </div>
        {/each}
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
  .live-stopped {
    position: absolute;
    top: 8px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 15;
    padding: 4px 10px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 600;
    color: #fff;
    background: #b91c1c;
    box-shadow: 0 1px 4px rgb(0 0 0 / 0.3);
    white-space: nowrap;
    pointer-events: none;
  }
</style>
