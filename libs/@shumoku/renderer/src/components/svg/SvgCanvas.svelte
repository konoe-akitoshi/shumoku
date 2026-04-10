<script lang="ts">
  import type { ResolvedEdge, ResolvedNode, ResolvedPort, ResolvedSubgraph, Theme } from '@shumoku/core'
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
    viewBoxOverride,
    svgEl = $bindable<SVGSVGElement | null>(null),
    // Callbacks (edit mode)
    onnodedragstart,
    onnodedragmove,
    onnodedragend,
    onaddport,
    onlinkstart,
    onlinkend,
    onedgeselect,
    onportselect,
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
    viewBoxOverride?: string
    svgEl?: SVGSVGElement | null
    onnodedragstart?: (id: string) => void
    onnodedragmove?: (id: string, x: number, y: number) => void
    onnodedragend?: (id: string) => void
    onaddport?: (nodeId: string, side: 'top' | 'bottom' | 'left' | 'right') => void
    onlinkstart?: (portId: string, x: number, y: number) => void
    onlinkend?: (portId: string) => void
    onedgeselect?: (edgeId: string) => void
    onportselect?: (portId: string) => void
    onsubgraphmove?: (sgId: string, x: number, y: number) => void
    oncontextmenu?: (id: string, type: string, e: MouseEvent) => void
    onbackgroundclick?: () => void
  } = $props()

  const defaultViewBox = $derived(
    `${bounds.x - 50} ${bounds.y - 50} ${bounds.width + 100} ${bounds.height + 100}`,
  )
  const viewBox = $derived(viewBoxOverride ?? defaultViewBox)

  const nodeList = $derived([...nodes.values()])
  const edgeList = $derived([...edges.values()])
  const subgraphList = $derived([...subgraphs.values()])

  const portsByNode = $derived.by(() => {
    const map = new Map<string, ResolvedPort[]>()
    for (const port of ports.values()) {
      const list = map.get(port.nodeId)
      if (list) {
        list.push(port)
      } else {
        map.set(port.nodeId, [port])
      }
    }
    return map
  })

  function onSvgClick(e: MouseEvent) {
    if (e.target === svgEl || (e.target as Element)?.classList?.contains('canvas-bg')) {
      onbackgroundclick?.()
    }
  }
</script>

<svg
  bind:this={svgEl}
  xmlns="http://www.w3.org/2000/svg"
  viewBox={viewBox}
  style="width: 100%; height: 100%; user-select: none; background: transparent;"
  onclick={onSvgClick}
>
  <defs>
    <marker id="arrow" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
      <polygon points="0 0, 10 3.5, 0 7" fill={colors.linkStroke} />
    </marker>
    <filter id="node-shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="1" stdDeviation="1" flood-color="#101828" flood-opacity="0.06"/>
    </filter>
  </defs>

  {@html `<style>
    .node-label { font-family: system-ui, -apple-system, sans-serif; font-size: 14px; font-weight: 600; fill: ${colors.nodeText}; }
    .node-label-bold { font-weight: 700; }
    .node-label-secondary { font-family: ui-monospace, "JetBrains Mono", Menlo, Consolas, monospace; font-size: 10px; font-weight: 400; fill: ${colors.nodeTextSecondary}; }
    .node-icon { color: ${colors.nodeTextSecondary}; }
    .subgraph-label { font-family: system-ui, -apple-system, sans-serif; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
    .link-label { font-family: ui-monospace, "JetBrains Mono", Menlo, Consolas, monospace; font-size: 10px; fill: ${colors.textSecondary}; }
  </style>`}

  <!-- Background (click to deselect) -->
  <rect class="canvas-bg" x="-99999" y="-99999" width="199998" height="199998"
    fill="transparent" style="pointer-events: {interactive ? 'fill' : 'none'};" />

  {#each subgraphList as subgraph (subgraph.id)}
    <SvgSubgraph {subgraph} {colors} {theme} {interactive}
      ondragmove={onsubgraphmove} />
  {/each}

  {#each edgeList as edge (edge.id)}
    <SvgEdge {edge} {colors} selected={selection.has(edge.id)} {interactive}
      onselect={onedgeselect}
      oncontextmenu={(id, e) => onctx?.(id, 'edge', e)} />
  {/each}

  {#each nodeList as node (node.id)}
    <SvgNode {node} {colors} selected={selection.has(node.id)} {interactive}
      ondragstart={onnodedragstart}
      ondragmove={onnodedragmove}
      ondragend={onnodedragend}
      onaddport={onaddport}
      oncontextmenu={(id, e) => onctx?.(id, 'node', e)} />
    {#each portsByNode.get(node.id) ?? [] as port (port.id)}
      <SvgPort {port} {colors} selected={selection.has(port.id)} {interactive}
        linked={linkedPorts.has(port.id)}
        onlinkstart={onlinkstart}
        onlinkend={onlinkend}
        onselect={onportselect}
        oncontextmenu={(id, e) => onctx?.(id, 'port', e)} />
    {/each}
  {/each}

  {#if linkPreview}
    <SvgLinkPreview fromX={linkPreview.fromX} fromY={linkPreview.fromY}
      toX={linkPreview.toX} toY={linkPreview.toY} />
  {/if}
</svg>
