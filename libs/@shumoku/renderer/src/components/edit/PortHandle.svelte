<script lang="ts">
  import type { ResolvedPort } from '@shumoku/core'
  import type { EditState } from '../../lib/edit-state.svelte'
  import { screenToSvg, svgPointToContainer } from '../../lib/svg-coords'

  let {
    port,
    svg,
    container,
    editState,
    linked = false,
    onlinkstart,
    onlinkend,
    onportmove,
  }: {
    port: ResolvedPort
    svg: SVGSVGElement
    container: HTMLElement
    editState: EditState
    linked?: boolean
    onlinkstart?: (portId: string, x: number, y: number) => void
    onlinkend?: (portId: string) => void
    onportmove?: (portId: string, svgX: number, svgY: number) => void
  } = $props()

  let hovered = $state(false)
  let pointerDown = $state(false)
  let dragging = $state(false)
  let dragStartScreen = $state({ x: 0, y: 0 })

  const pos = $derived(svgPointToContainer(svg, container, port.absolutePosition.x, port.absolutePosition.y))

  const hitSize = 24
  const dragThreshold = 4

  function onPortDown(e: PointerEvent) {
    if (e.button !== 0) return
    e.stopPropagation()
    e.preventDefault()
    pointerDown = true
    dragging = false
    dragStartScreen = { x: e.clientX, y: e.clientY }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  function onPortMove(e: PointerEvent) {
    if (!pointerDown) return

    const dx = e.clientX - dragStartScreen.x
    const dy = e.clientY - dragStartScreen.y

    if (!dragging && (Math.abs(dx) > dragThreshold || Math.abs(dy) > dragThreshold)) {
      dragging = true
      editState.highlightNode(port.nodeId)
    }

    if (dragging) {
      const svgPt = screenToSvg(svg, e.clientX, e.clientY)
      onportmove?.(port.id, svgPt.x, svgPt.y)
    }
  }

  function onPortUp(e: PointerEvent) {
    e.stopPropagation()
    ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)

    pointerDown = false
    if (dragging) {
      dragging = false
      editState.unhighlightNode(port.nodeId)
      return
    }

    // Click (no drag)
    if (editState.linkDrag) {
      // Link drag in progress → drop on this port
      onlinkend?.(port.id)
    } else if (linked) {
      // Already linked → select
      editState.select(port.id)
    } else {
      // Not linked → start link
      onlinkstart?.(port.id, port.absolutePosition.x, port.absolutePosition.y)
    }
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  style="
    position: absolute;
    top: {pos.top - hitSize / 2}px;
    left: {pos.left - hitSize / 2}px;
    width: {hitSize}px;
    height: {hitSize}px;
    cursor: {dragging ? 'grabbing' : linked ? 'pointer' : 'crosshair'};
    pointer-events: auto;
    border-radius: 4px;
    {hovered ? 'background: rgba(59, 130, 246, 0.15);' : ''}
  "
  onpointerdown={onPortDown}
  onpointermove={onPortMove}
  onpointerup={onPortUp}
  onpointerenter={() => (hovered = true)}
  onpointerleave={() => (hovered = false)}
  oncontextmenu={(e) => {
    e.preventDefault()
    if (editState.contextMenu) {
      editState.hideContextMenu()
      return
    }
    e.stopPropagation()
    editState.select(port.id)
    const containerRect = container.getBoundingClientRect()
    editState.showContextMenu(e.clientX - containerRect.left, e.clientY - containerRect.top, port.id, 'port')
  }}
></div>
