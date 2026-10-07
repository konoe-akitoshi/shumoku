<script lang="ts">
  import {
    Handle,
    type Node,
    type NodeProps,
    NodeToolbar,
    Position,
    useSvelteFlow,
  } from '@xyflow/svelte'
  import { diagramState, editorState } from '$lib/context.svelte'
  import type { MapOmission } from '$lib/types'

  type ContinuationNode = Node<{ omission: MapOmission; side: 'from' | 'to' }, 'continuation'>
  let { data, selected }: NodeProps<ContinuationNode> = $props()
  const sf = useSvelteFlow()
  const other = $derived(data.side === 'from' ? data.omission.to : data.omission.from)
  const name = $derived(`${data.omission.label} · ${data.side === 'from' ? 'A' : 'B'}`)
  function setMeters(event: Event) {
    const value = (event.target as HTMLInputElement).value
    diagramState.updateMapOmission(data.omission.id, {
      meters: value === '' ? undefined : Number(value),
    })
  }
</script>
<NodeToolbar isVisible={selected}>
  <div
    data-print-hide
    class="nodrag nopan flex items-center gap-2 rounded-lg border bg-white p-2 text-xs text-neutral-800 shadow-lg dark:bg-neutral-800 dark:text-neutral-100"
  >
    <button
      type="button"
      class="rounded border px-2 py-1"
      onclick={() => sf.setCenter(other.x, other.y, { zoom: sf.getViewport().zoom, duration: 250 })}
    >
      Go to other end
    </button>
    {#if editorState.interactive}
      <label
        >Omitted length
        <input
          class="w-20 rounded border bg-transparent px-2 py-1"
          aria-label="Omitted length in meters"
          type="number"
          min="0"
          step="0.1"
          placeholder="Unknown"
          value={data.omission.meters ?? ''}
          onchange={setMeters}
        >
        m</label
      >
      <button
        type="button"
        class="rounded border px-2 py-1"
        onclick={() => diagramState.removeMapOmission(data.omission.id)}
      >
        Restore line
      </button>
    {/if}
  </div>
</NodeToolbar>
<div
  class="flex h-full w-full items-center justify-center rounded border-2 border-dashed border-blue-600 bg-white text-xs text-blue-800"
  class:ring-2={selected}
>
  {name}
  ↗
</div>
{#each [Position.Top, Position.Right, Position.Bottom, Position.Left] as position}
  <Handle
    type="source"
    id={position}
    {position}
    isConnectable={false}
    style="opacity:0;width:1px;height:1px;"
  />
{/each}
