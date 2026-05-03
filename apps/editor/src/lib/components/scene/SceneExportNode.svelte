<script lang="ts">
  import { Handle, type Node, type NodeProps, Position } from '@xyflow/svelte'

  // Boundary export pill — KiCad-style "this wire goes to subgraph X"
  // marker. One pill per destination subgraph (multiple cross-boundary
  // wires to the same place collapse here).

  type ExportNodeT = Node<{ label: string }, 'export'>
  let { data, selected }: NodeProps<ExportNodeT> = $props()
</script>

<div
  class="flex h-[22px] min-w-[60px] items-center justify-center rounded-full border bg-white px-2 text-[10.5px] text-slate-600 italic shadow-sm {selected
    ? 'border-blue-500 ring-2 ring-blue-200'
    : 'border-neutral-400'}"
  style="pointer-events: all;"
>
  <Handle type="target" position={Position.Left} style="opacity: 0;" />
  <Handle type="source" position={Position.Right} style="opacity: 0;" />
  <span class="max-w-[160px] truncate">{data.label}</span>
</div>
