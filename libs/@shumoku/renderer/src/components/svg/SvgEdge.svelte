<script lang="ts">
  import type { ResolvedEdge } from '@shumoku/core'
  import type { LinkOverlaySnippet } from '../../lib/overlays'
  import type { RenderColors } from '../../lib/render-colors'
  import { computePortLabelPosition, getVlanStroke, pointsToPathD } from '../../lib/svg-coords'

  let {
    edge,
    colors,
    selected = false,
    overlay,
    onselect,
    oncontextmenu: onctx,
  }: {
    edge: ResolvedEdge
    colors: RenderColors
    selected?: boolean
    overlay?: LinkOverlaySnippet
    onselect?: (edgeId: string) => void
    oncontextmenu?: (edgeId: string, e: MouseEvent) => void
  } = $props()

  const pathD = $derived(pointsToPathD(edge.points))
  const link = $derived(edge.link)
  const linkType = $derived(link?.type ?? 'solid')
  const dasharray = $derived(() => {
    switch (linkType) {
      case 'dashed':
        return '5 3'
      default:
        return link?.style?.strokeDasharray ?? ''
    }
  })
  const strokeColor = $derived(
    selected
      ? colors.selection
      : (link?.style?.stroke ?? getVlanStroke(link?.vlan) ?? colors.linkStroke),
  )
  const isDouble = $derived(linkType === 'double')

  const linkLabel = $derived(() => {
    if (!link?.label) return []
    const text = Array.isArray(link.label) ? link.label.join(' / ') : link.label
    return [text]
  })
  const vlanLabel = $derived(() => {
    if (!link?.vlan || link.vlan.length === 0) return ''
    return link.vlan.length === 1 ? `VLAN ${link.vlan[0]}` : `VLAN ${link.vlan.join(', ')}`
  })
  const midpoint = $derived(() => {
    if (edge.points.length < 2) return null
    const midIdx = Math.floor(edge.points.length / 2)
    const a = edge.points[midIdx - 1]
    const b = edge.points[midIdx]
    if (!a || !b) return null
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
  })
  let basePathElement = $state<SVGPathElement | null>(null)
  const overlayContext = $derived({
    selected,
    pathElement: basePathElement,
    pathD,
    width: edge.width,
    fromPort: edge.fromPort,
    toPort: edge.toPort,
    fromPortPosition: edge.fromPort?.absolutePosition ?? null,
    toPortPosition: edge.toPort?.absolutePosition ?? null,
    fromPortLabelPosition: edge.fromPort ? computePortLabelPosition(edge.fromPort) : null,
    toPortLabelPosition: edge.toPort ? computePortLabelPosition(edge.toPort) : null,
  })

  function onclick(e: MouseEvent) {
    e.stopPropagation()
    onselect?.(edge.id)
  }

  function handleContextMenu(e: MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    onselect?.(edge.id)
    onctx?.(edge.id, e)
  }
</script>

<g class="link-group" data-link-id={edge.id}>
  {#if isDouble}
    {@const gap = Math.max(3, Math.round(edge.width * 0.9))}
    <path
      bind:this={basePathElement}
      d={pathD}
      fill="none"
      stroke={strokeColor}
      stroke-width={edge.width + gap * 2}
      stroke-linecap="round"
      pointer-events="none"
    />
    <path
      d={pathD}
      fill="none"
      stroke="white"
      stroke-width={Math.max(1, edge.width)}
      stroke-linecap="round"
      pointer-events="none"
    />
    <path
      d={pathD}
      fill="none"
      stroke={strokeColor}
      stroke-width={Math.max(1, edge.width - Math.round(gap * 0.8))}
      stroke-linecap="round"
      pointer-events="none"
    />
  {:else}
    <path
      bind:this={basePathElement}
      class="link"
      d={pathD}
      fill="none"
      stroke={strokeColor}
      stroke-width={edge.width}
      stroke-linecap="round"
      stroke-dasharray={dasharray() || undefined}
      pointer-events="none"
    />
  {/if}

  {@render overlay?.(edge, overlayContext)}

  <!-- Hit area -->
  <path
    d={pathD}
    fill="none"
    stroke="transparent"
    stroke-width={Math.max(edge.width + 12, 16)}
    stroke-linecap="round"
    class="link-hit"
    {onclick}
    oncontextmenu={handleContextMenu}
  />

  {#if midpoint()}
    {@const mp = midpoint()}
    {#if mp}
      {@const labels = linkLabel()}
      {@const vlan = vlanLabel()}
      {#each labels as label, i}
        <text x={mp.x} y={mp.y - 8 + i * 12} class="link-label" text-anchor="middle">{label}</text>
      {/each}
      {#if vlan}
        <text x={mp.x} y={mp.y - 8 + labels.length * 12} class="link-label" text-anchor="middle">
          {vlan}
        </text>
      {/if}
    {/if}
  {/if}
</g>
