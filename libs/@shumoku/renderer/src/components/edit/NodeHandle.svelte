<script lang="ts">
  import type { ResolvedNode } from '@shumoku/core'
  import type { EditState } from '../../lib/edit-state.svelte'
  import { screenToSvg, svgRectToContainer } from '../../lib/svg-coords'

  let {
    node,
    svg,
    container,
    editState,
    ondragmove,
    onaddport,
    onlinkdrop,
  }: {
    node: ResolvedNode
    svg: SVGSVGElement
    container: HTMLElement
    editState: EditState
    ondragmove?: (id: string, x: number, y: number) => void
    onaddport?: (nodeId: string, side: 'top' | 'bottom' | 'left' | 'right') => void
    onlinkdrop?: (nodeId: string) => void
  } = $props()

  let droplet = $state<{ side: 'top' | 'bottom' | 'left' | 'right'; offset: number } | null>(null)
  let pointerDown = $state(false)
  let dragging = $state(false)
  let dragStartScreen = $state({ x: 0, y: 0 })
  let dragStartSvg = $state({ x: 0, y: 0 })
  let dragStartNode = $state({ x: 0, y: 0 })

  const rect = $derived(svgRectToContainer(svg, container, node.position, node.size))
  const dragThreshold = 4

  function onpointerdown(e: PointerEvent) {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()

    pointerDown = true
    dragging = false
    dragStartScreen = { x: e.clientX, y: e.clientY }
    dragStartSvg = screenToSvg(svg, e.clientX, e.clientY)
    dragStartNode = { x: node.position.x, y: node.position.y }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  function onpointermove(e: PointerEvent) {
    if (!pointerDown) return

    const dx = e.clientX - dragStartScreen.x
    const dy = e.clientY - dragStartScreen.y

    if (!dragging && (Math.abs(dx) > dragThreshold || Math.abs(dy) > dragThreshold)) {
      dragging = true
      editState.startNodeDrag(node.id, dragStartSvg.x, dragStartSvg.y, dragStartNode.x, dragStartNode.y)
    }

    if (dragging) {
      const svgPt = screenToSvg(svg, e.clientX, e.clientY)
      const newX = dragStartNode.x + (svgPt.x - dragStartSvg.x)
      const newY = dragStartNode.y + (svgPt.y - dragStartSvg.y)
      ondragmove?.(node.id, newX, newY)
    }
  }

  function onpointerup(e: PointerEvent) {
    ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
    const wasDragging = dragging
    pointerDown = false
    dragging = false

    if (wasDragging) {
      editState.endNodeDrag()
      return
    }

    // Click (no drag)
    editState.select(node.id)
    if (editState.linkDrag) {
      onlinkdrop?.(node.id)
    }
  }

  function onEdgeMove(side: 'top' | 'bottom' | 'left' | 'right', e: PointerEvent) {
    const zoneEl = e.currentTarget as HTMLElement
    const zoneRect = zoneEl.getBoundingClientRect()
    if (side === 'top' || side === 'bottom') {
      const ratio = Math.max(0, Math.min(1, (e.clientX - zoneRect.left) / zoneRect.width))
      droplet = { side, offset: ratio * rect.width }
    } else {
      const ratio = Math.max(0, Math.min(1, (e.clientY - zoneRect.top) / zoneRect.height))
      droplet = { side, offset: ratio * rect.height }
    }
  }

  function onEdgeLeave() {
    droplet = null
  }

  function onEdgeClick(side: 'top' | 'bottom' | 'left' | 'right', e: PointerEvent) {
    e.stopPropagation()
    e.preventDefault()
    onaddport?.(node.id, side)
  }

  const dropletStyle = $derived(() => {
    if (!droplet) return ''
    const size = 18
    const half = size / 2
    switch (droplet.side) {
      case 'top':
        return `left: ${droplet.offset - half}px; top: ${-half}px;`
      case 'bottom':
        return `left: ${droplet.offset - half}px; bottom: ${-half}px;`
      case 'left':
        return `top: ${droplet.offset - half}px; left: ${-half}px;`
      case 'right':
        return `top: ${droplet.offset - half}px; right: ${-half}px;`
    }
  })

  const edgeZone = 14
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="node-handle"
  style="
    position: absolute;
    top: {rect.top}px;
    left: {rect.left}px;
    width: {rect.width}px;
    height: {rect.height}px;
    cursor: {dragging ? 'grabbing' : 'grab'};
    pointer-events: auto;
    border-radius: 8px;
  "
  onpointerdown={onpointerdown}
  onpointermove={onpointermove}
  onpointerup={onpointerup}
  onpointerenter={() => editState.highlightNode(node.id)}
  onpointerleave={() => editState.unhighlightNode(node.id)}
>
  {#each ['top', 'bottom', 'left', 'right'] as side}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      style="
        position: absolute;
        {side === 'top' || side === 'bottom' ? `left: 0; right: 0; height: ${edgeZone}px;` : ''}
        {side === 'left' || side === 'right' ? `top: 0; bottom: 0; width: ${edgeZone}px;` : ''}
        {side === 'top' ? `top: ${-edgeZone / 2}px;` : ''}
        {side === 'bottom' ? `bottom: ${-edgeZone / 2}px;` : ''}
        {side === 'left' ? `left: ${-edgeZone / 2}px;` : ''}
        {side === 'right' ? `right: ${-edgeZone / 2}px;` : ''}
        cursor: pointer;
      "
      onpointermove={(e) => onEdgeMove(side as 'top' | 'bottom' | 'left' | 'right', e)}
      onpointerleave={onEdgeLeave}
      onpointerdown={(e) => onEdgeClick(side as 'top' | 'bottom' | 'left' | 'right', e)}
    ></div>
  {/each}

  {#if droplet && !dragging}
    <div
      style="
        position: absolute;
        {dropletStyle()}
        width: 18px; height: 18px;
        border-radius: 50%;
        background: #3b82f6;
        color: white;
        font-size: 13px;
        display: flex;
        align-items: center;
        justify-content: center;
        pointer-events: none;
        box-shadow: 0 1px 4px rgba(0,0,0,0.2);
      "
    >+</div>
  {/if}
</div>
