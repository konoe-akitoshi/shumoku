<script lang="ts">
  import type { CatalogEntry, HardwareProperties } from '@shumoku/catalog'
  import { Dialog, Tabs } from 'bits-ui'
  import { Plus, Trash, X } from 'phosphor-svelte'
  import { Badge } from '$lib/components/ui/badge'
  import { Button } from '$lib/components/ui/button'
  import * as Card from '$lib/components/ui/card'
  import * as Table from '$lib/components/ui/table'
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
    if (hasSeries && selectedSeries)
      return vendorEntries.filter((e) => e.extends === selectedSeries)
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
    const paletteEntry: SpecPaletteEntry = { id, name: customName, source: 'custom', spec }
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

<div class="flex items-center justify-between mb-6">
  <div>
    <h1 class="text-lg font-semibold">Spec Palette</h1>
    <p class="text-sm text-muted-foreground">{diagramState.palette.length} specs registered</p>
  </div>
  <Button size="sm" onclick={() => { addDialogOpen = true }}>
    <Plus class="w-4 h-4 mr-1" />
    Add Spec
  </Button>
</div>

{#if diagramState.palette.length > 0}
  <Card.Root class="py-0">
    <Table.Root>
      <Table.Header>
        <Table.Row>
          <Table.Head>Name</Table.Head>
          <Table.Head>Kind</Table.Head>
          <Table.Head>Vendor / Model</Table.Head>
          <Table.Head>Source</Table.Head>
          <Table.Head class="text-right">Key Specs</Table.Head>
          <Table.Head class="w-10"></Table.Head>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {#each diagramState.palette as entry}
          {@const hw = entry.properties && entry.spec.kind === 'hardware' ? entry.properties as HardwareProperties : null}
          <Table.Row>
            <Table.Cell class="font-medium">{entry.name}</Table.Cell>
            <Table.Cell> <Badge variant="secondary">{entry.spec.kind}</Badge> </Table.Cell>
            <Table.Cell class="font-mono text-xs text-muted-foreground">
              {entry.spec.vendor ?? '—'}
              / {'model' in entry.spec ? entry.spec.model ?? '—' : '—'}
            </Table.Cell>
            <Table.Cell>
              {#if entry.source === 'catalog'}
                <Badge variant="default">catalog</Badge>
              {:else}
                <Badge variant="outline">custom</Badge>
              {/if}
            </Table.Cell>
            <Table.Cell class="text-right text-xs text-muted-foreground">
              {#if hw}
                {#if hw.power?.poe_out}
                  PoE {hw.power.poe_out.budget_w}W
                {/if}
                {#if hw.switching?.capacity_gbps}
                  · {hw.switching.capacity_gbps}G
                {/if}
                {#if hw.wireless?.standard}
                  · {hw.wireless.standard}
                {/if}
              {/if}
            </Table.Cell>
            <Table.Cell>
              <Button
                variant="ghost"
                size="icon"
                onclick={() => diagramState.removeFromPalette(entry.id)}
              >
                <Trash class="w-3.5 h-3.5 text-destructive" />
              </Button>
            </Table.Cell>
          </Table.Row>
        {/each}
      </Table.Body>
    </Table.Root>
  </Card.Root>
{:else}
  <Card.Root class="py-16">
    <Card.Content class="flex flex-col items-center text-center text-muted-foreground">
      <p class="text-sm mb-1">No specs in palette yet.</p>
      <p class="text-xs">
        Click "Add Spec" to add products from the catalog or create custom entries.
      </p>
    </Card.Content>
  </Card.Root>
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
        <Dialog.Title class="text-sm font-semibold">Add Spec</Dialog.Title>
        <Dialog.Close
          class="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
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
              <Card.Root class="bg-primary/5 border-primary/20">
                <Card.Content class="py-2 px-3 text-xs text-primary">
                  {selectedEntry.label}
                  {#if selectedEntry.spec.kind === 'hardware'}
                    {@const hw = selectedEntry.properties as HardwareProperties}
                    {#if hw.power?.poe_out || hw.switching?.capacity_gbps}
                      <span class="ml-2 opacity-60">
                        {#if hw.power?.poe_out}
                          PoE {hw.power.poe_out.budget_w}W
                        {/if}
                        {#if hw.switching?.capacity_gbps}
                          · {hw.switching.capacity_gbps}G
                        {/if}
                      </span>
                    {/if}
                  {/if}
                </Card.Content>
              </Card.Root>
            {/if}
            <Button class="w-full" disabled={!selectedEntry} onclick={addFromCatalog}>
              Add to Palette
            </Button>
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
            <Button class="w-full" disabled={!customName} onclick={addCustom}>
              Add to Palette
            </Button>
          </div>
        </Tabs.Content>

        <Tabs.List class="flex border-t border-neutral-200 dark:border-neutral-700">
          <Tabs.Trigger
            value="catalog"
            class="px-3 py-2 text-xs font-medium border-t-2 -mt-px transition-colors data-[state=active]:border-primary data-[state=active]:text-primary border-transparent text-muted-foreground hover:text-foreground"
          >
            Catalog
          </Tabs.Trigger>
          <Tabs.Trigger
            value="custom"
            class="px-3 py-2 text-xs font-medium border-t-2 -mt-px transition-colors data-[state=active]:border-primary data-[state=active]:text-primary border-transparent text-muted-foreground hover:text-foreground"
          >
            Custom
          </Tabs.Trigger>
        </Tabs.List>
      </Tabs.Root>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
