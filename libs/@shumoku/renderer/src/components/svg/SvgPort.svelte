<script lang="ts">
  import type { ResolvedPort } from '@shumoku/core'
  import { SMALL_LABEL_CHAR_WIDTH } from '@shumoku/core'
  import type { RenderColors } from '../../lib/render-colors'
  import { computePortLabelPosition } from '../../lib/svg-coords'

  let {
    port,
    colors,
    hideLabel = false,
    selected = false,
  }: {
    port: ResolvedPort
    colors: RenderColors
    hideLabel?: boolean
    selected?: boolean
  } = $props()

  const px = $derived(port.absolutePosition.x)
  const py = $derived(port.absolutePosition.y)
  const pw = $derived(port.size.width)
  const ph = $derived(port.size.height)

  const labelPos = $derived(computePortLabelPosition(port))

  // Label background sizing: same as svg.ts renderResolvedPort
  const labelWidth = $derived(port.label.length * SMALL_LABEL_CHAR_WIDTH + 4)
  const labelHeight = 12

  const bgX = $derived(() => {
    if (labelPos.textAnchor === 'middle') return labelPos.x - labelWidth / 2
    if (labelPos.textAnchor === 'end') return labelPos.x - labelWidth + 2
    return labelPos.x - 2
  })
  const bgY = $derived(labelPos.y - labelHeight + 3)
</script>

<g class="port" data-port={port.id} data-port-device={port.nodeId}>
  <!-- Port box -->
  <rect
    class="port-box"
    x={px - pw / 2}
    y={py - ph / 2}
    width={pw}
    height={ph}
    fill={selected ? colors.selection : colors.portFill}
    stroke={selected ? colors.selection : colors.portStroke}
    stroke-width="1"
    rx="2"
  />

  {#if !hideLabel}
    <!-- Port label background -->
    <rect
      class="port-label-bg"
      x={bgX()}
      y={bgY}
      width={labelWidth}
      height={labelHeight}
      rx="2"
      fill={colors.portLabelBg}
    />
    <!-- Port label text -->
    <text
      class="port-label"
      x={labelPos.x}
      y={labelPos.y}
      text-anchor={labelPos.textAnchor}
      font-size="9"
      fill={colors.portLabelColor}
      data-port-label={port.id}
      style="cursor: text; pointer-events: auto;"
    >
      {port.label}
    </text>
  {/if}
</g>
