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
  import { cableLengthMeters } from '$lib/scene/cable-length'
  import { nodesInScope } from '$lib/scene/scope'
  import type { Scene } from '$lib/types'
  import SceneBackgroundNode from './SceneBackgroundNode.svelte'
  import SceneCalibrationCapture from './SceneCalibrationCapture.svelte'
  import SceneClickPlace from './SceneClickPlace.svelte'
  import SceneEdge from './SceneEdge.svelte'
  import SceneExportNode from './SceneExportNode.svelte'
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
  const visibleSceneNodes = $derived(inScope.filter((n) => !hiddenNodeIds.has(n.id)))
  const visibleLinks = $derived(
    diagramState.links.filter(
      (l) =>
        !!l.id &&
        !hiddenLinkIds.has(l.id) &&
        (inScopeIds.has(l.from.node) || inScopeIds.has(l.to.node)),
    ),
  )

  // ── Boundary anchors — one per cross-boundary external node ─────
  // Previously we collapsed all wires to a destination subgraph into
  // one "export pill", but that lost identity (FW-1 vs FW-2) and the
  // pill's position was just an arbitrary average. Now: each unique
  // external endpoint gets its own boundary marker so the user can
  // place each one at the spot where its cable physically exits the
  // scope. The label includes the destination subgraph so the cross-
  // boundary nature stays visible.
  function boundaryAnchorId(externalNodeId: string): string {
    return `__boundary_${externalNodeId}`
  }
  type BoundaryAnchor = {
    externalNodeId: string
    nodeLabel: string
    subgraphLabel: string | null
  }
  const boundaryAnchors = $derived.by<BoundaryAnchor[]>(() => {
    const seen = new Map<string, BoundaryAnchor>()
    for (const l of visibleLinks) {
      for (const ep of [l.from.node, l.to.node]) {
        if (inScopeIds.has(ep)) continue
        if (seen.has(ep)) continue
        const node = diagramState.nodes.get(ep)
        const label = Array.isArray(node?.label) ? node.label[0] : (node?.label ?? ep)
        const sg = node?.parent ? diagramState.subgraphs.get(node.parent) : undefined
        seen.set(ep, {
          externalNodeId: ep,
          nodeLabel: label ?? ep,
          subgraphLabel: sg?.label ?? null,
        })
      }
    }
    return [...seen.values()]
  })
  const externalToAnchorId = $derived.by(() => {
    const m = new Map<string, string>()
    for (const a of boundaryAnchors) m.set(a.externalNodeId, boundaryAnchorId(a.externalNodeId))
    return m
  })

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
    visibleSceneNodes.forEach((n, i) => m.set(n.id, i))
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

  function positionForAnchor(externalNodeId: string, anchorId: string): { x: number; y: number } {
    const override = placementById.get(anchorId)
    if (override) return override
    // Default: pick the in-scope endpoint of this anchor's wire and
    // offset to the upper-right so the anchor lands near its
    // partner instead of at origin. Multiple wires from the same
    // external node share the anchor and use the first match.
    for (const l of visibleLinks) {
      if (inScopeIds.has(l.from.node) && l.to.node === externalNodeId) {
        const p = positionFor(l.from.node)
        return { x: p.x + 80, y: p.y - 60 }
      }
      if (inScopeIds.has(l.to.node) && l.from.node === externalNodeId) {
        const p = positionFor(l.to.node)
        return { x: p.x + 80, y: p.y - 60 }
      }
    }
    return { x: 100, y: 100 }
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
      const label = Array.isArray(n.label) ? n.label[0] : (n.label ?? n.id)
      out.push({
        id: n.id,
        type: 'scene',
        position: positionFor(n.id),
        data: { label, spec: n.spec },
        draggable: interactive,
        selectable: true,
      })
    }
    for (const a of boundaryAnchors) {
      const id = boundaryAnchorId(a.externalNodeId)
      out.push({
        id,
        type: 'export',
        position: positionForAnchor(a.externalNodeId, id),
        data: {
          // Show "FW-1 (security)" — node identity + cross-boundary subgraph.
          label: a.subgraphLabel ? `${a.nodeLabel} (${a.subgraphLabel})` : a.nodeLabel,
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
      const from = inScopeIds.has(link.from.node)
        ? link.from.node
        : (externalToAnchorId.get(link.from.node) ?? link.from.node)
      const to = inScopeIds.has(link.to.node)
        ? link.to.node
        : (externalToAnchorId.get(link.to.node) ?? link.to.node)
      const crossBoundary = !inScopeIds.has(link.from.node) || !inScopeIds.has(link.to.node)
      const route = scene.wireRoutes.find((w) => w.linkId === link.id)
      // Cable length: scene-derived (calibration + endpoint positions
      // — placement override OR Node.position fallback) wins, else
      // stored link.cable.length_m. Same helper BOM / Connections use,
      // so canvas and the rest of the app agree on the value.
      const eff = cableLengthMeters(link, [scene], diagramState.nodes, diagramState.subgraphs)
      out.push({
        id: link.id,
        source: from,
        target: to,
        type: 'wire',
        data: {
          sceneId: scene.id,
          waypoints: route?.controlPoints ?? [],
          lengthMeters: eff?.meters ?? null,
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
  function onNodeDragStop(args: { targetNode: SfNode | null }) {
    const target = args.targetNode
    if (target) {
      diagramState.placeNodeInScene(scene.id, target.id, target.position)
    }
    diagramState.endTx()
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
    nodeTypes={{ scene: SceneNode, export: SceneExportNode, background: SceneBackgroundNode }}
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
    onnodedragstop={onNodeDragStop}
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
      {:else}
        Authoring…
      {/if}
    </div>
  {/if}
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
