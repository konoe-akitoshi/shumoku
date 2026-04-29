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
  import { paletteEntryLabel, specIdentifier } from '$lib/types'

  type DeviceAssignmentRow = {
    id: string
    bomId?: string
    nodeId?: string
    productId?: string
    nodeLabel: string
    status: 'placed' | 'unplaced' | 'node-only'
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
  const nodes = $derived(
    [...diagramState.nodes.values()].sort((a, b) =>
      displayNodeLabel(a).localeCompare(displayNodeLabel(b)),
    ),
  )
  const deviceProducts = $derived(
    products.filter(
      (p) => p.spec.kind === 'hardware' || p.spec.kind === 'compute' || p.spec.kind === 'service',
    ),
  )

  const boundNodeIds = $derived(
    new Set(diagramState.bomItems.flatMap((item) => (item.nodeId ? [item.nodeId] : []))),
  )
  const unboundNodes = $derived(nodes.filter((node) => !boundNodeIds.has(node.id)))

  const deviceRows = $derived.by<DeviceAssignmentRow[]>(() => {
    const rows: DeviceAssignmentRow[] = diagramState.bomItems.map((item) => {
      const node = item.nodeId ? diagramState.nodes.get(item.nodeId) : undefined
      return {
        id: item.id,
        bomId: item.id,
        nodeId: item.nodeId,
        productId: item.paletteId,
        nodeLabel: node ? displayNodeLabel(node) : 'Unplaced',
        status: item.nodeId ? 'placed' : 'unplaced',
      }
    })

    for (const node of nodes) {
      if (boundNodeIds.has(node.id)) continue
      rows.push({
        id: `node:${node.id}`,
        nodeId: node.id,
        productId: node.productId,
        nodeLabel: displayNodeLabel(node),
        status: 'node-only',
      })
    }

    return rows
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

  function addDeviceRow(productId?: string) {
    diagramState.addBomItem({ id: newId('bom'), paletteId: productId })
    tab = 'assignments'
  }

  function setRowProduct(row: DeviceAssignmentRow, productId: string | undefined) {
    if (row.bomId) {
      diagramState.updateBomItem(row.bomId, { paletteId: productId })
      if (row.nodeId) diagramState.bindNodeToBom(row.bomId, row.nodeId)
      return
    }
    if (row.nodeId) {
      if (productId) diagramState.bindNodeToPalette(row.nodeId, productId)
      else diagramState.unbindNodes([row.nodeId])
    }
  }

  function setRowNode(row: DeviceAssignmentRow, nodeId: string | undefined) {
    if (!row.bomId) return
    if (row.nodeId && row.nodeId !== nodeId) diagramState.unbindNodes([row.nodeId])
    diagramState.bindNodeToBom(row.bomId, nodeId)
  }

  function nodeOptions(row: DeviceAssignmentRow) {
    const options = [...unboundNodes]
    if (row.nodeId && !options.some((node) => node.id === row.nodeId)) {
      const current = diagramState.nodes.get(row.nodeId)
      if (current) options.unshift(current)
    }
    return options
  }

  function placeRow(row: DeviceAssignmentRow) {
    if (row.nodeId) {
      goto(`/project/${$page.params.id}/diagram`)
      return
    }
    if (!row.bomId) return
    const nodeId = diagramState.placeNodeForBom(row.bomId)
    if (nodeId) goto(`/project/${$page.params.id}/diagram`)
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
    <p class="text-sm text-muted-foreground">Assign equipment products to diagram nodes</p>
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
              <Table.Head class="text-right">Assigned</Table.Head>
              <Table.Head class="w-10"></Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {#each products as product}
              {@const usageCount = deviceRows.filter((row) => row.productId === product.id).length}
              <Table.Row>
                <Table.Cell><Badge variant="secondary">{product.spec.kind}</Badge></Table.Cell>
                <Table.Cell class="font-mono text-xs">{product.spec.vendor ?? '-'}</Table.Cell>
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
    <div class="mb-3 flex items-center justify-between">
      <div>
        <h2 class="text-sm font-semibold">Node assignments</h2>
        <p class="text-xs text-muted-foreground">
          Assign equipment products to diagram nodes. Cable and module details stay in Connections.
        </p>
      </div>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger>
          {#snippet child({ props })}
            <Button variant="outline" size="sm" {...props}>
              <Plus class="mr-1 h-3.5 w-3.5" />
              Add Equipment
              <CaretDown class="ml-1 h-3 w-3" />
            </Button>
          {/snippet}
        </DropdownMenu.Trigger>
        <DropdownMenu.Content class="z-50 min-w-56 rounded-lg border bg-popover p-1 shadow-md">
          <DropdownMenu.Item
            class="cursor-pointer rounded-md px-2 py-1.5 text-xs hover:bg-accent"
            onclick={() => addDeviceRow()}
          >
            Unplaced equipment
          </DropdownMenu.Item>
          {#each deviceProducts as product}
            <DropdownMenu.Item
              class="cursor-pointer rounded-md px-2 py-1.5 text-xs hover:bg-accent"
              onclick={() => addDeviceRow(product.id)}
            >
              {paletteEntryLabel(product)}
            </DropdownMenu.Item>
          {/each}
        </DropdownMenu.Content>
      </DropdownMenu.Root>
    </div>

    {#if deviceRows.length > 0}
      <Card.Root class="py-0">
        <Table.Root>
          <Table.Header>
            <Table.Row>
              <Table.Head>Node</Table.Head>
              <Table.Head>Equipment</Table.Head>
              <Table.Head>Status</Table.Head>
              <Table.Head class="w-32"></Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {#each deviceRows as row}
              <Table.Row>
                <Table.Cell>
                  <select
                    class={selectClass}
                    value={row.nodeId ?? ''}
                    disabled={!row.bomId}
                    onchange={(e) => {
                      const value = (e.target as HTMLSelectElement).value || undefined
                      setRowNode(row, value)
                    }}
                  >
                    <option value="">-- unplaced --</option>
                    {#each nodeOptions(row) as node}
                      <option value={node.id}>{displayNodeLabel(node)}</option>
                    {/each}
                  </select>
                  <div class="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                    <GitBranch class="h-3 w-3" />
                    {row.nodeLabel}
                  </div>
                </Table.Cell>
                <Table.Cell>
                  <select
                    class={selectClass}
                    value={row.productId ?? ''}
                    onchange={(e) => {
                      const value = (e.target as HTMLSelectElement).value || undefined
                      setRowProduct(row, value)
                    }}
                  >
                    <option value="">-- unassigned equipment --</option>
                    {#each deviceProducts as product}
                      <option value={product.id}>{paletteEntryLabel(product)}</option>
                    {/each}
                  </select>
                  {#if row.productId && productsById.get(row.productId)}
                    <div class="mt-1 text-[11px] text-muted-foreground">
                      {productsById.get(row.productId)?.spec.kind}
                    </div>
                  {/if}
                </Table.Cell>
                <Table.Cell>
                  {#if row.status === 'placed'}
                    <Badge variant="default">placed</Badge>
                  {:else if row.status === 'unplaced'}
                    <Badge variant="secondary">unplaced</Badge>
                  {:else}
                    <Badge variant="outline">node only</Badge>
                  {/if}
                </Table.Cell>
                <Table.Cell>
                  <div class="flex justify-end gap-1">
                    <Button variant="ghost" size="sm" onclick={() => placeRow(row)}>
                      {row.nodeId ? 'Open' : 'Place'}
                    </Button>
                    {#if row.nodeId}
                      <Button
                        variant="ghost"
                        size="sm"
                        onclick={() => diagramState.unbindNodes([row.nodeId as string])}
                      >
                        Unbind
                      </Button>
                    {:else if row.bomId}
                      <Button
                        variant="ghost"
                        size="icon"
                        onclick={() => diagramState.removeBomItem(row.bomId as string)}
                      >
                        <Trash class="h-3.5 w-3.5 text-destructive" />
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
          <p class="mb-1 text-sm">No device assignments yet.</p>
          <p class="text-xs">Create nodes in the diagram or add unplaced equipment.</p>
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
