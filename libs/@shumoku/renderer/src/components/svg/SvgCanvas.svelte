<script lang="ts">
  import type { ResolvedEdge, ResolvedNode, ResolvedPort, ResolvedSubgraph } from '@shumoku/core'
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

  const portsByNode = $derived(() => {
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
  style="width: 100%; height: 100%; user-select: none; pointer-events: none;"
>
  {#each subgraphList as subgraph (subgraph.id)}
    <SvgSubgraph {subgraph} />
  {/each}

  {#each edgeList as edge (edge.id)}
    <SvgEdge {edge} selected={selection.has(edge.id)} />
  {/each}

  {#each nodeList as node (node.id)}
    <SvgNode {node} selected={selection.has(node.id)} highlighted={highlightedNodes.has(node.id)} />
    {#each portsByNode().get(node.id) ?? [] as port (port.id)}
      <SvgPort {port} hideLabel={hidePortLabels} selected={selection.has(port.id)} />
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
