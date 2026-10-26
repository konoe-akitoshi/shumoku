<script lang="ts">
  import { type Link, linkTitle } from '@shumoku/core'
  import type { RenderColors } from '../lib/render-colors'
  import { captionLeader, polylineMiddle } from './geometry'
  import { captionLines, captionSize, type Kit } from './measure'
  import type { Point } from './scene'

  let {
    link,
    points,
    at,
    colors,
    kit,
  }: {
    link: Link
    points: Point[]
    /** Where the layout put the caption; the middle of the wire when absent. */
    at?: Point
    colors: RenderColors
    kit: Kit
  } = $props()

  const tokens = $derived(kit.tokens)

  const lines = $derived(captionLines(link))
  const size = $derived(captionSize(link, kit))
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
        stroke-width={tokens.line.thin}
        stroke-opacity={tokens.opacity.leader}
      />
    {/if}
    <g class="link-caption" aria-label={linkTitle(link)}>
      <rect
        x={anchor.x - size.width / 2}
        y={anchor.y - size.height / 2}
        width={size.width}
        height={size.height}
        rx={tokens.caption.cornerRadius}
        fill={colors.nodeFill}
        stroke={colors.nodeStroke}
        stroke-opacity={tokens.opacity.line}
        stroke-width={tokens.line.thin}
      />
      {#each lines as line, i}
        <text
          x={anchor.x}
          y={anchor.y +
    (i - (lines.length - 1) / 2) * tokens.caption.lineHeight +
    tokens.text.linkCaption.shift}
          class="link-label"
          text-anchor="middle"
        >
          {line}
        </text>
      {/each}
    </g>
  </g>
{/if}
