<script lang="ts">
  import type { KitColors } from './colors.js'
  import { hullLook } from './hull-look.js'
  import type { Box } from './scene.js'
  import type { Tokens } from './tokens.js'

  let {
    boxes,
    seams,
    kind,
    colors,
    tokens,
  }: {
    /** Boxes of the nodes inside the outline, left to right. */
    boxes: Box[]
    /** Heights at which the wires between neighbours cross, left to right. */
    seams: number[]
    kind?: string
    colors: KitColors
    tokens: Tokens
  } = $props()

  const look = $derived(hullLook({ boxes, seams, kind }, tokens, colors))
</script>

{#if look}
  <g class="ha-hull" pointer-events="none">
    <path d={look.d} fill={look.fill} />
    {#if look.label}
      <text class="ha-hull-label" x={look.label.x} y={look.label.y} fill={look.label.fill}>
        {look.label.text}
      </text>
    {/if}
  </g>
{/if}
