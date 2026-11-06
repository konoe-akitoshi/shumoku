<script lang="ts">
  import type { Link } from '@shumoku/core'
  import type { Point } from '../kit/scene.js'
  import { polylinePath } from '../kit/wire-look.js'
  import type { LinkOverlayContext, LinkOverlaySnippet } from '../lib/overlays.js'

  // Hands a wire to the host's link overlay with the elements the kit drew for it. The elements
  // exist only once the wire is mounted, so they are looked up after each draw.
  let {
    svgElement,
    link,
    points,
    radii,
    stroke,
    selected,
    overlay,
  }: {
    svgElement: SVGSVGElement | null
    link: Link
    points: Point[]
    radii: number[]
    stroke: number
    selected: boolean
    overlay: LinkOverlaySnippet
  } = $props()

  let groupElement = $state<SVGGElement | null>(null)

  $effect(() => {
    // Looked up again after each draw: the wire's group is reused by id but may be replaced.
    void points
    const id = link.id
    groupElement =
      svgElement && id !== undefined
        ? svgElement.querySelector<SVGGElement>(`g.link-group[data-link-id="${CSS.escape(id)}"]`)
        : null
  })

  const context = $derived<LinkOverlayContext>({
    selected,
    groupElement,
    pathElement: groupElement?.querySelector<SVGPathElement>('path.link') ?? null,
    pathD: polylinePath(points, radii),
    width: stroke,
    routePoints: points,
    radii,
  })
</script>

{@render overlay(link, context)}
