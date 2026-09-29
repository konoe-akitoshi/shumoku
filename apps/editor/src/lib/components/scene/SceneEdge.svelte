<script lang="ts">
  import type { CableGrade } from '@shumoku/core'
  import { BaseEdge, type Edge, type EdgeProps, useSvelteFlow } from '@xyflow/svelte'
  import { onDestroy } from 'svelte'
  import { editorState } from '$lib/context.svelte'
  import { cableCategoryColor } from '$lib/scene/cable-colors'
  import { formatMeters } from '$lib/scene/cable-length'
  import { sceneWireWidth, WIRE_CORNER_RADIUS } from '$lib/scene/node-geometry'
  import type { WirePoint } from '$lib/scene/wire-drag'
  import { bendOnDrag, polylinePath, type Waypoint } from './wire-edit'

  // One Svelte Flow edge per visible cable segment. SceneCanvas
  // emits N edges per logical Link (one per side of an EPS) so
  // each physical cable run has its own selection / hover /
  // context menu / drag-to-bend interaction. SceneEdge therefore
  // renders a single polyline; the multi-polyline complexity is
  // gone.

  type SceneEdgeData = {
    sceneId: string
    /** Logical Link whose bends are edited by a wire-body gesture. */
    linkId: string
    /** Index of this segment in the Link's visibleCableSegments
     *  output. Diagnostic only — interaction uses `viaOffset`. */
    segmentIndex: number
    /** Global via index where insertions for this segment land:
     *  source-rooted segment = 0, post-EPS segment = (via index of
     *  segment head) + 1. */
    viaOffset: number
    /** Inner via points between source and target (not including
     *  the segment endpoints). Used to compose the polyline. */
    innerWaypoints: WirePoint[]
    /** Per-segment cable length in meters when the scene has a
     *  calibration; null otherwise. */
    lengthMeters: number | null
    /** Per-scene stroke width multiplier (Scene.display.wireScale). */
    wireScale?: number
    /** Inverse viewport zoom: SVG lives inside a CSS-transformed viewport. */
    screenScale?: number
    /** Cable jacket grade, drives stroke color via
     *  `cableCategoryColor()`. Undefined → slate default. */
    cableCategory?: CableGrade
  }
  type SceneEdgeT = Edge<SceneEdgeData, 'wire'>

  let {
    data,
    sourceX,
    sourceY,
    targetX,
    targetY,
    selected,
    style,
    markerEnd,
  }: EdgeProps<SceneEdgeT> = $props()

  const sf = useSvelteFlow()
  const toFlow = (cx: number, cy: number) => sf.screenToFlowPosition({ x: cx, y: cy })

  const linkId = $derived(data?.linkId ?? '')
  const viaOffset = $derived(data?.viaOffset ?? 0)
  const interactive = $derived(editorState.interactive)
  const screenScale = $derived(data?.screenScale ?? 1)
  const strokeWidth = $derived(sceneWireWidth(data?.wireScale))

  // Composed polyline: source endpoint + inner via centers + target endpoint.
  const points = $derived<WirePoint[]>([
    { x: sourceX, y: sourceY, afterIndex: viaOffset - 1 },
    ...(data?.innerWaypoints ?? []),
    { x: targetX, y: targetY },
  ])

  const pathD = $derived(polylinePath(points, WIRE_CORNER_RADIUS))

  // Length-pill anchor at the polyline midpoint.
  const labelAnchor = $derived.by<Waypoint | null>(() => {
    if (points.length < 2) return null
    let total = 0
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i]
      const b = points[i + 1]
      if (!a || !b) continue
      total += Math.hypot(b.x - a.x, b.y - a.y)
    }
    const half = total / 2
    let walked = 0
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i]
      const b = points[i + 1]
      if (!a || !b) continue
      const len = Math.hypot(b.x - a.x, b.y - a.y)
      if (walked + len >= half) {
        const t = len === 0 ? 0 : (half - walked) / len
        return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
      }
      walked += len
    }
    return points[points.length - 1] ?? null
  })

  let cancelDrag: (() => void) | undefined
  onDestroy(() => cancelDrag?.())

  function onLinePointerDown(e: PointerEvent) {
    if (!interactive || !selected) return
    if (e.button !== 0) return
    e.stopImmediatePropagation()
    cancelDrag?.()
    cancelDrag = bendOnDrag({
      linkId,
      zoom: 1 / screenScale,
      pointerId: e.pointerId,
      addBend: e.altKey,
      startClient: { x: e.clientX, y: e.clientY },
      points,
      toFlow,
    })
  }
</script>

<!-- White halo so a dark stroke stays legible over busy / dark
     floor-plan backgrounds. Hidden while selected — the bright
     blue selection color provides its own contrast. -->
{#if !selected}
  <path
    d={pathD}
    fill="none"
    stroke="rgba(255, 255, 255, 0.55)"
    stroke-width={strokeWidth + 1.5}
    stroke-linecap="round"
    stroke-linejoin="round"
    pointer-events="none"
  />
{/if}

<!-- Length annotations scale with the drawing and remain visible when selected. -->
<BaseEdge
  path={pathD}
  {markerEnd}
  interactionWidth={0}
  label={labelAnchor && data?.lengthMeters != null
    ? `${formatMeters(data.lengthMeters)}m`
    : undefined}
  labelX={labelAnchor?.x}
  labelY={labelAnchor?.y}
  labelStyle="background:rgba(255,255,255,0.8);padding:0 2px;font-size:12px;line-height:1.4;font-weight:400;color:#1e293b;pointer-events:none;"
  style="stroke: {selected
    ? '#3b82f6'
    : cableCategoryColor(data?.cableCategory)}; stroke-width: {strokeWidth}; stroke-linecap: round; stroke-linejoin: round; {style ?? ''}"
/>

<!-- Wire-body hit path. nopan/nodrag opts out of d3-zoom so the
     line drag isn't hijacked into a pane pan. -->
<path
  d={pathD}
  class="nopan nodrag"
  fill="none"
  stroke="transparent"
  stroke-width={Math.max(12 * screenScale, strokeWidth + 4)}
  style="cursor: {interactive && selected ? 'grab' : 'pointer'}; pointer-events: stroke;"
  onpointerdown={onLinePointerDown}
/>
