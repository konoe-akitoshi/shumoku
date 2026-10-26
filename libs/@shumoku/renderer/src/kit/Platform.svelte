<script lang="ts">
  import type { Node } from '@shumoku/core'
  import type { RenderColors } from '../lib/render-colors'
  import { type Kit, platformHosts, platformNode } from './measure'
  import NodeCard from './NodeCard.svelte'
  import type { Box } from './scene'

  let {
    platform,
    colors,
    kit,
  }: {
    platform: {
      id: string
      label: string
      box: Box
      stack: Box[]
      hosts: Node[]
      workloads: { node: Node; box?: Box }[]
      nested: boolean
    }
    colors: RenderColors
    kit: Kit
  } = $props()

  const tokens = $derived(kit.tokens)
  const p = $derived(tokens.platform)
  const box = $derived(platform.box)
  const card = $derived(
    platformNode(
      platform.label,
      platform.hosts,
      platform.workloads.map((w) => w.node),
      tokens,
    ),
  )
  const hostLine = $derived(platformHosts(platform.hosts))
</script>

<g class="platform" data-id={platform.id}>
  <title>{platform.label}</title>
  {#if platform.nested}
    <rect
      x={box.x}
      y={box.y}
      width={box.width}
      height={box.height}
      rx={p.cornerRadius}
      ry={p.cornerRadius}
      fill={colors.nodeFill}
      stroke={colors.nodeStroke}
      stroke-width={tokens.line.base}
      filter="url(#node-shadow)"
    />
    <g pointer-events="none">
      <text
        class="platform-label"
        x={box.x + p.pad}
        y={box.y + p.pad + p.labelHeight / 2 + tokens.text.platformLabel.shift}
      >
        {platform.label}
      </text>
      {#if hostLine}
        <text
          class="node-subtitle"
          x={box.x + p.pad}
          y={box.y + p.pad + p.labelHeight + p.labelHeight / 2 + tokens.text.nodeText.shift}
        >
          {hostLine}
        </text>
      {/if}
    </g>
    {#each platform.workloads as { node, box: inner } (node.id)}
      {#if inner}
        <g transform="translate({inner.x} {inner.y}) scale({p.nestedScale})">
          <NodeCard
            {node}
            box={{
    x: 0,
    y: 0,
    width: inner.width / p.nestedScale,
    height: inner.height / p.nestedScale,
  }}
            {colors}
            {kit}
          />
        </g>
      {/if}
    {/each}
  {:else}
    {#each platform.stack as outline}
      <rect
        x={outline.x}
        y={outline.y}
        width={outline.width}
        height={outline.height}
        rx={tokens.card.cornerRadius}
        ry={tokens.card.cornerRadius}
        fill={colors.nodeFill}
        stroke={colors.nodeStroke}
        stroke-width={tokens.line.base}
        filter="url(#node-shadow)"
      />
    {/each}
    <NodeCard node={card} {box} {colors} {kit} />
  {/if}
</g>
