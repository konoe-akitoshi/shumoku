<script lang="ts">
  import type { Node, Subgraph } from '@shumoku/core'

  let {
    subgraph,
    nodes,
    subgraphs,
  }: {
    subgraph: Subgraph
    nodes: Map<string, Node>
    subgraphs: Map<string, Subgraph>
  } = $props()

  const childNodeCount = $derived.by(() => {
    let count = 0
    for (const [_id, n] of nodes) {
      if (n.parent === subgraph.id) count++
    }
    return count
  })

  const childSubgraphCount = $derived.by(() => {
    let count = 0
    for (const [_id, sg] of subgraphs) {
      if (sg.parent === subgraph.id) count++
    }
    return count
  })

  const parentLabel = $derived.by(() => {
    if (!subgraph.parent) return undefined
    const parent = subgraphs.get(subgraph.parent)
    return parent?.label ?? subgraph.parent
  })
</script>

<!-- Label -->
<div>
  <div class="text-sm font-semibold text-neutral-800 dark:text-neutral-100 truncate">
    {subgraph.label ?? subgraph.id}
  </div>
</div>

<!-- Info -->
<div>
  <div
    class="text-[10px] font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mb-1.5"
  >
    Group Info
  </div>
  <dl class="space-y-1.5 text-[11px]">
    <div class="flex justify-between">
      <dt class="text-neutral-400 dark:text-neutral-500">Children</dt>
      <dd class="font-mono">{childNodeCount} nodes, {childSubgraphCount} groups</dd>
    </div>
    {#if subgraph.direction}
      <div class="flex justify-between">
        <dt class="text-neutral-400 dark:text-neutral-500">Direction</dt>
        <dd class="font-mono">{subgraph.direction}</dd>
      </div>
    {/if}
    {#if subgraph.parent}
      <div class="flex justify-between">
        <dt class="text-neutral-400 dark:text-neutral-500">Parent</dt>
        <dd class="font-mono">{parentLabel}</dd>
      </div>
    {/if}
  </dl>
</div>
