<script lang="ts">
  import { type Link, linkTitle } from '@shumoku/core'
  import { captionLook } from './caption-look.js'
  import type { KitColors } from './colors.js'
  import type { Kit } from './measure.js'
  import type { Point } from './scene.js'

  let {
    link,
    at,
    colors,
    kit,
  }: {
    link: Link
    /** Where the layout put the caption. */
    at: Point
    colors: KitColors
    kit: Kit
  } = $props()

  const look = $derived(captionLook(link, at, kit, colors))
</script>

{#if look}
  <g class="link-caption-group" data-link-id={link.id}>
    <g class="link-caption" aria-label={linkTitle(link)}>
      <rect
        x={look.box.x}
        y={look.box.y}
        width={look.box.width}
        height={look.box.height}
        rx={look.box.rx}
        fill={look.box.fill}
        stroke={look.box.stroke}
        stroke-opacity={look.box.strokeOpacity}
        stroke-width={look.box.strokeWidth}
      />
      {#each look.lines as line}
        <text x={line.x} y={line.y} class="link-label" text-anchor="middle">
          {line.text}
        </text>
      {/each}
    </g>
  </g>
{/if}
