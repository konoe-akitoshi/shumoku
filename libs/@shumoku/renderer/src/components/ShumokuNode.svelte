<script lang="ts">
  import type { ResolvedNode } from '@shumoku/core'

  let {
    node,
    ondragmove,
    onlinkdrop,
    onaddport,
  }: {
    node: ResolvedNode
    ondragmove?: (id: string, x: number, y: number) => void
    onlinkdrop?: (nodeId: string) => void
    onaddport?: (nodeId: string, side: 'top' | 'bottom' | 'left' | 'right') => void
  } = $props()

  const cx = $derived(node.position.x)
  const cy = $derived(node.position.y)
  const hw = $derived(node.size.width / 2)
  const hh = $derived(node.size.height / 2)

  let dragging = $state(false)
  let dragStart = $state({ x: 0, y: 0 })
  let nodeStart = $state({ x: 0, y: 0 })

  // Droplet: which side + position along that edge
  let drop = $state<{ x: number; y: number; side: 'top' | 'bottom' | 'left' | 'right' } | null>(null)

  function toSvg(e: PointerEvent): { x: number; y: number } {
    const svg = (e.target as Element).closest('svg') as SVGSVGElement | null
    if (!svg) return { x: e.clientX, y: e.clientY }
    const ctm = svg.getScreenCTM()
    if (!ctm) return { x: e.clientX, y: e.clientY }
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse())
    return { x: p.x, y: p.y }
  }

  /** Map mouse position along an edge using DOM bounding rect ratio → known SVG coords */
  function trackEdge(side: 'top' | 'bottom' | 'left' | 'right', e: PointerEvent) {
    const rect = (e.currentTarget as Element).getBoundingClientRect()
    if (side === 'top' || side === 'bottom') {
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
      const svgX = (cx - hw) + ratio * node.size.width
      const svgY = side === 'top' ? cy - hh : cy + hh
      drop = { x: svgX, y: svgY, side }
    } else {
      const ratio = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height))
      const svgY = (cy - hh) + ratio * node.size.height
      const svgX = side === 'left' ? cx - hw : cx + hw
      drop = { x: svgX, y: svgY, side }
    }
  }

  function onpointerdown(e: PointerEvent) {
    dragging = true
    const p = toSvg(e)
    dragStart = p
    nodeStart = { x: cx, y: cy }
    ;(e.target as Element).setPointerCapture(e.pointerId)
    e.preventDefault()
  }

  function onpointermove(e: PointerEvent) {
    if (!dragging) return
    const p = toSvg(e)
    ondragmove?.(node.id, nodeStart.x + p.x - dragStart.x, nodeStart.y + p.y - dragStart.y)
  }

  function onpointerup() {
    if (dragging) {
      dragging = false
      return
    }
    onlinkdrop?.(node.id)
  }

  function addPort(side: 'top' | 'bottom' | 'left' | 'right', e: PointerEvent) {
    e.stopPropagation()
    e.preventDefault()
    onaddport?.(node.id, side)
  }

  const label = $derived(
    Array.isArray(node.node.label) ? (node.node.label[0] ?? '') : (node.node.label ?? ''),
  )

  const zone = 12
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
    x={cx - hw}
    y={cy - hh}
    width={node.size.width}
    height={node.size.height}
    rx="8"
    fill={drop ? '#f1f5f9' : '#f8fafc'}
    stroke={drop ? '#3b82f6' : '#64748b'}
    stroke-width="1.5"
  />
  <text
    x={cx}
    y={cy}
    text-anchor="middle"
    dominant-baseline="central"
    font-size="14"
    fill="#1e293b"
    pointer-events="none"
  >
    {label}
  </text>

  <!-- Edge hover zones -->
  <rect
    x={cx - hw} y={cy - hh - zone / 2}
    width={node.size.width} height={zone}
    fill="transparent" style="cursor: pointer"
    onpointermove={(e) => trackEdge('top', e)}
    onpointerleave={() => (drop = null)}
    onpointerdown={(e) => addPort('top', e)}
  />
  <rect
    x={cx - hw} y={cy + hh - zone / 2}
    width={node.size.width} height={zone}
    fill="transparent" style="cursor: pointer"
    onpointermove={(e) => trackEdge('bottom', e)}
    onpointerleave={() => (drop = null)}
    onpointerdown={(e) => addPort('bottom', e)}
  />
  <rect
    x={cx - hw - zone / 2} y={cy - hh}
    width={zone} height={node.size.height}
    fill="transparent" style="cursor: pointer"
    onpointermove={(e) => trackEdge('left', e)}
    onpointerleave={() => (drop = null)}
    onpointerdown={(e) => addPort('left', e)}
  />
  <rect
    x={cx + hw - zone / 2} y={cy - hh}
    width={zone} height={node.size.height}
    fill="transparent" style="cursor: pointer"
    onpointermove={(e) => trackEdge('right', e)}
    onpointerleave={() => (drop = null)}
    onpointerdown={(e) => addPort('right', e)}
  />

  <!-- Droplet follows mouse along the edge -->
  {#if drop && !dragging}
    <circle
      cx={drop.x}
      cy={drop.y}
      r="8"
      fill="#3b82f6"
      pointer-events="none"
    />
    <text
      x={drop.x}
      y={drop.y}
      text-anchor="middle"
      dominant-baseline="central"
      font-size="12"
      fill="white"
      pointer-events="none"
    >+</text>
  {/if}
</g>
