<script lang="ts">
  import { type Node, type NodeProps, NodeToolbar } from '@xyflow/svelte'
  import { diagramState, editorState } from '$lib/context.svelte'
  import type { MapDrawing } from '$lib/types'

  type DrawingNode = Node<{ drawing: MapDrawing; onCalibrate: () => void }, 'drawing'>
  let { data, selected }: NodeProps<DrawingNode> = $props()
  const drawing = $derived(data.drawing)
</script>

<NodeToolbar style="z-index: 50 !important;" isVisible={selected && editorState.interactive}>
  <div
    data-print-hide
    class="nodrag nopan flex items-center gap-2 rounded-lg border border-neutral-200 bg-white p-2 text-xs text-neutral-800 shadow-lg dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
  >
    <span class="max-w-40 truncate">{drawing.name}</span>
    <button type="button" class="rounded border px-2 py-1" onclick={data.onCalibrate}>
      Set scale
    </button>
    <button
      type="button"
      class="rounded border px-2 py-1"
      onclick={() => diagramState.updateMapDrawing(drawing.id, { locked: !drawing.locked })}
    >
      {drawing.locked ? 'Unlock' : 'Lock'}
    </button>
    <button
      type="button"
      class="rounded border px-2 py-1"
      onclick={() => diagramState.removeMapDrawing(drawing.id)}
    >
      Remove image
    </button>
    <span
      >{drawing.calibration ? `${drawing.calibration.pxPerMeter.toFixed(1)} px/m` : 'Scale not set'}</span
    >
  </div>
</NodeToolbar>
<div class="relative h-full w-full" class:ring-2={selected} class:ring-blue-500={selected}>
  <img
    src={drawing.src}
    alt={drawing.name}
    draggable={false}
    class="pointer-events-none h-full w-full select-none"
  >
  <span
    class="pointer-events-none absolute top-0 left-0 rounded-br bg-white/90 px-2 py-1 text-xs text-neutral-800"
    >{drawing.name}</span
  >
</div>
