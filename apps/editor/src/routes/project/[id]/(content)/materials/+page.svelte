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
  import { type Product, productLabel, specIdentifier } from '$lib/types'

  type AssignmentRow =
    | {
        kind: 'placed'
        id: string
        nodeId: string
        productId: string
        nodeLabel: string
      }
    | {
        kind: 'node-only'
        id: string
        nodeId: string
        nodeLabel: string
      }
    | {
        kind: 'inventory'
        id: string
        inventoryId: string
        productId: string
      }

  let tab = $state('assignments')
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
  const productsById = $derived(new Map(products.map((product) => [product.id, product])))
  const deviceProducts = $derived(products.filter((p) => p.kind === 'device'))
  const nodes = $derived(
    [...diagramState.nodes.values()].sort((a, b) =>
      displayNodeLabel(a).localeCompare(displayNodeLabel(b)),
    ),
  )

  const rows = $derived.by<AssignmentRow[]>(() => {
    const out: AssignmentRow[] = []
    for (const node of nodes) {
      if (node.productId) {
        out.push({
          kind: 'placed',
          id: `node:${node.id}`,
          nodeId: node.id,
          productId: node.productId,
          nodeLabel: displayNodeLabel(node),
        })
      } else {
        out.push({
          kind: 'node-only',
          id: `node:${node.id}`,
          nodeId: node.id,
          nodeLabel: displayNodeLabel(node),
        })
      }
    }
    for (const item of diagramState.inventory) {
      out.push({
        kind: 'inventory',
        id: `inv:${item.id}`,
        inventoryId: item.id,
        productId: item.productId,
      })
    }
    return out
  })

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

  function displayNodeLabel(node: { id: string; label?: string | string[] }): string {
    if (Array.isArray(node.label)) return node.label[0] ?? node.id
    return node.label ?? node.id
  }

  function productKindLabel(p: Product): string {
    return p.kind === 'device' ? p.spec.kind : p.kind
  }

  function addFromCatalog() {
    const entry = selectedEntry
    if (!entry) return
    diagramState.addProduct({
      id: newId('product'),
      kind: 'device',
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
    diagramState.addProduct({ id: newId('product'), kind: 'device', source: 'custom', spec })
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

  function addInventoryFor(productId: string) {
    diagramState.addInventoryItem({ id: newId('inv'), productId })
    tab = 'assignments'
  }

  function bindNodeOnly(nodeId: string, productId: string | undefined) {
    if (productId) diagramState.bindNodeToProduct(nodeId, productId)
    else diagramState.unbindNodes([nodeId])
  }

  function changeInventoryProduct(inventoryId: string, productId: string | undefined) {
    if (!productId) {
      diagramState.removeInventoryItem(inventoryId)
      return
    }
    diagramState.updateInventoryItem(inventoryId, { productId })
  }

  function placeInventory(inventoryId: string, productId: string) {
    const newNodeId = diagramState.placeProductAsNode(productId)
    if (newNodeId) {
      diagramState.removeInventoryItem(inventoryId)
      goto(`/project/${$page.params.id}/diagram`)
    }
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
      Project-local products and inventory; assign to diagram nodes.
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
      value="assignments"
      class="rounded-md px-3 py-1.5 text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm"
    >
      Assignments
    </Tabs.Trigger>
    <Tabs.Trigger
      value="library"
      class="rounded-md px-3 py-1.5 text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm"
    >
      Library
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
              <Table.Head class="text-right">Placed</Table.Head>
              <Table.Head class="text-right">Stock</Table.Head>
              <Table.Head class="w-10"></Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {#each products as product}
              <Table.Row>
                <Table.Cell
                  ><Badge variant="secondary">{productKindLabel(product)}</Badge></Table.Cell
                >
                <Table.Cell class="font-mono text-xs">
                  {product.kind === 'device' ? (product.spec.vendor ?? '-') : (product.spec.vendor ?? '-')}
                </Table.Cell>
                <Table.Cell class="font-mono text-xs">
                  {product.kind === 'device'
                    ? specIdentifier(product.spec)
                    : product.kind === 'module'
                      ? (product.spec.mpn ?? product.spec.standard)
                      : (product.spec.mpn ?? product.spec.medium)}
                </Table.Cell>
                <Table.Cell>
                  {#if product.source === 'catalog'}
                    <Badge variant="default">catalog</Badge>
                  {:else if product.source === 'modified'}
                    <Badge variant="secondary">modified</Badge>
                  {:else}
                    <Badge variant="outline">custom</Badge>
                  {/if}
                </Table.Cell>
                <Table.Cell class="text-right font-mono text-xs"
                  >{diagramState.placedCount(product.id)}</Table.Cell
                >
                <Table.Cell class="text-right font-mono text-xs">
                  <button
                    type="button"
                    class="hover:underline"
                    onclick={() => addInventoryFor(product.id)}
                    title="Add stock"
                  >
                    {diagramState.inventoryCount(product.id)}
                    <span class="ml-1 text-muted-foreground">+</span>
                  </button>
                </Table.Cell>
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
    <div class="mb-3 flex items-center justify-between">
      <div>
        <h2 class="text-sm font-semibold">Node assignments &amp; inventory</h2>
        <p class="text-xs text-muted-foreground">
          Bind diagram nodes to products. Unplaced inventory rows can be placed onto the canvas.
        </p>
      </div>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger>
          {#snippet child({ props })}
            <Button variant="outline" size="sm" disabled={deviceProducts.length === 0} {...props}>
              <Plus class="mr-1 h-3.5 w-3.5" />
              Add Stock
              <CaretDown class="ml-1 h-3 w-3" />
            </Button>
          {/snippet}
        </DropdownMenu.Trigger>
        <DropdownMenu.Content class="z-50 min-w-56 rounded-lg border bg-popover p-1 shadow-md">
          {#each deviceProducts as product}
            <DropdownMenu.Item
              class="cursor-pointer rounded-md px-2 py-1.5 text-xs hover:bg-accent"
              onclick={() => addInventoryFor(product.id)}
            >
              {productLabel(product)}
            </DropdownMenu.Item>
          {/each}
        </DropdownMenu.Content>
      </DropdownMenu.Root>
    </div>

    {#if rows.length > 0}
      <Card.Root class="py-0">
        <Table.Root>
          <Table.Header>
            <Table.Row>
              <Table.Head>Where</Table.Head>
              <Table.Head>Product</Table.Head>
              <Table.Head>Status</Table.Head>
              <Table.Head class="w-32"></Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {#each rows as row (row.id)}
              <Table.Row>
                <Table.Cell>
                  {#if row.kind === 'inventory'}
                    <span class="text-xs italic text-muted-foreground">unplaced stock</span>
                  {:else}
                    <div class="flex items-center gap-1 text-xs">
                      <GitBranch class="h-3 w-3 text-muted-foreground" />
                      <span class="font-mono">{row.nodeLabel}</span>
                    </div>
                  {/if}
                </Table.Cell>
                <Table.Cell>
                  {#if row.kind === 'inventory'}
                    <select
                      class={selectClass}
                      value={row.productId}
                      onchange={(e) => {
                        const v = (e.target as HTMLSelectElement).value || undefined
                        changeInventoryProduct(row.inventoryId, v)
                      }}
                    >
                      {#each deviceProducts as product}
                        <option value={product.id}>{productLabel(product)}</option>
                      {/each}
                    </select>
                  {:else}
                    <select
                      class={selectClass}
                      value={row.kind === 'placed' ? row.productId : ''}
                      onchange={(e) => {
                        const v = (e.target as HTMLSelectElement).value || undefined
                        bindNodeOnly(row.nodeId, v)
                      }}
                    >
                      <option value="">-- unassigned --</option>
                      {#each deviceProducts as product}
                        <option value={product.id}>{productLabel(product)}</option>
                      {/each}
                    </select>
                    {#if row.kind === 'placed' && productsById.get(row.productId)}
                      <div class="mt-1 text-[11px] text-muted-foreground">
                        {productKindLabel(productsById.get(row.productId) as Product)}
                      </div>
                    {/if}
                  {/if}
                </Table.Cell>
                <Table.Cell>
                  {#if row.kind === 'placed'}
                    <Badge variant="default">placed</Badge>
                  {:else if row.kind === 'inventory'}
                    <Badge variant="secondary">stock</Badge>
                  {:else}
                    <Badge variant="outline">node only</Badge>
                  {/if}
                </Table.Cell>
                <Table.Cell>
                  <div class="flex justify-end gap-1">
                    {#if row.kind === 'placed'}
                      <Button
                        variant="ghost"
                        size="sm"
                        onclick={() => goto(`/project/${$page.params.id}/diagram`)}
                      >
                        Open
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onclick={() => diagramState.unbindNodes([row.nodeId])}
                      >
                        Unbind
                      </Button>
                    {:else if row.kind === 'inventory'}
                      <Button
                        variant="ghost"
                        size="sm"
                        onclick={() => placeInventory(row.inventoryId, row.productId)}
                      >
                        Place
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onclick={() => diagramState.removeInventoryItem(row.inventoryId)}
                      >
                        <Trash class="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    {:else}
                      <Button
                        variant="ghost"
                        size="sm"
                        onclick={() => goto(`/project/${$page.params.id}/diagram`)}
                      >
                        Open
                      </Button>
                    {/if}
                  </div>
                </Table.Cell>
              </Table.Row>
            {/each}
          </Table.Body>
        </Table.Root>
      </Card.Root>
    {:else}
      <Card.Root class="py-16">
        <Card.Content class="flex flex-col items-center text-center text-muted-foreground">
          <p class="mb-1 text-sm">No assignments yet.</p>
          <p class="text-xs">Create nodes in the diagram or add inventory.</p>
        </Card.Content>
      </Card.Root>
    {/if}
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
              - {selectedEntry.id}</Card.Content
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
