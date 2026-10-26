<script lang="ts">
  import { labelText, type Node, specDeviceType } from '@shumoku/core'
  import type { RenderColors } from '../lib/render-colors'
  import { sanitizeInlineIcon } from '../lib/sanitize-icon'
  import { cardContent } from './geometry'
  import type { TextMetrics } from './measure'
  import type { Box } from './scene'
  import { CARD } from './tokens'

  let {
    node,
    box,
    colors,
    text,
  }: {
    node: Node
    box: Box
    colors: RenderColors
    text: TextMetrics
  } = $props()

  const cx = $derived(box.x + box.width / 2)
  const cy = $derived(box.y + box.height / 2)
  const hw = $derived(box.width / 2)
  const hh = $derived(box.height / 2)
  const hx = $derived(hw * 0.866)
  const eh = $derived(box.height * 0.15)
  const indent = $derived(box.width * 0.15)
  const shape = $derived(node.shape ?? 'rounded')
  const content = $derived(cardContent(node, box, text))
  const icon = $derived(content.icon)

  const fill = $derived(node.style?.fill ?? colors.nodeFill)
  const stroke = $derived(node.style?.stroke ?? colors.nodeStroke)
  const strokeWidth = $derived(node.style?.strokeWidth ?? 1.5)
  const strokeDasharray = $derived(node.style?.strokeDasharray ?? (content.assumed ? '4 3' : ''))
  const labels = $derived(
    content.labels.map((line, i) => ({
      text: labelText(line),
      className: /<b>|<strong>/i.test(line)
        ? 'node-label node-label-bold'
        : i === 0
          ? 'node-label'
          : 'node-label-secondary',
    })),
  )
</script>

<g
  class="node"
  data-id={node.id}
  data-device-type={specDeviceType(node.spec) ?? ''}
  filter="url(#node-shadow)"
>
  <title>{content.title}</title>
  <g class="node-bg" stroke-dasharray={strokeDasharray || undefined}>
    {#if shape === 'rect'}
      <rect
        x={box.x}
        y={box.y}
        width={box.width}
        height={box.height}
        {fill}
        {stroke}
        stroke-width={strokeWidth}
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
      <polygon
        points="{cx - hw},{cy} {cx - hx},{cy - hh} {cx + hx},{cy - hh} {cx + hw},{cy} {cx + hx},{cy + hh} {cx - hx},{cy + hh}"
        {fill}
        {stroke}
        stroke-width={strokeWidth}
      />
    {:else if shape === 'cylinder'}
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
          x={box.x}
          y={cy - hh + eh}
          width={box.width}
          height={box.height - eh * 2}
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
        x={box.x}
        y={box.y}
        width={box.width}
        height={box.height}
        rx={hh}
        ry={hh}
        {fill}
        {stroke}
        stroke-width={strokeWidth}
      />
    {:else if shape === 'trapezoid'}
      <polygon
        points="{cx - hw + indent},{cy - hh} {cx + hw - indent},{cy - hh} {cx + hw},{cy + hh} {cx - hw},{cy + hh}"
        {fill}
        {stroke}
        stroke-width={strokeWidth}
      />
    {:else}
      <rect
        x={box.x}
        y={box.y}
        width={box.width}
        height={box.height}
        rx={CARD.cornerRadius}
        ry={CARD.cornerRadius}
        {fill}
        {stroke}
        stroke-width={strokeWidth}
      />
    {/if}
  </g>

  <g class="node-fg" pointer-events="none">
    {#if icon}
      <g class="node-icon" transform="translate({content.iconX}, {content.iconY})">
        {#if icon.kind === 'inline'}
          <svg
            width={CARD.iconSize}
            height={CARD.iconSize}
            viewBox="0 0 24 24"
            fill="currentColor"
            role="img"
            aria-label={specDeviceType(node.spec) ?? 'icon'}
          >
            {@html sanitizeInlineIcon(icon.svg)}
          </svg>
        {:else}
          <image
            href={icon.url}
            width={CARD.iconSize}
            height={CARD.iconSize}
            preserveAspectRatio="xMidYMid meet"
            role="img"
            aria-label={specDeviceType(node.spec) ?? 'icon'}
          />
        {/if}
      </g>
    {/if}
    {#each labels as label, i}
      <text
        x={content.headerX}
        y={content.labelY + i * CARD.rowHeight}
        class={label.className}
        text-anchor="start"
      >
        {label.text}
      </text>
    {/each}
    {#if content.badge}
      <g class="node-badge" aria-label={content.badge === 'VM' ? 'Virtual machine' : content.badge}>
        <rect
          x={content.badgeX}
          y={content.badgeY}
          width={content.badgeWidth}
          height={CARD.badgeHeight}
          rx="3"
          fill={colors.nodeTextSecondary}
          fill-opacity="0.08"
          stroke={colors.nodeStroke}
          stroke-opacity="0.3"
          stroke-width="0.75"
        />
        <text
          x={content.badgeX + content.badgeWidth / 2}
          y={content.badgeY + 11}
          text-anchor="middle"
        >
          {content.badge}
        </text>
      </g>
    {/if}
    {#if content.subtitle}
      <text
        x={content.headerX}
        y={content.labelY + labels.length * CARD.rowHeight}
        class="node-subtitle"
      >
        {content.subtitle}
      </text>
    {/if}
    {#if content.rows.length || content.hidden}
      <line
        x1={content.left}
        x2={content.right}
        y1={content.dividerY}
        y2={content.dividerY}
        stroke={colors.nodeStroke}
        stroke-opacity="0.2"
      />
      {#each content.rows as row, i}
        <text x={content.left} y={content.rowY + i * CARD.rowHeight} class="node-fact-key">
          {row.label}
        </text>
        <text
          x={content.right}
          y={content.rowY + i * CARD.rowHeight}
          text-anchor="end"
          class="node-fact-value"
        >
          {row.value}
        </text>
      {/each}
      {#if content.hidden}
        <text
          x={content.left}
          y={content.rowY + content.rows.length * CARD.rowHeight}
          class="node-subtitle"
        >
          +{content.hidden}
          more
        </text>
      {/if}
    {/if}
  </g>
</g>
