<script lang="ts">
  import type { ResolvedEdge } from '@shumoku/core'
  import type { LinkOverlaySnippet } from '../../lib/overlays'
  import type { RenderColors } from '../../lib/render-colors'
  import { bezierEdgePath, computePortLabelPosition, getVlanStroke } from '../../lib/svg-coords'

  let {
    edge,
    colors,
    selected = false,
    overlay,
    onselect,
    oncontextmenu: onctx,
    preventContextMenuDefault = true,
  }: {
    edge: ResolvedEdge
    colors: RenderColors
    selected?: boolean
    overlay?: LinkOverlaySnippet
    /** Click / right-click on this edge. Receives the original event so the
     *  renderer can read modifier keys for additive multi-selection. */
    onselect?: (edgeId: string, e?: MouseEvent) => void
    oncontextmenu?: (edgeId: string, e: MouseEvent) => void
    preventContextMenuDefault?: boolean
  } = $props()

  // Every edge renders as a cubic Bezier flowing out of the source
  // port's normal direction and into the dest port's. The port
  // positions live on `edge.fromPort` / `edge.toPort`; `edge.points`
  // is no longer consulted for the drawn stroke (it's still on the
  // edge for label midpoint + hit testing, but reduced to a degenerate
  // 2-point line by the router pass).
  // Lateral offsets fan multiple edges sharing one port apart at the
  // shared endpoint. Router (`route-edges.ts`) assigns offsets per
  // group of edges; the bezier path computer applies them perpendicular
  // to the port's outward normal.
  //
  // Edges with `edge.route` set were routed orthogonally (bus / polyline)
  // by the router and override the default Bezier; the polyline points
  // are drawn as right-angle segments with rounded corners.
  const pathD = $derived(
    edge.route
      ? polylinePath(edge.route.points)
      : edge.fromPort && edge.toPort
        ? bezierEdgePath(
            { ...edge.fromPort, lateralOffset: edge.fromLateralOffset },
            { ...edge.toPort, lateralOffset: edge.toLateralOffset },
          )
        : `M ${edge.points[0]?.x ?? 0} ${edge.points[0]?.y ?? 0} L ${edge.points[1]?.x ?? 0} ${edge.points[1]?.y ?? 0}`,
  )

  /**
   * Polyline path with optional corner rounding. Standard SVG L
   * segments at every joint give a hard 90° look; in practice
   * network-diagram convention prefers a small radius so the eye
   * registers the corner without it being aggressively crisp.
   */
  function polylinePath(pts: { x: number; y: number }[]): string {
    if (pts.length === 0) return ''
    if (pts.length === 1) return `M ${pts[0]?.x ?? 0} ${pts[0]?.y ?? 0}`
    const r = 6
    let d = `M ${pts[0]?.x ?? 0} ${pts[0]?.y ?? 0}`
    for (let i = 1; i < pts.length - 1; i++) {
      const prev = pts[i - 1]
      const curr = pts[i]
      const next = pts[i + 1]
      if (!prev || !curr || !next) continue
      const dxIn = curr.x - prev.x
      const dyIn = curr.y - prev.y
      const dxOut = next.x - curr.x
      const dyOut = next.y - curr.y
      const lenIn = Math.hypot(dxIn, dyIn)
      const lenOut = Math.hypot(dxOut, dyOut)
      if (lenIn < 1 || lenOut < 1) {
        d += ` L ${curr.x} ${curr.y}`
        continue
      }
      const ri = Math.min(r, lenIn / 2, lenOut / 2)
      const inX = curr.x - (dxIn / lenIn) * ri
      const inY = curr.y - (dyIn / lenIn) * ri
      const outX = curr.x + (dxOut / lenOut) * ri
      const outY = curr.y + (dyOut / lenOut) * ri
      d += ` L ${inX} ${inY} Q ${curr.x} ${curr.y} ${outX} ${outY}`
    }
    const last = pts[pts.length - 1]
    if (last) d += ` L ${last.x} ${last.y}`
    return d
  }
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
  // v3 semantic grammar: redundancy links (HA/VC/vPC/MLAG/stack heartbeats)
  // are a COUPLING, not a wire — drawn as a double "glasses" bridge between
  // the two member devices instead of a routed stroke.
  const isCoupling = $derived(link?.redundancy !== undefined || edge.coupling === true)
  const couplingLines = $derived(() => {
    const a = edge.fromPort?.absolutePosition ?? edge.points[0]
    const b = edge.toPort?.absolutePosition ?? edge.points[edge.points.length - 1]
    if (!a || !b) return []
    const dx = b.x - a.x
    const dy = b.y - a.y
    const len = Math.hypot(dx, dy)
    if (len < 1) return []
    const px = (-dy / len) * 3.5
    const py = (dx / len) * 3.5
    return [
      `M ${a.x + px} ${a.y + py} L ${b.x + px} ${b.y + py}`,
      `M ${a.x - px} ${a.y - py} L ${b.x - px} ${b.y - py}`,
    ]
  })
  // primary dependency tree reads as the skeleton; everything else is context
  const strokeOpacity = $derived(
    edge.emphasis === 'secondary' ? 0.45 : edge.emphasis === 'primary' ? 1 : 1,
  )

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
    // layout-chosen anchor (label-placement routing stage) wins; the
    // geometric midpoint is only the fallback
    if (edge.labelAnchor) return edge.labelAnchor
    if (edge.points.length < 2) return null
    const midIdx = Math.floor(edge.points.length / 2)
    const a = edge.points[midIdx - 1]
    const b = edge.points[midIdx]
    if (!a || !b) return null
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
  })
  let basePathElement = $state<SVGPathElement | null>(null)
  let groupElement = $state<SVGGElement | null>(null)
  const overlayContext = $derived({
    selected,
    groupElement,
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
    onselect?.(edge.id, e)
  }

  function handleContextMenu(e: MouseEvent) {
    if (preventContextMenuDefault) e.preventDefault()
    onselect?.(edge.id, e)
    onctx?.(edge.id, e)
  }
</script>

<g class="link-group" data-link-id={edge.id} bind:this={groupElement}>
  {#if isCoupling && couplingLines().length === 2}
    {@const lines = couplingLines()}
    <path
      bind:this={basePathElement}
      class="link link-coupling"
      d={lines[0]}
      fill="none"
      stroke={strokeColor}
      stroke-width={2}
      stroke-opacity={0.9}
      stroke-linecap="round"
      pointer-events="none"
    />
    <path
      class="link link-coupling"
      d={lines[1]}
      fill="none"
      stroke={strokeColor}
      stroke-width={2}
      stroke-opacity={0.9}
      stroke-linecap="round"
      pointer-events="none"
    />
  {:else if isDouble}
    {@const gap = Math.max(3, Math.round(edge.width * 0.9))}
    <path
      bind:this={basePathElement}
      class="link"
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
      stroke-opacity={strokeOpacity}
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
