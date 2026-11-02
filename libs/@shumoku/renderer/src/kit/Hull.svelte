<script lang="ts">
  import type { RenderColors } from '../lib/render-colors'
  import { buildHaHullPath } from './hull-geometry'
  import type { Box } from './scene'
  import type { Tokens } from './tokens'

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
    colors: RenderColors
    tokens: Tokens
  } = $props()

  const hull = $derived(
    buildHaHullPath(
      { members: boxes, seams: seams.map((y) => ({ y })) },
      {
        pad: tokens.hull.pad,
        outerR: tokens.hull.outerRadius,
        notchH: tokens.hull.notchHeight,
        notchMin: tokens.hull.notchMin,
        filletR: tokens.hull.filletRadius,
      },
    ),
  )
</script>

{#if hull.d}
  <g class="ha-hull" pointer-events="none">
    <path d={hull.d} fill={colors.haHullFill} />
    {#if kind}
      <text
        class="ha-hull-label"
        x={hull.bounds.x + tokens.hull.labelX}
        y={hull.bounds.y - tokens.hull.labelY}
        fill={colors.textSecondary}
      >
        {kind.toUpperCase()}
      </text>
    {/if}
  </g>
{/if}
