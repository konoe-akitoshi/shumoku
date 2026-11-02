<script lang="ts">
  import { type Link, linkTitle } from '@shumoku/core'
  import type { RenderColors } from '../lib/render-colors'
  import { polylinePath } from './geometry'
  import type { Point } from './scene'
  import type { Tokens } from './tokens'
  import { wireLook } from './wire-look'

  let {
    link,
    points,
    radii,
    stroke,
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

  // One path, so a dash runs on unbroken round every arc and diagonal.
  const d = $derived(polylinePath(points, radii))
  const look = $derived(wireLook({ link, stroke }, tokens, colors))
</script>

<g class="link-group" data-link-id={link.id}>
  <title>{linkTitle(link)}</title>
  <path
    class="link"
    {d}
    fill="none"
    stroke={look.color}
    stroke-width={look.stroke}
    stroke-linecap="round"
    stroke-dasharray={look.dash?.join(' ')}
  />
</g>
