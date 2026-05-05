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
  import { diagramState, editorState } from '$lib/context.svelte'
  import { nodesInScope } from '$lib/scene/scope'
  import type { Scene } from '$lib/types'
  import SceneBackgroundNode from './SceneBackgroundNode.svelte'
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

  // ── Export pills (1 per destination subgraph) ────────────────────
  function exportNodeId(destSubgraphId: string): string {
    return `__scene_export_${destSubgraphId}`
  }
  function destSubgraphFor(nodeId: string): string {
    return diagramState.nodes.get(nodeId)?.parent ?? '__external__'
  }
  const exportPills = $derived.by(() => {
    const groups = new Map<string, { destId: string; label: string; nodeIds: Set<string> }>()
    for (const l of visibleLinks) {
      for (const ep of [l.from.node, l.to.node]) {
        if (inScopeIds.has(ep)) continue
        const destId = destSubgraphFor(ep)
        const sg = diagramState.subgraphs.get(destId)
        const fallback = (() => {
          const n = diagramState.nodes.get(ep)
          const lbl = Array.isArray(n?.label) ? n?.label[0] : n?.label
          return lbl ?? destId
        })()
        const label = sg?.label ?? fallback
        const existing = groups.get(destId) ?? { destId, label, nodeIds: new Set<string>() }
        existing.nodeIds.add(ep)
        groups.set(destId, existing)
      }
    }
    return [...groups.values()]
  })
  const externalToPill = $derived.by(() => {
    const m = new Map<string, string>()
    for (const pill of exportPills) {
      for (const id of pill.nodeIds) m.set(id, exportNodeId(pill.destId))
    }
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
    // Unplaced + bg present → staging tray on the left of the image.
    if (bg) {
      const idx = trayIndexById.get(nodeId)
      if (idx !== undefined) return { x: -120, y: 30 + idx * 60 }
    }
    const node = diagramState.nodes.get(nodeId)
    return node?.position ?? { x: 100, y: 100 }
  }

  function positionForPill(_destId: string, pillId: string): { x: number; y: number } {
    const override = placementById.get(pillId)
    if (override) return override
    // Default: average of in-scope endpoints connected to this pill.
    const partners: { x: number; y: number }[] = []
    for (const l of visibleLinks) {
      if (inScopeIds.has(l.from.node) && externalToPill.get(l.to.node) === pillId) {
        partners.push(positionFor(l.from.node))
      } else if (inScopeIds.has(l.to.node) && externalToPill.get(l.from.node) === pillId) {
        partners.push(positionFor(l.to.node))
      }
    }
    if (partners.length === 0) return { x: 100, y: 100 }
    const cx = partners.reduce((s, p) => s + p.x, 0) / partners.length
    const cy = partners.reduce((s, p) => s + p.y, 0) / partners.length
    return { x: cx + 80, y: cy - 60 }
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
    for (const pill of exportPills) {
      const id = exportNodeId(pill.destId)
      out.push({
        id,
        type: 'export',
        position: positionForPill(pill.destId, id),
        data: { label: pill.label },
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
        : (externalToPill.get(link.from.node) ?? link.from.node)
      const to = inScopeIds.has(link.to.node)
        ? link.to.node
        : (externalToPill.get(link.to.node) ?? link.to.node)
      const crossBoundary = !inScopeIds.has(link.from.node) || !inScopeIds.has(link.to.node)
      const route = scene.wireRoutes.find((w) => w.linkId === link.id)
      out.push({
        id: link.id,
        source: from,
        target: to,
        type: 'wire',
        data: {
          sceneId: scene.id,
          waypoints: route?.controlPoints ?? [],
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

  function onPaneClick() {
    if (auth.pendingPlacement) auth.pendingPlacement = null
  }

  // Initial fit: floor-plan image + staging tray on the left for any
  // unplaced pins (those default to negative-x in `positionFor`).
  // Excluding pins still at their diagram-side auto-layout positions
  // — those are far below the image and would shove the fit way out
  // of proportion.
  const TRAY_WIDTH = 180
  const hasUnplaced = $derived(
    visibleSceneNodes.some((n) => !scene.nodePlacements.find((p) => p.nodeId === n.id)),
  )
  const fitBounds = $derived.by<{ x: number; y: number; width: number; height: number } | null>(
    () => {
      if (!bg) return null
      const trayPad = hasUnplaced ? TRAY_WIDTH : 0
      return { x: -trayPad, y: 0, width: bg.width + trayPad, height: bg.height }
    },
  )
</script>

<div class="relative h-full w-full">
  <SvelteFlow
    bind:nodes
    bind:edges
    nodeTypes={{ scene: SceneNode, export: SceneExportNode, background: SceneBackgroundNode }}
    edgeTypes={{ wire: SceneEdge }}
    nodesDraggable={interactive}
    nodesConnectable={interactive}
    elementsSelectable={interactive}
    nodesFocusable={interactive}
    edgesFocusable={interactive}
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
  </SvelteFlow>

  <!-- Status hint: shown while the user is mid-action. Calibration UI
       and the rest of the authoring overlays will move here in
       follow-ups; this spike just confirms the Flow integration. -->
  {#if auth.pendingPlacement || auth.calibrationMode || auth.pendingWireFrom}
    <div
      class="pointer-events-none absolute top-3 left-1/2 z-10 -translate-x-1/2 rounded-full border border-neutral-200 bg-white/90 px-3 py-1 text-[11px] text-neutral-700 shadow backdrop-blur-sm dark:border-neutral-700 dark:bg-neutral-800/90 dark:text-neutral-200"
    >
      Authoring…
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
</style>
