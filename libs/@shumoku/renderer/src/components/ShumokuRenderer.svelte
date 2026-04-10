<script lang="ts">
  import type {
    Link,
    ResolvedEdge,
    ResolvedLayout,
    ResolvedNode,
    ResolvedPort,
    ResolvedSubgraph,
    Theme,
  } from '@shumoku/core'
  import { addPort, linkExists, moveNode, movePort, moveSubgraph, removePort, routeEdges } from '@shumoku/core'
  import { createEditState } from '../lib/edit-state.svelte'
  import { themeToColors } from '../lib/render-colors'
  import EditOverlay from './edit/EditOverlay.svelte'
  import SvgCanvas from './svg/SvgCanvas.svelte'

  let {
    layout: initialLayout,
    graph: initialGraph,
    theme,
    mode = 'view',
    onchange,
    onselect,
  }: {
    layout: ResolvedLayout
    graph?: { links: Link[] }
    theme?: Theme
    mode?: 'view' | 'edit'
    onchange?: (links: Link[]) => void
    onselect?: (id: string | null, type: string | null) => void
  } = $props()

  const colors = $derived(themeToColors(theme))

  // Layout state
  let nodes = $state<Map<string, ResolvedNode>>(new Map(initialLayout.nodes))
  let ports = $state<Map<string, ResolvedPort>>(new Map(initialLayout.ports))
  let edges = $state<Map<string, ResolvedEdge>>(new Map(initialLayout.edges))
  let subgraphs = $state<Map<string, ResolvedSubgraph>>(new Map(initialLayout.subgraphs))
  let bounds = $state(initialLayout.bounds)
  let links = $state<Link[]>(initialGraph?.links ? [...initialGraph.links] : [])

  // Edit state
  const editState = createEditState()

  // Notify host when selection changes
  $effect(() => {
    const sel = editState.selection
    if (sel.size === 0) {
      onselect?.(null, null)
    } else {
      const id = [...sel][0] ?? null
      if (!id) return
      let type: string = 'node'
      if (edges.has(id)) type = 'edge'
      else if (ports.has(id)) type = 'port'
      onselect?.(id, type)
    }
  })

  // Element refs
  let svgEl = $state<SVGSVGElement | null>(null)
  let containerEl = $state<HTMLDivElement | null>(null)

  // --- Handlers ---

  async function handleNodeMove(id: string, x: number, y: number) {
    const result = await moveNode(id, x, y, { nodes, ports, subgraphs }, links)
    if (!result) return
    nodes = result.nodes
    ports = result.ports
    edges = result.edges
    if (result.subgraphs) subgraphs = result.subgraphs
  }

  async function handleSubgraphMove(sgId: string, x: number, y: number) {
    const result = await moveSubgraph(sgId, x, y, { nodes, ports, subgraphs }, links)
    if (!result) return
    nodes = result.nodes
    ports = result.ports
    edges = result.edges
    subgraphs = result.subgraphs
  }

  async function handleAddPort(nodeId: string, side: 'top' | 'bottom' | 'left' | 'right') {
    const node = nodes.get(nodeId)
    if (!node) return

    const result = addPort(nodeId, side, nodes, ports, links)
    if (!result) return

    nodes = result.nodes
    ports = result.ports
    edges = await routeEdges(result.nodes, result.ports, links)
  }

  function handleLinkStart(portId: string, x: number, y: number) {
    editState.startLinkDrag(portId, x, y)
  }

  function handleLinkEnd(portId: string) {
    if (!editState.linkDrag) return
    const fromPortId = editState.linkDrag.fromPortId
    editState.endLinkDrag()
    if (fromPortId === portId) return
    const fromPort = ports.get(fromPortId)
    const toPort = ports.get(portId)
    if (fromPort && toPort && fromPort.nodeId === toPort.nodeId) return
    doAddLink(fromPortId, portId)
  }

  async function handleLinkDropOnNode(nodeId: string) {
    if (!editState.linkDrag) return
    const fromPortId = editState.linkDrag.fromPortId
    editState.endLinkDrag()

    const fromPort = ports.get(fromPortId)
    if (fromPort && fromPort.nodeId === nodeId) return

    const result = addPort(nodeId, 'top', nodes, ports, links)
    if (!result) return

    nodes = result.nodes
    ports = result.ports
    await doAddLink(fromPortId, result.portId)
  }

  async function doAddLink(fromPortId: string, toPortId: string) {
    const fromParts = fromPortId.split(':')
    const toParts = toPortId.split(':')
    let fromNode = fromParts[0] ?? ''
    let fromPort = fromParts.slice(1).join(':')
    let toNode = toParts[0] ?? ''
    let toPort = toParts.slice(1).join(':')
    if (!fromNode || !fromPort || !toNode || !toPort) return
    if (linkExists(links, fromNode, fromPort, toNode, toPort)) return

    // Normalize direction: upper node = from, lower node = to
    // This ensures the source pin direction aligns with the natural flow
    const fromNodeObj = nodes.get(fromNode)
    const toNodeObj = nodes.get(toNode)
    if (fromNodeObj && toNodeObj && fromNodeObj.position.y > toNodeObj.position.y) {
      ;[fromNode, toNode] = [toNode, fromNode]
      ;[fromPort, toPort] = [toPort, fromPort]
    }

    const newLink: Link = {
      id: `link-${Date.now()}`,
      from: { node: fromNode, port: fromPort },
      to: { node: toNode, port: toPort },
    }
    links = [...links, newLink]
    edges = await routeEdges(nodes, ports, links)
    onchange?.(links)
  }

  function handleLabelCommit(portId: string, value: string) {
    const port = ports.get(portId)
    if (!port || value === port.label) return
    const newPorts = new Map(ports)
    newPorts.set(portId, { ...port, label: value })
    ports = newPorts
  }

  async function handlePortMove(portId: string, svgX: number, svgY: number) {
    const result = movePort(portId, svgX, svgY, nodes, ports)
    if (!result) return
    nodes = result.nodes
    ports = result.ports
    edges = await routeEdges(result.nodes, result.ports, links)
  }

  async function handleDelete(targetId: string, targetType: 'node' | 'port' | 'edge') {
    if (targetType === 'edge') {
      const edge = edges.get(targetId)
      if (!edge) return
      links = links.filter((l) => l.id !== edge.link?.id)
      edges = await routeEdges(nodes, ports, links)
      onchange?.(links)
    } else if (targetType === 'port') {
      const result = removePort(targetId, nodes, ports, links)
      if (!result) return
      nodes = result.nodes
      ports = result.ports
      links = result.links
      edges = await routeEdges(result.nodes, result.ports, result.links)
      onchange?.(result.links)
    }
  }
</script>

<div
  bind:this={containerEl}
  style="position: relative; width: 100%; height: 100%;"
>
  <SvgCanvas
    {nodes}
    {ports}
    {edges}
    {subgraphs}
    {bounds}
    {colors}
    {theme}
    selection={editState.selection}
    highlightedNodes={editState.highlightedNodes}
    linkPreview={editState.linkDrag}
    hidePortLabels={false}
    bind:svgEl
  />

  {#if mode === 'edit' && svgEl && containerEl}
    <EditOverlay
      svg={svgEl}
      container={containerEl}
      {editState}
      {nodes}
      {ports}
      {edges}
      subgraphs={subgraphs}
      ondragmove={handleNodeMove}
      onsubgraphmove={handleSubgraphMove}
      onaddport={handleAddPort}
      onlinkstart={handleLinkStart}
      onlinkend={handleLinkEnd}
      onlinkdrop={handleLinkDropOnNode}
      onlabelcommit={handleLabelCommit}
      onportmove={handlePortMove}
      ondelete={handleDelete}
    />
  {/if}
</div>
