<script lang="ts">
  import type { RenderColors } from '../lib/render-colors'
  import { portLabelAnchor } from './geometry'
  import { type Kit, portLabelSize } from './measure'
  import type { Point, Side } from './scene'

  let {
    id,
    nodeId,
    label,
    at,
    side,
    colors,
    kit,
  }: {
    id: string
    nodeId: string
    label?: string
    at: Point
    side: Side
    colors: RenderColors
    kit: Kit
  } = $props()

  const tokens = $derived(kit.tokens)
  const labelPos = $derived(portLabelAnchor(at, side, tokens))
  const box = $derived(portLabelSize(label, kit))
  /** The text sits inside its box, half the padding in from the near edge. */
  const bgX = $derived.by(() => {
    const width = box?.width ?? 0
    const inset = tokens.port.labelPadding / 2
    if (labelPos.anchor === 'middle') return labelPos.x - width / 2
    return labelPos.anchor === 'end' ? labelPos.x - width + inset : labelPos.x - inset
  })
</script>

<g class="port" data-port={id} data-port-device={nodeId}>
  <rect
    class="port-box"
    x={at.x - tokens.port.size / 2}
    y={at.y - tokens.port.size / 2}
    width={tokens.port.size}
    height={tokens.port.size}
    fill={colors.portFill}
    stroke={colors.portStroke}
    stroke-width={tokens.line.thin}
    rx={tokens.port.cornerRadius}
  />
  {#if box}
    <rect
      class="port-label-bg"
      x={bgX}
      y={labelPos.y - box.height / 2}
      width={box.width}
      height={box.height}
      rx={tokens.port.labelCornerRadius}
      fill={colors.portLabelBg}
    />
    <text
      class="port-label-text"
      x={labelPos.x}
      y={labelPos.y + tokens.text.portLabel.shift}
      text-anchor={labelPos.anchor}
      fill={colors.portLabelColor}
    >
      {label}
    </text>
  {/if}
</g>
