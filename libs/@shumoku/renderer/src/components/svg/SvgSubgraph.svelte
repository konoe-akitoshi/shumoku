<script lang="ts">
  import type { ResolvedSubgraph, Theme } from '@shumoku/core'
  import type { SurfaceToken } from '@shumoku/core'
  import type { RenderColors } from '../../lib/render-colors'

  let {
    subgraph,
    colors,
    theme,
    interactive = false,
    ondragmove,
  }: {
    subgraph: ResolvedSubgraph
    colors: RenderColors
    theme?: Theme
    interactive?: boolean
    ondragmove?: (sgId: string, x: number, y: number) => void
  } = $props()

  const style = $derived(subgraph.subgraph.style ?? {})
  const surfaceTokens: readonly string[] = [
    'surface-1', 'surface-2', 'surface-3',
    'accent-blue', 'accent-green', 'accent-red', 'accent-amber', 'accent-purple',
  ]

  const resolved = $derived(() => {
    const fillValue = style.fill
    const strokeValue = style.stroke
    if (fillValue && surfaceTokens.includes(fillValue) && theme) {
      const sc = theme.colors.surfaces[fillValue as SurfaceToken]
      return { fill: sc.fill, stroke: strokeValue ?? sc.stroke, text: sc.text }
    }
    return { fill: fillValue ?? colors.subgraphFill, stroke: strokeValue ?? colors.subgraphStroke, text: colors.subgraphText }
  })

  const strokeWidth = $derived(style.strokeWidth ?? 3)
  const strokeDasharray = $derived(style.strokeDasharray ?? '')

  // Drag state
  let dragging = $state(false)
  let dragStart = $state({ x: 0, y: 0 })
  let boundsStart = $state({ x: 0, y: 0 })

  function screenToSvg(e: PointerEvent): { x: number; y: number } {
    const svg = (e.target as Element).closest('svg') as SVGSVGElement | null
    const ctm = svg?.getScreenCTM()
    if (!ctm) return { x: e.clientX, y: e.clientY }
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse())
    return { x: p.x, y: p.y }
  }

  function onpointerdown(e: PointerEvent) {
    if (!interactive || e.button !== 0) return
    e.stopPropagation()
    dragging = true
    const p = screenToSvg(e)
    dragStart = p
    boundsStart = { x: subgraph.bounds.x, y: subgraph.bounds.y }
    ;(e.target as Element).setPointerCapture(e.pointerId)
  }

  function onpointermove(e: PointerEvent) {
    if (!dragging) return
    const p = screenToSvg(e)
    ondragmove?.(subgraph.id, boundsStart.x + p.x - dragStart.x, boundsStart.y + p.y - dragStart.y)
  }

  function onpointerup(e: PointerEvent) {
    if (dragging) {
      dragging = false
      ;(e.target as Element).releasePointerCapture(e.pointerId)
    }
  }
</script>

<g class="subgraph" data-id={subgraph.id}>
  <rect
    x={subgraph.bounds.x} y={subgraph.bounds.y}
    width={subgraph.bounds.width} height={subgraph.bounds.height}
    rx="12" ry="12"
    fill={resolved().fill} stroke={resolved().stroke}
    stroke-width={strokeWidth}
    stroke-dasharray={strokeDasharray || undefined}
  />
  <!-- Label area: draggable in edit mode -->
  <rect
    x={subgraph.bounds.x} y={subgraph.bounds.y}
    width={subgraph.bounds.width} height={28}
    rx="12" ry="12"
    fill="transparent"
    style="pointer-events: {interactive ? 'fill' : 'none'}; cursor: {dragging ? 'grabbing' : 'grab'};"
    onpointerdown={onpointerdown}
    onpointermove={onpointermove}
    onpointerup={onpointerup}
  />
  <text
    x={subgraph.bounds.x + 10} y={subgraph.bounds.y + 20}
    class="subgraph-label" text-anchor="start" fill={resolved().text}
    pointer-events="none"
  >
    {subgraph.subgraph.label}
  </text>
</g>
