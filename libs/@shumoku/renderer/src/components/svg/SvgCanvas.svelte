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
    selection = new Set<string>(),
    highlightedNodes = new Set<string>(),
    linkPreview = null,
    hidePortLabels = false,
    svgEl = $bindable<SVGSVGElement | null>(null),
  }: {
    nodes: Map<string, ResolvedNode>
    ports: Map<string, ResolvedPort>
    edges: Map<string, ResolvedEdge>
    subgraphs: Map<string, ResolvedSubgraph>
    bounds: { x: number; y: number; width: number; height: number }
    colors: RenderColors
    theme?: Theme
    selection?: Set<string>
    highlightedNodes?: Set<string>
    linkPreview?: { fromX: number; fromY: number; toX: number; toY: number } | null
    hidePortLabels?: boolean
    svgEl?: SVGSVGElement | null
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
      if (list) {
        list.push(port)
      } else {
        map.set(port.nodeId, [port])
      }
    }
    return map
  })
</script>

<svg
  bind:this={svgEl}
  xmlns="http://www.w3.org/2000/svg"
  viewBox={viewBox}
  style="width: 100%; height: 100%; user-select: none; pointer-events: none; background: transparent;"
>
  <!-- Defs: same as svg.ts renderDefs -->
  <defs>
    <marker id="arrow" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
      <polygon points="0 0, 10 3.5, 0 7" fill={colors.linkStroke} />
    </marker>
    <marker id="arrow-red" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
      <polygon points="0 0, 10 3.5, 0 7" fill="#dc2626" />
    </marker>
    <filter id="node-shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="1" stdDeviation="1" flood-color="#101828" flood-opacity="0.06"/>
    </filter>
  </defs>

  <!-- Styles: same as svg.ts renderStyles -->
  {@html `<style>
    .node-label { font-family: system-ui, -apple-system, sans-serif; font-size: 14px; font-weight: 600; fill: ${colors.nodeText}; }
    .node-label-bold { font-weight: 700; }
    .node-label-secondary { font-family: ui-monospace, "JetBrains Mono", Menlo, Consolas, monospace; font-size: 10px; font-weight: 400; fill: ${colors.nodeTextSecondary}; }
    .node-icon { color: ${colors.nodeTextSecondary}; }
    .subgraph-label { font-family: system-ui, -apple-system, sans-serif; font-size: 11px; font-weight: 700; fill: ${colors.subgraphText}; text-transform: uppercase; letter-spacing: 0.05em; }
    .link-label { font-family: ui-monospace, "JetBrains Mono", Menlo, Consolas, monospace; font-size: 10px; fill: ${colors.textSecondary}; }
    .endpoint-label { font-family: ui-monospace, "JetBrains Mono", Menlo, Consolas, monospace; font-size: 9px; fill: ${colors.nodeText}; }
  </style>`}

  {#each subgraphList as subgraph (subgraph.id)}
    <SvgSubgraph {subgraph} {colors} {theme} />
  {/each}

  {#each edgeList as edge (edge.id)}
    <SvgEdge {edge} {colors} selected={selection.has(edge.id)} />
  {/each}

  {#each nodeList as node (node.id)}
    <SvgNode {node} {colors} selected={selection.has(node.id)} highlighted={highlightedNodes.has(node.id)} />
    {#each portsByNode.get(node.id) ?? [] as port (port.id)}
      <SvgPort {port} {colors} hideLabel={hidePortLabels} selected={selection.has(port.id)} />
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
</svg>
