<script lang="ts">
  import type { CableGrade, Node } from '@shumoku/core'
  import {
    type Connection,
    ConnectionMode,
    type Edge,
    type Node as SfNode,
    SvelteFlow,
  } from '@xyflow/svelte'
  import '@xyflow/svelte/dist/style.css'
  import { onDestroy, onMount } from 'svelte'
  import { diagramState, editorState } from '$lib/context.svelte'
  import { cableSegmentLengths, visibleCableSegments } from '$lib/scene/cable-length'
  import {
    effectiveNodeSize,
    nodeCenterFromTopLeft,
    pickSideForDirection,
    sceneNodeSize,
  } from '$lib/scene/node-geometry'
  import { nodesInScope } from '$lib/scene/scope'
  import type { Scene } from '$lib/types'
  import CableLegend from './CableLegend.svelte'
  import EpsRoutingModal from './EpsRoutingModal.svelte'
  import NodeRoutingModal from './NodeRoutingModal.svelte'
  import SceneBackgroundNode from './SceneBackgroundNode.svelte'
  import SceneCalibrationCapture from './SceneCalibrationCapture.svelte'
  import SceneClickPlace from './SceneClickPlace.svelte'
  import SceneEdge from './SceneEdge.svelte'
  import SceneFitOnLoad from './SceneFitOnLoad.svelte'
  import SceneNode from './SceneNode.svelte'
  import ScenePrintFitter from './ScenePrintFitter.svelte'
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
  // Cable grades referenced by visible links — feeds the in-canvas
  // legend so it only lists grades actually used in this scene.
  // Links without `cable.category` contribute nothing and keep the
  // default slate stroke.
  const presentCableGrades = $derived.by(() => {
    const set = new Set<CableGrade>()
    for (const l of visibleLinks) {
      const cat = l.cable?.category
      if (cat) set.add(cat)
    }
    return set
  })
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

  // Per-scene visual tuning. Node size is computed via the shared
  // `effectiveNodeSize` helper so length math sees identical
  // dimensions; here we just keep the wire-scale resolver (no
  // analogous helper in node-geometry — wires aren't placeable
  // shapes, so the scale lookup lives at the call site).
  const sceneWireScale = $derived(scene.display?.wireScale ?? 1)

  function effectiveWireScale(link: { metadata?: Record<string, unknown> }): number {
    const ov = link.metadata?.wireScale
    if (typeof ov === 'number' && ov > 0) return ov
    return sceneWireScale
  }

  // Effective rendered dimensions for a node. We pass these to Svelte
  // Flow as `Node.width`/`Node.height` so the library positions
  // handles and computes sourceX/Y / targetX/Y itself; SceneNode just
  // fills the wrapper with `w-full h-full`.
  function effSize(nodeId: string): { w: number; h: number } {
    return effectiveNodeSize(scene, diagramState.nodes.get(nodeId))
  }

  // Center of a node-or-termination's icon in flow coords. Used for
  // via waypoint positions — Svelte Flow doesn't expose those
  // automatically (they're not edge endpoints). Terminations no
  // longer live in `diagram.nodes`; resolve them through the
  // registry and the position they carry on themselves.
  function centerOf(nodeId: string): { x: number; y: number } {
    const real = diagramState.nodes.get(nodeId)
    if (real) return nodeCenterFromTopLeft(scene, real, positionFor(nodeId))
    const term = diagramState.terminations.find((t) => t.id === nodeId)
    if (term?.position) {
      const shadow = { id: term.id, label: term.label, termination: { role: term.role } } as Node
      return nodeCenterFromTopLeft(scene, shadow, term.position)
    }
    return nodeCenterFromTopLeft(scene, undefined, { x: 0, y: 0 })
  }

  // Reverse lookup so the drag / delete intercepts can tell whether
  // an sf-node id refers to a real `Node` or a bend on a link. Built
  // once per derive cycle and cheap to query — bends are sparse.
  const bendIdToLinkId = $derived.by(() => {
    const m = new Map<string, string>()
    for (const link of diagramState.links) {
      if (!link.id || !link.bends) continue
      for (const b of link.bends) m.set(b.id, link.id)
    }
    return m
  })

  // Termination ids — used by drag / delete / rename intercepts to
  // tell sf-node ids referring to entries in the global termination
  // registry apart from real `Node` ids.
  const terminationIds = $derived.by(() => new Set(diagramState.terminations.map((t) => t.id)))

  /**
   * Inner waypoints between segment endpoints, with bends interleaved
   * at their `afterIndex` slots. Mirrors the polyline that
   * `cableSegmentLengths` walks so visual and accounting agree.
   */
  function innerWaypointsForSegment(
    link: import('@shumoku/core').Link,
    segIds: string[],
  ): Array<{ x: number; y: number }> {
    const out: Array<{ x: number; y: number }> = []
    const bends = link.bends ?? []
    const via = link.via ?? []
    const linkFromNode = link.from.node
    const globalViaIndex = new Map<string, number>(via.map((id, i) => [id, i]))
    // segIds is [segStart, ...inner via terminations..., segEnd].
    // Walk adjacent pairs; for each gap insert bends whose
    // `afterIndex` matches the left side's global position.
    for (let k = 0; k < segIds.length - 1; k++) {
      const left = segIds[k]
      if (!left) continue
      const leftAfter = left === linkFromNode ? -1 : (globalViaIndex.get(left) ?? -1)
      for (const b of bends) {
        if (b.afterIndex === leftAfter) out.push({ x: b.x, y: b.y })
      }
      const nextId = segIds[k + 1]
      // The right end of this gap is either an inner via point
      // (push its center) or the segment's last node (handled by
      // the edge target — don't double-push).
      if (k + 1 < segIds.length - 1 && nextId) {
        out.push(centerOf(nextId))
      }
    }
    return out
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
      const isBend = n.termination?.role === 'bend'
      const baseLabel = Array.isArray(n.label) ? n.label[0] : (n.label ?? n.id)
      // Bends are anonymous waypoints — no label clutter beneath the
      // tiny anchor dot.
      const label = isBend ? '' : `${baseLabel}${externalSubgraphSuffix(n.id)}`
      const base = sceneNodeSize(n)
      const { w, h } = effSize(n.id)
      const isEps = n.termination?.role === 'eps'
      const isDevice = !n.termination
      out.push({
        id: n.id,
        type: 'scene',
        position: positionFor(n.id),
        // Svelte Flow uses width/height to size the wrapper and
        // anchor handles — no need to also push the size into data.
        width: w,
        height: h,
        data: {
          label,
          // Raw label without the cross-boundary subgraph suffix —
          // this is what Rename should round-trip, so the suffix
          // doesn't get baked into Node.label.
          editableLabel: isBend ? '' : baseLabel,
          spec: n.spec,
          termination: n.termination,
          baseW: base.w,
          baseH: base.h,
          onOpenRouting: isDevice
            ? () => {
                routingNodeId = n.id
              }
            : undefined,
          onOpenEpsRouting: isEps
            ? () => {
                routingEpsId = n.id
              }
            : undefined,
          onDelete: () => diagramState.removeNode(n.id),
          // Rename — applies to terminations and devices alike. Bends
          // are anonymous, so they don't expose this. Edits flow into
          // Node.label so Diagram / Connections / other scenes pick
          // up the new name automatically.
          onRename: isBend
            ? undefined
            : (label: string) => {
                diagramState.updateNode(n.id, { label: label || undefined })
              },
          onResizeScale: (scale: number) => {
            const node = diagramState.nodes.get(n.id)
            if (!node) return
            const meta = { ...(node.metadata ?? {}) }
            // 1× sits at the scene default; clear the override so
            // future scene scale tweaks reflow this node too.
            if (Math.abs(scale - 1) < 0.02) delete meta.displayScale
            else meta.displayScale = Number(scale.toFixed(2))
            diagramState.updateNode(n.id, {
              metadata: Object.keys(meta).length > 0 ? meta : undefined,
            })
          },
        },
        draggable: interactive,
        selectable: true,
      })
    }
    // Virtual sf nodes for every termination in the global registry.
    // Terminations no longer live in `diagram.nodes`, so the canvas
    // synthesizes one sf node per entry to keep drag / select /
    // rename / delete flowing through Svelte Flow as before. The
    // drag and delete intercepts route synthetic ids back to
    // `updateTermination` / `removeTermination`. Same trick as bends
    // below, but terminations carry shared identity so they live in
    // their own global array rather than per-link.
    for (const t of diagramState.terminations) {
      if (!t.position) continue
      const size =
        t.role === 'eps'
          ? { w: 22, h: 32 }
          : t.role === 'outlet'
            ? { w: 28, h: 28 }
            : { w: 44, h: 22 }
      out.push({
        id: t.id,
        type: 'scene',
        position: { x: t.position.x, y: t.position.y },
        width: size.w,
        height: size.h,
        data: {
          label: t.label,
          editableLabel: t.label,
          termination: { role: t.role },
          baseW: size.w,
          baseH: size.h,
          onDelete: () => diagramState.removeTermination(t.id),
          onRename: (label: string) =>
            diagramState.updateTermination(t.id, { label: label || t.label }),
        },
        draggable: interactive,
        selectable: true,
      })
    }
    // Virtual sf nodes for every link bend. Bends are not in
    // `diagram.nodes` (they live on `link.bends`), so the canvas
    // synthesizes one sf node per bend so the user can still drag /
    // select / delete them through the standard Svelte Flow path.
    // The drag and delete intercepts (persistDragged, onnodesdelete)
    // route these synthetic ids back to `updateLinkBend` /
    // `removeLinkBend` instead of the real-Node store.
    for (const link of visibleLinks) {
      const bends = link.bends
      if (!link.id || !bends) continue
      for (const b of bends) {
        out.push({
          id: b.id,
          type: 'scene',
          position: { x: b.x, y: b.y },
          width: 16,
          height: 16,
          data: {
            label: '',
            termination: { role: 'bend' },
            baseW: 16,
            baseH: 16,
          },
          draggable: interactive,
          selectable: true,
        })
      }
    }
    return out
  })

  // One Svelte Flow edge per *visible cable segment* (i.e. per
  // physical cable run). A logical Link with via passing through
  // an EPS becomes 2 edges — rack-side and room-side — so that
  // each cable selects, hovers, and gets dragged on its own. The
  // underlying Link is unchanged: deleting any one edge removes
  // the whole logical wire (the data model is still all-or-
  // nothing per Link); deleting a TP node strips it from `via` so
  // the segments rejoin or disappear naturally.
  const sfEdges = $derived.by<Edge[]>(() => {
    const out: Edge[] = []
    for (const link of visibleLinks) {
      if (!link.id) continue
      const linkFrom = link.from.node
      const linkTo = link.to.node
      const crossBoundary = !inScopeIds.has(linkFrom) || !inScopeIds.has(linkTo)
      const idSegments = visibleCableSegments(link, diagramState.nodes, diagramState.terminations)
      // Per-segment via offset — global via index of the segment's
      // left endpoint. Source-rooted segment = 0; room-side (after
      // EPS) = (viaIndex of head) + 1. Drag-to-bend uses this to
      // map a local insertion within this segment to the right
      // position in `link.via`.
      const via = link.via ?? []
      const viaIndexOf = new Map<string, number>(via.map((id, i) => [id, i] as const))
      // Cable length per segment (already computed by
      // cableSegmentLengths in the same order as visibleCableSegments).
      const segParts = cableSegmentLengths(
        link,
        [scene],
        diagramState.nodes,
        diagramState.terminations,
      )
      const wireScale = effectiveWireScale(link)
      for (let i = 0; i < idSegments.length; i++) {
        const segIds = idSegments[i] ?? []
        const segFrom = segIds[0]
        const segTo = segIds[segIds.length - 1]
        if (!segFrom || !segTo || segFrom === segTo) continue
        const segFromPos = centerOf(segFrom)
        const segToPos = centerOf(segTo)
        // Inner waypoints between segFrom and segTo. Includes:
        //   - centers of inner via terminations (eps / outlet / panel)
        //   - bend positions interleaved at their `afterIndex` slots
        // Order is the polyline the user sees, so cable length math
        // and the rendered curve stay in sync.
        const innerWaypoints = innerWaypointsForSegment(link, segIds)
        // Handle side: out from segFrom toward the next visible
        // point; into segTo from the previous one.
        const firstInner = innerWaypoints[0] ?? segToPos
        const lastInner = innerWaypoints[innerWaypoints.length - 1] ?? segFromPos
        const sourceHandle = pickSideForDirection(
          firstInner.x - segFromPos.x,
          firstInner.y - segFromPos.y,
        )
        const targetHandle = pickSideForDirection(
          lastInner.x - segToPos.x,
          lastInner.y - segToPos.y,
        )
        const j = viaIndexOf.get(segFrom)
        const viaOffset = segFrom === linkFrom ? 0 : j === undefined ? 0 : j + 1
        const meters = segParts[i]?.meters ?? null
        out.push({
          id: `${link.id}::${i}`,
          source: segFrom,
          target: segTo,
          sourceHandle,
          targetHandle,
          type: 'wire',
          data: {
            sceneId: scene.id,
            linkId: link.id,
            segmentIndex: i,
            viaOffset,
            innerWaypoints,
            lengthMeters: meters,
            wireScale,
            // Cable grade drives wire stroke color in SceneEdge —
            // see lib/scene/cable-colors.ts + CABLE_COLORS.md.
            cableCategory: link.cable?.category,
          },
          animated: false,
          style: crossBoundary ? 'stroke-dasharray: 5 3;' : '',
        })
      }
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
  // Drag handlers receive both `targetNode` (the one under the
  // pointer) and `nodes` (every node moving in this gesture — for
  // multi-select group drags). Bulk-persist so each drag tick
  // triggers exactly one store mutation / derive cascade instead
  // of one per selected node.
  function persistDragged(nodes: SfNode[] | null | undefined) {
    if (!nodes || nodes.length === 0) return
    // Partition by id kind:
    //   - bend ids → link.bends array
    //   - termination ids → global termination registry
    //   - real Node ids → scene placement map (as before)
    const placements: Array<{ nodeId: string; position: { x: number; y: number } }> = []
    for (const n of nodes) {
      const linkId = bendIdToLinkId.get(n.id)
      if (linkId) {
        diagramState.updateLinkBend(linkId, n.id, n.position)
        continue
      }
      if (terminationIds.has(n.id)) {
        diagramState.updateTermination(n.id, { position: n.position })
        continue
      }
      placements.push({ nodeId: n.id, position: n.position })
    }
    if (placements.length > 0) diagramState.placeNodesInScene(scene.id, placements)
  }
  function onNodeDragStart(_args: { targetNode: SfNode | null; nodes: SfNode[] }) {
    diagramState.beginTx('Move item')
  }
  function onNodeDrag(args: { targetNode: SfNode | null; nodes: SfNode[] }) {
    // Live placement update mid-drag so wires routed through this
    // node (via TP) follow the cursor instead of waiting for drop,
    // and so multi-drag updates each selected node's placement.
    persistDragged(args.nodes)
  }
  function onNodeDragStop(args: { targetNode: SfNode | null; nodes: SfNode[] }) {
    persistDragged(args.nodes)
    diagramState.endTx()
  }

  // Routing modals open from the per-node NodeToolbar buttons (a
  // device → node-side modal, an EPS → chase-side modal). The state
  // lives here so SceneCanvas can mount the dialogs.
  let routingNodeId = $state<string | null>(null)
  let routingEpsId = $state<string | null>(null)

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
    panOnDrag={[1]}
    panActivationKey="Alt"
    panOnScroll
    selectionOnDrag
    onnodedragstart={onNodeDragStart}
    onnodedrag={onNodeDrag}
    onnodedragstop={onNodeDragStop}
    onconnect={onConnect}
    onpaneclick={onPaneClick}
    ondelete={({ nodes, edges }: { nodes: SfNode[]; edges: Edge[] }) => {
      // Native Backspace/Delete keyboard path. Each Svelte Flow
      // edge corresponds to a single visible cable segment, but
      // its id is `${linkId}::${segmentIndex}` and the underlying
      // data model is one Link — deleting any segment removes the
      // whole logical wire. Dedupe via a Set so a multi-segment
      // selection (rare via keyboard) doesn't re-call removeLink
      // for the same Link.
      const linkIds = new Set<string>()
      for (const e of edges) {
        const linkId =
          (e.data as { linkId?: string } | undefined)?.linkId ??
          (typeof e.id === 'string' ? e.id.split('::')[0] : undefined)
        if (linkId) linkIds.add(linkId)
      }
      for (const id of linkIds) diagramState.removeLink(id)
      for (const n of nodes) {
        const linkId = bendIdToLinkId.get(n.id)
        if (linkId) diagramState.removeLinkBend(linkId, n.id)
        else if (terminationIds.has(n.id)) diagramState.removeTermination(n.id)
        else diagramState.removeNode(n.id)
      }
    }}
    proOptions={{ hideAttribution: true }}
  >
    <SceneFitOnLoad bounds={fitBounds} refitKey={bg?.src ?? ''} />
    <ScenePrintFitter />
    <SceneCalibrationCapture sceneId={scene.id} paneClick={paneClickEvent} />
    <SceneClickPlace sceneId={scene.id} paneClick={paneClickEvent} />
    <CableLegend presentGrades={presentCableGrades} />
  </SvelteFlow>

  <!-- Status hint: shown while the user is mid-action. Calibration UI
       and the rest of the authoring overlays will move here in
       follow-ups; this spike just confirms the Flow integration. -->
  {#if auth.calibrationMode || auth.pendingPlacement}
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
    /* biome-ignore lint/complexity/noImportantStyles: overrides Svelte Flow defaults */
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
    /* biome-ignore lint/complexity/noImportantStyles: overrides Svelte Flow defaults */
    opacity: 0 !important;
  }
  /* Placement-pending: crosshair cursor on the pane so users see
                                   "click somewhere to drop the item". */
  .scene-canvas-placing :global(.svelte-flow__pane) {
    /* biome-ignore lint/complexity/noImportantStyles: overrides Svelte Flow defaults */
    cursor: crosshair !important;
  }
</style>
