<script lang="ts">
  import type { Node } from '@shumoku/core'
  import {
    computeNodeSize,
    DEFAULT_ICON_SIZE,
    getDeviceIcon,
    ICON_LABEL_GAP,
    LABEL_LINE_HEIGHT,
    specDeviceType,
  } from '@shumoku/core'
  import type { NodeOverlaySnippet } from '../../lib/overlays'
  import type { RenderColors } from '../../lib/render-colors'
  import { elementDrag } from '../../lib/use-drag'

  let {
    node,
    colors,
    shadowFilterId = 'node-shadow',
    selected = false,
    interactive = false,
    overlay,
    ondragmove,
    onaddport,
    onselect,
    oncontextmenu: onctx,
  }: {
    node: Node
    colors: RenderColors
    shadowFilterId?: string
    selected?: boolean
    interactive?: boolean
    overlay?: NodeOverlaySnippet
    ondragmove?: (id: string, x: number, y: number) => void
    onaddport?: (nodeId: string, side: 'top' | 'bottom' | 'left' | 'right') => void
    onselect?: (id: string) => void
    oncontextmenu?: (id: string, e: MouseEvent) => void
  } = $props()

  const cx = $derived(node.position?.x ?? 0)
  const cy = $derived(node.position?.y ?? 0)
  const size = $derived(computeNodeSize(node))
  const hw = $derived(size.width / 2)
  const hh = $derived(size.height / 2)
  const shape = $derived(node.shape ?? 'rounded')

  let hovered = $state(false)
  const active = $derived(selected || hovered)
  const fill = $derived(node.style?.fill ?? (active ? colors.nodeHoverFill : colors.nodeFill))
  const stroke = $derived(
    selected
      ? colors.selection
      : (node.style?.stroke ?? (hovered ? colors.nodeHoverStroke : colors.nodeStroke)),
  )
  const strokeWidth = $derived(selected ? 2.5 : (node.style?.strokeWidth ?? (hovered ? 2 : 1.5)))
  const strokeDasharray = $derived(node.style?.strokeDasharray ?? '')
  const overlayContext = $derived({
    selected,
    interactive,
    cx,
    cy,
    width: size.width,
    height: size.height,
  })

  // Icon
  const iconPath = $derived(getDeviceIcon(specDeviceType(node.spec)))
  const iconSize = DEFAULT_ICON_SIZE

  // Labels
  const labels = $derived(Array.isArray(node.label) ? node.label : [node.label ?? ''])
  const parsedLabels = $derived(
    labels.map((line, i) => {
      const isBold = line.includes('<b>') || line.includes('<strong>')
      const clean = line.replace(/<\/?b>|<\/?strong>|<br\s*\/?>/gi, '')
      const isSecondary = i > 0 && !isBold
      const className = isBold
        ? 'node-label node-label-bold'
        : isSecondary
          ? 'node-label-secondary'
          : 'node-label'
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

  // Port add: droplet follows mouse along the hovered edge
  let droplet = $state<{ side: 'top' | 'bottom' | 'left' | 'right'; x: number; y: number } | null>(
    null,
  )

  function onEdgeMove(side: 'top' | 'bottom' | 'left' | 'right', e: PointerEvent) {
    const rect = (e.currentTarget as Element).getBoundingClientRect()
    if (side === 'top' || side === 'bottom') {
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
      droplet = {
        side,
        x: cx - hw + ratio * size.width,
        y: side === 'top' ? cy - hh : cy + hh,
      }
    } else {
      const ratio = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height))
      droplet = {
        side,
        x: side === 'left' ? cx - hw : cx + hw,
        y: cy - hh + ratio * size.height,
      }
    }
  }

  function onEdgeDown(e: PointerEvent) {
    if (!droplet) return
    e.stopPropagation()
    e.preventDefault()
    onaddport?.(node.id, droplet.side)
  }

  function handleContextMenu(ev: MouseEvent) {
    ev.preventDefault()
    ev.stopPropagation()
    onctx?.(node.id, ev)
  }
</script>

<g
  class="node"
  data-id={node.id}
  data-device-type={specDeviceType(node.spec) ?? ''}
  filter="url(#{shadowFilterId})"
  use:elementDrag={() => ({
    filter: (e) => {
      const t = e.target as Element
      return !t.closest('.port') && !t.closest('.edge-zone') && e.button === 0 && interactive
    },
    onDrag: (dx, dy) => ondragmove?.(node.id, (node.position?.x ?? 0) + dx, (node.position?.y ?? 0) + dy),
  })}
  onclick={(e) => { e.stopPropagation(); onselect?.(node.id) }}
  onpointerenter={() => { if (interactive) hovered = true }}
  onpointerleave={() => { hovered = false }}
  oncontextmenu={handleContextMenu}
>
  <!-- Background shape -->
  <g class="node-bg">
    {#if shape === 'rounded'}
      <rect
        x={cx - hw}
        y={cy - hh}
        width={size.width}
        height={size.height}
        rx="8"
        ry="8"
        {fill}
        {stroke}
        stroke-width={strokeWidth}
        stroke-dasharray={strokeDasharray || undefined}
      />
    {:else if shape === 'rect'}
      <rect
        x={cx - hw}
        y={cy - hh}
        width={size.width}
        height={size.height}
        {fill}
        {stroke}
        stroke-width={strokeWidth}
        stroke-dasharray={strokeDasharray || undefined}
      />
    {:else if shape === 'circle'}
      <circle {cx} {cy} r={Math.min(hw, hh)} {fill} {stroke} stroke-width={strokeWidth} />
    {:else if shape === 'diamond'}
      <polygon
        points="{cx},{cy - hh} {cx + hw},{cy} {cx},{cy + hh} {cx - hw},{cy}"
        {fill}
        {stroke}
        stroke-width={strokeWidth}
      />
    {:else if shape === 'hexagon'}
      {@const hx = hw * 0.866}
      <polygon
        points="{cx - hw},{cy} {cx - hx},{cy - hh} {cx + hx},{cy - hh} {cx + hw},{cy} {cx + hx},{cy + hh} {cx - hx},{cy + hh}"
        {fill}
        {stroke}
        stroke-width={strokeWidth}
      />
    {:else if shape === 'cylinder'}
      {@const eh = size.height * 0.15}
      <g>
        <ellipse
          {cx}
          cy={cy + hh - eh}
          rx={hw}
          ry={eh}
          {fill}
          {stroke}
          stroke-width={strokeWidth}
        />
        <rect
          x={cx - hw}
          y={cy - hh + eh}
          width={size.width}
          height={size.height - eh * 2}
          {fill}
          stroke="none"
        />
        <line
          x1={cx - hw}
          y1={cy - hh + eh}
          x2={cx - hw}
          y2={cy + hh - eh}
          {stroke}
          stroke-width={strokeWidth}
        />
        <line
          x1={cx + hw}
          y1={cy - hh + eh}
          x2={cx + hw}
          y2={cy + hh - eh}
          {stroke}
          stroke-width={strokeWidth}
        />
        <ellipse
          {cx}
          cy={cy - hh + eh}
          rx={hw}
          ry={eh}
          {fill}
          {stroke}
          stroke-width={strokeWidth}
        />
      </g>
    {:else if shape === 'stadium'}
      <rect
        x={cx - hw}
        y={cy - hh}
        width={size.width}
        height={size.height}
        rx={hh}
        ry={hh}
        {fill}
        {stroke}
        stroke-width={strokeWidth}
      />
    {:else if shape === 'trapezoid'}
      {@const indent = size.width * 0.15}
      <polygon
        points="{cx - hw + indent},{cy - hh} {cx + hw - indent},{cy - hh} {cx + hw},{cy + hh} {cx - hw},{cy + hh}"
        {fill}
        {stroke}
        stroke-width={strokeWidth}
      />
    {:else}
      <rect
        x={cx - hw}
        y={cy - hh}
        width={size.width}
        height={size.height}
        rx="8"
        ry="8"
        {fill}
        {stroke}
        stroke-width={strokeWidth}
      />
    {/if}
  </g>

  {@render overlay?.(node, overlayContext)}

  <!-- Content -->
  <g class="node-fg" pointer-events="none">
    {#if iconPath}
      <g class="node-icon" transform="translate({cx - iconSize / 2}, {contentTop})">
        <svg
          width={iconSize}
          height={iconSize}
          viewBox="0 0 24 24"
          fill="currentColor"
          role="img"
          aria-label={specDeviceType(node.spec) ?? 'icon'}
        >
          {@html iconPath}
        </svg>
      </g>
    {/if}
    {#each parsedLabels as label, i}
      <text
        x={cx}
        y={labelStartY + i * LABEL_LINE_HEIGHT}
        class={label.className}
        text-anchor="middle"
      >
        {label.text}
      </text>
    {/each}
  </g>

  <!-- Edge hover zones for port addition (only on edges, not node interior) -->
  {#if interactive && hovered}
    {@const zone = 10}
    <!-- Top edge -->
    <rect
      x={cx - hw}
      y={cy - hh - zone / 2}
      width={size.width}
      height={zone}
      fill="transparent"
      class="edge-zone"
      onpointermove={(e) => onEdgeMove('top', e)}
      onpointerleave={() => { droplet = null }}
      onpointerdown={onEdgeDown}
    />
    <!-- Bottom edge -->
    <rect
      x={cx - hw}
      y={cy + hh - zone / 2}
      width={size.width}
      height={zone}
      fill="transparent"
      class="edge-zone"
      onpointermove={(e) => onEdgeMove('bottom', e)}
      onpointerleave={() => { droplet = null }}
      onpointerdown={onEdgeDown}
    />
    <!-- Left edge -->
    <rect
      x={cx - hw - zone / 2}
      y={cy - hh}
      width={zone}
      height={size.height}
      fill="transparent"
      class="edge-zone"
      onpointermove={(e) => onEdgeMove('left', e)}
      onpointerleave={() => { droplet = null }}
      onpointerdown={onEdgeDown}
    />
    <!-- Right edge -->
    <rect
      x={cx + hw - zone / 2}
      y={cy - hh}
      width={zone}
      height={size.height}
      fill="transparent"
      class="edge-zone"
      onpointermove={(e) => onEdgeMove('right', e)}
      onpointerleave={() => { droplet = null }}
      onpointerdown={onEdgeDown}
    />
  {/if}

  <!-- Droplet follows mouse along the hovered edge -->
  {#if droplet}
    <circle
      cx={droplet.x}
      cy={droplet.y}
      r="7"
      fill="#3b82f6"
      opacity="0.8"
      pointer-events="none"
    />
    <text
      x={droplet.x}
      y={droplet.y}
      text-anchor="middle"
      dominant-baseline="central"
      font-size="11"
      fill="white"
      pointer-events="none"
    >
      +
    </text>
  {/if}
</g>
