<script lang="ts">
  import { BaseEdge, type Edge, EdgeLabel, type EdgeProps, useSvelteFlow } from '@xyflow/svelte'
  import { editorState } from '$lib/context.svelte'
  import { formatMeters } from '$lib/scene/cable-length'
  import { WIRE_CORNER_RADIUS } from '$lib/scene/node-geometry'
  import { bendOnDrag, polylinePath, type Waypoint } from './wire-edit'

  // Custom Svelte Flow edge for floor-plan wiring. The path is a
  // BaseEdge so it inherits standard styling / selection. Drag on
  // the line body inserts a waypoint and starts dragging it (the
  // bend lives in scene.wireRoutes; no handle UI on top of the
  // wire). Length pills sit at each visible-segment midpoint.

  type SceneEdgeData = {
    sceneId: string
    /** Visible cable segments (one entry per disjoint subpath). When
     *  the wire transits an EPS, the chase-internal portion is hidden
     *  — that breaks one logical wire into multiple visible polylines.
     *  Each entry is the via positions BETWEEN source/target (which the
     *  edge gets from sourceX/Y / targetX/Y). The first and last
     *  segments include source/target implicitly. Bends ride along in
     *  these segments since they're now via Nodes too. */
    segments?: Array<Waypoint[]>
    /** Effective real-world cable length, computed by the parent
     *  via the cableLengthMeters helper. */
    lengthMeters: number | null
    /** Per-visible-segment lengths in meters, parallel to `segments`.
     *  One pill per segment for EPS-split wires. */
    segmentMeters?: Array<number | null>
    /** Per-scene stroke width multiplier (Scene.display.wireScale). */
    wireScale?: number
  }
  type SceneEdgeT = Edge<SceneEdgeData, 'wire'>

  let {
    id,
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
  const interactive = $derived(editorState.interactive)

  // Composed visible segments: each becomes one continuous polyline.
  // Source attaches to the first segment, target to the last. Bends
  // are inside via now, so they ride within `segments` — no separate
  // userBends interleave needed.
  const visualSegments = $derived.by<Waypoint[][]>(() => {
    const segs = data?.segments ?? [[]]
    const result: Waypoint[][] = []
    const last = segs.length - 1
    for (let i = 0; i < segs.length; i++) {
      const inner = segs[i] ?? []
      const pts: Waypoint[] = []
      if (i === 0) pts.push({ x: sourceX, y: sourceY })
      pts.push(...inner)
      if (i === last) pts.push({ x: targetX, y: targetY })
      if (pts.length >= 2) result.push(pts)
    }
    return result
  })

  // Render every segment as a rounded polyline. Multi-segment wires
  // (EPS-split) get joined into one path string with separate
  // subpaths so the wall-gap shows as a break.
  const pathD = $derived.by(() => {
    if (visualSegments.length === 0) return ''
    // Plain polyline. Corner radius is shared with WIRE_CORNER_RADIUS
    // so the bend dot (sized at 2× this in node-geometry) exactly
    // covers the rounded-corner cutout — the bend visually sits ON
    // the line even though the bezier control is at the corner peak.
    return visualSegments
      .filter((seg) => seg.length >= 2)
      .map((seg) => polylinePath(seg, WIRE_CORNER_RADIUS))
      .join(' ')
  })
  // First-segment points feed bendOnDrag's segment-search so a
  // line-body pointerdown maps to the right insertion index.
  const points = $derived<Waypoint[]>(visualSegments[0] ?? [])

  // Per-visible-segment label anchors: each segment shows its own
  // length pill so an EPS-split wire reads as two separate cables.
  function midpointOf(seg: Waypoint[]): Waypoint | null {
    if (seg.length < 2) return null
    let total = 0
    for (let i = 0; i < seg.length - 1; i++) {
      const a = seg[i]
      const b = seg[i + 1]
      if (!a || !b) continue
      total += Math.hypot(b.x - a.x, b.y - a.y)
    }
    const half = total / 2
    let walked = 0
    for (let i = 0; i < seg.length - 1; i++) {
      const a = seg[i]
      const b = seg[i + 1]
      if (!a || !b) continue
      const len = Math.hypot(b.x - a.x, b.y - a.y)
      if (walked + len >= half) {
        const t = len === 0 ? 0 : (half - walked) / len
        return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
      }
      walked += len
    }
    return seg[seg.length - 1] ?? null
  }
  // For each visible segment, an anchor point and its meters reading.
  // Segments with no scene-derived length get null and skip the pill.
  const segmentLabels = $derived.by(() => {
    const segMeters = data?.segmentMeters ?? []
    return visualSegments.map((seg, i) => ({
      anchor: midpointOf(seg),
      meters: segMeters[i] ?? null,
    }))
  })
  // Single-segment fallback: if SceneCanvas didn't supply per-segment
  // meters but did supply a total, attach it to the only segment.
  const fallbackSinglePill = $derived.by(() => {
    if ((data?.segmentMeters?.length ?? 0) > 0) return null
    if (visualSegments.length !== 1) return null
    const total = data?.lengthMeters
    if (total == null) return null
    const anchor = midpointOf(visualSegments[0] ?? [])
    return anchor ? { anchor, meters: total } : null
  })

  // Drag-to-bend on the line body: insert a bend Node into the
  // link's via at the click, then drag its placement. snap-to-
  // existing inside bendOnDrag grabs a nearby existing bend
  // instead of duplicating.
  function onLinePointerDown(e: PointerEvent) {
    if (!interactive) return
    if (e.button !== 0) return
    e.stopImmediatePropagation()
    bendOnDrag({
      sceneId,
      linkId: id,
      startClient: { x: e.clientX, y: e.clientY },
      pointsForSegmentSearch: points,
      toFlow,
    })
  }
</script>

<!-- Subtle white halo behind the wire so a dark stroke stays
     legible over busy / dark floor-plan backgrounds. Skipped while
     selected — the bright blue selection color provides its own
     contrast, and a halo behind it just reads as a white smear
     under the waypoint / midpoint markers. -->
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

<!-- Wire-body hit path. nopan/nodrag opt out of d3-zoom so the line
     drag isn't hijacked into a pane pan. -->
<path
  d={pathD}
  class="nopan nodrag"
  fill="none"
  stroke="transparent"
  stroke-width="16"
  style="cursor: grab; pointer-events: stroke;"
  onpointerdown={onLinePointerDown}
/>

<!-- Cable length pill — only when the scene is calibrated. Fully
     opaque white with a soft outer ring so it stands clear of any
     image content beneath. -->
<!-- One pill per visible segment so EPS-split wires show their
     rack-side and room-side cables as separate numbers — matches
     the breakdown in the Connections list. Hidden while selected
     to keep the wire-edit space uncluttered. -->
{#if !selected}
  {#each segmentLabels as label, i (i)}
    {#if label.anchor && label.meters !== null}
      <EdgeLabel x={label.anchor.x} y={label.anchor.y}>
        <span
          class="block rounded-[3px] border border-black/15 bg-white px-1.5 text-[10px] leading-[14px] font-medium text-slate-800 shadow-[0_0_0_1.5px_rgba(255,255,255,0.9),0_1px_2px_rgba(0,0,0,0.2)]"
          style="transform: translate(-50%, -50%); pointer-events: none;"
        >
          {formatMeters(label.meters)}m
        </span>
      </EdgeLabel>
    {/if}
  {/each}
  {#if fallbackSinglePill}
    <EdgeLabel x={fallbackSinglePill.anchor.x} y={fallbackSinglePill.anchor.y}>
      <span
        class="block rounded-[3px] border border-black/15 bg-white px-1.5 text-[10px] leading-[14px] font-medium text-slate-800 shadow-[0_0_0_1.5px_rgba(255,255,255,0.9),0_1px_2px_rgba(0,0,0,0.2)]"
        style="transform: translate(-50%, -50%); pointer-events: none;"
      >
        {formatMeters(fallbackSinglePill.meters)}m
      </span>
    </EdgeLabel>
  {/if}
{/if}

<!-- No floating per-wire toolbar — Svelte Flow doesn't have an
     EdgeToolbar primitive, and the custom one collided with
     waypoint handles. Delete is via Backspace / Delete (native);
     routing edits are accessed from the source node's NodeToolbar
     or from the right-side DetailPanel. -->

<!-- Waypoint / midpoint markers temporarily disabled — drag-to-bend
     on the line body still creates waypoints in data, but no UI
     handles render on top of the wire. -->