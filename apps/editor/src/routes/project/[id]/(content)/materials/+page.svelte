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

  let tab = $state('assignments')
  let catalogDialogOpen = $state(false)
  let customDialogOpen = $state(false)
  let removeTarget = $state<Product | null>(null)
  let addTarget = $state<Product | null>(null)
  let addDelta = $state('1')

  function openAddDialog(product: Product) {
    addTarget = product
    addDelta = '1'
  }

  function confirmAdd() {
    if (!addTarget) return
    const n = Number(addDelta)
    if (!Number.isFinite(n) || n <= 0) {
      addTarget = null
      return
    }
    const current = diagramState.requiredCount(addTarget.id)
    diagramState.updateProduct(addTarget.id, { requiredQty: current + Math.floor(n) })
    addTarget = null
  }

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
    diagramState.addProduct({ id: newId('product'), kind: 'device', spec })
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

  function bindNodeOnly(nodeId: string, productId: string | undefined) {
    if (productId) diagramState.bindNodeToProduct(nodeId, productId)
    else diagramState.unbindNodes([nodeId])
  }

  // Project-level health metrics (principle: status visibility / soft constraints)
  const stats = $derived.by(() => {
    let placed = 0
    let nodeOnly = 0
    let incomplete = 0
    for (const node of diagramState.nodes.values()) {
      if (node.productId) placed++
      else if (node.spec) nodeOnly++
      else incomplete++
    }
    let required = 0
    for (const product of products) {
      required += diagramState.requiredCount(product.id)
    }
    return { products: products.length, placed, required, nodeOnly, incomplete }
  })

  // Impact preview for Product removal (principle: explicit consequences)
  const removeImpact = $derived.by(() => {
    if (!removeTarget) return { placed: 0, links: 0 }
    const id = removeTarget.id
    let placed = 0
    let links = 0
    for (const node of diagramState.nodes.values()) {
      if (node.productId === id) placed++
    }
    for (const link of diagramState.links) {
      if (link.from.plug?.module?.productId === id) links++
      if (link.to.plug?.module?.productId === id) links++
      if (link.cable?.productId === id) links++
    }
    return { placed, links }
  })

  function confirmRemoveProduct() {
    if (!removeTarget) return
    diagramState.removeProduct(removeTarget.id)
    removeTarget = null
  }

  const selectClass =
    'w-full px-2 py-1.5 text-xs bg-background border border-input rounded-lg outline-none focus:ring-1 focus:ring-ring text-foreground'
  const inputClass =
    'w-full px-2 py-1.5 text-xs bg-background border border-input rounded-lg outline-none focus:ring-1 focus:ring-ring text-foreground'
  const labelClass = 'text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1'
</script>

<div class="mb-4">
  <h1 class="text-lg font-semibold">Materials</h1>
  <p class="text-sm text-muted-foreground">
    Project-local products with required counts; bind to diagram nodes.
  </p>
</div>

<!-- Project status banner — single-glance health view -->
<div class="mb-6 grid grid-cols-5 gap-2">
  <Card.Root class="py-0">
    <Card.Content class="px-3 py-2.5">
      <div class="text-[10px] uppercase tracking-wider text-muted-foreground">Products</div>
      <div class="font-mono text-lg font-semibold">{stats.products}</div>
    </Card.Content>
  </Card.Root>
  <Card.Root class="py-0">
    <Card.Content class="px-3 py-2.5">
      <div class="text-[10px] uppercase tracking-wider text-muted-foreground">Placed</div>
      <div class="font-mono text-lg font-semibold">{stats.placed}</div>
    </Card.Content>
  </Card.Root>
  <Card.Root class="py-0">
    <Card.Content class="px-3 py-2.5">
      <div class="text-[10px] uppercase tracking-wider text-muted-foreground">Required</div>
      <div class="font-mono text-lg font-semibold">{stats.required}</div>
    </Card.Content>
  </Card.Root>
  <Card.Root class="py-0" data-warn={stats.nodeOnly > 0}>
    <Card.Content class="px-3 py-2.5">
      <div class="text-[10px] uppercase tracking-wider text-muted-foreground">Node-only</div>
      <div class="font-mono text-lg font-semibold {stats.nodeOnly > 0 ? 'text-amber-600' : ''}">
        {stats.nodeOnly}
      </div>
    </Card.Content>
  </Card.Root>
  <Card.Root class="py-0">
    <Card.Content class="px-3 py-2.5">
      <div class="text-[10px] uppercase tracking-wider text-muted-foreground">Incomplete</div>
      <div class="font-mono text-lg font-semibold {stats.incomplete > 0 ? 'text-amber-600' : ''}">
        {stats.incomplete}
      </div>
    </Card.Content>
  </Card.Root>
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
    <div class="mb-3 flex items-center justify-between">
      <div>
        <h2 class="text-sm font-semibold">Product library</h2>
        <p class="text-xs text-muted-foreground">
          Devices, modules, cables you reference in this project.
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

    {#if products.length > 0}
      <Card.Root class="py-0">
        <Table.Root>
          <Table.Header>
            <Table.Row>
              <Table.Head>Kind</Table.Head>
              <Table.Head>Vendor</Table.Head>
              <Table.Head>Identifier</Table.Head>
              <Table.Head>Origin</Table.Head>
              <Table.Head class="w-32 text-right">Quantity</Table.Head>
              <Table.Head class="w-10"></Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {#each products as product}
              {@const placed = diagramState.placedCount(product.id)}
              {@const required = diagramState.requiredCount(product.id)}
              {@const diff = required - placed}
              <Table.Row
                class="cursor-pointer hover:bg-muted/40"
                onclick={() => goto(`/project/${$page.params.id}/materials/${product.id}`)}
              >
                <Table.Cell
                  ><Badge variant="secondary">{productKindLabel(product)}</Badge></Table.Cell
                >
                <Table.Cell class="font-mono text-xs">{product.spec.vendor ?? '-'}</Table.Cell>
                <Table.Cell class="font-mono text-xs">
                  {product.kind === 'device'
                    ? specIdentifier(product.spec)
                    : product.kind === 'module'
                      ? (product.spec.mpn ?? product.spec.standard)
                      : (product.spec.mpn ?? product.spec.medium)}
                </Table.Cell>
                <Table.Cell>
                  {#if product.catalogId}
                    <Badge variant="default" title={product.catalogId}>catalog</Badge>
                  {:else}
                    <Badge variant="outline">custom</Badge>
                  {/if}
                </Table.Cell>
                <Table.Cell class="text-right" onclick={(e) => e.stopPropagation()}>
                  <div class="inline-flex items-center justify-end gap-2 font-mono text-xs">
                    <span>
                      <span class="text-muted-foreground">{placed}</span>
                      <span class="text-muted-foreground">/</span>
                      <span class="font-semibold">{required}</span>
                      {#if diff > 0}
                        <span class="ml-1 text-amber-600">+{diff}</span>
                      {:else if diff < 0}
                        <span class="ml-1 text-rose-600">{diff}</span>
                      {/if}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      class="h-6 w-6"
                      onclick={() => openAddDialog(product)}
                      title="Add to required count"
                    >
                      <Plus class="h-3 w-3" />
                    </Button>
                  </div>
                </Table.Cell>
                <Table.Cell onclick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="icon" onclick={() => { removeTarget = product }}>
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
        <Card.Content class="flex flex-col items-center gap-2 text-center text-muted-foreground">
          <p class="text-sm">No products yet.</p>
          <p class="text-xs">
            Add a known device from the catalog, or create a custom product to start.
          </p>
          <div class="mt-2 flex gap-2">
            <Button size="sm" onclick={() => { catalogDialogOpen = true }}> From catalog </Button>
            <Button size="sm" variant="outline" onclick={() => { customDialogOpen = true }}>
              Custom
            </Button>
          </div>
        </Card.Content>
      </Card.Root>
    {/if}
  </Tabs.Content>

  <Tabs.Content value="assignments">
    <div class="mb-3">
      <h2 class="text-sm font-semibold">Node assignments</h2>
      <p class="text-xs text-muted-foreground">
        Each diagram node and the product it is bound to. Edit `Required` in the Library tab to
        adjust procurement targets.
      </p>
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
                  <div class="flex items-center gap-1 text-xs">
                    <GitBranch class="h-3 w-3 text-muted-foreground" />
                    <span class="font-mono">{row.nodeLabel}</span>
                  </div>
                </Table.Cell>
                <Table.Cell>
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
                </Table.Cell>
                <Table.Cell>
                  {#if row.kind === 'placed'}
                    <Badge variant="default">placed</Badge>
                  {:else}
                    <Badge variant="outline">node only</Badge>
                  {/if}
                </Table.Cell>
                <Table.Cell>
                  <div class="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onclick={() => goto(`/project/${$page.params.id}/diagram`)}
                    >
                      Open
                    </Button>
                    {#if row.kind === 'placed'}
                      <Button
                        variant="ghost"
                        size="sm"
                        onclick={() => diagramState.unbindNodes([row.nodeId])}
                      >
                        Unbind
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
        <Card.Content class="flex flex-col items-center gap-2 text-center text-muted-foreground">
          <p class="text-sm">No assignments yet.</p>
          {#if products.length === 0}
            <p class="text-xs">Add a Product first to start tracking assignments.</p>
            <Button size="sm" variant="outline" class="mt-2" onclick={() => { tab = 'library' }}>
              Go to Library
            </Button>
          {:else}
            <p class="text-xs">Create nodes in the diagram to start binding products.</p>
            <Button
              size="sm"
              variant="outline"
              class="mt-2"
              onclick={() => goto(`/project/${$page.params.id}/diagram`)}
            >
              Open Diagram
            </Button>
          {/if}
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

<!-- Remove product confirm — explicit consequences -->
<Dialog.Root open={removeTarget !== null} onOpenChange={(o) => { if (!o) removeTarget = null }}>
  <Dialog.Portal>
    <Dialog.Overlay class="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px] dark:bg-black/40" />
    <Dialog.Content
      class="fixed left-1/2 top-1/2 z-50 w-[460px] -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-popover shadow-2xl focus:outline-none"
    >
      <div class="flex items-center justify-between border-b px-5 py-4">
        <Dialog.Title class="text-sm font-semibold">Remove product?</Dialog.Title>
        <Dialog.Close
          class="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X class="h-4 w-4" />
        </Dialog.Close>
      </div>
      <Dialog.Description class="sr-only">Confirm product removal</Dialog.Description>
      <div class="space-y-3 px-5 py-4 text-sm">
        {#if removeTarget}
          <p>Remove <span class="font-mono">{productLabel(removeTarget)}</span>?</p>
          <div class="rounded-md bg-muted/40 p-3 text-xs space-y-1">
            <div class="text-[10px] uppercase tracking-wider text-muted-foreground">
              Impact preview
            </div>
            {#if removeImpact.placed > 0}
              <div>
                <span class="font-mono font-semibold text-amber-600">{removeImpact.placed}</span>
                placed node{removeImpact.placed === 1 ? "" : "s"}
                will lose their product binding (spec reduced to role-only)
              </div>
            {/if}
            {#if removeImpact.links > 0}
              <div>
                <span class="font-mono font-semibold text-amber-600">{removeImpact.links}</span>
                link endpoint{removeImpact.links === 1 ? "" : "s"}
                will lose their product
              </div>
            {/if}
            {#if removeImpact.placed === 0 && removeImpact.links === 0}
              <div class="text-muted-foreground">No diagram impact.</div>
            {/if}
          </div>
        {/if}
        <div class="flex justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" onclick={() => { removeTarget = null }}
            >Cancel</Button
          >
          <Button variant="destructive" size="sm" onclick={confirmRemoveProduct}>Remove</Button>
        </div>
      </div>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>

<!-- Add to Required popup -->
<Dialog.Root open={addTarget !== null} onOpenChange={(o) => { if (!o) addTarget = null }}>
  <Dialog.Portal>
    <Dialog.Overlay class="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px] dark:bg-black/40" />
    <Dialog.Content
      class="fixed left-1/2 top-1/2 z-50 w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-popover shadow-2xl focus:outline-none"
    >
      <div class="flex items-center justify-between border-b px-5 py-4">
        <Dialog.Title class="text-sm font-semibold">Add units</Dialog.Title>
        <Dialog.Close
          class="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X class="h-4 w-4" />
        </Dialog.Close>
      </div>
      <Dialog.Description class="sr-only"
        >Increase the required count for this product</Dialog.Description
      >
      <div class="space-y-3 px-5 py-4 text-sm">
        {#if addTarget}
          {@const currentRequired = diagramState.requiredCount(addTarget.id)}
          {@const delta = Number(addDelta)}
          {@const next = Number.isFinite(delta) && delta > 0 ? currentRequired + Math.floor(delta) : currentRequired}
          <div>
            <div class="text-xs text-muted-foreground">Product</div>
            <div class="font-mono text-sm">{productLabel(addTarget)}</div>
          </div>
          <div class="grid grid-cols-3 gap-2 rounded-md bg-muted/40 p-3 text-xs">
            <div>
              <div class="text-[10px] uppercase tracking-wider text-muted-foreground">Current</div>
              <div class="font-mono text-base">{currentRequired}</div>
            </div>
            <div>
              <div class="text-[10px] uppercase tracking-wider text-muted-foreground">Add</div>
              <div class="font-mono text-base text-amber-600">
                +{delta > 0 ? Math.floor(delta) : 0}
              </div>
            </div>
            <div>
              <div class="text-[10px] uppercase tracking-wider text-muted-foreground">After</div>
              <div class="font-mono text-base font-semibold">{next}</div>
            </div>
          </div>
          <div>
            <div class={labelClass}>Quantity to add</div>
            <input
              type="number"
              min="1"
              inputmode="numeric"
              class={inputClass}
              bind:value={addDelta}
              onkeydown={(e) => { if (e.key === 'Enter') confirmAdd() }}
            >
          </div>
          <div class="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onclick={() => { addTarget = null }}>Cancel</Button>
            <Button size="sm" onclick={confirmAdd}>Add</Button>
          </div>
        {/if}
      </div>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
