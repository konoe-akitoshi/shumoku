<script lang="ts">
  import { getDeviceIcon } from '@shumoku/core'
  import { Dialog, ScrollArea, Tabs } from 'bits-ui'
  import { X } from 'phosphor-svelte'

  let {
    open = false,
    data,
    onclose,
  }: {
    open?: boolean
    // biome-ignore lint/suspicious/noExplicitAny: mixed element data
    data: Record<string, any> | null
    onclose?: () => void
  } = $props()

  const kind = $derived((data?.kind as string) ?? 'unknown')

  function kindColor(k: string) {
    if (k === 'node') return 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
    if (k === 'subgraph')
      return 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
    if (k === 'edge') return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
    return 'bg-neutral-100 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300'
  }

  function stripHtml(s: string): string {
    return s.replace(/<[^>]*>/g, '')
  }

  const iconPath = $derived(data?.type ? getDeviceIcon(data.type) : undefined)

  // biome-ignore lint/suspicious/noExplicitAny: recursive rendering
  function isObject(v: any): v is Record<string, unknown> {
    return v !== null && typeof v === 'object' && !Array.isArray(v)
  }

  const overviewFields = $derived.by(() => {
    if (!data) return []
    // biome-ignore lint/suspicious/noExplicitAny: mixed data
    const fields: { label: string; value: any }[] = []
    const d = data

    // Common
    if (d.label) {
      const raw = Array.isArray(d.label)
        ? d.label.map(stripHtml).join('\n')
        : stripHtml(String(d.label))
      fields.push({ label: 'Label', value: raw })
    }
    if (d.type) fields.push({ label: 'Type', value: d.type })
    if (d.vendor) fields.push({ label: 'Vendor', value: d.vendor })
    if (d.model) fields.push({ label: 'Model', value: d.model })
    if (d.shape) fields.push({ label: 'Shape', value: d.shape })
    if (d.parent) fields.push({ label: 'Parent', value: d.parent })

    // Position/bounds
    if (d.position)
      fields.push({
        label: 'Position',
        value: `${d.position.x.toFixed(1)}, ${d.position.y.toFixed(1)}`,
      })
    if (d.size) fields.push({ label: 'Size', value: `${d.size.width} × ${d.size.height}` })
    if (d.bounds)
      fields.push({
        label: 'Bounds',
        value: `${d.bounds.width.toFixed(0)} × ${d.bounds.height.toFixed(0)} at (${d.bounds.x.toFixed(0)}, ${d.bounds.y.toFixed(0)})`,
      })

    // Edge
    if (d.from) fields.push({ label: 'From', value: `${d.from.node}:${d.from.port}` })
    if (d.to) fields.push({ label: 'To', value: `${d.to.node}:${d.to.port}` })
    if (d.width) fields.push({ label: 'Width', value: d.width })
    if (d.points) fields.push({ label: 'Points', value: `${d.points} waypoints` })

    // Port
    if (d.nodeId) fields.push({ label: 'Node', value: d.nodeId })
    if (d.side) fields.push({ label: 'Side', value: d.side })

    // Children
    if (d.children)
      fields.push({
        label: 'Children',
        value: `${d.children.nodes} nodes, ${d.children.subgraphs} groups`,
      })

    // Ports list
    if (d.ports?.length) fields.push({ label: 'Ports', value: d.ports })

    return fields
  })
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

        <!-- Tabs -->
        <Tabs.Root value="overview">
          <!-- Overview tab -->
          <Tabs.Content value="overview">
            <ScrollArea.Root style="height: 45vh;">
              <ScrollArea.Viewport style="height: 100%;">
                <div class="px-5 py-4 space-y-3 text-xs">
                  {#if iconPath}
                    <div class="flex justify-center py-2">
                      <svg
                        width="40"
                        height="40"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        role="img"
                        aria-label={data?.type ?? 'icon'}
                        class="text-neutral-500 dark:text-neutral-400"
                      >
                        {@html iconPath}
                      </svg>
                    </div>
                  {/if}
                  {#each overviewFields as field}
                    <div class="flex gap-3">
                      <span
                        class="shrink-0 w-16 text-right text-neutral-400 dark:text-neutral-500 font-medium pt-0.5"
                      >
                        {field.label}
                      </span>
                      <span
                        class="text-neutral-700 dark:text-neutral-200 font-mono break-all leading-relaxed"
                      >
                        {#if Array.isArray(field.value)}
                          <!-- Ports list -->
                          <div class="space-y-1.5">
                            {#each field.value as port}
                              <div
                                class="flex items-center gap-2 pl-2 border-l-2 border-blue-200 dark:border-blue-800 text-[11px]"
                              >
                                <span class="text-blue-500 font-semibold">{port.label}</span>
                                <span class="text-neutral-400">{port.side}</span>
                              </div>
                            {/each}
                          </div>
                        {:else if typeof field.value === 'string' && field.value.includes('\n')}
                          {#each field.value.split('\n') as line}
                            <div>{line}</div>
                          {/each}
                        {:else}
                          {field.value}
                        {/if}
                      </span>
                    </div>
                  {/each}
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

          <!-- Raw tab -->
          <Tabs.Content value="raw">
            <ScrollArea.Root style="height: 45vh;">
              <ScrollArea.Viewport style="height: 100%;">
                <div class="px-5 py-4">
                  <pre
                    class="text-[11px] font-mono text-neutral-600 dark:text-neutral-300 whitespace-pre-wrap break-all leading-relaxed"
                  >{JSON.stringify(data, null, 2)}</pre>
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
          <Tabs.List class="flex border-t border-neutral-200 dark:border-neutral-700">
            <Tabs.Trigger
              value="overview"
              class="px-3 py-2 text-xs font-medium border-t-2 -mt-px transition-colors data-[state=active]:border-blue-500 data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400 border-transparent text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
            >
              Overview
            </Tabs.Trigger>
            <Tabs.Trigger
              value="raw"
              class="px-3 py-2 text-xs font-medium border-t-2 -mt-px transition-colors data-[state=active]:border-blue-500 data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400 border-transparent text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
            >
              Raw
            </Tabs.Trigger>
          </Tabs.List>
        </Tabs.Root>
      {/if}
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
