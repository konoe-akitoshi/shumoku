<script lang="ts">
  import { BaseEdge, type Edge, EdgeLabel, type EdgeProps, useSvelteFlow } from '@xyflow/svelte'
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

  type SceneEdgeData = { sceneId: string; waypoints: Waypoint[] }
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

  const waypoints = $derived<Waypoint[]>(data?.waypoints ?? [])
  const sceneId = $derived(data?.sceneId ?? '')
  // Wire editing (drag-to-bend, waypoint drag, midpoint insert) is
  // gated by the editor's mode — view mode disables all of it.
  const interactive = $derived(editorState.mode === 'edit')

  const points = $derived<Waypoint[]>([
    { x: sourceX, y: sourceY },
    ...waypoints,
    { x: targetX, y: targetY },
  ])
  // Rounded polyline: each corner gets a quadratic-Bezier sweep so
  // both default (no waypoints) and bent (with waypoints) wires look
  // consistent. polylinePath handles the no-waypoint case as a plain
  // M…L line, with no corners to round.
  const pathD = $derived(polylinePath(points))
  const midpoints = $derived(segmentMidpoints(points))

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
