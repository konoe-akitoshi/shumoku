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
  import {
    addPort,
    linkExists,
    moveNode,
    moveSubgraph,
    rebalanceSubgraphs,
    removePort,
    resolveNodePosition,
    routeEdges,
  } from '@shumoku/core'
  import { themeToColors } from '../lib/render-colors'
  import SvgCanvas from './svg/SvgCanvas.svelte'

  interface RendererProps {
    layout: ResolvedLayout
    graph?: { links: Link[] }
    theme?: Theme
    mode?: 'view' | 'edit'
    onchange?: (links: Link[]) => void
    onselect?: (id: string | null, type: string | null) => void
    onlabeledit?: (portId: string, label: string, screenX: number, screenY: number) => void
    oncontextmenu?: (id: string, type: string, screenX: number, screenY: number) => void
  }

  let {
    layout,
    graph,
    theme = undefined,
    mode = 'view',
    onchange,
    onselect,
    onlabeledit,
    oncontextmenu: onctx,
  }: RendererProps = $props()

  const colors = $derived(themeToColors(theme))
  const interactive = $derived(mode === 'edit')

  // Layout state: mutable copies, synced from props via $effect
  let nodes = $state<Map<string, ResolvedNode>>(new Map())
  let ports = $state<Map<string, ResolvedPort>>(new Map())
  let edges = $state<Map<string, ResolvedEdge>>(new Map())
  let subgraphs = $state<Map<string, ResolvedSubgraph>>(new Map())
  let bounds = $state({ x: 0, y: 0, width: 0, height: 0 })
  let links = $state<Link[]>([])

  // Sync from props when layout/graph changes externally (e.g. new layout loaded)
  $effect(() => {
    nodes = new Map(layout.nodes)
    ports = new Map(layout.ports)
    edges = new Map(layout.edges)
    subgraphs = new Map(layout.subgraphs)
    bounds = layout.bounds
  })
  $effect(() => {
    links = graph?.links ? [...graph.links] : []
  })

  // Edit state
  let selection = $state(new Set<string>())
  let linkDrag = $state<{
    fromPortId: string
    fromX: number
    fromY: number
    toX: number
    toY: number
  } | null>(null)
  let svgEl = $state<SVGSVGElement | null>(null)

  const linkedPorts = $derived.by(() => {
    const ids = new Set<string>()
    for (const edge of edges.values()) {
      if (edge.fromPortId) ids.add(edge.fromPortId)
      if (edge.toPortId) ids.add(edge.toPortId)
    }
    return ids
  })

  // Keyboard (d3-zoom makes SVG focusable)
  $effect(() => {
    if (!interactive || !svgEl) return
    const el = svgEl
    el.addEventListener('keydown', handleKeyDown)
    return () => el.removeEventListener('keydown', handleKeyDown)
  })

  // Notify selection changes via callback
  $effect(() => {
    if (selection.size === 0) {
      onselect?.(null, null)
    } else {
      const id = [...selection][0] ?? null
      if (!id) return
      let type: string = 'node'
      if (edges.has(id)) type = 'edge'
      else if (ports.has(id)) type = 'port'
      else if (subgraphs.has(id)) type = 'subgraph'
      onselect?.(id, type)
    }
  })

  // --- Node drag ---
  async function handleNodeDragMove(id: string, x: number, y: number) {
    const result = await moveNode(id, x, y, { nodes, ports, subgraphs }, links)
    if (!result) return
    nodes = result.nodes
    ports = result.ports
    edges = result.edges
    if (result.subgraphs) subgraphs = result.subgraphs
  }

  async function handleAddPort(nodeId: string, side: 'top' | 'bottom' | 'left' | 'right') {
    const result = addPort(nodeId, side, nodes, ports, links)
    if (!result) return
    nodes = result.nodes
    ports = result.ports
    edges = await routeEdges(result.nodes, result.ports, links)
  }

  async function handleSubgraphMove(sgId: string, x: number, y: number) {
    const result = await moveSubgraph(sgId, x, y, { nodes, ports, subgraphs }, links)
    if (!result) return
    nodes = result.nodes
    ports = result.ports
    edges = result.edges
    subgraphs = result.subgraphs
  }

  // --- Link ---
  let linkCleanup: (() => void) | null = null

  function handleLinkStart(portId: string, x: number, y: number) {
    linkDrag = { fromPortId: portId, fromX: x, fromY: y, toX: x, toY: y }
    function onmove(e: PointerEvent) {
      if (!linkDrag || !svgEl) return
      const viewport = svgEl.querySelector('.viewport') as SVGGElement | null
      const ctm = (viewport ?? svgEl).getScreenCTM()
      if (!ctm) return
      const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse())
      linkDrag = { ...linkDrag, toX: p.x, toY: p.y }
    }
    function onup(e: PointerEvent) {
      if ((e.target as Element).closest('.port')) return
      cleanup()
    }
    function cleanup() {
      svgEl?.removeEventListener('pointermove', onmove)
      svgEl?.removeEventListener('pointerup', onup)
      linkDrag = null
      linkCleanup = null
    }
    linkCleanup = cleanup
    svgEl?.addEventListener('pointermove', onmove)
    svgEl?.addEventListener('pointerup', onup)
  }

  function handleLinkEnd(portId: string) {
    if (!linkDrag) return
    const fromPortId = linkDrag.fromPortId
    linkCleanup?.()
    if (fromPortId === portId) return
    const fromPort = ports.get(fromPortId)
    const toPort = ports.get(portId)
    if (fromPort && toPort && fromPort.nodeId === toPort.nodeId) return
    doAddLink(fromPortId, portId)
  }

  async function doAddLink(fromPortId: string, toPortId: string) {
    const fromParts = fromPortId.split(':')
    const toParts = toPortId.split(':')
    let fromNode = fromParts[0] ?? '',
      fromPort = fromParts.slice(1).join(':')
    let toNode = toParts[0] ?? '',
      toPort = toParts.slice(1).join(':')
    if (!fromNode || !fromPort || !toNode || !toPort) return
    if (linkExists(links, fromNode, fromPort, toNode, toPort)) return
    const fromNodeObj = nodes.get(fromNode),
      toNodeObj = nodes.get(toNode)
    if (fromNodeObj && toNodeObj && fromNodeObj.position.y > toNodeObj.position.y) {
      ;[fromNode, toNode] = [toNode, fromNode]
      ;[fromPort, toPort] = [toPort, fromPort]
    }
    links = [
      ...links,
      {
        id: `link-${Date.now()}`,
        from: { node: fromNode, port: fromPort },
        to: { node: toNode, port: toPort },
      },
    ]
    edges = await routeEdges(nodes, ports, links)
    onchange?.(links)
  }

  // --- Selection ---
  function handleEdgeSelect(edgeId: string) {
    selection = new Set([edgeId])
  }
  function handlePortSelect(portId: string) {
    selection = new Set([portId])
  }
  function handleSubgraphSelect(sgId: string) {
    selection = new Set([sgId])
  }
  function handleBackgroundClick() {
    selection = new Set()
  }

  function handleLabelEdit(portId: string, label: string, screenX: number, screenY: number) {
    onlabeledit?.(portId, label, screenX, screenY)
  }

  function handleContextMenu(id: string, type: string, e: MouseEvent) {
    selection = new Set([id])
    onctx?.(id, type, e.clientX, e.clientY)
  }

  // --- Public methods (accessed via mount() return value) ---
  export function addNewNode(opts?: { label?: string; position?: { x: number; y: number } }) {
    const id = `node-${Date.now()}`
    const w = 180,
      h = 80
    const selectedSgId = [...selection].find((sid) => subgraphs.has(sid))
    const parentSg = selectedSgId ? subgraphs.get(selectedSgId) : undefined
    let parent: string | undefined
    let initial: { x: number; y: number }
    if (parentSg) {
      parent = selectedSgId
      initial = opts?.position ?? {
        x: parentSg.bounds.x + parentSg.bounds.width / 2,
        y: parentSg.bounds.y + parentSg.bounds.height / 2,
      }
    } else {
      initial = opts?.position ?? {
        x: bounds.x + bounds.width + 20 + w / 2,
        y: bounds.y + bounds.height / 2,
      }
    }
    const newNodes = new Map(nodes)
    newNodes.set(id, {
      id,
      position: initial,
      size: { width: w, height: h },
      node: { id, label: opts?.label ?? 'New Node', shape: 'rounded', parent },
    })
    const resolved = resolveNodePosition(id, initial.x, initial.y, newNodes, 8, subgraphs)
    const created = newNodes.get(id)
    if (created) newNodes.set(id, { ...created, position: resolved })
    nodes = newNodes
    if (parent) {
      const sg = new Map(subgraphs)
      rebalanceSubgraphs(newNodes, sg, ports)
      subgraphs = sg
    }
    selection = new Set([id])
    return id
  }

  export function addNewSubgraph(opts?: { label?: string; position?: { x: number; y: number } }) {
    const id = `sg-${Date.now()}`
    const w = 200,
      h = 120
    const center = opts?.position ?? {
      x: bounds.x + bounds.width + 20 + w / 2,
      y: bounds.y + bounds.height / 2,
    }
    const sg = new Map(subgraphs)
    sg.set(id, {
      id,
      bounds: { x: center.x - w / 2, y: center.y - h / 2, width: w, height: h },
      subgraph: { id, label: opts?.label ?? 'New Group' },
    })
    rebalanceSubgraphs(nodes, sg, ports)
    subgraphs = sg
    return id
  }

  export function commitLabel(portId: string, newLabel: string) {
    const port = ports.get(portId)
    if (!port || newLabel === port.label) return
    const p = new Map(ports)
    p.set(portId, { ...port, label: newLabel })
    ports = p
  }

  export function getSnapshot() {
    // Unwrap $state proxies into plain Maps for safe serialization
    return {
      layout: {
        nodes: new Map(nodes),
        ports: new Map(ports),
        edges: new Map(edges),
        subgraphs: new Map(subgraphs),
        bounds: { ...bounds },
      },
      links: [...links],
    }
  }

  // --- Delete ---
  export function deleteById(id: string) {
    if (nodes.has(id)) {
      const n = new Map(nodes)
      n.delete(id)
      nodes = n
      // Remove ports belonging to this node
      const p = new Map(ports)
      for (const [portId, port] of ports) {
        if (port.nodeId === id) p.delete(portId)
      }
      ports = p
      // Remove links connected to this node
      links = links.filter((l) => {
        const from = typeof l.from === 'string' ? l.from : l.from.node
        const to = typeof l.to === 'string' ? l.to : l.to.node
        return from !== id && to !== id
      })
    } else if (edges.has(id)) {
      const edge = edges.get(id)
      if (edge?.link?.id) links = links.filter((l) => l.id !== edge.link?.id)
    } else if (ports.has(id)) {
      const result = removePort(id, nodes, ports, links)
      if (result) {
        nodes = result.nodes
        ports = result.ports
        links = result.links
      }
    } else if (subgraphs.has(id)) {
      const sg = new Map(subgraphs)
      sg.delete(id)
      subgraphs = sg
    }
    selection = new Set()
    routeEdges(nodes, ports, links).then((e) => {
      edges = e
    })
    onchange?.(links)
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Delete' || e.key === 'Backspace') {
      for (const id of selection) {
        deleteById(id)
      }
    }
    if (e.key === 'Escape') {
      selection = new Set()
      linkDrag = null
    }
  }
</script>

<div style="width: 100%; height: 100%; outline: none;">
  <SvgCanvas
    {nodes}
    {ports}
    {edges}
    {subgraphs}
    {bounds}
    {colors}
    {theme}
    {interactive}
    {selection}
    {linkedPorts}
    linkPreview={linkDrag}
    bind:svgEl
    onnodedragmove={handleNodeDragMove}
    onaddport={handleAddPort}
    onlinkstart={handleLinkStart}
    onlinkend={handleLinkEnd}
    onedgeselect={handleEdgeSelect}
    onportselect={handlePortSelect}
    onlabeledit={handleLabelEdit}
    onsubgraphselect={handleSubgraphSelect}
    onsubgraphmove={handleSubgraphMove}
    oncontextmenu={handleContextMenu}
    onbackgroundclick={handleBackgroundClick}
  />
</div>
