<script lang="ts">
  import type { Node as GraphNode } from '@shumoku/core'
  import {
    type Connection,
    ConnectionMode,
    type Edge,
    type Node as SfNode,
    SvelteFlow,
  } from '@xyflow/svelte'
  import { untrack } from 'svelte'
  import '@xyflow/svelte/dist/style.css'
  import { diagramState, editorState } from '$lib/context.svelte'
  import { mapSpans, omissionEndId, spanMeters } from '$lib/map/model'
  import {
    effectiveNodeSize,
    mapMarkerFlowScale,
    pickSideForDirection,
    sceneNodeSize,
  } from '$lib/scene/node-geometry'
  import type { Scene } from '$lib/types'
  import EpsRoutingModal from '../scene/EpsRoutingModal.svelte'
  import NodeRoutingModal from '../scene/NodeRoutingModal.svelte'
  import SceneFitOnLoad from '../scene/SceneFitOnLoad.svelte'
  import SceneNode from '../scene/SceneNode.svelte'
  import ScenePrintFitter from '../scene/ScenePrintFitter.svelte'
  import { mapAuthoring as authoring } from './authoring.svelte'
  import MapCapture from './MapCapture.svelte'
  import MapContinuationNode from './MapContinuationNode.svelte'
  import MapDrawingNode from './MapDrawingNode.svelte'
  import MapEdge from './MapEdge.svelte'

  let { workspace }: { workspace: Scene } = $props()
  const map = $derived(workspace.map)
  const editing = $derived(editorState.interactive)
  const capturing = $derived(!!authoring.placement || !!authoring.calibration)
  let zoom = $state(1)
  const markerScale = $derived(mapMarkerFlowScale(zoom))
  let nodes = $state<SfNode[]>([])
  let edges = $state<Edge[]>([])
  let click = $state<{ x: number; y: number; n: number } | null>(null)
  let clickNumber = 0
  let routingNodeId = $state<string | null>(null)
  let routingEpsId = $state<string | null>(null)
  const activeOmissions = $derived(
    map?.omissions.filter((o) => diagramState.links.some((l) => l.id === o.linkId)) ?? [],
  )
  const broken = $derived(
    activeOmissions.filter((o) => {
      const link = diagramState.links.find((l) => l.id === o.linkId)
      return (
        !link ||
        !mapSpans(link, workspace, diagramState.terminations).some((s) => s.omission?.id === o.id)
      )
    }),
  )
  const bendLinks = $derived(
    new Map(diagramState.links.flatMap((l) => l.bends?.map((b) => [b.id, l.id] as const) ?? [])),
  )
  const termIds = $derived(new Set(diagramState.terminations.map((t) => t.id)))
  const drawnNodes = $derived.by<SfNode[]>(() => {
    const out: SfNode[] = []
    for (const drawing of map?.drawings ?? [])
      out.push({
        id: drawing.id,
        type: 'drawing',
        position: drawing.position,
        width: drawing.width * drawing.scale,
        height: drawing.height * drawing.scale,
        data: {
          drawing,
          onCalibrate: () => {
            authoring.placement = null
            authoring.calibration = { drawingId: drawing.id }
          },
        },
        zIndex: -1,
        draggable: editing && !drawing.locked && !capturing,
        selectable: !capturing,
        deletable: false,
        connectable: false,
      })
    for (const p of workspace.nodePlacements) {
      const node = diagramState.nodes.get(p.nodeId)
      if (!node || workspace.hiddenNodeIds?.includes(node.id)) continue
      const label = Array.isArray(node.label) ? node.label.join(' ') : (node.label ?? node.id)
      const size = effectiveNodeSize(workspace, node)
      const base = sceneNodeSize(node)
      out.push({
        id: node.id,
        type: 'scene',
        origin: [0.5, 0.5],
        position: p.position,
        width: size.w * markerScale,
        height: size.h * markerScale,
        data: {
          label,
          editableLabel: label,
          spec: node.spec,
          baseW: base.w * markerScale,
          baseH: base.h * markerScale,
          onOpenRouting: editing
            ? () => {
                routingNodeId = node.id
              }
            : undefined,
          onRename: editing
            ? (label: string) => diagramState.updateNode(node.id, { label })
            : undefined,
          onDelete: editing
            ? () => diagramState.removePlacementFromScene(workspace.id, node.id)
            : undefined,
        },
        draggable: editing && !capturing,
        selectable: !capturing,
        connectable: editing && !capturing,
      })
    }
    for (const term of diagramState.terminations) {
      if (!term.position) continue
      const shadow = { termination: { role: term.role } } as GraphNode
      const size = effectiveNodeSize(workspace, shadow)
      out.push({
        id: term.id,
        type: 'scene',
        origin: [0.5, 0.5],
        position: term.position,
        width: size.w * markerScale,
        height: size.h * markerScale,
        data: {
          label: term.label,
          termination: { role: term.role },
          onRename: editing
            ? (label: string) => diagramState.updateTermination(term.id, { label })
            : undefined,
          onDelete: editing ? () => diagramState.removeTermination(term.id) : undefined,
          onOpenEpsRouting:
            editing && term.role === 'eps'
              ? () => {
                  routingEpsId = term.id
                }
              : undefined,
        },
        draggable: editing && !capturing,
        selectable: !capturing,
        connectable: false,
      })
    }
    for (const link of diagramState.links)
      for (const bend of link.bends ?? []) {
        out.push({
          id: bend.id,
          type: 'scene',
          origin: [0.5, 0.5],
          position: { x: bend.x, y: bend.y },
          width: 16 * markerScale,
          height: 16 * markerScale,
          data: { label: '', termination: { role: 'bend' } },
          draggable: editing && !capturing,
          selectable: !capturing,
          connectable: false,
        })
      }
    for (const omission of activeOmissions)
      for (const side of ['from', 'to'] as const) {
        out.push({
          id: omissionEndId(omission.id, side),
          type: 'continuation',
          origin: [0.5, 0.5],
          position: omission[side],
          width: 64 * markerScale,
          height: 24 * markerScale,
          data: { omission, side },
          draggable: editing && !capturing,
          selectable: !capturing,
          connectable: false,
        })
      }
    return out
  })
  const drawnEdges = $derived.by<Edge[]>(() => {
    const result: Edge[] = []
    const visible = new Set(drawnNodes.map((n) => n.id))
    for (const link of diagramState.links) {
      if (!link.id || workspace.hiddenLinkIds?.includes(link.id)) continue
      for (const span of mapSpans(link, workspace, diagramState.terminations)) {
        if (span.omission || !visible.has(span.from.id) || !visible.has(span.to.id)) continue
        const dx = span.to.x - span.from.x,
          dy = span.to.y - span.from.y
        result.push({
          id: `${link.id}:${span.from.id}:${span.to.id}`,
          source: span.from.id,
          target: span.to.id,
          sourceHandle: pickSideForDirection(dx, dy),
          targetHandle: pickSideForDirection(-dx, -dy),
          type: 'mapWire',
          data: {
            linkId: link.id,
            span,
            meters: spanMeters(span, workspace),
            category: link.cable?.category,
          },
        })
      }
    }
    return result
  })
  $effect(() => {
    const selected = untrack(() => new Set(nodes.filter((n) => n.selected).map((n) => n.id)))
    nodes = drawnNodes.map((n) => ({ ...n, selected: selected.has(n.id) }))
  })
  $effect(() => {
    const selected = untrack(() => new Set(edges.filter((e) => e.selected).map((e) => e.id)))
    edges = drawnEdges.map((e) => ({ ...e, selected: selected.has(e.id) }))
  })
  function persist(moved: SfNode[]) {
    const drawingIds = new Set(map?.drawings.map((d) => d.id))
    const movedDrawingIds = new Set(moved.filter((n) => drawingIds.has(n.id)).map((n) => n.id))
    for (const node of moved) {
      if (drawingIds.has(node.id))
        diagramState.updateMapDrawing(node.id, { position: node.position })
      else if (!movedDrawingIds.has(map?.pointDrawingIds[node.id] ?? ''))
        diagramState.placeMapPoint(node.id, node.position)
    }
  }
  function capture(event: MouseEvent | TouchEvent) {
    const p = 'touches' in event ? event.changedTouches[0] : event
    if (p) click = { x: p.clientX, y: p.clientY, n: ++clickNumber }
  }
  function connect(c: Connection) {
    if (!editing || !diagramState.nodes.has(c.source) || !diagramState.nodes.has(c.target)) return
    diagramState.addWireInScene(workspace.id, c.source, c.target)
  }
  const bounds = $derived.by(() => {
    const drawings = map?.drawings ?? []
    if (!drawings.length) return null
    const x = Math.min(...drawings.map((d) => d.position.x)),
      y = Math.min(...drawings.map((d) => d.position.y))
    return {
      x,
      y,
      width: Math.max(...drawings.map((d) => d.position.x + d.width * d.scale)) - x,
      height: Math.max(...drawings.map((d) => d.position.y + d.height * d.scale)) - y,
    }
  })
</script>
<div class="relative h-full w-full">
  <SvelteFlow
    bind:nodes
    bind:edges
    nodeTypes={{ scene: SceneNode, drawing: MapDrawingNode, continuation: MapContinuationNode }}
    edgeTypes={{ mapWire: MapEdge }}
    nodesDraggable={editing && !capturing}
    nodesConnectable={editing && !capturing}
    elementsSelectable={!capturing}
    elevateNodesOnSelect={false}
    connectionMode={ConnectionMode.Loose}
    minZoom={0.01}
    maxZoom={4}
    zoomOnDoubleClick={false}
    panOnDrag={[1]}
    panActivationKey="Alt"
    panOnScroll
    selectionOnDrag={!capturing}
    deleteKey={editing ? ['Backspace', 'Delete'] : null}
    onmove={(_event, viewport) => { zoom = viewport.zoom }}
    onnodedragstart={() => diagramState.beginTx('Move map items')}
    onnodedrag={({ nodes: moved }) => persist(moved)}
    onnodedragstop={({ nodes: moved }) => { persist(moved); diagramState.endTx() }}
    onconnect={connect}
    onpaneclick={({ event }) => capture(event)}
    onnodeclick={({ event }) => { if (capturing) capture(event) }}
    ondelete={({ nodes: removedNodes, edges: removedEdges }) => {
      if (!editing) return
      diagramState.beginTx('Remove map selection')
      try {
        const links = new Set(removedEdges.filter((e) => removedNodes.length === 0 || e.selected).map((e) => e.data?.linkId).filter((id): id is string => typeof id === 'string'))
        for (const id of links) diagramState.removeLink(id)
        for (const node of removedNodes) {
          const omission = activeOmissions.find((o) => omissionEndId(o.id, 'from') === node.id || omissionEndId(o.id, 'to') === node.id)
          const bendLink = bendLinks.get(node.id)
          if (omission) diagramState.removeMapOmission(omission.id)
          else if (bendLink) diagramState.removeLinkBend(bendLink, node.id)
          else if (termIds.has(node.id)) diagramState.removeTermination(node.id)
          else diagramState.removePlacementFromScene(workspace.id, node.id)
        }
      } finally { diagramState.endTx() }
    }}
    proOptions={{ hideAttribution: true }}
  >
    <SceneFitOnLoad
      {bounds}
      refitKey={map?.drawings.map((d) => `${d.id}:${d.scale}`).join(',') ?? ''}
    />
    <ScenePrintFitter />
    <MapCapture {click} />
  </SvelteFlow>
  {#if capturing}
    <div
      data-print-hide
      class="pointer-events-none absolute top-20 left-1/2 z-20 -translate-x-1/2 rounded-lg bg-blue-600 px-3 py-2 text-xs text-white"
    >
      {authoring.calibration ? authoring.calibration.from ? 'Click the second reference point on the image' : 'Click the first reference point on the image' : 'Click to place the item'}
      · Esc to cancel
    </div>
  {/if}
  {#if broken.length}
    <div
      data-print-hide
      role="status"
      class="absolute bottom-24 left-4 max-w-sm rounded border bg-white p-2 text-xs text-neutral-800"
    >
      Continuation needs attention (missing or changed waypoint):
      {#each broken as omission (omission.id)}
        <button
          class="ml-2 underline"
          type="button"
          onclick={() => diagramState.removeMapOmission(omission.id)}
        >
          Restore {omission.label}
        </button>
      {/each}
    </div>
  {/if}
  <NodeRoutingModal
    nodeId={routingNodeId}
    sceneId={workspace.id}
    onclose={() => { routingNodeId = null }}
  />
  <EpsRoutingModal
    epsId={routingEpsId}
    sceneId={workspace.id}
    onclose={() => { routingEpsId = null }}
  />
</div>

<style>
  /* Image nodes sit below wires. Their portalled menus must nevertheless
     sit above the pane's selection surface, independent of node z-index. */
  :global(.svelte-flow__node-toolbar) {
    /* biome-ignore lint/complexity/noImportantStyles: Override Svelte Flow inline z-index for background-node menus. */
    z-index: 50 !important;
  }
</style>
