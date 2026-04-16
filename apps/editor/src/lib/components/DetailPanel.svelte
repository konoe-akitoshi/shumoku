<script lang="ts">
  import { Dialog, ScrollArea, Tabs } from 'bits-ui'
  import { X } from 'phosphor-svelte'
  import { diagramState, editorState } from '$lib/context.svelte'
  import LinkContent from './detail/LinkContent.svelte'
  import LinkProperties from './detail/LinkProperties.svelte'
  import NodeContent from './detail/NodeContent.svelte'
  import NodeProperties from './detail/NodeProperties.svelte'
  import SubgraphContent from './detail/SubgraphContent.svelte'
  import SubgraphProperties from './detail/SubgraphProperties.svelte'

  let {
    open = false,
    elementType = null,
    elementId = null,
    onclose,
  }: {
    open?: boolean
    elementType?: 'node' | 'link' | 'subgraph' | null
    elementId?: string | null
    onclose?: () => void
  } = $props()

  const editing = $derived(editorState.mode === 'edit')

  // Resolve element from diagramState
  const node = $derived(
    elementType === 'node' && elementId ? (diagramState.nodes.get(elementId) ?? null) : null,
  )
  const link = $derived(
    elementType === 'link' && elementId
      ? (diagramState.links.find((l) => l.id === elementId) ?? null)
      : null,
  )
  const subgraph = $derived(
    elementType === 'subgraph' && elementId
      ? (diagramState.subgraphs.get(elementId) ?? null)
      : null,
  )

  const displayLabel = $derived.by(() => {
    if (node) {
      const l = node.label
      return Array.isArray(l) ? l[0] : (l ?? node.id)
    }
    if (link) return link.id ?? 'Link'
    if (subgraph) return subgraph.label ?? subgraph.id
    return ''
  })

  function kindColor(k: string) {
    if (k === 'node') return 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
    if (k === 'subgraph')
      return 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
    if (k === 'link') return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
    return 'bg-neutral-100 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300'
  }

  const tabTriggerClass =
    'px-4 py-2.5 text-xs font-medium border-b-2 transition-colors data-[state=active]:border-blue-500 data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400 border-transparent text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200'

  // Node update helpers
  function updateNode(field: string, value: unknown) {
    if (!node) return
    const n = new Map(diagramState.nodes)
    n.set(node.id, { ...node, [field]: value })
    diagramState.nodes = n
  }

  function bindPalette(paletteId: string) {
    if (!node) return
    diagramState.bindNodeToPalette(node.id, paletteId)
  }

  // Link update helper
  function updateLink(updates: Partial<import('@shumoku/core').Link>) {
    if (!link?.id) return
    diagramState.updateLink(link.id, updates)
  }

  // Subgraph update helper
  function updateSubgraph(field: string, value: unknown) {
    if (!subgraph) return
    const s = new Map(diagramState.subgraphs)
    s.set(subgraph.id, { ...subgraph, [field]: value })
    diagramState.subgraphs = s
  }
</script>

<Dialog.Root {open} onOpenChange={(o) => { if (!o) onclose?.() }}>
  <Dialog.Portal>
    <Dialog.Overlay class="fixed inset-0 z-40 bg-black/20 dark:bg-black/40 backdrop-blur-[2px]" />
    <Dialog.Content
      class="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[480px] bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl shadow-2xl focus:outline-none"
    >
      {#if elementType && elementId}
        <!-- Header -->
        <div
          class="flex items-center justify-between px-5 py-4 border-b border-neutral-200 dark:border-neutral-700"
        >
          <div class="flex items-center gap-2.5">
            <span
              class="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-md {kindColor(elementType)}"
            >
              {elementType}
            </span>
            <Dialog.Title
              class="text-sm font-mono text-neutral-600 dark:text-neutral-300 truncate max-w-[300px]"
            >
              {displayLabel}
            </Dialog.Title>
          </div>
          <Dialog.Close
            class="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 dark:hover:text-neutral-200 dark:hover:bg-neutral-700 transition-colors"
          >
            <X class="w-4 h-4" />
          </Dialog.Close>
        </div>

        <Dialog.Description class="sr-only">
          Properties of {elementType} element {elementId}
        </Dialog.Description>

        <!-- Tabs -->
        <Tabs.Root value="content" class="flex flex-col">
          <Tabs.List class="flex border-b border-neutral-200 dark:border-neutral-700 shrink-0">
            <Tabs.Trigger value="content" class={tabTriggerClass}>Content</Tabs.Trigger>
            <Tabs.Trigger value="properties" class={tabTriggerClass}>Properties</Tabs.Trigger>
            <Tabs.Trigger value="json" class={tabTriggerClass}>JSON</Tabs.Trigger>
          </Tabs.List>

          <!-- Content tab -->
          <Tabs.Content value="content">
            <ScrollArea.Root style="height: 50vh;">
              <ScrollArea.Viewport style="height: 100%;">
                <div class="px-5 py-4 text-xs space-y-3">
                  {#if node}
                    <NodeContent
                      {node}
                      poeBudget={diagramState.poeBudgets.find((b) => b.nodeId === node?.id)}
                      palette={diagramState.palette}
                      bomItems={diagramState.bomItems}
                      links={diagramState.links}
                    />
                  {:else if link}
                    <LinkContent {link} />
                  {:else if subgraph}
                    <SubgraphContent
                      {subgraph}
                      nodes={diagramState.nodes}
                      subgraphs={diagramState.subgraphs}
                    />
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
          </Tabs.Content>

          <!-- Properties tab -->
          <Tabs.Content value="properties">
            <ScrollArea.Root style="height: 50vh;">
              <ScrollArea.Viewport style="height: 100%;">
                <div class="px-5 py-4 text-xs space-y-3">
                  {#if node}
                    <NodeProperties
                      {node}
                      {editing}
                      palette={diagramState.palette}
                      subgraphs={diagramState.subgraphs}
                      onupdate={updateNode}
                      onbindpalette={bindPalette}
                    />
                  {:else if link}
                    <LinkProperties
                      {link}
                      {editing}
                      nodes={diagramState.nodes}
                      onupdate={updateLink}
                    />
                  {:else if subgraph}
                    <SubgraphProperties {subgraph} {editing} onupdate={updateSubgraph} />
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
          </Tabs.Content>

          <!-- JSON tab -->
          <Tabs.Content value="json">
            <ScrollArea.Root style="height: 50vh;">
              <ScrollArea.Viewport style="height: 100%;">
                <div class="px-5 py-4">
                  <pre
                    class="text-[11px] font-mono leading-relaxed text-neutral-600 dark:text-neutral-300 whitespace-pre-wrap break-all"
                  >{JSON.stringify(node ?? link ?? subgraph, null, 2)}</pre>
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
          </Tabs.Content>
        </Tabs.Root>
      {/if}
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
