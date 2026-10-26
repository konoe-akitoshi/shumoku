<script lang="ts">
  import { type Link, linkTitle } from '@shumoku/core'
  import type { RenderColors } from '../lib/render-colors'
  import { captionLeader, polylineMiddle } from './geometry'
  import { captionLines, captionSize, type TextMetrics } from './measure'
  import type { Point } from './scene'
  import { CAPTION } from './tokens'

  let {
    link,
    points,
    at,
    colors,
    text,
  }: {
    link: Link
    points: Point[]
    /** Where the layout put the caption; the middle of the wire when absent. */
    at?: Point
    colors: RenderColors
    text: TextMetrics
  } = $props()

  const lines = $derived(captionLines(link))
  const size = $derived(captionSize(link, text))
  const anchor = $derived(at ?? polylineMiddle(points))
  const leader = $derived(at && size ? captionLeader(points, at, size) : undefined)
</script>

{#if anchor && size}
  <g class="link-caption-group" data-link-id={link.id}>
    {#if leader}
      <line
        class="link-caption-leader"
        x1={leader.from.x}
        y1={leader.from.y}
        x2={leader.to.x}
        y2={leader.to.y}
        stroke={colors.linkStroke}
        stroke-width="1"
        stroke-opacity="0.45"
      />
    {/if}
    <g class="link-caption" aria-label={linkTitle(link)}>
      <rect
        x={anchor.x - size.width / 2}
        y={anchor.y - size.height / 2}
        width={size.width}
        height={size.height}
        rx={CAPTION.cornerRadius}
        fill={colors.nodeFill}
        stroke={colors.nodeStroke}
        stroke-opacity="0.25"
      />
      {#each lines as line, i}
        <text
          x={anchor.x}
          y={anchor.y + (i - (lines.length - 1) / 2) * CAPTION.lineHeight + 3}
          class="link-label"
          text-anchor="middle"
        >
          {line}
        </text>
      {/each}
    </g>
  </g>
{/if}
