<script lang="ts">
  import type { Link } from '@shumoku/core'
  import { Dialog, ScrollArea } from 'bits-ui'
  import { X } from 'phosphor-svelte'
  import type { PoEBudget } from '$lib/poe-analysis'
  import type { SpecPaletteEntry } from '$lib/types'
  import EdgeDetail from './detail/EdgeDetail.svelte'
  import NodeDetail from './detail/NodeDetail.svelte'
  import PortDetail from './detail/PortDetail.svelte'
  import SubgraphDetail from './detail/SubgraphDetail.svelte'

  let {
    open = false,
    data,
    mode = 'view',
    poeBudget,
    boundPaletteId,
    palette = [],
    links = [],
    onclose,
    onupdate,
    onbindpalette,
  }: {
    open?: boolean
    // biome-ignore lint/suspicious/noExplicitAny: mixed element data
    data: Record<string, any> | null
    mode?: 'edit' | 'view'
    poeBudget?: PoEBudget
    boundPaletteId?: string
    palette?: SpecPaletteEntry[]
    links?: Link[]
    onclose?: () => void
    onupdate?: (id: string, field: string, value: string) => void
    onbindpalette?: (nodeId: string, paletteId: string) => void
  } = $props()

  const kind = $derived((data?.kind as string) ?? 'unknown')
  const editing = $derived(mode === 'edit')

  function kindColor(k: string) {
    if (k === 'node') return 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
    if (k === 'subgraph')
      return 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
    if (k === 'edge') return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
    if (k === 'port')
      return 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300'
    return 'bg-neutral-100 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300'
  }
</script>

<Dialog.Root {open} onOpenChange={(o) => { if (!o) onclose?.() }}>
  <Dialog.Portal>
    <Dialog.Overlay class="fixed inset-0 z-40 bg-black/20 dark:bg-black/40 backdrop-blur-[2px]" />
    <Dialog.Content
      class="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[480px] bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl shadow-2xl focus:outline-none"
    >
      {#if data}
        <!-- Header -->
        <div
          class="flex items-center justify-between px-5 py-4 border-b border-neutral-200 dark:border-neutral-700"
        >
          <div class="flex items-center gap-2.5">
            <span
              class="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-md {kindColor(kind)}"
            >
              {kind}
            </span>
            <Dialog.Title
              class="text-sm font-mono text-neutral-600 dark:text-neutral-300 truncate max-w-[300px]"
            >
              {data.id ?? ''}
            </Dialog.Title>
          </div>
          <Dialog.Close
            class="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 dark:hover:text-neutral-200 dark:hover:bg-neutral-700 transition-colors"
          >
            <X class="w-4 h-4" />
          </Dialog.Close>
        </div>

        <Dialog.Description class="sr-only">
          Properties of {kind} element {data.id ?? ''}
        </Dialog.Description>

        <!-- Content — kind-specific -->
        <ScrollArea.Root style="height: 50vh;">
          <ScrollArea.Viewport style="height: 100%;">
            <div class="px-5 py-4 text-xs space-y-3">
              {#if kind === 'node'}
                <NodeDetail
                  {data}
                  {editing}
                  {poeBudget}
                  {boundPaletteId}
                  {palette}
                  {links}
                  {onupdate}
                  {onbindpalette}
                />
              {:else if kind === 'edge'}
                <EdgeDetail {data} />
              {:else if kind === 'subgraph'}
                <SubgraphDetail {data} {editing} {onupdate} />
              {:else if kind === 'port'}
                <PortDetail {data} {links} />
              {:else}
                <pre
                  class="text-[11px] font-mono text-neutral-600 dark:text-neutral-300 whitespace-pre-wrap break-all"
                >{JSON.stringify(data, null, 2)}</pre>
              {/if}
            </div>
          </ScrollArea.Viewport>
          <ScrollArea.Scrollbar
            orientation="vertical"
            class="flex w-2 touch-none select-none rounded-full bg-neutral-100 dark:bg-neutral-700/50 p-px"
          >
            <ScrollArea.Thumb
              class="flex-1 rounded-full bg-neutral-300 dark:bg-neutral-500 hover:bg-neutral-400 dark:hover:bg-neutral-400 transition-colors"
            />
          </ScrollArea.Scrollbar>
        </ScrollArea.Root>
      {/if}
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
