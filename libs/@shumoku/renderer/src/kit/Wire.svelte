<script lang="ts">
  import { type Link, linkTitle } from '@shumoku/core'
  import type { RenderColors } from '../lib/render-colors'
  import { polylinePath, vlanStroke, wireDasharray } from './geometry'
  import type { Point } from './scene'
  import type { Tokens } from './tokens'

  let {
    link,
    points,
    radii,
    stroke: given,
    colors,
    tokens,
  }: {
    link: Link
    points: Point[]
    /** The radius each vertex is rounded with. */
    radii: readonly number[]
    /** The width each line is drawn at. */
    stroke: number
    colors: RenderColors
    tokens: Tokens
  } = $props()

  const d = $derived(polylinePath(points, radii))
  const color = $derived(link.style?.stroke ?? vlanStroke(link.vlan) ?? colors.linkStroke)
  const dasharray = $derived(wireDasharray(link, tokens))
</script>

<g class="link-group" data-link-id={link.id}>
  <title>{linkTitle(link)}</title>
  {#if link.type === 'double'}
    <path
      class="link"
      {d}
      fill="none"
      stroke={color}
      stroke-width={given * tokens.wire.double.outer}
      stroke-linecap="round"
    />
    <path
      {d}
      fill="none"
      stroke={colors.background}
      stroke-width={given * tokens.wire.double.white}
      stroke-linecap="round"
    />
  {:else}
    <path
      class="link"
      {d}
      fill="none"
      stroke={color}
      stroke-width={given}
      stroke-linecap="round"
      stroke-dasharray={dasharray || undefined}
    />
  {/if}
</g>
