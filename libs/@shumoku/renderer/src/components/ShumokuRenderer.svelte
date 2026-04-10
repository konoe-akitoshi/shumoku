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

  let {
    layout: initialLayout,
    graph: initialGraph,
    theme,
    mode = 'view',
    onchange,
    onselect,
    oncontextmenu: onctx,
  }: {
    layout: ResolvedLayout
    graph?: { links: Link[] }
    theme?: Theme
    mode?: 'view' | 'edit'
    onchange?: (links: Link[]) => void
    onselect?: (id: string | null, type: string | null) => void
    oncontextmenu?: (id: string, type: string, screenX: number, screenY: number) => void
  } = $props()

  let currentTheme = $state(theme)
  const colors = $derived(themeToColors(currentTheme))
  let currentMode = $state(mode)
  const interactive = $derived(currentMode === 'edit')

  // Layout state
  let nodes = $state<Map<string, ResolvedNode>>(new Map(initialLayout.nodes))
  let ports = $state<Map<string, ResolvedPort>>(new Map(initialLayout.ports))
  let edges = $state<Map<string, ResolvedEdge>>(new Map(initialLayout.edges))
  let subgraphs = $state<Map<string, ResolvedSubgraph>>(new Map(initialLayout.subgraphs))
  let bounds = $state(initialLayout.bounds)
  let links = $state<Link[]>(initialGraph?.links ? [...initialGraph.links] : [])

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

  // Linked ports set
  const linkedPorts = $derived.by(() => {
    const ids = new Set<string>()
    for (const edge of edges.values()) {
      if (edge.fromPortId) ids.add(edge.fromPortId)
      if (edge.toPortId) ids.add(edge.toPortId)
    }
    return ids
  })

  // Keyboard events on SVG (d3-zoom makes it focusable)
  $effect(() => {
    if (!interactive || !svgEl) return
    const el = svgEl
    el.addEventListener('keydown', handleKeyDown)
    return () => el.removeEventListener('keydown', handleKeyDown)
  })

  // Listen for mode changes from WebComponent (without remount)
  $effect(() => {
    if (!svgEl) return
    const root = svgEl.getRootNode() as ShadowRoot | Document
    const host = (root as ShadowRoot).host
    if (!host) return
    function onModeChange(e: Event) {
      const newMode = (e as CustomEvent).detail?.mode
      if (newMode === 'edit' || newMode === 'view') {
        currentMode = newMode
      }
    }
    function onThemeChange(e: Event) {
      const newTheme = (e as CustomEvent).detail?.theme
      if (newTheme) currentTheme = newTheme
    }
    host.addEventListener('shumoku-mode-change', onModeChange)
    host.addEventListener('shumoku-theme-change', onThemeChange)
    return () => {
      host.removeEventListener('shumoku-mode-change', onModeChange)
      host.removeEventListener('shumoku-theme-change', onThemeChange)
    }
  })

  // Snapshot: export current layout state on request
  $effect(() => {
    if (!svgEl) return
    const root = svgEl.getRootNode() as ShadowRoot | Document
    const host = (root as ShadowRoot).host
    if (!host) return
    function onSnapshot(e: Event) {
      const layout = { nodes, ports, edges, subgraphs, bounds }
      host.dispatchEvent(
        new CustomEvent('shumoku-snapshot', {
          detail: { layout, links },
          bubbles: true,
          composed: true,
        }),
      )
    }
    host.addEventListener('shumoku-get-snapshot', onSnapshot)
    return () => host.removeEventListener('shumoku-get-snapshot', onSnapshot)
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
      else if (subgraphs.has(id)) type = 'subgraph'
      onselect?.(id, type)
    }
  })

  // --- Node drag (called by d3-drag via SvgCanvas) ---
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
      const target = e.target as Element
      if (target.closest('.port')) return // Port handles its own pointerup
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
    linkCleanup?.() // Clean up SVG listeners
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

  // --- Add node/subgraph (via custom events from host) ---
  $effect(() => {
    if (!svgEl) return
    const root = svgEl.getRootNode() as ShadowRoot | Document
    const host = (root as ShadowRoot).host

    function onAddNode(e: Event) {
      const { label, position } = (e as CustomEvent).detail ?? {}
      const id = `node-${Date.now()}`
      const w = 180
      const h = 80

      // If a subgraph is selected, add node inside it
      const selectedSgId = [...selection].find((sid) => subgraphs.has(sid))
      const parentSg = selectedSgId ? subgraphs.get(selectedSgId) : undefined
      let parent: string | undefined
      let initial: { x: number; y: number }

      if (parentSg) {
        parent = selectedSgId
        initial = position ?? {
          x: parentSg.bounds.x + parentSg.bounds.width / 2,
          y: parentSg.bounds.y + parentSg.bounds.height / 2,
        }
      } else {
        initial = position ?? {
          x: bounds.x + bounds.width + 20 + w / 2,
          y: bounds.y + bounds.height / 2,
        }
      }

      const newNodes = new Map(nodes)
      newNodes.set(id, {
        id,
        position: initial,
        size: { width: w, height: h },
        node: { id, label: label ?? 'New Node', shape: 'rounded', parent },
      })
      // Collision resolution (nodes + subgraphs)
      const resolved = resolveNodePosition(id, initial.x, initial.y, newNodes, 8, subgraphs)
      newNodes.set(id, { ...newNodes.get(id)!, position: resolved })
      nodes = newNodes
      // Rebalance subgraphs (parent may need to expand)
      if (parent) {
        const newSubgraphs = new Map(subgraphs)
        rebalanceSubgraphs(newNodes, newSubgraphs, ports)
        subgraphs = newSubgraphs
      }
      selection = new Set([id])
    }

    function onAddSubgraph(e: Event) {
      const { label, position } = (e as CustomEvent).detail ?? {}
      const id = `sg-${Date.now()}`
      const w = 200
      const h = 120
      const center = position ?? {
        x: bounds.x + bounds.width + 20 + w / 2,
        y: bounds.y + bounds.height / 2,
      }
      const newSubgraphs = new Map(subgraphs)
      newSubgraphs.set(id, {
        id,
        bounds: { x: center.x - w / 2, y: center.y - h / 2, width: w, height: h },
        subgraph: { id, label: label ?? 'New Group' },
      })
      // Rebalance handles subgraph-subgraph collisions
      rebalanceSubgraphs(nodes, newSubgraphs, ports)
      subgraphs = newSubgraphs
    }

    function onLabelCommit(e: Event) {
      const { portId, label } = (e as CustomEvent).detail ?? {}
      if (portId && label) handleLabelCommit(portId, label)
    }

    host?.addEventListener('shumoku-add-node', onAddNode)
    host?.addEventListener('shumoku-add-subgraph', onAddSubgraph)
    host?.addEventListener('shumoku-label-commit', onLabelCommit)
    return () => {
      host?.removeEventListener('shumoku-add-node', onAddNode)
      host?.removeEventListener('shumoku-add-subgraph', onAddSubgraph)
      host?.removeEventListener('shumoku-label-commit', onLabelCommit)
    }
  })

  // --- Selection handlers ---
  function handleEdgeSelect(edgeId: string) {
    selection = new Set([edgeId])
  }
  function handlePortSelect(portId: string) {
    selection = new Set([portId])
  }
  function handleSubgraphSelect(sgId: string) {
    selection = new Set([sgId])
  }
  function handleLabelEdit(portId: string, label: string, screenX: number, screenY: number) {
    // Emit to host (React shows the input UI)
    if (!svgEl) return
    const root = svgEl.getRootNode() as ShadowRoot | Document
    const host = (root as ShadowRoot).host
    host?.dispatchEvent(
      new CustomEvent('shumoku-label-edit', {
        detail: { portId, label, screenX, screenY },
        bubbles: true,
        composed: true,
      }),
    )
  }

  function handleLabelCommit(portId: string, newLabel: string) {
    const port = ports.get(portId)
    if (!port || newLabel === port.label) return
    const newPorts = new Map(ports)
    newPorts.set(portId, { ...port, label: newLabel })
    ports = newPorts
  }

  function handleBackgroundClick() {
    selection = new Set()
  }

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
      routeEdges(nodes, ports, links).then((e) => {
        edges = e
      })
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
<div style="width: 100%; height: 100%; outline: none;">
  <SvgCanvas
    {nodes}
    {ports}
    {edges}
    {subgraphs}
    {bounds}
    {colors}
    theme={currentTheme}
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
