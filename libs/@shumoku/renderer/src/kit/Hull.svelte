<script lang="ts">
  import type { RenderColors } from '../lib/render-colors'
  import { buildHaHullPath } from './hull-geometry'
  import type { Box } from './scene'

  let {
    members,
    seams = [],
    kind,
    colors,
  }: {
    /** Boxes of the nodes inside the outline. */
    members: Box[]
    /** Heights at which the wires between neighbours cross, left to right. */
    seams?: { y: number }[]
    kind?: string
    colors: RenderColors
  } = $props()

  const hull = $derived(buildHaHullPath({ members, seams }))
</script>

{#if hull.d}
  <g class="ha-hull" pointer-events="none">
    <path d={hull.d} fill={colors.haHullFill} />
    {#if kind}
      <text
        class="ha-hull-label"
        x={hull.bounds.x + 2}
        y={hull.bounds.y - 6}
        font-size="9"
        letter-spacing="0.08em"
        fill={colors.textSecondary}
      >
        {kind.toUpperCase()}
      </text>
    {/if}
  </g>
{/if}
