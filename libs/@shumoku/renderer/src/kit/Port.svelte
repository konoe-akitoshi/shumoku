<script lang="ts">
  import type { KitColors } from './colors.js'
  import type { Kit } from './measure.js'
  import { portLook } from './port-look.js'
  import type { Point, Side } from './scene.js'

  let {
    id,
    nodeId,
    label,
    name,
    row,
    at,
    side,
    colors,
    kit,
  }: {
    id: string
    nodeId: string
    /** The text drawn in the chip. */
    label?: string
    /** The stored name, in full: the tooltip. */
    name?: string
    /** The row of chips the label stands in: 1 is the outer row of a top or bottom edge. */
    row?: 0 | 1
    at: Point
    side: Side
    colors: KitColors
    kit: Kit
  } = $props()

  const look = $derived(portLook({ at, side, label, row }, kit, colors))
</script>

<g class="port" data-port={id} data-port-device={nodeId}>
  {#if name}<title>{name}</title>{/if}
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
