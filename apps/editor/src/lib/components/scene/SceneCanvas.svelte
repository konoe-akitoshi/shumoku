<script lang="ts">
  import {
    type Connection,
    ConnectionMode,
    type Edge,
    MarkerType,
    type Node as SfNode,
    SvelteFlow,
  } from '@xyflow/svelte'
  import '@xyflow/svelte/dist/style.css'
  import { onDestroy, onMount } from 'svelte'
  import { diagramState, editorState } from '$lib/context.svelte'
  import { cableLengthMeters, visibleCableSegments } from '$lib/scene/cable-length'
  import { pickSideForDirection, sceneNodeSize } from '$lib/scene/node-geometry'
  import { nodesInScope } from '$lib/scene/scope'
  import type { Scene } from '$lib/types'
  import EpsRoutingModal from './EpsRoutingModal.svelte'
  import NodeRoutingModal from './NodeRoutingModal.svelte'
  import SceneBackgroundNode from './SceneBackgroundNode.svelte'
  import SceneCalibrationCapture from './SceneCalibrationCapture.svelte'
  import SceneClickPlace from './SceneClickPlace.svelte'
  import SceneEdge from './SceneEdge.svelte'
  import SceneFitOnLoad from './SceneFitOnLoad.svelte'
  import SceneNode from './SceneNode.svelte'
  import { sceneAuthoring } from './scene-authoring.svelte'

  // Svelte Flow-based scene canvas. Pan/zoom/select/connect come from
  // the library; we stay in charge of the data: nodes/edges are
  // derived from `scene` + `diagramState`, and Svelte Flow events
  // route back through `diagramState` so undo + scene state stay
  // authoritative.

  let {
    scene,
  }: {
    scene: Scene
  } = $props()

  const auth = sceneAuthoring
  const interactive = $derived(editorState.interactive)
  const bg = $derived(scene.background)
  const hiddenNodeIds = $derived(new Set(scene.hiddenNodeIds ?? []))
  const hiddenLinkIds = $derived(new Set(scene.hiddenLinkIds ?? []))

  // Scope filter: only nodes within the scene's bound subgraph render
  // as full pins; cross-boundary wires get an "export pill" terminal.
  const inScope = $derived(
    nodesInScope(diagramState.nodes.values(), diagramState.subgraphs, scene.scopeSubgraphId),
  )
  const inScopeIds = $derived(new Set(inScope.map((n) => n.id)))
  const visibleLinks = $derived(
    diagramState.links.filter(
      (l) =>
        !!l.id &&
        !hiddenLinkIds.has(l.id) &&
        (inScopeIds.has(l.from.node) || inScopeIds.has(l.to.node)),
    ),
  )
  // Nodes to render as pins in this scene = scope-internal nodes
  // PLUS any external endpoint referenced by a visible cross-boundary
  // link. Externals are normal SceneNodes (draggable, length-bearing);
  // their cross-boundary nature only shows in the label suffix.
  const visibleSceneNodes = $derived.by(() => {
    const ids = new Set<string>()
    const out: typeof inScope = []
    for (const n of inScope) {
      if (hiddenNodeIds.has(n.id)) continue
      ids.add(n.id)
      out.push(n)
    }
    for (const l of visibleLinks) {
      for (const ep of [l.from.node, l.to.node]) {
        if (ids.has(ep)) continue
        const node = diagramState.nodes.get(ep)
        if (!node) continue
        ids.add(ep)
        out.push(node)
      }
    }
    return out
  })

  // Cross-boundary external nodes are rendered as regular pins in
  // the scene. We just compute a "(<subgraph>)" suffix to show the
  // node belongs elsewhere on the diagram, so the user can spot
  // boundary connections without conflating them with native pins.
  function externalSubgraphSuffix(nodeId: string): string {
    if (inScopeIds.has(nodeId)) return ''
    const node = diagramState.nodes.get(nodeId)
    const sgId = node?.parent
    if (!sgId) return ''
    const sg = diagramState.subgraphs.get(sgId)
    return sg?.label ? ` (${sg.label})` : ''
  }

  // ── Position resolution (cached) ────────────────────────────────
  // Index lookups by id once per derive cycle so per-node lookups are
  // O(1) instead of repeated findIndex/find scans. Drag re-renders
  // hammer these so the cost adds up fast.
  const placementById = $derived.by(() => {
    const m = new Map<string, { x: number; y: number }>()
    for (const p of scene.nodePlacements) m.set(p.nodeId, p.position)
    return m
  })
  const trayIndexById = $derived.by(() => {
    const m = new Map<string, number>()
    for (const [i, n] of visibleSceneNodes.entries()) m.set(n.id, i)
    return m
  })

  function positionFor(nodeId: string): { x: number; y: number } {
    const override = placementById.get(nodeId)
    if (override) return override
    // No placement — fall through to the diagram-side auto-layout
    // position. The auto-placement effect below distributes unplaced
    // in-scope pins on the floor plan when bg is present, so this
    // path is mostly hit when bg isn't set yet.
    const node = diagramState.nodes.get(nodeId)
    return node?.position ?? { x: 100, y: 100 }
  }

  // Per-scene visual tuning. The scene-level multipliers are the
  // baseline; individual nodes / wires can override them via
  // `Node.metadata.displayScale` and `Link.metadata.wireScale`.
  const sceneNodeScale = $derived(scene.display?.nodeScale ?? 1)
  const sceneWireScale = $derived(scene.display?.wireScale ?? 1)

  function effectiveNodeScale(nodeId: string): number {
    const ov = diagramState.nodes.get(nodeId)?.metadata?.displayScale
    if (typeof ov === 'number' && ov > 0) return ov
    return sceneNodeScale
  }
  function effectiveWireScale(link: { metadata?: Record<string, unknown> }): number {
    const ov = link.metadata?.wireScale
    if (typeof ov === 'number' && ov > 0) return ov
    return sceneWireScale
  }

  // Center of a node's icon in flow coords. Svelte Flow stores
  // positions as top-left, so anything that wants to anchor against
  // the visible icon (wire endpoints into a via TP, etc.) needs to
  // shift by half the (scaled) size — using the node's own effective
  // scale so per-node overrides land at the right spot.
  function centerOf(nodeId: string): { x: number; y: number } {
    const tl = positionFor(nodeId)
    const { w, h } = sceneNodeSize(diagramState.nodes.get(nodeId))
    const s = effectiveNodeScale(nodeId)
    return { x: tl.x + (w * s) / 2, y: tl.y + (h * s) / 2 }
  }

  // ── Svelte Flow nodes/edges (derived) ────────────────────────────
  const sfNodes = $derived.by<SfNode[]>(() => {
    const out: SfNode[] = []
    // Background image as a non-interactive node behind everything.
    // Living in the same node array as pins means the viewport
    // transform applies uniformly — pan/zoom/fitView all behave.
    if (bg) {
      out.push({
        id: '__bg__',
        type: 'background',
        position: { x: 0, y: 0 },
        data: { src: bg.src, width: bg.width, height: bg.height },
        width: bg.width,
        height: bg.height,
        draggable: false,
        selectable: false,
        deletable: false,
        focusable: false,
        zIndex: -1,
      })
    }
    for (const n of visibleSceneNodes) {
      const baseLabel = Array.isArray(n.label) ? n.label[0] : (n.label ?? n.id)
      const label = `${baseLabel}${externalSubgraphSuffix(n.id)}`
      out.push({
        id: n.id,
        type: 'scene',
        position: positionFor(n.id),
        data: {
          label,
          spec: n.spec,
          termination: n.termination,
          scale: effectiveNodeScale(n.id),
        },
        draggable: interactive,
        selectable: true,
      })
    }
    return out
  })

  const sfEdges = $derived.by<Edge[]>(() => {
    const out: Edge[] = []
    for (const link of visibleLinks) {
      if (!link.id) continue
      // Both endpoints are now real SceneNodes (in-scope or cross-
      // boundary), no synthetic anchor IDs to substitute.
      const from = link.from.node
      const to = link.to.node
      const crossBoundary = !inScopeIds.has(from) || !inScopeIds.has(to)
      const route = scene.wireRoutes.find((w) => w.linkId === link.id)
      const fromPos = centerOf(from)
      const toPos = centerOf(to)
      // Wire path: split into visible cable segments at every EPS in
      // via. Cable physically enters the chase at the EPS and exits
      // at an outlet on the other side; the wall-internal portion is
      // hidden, so we render two disjoint polylines (source → EPS,
      // outlet → target) instead of one continuous line. The
      // visibleCableSegments helper keeps this consistent with the
      // length math.
      const idSegments = visibleCableSegments(link, diagramState.nodes)
      // Inner via points target the icon's CENTER so the smoothstep
      // curves enter the TP at the visual edge, not its top-left
      // corner. Source/target endpoints stay handle-driven via
      // sourceX/Y / targetX/Y from Svelte Flow.
      const segments: Array<Array<{ x: number; y: number }>> = idSegments.map((seg) =>
        seg.filter((id) => id !== from && id !== to).map((id) => centerOf(id)),
      )
      const userBends = (link.via?.length ?? 0) > 0 ? [] : (route?.controlPoints ?? [])
      // Handle side picked toward the FIRST visible waypoint after the
      // source (and the LAST visible waypoint before the target). For
      // a wire that goes source → EPS → … via, we want to leave the
      // source pointing toward the EPS, not toward the eventual far
      // device (which our line never actually heads to in segment A).
      const firstAfterSource = segments[0]?.[0] ?? toPos
      const lastBeforeTarget =
        segments[segments.length - 1]?.[(segments[segments.length - 1]?.length ?? 0) - 1] ?? fromPos
      const sourceHandle = pickSideForDirection(
        firstAfterSource.x - fromPos.x,
        firstAfterSource.y - fromPos.y,
      )
      const targetHandle = pickSideForDirection(
        lastBeforeTarget.x - toPos.x,
        lastBeforeTarget.y - toPos.y,
      )
      // Cable length: scene-derived (calibration + endpoint positions
      // — placement override OR Node.position fallback) wins, else
      // stored link.cable.length_m. Same helper BOM / Connections use,
      // so canvas and the rest of the app agree on the value.
      const eff = cableLengthMeters(link, [scene], diagramState.nodes)
      out.push({
        id: link.id,
        source: from,
        target: to,
        sourceHandle,
        targetHandle,
        type: 'wire',
        data: {
          sceneId: scene.id,
          // For non-via wires the renderer keeps using `waypoints`
          // for backward compatibility (drag-to-bend points). For
          // via wires we hand it the segmented form.
          segments,
          waypoints: userBends,
          // Drag-to-bend is suppressed when via routing is active —
          // bending a TP-routed wire would create per-segment bends
          // we don't store yet.
          editableWaypoints: segments.length === 1 && segments[0]?.length === 0,
          lengthMeters: eff?.meters ?? null,
          wireScale: effectiveWireScale(link),
        },
        animated: false,
        style: crossBoundary ? 'stroke-dasharray: 5 3;' : '',
        markerEnd: { type: MarkerType.ArrowClosed, color: '#475569' },
      })
    }
    return out
  })

  // Svelte Flow needs writable bindings for built-in selection / drag.
  // We re-derive on every store change but keep local copies that the
  // library mutates during interaction; we sync changes back via the
  // change handlers.
  let nodes = $state<SfNode[]>([])
  let edges = $state<Edge[]>([])

  $effect(() => {
    nodes = sfNodes
  })
  $effect(() => {
    edges = sfEdges
  })

  // ── Event handlers ───────────────────────────────────────────────
  // Drag start/stop are NodeTargetEventWithPointer — we read targetNode.
  function onNodeDragStart(_args: { targetNode: SfNode | null }) {
    diagramState.beginTx('Move item')
  }
  function onNodeDrag(args: { targetNode: SfNode | null }) {
    // Live placement update mid-drag so wires routed through this
    // node (via TP) follow the cursor instead of waiting for drop.
    // We're inside a tx (started by onNodeDragStart) so the per-frame
    // updates collapse to one undo step on stop.
    const target = args.targetNode
    if (!target) return
    diagramState.placeNodeInScene(scene.id, target.id, target.position)
  }
  function onNodeDragStop(args: { targetNode: SfNode | null }) {
    const target = args.targetNode
    if (target) {
      diagramState.placeNodeInScene(scene.id, target.id, target.position)
    }
    diagramState.endTx()
  }

  // Double-click branches by what was clicked:
  //   regular device → "Routing for this node" modal
  //   EPS termination → "Wires through this EPS" modal
  // Both edit Link.via, just from different angles.
  let routingNodeId = $state<string | null>(null)
  let routingEpsId = $state<string | null>(null)
  function onNodeDblClick(args: { targetNode: SfNode | null }) {
    const t = args.targetNode
    if (!t) return
    const node = diagramState.nodes.get(t.id)
    if (!node) return
    if (node.termination?.role === 'eps') {
      routingEpsId = node.id
    } else if (!node.termination) {
      routingNodeId = node.id
    }
  }

  function onConnect(connection: Connection) {
    if (!connection.source || !connection.target) return
    if (!inScopeIds.has(connection.source) || !inScopeIds.has(connection.target)) return
    diagramState.addWireInScene(scene.id, connection.source, connection.target)
  }

  // Pane click → forward screen coords down to SceneCalibrationCapture
  // (which lives inside SvelteFlow, so it has the screenToFlowPosition
  // hook). Bumping a counter ensures the same coords still trigger the
  // child's effect on a repeat click.
  let paneClickEvent = $state<{ x: number; y: number; n: number } | null>(null)
  let paneClickN = 0

  function onPaneClick(args: { event: MouseEvent | TouchEvent }) {
    const ev = args.event as MouseEvent
    paneClickEvent = { x: ev.clientX, y: ev.clientY, n: ++paneClickN }
    // SceneCalibrationCapture / SceneClickPlace inside the flow
    // consume the click via the bumped counter.
  }

  // Esc cancels any pending authoring action.
  function onWindowKey(e: KeyboardEvent) {
    if (e.key !== 'Escape') return
    if (auth.pendingPlacement) auth.pendingPlacement = null
    if (auth.pendingWireFrom) {
      auth.pendingWireFrom = null
      auth.pendingWireWaypoints = []
    }
    // calibrationMode Esc handling lives in SceneCalibrationCapture
    // (it needs to also clear the prompt state).
  }
  onMount(() => window.addEventListener('keydown', onWindowKey))
  onDestroy(() =>
    typeof window !== 'undefined' ? window.removeEventListener('keydown', onWindowKey) : undefined,
  )

  // Initial fit: just the floor-plan image. Auto-placement (below)
  // ensures all pins land inside the image, so we don't need to
  // pad for off-canvas tray pins anymore.
  const fitBounds = $derived.by<{ x: number; y: number; width: number; height: number } | null>(
    () => {
      if (!bg) return null
      return { x: 0, y: 0, width: bg.width, height: bg.height }
    },
  )

  // Auto-place unplaced in-scope pins on the floor plan grid the
  // first time a scene is opened (or when a bg is uploaded after
  // the fact). Without this users see calibration set + wires
  // drawn but no length values until they manually drag every pin
  // — non-obvious "hidden requirement" UX. New diagram nodes added
  // later don't auto-place; users explicitly position those.
  let lastTopupKey = ''
  $effect(() => {
    if (!bg) return
    const key = `${scene.id}:${bg.src}`
    if (key === lastTopupKey) return
    lastTopupKey = key

    const placed = new Set(scene.nodePlacements.map((p) => p.nodeId))
    const unplaced = visibleSceneNodes.filter((n) => !placed.has(n.id))
    if (unplaced.length === 0) return

    const cols = Math.max(1, Math.ceil(Math.sqrt(unplaced.length)))
    const rows = Math.max(1, Math.ceil(unplaced.length / cols))
    const cellW = bg.width / (cols + 1)
    const cellH = bg.height / (rows + 1)

    const next = unplaced.map((n, i) => ({
      nodeId: n.id,
      position: {
        x: cellW * ((i % cols) + 1),
        y: cellH * (Math.floor(i / cols) + 1),
      },
    }))

    diagramState.updateScene(scene.id, {
      nodePlacements: [...scene.nodePlacements, ...next],
    })
  })
</script>

<div
  class="relative h-full w-full"
  class:scene-canvas-readonly={!interactive}
  class:scene-canvas-placing={!!auth.pendingPlacement}
>
  <SvelteFlow
    bind:nodes
    bind:edges
    nodeTypes={{ scene: SceneNode, background: SceneBackgroundNode }}
    edgeTypes={{ wire: SceneEdge }}
    nodesDraggable={interactive}
    nodesConnectable={interactive}
    elementsSelectable
    connectionMode={ConnectionMode.Loose}
    minZoom={0.05}
    maxZoom={4}
    zoomOnDoubleClick={false}
    panOnDrag={[1, 2]}
    selectionOnDrag
    onnodedragstart={onNodeDragStart}
    onnodedrag={onNodeDrag}
    onnodedragstop={onNodeDragStop}
    onnodeclick={(args) => {
      // Single click is selection; doubleclick semantics live on the
      // pointer event itself (Svelte Flow re-emits node.click for
      // detail===2). Detect via event.detail to avoid setting up an
      // explicit dblclick listener that fights selection.
      const ev = args.event as MouseEvent
      if (ev.detail === 2) onNodeDblClick({ targetNode: args.node })
    }}
    onconnect={onConnect}
    onpaneclick={onPaneClick}
    proOptions={{ hideAttribution: true }}
  >
    <SceneFitOnLoad bounds={fitBounds} refitKey={bg?.src ?? ''} />
    <SceneCalibrationCapture sceneId={scene.id} paneClick={paneClickEvent} />
    <SceneClickPlace sceneId={scene.id} paneClick={paneClickEvent} />
  </SvelteFlow>

  <!-- Status hint: shown while the user is mid-action. Calibration UI
       and the rest of the authoring overlays will move here in
       follow-ups; this spike just confirms the Flow integration. -->
  {#if auth.calibrationMode || auth.pendingPlacement || auth.pendingWireFrom}
    <div
      class="pointer-events-none absolute top-3 left-1/2 z-10 -translate-x-1/2 rounded-full border border-neutral-200 bg-white/90 px-3 py-1 text-[11px] text-neutral-700 shadow backdrop-blur-sm dark:border-neutral-700 dark:bg-neutral-800/90 dark:text-neutral-200"
    >
      {#if auth.calibrationMode && !auth.calibrationMode.from}
        Click the first reference point
      {:else if auth.calibrationMode?.from}
        Click the second reference point
      {:else if auth.pendingPlacement?.kind === 'product'}
        Click to place item (Esc to cancel)
      {:else if auth.pendingPlacement?.kind === 'empty'}
        Click to place an empty node (Esc to cancel)
      {:else if auth.pendingPlacement?.kind === 'termination'}
        Click to place
        {auth.pendingPlacement.role === 'outlet'
          ? 'a wall outlet'
          : auth.pendingPlacement.role === 'eps'
            ? 'an EPS riser'
            : 'a patch panel'}
        (Esc to cancel)
      {:else}
        Authoring…
      {/if}
    </div>
  {/if}

  <NodeRoutingModal
    nodeId={routingNodeId}
    sceneId={scene.id}
    onclose={() => (routingNodeId = null)}
  />
  <EpsRoutingModal epsId={routingEpsId} sceneId={scene.id} onclose={() => (routingEpsId = null)} />
</div>

<style>
  /* Soften Svelte Flow's default dotted background when no floor
                       plan is set, but otherwise let its theming through. */
  :global(.svelte-flow__background) {
    background: #f8fafc;
  }
  :global(.svelte-flow .svelte-flow__edge .svelte-flow__edge-path) {
    stroke-linecap: round;
  }
  /* Make connection handles visible on hover so users can see where
                     to drag from. Otherwise the fully-transparent handles leave the
                     "how do I draw a wire" UX a guess. */
  :global(.svelte-flow__node:hover .svelte-flow__handle) {
    opacity: 1 !important;
    background: #3b82f6;
    border: 1px solid white;
    width: 8px;
    height: 8px;
  }
  /* Read-only cue: don't reveal connection handles on hover in view
           mode. Keep size + DOM presence so Svelte Flow can still resolve
           edge endpoint positions from each handle's bounding rect — only
           opacity is dropped. */
  .scene-canvas-readonly :global(.svelte-flow__node:hover .svelte-flow__handle) {
    opacity: 0 !important;
  }
  /* Placement-pending: crosshair cursor on the pane so users see
           "click somewhere to drop the item". */
  .scene-canvas-placing :global(.svelte-flow__pane) {
    cursor: crosshair !important;
  }
</style>
