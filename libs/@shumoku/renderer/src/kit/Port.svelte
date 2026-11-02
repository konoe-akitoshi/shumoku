<script lang="ts">
  import type { KitColors } from './colors'
  import type { Kit } from './measure'
  import { portLook } from './port-look'
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
    colors: KitColors
    kit: Kit
  } = $props()

  const look = $derived(portLook({ at, side, label }, kit, colors))
</script>

<g class="port" data-port={id} data-port-device={nodeId}>
  <rect
    class="port-box"
    x={look.marker.x}
    y={look.marker.y}
    width={look.marker.size}
    height={look.marker.size}
    rx={look.marker.rx}
    fill={look.marker.fill}
    stroke={look.marker.stroke}
    stroke-width={look.marker.strokeWidth}
  />
  {#if look.label}
    <rect
      class="port-label-bg"
      x={look.label.box.x}
      y={look.label.box.y}
      width={look.label.box.width}
      height={look.label.box.height}
      rx={look.label.box.rx}
      fill={look.label.box.fill}
    />
    <text
      class="port-label-text"
      x={look.label.text.x}
      y={look.label.text.y}
      text-anchor={look.label.text.anchor}
      fill={look.label.text.fill}
    >
      {look.label.text.content}
    </text>
  {/if}
</g>
