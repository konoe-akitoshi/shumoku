<script lang="ts">
  /**
   * Shared topology rendering core used by the widget, detail page, and
   * share page. Accepts a NetworkGraph + sheet selection, runs layout
   * via @shumoku/core (cached per sheet), and mounts @shumoku/renderer.
   *
   * Overlay features (weathermap, highlight, tooltip, etc.) are not
   * built in — consumers compose them via the `children` snippet, which
   * receives the rendered svgElement and viewport size so each overlay
   * can attach its own DOM and react to resizes.
   */
  import {
    buildChildSheetGraph,
    computeNetworkLayout,
    type NetworkGraph,
    type ResolvedLayout,
    type Theme,
  } from '@shumoku/core'
  import { attachCamera, type Camera, type CameraOptions, ShumokuRenderer } from '@shumoku/renderer'
  import type { Snippet } from 'svelte'

  export interface ViewerContext {
    svgElement: SVGSVGElement | null
    graph: NetworkGraph
    sheetId: string | null
    viewport: { width: number; height: number }
  }

  export interface InteractionOptions {
    /** Allow pan/zoom via pointer (wheel/drag). Default: true. */
    panZoom?: boolean
    /** Allow click-to-select elements. Default: true. */
    select?: boolean
    /** Allow drag-to-move in edit mode. Default: derived from `mode`. */
    dragEdit?: boolean
    /** Emit oncontextmenu when right-clicking an element. Default: true. */
    contextMenu?: boolean
    /** Capture keyboard shortcuts (Esc/Delete). Default: true. */
    keyboard?: boolean
  }

  export interface DetailOptions {
    /** Show per-port labels. 'auto' hides them when viewport is small. */
    portLabels?: boolean | 'auto'
    /** Show link labels (bandwidth, VLAN, etc.). */
    linkLabels?: boolean | 'auto'
    /** Drop-shadow filter on nodes — off for small widgets. Default: true. */
    nodeShadow?: boolean
  }

  interface Props {
    // --- Data ---
    graph: NetworkGraph | undefined
    sheetId?: string | null
    /**
     * Pre-computed layout override. When provided, skips the
     * client-side computeNetworkLayout call entirely (used by share
     * pages that get layouts from the server).
     */
    layout?: ResolvedLayout
    /**
     * 'lazy' computes each sheet on first access; 'eager' kicks off
     * layout for every top-level subgraph as soon as the graph loads.
     */
    sheetCacheStrategy?: 'lazy' | 'eager'

    // --- Display ---
    theme?: Theme
    mode?: 'view' | 'edit'

    // --- Interaction ---
    interaction?: InteractionOptions

    /**
     * Camera (pan/zoom) behaviour. Defaults to `{ wheelMode: 'pan' }`
     * — trackpad-friendly pan + pinch zoom — which suits dashboard
     * widgets and the detail page. Pass a full `CameraOptions` to
     * override, or `false` to disable camera entirely (e.g. static
     * preview snapshots).
     */
    camera?: Partial<CameraOptions> | false
    /**
     * Reset the camera transform whenever the active sheet changes.
     * Default true. Set false to preserve user pan/zoom across sheet
     * switches.
     */
    resetCameraOnSheetChange?: boolean

    // --- LOD ---
    detail?: DetailOptions

    // --- Events (forwarded from ShumokuRenderer) ---
    onselect?: (id: string | null, type: string | null) => void
    oncontextmenu?: (id: string, type: string, screenX: number, screenY: number) => void
    onlayoutready?: (layout: ResolvedLayout, sheetId: string | null) => void
    onerror?: (err: Error) => void

    // --- Overlay slot ---
    children?: Snippet<[ViewerContext]>
  }

  let {
    graph,
    sheetId = null,
    layout: layoutOverride = undefined,
    sheetCacheStrategy = 'lazy',
    theme,
    mode = 'view',
    interaction = {},
    camera: cameraOptions = {},
    resetCameraOnSheetChange = true,
    detail = {},
    onselect,
    oncontextmenu,
    onlayoutready,
    onerror,
    children,
  }: Props = $props()

  // --- Layout cache (editor pattern) ---
  //
  // Only `activeLayout` is $state — it's the single value the template
  // reads (`{#if activeLayout}` + `<ShumokuRenderer layout={...}>`).
  // Everything else (the per-sheet cache, the "last seen" markers used
  // for identity diffing) is a plain `let`: writing them must NOT
  // re-trigger the effect that wrote them, and no downstream code
  // needs to react to cache mutations — the effect promotes a cache
  // hit into `activeLayout` explicitly when appropriate.

  let layoutsBySheet: Record<string, ResolvedLayout> = {}
  let activeLayout = $state<ResolvedLayout | null>(null)
  let cachedGraphRef: NetworkGraph | null = null
  let activeSheetKey: string | null = null

  async function ensureSheetLayout(g: NetworkGraph, id: string | null): Promise<void> {
    const key = id ?? 'root'
    const cached = layoutsBySheet[key]
    if (cached) {
      activeLayout = cached
      onlayoutready?.(cached, id)
      return
    }
    try {
      const target = id ? (buildChildSheetGraph(g, id) ?? g) : g
      const { resolved } = await computeNetworkLayout(target)
      // Bail if graph/sheet changed while we were computing. Compare
      // against `id` (the nullable sheet id), not `key` (the
      // 'root'-normalized cache key) — `activeSheetKey` stores the
      // nullable form so they must match on that axis.
      if (cachedGraphRef !== g || activeSheetKey !== id) return
      layoutsBySheet[key] = resolved
      activeLayout = resolved
      onlayoutready?.(resolved, id)
    } catch (err) {
      // Always surface the error — silent catching made debugging
      // "empty canvas" extremely painful. Callers can still hook
      // `onerror` for UI-level handling.
      const e = err instanceof Error ? err : new Error(String(err))
      console.error('[TopologyViewer] layout computation failed:', e)
      onerror?.(e)
    }
  }

  async function prewarmEagerSheets(g: NetworkGraph): Promise<void> {
    const topLevel = (g.subgraphs ?? []).filter((sg) => !sg.parent)
    for (const sg of topLevel) {
      if (layoutsBySheet[sg.id]) continue
      const child = buildChildSheetGraph(g, sg.id)
      if (!child) continue
      try {
        const { resolved } = await computeNetworkLayout(child)
        if (cachedGraphRef !== g) return
        layoutsBySheet[sg.id] = resolved
      } catch (err) {
        // Prewarm failures aren't fatal — the sheet tab just stays
        // uncached and will retry on click — but log so we see them.
        console.warn(`[TopologyViewer] prewarm failed for sheet '${sg.id}':`, err)
      }
    }
  }

  // --- React to graph / sheet changes ---
  //
  // Only tracked reads here are `graph`, `sheetId`, `layoutOverride`,
  // `sheetCacheStrategy` (props). Everything else (the cache Maps,
  // last-seen refs) is a plain `let`, so this effect runs exactly
  // once per actual change.

  $effect(() => {
    if (layoutOverride) {
      activeLayout = layoutOverride
      return
    }
    if (!graph) {
      activeLayout = null
      cachedGraphRef = null
      activeSheetKey = null
      return
    }
    const sheetKey = sheetId ?? null

    if (graph !== cachedGraphRef) {
      cachedGraphRef = graph
      layoutsBySheet = {}
      activeLayout = null
      if (sheetCacheStrategy === 'eager') void prewarmEagerSheets(graph)
    }
    if (sheetKey !== activeSheetKey) {
      activeSheetKey = sheetKey
    }

    void ensureSheetLayout(graph, sheetKey)
  })

  // --- Viewport size tracking (passed to overlays so they can dynamically
  // adjust quality based on on-screen size) ---

  let container = $state<HTMLDivElement | null>(null)
  let svgElement = $state<SVGSVGElement | null>(null)
  let viewportSize = $state({ width: 0, height: 0 })

  $effect(() => {
    if (!container) return
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      const { width, height } = entry.contentRect
      viewportSize = { width, height }
    })
    observer.observe(container)
    return () => observer.disconnect()
  })

  // --- Interaction gating via CSS class + pointer-events ---
  // Most knobs are passed straight through to ShumokuRenderer (mode),
  // the rest we apply via container class so CSS controls them
  // uniformly across all embedded elements.

  const panZoomEnabled = $derived(interaction.panZoom ?? true)
  const selectEnabled = $derived(interaction.select ?? true)
  const dragEditEnabled = $derived(interaction.dragEdit ?? mode === 'edit')
  const keyboardEnabled = $derived(interaction.keyboard ?? true)
  const contextMenuEnabled = $derived(interaction.contextMenu ?? true)

  // Renderer's `mode` prop gates drag-edit internally; we only flip to
  // 'view' if the consumer explicitly disabled dragEdit.
  const effectiveMode = $derived<'view' | 'edit'>(
    mode === 'edit' && dragEditEnabled ? 'edit' : 'view',
  )

  // --- LOD: compute derived boolean labels based on 'auto' + viewport ---

  const showPortLabels = $derived.by(() => {
    const setting = detail.portLabels ?? true
    if (setting === 'auto') return viewportSize.width >= 400 && viewportSize.height >= 300
    return setting
  })
  const showLinkLabels = $derived.by(() => {
    const setting = detail.linkLabels ?? true
    if (setting === 'auto') return viewportSize.width >= 400
    return setting
  })
  const showNodeShadow = $derived(detail.nodeShadow ?? true)

  // --- Camera (pan/zoom) — attach d3-zoom via @shumoku/renderer's
  // attachCamera utility once the svg mounts. `camera={false}` opts out
  // entirely (static preview). Re-attaches if the consumer swaps in a
  // new `cameraOptions` reference.

  let camera = $state<Camera | null>(null)
  $effect(() => {
    if (cameraOptions === false || !svgElement) {
      camera = null
      return
    }
    // Trackpad-friendly default for dashboard-style usage; callers can
    // override any field by passing a `Partial<CameraOptions>`.
    const c = attachCamera(svgElement, { wheelMode: 'pan', ...cameraOptions })
    camera = c
    return () => {
      c.detach()
      camera = null
    }
  })

  // Reset camera transform when the active sheet (or graph) changes,
  // so each sheet opens at 1:1 rather than inheriting the previous
  // sheet's pan/zoom. Opt-out via `resetCameraOnSheetChange={false}`.
  $effect(() => {
    sheetId // track
    graph // track
    if (resetCameraOnSheetChange) camera?.reset()
  })

  function handleSelect(id: string | null, type: string | null) {
    if (!selectEnabled) return
    onselect?.(id, type)
  }

  function handleContextMenu(id: string, type: string, x: number, y: number) {
    if (!contextMenuEnabled) return
    oncontextmenu?.(id, type, x, y)
  }

  // =========================================================================
  // Imperative viewport API — delegates to the attached camera so
  // d3-zoom's internal state stays consistent with what the consumer
  // requests. Returns no-op silently if the camera is disabled.
  // =========================================================================

  export function zoomBy(factor: number): void {
    camera?.zoomBy(factor)
  }

  export function resetZoom(): void {
    camera?.reset()
  }

  /**
   * Pan + zoom so the given node is focused (~5% of viewport area),
   * plus a brief pulse-highlight animation on the node itself.
   */
  export function panToNode(nodeId: string): void {
    if (!svgElement) return
    const found = camera?.panToNode(nodeId) ?? false
    if (!found) return
    const node = svgElement.querySelector<SVGGElement>(`g.node[data-id="${CSS.escape(nodeId)}"]`)
    if (!node) return
    node.classList.add('node-highlighted')
    setTimeout(() => node.classList.remove('node-highlighted'), 3000)
  }

  export function getSvgElement(): SVGSVGElement | null {
    return svgElement
  }

  // Only constructed when the template branch below has already
  // checked that `graph` is defined, so the `graph!` non-null cast is
  // safe. This keeps ViewerContext's `graph` non-nullable for
  // downstream overlays (they never have to handle undefined graph).
  const ctx = $derived<ViewerContext | null>(
    graph && svgElement
      ? {
          svgElement,
          graph,
          sheetId: sheetId ?? null,
          viewport: viewportSize,
        }
      : null,
  )
</script>

<div
  bind:this={container}
  class="topology-viewer"
  class:no-panzoom={!panZoomEnabled}
  class:no-keyboard={!keyboardEnabled}
  class:hide-port-labels={!showPortLabels}
  class:hide-link-labels={!showLinkLabels}
  class:no-node-shadow={!showNodeShadow}
>
  {#if activeLayout}
    <ShumokuRenderer
      layout={activeLayout}
      {theme}
      mode={effectiveMode}
      bind:svgElement
      onselect={handleSelect}
      oncontextmenu={handleContextMenu}
    />
    {#if ctx}
      {@render children?.(ctx)}
    {/if}
  {/if}
</div>

<style>
  .topology-viewer {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
  }

  /* @shumoku/renderer's <svg> fills the viewer */
  .topology-viewer :global(svg) {
    width: 100%;
    height: 100%;
  }

  /* Interaction gating via pointer-events on specific element types.
             Pan/zoom is wheel/drag-on-bg: we disable wheel by stopping
             propagation on the canvas background. d3-zoom's filter already
             handles wheel requiring ctrl/meta, but we also kill the background
             grid's clickability when selection is off. */
  .topology-viewer.no-panzoom :global(.canvas-bg) {
    pointer-events: none;
  }

  /* LOD: toggleable ornament classes. Rules match @shumoku/renderer's
             output structure (see SvgPort.svelte, SvgEdge.svelte, etc.). */
  .topology-viewer.hide-port-labels :global(.port-label),
  .topology-viewer.hide-port-labels :global(.port-label-bg) {
    display: none;
  }
  .topology-viewer.hide-link-labels :global(.link-label) {
    display: none;
  }
  .topology-viewer.no-node-shadow :global(g.node[filter]) {
    filter: none !important;
  }
</style>
