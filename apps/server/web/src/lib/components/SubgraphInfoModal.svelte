<script lang="ts">
  import { GraphIcon } from 'phosphor-svelte'
  import * as Dialog from '$lib/components/ui/dialog'
  import type { SubgraphSelectEvent } from './InteractiveSvgDiagram.svelte'

  interface Props {
    open: boolean
    subgraphData: SubgraphSelectEvent | null
  }

  let { open = $bindable(false), subgraphData = null }: Props = $props()

  function handleClose() {
    open = false
  }
</script>

<Dialog.Root
  {open}
  onOpenChange={(isOpen) => {
    if (!isOpen) handleClose()
  }}
>
  <Dialog.Content class="sm:max-w-sm">
    <Dialog.Header>
      <Dialog.Title class="flex items-center gap-2">
        <GraphIcon size={18} />
        {subgraphData?.subgraph.label || 'Subgraph'}
      </Dialog.Title>
    </Dialog.Header>

    {#if subgraphData}
      <div class="space-y-3 py-2">
        <div class="grid grid-cols-2 gap-3 text-sm">
          <div class="text-theme-text-muted">ID</div>
          <div class="text-theme-text font-mono text-xs">{subgraphData.subgraph.id}</div>

          <div class="text-theme-text-muted">Nodes</div>
          <div class="text-theme-text">{subgraphData.subgraph.nodeCount}</div>

          <div class="text-theme-text-muted">Links</div>
          <div class="text-theme-text">{subgraphData.subgraph.linkCount}</div>
        </div>
      </div>
    {/if}
  </Dialog.Content>
</Dialog.Root>
