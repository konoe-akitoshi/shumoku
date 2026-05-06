<script lang="ts">
  import {
    BaseEdge,
    type Edge,
    EdgeLabel,
    type EdgeProps,
    getSmoothStepPath,
    useSvelteFlow,
  } from '@xyflow/svelte'
  import { editorState } from '$lib/context.svelte'
  import { pickSideForDirection } from '$lib/scene/node-geometry'
  import { bendOnDrag, polylinePath, type Waypoint } from './wire-edit'

  // Custom Svelte Flow edge for floor-plan wiring. The path is a
  // BaseEdge so it inherits standard styling / selection. Drag on
  // the line body inserts a waypoint and starts dragging it (the
  // bend lives in scene.wireRoutes; no handle UI on top of the
  // wire). Length pills sit at each visible-segment midpoint.

  type SceneEdgeData = {
    sceneId: string
    waypoints: Waypoint[]
    /** Visible cable segments (one entry per disjoint subpath). When
     *  the wire transits an EPS, the chase-internal portion is hidden
     *  — that breaks one logical wire into multiple visible polylines.
     *  Each entry is the via positions BETWEEN source/target (which the
     *  edge gets from sourceX/Y / targetX/Y). The first and last
     *  segments include source/target implicitly. */
    segments?: Array<Waypoint[]>
    /** Effective real-world cable length, computed by the parent
     *  via the cableLengthMeters helper. Already accounts for
     *  scene-derived (placements + calibration) vs stored fallback;
     *  null when neither is available. */
    lengthMeters: number | null
    /** Per-visible-segment lengths in meters, parallel to
     *  `segments`. Used to draw one pill per segment so an EPS-split
     *  wire shows its rack-side and room-side cables individually
     *  rather than one combined number. */
    segmentMeters?: Array<number | null>
    /** When false, waypoints are auto-positioned (e.g. derived from
     *  Link.via TP placements) and the user can't drag them. */
    editableWaypoints?: boolean
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
    sourcePosition,
    targetPosition,
    selected,
    style,
    markerEnd,
  }: EdgeProps<SceneEdgeT> = $props()

  const sf = useSvelteFlow()
  const toFlow = (cx: number, cy: number) => sf.screenToFlowPosition({ x: cx, y: cy })

  const waypoints = $derived<Waypoint[]>(data?.waypoints ?? [])
  const sceneId = $derived(data?.sceneId ?? '')
  // Wire editing (drag-to-bend, waypoint drag, midpoint insert) is
  // gated by the editor's mode AND the `editableWaypoints` data flag —
  // via-routed wires have auto-derived waypoints, not user bends.
  const interactive = $derived(editorState.interactive && (data?.editableWaypoints ?? true))

  // Composed visible segments: each becomes one continuous polyline.
  // Source attaches to the first segment, target to the last. When
  // there's only one segment (no EPS in via), this is the legacy
  // single-polyline path.
  const visualSegments = $derived.by<Waypoint[][]>(() => {
    const segs = data?.segments ?? [[]]
    const result: Waypoint[][] = []
    const last = segs.length - 1
    for (let i = 0; i < segs.length; i++) {
      const inner = segs[i] ?? []
      const pts: Waypoint[] = []
      if (i === 0) pts.push({ x: sourceX, y: sourceY })
      pts.push(...inner)
      // Trailing segments (after an EPS) only get a target appended on
      // the very last; intermediate gap segments stand alone.
      if (i === last) pts.push({ x: targetX, y: targetY })
      // Drop degenerate segments (e.g. trailing EPS with no outlet
      // produces a single-point segment with just target).
      if (pts.length >= 2) result.push(pts)
    }
    // For wires with user bends (no via), interleave them into the one
    // and only segment.
    if (segs.length === 1 && waypoints.length > 0 && result[0]) {
      const r0 = result[0]
      result[0] = [r0[0] as Waypoint, ...waypoints, r0[r0.length - 1] as Waypoint]
    }
    return result
  })

  // Render each segment with the same smoothstep treatment Svelte
  // Flow uses for plain edges. Inner endpoints (via TPs in the
  // middle) don't have framework-provided handle positions, so we
  // compute Position from the line direction. Multi-segment wires
  // join as multi-subpath SVG so wall gaps render as breaks. Falls
  // back to a rounded polyline only when a segment has bends in its
  // interior (3+ points).
  const pathD = $derived.by(() => {
    if (visualSegments.length === 0) return ''
    const parts: string[] = []
    for (let i = 0; i < visualSegments.length; i++) {
      const seg = visualSegments[i]
      if (!seg || seg.length < 2) continue
      const isFirst = i === 0
      const isLast = i === visualSegments.length - 1
      if (seg.length === 2) {
        const a = seg[0]
        const b = seg[1]
        if (!a || !b) continue
        const startPos = isFirst
          ? (sourcePosition ?? pickSideForDirection(b.x - a.x, b.y - a.y))
          : pickSideForDirection(b.x - a.x, b.y - a.y)
        const endPos = isLast
          ? (targetPosition ?? pickSideForDirection(a.x - b.x, a.y - b.y))
          : pickSideForDirection(a.x - b.x, a.y - b.y)
        const [path] = getSmoothStepPath({
          sourceX: a.x,
          sourceY: a.y,
          targetX: b.x,
          targetY: b.y,
          sourcePosition: startPos,
          targetPosition: endPos,
          borderRadius: 12,
        })
        parts.push(path)
      } else {
        // Rounded corners between waypoints — the visible bend
        // softens with a quadratic Bezier whose control sits at the
        // waypoint position. We no longer render a marker AT the
        // waypoint, so the small offset between point and curve
        // doesn't cause visible misalignment anymore.
        parts.push(polylinePath(seg))
      }
    }
    return parts.join(' ')
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

  // Drag-to-bend on the line body: insert a waypoint at the click
  // and start dragging it. snap-to-existing logic in `bendOnDrag`
  // grabs an existing nearby waypoint instead of creating a duplicate.
  function onLinePointerDown(e: PointerEvent) {
    if (!interactive) return
    if (e.button !== 0) return
    // stopImmediatePropagation kills any sibling listener (incl.
    // d3-zoom's pane handler in some configurations); preventDefault
    // stays off so a tap can fall through to BaseEdge's selection.
    e.stopImmediatePropagation()
    bendOnDrag({
      sceneId,
      linkId: id,
      startClient: { x: e.clientX, y: e.clientY },
      initialWaypoints: [...waypoints],
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
          {label.meters < 10 ? label.meters.toFixed(1) : Math.round(label.meters)}
          m
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
        {fallbackSinglePill.meters < 10
          ? fallbackSinglePill.meters.toFixed(1)
          : Math.round(fallbackSinglePill.meters)}
        m
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