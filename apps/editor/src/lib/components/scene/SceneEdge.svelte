<script lang="ts">
  import { type Edge, type EdgeProps, useSvelteFlow } from '@xyflow/svelte'
  import { diagramState } from '$lib/context.svelte'

  // Custom Svelte Flow edge — polyline through user-editable
  // waypoints. Renders the wire as straight segments source →
  // waypoints → target, with handles on each waypoint and a "+"
  // affordance at each segment midpoint to insert a new one.
  //
  // Source-of-truth lives in `diagramState.scenes[*].wireRoutes`;
  // edge data carries `{ sceneId, waypoints }` so this component
  // can write back through `diagramState.setWireRoute`.

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

  // Polyline points: source + waypoints + target
  const points = $derived([{ x: sourceX, y: sourceY }, ...waypoints, { x: targetX, y: targetY }])

  const pathD = $derived.by(() => {
    if (points.length === 0) return ''
    const [first, ...rest] = points
    if (!first) return ''
    return `M ${first.x} ${first.y}${rest.map((p) => ` L ${p.x} ${p.y}`).join('')}`
  })

  // Segment midpoints for the "+" insert handle
  const midpoints = $derived(
    points.slice(0, -1).map((p, i) => {
      const q = points[i + 1]
      if (!q) return { x: p.x, y: p.y, segIdx: i }
      return { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2, segIdx: i }
    }),
  )

  // ── Waypoint drag ──────────────────────────────────────────────
  let dragging = $state<{ idx: number; offsetX: number; offsetY: number } | null>(null)

  function onWaypointDown(idx: number, e: PointerEvent) {
    if (e.button !== 0) return
    e.stopPropagation()
    e.preventDefault()
    const target = e.currentTarget as SVGElement
    target.setPointerCapture(e.pointerId)
    const wp = waypoints[idx]
    if (!wp) return
    const flow = sf.screenToFlowPosition({ x: e.clientX, y: e.clientY })
    dragging = { idx, offsetX: flow.x - wp.x, offsetY: flow.y - wp.y }
    diagramState.beginTx('Adjust wire')
  }

  function onWaypointMove(e: PointerEvent) {
    if (!dragging) return
    const flow = sf.screenToFlowPosition({ x: e.clientX, y: e.clientY })
    const next = [...waypoints]
    next[dragging.idx] = {
      x: flow.x - dragging.offsetX,
      y: flow.y - dragging.offsetY,
    }
    diagramState.setWireRoute(sceneId, {
      linkId: id,
      pathStyle: 'free',
      controlPoints: next,
    })
  }

  function onWaypointUp() {
    if (dragging) diagramState.endTx()
    dragging = null
  }

  // ── Insert waypoint at segment midpoint ─────────────────────────
  function onMidpointClick(segIdx: number, e: MouseEvent) {
    e.stopPropagation()
    const mp = midpoints[segIdx]
    if (!mp) return
    const next = [...waypoints]
    // segIdx 0 = before first wp / between source and first wp.
    // After insertion, the new wp lands at segIdx of the waypoints
    // array (shifting later ones down).
    next.splice(segIdx, 0, { x: mp.x, y: mp.y })
    diagramState.setWireRoute(sceneId, {
      linkId: id,
      pathStyle: 'free',
      controlPoints: next,
    })
  }

  function onWaypointDblClick(idx: number, e: MouseEvent) {
    e.stopPropagation()
    const next = waypoints.filter((_, i) => i !== idx)
    diagramState.setWireRoute(sceneId, {
      linkId: id,
      pathStyle: next.length > 0 ? 'free' : 'orthogonal',
      controlPoints: next,
    })
  }
</script>

<svelte:window onpointermove={onWaypointMove} onpointerup={onWaypointUp} />

<!-- Hit area: thick transparent stroke so clicks register -->
<path d={pathD} fill="none" stroke="transparent" stroke-width="14" style="cursor: pointer;" />
<!-- Visible polyline -->
<path
  d={pathD}
  fill="none"
  stroke={selected ? '#3b82f6' : '#475569'}
  stroke-width={selected ? 2.5 : 2}
  stroke-linecap="round"
  stroke-linejoin="round"
  style={style ?? ''}
  marker-end={markerEnd}
  pointer-events="none"
/>

{#if selected}
  <!-- Waypoint handles: drag to move, dblclick to delete -->
  {#each waypoints as wp, idx (idx)}
    <circle
      cx={wp.x}
      cy={wp.y}
      r="6"
      fill="white"
      stroke="#3b82f6"
      stroke-width="1.5"
      style="cursor: grab;"
      onpointerdown={(e) => onWaypointDown(idx, e)}
      ondblclick={(e) => onWaypointDblClick(idx, e)}
    />
  {/each}

  <!-- Segment midpoints: click to insert a new waypoint -->
  {#each midpoints as mp, idx (idx)}
    <circle
      cx={mp.x}
      cy={mp.y}
      r="4"
      fill="rgba(59,130,246,0.4)"
      stroke="#3b82f6"
      stroke-width="1"
      style="cursor: copy;"
      onclick={(e) => onMidpointClick(idx, e)}
    />
  {/each}
{/if}
