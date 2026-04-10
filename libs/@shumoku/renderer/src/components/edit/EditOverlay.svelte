<script lang="ts">
  import type { ResolvedEdge, ResolvedNode, ResolvedPort, ResolvedSubgraph } from '@shumoku/core'
  import type { EditState } from '../../lib/edit-state.svelte'
  import { screenToSvg } from '../../lib/svg-coords'
  import ContextMenu from './ContextMenu.svelte'
  import LabelEditor from './LabelEditor.svelte'
  import NodeHandle from './NodeHandle.svelte'
  import PortHandle from './PortHandle.svelte'
  import SubgraphHandle from './SubgraphHandle.svelte'

  let {
    svg,
    container,
    editState,
    nodes,
    ports,
    edges,
    subgraphs,
    ondragmove,
    onsubgraphmove,
    onaddport,
    onlinkstart,
    onlinkend,
    onlinkdrop,
    onlabelcommit,
    onportmove,
    ondelete,
  }: {
    svg: SVGSVGElement
    container: HTMLElement
    editState: EditState
    nodes: Map<string, ResolvedNode>
    ports: Map<string, ResolvedPort>
    edges: Map<string, ResolvedEdge>
    subgraphs: Map<string, ResolvedSubgraph>
    ondragmove?: (id: string, x: number, y: number) => void
    onsubgraphmove?: (sgId: string, x: number, y: number) => void
    onaddport?: (nodeId: string, side: 'top' | 'bottom' | 'left' | 'right') => void
    onlinkstart?: (portId: string, x: number, y: number) => void
    onlinkend?: (portId: string) => void
    onlinkdrop?: (nodeId: string) => void
    onlabelcommit?: (portId: string, value: string) => void
    onportmove?: (portId: string, svgX: number, svgY: number) => void
    ondelete?: (targetId: string, targetType: 'node' | 'port' | 'edge') => void
  } = $props()

  let overlayEl = $state<HTMLDivElement | null>(null)

  const nodeList = $derived([...nodes.values()])
  const portList = $derived([...ports.values()])

  // Set of port IDs that have at least one link
  const linkedPorts = $derived.by(() => {
    const ids = new Set<string>()
    for (const edge of edges.values()) {
      if (edge.fromPortId) ids.add(edge.fromPortId)
      if (edge.toPortId) ids.add(edge.toPortId)
    }
    return ids
  })

  function onBackgroundClick(e: MouseEvent) {
    // Only clear if clicking the overlay itself, not a child
    if (e.target !== e.currentTarget) return
    editState.clearSelection()
    if (editState.linkDrag) {
      editState.endLinkDrag()
    }
  }

  function onBackgroundMove(e: PointerEvent) {
    if (!editState.linkDrag) return
    const svgPt = screenToSvg(svg, e.clientX, e.clientY)
    editState.updateLinkDrag(svgPt.x, svgPt.y)
  }

  function onContextMenu(e: MouseEvent) {
    e.preventDefault()
    // Find what was right-clicked by checking edit state selection
    if (editState.selection.size === 1) {
      const targetId = [...editState.selection][0]
      if (!targetId) return
      const containerRect = container.getBoundingClientRect()
      let targetType: 'node' | 'port' | 'edge' = 'node'
      if (edges.has(targetId)) targetType = 'edge'
      else if (ports.has(targetId)) targetType = 'port'
      editState.showContextMenu(
        e.clientX - containerRect.left,
        e.clientY - containerRect.top,
        targetId,
        targetType,
      )
    }
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      editState.cancelAll()
      return
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      for (const id of editState.selection) {
        let targetType: 'node' | 'port' | 'edge' = 'node'
        if (edges.has(id)) targetType = 'edge'
        else if (ports.has(id)) targetType = 'port'
        ondelete?.(id, targetType)
      }
      editState.clearSelection()
    }
  }

  function handleLabelEdit(portId: string, rect: { top: number; left: number; width: number }) {
    const port = ports.get(portId)
    if (!port) return
    editState.startLabelEdit(portId, port.label, rect)
  }

  // Listen for clicks on SVG elements (port labels, edges)
  function onSvgClick(e: MouseEvent) {
    const target = e.target as HTMLElement

    // Port label click → edit
    const portId = target.dataset?.['portLabel']
    if (portId) {
      e.stopPropagation()
      const rect = target.getBoundingClientRect()
      const containerRect = container.getBoundingClientRect()
      handleLabelEdit(portId, {
        top: rect.top - containerRect.top - 2,
        left: rect.left - containerRect.left - 4,
        width: Math.max(rect.width + 16, 48),
      })
      return
    }

    // Edge click → select
    const edgeId = target.dataset?.['edgeClick']
    if (edgeId) {
      e.stopPropagation()
      editState.select(edgeId)
      return
    }

    // Click on SVG background → clear selection
    editState.clearSelection()
    if (editState.linkDrag) {
      editState.endLinkDrag()
    }
  }

  function onSvgContextMenu(e: MouseEvent) {
    e.preventDefault()
    if (editState.contextMenu) {
      editState.hideContextMenu()
      return
    }
    const target = e.target as HTMLElement
    const edgeId = target.dataset?.['edgeClick']
    if (!edgeId) return
    e.stopPropagation()
    editState.select(edgeId)
    const containerRect = container.getBoundingClientRect()
    editState.showContextMenu(e.clientX - containerRect.left, e.clientY - containerRect.top, edgeId, 'edge')
  }

  // Focus overlay when selection changes so keyboard events work
  $effect(() => {
    if (editState.selection.size > 0 && overlayEl) {
      overlayEl.focus()
    }
  })

  $effect(() => {
    svg.style.pointerEvents = 'auto'
    svg.addEventListener('click', onSvgClick)
    svg.addEventListener('contextmenu', onSvgContextMenu)
    return () => {
      svg.removeEventListener('click', onSvgClick)
      svg.removeEventListener('contextmenu', onSvgContextMenu)
      svg.style.pointerEvents = 'none'
    }
  })
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  bind:this={overlayEl}
  class="edit-overlay"
  style="
    position: absolute;
    inset: 0;
    pointer-events: none;
    overflow: hidden;
  "
  onpointermove={onBackgroundMove}
  onclick={onBackgroundClick}
  oncontextmenu={onContextMenu}
  onkeydown={onKeyDown}
  tabindex="-1"
>
  {#each [...subgraphs.values()] as sg (sg.id)}
    <SubgraphHandle
      subgraph={sg}
      {svg}
      {container}
      onmove={onsubgraphmove}
    />
  {/each}

  {#each nodeList as node (node.id)}
    <NodeHandle
      {node}
      {svg}
      {container}
      {editState}
      {ondragmove}
      {onaddport}
      onlinkdrop={onlinkdrop}
    />
  {/each}

  {#each portList as port (port.id)}
    <PortHandle
      {port}
      {svg}
      {container}
      {editState}
      linked={linkedPorts.has(port.id)}
      {onlinkstart}
      {onlinkend}
      {onportmove}
    />
  {/each}

  <LabelEditor {editState} oncommit={onlabelcommit} />
  <ContextMenu {editState} {ondelete} />
</div>
