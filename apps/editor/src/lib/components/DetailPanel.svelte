<script lang="ts">
  import { getDeviceIcon } from '@shumoku/core'
  import { Dialog, ScrollArea, Tabs } from 'bits-ui'
  import { X } from 'phosphor-svelte'
  import type { PoEBudget } from '$lib/poe-analysis'

  let {
    open = false,
    data,
    mode = 'view',
    poeBudget,
    onclose,
    onupdate,
  }: {
    open?: boolean
    // biome-ignore lint/suspicious/noExplicitAny: mixed element data
    data: Record<string, any> | null
    mode?: 'edit' | 'view'
    poeBudget?: PoEBudget
    onclose?: () => void
    onupdate?: (id: string, field: string, value: string) => void
  } = $props()

  const kind = $derived((data?.kind as string) ?? 'unknown')
  const editing = $derived(mode === 'edit')

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

  const iconPath = $derived(data?.spec?.type ? getDeviceIcon(data.spec.type) : undefined)

  function getDisplayFields(
    // biome-ignore lint/suspicious/noExplicitAny: mixed element data
    d: Record<string, any>,
  ): { key: string; label: string; value: string; editable: boolean }[] {
    const fields: { key: string; label: string; value: string; editable: boolean }[] = []
    const k = d.kind as string
    const dev = d.spec ?? {}

    if (k === 'node') {
      // All Node fields
      const raw = d.label
        ? Array.isArray(d.label)
          ? d.label.map(stripHtml).join('\n')
          : stripHtml(String(d.label))
        : ''
      fields.push({ key: 'label', label: 'Label', value: raw, editable: true })
      fields.push({ key: 'shape', label: 'Shape', value: d.shape ?? '', editable: true })
      fields.push({ key: 'spec.type', label: 'Type', value: dev.type ?? '', editable: true })
      fields.push({
        key: 'spec.vendor',
        label: 'Vendor',
        value: dev.vendor ?? '',
        editable: true,
      })
      fields.push({ key: 'spec.model', label: 'Model', value: dev.model ?? '', editable: true })
      fields.push({
        key: 'spec.service',
        label: 'Service',
        value: dev.service ?? '',
        editable: true,
      })
      fields.push({
        key: 'spec.resource',
        label: 'Resource',
        value: dev.resource ?? '',
        editable: true,
      })
      fields.push({ key: 'spec.icon', label: 'Icon URL', value: dev.icon ?? '', editable: true })
      fields.push({ key: 'parent', label: 'Parent', value: d.parent ?? '', editable: false })
      fields.push({
        key: 'rank',
        label: 'Rank',
        value: d.rank != null ? String(d.rank) : '',
        editable: true,
      })
      if (d.position)
        fields.push({
          key: 'position',
          label: 'Position',
          value: `${d.position.x.toFixed(1)}, ${d.position.y.toFixed(1)}`,
          editable: false,
        })
      if (d.size)
        fields.push({
          key: 'size',
          label: 'Size',
          value: `${d.size.width} × ${d.size.height}`,
          editable: false,
        })
    } else if (k === 'subgraph') {
      // All Subgraph fields
      fields.push({ key: 'label', label: 'Label', value: d.label ?? '', editable: true })
      fields.push({
        key: 'spec.vendor',
        label: 'Vendor',
        value: dev.vendor ?? '',
        editable: true,
      })
      fields.push({
        key: 'spec.service',
        label: 'Service',
        value: dev.service ?? '',
        editable: true,
      })
      fields.push({
        key: 'spec.resource',
        label: 'Resource',
        value: dev.resource ?? '',
        editable: true,
      })
      fields.push({ key: 'spec.icon', label: 'Icon URL', value: dev.icon ?? '', editable: true })
      fields.push({
        key: 'direction',
        label: 'Direction',
        value: d.direction ?? '',
        editable: true,
      })
      fields.push({ key: 'parent', label: 'Parent', value: d.parent ?? '', editable: false })
      if (d.bounds)
        fields.push({
          key: 'bounds',
          label: 'Bounds',
          value: `${d.bounds.width.toFixed(0)} × ${d.bounds.height.toFixed(0)} at (${d.bounds.x.toFixed(0)}, ${d.bounds.y.toFixed(0)})`,
          editable: false,
        })
      if (d.children)
        fields.push({
          key: 'children',
          label: 'Children',
          value: `${d.children.nodes} nodes, ${d.children.subgraphs} groups`,
          editable: false,
        })
    } else if (k === 'edge') {
      if (d.from)
        fields.push({
          key: 'from',
          label: 'From',
          value: `${d.from.node}:${d.from.port}`,
          editable: false,
        })
      if (d.to)
        fields.push({ key: 'to', label: 'To', value: `${d.to.node}:${d.to.port}`, editable: false })
      if (d.width)
        fields.push({ key: 'width', label: 'Width', value: String(d.width), editable: false })
      if (d.points)
        fields.push({
          key: 'points',
          label: 'Points',
          value: `${d.points} waypoints`,
          editable: false,
        })
    } else if (k === 'port') {
      fields.push({ key: 'label', label: 'Label', value: d.label ?? '', editable: true })
      if (d.nodeId) fields.push({ key: 'nodeId', label: 'Node', value: d.nodeId, editable: false })
      if (d.side) fields.push({ key: 'side', label: 'Side', value: d.side, editable: false })
      if (d.position)
        fields.push({
          key: 'position',
          label: 'Position',
          value: `${d.position.x.toFixed(1)}, ${d.position.y.toFixed(1)}`,
          editable: false,
        })
    }

    return fields
  }

  const displayFields = $derived(data ? getDisplayFields(data) : [])
  const ports = $derived(data?.ports ?? [])

  function handleFieldChange(key: string, value: string) {
    if (!data?.id) return
    onupdate?.(data.id, key, value)
  }

  const inputClass =
    'w-full px-1.5 py-0.5 text-[12px] font-mono bg-neutral-50 dark:bg-neutral-700 border border-neutral-200 dark:border-neutral-600 rounded outline-none focus:ring-1 focus:ring-blue-400 text-neutral-700 dark:text-neutral-200'
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
                  {#each displayFields as field}
                    <div class="flex gap-3 items-start">
                      <span
                        class="shrink-0 w-16 text-right text-neutral-400 dark:text-neutral-500 font-medium pt-1"
                      >
                        {field.label}
                      </span>
                      {#if editing && field.editable}
                        <input
                          type="text"
                          class={inputClass}
                          value={field.value}
                          onblur={(e) => handleFieldChange(field.key, (e.target as HTMLInputElement).value)}
                          onkeydown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                        >
                      {:else}
                        <span
                          class="text-neutral-700 dark:text-neutral-200 font-mono break-all leading-relaxed pt-0.5"
                        >
                          {#if typeof field.value === 'string' && field.value.includes('\n')}
                            {#each field.value.split('\n') as line}
                              <div>{line}</div>
                            {/each}
                          {:else}
                            {field.value}
                          {/if}
                        </span>
                      {/if}
                    </div>
                  {/each}
                  {#if ports.length > 0}
                    <div class="flex gap-3 items-start">
                      <span
                        class="shrink-0 w-16 text-right text-neutral-400 dark:text-neutral-500 font-medium pt-0.5"
                        >Ports</span
                      >
                      <div class="space-y-1.5">
                        {#each ports as port}
                          <div
                            class="flex items-center gap-2 pl-2 border-l-2 border-blue-200 dark:border-blue-800 text-[11px]"
                          >
                            <span class="text-blue-500 font-semibold">{port.label}</span>
                            <span class="text-neutral-400">{port.side}</span>
                          </div>
                        {/each}
                      </div>
                    </div>
                  {/if}
                  {#if poeBudget}
                    <div
                      class="mt-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40"
                    >
                      <div class="flex items-center justify-between mb-2">
                        <span
                          class="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400"
                          >PoE Budget</span
                        >
                        <span class="text-[11px] font-mono text-amber-600 dark:text-amber-300"
                          >{poeBudget.used_w}W / {poeBudget.budget_w}W</span
                        >
                      </div>
                      <div
                        class="w-full h-2 rounded-full bg-amber-200 dark:bg-amber-900/40 overflow-hidden mb-2"
                      >
                        <div
                          class="h-full rounded-full transition-all {poeBudget.utilization_pct > 80 ? 'bg-red-500' : poeBudget.utilization_pct > 50 ? 'bg-amber-500' : 'bg-green-500'}"
                          style="width: {Math.min(100, poeBudget.utilization_pct)}%"
                        ></div>
                      </div>
                      <div class="text-[10px] text-amber-600 dark:text-amber-400 mb-2">
                        {poeBudget.remaining_w}W remaining ({poeBudget.utilization_pct}%)
                      </div>
                      <div class="space-y-1">
                        {#each poeBudget.links as link}
                          <div class="flex justify-between text-[10px]">
                            <span class="text-neutral-600 dark:text-neutral-300"
                              >{link.toNodeLabel}</span
                            >
                            <span class="font-mono text-amber-700 dark:text-amber-300"
                              >{link.draw_w}W</span
                            >
                          </div>
                        {/each}
                      </div>
                    </div>
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
