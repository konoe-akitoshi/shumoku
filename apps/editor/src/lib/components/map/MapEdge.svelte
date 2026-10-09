<script lang="ts">
  import type { CableGrade } from '@shumoku/core'
  import { BaseEdge, type Edge, EdgeLabel, type EdgeProps, useSvelteFlow } from '@xyflow/svelte'
  import { diagramState, editorState } from '$lib/context.svelte'
  import type { MapSpan } from '$lib/map/model'
  import { cableCategoryColor } from '$lib/scene/cable-colors'
  import { bendOnDrag } from '../scene/wire-edit'
  import { mapAuthoring } from './authoring.svelte'

  type MapEdgeType = Edge<
    { linkId: string; span: MapSpan; meters: number | null; category?: CableGrade },
    'mapWire'
  >
  let { data, sourceX, sourceY, targetX, targetY, selected }: EdgeProps<MapEdgeType> = $props()
  const sf = useSvelteFlow()
  const d = $derived(`M ${sourceX} ${sourceY} L ${targetX} ${targetY}`)
  const x = $derived((sourceX + targetX) / 2)
  const y = $derived((sourceY + targetY) / 2)
  const editableSpan = $derived(
    data && !data.span.from.id.startsWith('omission:') && !data.span.to.id.startsWith('omission:'),
  )
  function drag(event: PointerEvent) {
    if (!editorState.interactive || event.button !== 0 || !data || !editableSpan) return
    event.stopPropagation()
    mapAuthoring.cancelWireDrag?.()
    const edge = data
    const link = diagramState.links.find((l) => l.id === edge.linkId)
    if (!link) return
    const original = new Map(link.bends?.map((b) => [b.id, { ...b }]))
    mapAuthoring.cancelWireDrag = bendOnDrag({
      linkId: edge.linkId,
      points: [edge.span.from, edge.span.to].map((p) => ({
        ...p,
        bendId: original.has(p.id) ? p.id : undefined,
      })),
      startClient: { x: event.clientX, y: event.clientY },
      toFlow: (x, y) => sf.screenToFlowPosition({ x, y }),
      zoom: sf.getViewport().zoom,
      pointerId: event.pointerId,
      addBend: event.altKey,
      onCommit: () => {
        for (const bend of diagramState.links.find((l) => l.id === edge.linkId)?.bends ?? []) {
          const before = original.get(bend.id)
          if (!before || before.x !== bend.x || before.y !== bend.y)
            diagramState.placeMapPoint(bend.id, { x: bend.x, y: bend.y })
        }
      },
    })
  }
</script>
<BaseEdge
  path={d}
  interactionWidth={16}
  style="stroke:{selected ? '#3b82f6' : cableCategoryColor(data?.category)};stroke-width:3;"
/>
<path
  role="presentation"
  {d}
  class="nopan nodrag"
  fill="none"
  stroke="transparent"
  stroke-width="12"
  onpointerdown={drag}
/>
{#if selected && data}
  <EdgeLabel {x} {y}>
    <div
      data-print-hide
      class="nodrag nopan pointer-events-auto flex gap-2 rounded border bg-white px-2 py-1 text-xs text-neutral-800 shadow"
    >
      <span>{data.meters === null ? 'Length unknown' : `${data.meters.toFixed(1)} m`}</span>
      {#if editorState.interactive && editableSpan}
        <button
          type="button"
          class="rounded border px-2"
          onclick={() => data && diagramState.addMapOmission(data.linkId, data.span.from.id, data.span.to.id)}
        >
          Omit span
        </button>
      {/if}
    </div>
  </EdgeLabel>
{/if}
