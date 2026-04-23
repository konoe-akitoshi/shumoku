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
  import { ShumokuRenderer } from '@shumoku/renderer'
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

    // --- Initial view ---
    autoFit?: 'initial' | 'on-resize' | 'off'

    // --- LOD (not yet wired into renderer internals — exposed for future use) ---
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
    autoFit = 'initial',
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
      // Bail if graph/sheet changed while we were computing
      if (cachedGraphRef !== g || activeSheetKey !== key) return
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
  // `sheetCacheStrategy` (props) and `activeLayout` (for the override
  // short-circuit). Everything else (the cache Maps, last-seen refs,
  // hasFitted) is a plain `let`, so this effect runs exactly once per
  // actual change.

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
      hasFitted = false
      if (sheetCacheStrategy === 'eager') void prewarmEagerSheets(graph)
    }
    if (sheetKey !== activeSheetKey) {
      activeSheetKey = sheetKey
      hasFitted = false
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

  // --- Auto-fit on initial layout ---
  //
  // `hasFitted` is a plain `let` (not $state): writing it inside the
  // effect below must not re-trigger the effect. The graph/sheet
  // effect above resets it when the data changes.

  let hasFitted = false
  $effect(() => {
    const svg = svgElement
    if (!svg || !activeLayout) return
    if (autoFit === 'off') return
    if (autoFit === 'initial' && hasFitted) return
    // ShumokuRenderer already chooses a viewBox covering the layout
    // bounds; we just need to reset any user-applied zoom transform.
    // d3-zoom transforms are on `.viewport` — clearing the attribute
    // restores identity.
    const viewport = svg.querySelector<SVGGElement>('.viewport')
    if (viewport) viewport.removeAttribute('transform')
    hasFitted = true
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
  // Imperative viewport helpers
  //
  // @shumoku/renderer wraps d3-zoom internally; for programmatic control
  // (zoom buttons, pan-to-node from a search palette, etc.) we expose a
  // small helper API that manipulates the `.viewport` transform directly.
  // This is compatible with d3-zoom's attribute-based state since both
  // reflect changes through the same DOM.
  // =========================================================================

  interface Transform {
    x: number
    y: number
    k: number
  }

  function parseTransform(value: string | null): Transform {
    if (!value) return { x: 0, y: 0, k: 1 }
    const translateMatch = value.match(/translate\(([^,]+),\s*([^)]+)\)/)
    const scaleMatch = value.match(/scale\(([^)]+)\)/)
    return {
      x: translateMatch ? Number(translateMatch[1]) : 0,
      y: translateMatch ? Number(translateMatch[2]) : 0,
      k: scaleMatch ? Number(scaleMatch[1]) : 1,
    }
  }

  function setTransform(viewport: SVGGElement, t: Transform) {
    viewport.setAttribute('transform', `translate(${t.x}, ${t.y}) scale(${t.k})`)
  }

  function getViewport(): SVGGElement | null {
    return svgElement?.querySelector<SVGGElement>('.viewport') ?? null
  }

  export function zoomBy(factor: number): void {
    const viewport = getViewport()
    if (!viewport || !svgElement) return
    const t = parseTransform(viewport.getAttribute('transform'))
    const rect = svgElement.getBoundingClientRect()
    const cx = rect.width / 2
    const cy = rect.height / 2
    const newK = Math.max(0.1, Math.min(10, t.k * factor))
    // Keep (cx, cy) fixed during scale (standard zoom-toward-center)
    const newX = cx - ((cx - t.x) / t.k) * newK
    const newY = cy - ((cy - t.y) / t.k) * newK
    setTransform(viewport, { x: newX, y: newY, k: newK })
  }

  export function resetZoom(): void {
    const viewport = getViewport()
    viewport?.removeAttribute('transform')
  }

  /** Pan + zoom so that the node with `nodeId` lands centered at ~5% area. */
  export function panToNode(nodeId: string): void {
    const svg = svgElement
    if (!svg) return
    const node = svg.querySelector<SVGGElement>(`g.node[data-id="${CSS.escape(nodeId)}"]`)
    if (!node) return
    const viewport = getViewport()
    if (!viewport) return

    const rect = svg.getBoundingClientRect()
    const nrect = node.getBoundingClientRect()
    const t = parseTransform(viewport.getAttribute('transform'))

    // Area-ratio based zoom (same idea as the old panzoom-based impl)
    const areaRatio = Math.sqrt((rect.width * rect.height * 0.05) / (nrect.width * nrect.height))
    const targetK = Math.max(2, Math.min(50, t.k * areaRatio))

    // Translate so the node ends up at viewport center
    const ncx = nrect.left + nrect.width / 2 - rect.left
    const ncy = nrect.top + nrect.height / 2 - rect.top
    const cx = rect.width / 2
    const cy = rect.height / 2
    const newX = cx - ((ncx - t.x) / t.k) * targetK
    const newY = cy - ((ncy - t.y) / t.k) * targetK

    setTransform(viewport, { x: newX, y: newY, k: targetK })

    // Brief pulse highlight
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
