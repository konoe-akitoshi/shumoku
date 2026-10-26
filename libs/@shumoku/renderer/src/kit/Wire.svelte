<script lang="ts">
  import { type Link, linkTitle } from '@shumoku/core'
  import type { RenderColors } from '../lib/render-colors'
  import { polylinePath, vlanStroke, wireDasharray } from './geometry'
  import type { Point } from './scene'
  import type { Tokens } from './tokens'

  let {
    link,
    points,
    colors,
    tokens,
  }: {
    link: Link
    points: Point[]
    colors: RenderColors
    tokens: Tokens
  } = $props()

  const d = $derived(polylinePath(points, tokens.wire.cornerRadius))
  const width = $derived(link.style?.strokeWidth ?? tokens.line.bold)
  const stroke = $derived(link.style?.stroke ?? vlanStroke(link.vlan) ?? colors.linkStroke)
  const dasharray = $derived(wireDasharray(link, tokens))
</script>

<g class="link-group" data-link-id={link.id}>
  <title>{linkTitle(link)}</title>
  {#if link.type === 'double'}
    <path
      class="link"
      {d}
      fill="none"
      {stroke}
      stroke-width={width * tokens.wire.double.outer}
      stroke-linecap="round"
    />
    <path {d} fill="none" stroke="white" stroke-width={width} stroke-linecap="round" />
    <path
      {d}
      fill="none"
      {stroke}
      stroke-width={width * tokens.wire.double.core}
      stroke-linecap="round"
    />
  {:else}
    <path
      class={link.redundancy ? 'link link-ha' : 'link'}
      {d}
      fill="none"
      {stroke}
      stroke-width={width}
      stroke-linecap="round"
      stroke-dasharray={dasharray || undefined}
    />
  {/if}
</g>
