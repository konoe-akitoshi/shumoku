<script lang="ts">
  import type { ResolvedPort } from '@shumoku/core'
  import { computePortLabelPosition } from '../../lib/svg-coords'

  let {
    port,
    hideLabel = false,
    selected = false,
  }: {
    port: ResolvedPort
    hideLabel?: boolean
    selected?: boolean
  } = $props()

  const labelPos = $derived(computePortLabelPosition(port))
</script>

<g class="port" data-port-id={port.id}>
  <rect
    x={port.absolutePosition.x - port.size.width / 2 - (selected ? 2 : 0)}
    y={port.absolutePosition.y - port.size.height / 2 - (selected ? 2 : 0)}
    width={port.size.width + (selected ? 4 : 0)}
    height={port.size.height + (selected ? 4 : 0)}
    rx="2"
    fill={selected ? '#3b82f6' : '#334155'}
    stroke={selected ? '#2563eb' : '#0f172a'}
    stroke-width={selected ? 2 : 1}
  />
  {#if !hideLabel}
    <text
      x={labelPos.x}
      y={labelPos.y}
      text-anchor={labelPos.textAnchor}
      font-size="9"
      fill="#64748b"
      data-port-label={port.id}
      style="cursor: text; pointer-events: auto;"
    >
      {port.label}
    </text>
  {/if}
</g>
