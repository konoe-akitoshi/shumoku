<script lang="ts">
  import type { ResolvedNode } from '@shumoku/core'
  import {
    DEFAULT_ICON_SIZE,
    getDeviceIcon,
    ICON_LABEL_GAP,
    LABEL_LINE_HEIGHT,
  } from '@shumoku/core'
  import type { RenderColors } from '../../lib/render-colors'

  let {
    node,
    colors,
    shadowFilterId = 'node-shadow',
    selected = false,
    interactive = false,
    ondragstart,
    ondragmove,
    ondragend,
    onaddport,
    oncontextmenu: onctx,
  }: {
    node: ResolvedNode
    colors: RenderColors
    shadowFilterId?: string
    selected?: boolean
    interactive?: boolean
    ondragstart?: (id: string) => void
    ondragmove?: (id: string, x: number, y: number) => void
    ondragend?: (id: string) => void
    onaddport?: (nodeId: string, side: 'top' | 'bottom' | 'left' | 'right') => void
    oncontextmenu?: (id: string, e: MouseEvent) => void
  } = $props()

  const cx = $derived(node.position.x)
  const cy = $derived(node.position.y)
  const hw = $derived(node.size.width / 2)
  const hh = $derived(node.size.height / 2)
  const shape = $derived(node.node.shape ?? 'rounded')

  // Colors
  let hovered = $state(false)
  const active = $derived(selected || hovered)
  const fill = $derived(node.node.style?.fill ?? (active ? colors.nodeHoverFill : colors.nodeFill))
  const stroke = $derived(node.node.style?.stroke ?? (active ? colors.nodeHoverStroke : colors.nodeStroke))
  const strokeWidth = $derived(node.node.style?.strokeWidth ?? (active ? 2 : 1.5))
  const strokeDasharray = $derived(node.node.style?.strokeDasharray ?? '')

  // Icon
  const iconPath = $derived(getDeviceIcon(node.node.type))
  const iconSize = DEFAULT_ICON_SIZE

  // Labels
  const labels = $derived(
    Array.isArray(node.node.label) ? node.node.label : [node.node.label ?? ''],
  )
  const parsedLabels = $derived(
    labels.map((line, i) => {
      const isBold = line.includes('<b>') || line.includes('<strong>')
      const clean = line.replace(/<\/?b>|<\/?strong>|<br\s*\/?>/gi, '')
      const isSecondary = i > 0 && !isBold
      const className = isBold ? 'node-label node-label-bold' : isSecondary ? 'node-label-secondary' : 'node-label'
      return { text: clean, className }
    }),
  )

  // Vertical centering
  const iconHeight = $derived(iconPath ? iconSize : 0)
  const gap = $derived(iconHeight > 0 ? ICON_LABEL_GAP : 0)
  const labelHeight = $derived(parsedLabels.length * LABEL_LINE_HEIGHT)
  const totalContentHeight = $derived(iconHeight + gap + labelHeight)
  const contentTop = $derived(cy - totalContentHeight / 2)
  const labelStartY = $derived(contentTop + iconHeight + gap + LABEL_LINE_HEIGHT * 0.7)

  // Drag state
  let dragging = $state(false)
  let dragStart = $state({ x: 0, y: 0 })
  let nodeStart = $state({ x: 0, y: 0 })

  // Port add: droplet on nearest edge
  let droplet = $state<{ side: 'top' | 'bottom' | 'left' | 'right'; x: number; y: number } | null>(null)

  function screenToSvg(e: PointerEvent): { x: number; y: number } {
    const svg = (e.target as Element).closest('svg') as SVGSVGElement | null
    const ctm = svg?.getScreenCTM()
    if (!ctm) return { x: e.clientX, y: e.clientY }
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse())
    return { x: p.x, y: p.y }
  }

  let captureEl: Element | null = null

  function onpointerdown(e: PointerEvent) {
    if (!interactive || e.button !== 0) return
    e.stopPropagation()
    e.preventDefault()
    const p = screenToSvg(e)
    dragging = true
    dragStart = p
    nodeStart = { x: cx, y: cy }
    captureEl = e.target as Element
    captureEl.setPointerCapture(e.pointerId)
    ondragstart?.(node.id)
  }

  function onpointermove(e: PointerEvent) {
    if (!interactive) return
    if (dragging) {
      const p = screenToSvg(e)
      ondragmove?.(node.id, nodeStart.x + p.x - dragStart.x, nodeStart.y + p.y - dragStart.y)
      return
    }
  }

  function onpointerup(e: PointerEvent) {
    if (dragging) {
      dragging = false
      captureEl?.releasePointerCapture(e.pointerId)
      captureEl = null
      ondragend?.(node.id)
    }
  }

  // Droplet: separate handler on the node group (not the hit rect)
  function onGroupMove(e: PointerEvent) {
    if (!interactive || dragging) return
    const p = screenToSvg(e)
    const dTop = Math.abs(p.y - (cy - hh))
    const dBottom = Math.abs(p.y - (cy + hh))
    const dLeft = Math.abs(p.x - (cx - hw))
    const dRight = Math.abs(p.x - (cx + hw))
    const min = Math.min(dTop, dBottom, dLeft, dRight)
    if (min === dTop) droplet = { side: 'top', x: Math.max(cx - hw, Math.min(cx + hw, p.x)), y: cy - hh }
    else if (min === dBottom) droplet = { side: 'bottom', x: Math.max(cx - hw, Math.min(cx + hw, p.x)), y: cy + hh }
    else if (min === dLeft) droplet = { side: 'left', x: cx - hw, y: Math.max(cy - hh, Math.min(cy + hh, p.y)) }
    else droplet = { side: 'right', x: cx + hw, y: Math.max(cy - hh, Math.min(cy + hh, p.y)) }
  }

  function onDropletDown(e: PointerEvent) {
    if (!droplet) return
    e.stopPropagation()
    e.preventDefault()
    onaddport?.(node.id, droplet.side)
  }

  function handleContextMenu(ev: MouseEvent) {
    if (!interactive) return
    ev.preventDefault()
    ev.stopPropagation()
    onctx?.(node.id, ev)
  }
</script>

<g
  class="node"
  data-id={node.id}
  data-device-type={node.node.type ?? ''}
  filter="url(#{shadowFilterId})"
  role={interactive ? 'button' : undefined}
  style={interactive ? 'cursor: grab;' : ''}
  onpointerenter={() => { hovered = true }}
  onpointerleave={() => { hovered = false; droplet = null }}
  onpointermove={onGroupMove}
  oncontextmenu={handleContextMenu}
>
  <!-- Invisible hit area for pointer events -->
  <rect
    class="node-hit"
    x={cx - hw - 4} y={cy - hh - 4}
    width={node.size.width + 8} height={node.size.height + 8}
    fill="transparent"
    style={interactive ? 'pointer-events: fill; cursor: grab;' : 'pointer-events: none;'}
    onpointerdown={onpointerdown}
    onpointermove={onpointermove}
    onpointerup={onpointerup}
  />

  <!-- Background shape -->
  <g class="node-bg">
    {#if shape === 'rect'}
      <rect x={cx - hw} y={cy - hh} width={node.size.width} height={node.size.height}
        {fill} {stroke} stroke-width={strokeWidth} stroke-dasharray={strokeDasharray || undefined} />
    {:else if shape === 'rounded'}
      <rect x={cx - hw} y={cy - hh} width={node.size.width} height={node.size.height}
        rx="8" ry="8" {fill} {stroke} stroke-width={strokeWidth} stroke-dasharray={strokeDasharray || undefined} />
    {:else if shape === 'circle'}
      <circle cx={cx} cy={cy} r={Math.min(hw, hh)} {fill} {stroke} stroke-width={strokeWidth} />
    {:else if shape === 'diamond'}
      <polygon points="{cx},{cy - hh} {cx + hw},{cy} {cx},{cy + hh} {cx - hw},{cy}"
        {fill} {stroke} stroke-width={strokeWidth} />
    {:else if shape === 'hexagon'}
      {@const hx = hw * 0.866}
      <polygon points="{cx - hw},{cy} {cx - hx},{cy - hh} {cx + hx},{cy - hh} {cx + hw},{cy} {cx + hx},{cy + hh} {cx - hx},{cy + hh}"
        {fill} {stroke} stroke-width={strokeWidth} />
    {:else if shape === 'cylinder'}
      {@const eh = node.size.height * 0.15}
      <g>
        <ellipse cx={cx} cy={cy + hh - eh} rx={hw} ry={eh} {fill} {stroke} stroke-width={strokeWidth} />
        <rect x={cx - hw} y={cy - hh + eh} width={node.size.width} height={node.size.height - eh * 2} {fill} stroke="none" />
        <line x1={cx - hw} y1={cy - hh + eh} x2={cx - hw} y2={cy + hh - eh} {stroke} stroke-width={strokeWidth} />
        <line x1={cx + hw} y1={cy - hh + eh} x2={cx + hw} y2={cy + hh - eh} {stroke} stroke-width={strokeWidth} />
        <ellipse cx={cx} cy={cy - hh + eh} rx={hw} ry={eh} {fill} {stroke} stroke-width={strokeWidth} />
      </g>
    {:else if shape === 'stadium'}
      <rect x={cx - hw} y={cy - hh} width={node.size.width} height={node.size.height}
        rx={hh} ry={hh} {fill} {stroke} stroke-width={strokeWidth} />
    {:else if shape === 'trapezoid'}
      {@const indent = node.size.width * 0.15}
      <polygon points="{cx - hw + indent},{cy - hh} {cx + hw - indent},{cy - hh} {cx + hw},{cy + hh} {cx - hw},{cy + hh}"
        {fill} {stroke} stroke-width={strokeWidth} />
    {:else}
      <rect x={cx - hw} y={cy - hh} width={node.size.width} height={node.size.height}
        rx="8" ry="8" {fill} {stroke} stroke-width={strokeWidth} />
    {/if}
  </g>

  <!-- Content: icon + labels -->
  <g class="node-fg" pointer-events="none">
    {#if iconPath}
      <g class="node-icon" transform="translate({cx - iconSize / 2}, {contentTop})">
        <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="currentColor">
          {@html iconPath}
        </svg>
      </g>
    {/if}
    {#each parsedLabels as label, i}
      <text x={cx} y={labelStartY + i * LABEL_LINE_HEIGHT} class={label.className} text-anchor="middle">
        {label.text}
      </text>
    {/each}
  </g>

  <!-- Port add droplet (edit mode only) -->
  {#if interactive && droplet && !dragging}
    <g style="cursor: pointer;" onpointerdown={onDropletDown}>
      <circle cx={droplet.x} cy={droplet.y} r="8" fill="#3b82f6" opacity="0.8" />
      <text x={droplet.x} y={droplet.y} text-anchor="middle" dominant-baseline="central"
        font-size="12" fill="white" pointer-events="none">+</text>
    </g>
  {/if}
</g>
