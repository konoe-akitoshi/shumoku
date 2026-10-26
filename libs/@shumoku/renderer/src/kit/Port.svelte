<script lang="ts">
  import type { RenderColors } from '../lib/render-colors'
  import { portLabelAnchor } from './geometry'
  import { portLabelSize, type TextMetrics } from './measure'
  import type { Point, Side } from './scene'
  import { PORT } from './tokens'

  let {
    id,
    nodeId,
    label,
    at,
    side,
    colors,
    text,
  }: {
    id: string
    nodeId: string
    label?: string
    at: Point
    side: Side
    colors: RenderColors
    text: TextMetrics
  } = $props()

  const labelPos = $derived(portLabelAnchor(at, side))
  const box = $derived(portLabelSize(label, text))
  const bgX = $derived(
    labelPos.anchor === 'middle'
      ? labelPos.x - (box?.width ?? 0) / 2
      : labelPos.anchor === 'end'
        ? labelPos.x - (box?.width ?? 0) + 2
        : labelPos.x - 2,
  )
</script>

<g class="port" data-port={id} data-port-device={nodeId}>
  <rect
    class="port-box"
    x={at.x - PORT.size / 2}
    y={at.y - PORT.size / 2}
    width={PORT.size}
    height={PORT.size}
    fill={colors.portFill}
    stroke={colors.portStroke}
    stroke-width="1"
    rx="2"
  />
  {#if box}
    <rect
      class="port-label-bg"
      x={bgX}
      y={labelPos.y - box.height + 3}
      width={box.width}
      height={box.height}
      rx="2"
      fill={colors.portLabelBg}
    />
    <text
      class="port-label-text"
      x={labelPos.x}
      y={labelPos.y}
      text-anchor={labelPos.anchor}
      font-size="9"
      fill={colors.portLabelColor}
    >
      {label}
    </text>
  {/if}
</g>
