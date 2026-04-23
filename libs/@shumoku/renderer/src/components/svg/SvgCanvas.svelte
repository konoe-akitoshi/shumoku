<script lang="ts">
  import type { Node, ResolvedEdge, ResolvedPort, Subgraph, Theme } from '@shumoku/core'
  import type { RenderColors } from '../../lib/render-colors'
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
    linkPreview = null,
    svgEl = $bindable<SVGSVGElement | null>(null),
    // Callbacks (unified: ondragmove/onselect work for all element types)
    ondragmove,
    onselect,
    onaddport,
    onlinkstart,
    onlinkend,
    onlabeledit,
    oncontextmenu: onctx,
    onbackgroundclick,
  }: {
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
    ondragmove?: (id: string, x: number, y: number) => void
    onselect?: (id: string) => void
    onaddport?: (nodeId: string, side: 'top' | 'bottom' | 'left' | 'right') => void
    onlinkstart?: (portId: string, x: number, y: number) => void
    onlinkend?: (portId: string) => void
    onlabeledit?: (portId: string, label: string, screenX: number, screenY: number) => void
    oncontextmenu?: (id: string, type: string, e: MouseEvent) => void
    onbackgroundclick?: () => void
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
    <!-- Background: grid in edit mode, transparent in view mode -->
    <rect
      class="canvas-bg"
      x="-99999"
      y="-99999"
      width="199998"
      height="199998"
      fill="url(#grid)"
      pointer-events="fill"
      onclick={() => onbackgroundclick?.()}
    />
    {#each subgraphs.values() as subgraph (subgraph.id)}
      <SvgSubgraph
        {subgraph}
        {colors}
        {theme}
        selected={selection.has(subgraph.id)}
        {interactive}
        {ondragmove}
        {onselect}
        oncontextmenu={(id, e) => onctx?.(id, 'subgraph', e)}
      />
    {/each}

    {#each edges.values() as edge (edge.id)}
      <SvgEdge
        {edge}
        {colors}
        selected={selection.has(edge.id)}
        {onselect}
        oncontextmenu={(id, e) => onctx?.(id, 'edge', e)}
      />
    {/each}

    <!-- Nodes layer -->
    {#each nodes.values() as node (node.id)}
      <SvgNode
        {node}
        {colors}
        selected={selection.has(node.id)}
        {interactive}
        {ondragmove}
        {onselect}
        {onaddport}
        oncontextmenu={(id, e) => onctx?.(id, 'node', e)}
      />
    {/each}

    <!-- Ports layer (above nodes so they're always clickable) -->
    {#each ports.values() as port (port.id)}
      <SvgPort
        {port}
        {colors}
        selected={selection.has(port.id)}
        {interactive}
        linked={linkedPorts.has(port.id)}
        {onlinkstart}
        {onlinkend}
        {onselect}
        {onlabeledit}
        oncontextmenu={(id, e) => onctx?.(id, 'port', e)}
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
  </g>
</svg>
