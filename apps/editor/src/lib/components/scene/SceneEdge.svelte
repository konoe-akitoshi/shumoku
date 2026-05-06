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
  import {
    bendOnDrag,
    dragWaypoint,
    polylinePath,
    segmentMidpoints,
    type Waypoint,
    writeWaypoints,
  } from './wire-edit'

  // Custom Svelte Flow edge for floor-plan wiring. The path uses
  // BaseEdge so it inherits the standard styling/selection. Drag on
  // the line body bends it; selecting reveals waypoint/midpoint
  // handles for fine adjustment. All editing logic (drag, insert,
  // segment math) lives in wire-edit.ts so this component is just
  // the rendering shell.

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
    /** When false, waypoints are auto-positioned (e.g. derived from
     *  Link.via TP placements) and the user can't drag them. */
    editableWaypoints?: boolean
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
        parts.push(polylinePath(seg))
      }
    }
    return parts.join(' ')
  })
  // Midpoints / waypoints handles only meaningful for the simple
  // single-segment, user-editable case.
  const points = $derived<Waypoint[]>(visualSegments[0] ?? [])
  const midpoints = $derived(segmentMidpoints(points))

  // Cable length comes pre-computed from the parent (canvas + BOM
  // share the same cableLengthMeters helper). We just pick a label
  // anchor on the rendered polyline.
  const lengthMeters = $derived(data?.lengthMeters ?? null)
  const totalPx = $derived.by(() => {
    let len = 0
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i]
      const b = points[i + 1]
      if (!a || !b) continue
      len += Math.hypot(b.x - a.x, b.y - a.y)
    }
    return len
  })
  const labelAt = $derived.by(() => {
    if (points.length < 2) return null
    const half = totalPx / 2
    let walked = 0
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i]
      const b = points[i + 1]
      if (!a || !b) continue
      const seg = Math.hypot(b.x - a.x, b.y - a.y)
      if (walked + seg >= half) {
        const t = seg === 0 ? 0 : (half - walked) / seg
        return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
      }
      walked += seg
    }
    const last = points[points.length - 1]
    return last ?? null
  })

  // ── Handlers ─────────────────────────────────────────────────────
  function onWaypointDown(idx: number, e: PointerEvent) {
    if (!interactive) return
    if (e.button !== 0) return
    e.stopPropagation()
    e.preventDefault()
    const wp = waypoints[idx]
    if (!wp) return
    dragWaypoint({
      sceneId,
      linkId: id,
      index: idx,
      initialPointerFlow: toFlow(e.clientX, e.clientY),
      initialWaypoint: wp,
      toFlow,
      label: 'Adjust wire',
    })
  }

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

  function insertMidpoint(segIdx: number) {
    const mp = midpoints[segIdx]
    if (!mp) return
    const next = [...waypoints]
    next.splice(segIdx, 0, mp)
    writeWaypoints(sceneId, id, next)
  }

  function deleteWaypoint(idx: number) {
    const next = waypoints.filter((_, i) => i !== idx)
    writeWaypoints(sceneId, id, next)
  }
</script>

<!-- White halo behind the wire so dark stroke stays legible over
     busy / dark floor-plan backgrounds. Slightly translucent so the
     image still shows through at the edges of the line. -->
<path
  d={pathD}
  fill="none"
  stroke="rgba(255, 255, 255, 0.85)"
  stroke-width={selected ? 6.5 : 6}
  stroke-linecap="round"
  stroke-linejoin="round"
  pointer-events="none"
/>
<BaseEdge
  path={pathD}
  {markerEnd}
  interactionWidth={0}
  style="stroke: {selected ? '#3b82f6' : '#475569'}; stroke-width: {selected
    ? 2.5
    : 2}; stroke-linecap: round; stroke-linejoin: round; {style ?? ''}"
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
{#if lengthMeters !== null && labelAt}
  <EdgeLabel x={labelAt.x} y={labelAt.y}>
    <span
      class="block rounded-[3px] border border-black/15 bg-white px-1.5 text-[10px] leading-[14px] font-medium text-slate-800 shadow-[0_0_0_1.5px_rgba(255,255,255,0.9),0_1px_2px_rgba(0,0,0,0.2)]"
      style="transform: translate(-50%, -50%); pointer-events: none;"
    >
      {lengthMeters < 10 ? lengthMeters.toFixed(1) : Math.round(lengthMeters)}
      m
    </span>
  </EdgeLabel>
{/if}

{#if selected && interactive}
  {#each waypoints as wp, idx (idx)}
    <EdgeLabel x={wp.x} y={wp.y}>
      <button
        type="button"
        class="nopan nodrag block h-3 w-3 rounded-full border-[1.5px] border-blue-500 bg-white shadow"
        style="cursor: grab; transform: translate(-50%, -50%); pointer-events: all;"
        aria-label="waypoint"
        onpointerdown={(e) => onWaypointDown(idx, e)}
        ondblclick={(e) => {
          e.stopPropagation()
          deleteWaypoint(idx)
        }}
      ></button>
    </EdgeLabel>
  {/each}

  {#each midpoints as mp, idx (idx)}
    <EdgeLabel x={mp.x} y={mp.y}>
      <button
        type="button"
        class="nopan nodrag block h-2 w-2 rounded-full border border-blue-500 bg-blue-500/40 hover:bg-blue-500"
        style="cursor: copy; transform: translate(-50%, -50%); pointer-events: all;"
        aria-label="add waypoint"
        onclick={(e) => {
          e.stopPropagation()
          insertMidpoint(idx)
        }}
      ></button>
    </EdgeLabel>
  {/each}
{/if}
