<script lang="ts">
  import type { CatalogEntry } from '@shumoku/catalog'
  import { newId } from '@shumoku/core'
  import { Dialog, DropdownMenu, Tabs } from 'bits-ui'
  import { CaretDown, GitBranch, Plus, Trash, X } from 'phosphor-svelte'
  import { goto } from '$app/navigation'
  import { page } from '$app/stores'
  import { Badge } from '$lib/components/ui/badge'
  import { Button } from '$lib/components/ui/button'
  import * as Card from '$lib/components/ui/card'
  import * as Table from '$lib/components/ui/table'
  import { diagramState } from '$lib/context.svelte'
  import { type Product, paletteEntryLabel, specIdentifier } from '$lib/types'

  let tab = $state('library')
  let catalogDialogOpen = $state(false)
  let customDialogOpen = $state(false)

  let selectedKind = $state('hardware')
  let selectedVendor = $state('')
  let selectedSeries = $state('')
  let selectedModelId = $state('')

  let customKind = $state('hardware')
  let customType = $state('')
  let customVendor = $state('')
  let customModel = $state('')

  const catalog = diagramState.catalog

  const products = $derived(diagramState.products)
  const assignmentRows = $derived(diagramState.assignmentRows)
  const deviceProducts = $derived(
    products.filter(
      (p) => p.spec.kind === 'hardware' || p.spec.kind === 'compute' || p.spec.kind === 'service',
    ),
  )

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

  const usageRows = $derived.by(() => {
    const rows = []
    for (const product of products) {
      const usage = assignmentRows.filter((row) => row.productId === product.id)
      rows.push({ product, usage })
    }
    return rows
  })

  function addFromCatalog() {
    const entry = selectedEntry
    if (!entry) return
    diagramState.addProduct({
      id: newId('pal'),
      source: 'catalog',
      catalogId: entry.id,
      spec: entry.spec,
      properties: entry.properties,
    })
    resetCatalogSelect()
    catalogDialogOpen = false
  }

  function addCustom() {
    if (!customVendor && !customModel) return
    // biome-ignore lint/suspicious/noExplicitAny: build spec dynamically
    const spec: any = { kind: customKind }
    if (customType) spec.type = customType
    if (customVendor) spec.vendor = customVendor
    if (customModel) spec.model = customModel
    diagramState.addProduct({ id: newId('pal'), source: 'custom', spec })
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

  function targetPath(row: { target: { kind: string; nodeId?: string; linkId?: string } }) {
    if (row.target.kind === 'node') return `/project/${$page.params.id}/diagram`
    return `/project/${$page.params.id}/connections`
  }

  function compatibleProducts(row: { target: { kind: string } }): Product[] {
    if (row.target.kind === 'node') return deviceProducts
    return products
  }

  const selectClass =
    'w-full px-2 py-1.5 text-xs bg-background border border-input rounded-lg outline-none focus:ring-1 focus:ring-ring text-foreground'
  const inputClass =
    'w-full px-2 py-1.5 text-xs bg-background border border-input rounded-lg outline-none focus:ring-1 focus:ring-ring text-foreground'
  const labelClass = 'text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1'
</script>

<div class="mb-6 flex items-center justify-between">
  <div>
    <h1 class="text-lg font-semibold">Materials</h1>
    <p class="text-sm text-muted-foreground">
      Product library, design assignments, and usage across this project
    </p>
  </div>
  <DropdownMenu.Root>
    <DropdownMenu.Trigger>
      {#snippet child({ props })}
        <Button size="sm" {...props}>
          <Plus class="mr-1 h-4 w-4" />
          Add Product
          <CaretDown class="ml-1 h-3 w-3" />
        </Button>
      {/snippet}
    </DropdownMenu.Trigger>
    <DropdownMenu.Content class="z-50 min-w-44 rounded-lg border bg-popover p-1 shadow-md">
      <DropdownMenu.Item
        class="cursor-pointer rounded-md px-2 py-1.5 text-xs hover:bg-accent"
        onclick={() => { catalogDialogOpen = true }}
      >
        From external catalog
      </DropdownMenu.Item>
      <DropdownMenu.Item
        class="cursor-pointer rounded-md px-2 py-1.5 text-xs hover:bg-accent"
        onclick={() => { customDialogOpen = true }}
      >
        Custom product
      </DropdownMenu.Item>
    </DropdownMenu.Content>
  </DropdownMenu.Root>
</div>

<Tabs.Root bind:value={tab} class="space-y-4">
  <Tabs.List class="inline-flex rounded-lg border bg-muted/30 p-1">
    <Tabs.Trigger
      value="library"
      class="rounded-md px-3 py-1.5 text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm"
    >
      Library
    </Tabs.Trigger>
    <Tabs.Trigger
      value="assignments"
      class="rounded-md px-3 py-1.5 text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm"
    >
      Assignments
    </Tabs.Trigger>
    <Tabs.Trigger
      value="usage"
      class="rounded-md px-3 py-1.5 text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm"
    >
      Usage
    </Tabs.Trigger>
  </Tabs.List>

  <Tabs.Content value="library">
    {#if products.length > 0}
      <Card.Root class="py-0">
        <Table.Root>
          <Table.Header>
            <Table.Row>
              <Table.Head>Kind</Table.Head>
              <Table.Head>Vendor</Table.Head>
              <Table.Head>Identifier</Table.Head>
              <Table.Head>Source</Table.Head>
              <Table.Head class="text-right">Used</Table.Head>
              <Table.Head class="w-10"></Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {#each products as product}
              {@const usageCount = assignmentRows.filter((row) => row.productId === product.id).length}
              <Table.Row>
                <Table.Cell><Badge variant="secondary">{product.spec.kind}</Badge></Table.Cell>
                <Table.Cell class="font-mono text-xs">{product.spec.vendor ?? '—'}</Table.Cell>
                <Table.Cell class="font-mono text-xs">{specIdentifier(product.spec)}</Table.Cell>
                <Table.Cell>
                  {#if product.source === 'catalog'}
                    <Badge variant="default">catalog</Badge>
                  {:else if product.source === 'modified'}
                    <Badge variant="secondary">modified</Badge>
                  {:else}
                    <Badge variant="outline">custom</Badge>
                  {/if}
                </Table.Cell>
                <Table.Cell class="text-right font-mono text-xs">{usageCount}</Table.Cell>
                <Table.Cell>
                  <Button
                    variant="ghost"
                    size="icon"
                    onclick={() => diagramState.removeProduct(product.id)}
                  >
                    <Trash class="h-3.5 w-3.5 text-destructive" />
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
          <p class="mb-1 text-sm">No products in Materials yet.</p>
          <p class="text-xs">Add from the external catalog or create a custom product.</p>
        </Card.Content>
      </Card.Root>
    {/if}
  </Tabs.Content>

  <Tabs.Content value="assignments">
    <Card.Root class="py-0">
      <Table.Root>
        <Table.Header>
          <Table.Row>
            <Table.Head>Target</Table.Head>
            <Table.Head>Source</Table.Head>
            <Table.Head>Requirement</Table.Head>
            <Table.Head>Assigned Product</Table.Head>
            <Table.Head>Status</Table.Head>
            <Table.Head class="w-16"></Table.Head>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {#each assignmentRows as row}
            <Table.Row>
              <Table.Cell>
                <div class="flex items-center gap-2">
                  <GitBranch class="h-3.5 w-3.5 text-muted-foreground" />
                  <span class="text-xs font-medium">{row.label}</span>
                </div>
              </Table.Cell>
              <Table.Cell class="font-mono text-xs">{row.source}</Table.Cell>
              <Table.Cell class="font-mono text-xs">{row.requirementKey ?? '—'}</Table.Cell>
              <Table.Cell>
                <select
                  class={selectClass}
                  value={row.productId ?? ''}
                  onchange={(e) => {
                    const value = (e.target as HTMLSelectElement).value || undefined
                    diagramState.bindAssignment(row.target, value)
                  }}
                >
                  <option value="">-- generic / unassigned --</option>
                  {#each compatibleProducts(row) as product}
                    <option value={product.id}>{paletteEntryLabel(product)}</option>
                  {/each}
                </select>
              </Table.Cell>
              <Table.Cell>
                {#if row.status === 'resolved'}
                  <Badge variant="default">resolved</Badge>
                {:else if row.status === 'generic'}
                  <Badge variant="secondary">generic</Badge>
                {:else}
                  <Badge variant="outline">incomplete</Badge>
                {/if}
              </Table.Cell>
              <Table.Cell>
                <Button variant="ghost" size="sm" onclick={() => goto(targetPath(row))}
                  >Open</Button
                >
              </Table.Cell>
            </Table.Row>
          {/each}
        </Table.Body>
      </Table.Root>
    </Card.Root>
  </Tabs.Content>

  <Tabs.Content value="usage">
    <Card.Root class="py-0">
      <Table.Root>
        <Table.Header>
          <Table.Row>
            <Table.Head>Product</Table.Head>
            <Table.Head class="text-right">Used</Table.Head>
            <Table.Head>Targets</Table.Head>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {#each usageRows as row}
            <Table.Row>
              <Table.Cell>
                <div class="text-xs font-medium">{paletteEntryLabel(row.product)}</div>
                <div class="text-[11px] text-muted-foreground">{row.product.spec.kind}</div>
              </Table.Cell>
              <Table.Cell class="text-right font-mono text-xs">{row.usage.length}</Table.Cell>
              <Table.Cell>
                <div class="flex flex-wrap gap-1">
                  {#each row.usage as usage}
                    <Badge variant="outline" class="font-mono text-[10px]">{usage.label}</Badge>
                  {:else}
                    <span class="text-xs text-muted-foreground">Not used</span>
                  {/each}
                </div>
              </Table.Cell>
            </Table.Row>
          {/each}
        </Table.Body>
      </Table.Root>
    </Card.Root>
  </Tabs.Content>
</Tabs.Root>

<Dialog.Root bind:open={catalogDialogOpen}>
  <Dialog.Portal>
    <Dialog.Overlay class="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px] dark:bg-black/40" />
    <Dialog.Content
      class="fixed left-1/2 top-1/2 z-50 w-[480px] -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-popover shadow-2xl focus:outline-none"
    >
      <div class="flex items-center justify-between border-b px-5 py-4">
        <Dialog.Title class="text-sm font-semibold">Add from external catalog</Dialog.Title>
        <Dialog.Close
          class="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X class="h-4 w-4" />
        </Dialog.Close>
      </div>
      <Dialog.Description class="sr-only"
        >Select a product from the external catalog</Dialog.Description
      >
      <div class="max-h-[50vh] space-y-3 overflow-auto px-5 py-4">
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
          <Card.Root class="border-primary/20 bg-primary/5">
            <Card.Content class="px-3 py-2 text-xs text-primary"
              >{selectedEntry.label}
              — {selectedEntry.id}</Card.Content
            >
          </Card.Root>
        {/if}
        <Button class="w-full" disabled={!selectedEntry} onclick={addFromCatalog}
          >Add to Library</Button
        >
      </div>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>

<Dialog.Root bind:open={customDialogOpen}>
  <Dialog.Portal>
    <Dialog.Overlay class="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px] dark:bg-black/40" />
    <Dialog.Content
      class="fixed left-1/2 top-1/2 z-50 w-[480px] -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-popover shadow-2xl focus:outline-none"
    >
      <div class="flex items-center justify-between border-b px-5 py-4">
        <Dialog.Title class="text-sm font-semibold">Create custom product</Dialog.Title>
        <Dialog.Close
          class="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X class="h-4 w-4" />
        </Dialog.Close>
      </div>
      <Dialog.Description class="sr-only">Create a custom product</Dialog.Description>
      <div class="space-y-3 px-5 py-4">
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
          >Create Product</Button
        >
      </div>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
