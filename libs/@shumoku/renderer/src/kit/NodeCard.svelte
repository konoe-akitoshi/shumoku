<script lang="ts">
  import type { Node } from '@shumoku/core'
  import { cardLook } from './card-look.js'
  import type { KitColors } from './colors.js'
  import type { Kit } from './measure.js'
  import type { Box } from './scene.js'

  let {
    node,
    box,
    colors,
    kit,
    header,
  }: {
    node: Node
    box: Box
    colors: KitColors
    kit: Kit
    /** For a host holding its guests: the height of the card's own part at the top of the box. */
    header?: number
  } = $props()

  const look = $derived(cardLook(node, box, kit, colors, header))
</script>

<g class="node" data-id={look.id} data-device-type={look.deviceType} filter="url(#node-shadow)">
  <title>{look.title}</title>
  <g class="node-bg" stroke-dasharray={look.frame.dash}>
    {#each look.frame.parts as part}
      <svelte:element this={part.tag} {...part.attrs} />
    {/each}
  </g>

  {#if look.heading}
    <line
      class="node-heading"
      x1={look.heading.x1}
      x2={look.heading.x2}
      y1={look.heading.y}
      y2={look.heading.y}
      stroke={look.heading.stroke}
      stroke-opacity={look.heading.opacity}
      stroke-width={look.heading.width}
    />
  {/if}
  <g class="node-fg" pointer-events="none">
    {#if look.icon}
      <g class="node-icon" transform="translate({look.icon.x}, {look.icon.y})">
        {#if look.icon.source.kind === 'inline'}
          <svg
            width={look.icon.size}
            height={look.icon.size}
            viewBox="0 0 24 24"
            fill="currentColor"
            role="img"
            aria-label={look.icon.label}
          >
            {@html look.icon.source.svg}
          </svg>
        {:else}
          <image
            href={look.icon.source.url}
            width={look.icon.size}
            height={look.icon.size}
            preserveAspectRatio="xMidYMid meet"
            role="img"
            aria-label={look.icon.label}
          />
        {/if}
      </g>
    {/if}
    {#each look.labels as label}
      <text x={label.x} y={label.y} class={label.className} text-anchor="start">
        {label.text}
      </text>
    {/each}
    {#if look.badge}
      <g class="node-badge" aria-label={look.badge.label}>
        <rect
          x={look.badge.box.x}
          y={look.badge.box.y}
          width={look.badge.box.width}
          height={look.badge.box.height}
          rx={look.badge.box.rx}
          fill={look.badge.fill}
          fill-opacity={look.badge.fillOpacity}
          stroke={look.badge.stroke}
          stroke-opacity={look.badge.strokeOpacity}
          stroke-width={look.badge.strokeWidth}
        />
        <text x={look.badge.textX} y={look.badge.textY} text-anchor="middle">
          {look.badge.text}
        </text>
      </g>
    {/if}
    {#if look.subtitle}
      <text x={look.subtitle.x} y={look.subtitle.y} class="node-subtitle">
        {look.subtitle.text}
      </text>
    {/if}
    {#if look.facts}
      <line
        x1={look.facts.divider.x1}
        x2={look.facts.divider.x2}
        y1={look.facts.divider.y}
        y2={look.facts.divider.y}
        stroke={look.facts.divider.stroke}
        stroke-opacity={look.facts.divider.opacity}
        stroke-width={look.facts.divider.width}
      />
      {#each look.facts.rows as row}
        <text x={row.key.x} y={row.key.y} class="node-fact-key">{row.key.text}</text>
        <text x={row.value.x} y={row.value.y} text-anchor="end" class="node-fact-value">
          {row.value.text}
        </text>
      {/each}
      {#if look.facts.more}
        <text x={look.facts.more.x} y={look.facts.more.y} class="node-subtitle">
          {look.facts.more.text}
        </text>
      {/if}
    {/if}
  </g>
</g>
