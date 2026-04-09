<script lang="ts">
  import type { ResolvedNode } from '@shumoku/core'

  let {
    node,
    ondragmove,
  }: {
    node: ResolvedNode
    ondragmove?: (id: string, x: number, y: number) => void
  } = $props()

  const x = $derived(node.position.x - node.size.width / 2)
  const y = $derived(node.position.y - node.size.height / 2)

  let dragging = $state(false)
  let dragStart = $state({ x: 0, y: 0 })
  let nodeStart = $state({ x: 0, y: 0 })

  function screenToSvg(e: PointerEvent): { x: number; y: number } {
    const svg = (e.target as Element).closest('svg')
    if (!svg) return { x: e.clientX, y: e.clientY }
    const pt = (svg as SVGSVGElement).createSVGPoint()
    pt.x = e.clientX
    pt.y = e.clientY
    const ctm = (svg as SVGSVGElement).getScreenCTM()
    if (!ctm) return { x: e.clientX, y: e.clientY }
    const svgPt = pt.matrixTransform(ctm.inverse())
    return { x: svgPt.x, y: svgPt.y }
  }

  function onpointerdown(e: PointerEvent) {
    dragging = true
    const svgPt = screenToSvg(e)
    dragStart = svgPt
    nodeStart = { x: node.position.x, y: node.position.y }
    ;(e.target as Element).setPointerCapture(e.pointerId)
    e.preventDefault()
  }

  function onpointermove(e: PointerEvent) {
    if (!dragging) return
    const svgPt = screenToSvg(e)
    const newX = nodeStart.x + (svgPt.x - dragStart.x)
    const newY = nodeStart.y + (svgPt.y - dragStart.y)
    ondragmove?.(node.id, newX, newY)
  }

  function onpointerup() {
    dragging = false
  }

  const label = $derived(
    Array.isArray(node.node.label) ? (node.node.label[0] ?? '') : (node.node.label ?? ''),
  )
</script>

<g
  class="node"
  class:dragging
  data-node-id={node.id}
  {onpointerdown}
  {onpointermove}
  {onpointerup}
  style="cursor: {dragging ? 'grabbing' : 'grab'}"
>
  <rect
    {x}
    {y}
    width={node.size.width}
    height={node.size.height}
    rx="8"
    fill="#f8fafc"
    stroke="#64748b"
    stroke-width="1.5"
  />
  <text
    x={node.position.x}
    y={node.position.y}
    text-anchor="middle"
    dominant-baseline="central"
    font-size="14"
    fill="#1e293b"
  >
    {label}
  </text>
</g>
