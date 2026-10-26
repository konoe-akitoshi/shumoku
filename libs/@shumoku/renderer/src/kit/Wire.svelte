<script lang="ts">
  import { type Link, linkTitle } from '@shumoku/core'
  import type { RenderColors } from '../lib/render-colors'
  import { polylinePath, vlanStroke, wireDasharray } from './geometry'
  import type { Point } from './scene'
  import { WIRE_WIDTH } from './tokens'

  let {
    link,
    points,
    colors,
  }: {
    link: Link
    points: Point[]
    colors: RenderColors
  } = $props()

  const d = $derived(polylinePath(points))
  const width = $derived(link.style?.strokeWidth ?? WIRE_WIDTH)
  const stroke = $derived(link.style?.stroke ?? vlanStroke(link.vlan) ?? colors.linkStroke)
  const gap = $derived(Math.max(3, Math.round(width * 0.9)))
  const dasharray = $derived(wireDasharray(link))
</script>

<g class="link-group" data-link-id={link.id}>
  <title>{linkTitle(link)}</title>
  {#if link.type === 'double'}
    <path
      class="link"
      {d}
      fill="none"
      {stroke}
      stroke-width={width + gap * 2}
      stroke-linecap="round"
    />
    <path {d} fill="none" stroke="white" stroke-width={Math.max(1, width)} stroke-linecap="round" />
    <path
      {d}
      fill="none"
      {stroke}
      stroke-width={Math.max(1, width - Math.round(gap * 0.8))}
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
