<script lang="ts">
  import { BaseEdge, type Edge, EdgeLabel, type EdgeProps, useSvelteFlow } from '@xyflow/svelte'
  import { diagramState } from '$lib/context.svelte'

  // Custom Svelte Flow edge — polyline through user-editable
  // waypoints. The path uses BaseEdge so it inherits Svelte Flow's
  // standard styling/selection. Waypoint and segment-midpoint handles
  // ride in EdgeLabel (HTML in a separate portal layer) so pointer
  // events on them don't fall through to the canvas pane.

  type Waypoint = { x: number; y: number }
  type SceneEdgeData = {
    sceneId: string
    waypoints: Waypoint[]
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

  const waypoints = $derived(data?.waypoints ?? [])
  const sceneId = $derived(data?.sceneId ?? '')

  const points = $derived([{ x: sourceX, y: sourceY }, ...waypoints, { x: targetX, y: targetY }])
  const pathD = $derived.by(() => {
    if (points.length === 0) return ''
    const [first, ...rest] = points
    if (!first) return ''
    return `M ${first.x} ${first.y}${rest.map((p) => ` L ${p.x} ${p.y}`).join('')}`
  })
  const midpoints = $derived(
    points.slice(0, -1).map((p, i) => {
      const q = points[i + 1]
      if (!q) return { x: p.x, y: p.y }
      return { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 }
    }),
  )

  // Drag is implemented with explicit document listeners attached on
  // pointerdown (not <svelte:window>) so the listener survives the
  // EdgeLabel re-render that fires on every move (waypoints array
  // updates → portal re-renders → the original button is gone).
  function onWaypointDown(idx: number, e: PointerEvent) {
    if (e.button !== 0) return
    e.stopPropagation()
    e.preventDefault()
    const wp = waypoints[idx]
    if (!wp) return
    const flow = sf.screenToFlowPosition({ x: e.clientX, y: e.clientY })
    const offsetX = flow.x - wp.x
    const offsetY = flow.y - wp.y

    diagramState.beginTx('Adjust wire')

    const onMove = (ev: PointerEvent) => {
      const fp = sf.screenToFlowPosition({ x: ev.clientX, y: ev.clientY })
      // Read the latest waypoints fresh each move so we don't write
      // back stale data when several drags interleave.
      const route = diagramState.scenes
        .find((s) => s.id === sceneId)
        ?.wireRoutes.find((w) => w.linkId === id)
      const cur = route?.controlPoints ?? waypoints
      const next = [...cur]
      next[idx] = { x: fp.x - offsetX, y: fp.y - offsetY }
      diagramState.setWireRoute(sceneId, {
        linkId: id,
        pathStyle: 'free',
        controlPoints: next,
      })
    }
    const onUp = () => {
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
      diagramState.endTx()
    }
    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
  }

  function insertWaypoint(segIdx: number) {
    const mp = midpoints[segIdx]
    if (!mp) return
    const next = [...waypoints]
    next.splice(segIdx, 0, { x: mp.x, y: mp.y })
    diagramState.setWireRoute(sceneId, {
      linkId: id,
      pathStyle: 'free',
      controlPoints: next,
    })
  }

  function deleteWaypoint(idx: number) {
    const next = waypoints.filter((_, i) => i !== idx)
    diagramState.setWireRoute(sceneId, {
      linkId: id,
      pathStyle: next.length > 0 ? 'free' : 'orthogonal',
      controlPoints: next,
    })
  }
</script>

<BaseEdge
  path={pathD}
  {markerEnd}
  style="stroke: {selected ? '#3b82f6' : '#475569'}; stroke-width: {selected
    ? 2.5
    : 2}; stroke-linecap: round; stroke-linejoin: round; {style ?? ''}"
/>

{#if selected}
  {#each waypoints as wp, idx (idx)}
    <EdgeLabel x={wp.x} y={wp.y}>
      <button
        type="button"
        class="block h-3 w-3 rounded-full border-[1.5px] border-blue-500 bg-white shadow"
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
        class="block h-2 w-2 rounded-full border border-blue-500 bg-blue-500/40 hover:bg-blue-500"
        style="cursor: copy; transform: translate(-50%, -50%); pointer-events: all;"
        aria-label="add waypoint"
        onclick={(e) => {
          e.stopPropagation()
          insertWaypoint(idx)
        }}
      ></button>
    </EdgeLabel>
  {/each}
{/if}
