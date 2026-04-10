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
  import { addPort, linkExists, moveNode, moveSubgraph, removePort, routeEdges } from '@shumoku/core'
  import { themeToColors } from '../lib/render-colors'
  import SvgCanvas from './svg/SvgCanvas.svelte'

  let {
    layout: initialLayout,
    graph: initialGraph,
    theme,
    mode = 'view',
    viewBox: viewBoxProp,
    onchange,
    onselect,
    oncontextmenu: onctx,
  }: {
    layout: ResolvedLayout
    graph?: { links: Link[] }
    theme?: Theme
    mode?: 'view' | 'edit'
    viewBox?: string
    onchange?: (links: Link[]) => void
    onselect?: (id: string | null, type: string | null) => void
    oncontextmenu?: (id: string, type: string, screenX: number, screenY: number) => void
  } = $props()

  const colors = $derived(themeToColors(theme))
  const interactive = $derived(mode === 'edit')

  // Layout state
  let nodes = $state<Map<string, ResolvedNode>>(new Map(initialLayout.nodes))
  let ports = $state<Map<string, ResolvedPort>>(new Map(initialLayout.ports))
  let edges = $state<Map<string, ResolvedEdge>>(new Map(initialLayout.edges))
  let subgraphs = $state<Map<string, ResolvedSubgraph>>(new Map(initialLayout.subgraphs))
  let bounds = $state(initialLayout.bounds)
  let links = $state<Link[]>(initialGraph?.links ? [...initialGraph.links] : [])

  // Edit state
  let selection = $state(new Set<string>())
  let linkDrag = $state<{ fromPortId: string; fromX: number; fromY: number; toX: number; toY: number } | null>(null)
  let svgEl = $state<SVGSVGElement | null>(null)

  // Linked ports set
  const linkedPorts = $derived.by(() => {
    const ids = new Set<string>()
    for (const edge of edges.values()) {
      if (edge.fromPortId) ids.add(edge.fromPortId)
      if (edge.toPortId) ids.add(edge.toPortId)
    }
    return ids
  })

  // Notify selection changes
  $effect(() => {
    if (selection.size === 0) {
      onselect?.(null, null)
    } else {
      const id = [...selection][0] ?? null
      if (!id) return
      let type: string = 'node'
      if (edges.has(id)) type = 'edge'
      else if (ports.has(id)) type = 'port'
      onselect?.(id, type)
    }
  })

  // --- Node handlers ---
  function handleNodeDragStart(id: string) { selection = new Set([id]) }

  async function handleNodeDragMove(id: string, x: number, y: number) {
    const result = await moveNode(id, x, y, { nodes, ports, subgraphs }, links)
    if (!result) return
    nodes = result.nodes
    ports = result.ports
    edges = result.edges
    if (result.subgraphs) subgraphs = result.subgraphs
  }

  function handleNodeDragEnd(_id: string) {}

  async function handleAddPort(nodeId: string, side: 'top' | 'bottom' | 'left' | 'right') {
    const result = addPort(nodeId, side, nodes, ports, links)
    if (!result) return
    nodes = result.nodes
    ports = result.ports
    edges = await routeEdges(result.nodes, result.ports, links)
  }

  // --- Subgraph handler ---
  async function handleSubgraphMove(sgId: string, x: number, y: number) {
    const result = await moveSubgraph(sgId, x, y, { nodes, ports, subgraphs }, links)
    if (!result) return
    nodes = result.nodes
    ports = result.ports
    edges = result.edges
    subgraphs = result.subgraphs
  }

  // --- Link handlers ---
  function handleLinkStart(portId: string, x: number, y: number) {
    linkDrag = { fromPortId: portId, fromX: x, fromY: y, toX: x, toY: y }
    // Track mouse on SVG for preview line
    function onmove(e: PointerEvent) {
      if (!linkDrag || !svgEl) return
      const ctm = svgEl.getScreenCTM()
      if (!ctm) return
      const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse())
      linkDrag = { ...linkDrag, toX: p.x, toY: p.y }
    }
    svgEl?.addEventListener('pointermove', onmove)
    svgEl?.addEventListener('pointerup', () => {
      svgEl?.removeEventListener('pointermove', onmove)
      if (linkDrag) linkDrag = null
    }, { once: true })
  }

  function handleLinkEnd(portId: string) {
    if (!linkDrag) return
    const fromPortId = linkDrag.fromPortId
    linkDrag = null
    if (fromPortId === portId) return
    const fromPort = ports.get(fromPortId)
    const toPort = ports.get(portId)
    if (fromPort && toPort && fromPort.nodeId === toPort.nodeId) return
    doAddLink(fromPortId, portId)
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

    const fromNodeObj = nodes.get(fromNode)
    const toNodeObj = nodes.get(toNode)
    if (fromNodeObj && toNodeObj && fromNodeObj.position.y > toNodeObj.position.y) {
      ;[fromNode, toNode] = [toNode, fromNode]
      ;[fromPort, toPort] = [toPort, fromPort]
    }

    links = [...links, { id: `link-${Date.now()}`, from: { node: fromNode, port: fromPort }, to: { node: toNode, port: toPort } }]
    edges = await routeEdges(nodes, ports, links)
    onchange?.(links)
  }

  // --- Selection handlers ---
  function handleEdgeSelect(edgeId: string) { selection = new Set([edgeId]) }
  function handlePortSelect(portId: string) { selection = new Set([portId]) }
  function handleBackgroundClick() { selection = new Set() }

  // --- Context menu → emit to parent (React handles the menu UI) ---
  function handleContextMenu(id: string, type: string, e: MouseEvent) {
    selection = new Set([id])
    onctx?.(id, type, e.clientX, e.clientY)
  }

  // --- Delete (keyboard) ---
  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Delete' || e.key === 'Backspace') {
      for (const id of selection) {
        if (edges.has(id)) {
          const edge = edges.get(id)
          if (edge?.link?.id) {
            links = links.filter((l) => l.id !== edge.link?.id)
          }
        } else if (ports.has(id)) {
          const result = removePort(id, nodes, ports, links)
          if (result) {
            nodes = result.nodes
            ports = result.ports
            links = result.links
          }
        }
      }
      routeEdges(nodes, ports, links).then((e) => { edges = e })
      selection = new Set()
      onchange?.(links)
    }
    if (e.key === 'Escape') {
      selection = new Set()
      linkDrag = null
    }
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  style="width: 100%; height: 100%; outline: none;"
  tabindex="-1"
  onkeydown={interactive ? handleKeyDown : undefined}
>
  <SvgCanvas
    {nodes} {ports} {edges} {subgraphs} {bounds} {colors} {theme}
    {interactive} {selection} {linkedPorts}
    linkPreview={linkDrag}
    viewBoxOverride={viewBoxProp}
    bind:svgEl
    onnodedragstart={handleNodeDragStart}
    onnodedragmove={handleNodeDragMove}
    onnodedragend={handleNodeDragEnd}
    onaddport={handleAddPort}
    onlinkstart={handleLinkStart}
    onlinkend={handleLinkEnd}
    onedgeselect={handleEdgeSelect}
    onportselect={handlePortSelect}
    onsubgraphmove={handleSubgraphMove}
    oncontextmenu={handleContextMenu}
    onbackgroundclick={handleBackgroundClick}
  />
</div>
