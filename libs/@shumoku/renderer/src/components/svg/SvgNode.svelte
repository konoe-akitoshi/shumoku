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
    highlighted = false,
  }: {
    node: ResolvedNode
    colors: RenderColors
    shadowFilterId?: string
    selected?: boolean
    highlighted?: boolean
  } = $props()

  const cx = $derived(node.position.x)
  const cy = $derived(node.position.y)
  const hw = $derived(node.size.width / 2)
  const hh = $derived(node.size.height / 2)
  const active = $derived(selected || highlighted)
  const shape = $derived(node.node.shape ?? 'rounded')

  // Colors: same logic as svg.ts renderNodeBackground
  const fill = $derived(node.node.style?.fill ?? (active ? colors.nodeHoverFill : colors.nodeFill))
  const stroke = $derived(node.node.style?.stroke ?? (active ? colors.nodeHoverStroke : colors.nodeStroke))
  const strokeWidth = $derived(node.node.style?.strokeWidth ?? (active ? 2 : 1.5))
  const strokeDasharray = $derived(node.node.style?.strokeDasharray ?? '')

  // Icon: same logic as svg.ts calculateIconInfo (device type fallback only for now)
  const iconPath = $derived(getDeviceIcon(node.node.type))
  const iconSize = DEFAULT_ICON_SIZE

  // Labels: same logic as svg.ts renderNodeContent
  const labels = $derived(
    Array.isArray(node.node.label) ? node.node.label : [node.node.label ?? ''],
  )
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

  // Vertical centering: same as svg.ts
  const iconHeight = $derived(iconPath ? iconSize : 0)
  const gap = $derived(iconHeight > 0 ? ICON_LABEL_GAP : 0)
  const labelHeight = $derived(parsedLabels.length * LABEL_LINE_HEIGHT)
  const totalContentHeight = $derived(iconHeight + gap + labelHeight)
  const contentTop = $derived(cy - totalContentHeight / 2)
  const labelStartY = $derived(contentTop + iconHeight + gap + LABEL_LINE_HEIGHT * 0.7)
</script>

<g
  class="node"
  data-id={node.id}
  data-device-type={node.node.type ?? ''}
  filter="url(#{shadowFilterId})"
>
  <!-- Background shape (renderNodeBackground) -->
  <g class="node-bg" data-id={node.id}>
    {#if shape === 'rect'}
      <rect x={cx - hw} y={cy - hh} width={node.size.width} height={node.size.height}
        {fill} {stroke} stroke-width={strokeWidth} stroke-dasharray={strokeDasharray || undefined} />
    {:else if shape === 'rounded'}
      <rect x={cx - hw} y={cy - hh} width={node.size.width} height={node.size.height}
        rx="8" ry="8" {fill} {stroke} stroke-width={strokeWidth} stroke-dasharray={strokeDasharray || undefined} />
    {:else if shape === 'circle'}
      <circle cx={cx} cy={cy} r={Math.min(hw, hh)} {fill} {stroke} stroke-width={strokeWidth} stroke-dasharray={strokeDasharray || undefined} />
    {:else if shape === 'diamond'}
      <polygon points="{cx},{cy - hh} {cx + hw},{cy} {cx},{cy + hh} {cx - hw},{cy}"
        {fill} {stroke} stroke-width={strokeWidth} stroke-dasharray={strokeDasharray || undefined} />
    {:else if shape === 'hexagon'}
      {@const hx = hw * 0.866}
      <polygon points="{cx - hw},{cy} {cx - hx},{cy - hh} {cx + hx},{cy - hh} {cx + hw},{cy} {cx + hx},{cy + hh} {cx - hx},{cy + hh}"
        {fill} {stroke} stroke-width={strokeWidth} stroke-dasharray={strokeDasharray || undefined} />
    {:else if shape === 'cylinder'}
      {@const eh = node.size.height * 0.15}
      <g>
        <ellipse cx={cx} cy={cy + hh - eh} rx={hw} ry={eh} {fill} {stroke} stroke-width={strokeWidth} stroke-dasharray={strokeDasharray || undefined} />
        <rect x={cx - hw} y={cy - hh + eh} width={node.size.width} height={node.size.height - eh * 2} {fill} stroke="none" />
        <line x1={cx - hw} y1={cy - hh + eh} x2={cx - hw} y2={cy + hh - eh} {stroke} stroke-width={strokeWidth} />
        <line x1={cx + hw} y1={cy - hh + eh} x2={cx + hw} y2={cy + hh - eh} {stroke} stroke-width={strokeWidth} />
        <ellipse cx={cx} cy={cy - hh + eh} rx={hw} ry={eh} {fill} {stroke} stroke-width={strokeWidth} stroke-dasharray={strokeDasharray || undefined} />
      </g>
    {:else if shape === 'stadium'}
      <rect x={cx - hw} y={cy - hh} width={node.size.width} height={node.size.height}
        rx={hh} ry={hh} {fill} {stroke} stroke-width={strokeWidth} stroke-dasharray={strokeDasharray || undefined} />
    {:else if shape === 'trapezoid'}
      {@const indent = node.size.width * 0.15}
      <polygon points="{cx - hw + indent},{cy - hh} {cx + hw - indent},{cy - hh} {cx + hw},{cy + hh} {cx - hw},{cy + hh}"
        {fill} {stroke} stroke-width={strokeWidth} stroke-dasharray={strokeDasharray || undefined} />
    {:else}
      <rect x={cx - hw} y={cy - hh} width={node.size.width} height={node.size.height}
        rx="4" ry="4" {fill} {stroke} stroke-width={strokeWidth} stroke-dasharray={strokeDasharray || undefined} />
    {/if}
  </g>

  <!-- Foreground content (renderNodeContent) -->
  <g class="node-fg" data-id={node.id}>
    <!-- Icon -->
    {#if iconPath}
      <g class="node-icon" transform="translate({cx - iconSize / 2}, {contentTop})">
        <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="currentColor">
          {@html iconPath}
        </svg>
      </g>
    {/if}

    <!-- Labels -->
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
</g>
