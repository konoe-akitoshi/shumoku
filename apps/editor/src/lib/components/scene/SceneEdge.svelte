<script lang="ts">
  import { BaseEdge, type Edge, EdgeLabel, type EdgeProps, useSvelteFlow } from '@xyflow/svelte'
  import { editorState } from '$lib/context.svelte'
  import { formatMeters } from '$lib/scene/cable-length'
  import { WIRE_CORNER_RADIUS } from '$lib/scene/node-geometry'
  import { bendOnDrag, polylinePath, type Waypoint } from './wire-edit'

  // One Svelte Flow edge per visible cable segment. SceneCanvas
  // emits N edges per logical Link (one per side of an EPS) so
  // each physical cable run has its own selection / hover /
  // context menu / drag-to-bend interaction. SceneEdge therefore
  // renders a single polyline; the multi-polyline complexity is
  // gone.

  type SceneEdgeData = {
    sceneId: string
    /** Logical Link this segment belongs to. Used by drag-to-bend
     *  to insert into the correct Link.via. */
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
    innerWaypoints: Array<{ x: number; y: number }>
    /** Per-segment cable length in meters when the scene has a
     *  calibration; null otherwise. */
    lengthMeters: number | null
    /** Per-scene stroke width multiplier (Scene.display.wireScale). */
    wireScale?: number
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

  const sceneId = $derived(data?.sceneId ?? '')
  const linkId = $derived(data?.linkId ?? '')
  const viaOffset = $derived(data?.viaOffset ?? 0)
  const interactive = $derived(editorState.interactive)

  // Composed polyline: source endpoint + inner via centers + target endpoint.
  const points = $derived<Waypoint[]>([
    { x: sourceX, y: sourceY },
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

  function onLinePointerDown(e: PointerEvent) {
    if (!interactive) return
    if (e.button !== 0) return
    e.stopImmediatePropagation()
    bendOnDrag({
      sceneId,
      linkId,
      viaOffset,
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
    stroke-width={5 * (data?.wireScale ?? 1)}
    stroke-linecap="round"
    stroke-linejoin="round"
    pointer-events="none"
  />
{/if}

<BaseEdge
  path={pathD}
  {markerEnd}
  interactionWidth={0}
  style="stroke: {selected ? '#3b82f6' : '#475569'}; stroke-width: {(selected ? 3.5 : 3) *
    (data?.wireScale ?? 1)}; stroke-linecap: round; stroke-linejoin: round; {style ?? ''}"
/>

<!-- Wire-body hit path. nopan/nodrag opts out of d3-zoom so the
     line drag isn't hijacked into a pane pan. -->
<path
  d={pathD}
  class="nopan nodrag"
  fill="none"
  stroke="transparent"
  stroke-width="16"
  style="cursor: grab; pointer-events: stroke;"
  onpointerdown={onLinePointerDown}
/>

<!-- Cable length pill, hidden while selected to keep the
     wire-edit space uncluttered. -->
{#if !selected && labelAnchor && data?.lengthMeters !== null && data?.lengthMeters !== undefined}
  <EdgeLabel x={labelAnchor.x} y={labelAnchor.y}>
    <span
      class="block rounded-[3px] border border-black/15 bg-white px-1.5 text-[10px] leading-[14px] font-medium text-slate-800 shadow-[0_0_0_1.5px_rgba(255,255,255,0.9),0_1px_2px_rgba(0,0,0,0.2)]"
      style="transform: translate(-50%, -50%); pointer-events: none;"
    >
      {formatMeters(data.lengthMeters)}m
    </span>
  </EdgeLabel>
{/if}
