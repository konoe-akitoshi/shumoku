<script lang="ts">
  import type { Node, ResolvedEdge, ResolvedPort, Subgraph, Theme } from '@shumoku/core'
  import type { RendererOverlaySnippets } from '../../lib/overlays'
  import type { RenderColors } from '../../lib/render-colors'
  import { screenToSvg } from '../../lib/svg-coords'
  import SvgEdge from './SvgEdge.svelte'
  import SvgLinkPreview from './SvgLinkPreview.svelte'
  import SvgNode from './SvgNode.svelte'
  import SvgPort from './SvgPort.svelte'
  import SvgSubgraph from './SvgSubgraph.svelte'

  let {
    nodes,
    ports,
    edges,
    subgraphs,
    bounds,
    colors,
    theme,
    interactive = false,
    selection = new Set<string>(),
    linkedPorts = new Set<string>(),
    subgraphOverlay,
    linkOverlay,
    nodeOverlay,
    portOverlay,
    linkPreview = null,
    svgEl = $bindable<SVGSVGElement | null>(null),
    // Optional rendering filter — predicate that returns true for
    // nodes the host wants hidden from this canvas (e.g. the editor's
    // termination-role nodes that are scene-physical, not logical-
    // diagram concepts). Hidden nodes still exist in `nodes`; they
    // just aren't drawn here.
    hideNode,
    // Callbacks (unified: drag/select work for all element types)
    ondragstart,
    ondragmove,
    ondragend,
    onselect,
    onaddport,
    onlinkstart,
    onlinkend,
    onportdragmove,
    onportdragend,
    onlabeledit,
    oncontextmenu: onctx,
    onbackgroundclick,
    onmarquee,
    preventContextMenuDefault = true,
  }: RendererOverlaySnippets & {
    nodes: Map<string, Node>
    ports: Map<string, ResolvedPort>
    edges: Map<string, ResolvedEdge>
    subgraphs: Map<string, Subgraph>
    bounds: { x: number; y: number; width: number; height: number }
    colors: RenderColors
    theme?: Theme
    interactive?: boolean
    selection?: Set<string>
    linkedPorts?: Set<string>
    linkPreview?: { fromX: number; fromY: number; toX: number; toY: number } | null
    svgEl?: SVGSVGElement | null
    hideNode?: (node: Node) => boolean
    ondragstart?: (id: string) => void
    ondragmove?: (id: string, x: number, y: number) => void
    ondragend?: (id: string) => void
    onselect?: (id: string, e?: MouseEvent) => void
    onaddport?: (nodeId: string, side: 'top' | 'bottom' | 'left' | 'right') => void
    onlinkstart?: (portId: string, x: number, y: number) => void
    onlinkend?: (portId: string) => void
    onportdragmove?: (portId: string, screenX: number, screenY: number) => void
    onportdragend?: (portId: string, screenX: number, screenY: number) => void
    onlabeledit?: (portId: string, label: string, screenX: number, screenY: number) => void
    oncontextmenu?: (id: string, type: string, e: MouseEvent) => void
    onbackgroundclick?: () => void
    /** Marquee rectangle drag finished on empty canvas. The rect is in SVG
     *  world coords (post-camera transform). `additive` is true when the
     *  user held Shift/Cmd/Ctrl, so the host should merge with the existing
     *  selection rather than replace. */
    onmarquee?: (rect: { x: number; y: number; w: number; h: number }, additive: boolean) => void
    /** Suppress browser native menu via `e.preventDefault()`. See ShumokuRenderer. */
    preventContextMenuDefault?: boolean
  } = $props()

  const viewBox = $derived(
    `${bounds.x - 50} ${bounds.y - 50} ${bounds.width + 100} ${bounds.height + 100}`,
  )

  // Camera (pan/zoom) is intentionally NOT attached here. Different host
  // apps have different pan/zoom requirements, so the canvas only
  // provides a stable `<g class="viewport">` target; apps call
  // `attachCamera(svgEl, options)` from `@shumoku/renderer/camera` when
  // they want interactive pan/zoom.
  //
  // Per-node d3-drag still lives inside each SvgNode/SvgSubgraph via
  // the `use:elementDrag` directive — it only fires in edit mode and
  // concerns element manipulation rather than viewport camera.

  // =========================================================================
  // Marquee (drag empty canvas to box-select)
  // =========================================================================
  // Plain left-click + drag on the background creates a selection rectangle.
  // Alt+drag is reserved for camera panning (camera.ts's filter), so we
  // explicitly skip those events. Shift / Cmd / Ctrl held at the start
  // makes the marquee additive (merge with existing selection).
  let marquee = $state<{
    x0: number
    y0: number
    x1: number
    y1: number
    additive: boolean
  } | null>(null)

  function bgPointerDown(e: PointerEvent) {
    if (e.button !== 0 || e.altKey || !svgEl) return
    const p = screenToSvg(svgEl, e.clientX, e.clientY)
    marquee = {
      x0: p.x,
      y0: p.y,
      x1: p.x,
      y1: p.y,
      additive: e.shiftKey || e.metaKey || e.ctrlKey,
    }
    ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
  }

  function bgPointerMove(e: PointerEvent) {
    if (!marquee || !svgEl) return
    const p = screenToSvg(svgEl, e.clientX, e.clientY)
    marquee = { ...marquee, x1: p.x, y1: p.y }
  }

  function bgPointerUp(_e: PointerEvent) {
    if (!marquee) return
    const w = Math.abs(marquee.x1 - marquee.x0)
    const h = Math.abs(marquee.y1 - marquee.y0)
    // Drags shorter than a couple of world units are treated as background
    // clicks — let the click handler clear the selection instead. 3 is a
    // bit arbitrary but it matches the visual feedback threshold.
    if (w > 3 || h > 3) {
      onmarquee?.(
        {
          x: Math.min(marquee.x0, marquee.x1),
          y: Math.min(marquee.y0, marquee.y1),
          w,
          h,
        },
        marquee.additive,
      )
    }
    marquee = null
  }
</script>

<svg
  bind:this={svgEl}
  xmlns="http://www.w3.org/2000/svg"
  {viewBox}
  class:interactive
  role="img"
  aria-label="Network topology diagram"
  style="width: 100%; height: 100%; user-select: none; background: {colors.background};"
>
  <defs>
    <marker id="arrow" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
      <polygon points="0 0, 10 3.5, 0 7" fill={colors.linkStroke} />
    </marker>
    <filter id="node-shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="1" stdDeviation="1" flood-color="#101828" flood-opacity="0.06" />
    </filter>
    <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
      <path d="M 20 0 L 0 0 0 20" fill="none" stroke={colors.grid} stroke-width="0.5" />
    </pattern>
  </defs>

  {@html `<style>
    /* Typography (always) */
    .node-label { font-family: system-ui, -apple-system, sans-serif; font-size: 14px; font-weight: 600; fill: ${colors.nodeText}; }
    .node-label-bold { font-weight: 700; }
    .node-label-secondary { font-family: ui-monospace, "JetBrains Mono", Menlo, Consolas, monospace; font-size: 10px; font-weight: 400; fill: ${colors.nodeTextSecondary}; }
    .node-icon { color: ${colors.nodeTextSecondary}; }
    .subgraph-label { font-family: system-ui, -apple-system, sans-serif; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
    .link-label { font-family: ui-monospace, "JetBrains Mono", Menlo, Consolas, monospace; font-size: 10px; fill: ${colors.textSecondary}; }

    /* All elements: clickable for selection in any mode */
    .node[data-id] { cursor: pointer; }
    .subgraph-bg { pointer-events: fill; cursor: pointer; }
    .port-hit { pointer-events: fill; cursor: pointer; }
    .link-hit { pointer-events: stroke; cursor: pointer; }

    /* Edit-only: override cursors for editing interactions */
    svg.interactive .node[data-id] { cursor: grab; }
    svg.interactive .node[data-id]:active { cursor: grabbing; }
    svg.interactive .subgraph-bg { cursor: grab; }
    svg.interactive .subgraph-bg:active { cursor: grabbing; }
    svg.interactive .port-hit { cursor: crosshair; }
    svg.interactive .port-hit.linked { cursor: pointer; }
    svg.interactive .edge-zone { pointer-events: fill; cursor: pointer; }
    svg.interactive .port-label-text { pointer-events: fill; cursor: text; }

    /* Edit-only UI (hidden in view mode) */
    .edge-zone { pointer-events: none; }
  </style>`}

  <!-- Viewport group: d3-zoom applies transform here -->
  <g class="viewport">
    <!-- Background: grid in edit mode, transparent in view mode.
         Plain click clears selection; drag starts a marquee box-select. -->
    <rect
      class="canvas-bg"
      x="-99999"
      y="-99999"
      width="199998"
      height="199998"
      fill="url(#grid)"
      pointer-events="fill"
      onclick={() => onbackgroundclick?.()}
      onpointerdown={bgPointerDown}
      onpointermove={bgPointerMove}
      onpointerup={bgPointerUp}
    />
    {#each subgraphs.values() as subgraph (subgraph.id)}
      <SvgSubgraph
        {subgraph}
        {colors}
        {theme}
        selected={selection.has(subgraph.id)}
        {interactive}
        overlay={subgraphOverlay}
        {ondragstart}
        {ondragmove}
        {ondragend}
        {onselect}
        oncontextmenu={(id, e) => onctx?.(id, 'subgraph', e)}
        {preventContextMenuDefault}
      />
    {/each}

    {#each edges.values() as edge (edge.id)}
      <SvgEdge
        {edge}
        {colors}
        selected={selection.has(edge.id)}
        overlay={linkOverlay}
        {onselect}
        oncontextmenu={(id, e) => onctx?.(id, 'edge', e)}
        {preventContextMenuDefault}
      />
    {/each}

    <!-- Nodes layer -->
    {#each nodes.values() as node (node.id)}
      {#if !hideNode?.(node)}
        <SvgNode
          {node}
          {colors}
          selected={selection.has(node.id)}
          {interactive}
          overlay={nodeOverlay}
          {ondragstart}
          {ondragmove}
          {ondragend}
          {onselect}
          {onaddport}
          oncontextmenu={(id, e) => onctx?.(id, 'node', e)}
          {preventContextMenuDefault}
        />
      {/if}
    {/each}

    <!-- Ports layer (above nodes so they're always clickable) -->
    {#each ports.values() as port (port.id)}
      <SvgPort
        {port}
        {colors}
        selected={selection.has(port.id)}
        {interactive}
        linked={linkedPorts.has(port.id)}
        overlay={portOverlay}
        {onlinkstart}
        {onlinkend}
        {onportdragmove}
        {onportdragend}
        {onselect}
        {onlabeledit}
        oncontextmenu={(id, e) => onctx?.(id, 'port', e)}
        {preventContextMenuDefault}
      />
    {/each}

    {#if linkPreview}
      <SvgLinkPreview
        fromX={linkPreview.fromX}
        fromY={linkPreview.fromY}
        toX={linkPreview.toX}
        toY={linkPreview.toY}
      />
    {/if}

    {#if marquee}
      <!-- Marquee overlay. Lives inside the viewport group so it scales
           with the camera transform. pointer-events:none lets the
           background rect keep receiving pointer events for drag. -->
      <rect
        class="marquee"
        x={Math.min(marquee.x0, marquee.x1)}
        y={Math.min(marquee.y0, marquee.y1)}
        width={Math.abs(marquee.x1 - marquee.x0)}
        height={Math.abs(marquee.y1 - marquee.y0)}
        fill={colors.selection}
        fill-opacity="0.1"
        stroke={colors.selection}
        stroke-width="1"
        stroke-dasharray="3 2"
        pointer-events="none"
      />
    {/if}
  </g>
</svg>
