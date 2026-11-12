<script lang="ts">
  import type { KitColors } from './colors.js'
  import type { Kit } from './measure.js'
  import { portCaptionLook } from './port-look.js'
  import type { Point, Side } from './scene.js'

  let {
    nodeId,
    side,
    text,
    at,
    colors,
    kit,
  }: {
    nodeId: string
    side: Side
    /** The start the names of the edge share, written once. */
    text: string
    /** The corner the edge starts from. */
    at: Point
    colors: KitColors
    kit: Kit
  } = $props()

  const look = $derived(portCaptionLook({ at, side, text }, kit, colors))
</script>

{#if look}
  <g class="port-caption" data-port-device={nodeId} data-port-side={side}>
    <title>{text}</title>
    <rect
      class="port-label-bg"
      x={look.box.x}
      y={look.box.y}
      width={look.box.width}
      height={look.box.height}
      rx={look.box.rx}
      fill={look.box.fill}
    />
    <text
      class="port-caption-text"
      x={look.text.x}
      y={look.text.y}
      text-anchor={look.text.anchor}
      fill={look.text.fill}
    >
      {look.text.content}
    </text>
  </g>
{/if}
