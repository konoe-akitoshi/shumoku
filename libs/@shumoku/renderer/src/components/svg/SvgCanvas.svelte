<script lang="ts">
  import type {
    ResolvedEdge,
    ResolvedNode,
    ResolvedPort,
    ResolvedSubgraph,
    Theme,
  } from '@shumoku/core'
  import { drag } from 'd3-drag'
  import { select } from 'd3-selection'
  import { type D3ZoomEvent, zoom } from 'd3-zoom'
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
    // Callbacks
    onnodedragmove,
    onaddport,
    onlinkstart,
    onlinkend,
    onedgeselect,
    onportselect,
    onsubgraphselect,
    onsubgraphmove,
    oncontextmenu: onctx,
    onbackgroundclick,
  }: {
    nodes: Map<string, ResolvedNode>
    ports: Map<string, ResolvedPort>
    edges: Map<string, ResolvedEdge>
    subgraphs: Map<string, ResolvedSubgraph>
    bounds: { x: number; y: number; width: number; height: number }
    colors: RenderColors
    theme?: Theme
    interactive?: boolean
    selection?: Set<string>
    linkedPorts?: Set<string>
    linkPreview?: { fromX: number; fromY: number; toX: number; toY: number } | null
    svgEl?: SVGSVGElement | null
    onnodedragmove?: (id: string, x: number, y: number) => void
    onaddport?: (nodeId: string, side: 'top' | 'bottom' | 'left' | 'right') => void
    onlinkstart?: (portId: string, x: number, y: number) => void
    onlinkend?: (portId: string) => void
    onedgeselect?: (edgeId: string) => void
    onportselect?: (portId: string) => void
    onsubgraphselect?: (sgId: string) => void
    onsubgraphmove?: (sgId: string, x: number, y: number) => void
    oncontextmenu?: (id: string, type: string, e: MouseEvent) => void
    onbackgroundclick?: () => void
  } = $props()

  const viewBox = $derived(
    `${bounds.x - 50} ${bounds.y - 50} ${bounds.width + 100} ${bounds.height + 100}`,
  )

  const nodeList = $derived([...nodes.values()])
  const edgeList = $derived([...edges.values()])
  const subgraphList = $derived([...subgraphs.values()])

  const portsByNode = $derived.by(() => {
    const map = new Map<string, ResolvedPort[]>()
    for (const port of ports.values()) {
      const list = map.get(port.nodeId)
      if (list) list.push(port)
      else map.set(port.nodeId, [port])
    }
    return map
  })

  // Viewport group ref (d3-zoom applies transform to this)
  let viewportEl: SVGGElement | undefined = $state()

  // --- d3-zoom: pan/zoom on viewport <g> ---
  // d3-zoom: pan/zoom always active
  $effect(() => {
    if (!svgEl || !viewportEl) return

    const svgSel = select(svgEl)
    const zoomBehavior = zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 5])
      .filter((e) => {
        // Allow wheel zoom always, drag only with middle button or space
        if (e.type === 'wheel') return true
        if (e.type === 'mousedown' || e.type === 'pointerdown') {
          return (e as MouseEvent).button === 1 || (e as MouseEvent).altKey
        }
        return false
      })
      .on('zoom', (e: D3ZoomEvent<SVGSVGElement, unknown>) => {
        if (viewportEl) {
          viewportEl.setAttribute('transform', e.transform.toString())
        }
      })

    svgSel.call(zoomBehavior)

    // Prevent default context menu on SVG background only when nothing is targeted
    svgSel.on('contextmenu.zoom', null)

    return () => {
      svgSel.on('.zoom', null)
    }
  })

  // --- d3-drag: node dragging (re-binds when node/subgraph list changes) ---
  $effect(() => {
    // Track reactive dependencies so d3-drag rebinds on new elements
    void nodeList.length
    void subgraphList.length
    if (!svgEl || !interactive) return

    // biome-ignore lint/suspicious/noExplicitAny: d3-drag subject typing
    const nodeDrag = drag<SVGGElement, any>()
      .filter((e) => {
        // Don't start node drag from port elements
        const target = e.target as Element
        if (target.closest('.port')) return false
        if (target.closest('[data-droplet]')) return false
        return e.button === 0
      })
      .on('drag', function (e) {
        const nodeId = this.getAttribute('data-id')
        if (!nodeId) return
        const node = nodes.get(nodeId)
        if (!node) return
        onnodedragmove?.(nodeId, node.position.x + e.dx, node.position.y + e.dy)
      })

    select(svgEl)
      .selectAll<SVGGElement, unknown>('.node[data-id]')
      .call(nodeDrag as any)

    // biome-ignore lint/suspicious/noExplicitAny: d3-drag subject typing
    const sgDrag = drag<SVGRectElement, any>().on('drag', function (e) {
      const sgId = this.getAttribute('data-sg-drag')
      if (!sgId) return
      const sg = subgraphs.get(sgId)
      if (!sg) return
      onsubgraphmove?.(sgId, sg.bounds.x + e.dx, sg.bounds.y + e.dy)
    })

    select(svgEl)
      .selectAll<SVGRectElement, unknown>('[data-sg-drag]')
      .call(sgDrag as any)

    return () => {
      select(svgEl).selectAll('.node[data-id]').on('.drag', null)
      select(svgEl).selectAll('[data-sg-drag]').on('.drag', null)
    }
  })
</script>

<svg
  bind:this={svgEl}
  xmlns="http://www.w3.org/2000/svg"
  {viewBox}
  class:interactive
  style="width: 100%; height: 100%; user-select: none; background: #f8fafc;"
>
  <defs>
    <marker id="arrow" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
      <polygon points="0 0, 10 3.5, 0 7" fill={colors.linkStroke} />
    </marker>
    <filter id="node-shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="1" stdDeviation="1" flood-color="#101828" flood-opacity="0.06" />
    </filter>
    <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
      <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e2e8f0" stroke-width="0.5" />
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

    /* Default: all interactive elements disabled */
    .subgraph-bg, .port-hit, .link-hit, .edge-zone, [data-sg-drag] { pointer-events: none; }

    /* Edit mode: enable all interaction */
    svg.interactive .node[data-id] { cursor: grab; }
    svg.interactive .node[data-id]:active { cursor: grabbing; }
    svg.interactive .subgraph-bg { pointer-events: fill; cursor: pointer; }
    svg.interactive [data-sg-drag] { pointer-events: fill; cursor: grab; }
    svg.interactive [data-sg-drag]:active { cursor: grabbing; }
    svg.interactive .port-hit { pointer-events: fill; cursor: crosshair; }
    svg.interactive .port-hit.linked { cursor: pointer; }
    svg.interactive .link-hit { pointer-events: stroke; cursor: pointer; }
    svg.interactive .edge-zone { pointer-events: fill; cursor: pointer; }
  </style>`}

  <!-- Viewport group: d3-zoom applies transform here -->
  <g bind:this={viewportEl} class="viewport">
    <!-- Background: grid in edit mode, transparent in view mode -->
    <rect
      class="canvas-bg"
      x="-99999"
      y="-99999"
      width="199998"
      height="199998"
      fill="url(#grid)"
      pointer-events={interactive ? 'fill' : 'none'}
      onclick={() => onbackgroundclick?.()}
    />
    {#each subgraphList as subgraph (subgraph.id)}
      <SvgSubgraph
        {subgraph}
        {colors}
        {theme}
        selected={selection.has(subgraph.id)}
        onselect={onsubgraphselect}
      />
    {/each}

    {#each edgeList as edge (edge.id)}
      <SvgEdge
        {edge}
        {colors}
        selected={selection.has(edge.id)}
        {interactive}
        onselect={onedgeselect}
        oncontextmenu={(id, e) => onctx?.(id, 'edge', e)}
      />
    {/each}

    <!-- Nodes layer -->
    {#each nodeList as node (node.id)}
      <SvgNode
        {node}
        {colors}
        selected={selection.has(node.id)}
        {interactive}
        {onaddport}
        oncontextmenu={(id, e) => onctx?.(id, 'node', e)}
      />
    {/each}

    <!-- Ports layer (above nodes so they're always clickable) -->
    {#each nodeList as node (node.id)}
      {#each portsByNode.get(node.id) ?? [] as port (port.id)}
        <SvgPort
          {port}
          {colors}
          selected={selection.has(port.id)}
          {interactive}
          linked={linkedPorts.has(port.id)}
          {onlinkstart}
          {onlinkend}
          onselect={onportselect}
          oncontextmenu={(id, e) => onctx?.(id, 'port', e)}
        />
      {/each}
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
