<script lang="ts">
import * as Dialog from '$lib/components/ui/dialog'
import { Button } from '$lib/components/ui/button'
import type { SubgraphSelectEvent } from './InteractiveSvgDiagram.svelte'
import Graph from 'phosphor-svelte/lib/Graph'
import ArrowSquareOut from 'phosphor-svelte/lib/ArrowSquareOut'

interface Props {
  open: boolean
  subgraphData: SubgraphSelectEvent | null
  onDrillDown?: (subgraphId: string) => void
}

let {
  open = $bindable(false),
  subgraphData = null,
  onDrillDown,
}: Props = $props()

function handleClose() {
  open = false
}

function handleDrillDown() {
  if (subgraphData?.subgraph.id && onDrillDown) {
    onDrillDown(subgraphData.subgraph.id)
    open = false
  }
}
</script>

<Dialog.Root {open} onOpenChange={(isOpen) => { if (!isOpen) handleClose() }}>
  <Dialog.Content class="sm:max-w-sm">
    <Dialog.Header>
      <Dialog.Title class="flex items-center gap-2">
        <Graph size={18} />
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

        {#if subgraphData.subgraph.canDrillDown}
          <div class="pt-2 border-t border-theme-border">
            <Button variant="outline" size="sm" class="w-full" onclick={handleDrillDown}>
              <ArrowSquareOut size={14} class="mr-1.5" />
              詳細を見る
            </Button>
          </div>
        {/if}
      </div>
    {/if}
  </Dialog.Content>
</Dialog.Root>
