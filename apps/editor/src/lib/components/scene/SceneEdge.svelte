<script lang="ts">
  import {
    BaseEdge,
    type Edge,
    EdgeLabel,
    type EdgeProps,
    getSmoothStepPath,
    Position,
    useSvelteFlow,
  } from '@xyflow/svelte'
  import { editorState } from '$lib/context.svelte'
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
    pxPerMeter?: number
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
  // gated by the editor's mode — view mode disables all of it.
  const interactive = $derived(editorState.interactive)

  const points = $derived<Waypoint[]>([
    { x: sourceX, y: sourceY },
    ...waypoints,
    { x: targetX, y: targetY },
  ])
  // No-waypoint default: smoothstep (Svelte Flow's standard rounded
  // L-shape) so the wire reads as a softly-routed cable rather than a
  // stiff straight line. Once the user bends the wire, swap in our
  // own rounded polyline through their waypoints.
  const pathD = $derived.by(() => {
    if (waypoints.length === 0) {
      const [path] = getSmoothStepPath({
        sourceX,
        sourceY,
        targetX,
        targetY,
        sourcePosition: sourcePosition ?? Position.Bottom,
        targetPosition: targetPosition ?? Position.Top,
        borderRadius: 12,
      })
      return path
    }
    return polylinePath(points)
  })
  const midpoints = $derived(segmentMidpoints(points))

  // Cable length label — shown at the polyline midpoint when the
  // scene is calibrated. Computes Σ segment lengths through any
  // waypoints so a wire bent along walls reports the real cable run,
  // not the source-to-target straight-line distance.
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
  const lengthMeters = $derived(
    data?.pxPerMeter && data.pxPerMeter > 0 ? totalPx / data.pxPerMeter : null,
  )
  const labelAt = $derived.by(() => {
    // Place at the visual middle of the polyline (by accumulated length).
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

<!-- Cable length pill — only when the scene is calibrated. -->
{#if lengthMeters !== null && labelAt}
  <EdgeLabel x={labelAt.x} y={labelAt.y}>
    <span
      class="block rounded-[3px] border border-black/10 bg-white/95 px-1.5 text-[10px] leading-[14px] font-medium text-slate-700 shadow-sm"
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
