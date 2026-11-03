<script lang="ts">
  import type { Subgraph } from '@shumoku/core'
  import type { KitColors } from './colors'
  import { groupLook } from './group-look'
  import type { Box } from './scene'
  import type { Tokens } from './tokens'

  let {
    group,
    box,
    colors,
    tokens,
  }: {
    group: Subgraph
    box: Box
    colors: KitColors
    tokens: Tokens
  } = $props()

  const look = $derived(groupLook(group, box, tokens, colors))
</script>

<g class="subgraph" data-id={look.id}>
  <rect
    class="subgraph-bg"
    x={look.frame.x}
    y={look.frame.y}
    width={look.frame.width}
    height={look.frame.height}
    rx={look.frame.rx}
    fill={look.frame.fill}
    stroke={look.frame.stroke}
    stroke-width={look.frame.strokeWidth}
    stroke-dasharray={look.frame.dash}
  />
  <text
    x={look.heading.x}
    y={look.heading.y}
    class="subgraph-label"
    text-anchor="start"
    fill={look.heading.fill}
    pointer-events="none"
  >
    {look.heading.text}
  </text>
</g>
