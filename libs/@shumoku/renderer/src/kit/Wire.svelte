<script lang="ts">
  import { type Link, linkTitle } from '@shumoku/core'
  import type { KitColors } from './colors'
  import type { Point } from './scene'
  import type { Tokens } from './tokens'
  import { wireLook } from './wire-look'

  let {
    link,
    points,
    radii,
    stroke,
    vlans,
    colors,
    tokens,
  }: {
    link: Link
    points: Point[]
    /** The radius each vertex is rounded with. */
    radii: readonly number[]
    /** The width each line is drawn at. */
    stroke: number
    /** The colour of each VLAN set in the diagram. */
    vlans: ReadonlyMap<string, string>
    colors: KitColors
    tokens: Tokens
  } = $props()

  const look = $derived(wireLook({ link, points, radii, stroke, vlans }, tokens, colors))
</script>

<g class="link-group" data-link-id={link.id}>
  <title>{linkTitle(link)}</title>
  <path
    class="link"
    d={look.d}
    fill="none"
    stroke={look.color}
    stroke-width={look.stroke}
    stroke-linecap="round"
    stroke-dasharray={look.dash?.join(' ')}
  />
</g>
