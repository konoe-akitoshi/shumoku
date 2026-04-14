<script lang="ts">
  import type {
    DeviceType,
    Link,
    NodeShape,
    ResolvedEdge,
    ResolvedLayout,
    ResolvedNode,
    ResolvedPort,
    ResolvedSubgraph,
    Theme,
  } from '@shumoku/core'
  import {
    addPort,
    collectObstacles,
    computeNodeSize,
    linkExists,
    moveNode,
    moveSubgraph,
    rebalanceSubgraphs,
    removePort,
    resolvePosition,
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

  // =========================================================================
  // Layout state (mutable copies, synced from props via $effect)
  // =========================================================================

  let nodes = $state<Map<string, ResolvedNode>>(new Map())
  let ports = $state<Map<string, ResolvedPort>>(new Map())
  let edges = $state<Map<string, ResolvedEdge>>(new Map())
  let subgraphs = $state<Map<string, ResolvedSubgraph>>(new Map())
  let bounds = $state({ x: 0, y: 0, width: 0, height: 0 })
  let links = $state<Link[]>([])

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

  // =========================================================================
  // Edit state
  // =========================================================================

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

  // =========================================================================
  // Coordinate helpers
  // =========================================================================

  /** Get the SVG viewport's inverse screen CTM (for screen → SVG conversion) */
  function getViewportInverseCTM(): DOMMatrix | null {
    if (!svgEl) return null
    const viewport = svgEl.querySelector('.viewport') as SVGGraphicsElement | null
    return (viewport ?? svgEl).getScreenCTM()?.inverse() ?? null
  }

  /** Convert screen (clientX/Y) coordinates to SVG coordinates */
  export function screenToSvg(screenX: number, screenY: number): { x: number; y: number } {
    const ctm = getViewportInverseCTM()
    if (!ctm) return { x: screenX, y: screenY }
    const pt = new DOMPoint(screenX, screenY).matrixTransform(ctm)
    return { x: pt.x, y: pt.y }
  }

  // =========================================================================
  // Keyboard + selection notifications
  // =========================================================================

  $effect(() => {
    if (!interactive || !svgEl) return
    const el = svgEl
    el.addEventListener('keydown', handleKeyDown)
    return () => el.removeEventListener('keydown', handleKeyDown)
  })

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

  function handleSelect(id: string) {
    selection = new Set([id])
  }
  function handleBackgroundClick() {
    selection = new Set()
  }
  function handleContextMenu(id: string, type: string, e: MouseEvent) {
    selection = new Set([id])
    onctx?.(id, type, e.clientX, e.clientY)
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Delete' || e.key === 'Backspace') {
      for (const id of selection) deleteById(id)
    }
    if (e.key === 'Escape') {
      selection = new Set()
      linkDrag = null
    }
  }

  // =========================================================================
  // Drag (unified for nodes and subgraphs)
  // =========================================================================

  async function handleDragMove(id: string, x: number, y: number) {
    const state = { nodes, ports, subgraphs }
    const result = nodes.has(id)
      ? await moveNode(id, x, y, state, links)
      : subgraphs.has(id)
        ? await moveSubgraph(id, x, y, state, links)
        : null
    if (!result) return
    nodes = result.nodes
    ports = result.ports
    edges = result.edges
    if (result.subgraphs) subgraphs = result.subgraphs
  }

  // =========================================================================
  // Add element (shared: parent detection → collision resolve → rebalance)
  // =========================================================================

  function resolveParentAndPosition(
    position: { x: number; y: number } | undefined,
    w: number,
  ): { parent: string | undefined; initial: { x: number; y: number } } {
    const selectedSgId = [...selection].find((sid) => subgraphs.has(sid))
    const parentSg = selectedSgId ? subgraphs.get(selectedSgId) : undefined
    if (parentSg) {
      return {
        parent: selectedSgId,
        initial: position ?? {
          x: parentSg.bounds.x + parentSg.bounds.width / 2,
          y: parentSg.bounds.y + parentSg.bounds.height / 2,
        },
      }
    }
    return {
      parent: undefined,
      initial: position ?? {
        x: bounds.x + bounds.width + 20 + w / 2,
        y: bounds.y + bounds.height / 2,
      },
    }
  }

  function finalizeAdd(id: string, updatedSubgraphs: Map<string, ResolvedSubgraph>) {
    rebalanceSubgraphs(nodes, updatedSubgraphs, ports)
    subgraphs = updatedSubgraphs
    selection = new Set([id])
  }

  export function addNewNode(opts?: {
    label?: string
    type?: DeviceType
    shape?: NodeShape
    position?: { x: number; y: number }
  }) {
    const id = `node-${Date.now()}`
    const label = opts?.label ?? 'New Node'
    const { width: w, height: h } = computeNodeSize({ label, type: opts?.type })
    const { parent, initial } = resolveParentAndPosition(opts?.position, w)
    const obstacles = collectObstacles(id, parent, nodes, subgraphs)
    const pos = resolvePosition({ x: initial.x, y: initial.y, w, h }, obstacles)

    const n = new Map(nodes)
    n.set(id, {
      id,
      position: pos,
      size: { width: w, height: h },
      node: { id, label, type: opts?.type, shape: opts?.shape ?? 'rounded', parent },
    })
    nodes = n
    finalizeAdd(id, new Map(subgraphs))
    return id
  }

  export function addNewSubgraph(opts?: { label?: string; position?: { x: number; y: number } }) {
    const id = `sg-${Date.now()}`
    const w = 200
    const h = 120
    const { parent, initial } = resolveParentAndPosition(opts?.position, w)
    const obstacles = collectObstacles(id, parent, nodes, subgraphs)
    const pos = resolvePosition({ x: initial.x, y: initial.y, w, h }, obstacles)

    const sg = new Map(subgraphs)
    sg.set(id, {
      id,
      bounds: { x: pos.x - w / 2, y: pos.y - h / 2, width: w, height: h },
      subgraph: { id, label: opts?.label ?? 'New Group', parent },
    })
    nodes = new Map(nodes) // trigger reactivity for rebalance
    finalizeAdd(id, sg)
    return id
  }

  // =========================================================================
  // Delete (unified, recursive for subgraphs)
  // =========================================================================

  export function deleteById(id: string) {
    if (nodes.has(id)) {
      const n = new Map(nodes)
      const p = new Map(ports)
      n.delete(id)
      for (const [portId, port] of p) {
        if (port.nodeId === id) p.delete(portId)
      }
      nodes = n
      ports = p
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
      // Collect all descendants first, then delete in one pass
      const toDeleteNodes = new Set<string>()
      const toDeleteSgs = new Set<string>()
      function collect(sgId: string) {
        toDeleteSgs.add(sgId)
        for (const [nid, n] of nodes) {
          if (n.node.parent === sgId) toDeleteNodes.add(nid)
        }
        for (const [cid, c] of subgraphs) {
          if (c.subgraph.parent === sgId) collect(cid)
        }
      }
      collect(id)

      const n = new Map(nodes)
      const p = new Map(ports)
      const sg = new Map(subgraphs)
      for (const nid of toDeleteNodes) {
        n.delete(nid)
        for (const [portId, port] of p) {
          if (port.nodeId === nid) p.delete(portId)
        }
      }
      for (const sgId of toDeleteSgs) sg.delete(sgId)
      nodes = n
      ports = p
      subgraphs = sg
      links = links.filter((l) => {
        const from = typeof l.from === 'string' ? l.from : l.from.node
        const to = typeof l.to === 'string' ? l.to : l.to.node
        return !toDeleteNodes.has(from) && !toDeleteNodes.has(to)
      })
    }

    selection = new Set()
    routeEdges(nodes, ports, links).then((e) => {
      edges = e
    })
    onchange?.(links)
  }

  // =========================================================================
  // Copy info (works for nodes and subgraphs)
  // =========================================================================

  export function getElementInfo(id: string) {
    const node = nodes.get(id)
    if (node) {
      return {
        kind: 'node' as const,
        label: node.node.label ?? 'Node',
        shape: node.node.shape,
        type: node.node.type,
      }
    }
    const sg = subgraphs.get(id)
    if (sg) {
      return { kind: 'subgraph' as const, label: sg.subgraph.label ?? 'Group' }
    }
    return null
  }

  // =========================================================================
  // Port operations
  // =========================================================================

  async function handleAddPort(nodeId: string, side: 'top' | 'bottom' | 'left' | 'right') {
    const result = addPort(nodeId, side, nodes, ports, links)
    if (!result) return
    nodes = result.nodes
    ports = result.ports
    edges = await routeEdges(result.nodes, result.ports, links)
  }

  export function commitLabel(portId: string, newLabel: string) {
    const port = ports.get(portId)
    if (!port || newLabel === port.label) return
    const p = new Map(ports)
    p.set(portId, { ...port, label: newLabel })
    ports = p
  }

  // =========================================================================
  // Link operations
  // =========================================================================

  let linkCleanup: (() => void) | null = null

  function handleLinkStart(portId: string, _x: number, _y: number) {
    const port = ports.get(portId)
    if (!port) return
    linkDrag = {
      fromPortId: portId,
      fromX: port.absolutePosition.x,
      fromY: port.absolutePosition.y,
      toX: port.absolutePosition.x,
      toY: port.absolutePosition.y,
    }
    function onmove(e: PointerEvent) {
      if (!linkDrag) return
      const svgPt = screenToSvg(e.clientX, e.clientY)
      linkDrag = { ...linkDrag, toX: svgPt.x, toY: svgPt.y }
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

  // =========================================================================
  // Snapshot
  // =========================================================================

  export function getSnapshot() {
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
    ondragmove={handleDragMove}
    onselect={handleSelect}
    onaddport={handleAddPort}
    onlinkstart={handleLinkStart}
    onlinkend={handleLinkEnd}
    {onlabeledit}
    oncontextmenu={handleContextMenu}
    onbackgroundclick={handleBackgroundClick}
  />
</div>
