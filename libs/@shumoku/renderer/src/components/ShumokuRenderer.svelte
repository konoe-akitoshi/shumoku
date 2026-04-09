<script lang="ts">
  import type {
    Link,
    ResolvedEdge,
    ResolvedLayout,
    ResolvedNode,
    ResolvedPort,
    ResolvedSubgraph,
  } from '@shumoku/core'
  import { moveNode } from '@shumoku/core'
  import ShumokuEdge from './ShumokuEdge.svelte'
  import ShumokuNode from './ShumokuNode.svelte'
  import ShumokuPort from './ShumokuPort.svelte'
  import ShumokuSubgraph from './ShumokuSubgraph.svelte'

  let {
    layout: initialLayout,
    graph,
  }: {
    layout: ResolvedLayout
    graph?: { links: Link[] }
  } = $props()

  let nodes = $state<Map<string, ResolvedNode>>(new Map(initialLayout.nodes))
  let ports = $state<Map<string, ResolvedPort>>(new Map(initialLayout.ports))
  let edges = $state<Map<string, ResolvedEdge>>(new Map(initialLayout.edges))
  let subgraphs = $state<Map<string, ResolvedSubgraph>>(new Map(initialLayout.subgraphs))
  let bounds = $state(initialLayout.bounds)

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

  async function handleNodeMove(id: string, x: number, y: number) {
    if (!graph?.links) return

    const result = await moveNode(id, x, y, { nodes, ports }, graph.links)
    if (!result) return

    nodes = result.nodes
    ports = result.ports
    edges = result.edges
  }
</script>

<svg
  xmlns="http://www.w3.org/2000/svg"
  {viewBox}
  style="width: 100%; height: 100%; user-select: none;"
>
  {#each subgraphList as subgraph (subgraph.id)}
    <ShumokuSubgraph {subgraph} />
  {/each}

  {#each edgeList as edge (edge.id)}
    <ShumokuEdge {edge} />
  {/each}

  {#each nodeList as node (node.id)}
    <ShumokuNode {node} ondragmove={handleNodeMove} />
    {#each portsByNode().get(node.id) ?? [] as port (port.id)}
      <ShumokuPort {port} />
    {/each}
  {/each}
</svg>
