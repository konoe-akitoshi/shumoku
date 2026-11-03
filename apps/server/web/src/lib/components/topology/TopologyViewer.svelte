<script lang="ts">
  /**
   * Shared topology rendering core used by the widget, detail page, and
   * share page. Draws a scene (the server's baked one, or one drawn here
   * from the graph) with @shumoku/renderer.
   *
   * Overlay features (weathermap, highlight, tooltip, etc.) are not
   * built in — consumers compose them via the `children` snippet, which
   * receives the rendered svgElement and viewport size so each overlay
   * can attach its own DOM and react to resizes.
   *
   * Sheets removed in the engine swap; revisit as a view. The whole network is drawn on
   * one page, groups nested.
   */
  import { fromNetworkGraph, type NetworkGraph, type Theme } from '@shumoku/core'
  import {
    attachCamera,
    type Camera,
    type CameraOptions,
    drawNetworkScene,
    type RendererOverlaySnippets,
    type Scene,
  } from '@shumoku/renderer'
  import ShumokuRenderer from '@shumoku/renderer/components/ShumokuRenderer.svelte'
  import type { Snippet } from 'svelte'

  export interface ViewerContext {
    svgElement: SVGSVGElement | null
    graph: NetworkGraph
    viewport: { width: number; height: number }
  }

  export interface InteractionOptions {
    /** Allow pan/zoom via pointer (wheel/drag). Default: true. */
    panZoom?: boolean
    /** Allow click-to-select elements. Default: true. */
    select?: boolean
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

  interface Props extends RendererOverlaySnippets {
    // --- Data ---
    graph: NetworkGraph | undefined
    /**
     * The drawing to show. When absent it is drawn here from `graph`, on the browser's main
     * thread: pass the server's baked scene for anything large.
     */
    scene?: Scene

    // --- Display ---
    theme?: Theme
    mode?: 'view' | 'edit'

    // --- Interaction ---
    interaction?: InteractionOptions

    /**
     * Camera (pan/zoom) options, forwarded to `attachCamera`. Defaults
     * to `{}` which uses `wheelMode: 'auto'` (detect mouse vs
     * trackpad per-event). Pass `false` to disable camera entirely
     * (e.g. static preview snapshots).
     */
    camera?: CameraOptions | false

    // --- LOD ---
    detail?: DetailOptions

    // --- Events (forwarded from ShumokuRenderer) ---
    onselect?: (id: string | null, type: string | null) => void
    oncontextmenu?: (id: string, type: string, screenX: number, screenY: number) => void
    onerror?: (err: Error) => void

    // --- Overlay slot ---
    children?: Snippet<[ViewerContext]>
  }

  let {
    graph,
    scene: sceneOverride = undefined,
    theme,
    mode = 'view',
    interaction = {},
    camera: cameraOptions = {},
    detail = {},
    onselect,
    oncontextmenu,
    onerror,
    children,
    subgraphOverlay,
    linkOverlay,
    nodeOverlay,
    portOverlay,
  }: Props = $props()

  // --- The scene: the server's, else one drawn from the graph here ---

  const scene = $derived.by<Scene | undefined>(() => {
    if (sceneOverride) return sceneOverride
    if (!graph) return undefined
    try {
      return drawNetworkScene(fromNetworkGraph(graph))
    } catch (err) {
      // Always surface the error — silent catching made debugging "empty canvas" painful.
      const e = err instanceof Error ? err : new Error(String(err))
      console.error('[TopologyViewer] drawing failed:', e)
      onerror?.(e)
      return undefined
    }
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
  const keyboardEnabled = $derived(interaction.keyboard ?? true)
  const contextMenuEnabled = $derived(interaction.contextMenu ?? true)

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
    if (cameraOptions === false || !panZoomEnabled || !svgElement) {
      camera = null
      return
    }
    const c = attachCamera(svgElement, cameraOptions)
    camera = c
    return () => {
      c.detach()
      camera = null
    }
  })

  // Reset camera transform when the graph changes, so a new drawing opens fitted rather than
  // inheriting the previous pan/zoom.
  $effect(() => {
    graph // track
    camera?.reset()
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

  /** Snapshot the current camera transform so it can be restored later. */
  export function getCameraTransform(): { x: number; y: number; k: number } | null {
    return camera?.getTransform() ?? null
  }

  /** Restore a previously snapshotted transform (pan + zoom level). */
  export function setCameraTransform(t: { x: number; y: number; k: number }): void {
    if (!camera) return
    camera.panTo(t.x, t.y)
    camera.zoomTo(t.k)
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
          viewport: viewportSize,
        }
      : null,
  )
</script>

<div
  bind:this={container}
  class="topology-viewer"
  class:no-keyboard={!keyboardEnabled}
  class:hide-port-labels={!showPortLabels}
  class:hide-link-labels={!showLinkLabels}
  class:no-node-shadow={!showNodeShadow}
>
  {#if scene}
    <ShumokuRenderer
      {scene}
      {theme}
      {mode}
      {subgraphOverlay}
      {linkOverlay}
      {nodeOverlay}
      {portOverlay}
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

  /* LOD: toggleable ornament classes. Rules match @shumoku/renderer's
                                               output structure (see the kit's Port.svelte, WireCaption.svelte, etc.). */
  .topology-viewer.hide-port-labels :global(.port-label-text),
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
