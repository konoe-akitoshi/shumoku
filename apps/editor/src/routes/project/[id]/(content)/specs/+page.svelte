<script lang="ts">
  import type { CatalogEntry, HardwareProperties } from '@shumoku/catalog'
  import { Dialog, DropdownMenu } from 'bits-ui'
  import { nanoid } from 'nanoid'
  import { CaretDown, Plus, Trash, X } from 'phosphor-svelte'
  import { goto } from '$app/navigation'
  import { page } from '$app/stores'
  import { Badge } from '$lib/components/ui/badge'
  import { Button } from '$lib/components/ui/button'
  import * as Card from '$lib/components/ui/card'
  import * as Table from '$lib/components/ui/table'
  import { diagramState } from '$lib/context.svelte'
  import type { SpecPaletteEntry } from '$lib/types'
  import { specIdentifier } from '$lib/types'

  let catalogDialogOpen = $state(false)
  let customDialogOpen = $state(false)

  // Cascade select for catalog
  let selectedKind = $state('hardware')
  let selectedVendor = $state('')
  let selectedSeries = $state('')
  let selectedModelId = $state('')

  // Custom fields
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
    const id = nanoid()
    const paletteEntry: SpecPaletteEntry = {
      id,
      source: 'catalog',
      catalogId: entry.id,
      spec: entry.spec,
      properties: entry.properties,
    }
    diagramState.addToPalette(paletteEntry)
    resetCatalogSelect()
    catalogDialogOpen = false
  }

  function addCustom() {
    if (!customVendor && !customModel) return
    const id = nanoid()
    // biome-ignore lint/suspicious/noExplicitAny: build spec dynamically
    const spec: any = { kind: customKind }
    if (customType) spec.type = customType
    if (customVendor) spec.vendor = customVendor
    if (customModel) spec.model = customModel
    const paletteEntry: SpecPaletteEntry = { id, source: 'custom', spec }
    diagramState.addToPalette(paletteEntry)
    customKind = 'hardware'
    customType = ''
    customVendor = ''
    customModel = ''
    customDialogOpen = false
  }

  function resetCatalogSelect() {
    selectedKind = 'hardware'
    selectedVendor = ''
    selectedSeries = ''
    selectedModelId = ''
  }

  const selectClass =
    'w-full px-2 py-1.5 text-xs bg-background border border-input rounded-lg outline-none focus:ring-1 focus:ring-ring text-foreground'
  const inputClass =
    'w-full px-2 py-1.5 text-xs bg-background border border-input rounded-lg outline-none focus:ring-1 focus:ring-ring text-foreground'
  const labelClass = 'text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1'
</script>

<div class="flex items-center justify-between mb-6">
  <div>
    <h1 class="text-lg font-semibold">Spec Palette</h1>
    <p class="text-sm text-muted-foreground">{diagramState.palette.length} specs registered</p>
  </div>
  <DropdownMenu.Root>
    <DropdownMenu.Trigger>
      {#snippet child({ props })}
        <Button size="sm" {...props}>
          <Plus class="w-4 h-4 mr-1" />
          Add
          <CaretDown class="w-3 h-3 ml-1" />
        </Button>
      {/snippet}
    </DropdownMenu.Trigger>
    <DropdownMenu.Content class="z-50 min-w-36 rounded-lg border bg-popover p-1 shadow-md">
      <DropdownMenu.Item
        class="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs cursor-pointer hover:bg-accent"
        onclick={() => { catalogDialogOpen = true }}
      >
        From Catalog
      </DropdownMenu.Item>
      <DropdownMenu.Item
        class="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs cursor-pointer hover:bg-accent"
        onclick={() => { customDialogOpen = true }}
      >
        Custom
      </DropdownMenu.Item>
    </DropdownMenu.Content>
  </DropdownMenu.Root>
</div>

{#if diagramState.palette.length > 0}
  <Card.Root class="py-0">
    <Table.Root>
      <Table.Header>
        <Table.Row>
          <Table.Head>Kind</Table.Head>
          <Table.Head>Vendor</Table.Head>
          <Table.Head>Identifier</Table.Head>
          <Table.Head>Source</Table.Head>
          <Table.Head class="w-10"></Table.Head>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {#each diagramState.palette as entry}
          <Table.Row
            class="cursor-pointer"
            onclick={() => goto(`/project/${$page.params.id}/specs/${entry.id}`)}
          >
            <Table.Cell> <Badge variant="secondary">{entry.spec.kind}</Badge> </Table.Cell>
            <Table.Cell class="font-mono text-xs">{entry.spec.vendor ?? '—'}</Table.Cell>
            <Table.Cell class="font-mono text-xs">{specIdentifier(entry.spec)}</Table.Cell>
            <Table.Cell>
              {#if entry.source === 'catalog'}
                <Badge variant="default">catalog</Badge>
              {:else if entry.source === 'modified'}
                <Badge variant="secondary">modified</Badge>
              {:else}
                <Badge variant="outline">custom</Badge>
              {/if}
            </Table.Cell>
            <Table.Cell>
              <Button
                variant="ghost"
                size="icon"
                onclick={(e) => { e.stopPropagation(); diagramState.removeFromPalette(entry.id) }}
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
      <p class="text-xs">Click "Add" to add products from the catalog or create custom entries.</p>
    </Card.Content>
  </Card.Root>
{/if}

<!-- From Catalog Dialog -->
<Dialog.Root bind:open={catalogDialogOpen}>
  <Dialog.Portal>
    <Dialog.Overlay class="fixed inset-0 z-40 bg-black/20 dark:bg-black/40 backdrop-blur-[2px]" />
    <Dialog.Content
      class="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[480px] bg-popover border rounded-xl shadow-2xl focus:outline-none"
    >
      <div class="flex items-center justify-between px-5 py-4 border-b">
        <Dialog.Title class="text-sm font-semibold">Add from Catalog</Dialog.Title>
        <Dialog.Close
          class="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <X class="w-4 h-4" />
        </Dialog.Close>
      </div>
      <Dialog.Description class="sr-only">Select a product from the catalog</Dialog.Description>
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
              — {selectedEntry.id}
            </Card.Content>
          </Card.Root>
        {/if}
        <Button class="w-full" disabled={!selectedEntry} onclick={addFromCatalog}
          >Add to Palette</Button
        >
      </div>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>

<!-- Custom Dialog -->
<Dialog.Root bind:open={customDialogOpen}>
  <Dialog.Portal>
    <Dialog.Overlay class="fixed inset-0 z-40 bg-black/20 dark:bg-black/40 backdrop-blur-[2px]" />
    <Dialog.Content
      class="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[480px] bg-popover border rounded-xl shadow-2xl focus:outline-none"
    >
      <div class="flex items-center justify-between px-5 py-4 border-b">
        <Dialog.Title class="text-sm font-semibold">Add Custom Spec</Dialog.Title>
        <Dialog.Close
          class="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <X class="w-4 h-4" />
        </Dialog.Close>
      </div>
      <Dialog.Description class="sr-only">Create a custom spec entry</Dialog.Description>
      <div class="px-5 py-4 space-y-3">
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
            placeholder="switch, router, access-point..."
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
        <Button class="w-full" disabled={!customVendor && !customModel} onclick={addCustom}
          >Add to Palette</Button
        >
      </div>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
