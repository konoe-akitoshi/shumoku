<script lang="ts">
  import type { CatalogEntry, HardwareProperties } from '@shumoku/catalog'
  import { Dialog, Tabs } from 'bits-ui'
  import { ArrowLeft, Plus, Trash, X } from 'phosphor-svelte'
  import { diagramState } from '$lib/context.svelte'
  import type { SpecPaletteEntry } from '$lib/types'

  let addDialogOpen = $state(false)

  // Cascade select state for catalog add
  let selectedKind = $state('hardware')
  let selectedVendor = $state('')
  let selectedSeries = $state('')
  let selectedModelId = $state('')

  // Custom add state
  let customName = $state('')
  let customKind = $state('hardware')
  let customType = $state('')
  let customVendor = $state('')
  let customModel = $state('')

  const catalog = diagramState.catalog

  const vendors = $derived.by(() => {
    const set = new Set<string>()
    for (const e of catalog.listByKind(selectedKind as 'hardware' | 'compute' | 'service')) {
      if (e.spec.vendor) set.add(e.spec.vendor)
    }
    return [...set].sort()
  })

  const vendorEntries = $derived.by(() => {
    if (!selectedVendor) return []
    return catalog.listByVendor(selectedVendor).filter((e) => e.spec.kind === selectedKind)
  })

  const seriesEntries = $derived.by(() => {
    const parentIds = new Set(vendorEntries.filter((e) => e.extends).map((e) => e.extends))
    return vendorEntries.filter((e) => parentIds.has(e.id))
  })

  const hasSeries = $derived(seriesEntries.length > 0)

  const modelEntries = $derived.by(() => {
    if (hasSeries && selectedSeries) {
      return vendorEntries.filter((e) => e.extends === selectedSeries)
    }
    if (!hasSeries) return vendorEntries
    return []
  })

  const selectedEntry = $derived.by<CatalogEntry | null>(() => {
    if (selectedModelId) return catalog.lookup(selectedModelId) ?? null
    return null
  })

  function addFromCatalog() {
    const entry = selectedEntry
    if (!entry) return
    const id = `pal-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    const paletteEntry: SpecPaletteEntry = {
      id,
      name: entry.label,
      source: 'catalog',
      catalogId: entry.id,
      spec: entry.spec,
      properties: entry.properties,
    }
    diagramState.addToPalette(paletteEntry)
    resetCatalogSelect()
    addDialogOpen = false
  }

  function addCustom() {
    if (!customName) return
    const id = `pal-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    // biome-ignore lint/suspicious/noExplicitAny: build spec dynamically
    const spec: any = { kind: customKind }
    if (customType) spec.type = customType
    if (customVendor) spec.vendor = customVendor
    if (customModel) spec.model = customModel
    const paletteEntry: SpecPaletteEntry = {
      id,
      name: customName,
      source: 'custom',
      spec,
    }
    diagramState.addToPalette(paletteEntry)
    customName = ''
    customType = ''
    customVendor = ''
    customModel = ''
    addDialogOpen = false
  }

  function resetCatalogSelect() {
    selectedKind = 'hardware'
    selectedVendor = ''
    selectedSeries = ''
    selectedModelId = ''
  }

  const selectClass =
    'w-full px-2 py-1.5 text-xs bg-neutral-50 dark:bg-neutral-700 border border-neutral-200 dark:border-neutral-600 rounded-lg outline-none focus:ring-1 focus:ring-blue-400 text-neutral-700 dark:text-neutral-200'
  const inputClass =
    'w-full px-2 py-1.5 text-xs bg-neutral-50 dark:bg-neutral-700 border border-neutral-200 dark:border-neutral-600 rounded-lg outline-none focus:ring-1 focus:ring-blue-400 text-neutral-700 dark:text-neutral-200'
  const labelClass =
    'text-[10px] font-medium text-neutral-400 dark:text-neutral-500 uppercase tracking-wider mb-1'
</script>

<div class="flex items-center justify-between mb-4">
  <h1 class="text-lg font-semibold text-neutral-800 dark:text-neutral-100">Spec Palette</h1>
  <button
    type="button"
    class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 rounded-lg transition-colors"
    onclick={() => { addDialogOpen = true }}
  >
    <Plus class="w-3.5 h-3.5" />
    Add Spec
  </button>
</div>

{#if diagramState.palette.length > 0}
  <div class="overflow-x-auto">
    <table class="w-full text-xs">
      <thead>
        <tr
          class="border-b border-neutral-200 dark:border-neutral-700 text-left text-[10px] uppercase tracking-wider text-neutral-400 dark:text-neutral-500"
        >
          <th class="pb-2 pr-4 font-medium">Name</th>
          <th class="pb-2 pr-4 font-medium">Kind</th>
          <th class="pb-2 pr-4 font-medium">Vendor / Model</th>
          <th class="pb-2 pr-4 font-medium">Source</th>
          <th class="pb-2 pr-4 font-medium text-right">Key Specs</th>
          <th class="pb-2 font-medium w-8"></th>
        </tr>
      </thead>
      <tbody>
        {#each diagramState.palette as entry}
          {@const hw = entry.properties && entry.spec.kind === 'hardware' ? entry.properties as HardwareProperties : null}
          <tr
            class="border-b border-neutral-100 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-900/50 transition-colors"
          >
            <td class="py-2 pr-4 font-medium text-neutral-800 dark:text-neutral-100">
              {entry.name}
            </td>
            <td class="py-2 pr-4">
              <span
                class="px-1.5 py-0.5 rounded text-[9px] font-medium bg-neutral-100 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-400"
                >{entry.spec.kind}</span
              >
            </td>
            <td class="py-2 pr-4 font-mono text-neutral-600 dark:text-neutral-300 text-[10px]">
              {entry.spec.vendor ?? '—'}
              / {'model' in entry.spec ? entry.spec.model ?? '—' : '—'}
            </td>
            <td class="py-2 pr-4">
              {#if entry.source === 'catalog'}
                <span class="text-[9px] text-blue-500 dark:text-blue-400">catalog</span>
              {:else}
                <span class="text-[9px] text-neutral-400">custom</span>
              {/if}
            </td>
            <td class="py-2 pr-4 text-right text-[10px] text-neutral-500 dark:text-neutral-400">
              {#if hw}
                {#if hw.power?.poe_out}
                  <span>PoE {hw.power.poe_out.budget_w}W</span>
                {/if}
                {#if hw.switching?.capacity_gbps}
                  <span> · {hw.switching.capacity_gbps}G</span>
                {/if}
                {#if hw.wireless?.standard}
                  <span> · {hw.wireless.standard}</span>
                {/if}
              {/if}
            </td>
            <td class="py-2">
              <button
                type="button"
                class="p-1 rounded text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                onclick={() => diagramState.removeFromPalette(entry.id)}
              >
                <Trash class="w-3 h-3" />
              </button>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{:else}
  <div
    class="flex flex-col items-center justify-center py-16 text-neutral-400 dark:text-neutral-500"
  >
    <p class="text-sm mb-2">No specs in palette yet.</p>
    <p class="text-xs">
      Click "Add Spec" to add products from the catalog or create custom entries.
    </p>
  </div>
{/if}

<!-- Add Spec Dialog -->
<Dialog.Root bind:open={addDialogOpen}>
  <Dialog.Portal>
    <Dialog.Overlay class="fixed inset-0 z-40 bg-black/20 dark:bg-black/40 backdrop-blur-[2px]" />
    <Dialog.Content
      class="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[480px] bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl shadow-2xl focus:outline-none"
    >
      <div
        class="flex items-center justify-between px-5 py-4 border-b border-neutral-200 dark:border-neutral-700"
      >
        <Dialog.Title class="text-sm font-semibold text-neutral-800 dark:text-neutral-100"
          >Add Spec</Dialog.Title
        >
        <Dialog.Close
          class="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 dark:hover:text-neutral-200 dark:hover:bg-neutral-700 transition-colors"
        >
          <X class="w-4 h-4" />
        </Dialog.Close>
      </div>
      <Dialog.Description class="sr-only">Add a spec to the palette</Dialog.Description>

      <Tabs.Root value="catalog">
        <Tabs.Content value="catalog">
          <div class="px-5 py-4 space-y-3 max-h-[50vh] overflow-auto">
            <div>
              <div class={labelClass}>Kind</div>
              <select
                class={selectClass}
                bind:value={selectedKind}
                onchange={() => { selectedVendor = ''; selectedSeries = ''; selectedModelId = '' }}
              >
                <option value="hardware">hardware</option>
                <option value="compute">compute</option>
                <option value="service">service</option>
              </select>
            </div>
            <div>
              <div class={labelClass}>Vendor</div>
              <select
                class={selectClass}
                bind:value={selectedVendor}
                onchange={() => { selectedSeries = ''; selectedModelId = '' }}
              >
                <option value="">-- select --</option>
                {#each vendors as v}
                  <option value={v}>{v}</option>
                {/each}
              </select>
            </div>
            {#if selectedVendor && hasSeries}
              <div>
                <div class={labelClass}>Series</div>
                <select
                  class={selectClass}
                  bind:value={selectedSeries}
                  onchange={() => { selectedModelId = '' }}
                >
                  <option value="">-- select --</option>
                  {#each seriesEntries as s}
                    <option value={s.id}>{s.label}</option>
                  {/each}
                </select>
              </div>
            {/if}
            {#if selectedVendor && modelEntries.length > 0}
              <div>
                <div class={labelClass}>Model</div>
                <select class={selectClass} bind:value={selectedModelId}>
                  <option value="">-- select --</option>
                  {#each modelEntries as m}
                    <option value={m.id}>{m.label}</option>
                  {/each}
                </select>
              </div>
            {/if}
            {#if selectedEntry}
              <div
                class="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-xs text-blue-600 dark:text-blue-400"
              >
                {selectedEntry.label}
                {#if selectedEntry.spec.kind === 'hardware'}
                  {@const hw = selectedEntry.properties as HardwareProperties}
                  {#if hw.power?.poe_out || hw.switching?.capacity_gbps}
                    <span class="text-[9px] ml-2 text-blue-400 dark:text-blue-500">
                      {#if hw.power?.poe_out}
                        PoE {hw.power.poe_out.budget_w}W
                      {/if}
                      {#if hw.switching?.capacity_gbps}
                        · {hw.switching.capacity_gbps}G
                      {/if}
                    </span>
                  {/if}
                {/if}
              </div>
            {/if}
            <button
              type="button"
              class="w-full py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 rounded-lg transition-colors disabled:opacity-50"
              disabled={!selectedEntry}
              onclick={addFromCatalog}
            >
              Add to Palette
            </button>
          </div>
        </Tabs.Content>

        <Tabs.Content value="custom">
          <div class="px-5 py-4 space-y-3">
            <div>
              <div class={labelClass}>Name</div>
              <input
                type="text"
                class={inputClass}
                bind:value={customName}
                placeholder="My Custom Device"
              >
            </div>
            <div>
              <div class={labelClass}>Kind</div>
              <select class={selectClass} bind:value={customKind}>
                <option value="hardware">hardware</option>
                <option value="compute">compute</option>
                <option value="service">service</option>
              </select>
            </div>
            <div>
              <div class={labelClass}>Type</div>
              <input
                type="text"
                class={inputClass}
                bind:value={customType}
                placeholder="switch, router..."
              >
            </div>
            <div>
              <div class={labelClass}>Vendor</div>
              <input
                type="text"
                class={inputClass}
                bind:value={customVendor}
                placeholder="cisco, hpe..."
              >
            </div>
            <div>
              <div class={labelClass}>Model</div>
              <input
                type="text"
                class={inputClass}
                bind:value={customModel}
                placeholder="ws-c3560cx-8pc-s..."
              >
            </div>
            <button
              type="button"
              class="w-full py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 rounded-lg transition-colors disabled:opacity-50"
              disabled={!customName}
              onclick={addCustom}
            >
              Add to Palette
            </button>
          </div>
        </Tabs.Content>

        <Tabs.List class="flex border-t border-neutral-200 dark:border-neutral-700">
          <Tabs.Trigger
            value="catalog"
            class="px-3 py-2 text-xs font-medium border-t-2 -mt-px transition-colors data-[state=active]:border-blue-500 data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400 border-transparent text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
          >
            Catalog
          </Tabs.Trigger>
          <Tabs.Trigger
            value="custom"
            class="px-3 py-2 text-xs font-medium border-t-2 -mt-px transition-colors data-[state=active]:border-blue-500 data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400 border-transparent text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
          >
            Custom
          </Tabs.Trigger>
        </Tabs.List>
      </Tabs.Root>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
