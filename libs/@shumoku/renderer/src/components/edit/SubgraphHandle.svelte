<script lang="ts">
  import type { ResolvedSubgraph } from '@shumoku/core'
  import { screenToSvg, svgRectToContainer } from '../../lib/svg-coords'

  let {
    subgraph,
    svg,
    container,
    onmove,
  }: {
    subgraph: ResolvedSubgraph
    svg: SVGSVGElement
    container: HTMLElement
    onmove?: (sgId: string, x: number, y: number) => void
  } = $props()

  let pointerDown = $state(false)
  let dragging = $state(false)
  let dragStartScreen = $state({ x: 0, y: 0 })
  let dragStartBounds = $state({ x: 0, y: 0 })

  const handleHeight = 28 // label area height
  const dragThreshold = 4

  // Position the handle over the subgraph's label area (top bar)
  const rect = $derived(svgRectToContainer(
    svg,
    container,
    {
      x: subgraph.bounds.x + subgraph.bounds.width / 2,
      y: subgraph.bounds.y + handleHeight / 2,
    },
    { width: subgraph.bounds.width, height: handleHeight },
  ))

  function onpointerdown(e: PointerEvent) {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    pointerDown = true
    dragging = false
    dragStartScreen = { x: e.clientX, y: e.clientY }
    dragStartBounds = { x: subgraph.bounds.x, y: subgraph.bounds.y }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  function onpointermove(e: PointerEvent) {
    if (!pointerDown) return
    const dx = e.clientX - dragStartScreen.x
    const dy = e.clientY - dragStartScreen.y

    if (!dragging && (Math.abs(dx) > dragThreshold || Math.abs(dy) > dragThreshold)) {
      dragging = true
    }

    if (dragging) {
      const svgStart = screenToSvg(svg, dragStartScreen.x, dragStartScreen.y)
      const svgNow = screenToSvg(svg, e.clientX, e.clientY)
      const newX = dragStartBounds.x + (svgNow.x - svgStart.x)
      const newY = dragStartBounds.y + (svgNow.y - svgStart.y)
      onmove?.(subgraph.id, newX, newY)
    }
  }

  function onpointerup(e: PointerEvent) {
    ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
    pointerDown = false
    dragging = false
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  style="
    position: absolute;
    top: {rect.top}px;
    left: {rect.left}px;
    width: {rect.width}px;
    height: {rect.height}px;
    cursor: {dragging ? 'grabbing' : 'grab'};
    pointer-events: auto;
    border-radius: 12px 12px 0 0;
  "
  onpointerdown={onpointerdown}
  onpointermove={onpointermove}
  onpointerup={onpointerup}
></div>
