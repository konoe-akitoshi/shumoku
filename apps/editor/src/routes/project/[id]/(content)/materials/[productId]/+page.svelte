<script lang="ts">
  import { Dialog } from 'bits-ui'
  import { ArrowLeft, GitBranch, Trash, X } from 'phosphor-svelte'
  import { goto } from '$app/navigation'
  import { page } from '$app/stores'
  import { Badge } from '$lib/components/ui/badge'
  import { Button } from '$lib/components/ui/button'
  import * as Card from '$lib/components/ui/card'
  import * as Table from '$lib/components/ui/table'
  import { diagramState } from '$lib/context.svelte'
  import { productLabel, specIdentifier } from '$lib/types'

  const projectId = $derived($page.params.id ?? '')
  const productId = $derived($page.params.productId ?? '')
  const product = $derived(diagramState.products.find((p) => p.id === productId))

  let removeOpen = $state(false)

  const placed = $derived(diagramState.placedCount(productId))
  const required = $derived(diagramState.requiredCount(productId))
  const diff = $derived(required - placed)

  // List of node bindings for this product
  const placedNodes = $derived.by(() => {
    if (!product) return []
    const nodes: Array<{ id: string; label: string; parent?: string }> = []
    for (const [id, node] of diagramState.nodes) {
      if (node.productId === productId) {
        const label = Array.isArray(node.label) ? node.label[0] : (node.label ?? id)
        nodes.push({ id, label: label || id, parent: node.parent })
      }
    }
    return nodes.sort((a, b) => a.label.localeCompare(b.label))
  })

  // List of link endpoints (modules + cables) for this product
  const linkBindings = $derived.by(() => {
    if (!product) return []
    const out: Array<{ kind: 'module' | 'cable'; linkId: string; detail: string }> = []
    for (const link of diagramState.links) {
      if (!link.id) continue
      for (const side of ['from', 'to'] as const) {
        if (link[side].plug?.module?.productId === productId) {
          out.push({
            kind: 'module',
            linkId: link.id,
            detail: `${link[side].node}:${link[side].port} (${side})`,
          })
        }
      }
      if (link.cable?.productId === productId) {
        out.push({
          kind: 'cable',
          linkId: link.id,
          detail: `${link.from.node} ↔ ${link.to.node}`,
        })
      }
    }
    return out
  })

  function setRequiredQty(value: string) {
    if (!product) return
    const trimmed = value.trim()
    if (trimmed === '') {
      diagramState.updateProduct(product.id, { requiredQty: undefined })
      return
    }
    const n = Number(trimmed)
    if (!Number.isFinite(n) || n < 0) return
    diagramState.updateProduct(product.id, { requiredQty: Math.floor(n) })
  }

  function confirmRemove() {
    if (!product) return
    diagramState.removeProduct(product.id)
    removeOpen = false
    goto(`/project/${projectId}/materials`)
  }

  const labelClass = 'text-[10px] font-medium text-muted-foreground uppercase tracking-wider'
</script>

<div class="mb-4 flex items-center gap-3">
  <Button variant="ghost" size="sm" onclick={() => goto(`/project/${projectId}/materials`)}>
    <ArrowLeft class="mr-1 h-3.5 w-3.5" />
    Materials
  </Button>
</div>

{#if !product}
  <Card.Root class="py-16">
    <Card.Content class="flex flex-col items-center text-center text-muted-foreground">
      <p class="mb-1 text-sm">Product not found.</p>
      <p class="text-xs">It may have been removed. Return to the Materials list.</p>
    </Card.Content>
  </Card.Root>
{:else}
  <div class="mb-6 flex items-start justify-between gap-4">
    <div class="min-w-0">
      <div class="mb-1 flex items-center gap-2">
        <Badge variant="secondary"
          >{product.kind === 'device' ? product.spec.kind : product.kind}</Badge
        >
        {#if product.catalogId}
          <Badge variant="default" title={product.catalogId}>catalog</Badge>
        {:else}
          <Badge variant="outline">custom</Badge>
        {/if}
      </div>
      <h1 class="truncate font-mono text-lg font-semibold">{productLabel(product)}</h1>
      {#if product.catalogId}
        <p class="truncate font-mono text-xs text-muted-foreground">{product.catalogId}</p>
      {/if}
    </div>
    <Button variant="outline" size="sm" onclick={() => { removeOpen = true }}>
      <Trash class="mr-1 h-3.5 w-3.5 text-destructive" />
      Remove
    </Button>
  </div>

  <!-- Quantity panel -->
  <div class="mb-6 grid grid-cols-3 gap-2">
    <Card.Root class="py-0">
      <Card.Content class="px-3 py-2.5">
        <div class={labelClass}>Placed</div>
        <div class="font-mono text-lg font-semibold">{placed}</div>
        <div class="mt-0.5 text-[10px] text-muted-foreground">read-only · derived</div>
      </Card.Content>
    </Card.Root>
    <Card.Root class="py-0">
      <Card.Content class="px-3 py-2.5">
        <div class={labelClass}>Required</div>
        <div class="mt-0.5 flex items-center gap-1">
          <input
            type="number"
            min="0"
            inputmode="numeric"
            placeholder={String(placed)}
            class="w-20 rounded border border-input bg-background px-1.5 py-0.5 font-mono text-base font-semibold outline-none focus:ring-1 focus:ring-ring"
            value={product.requiredQty ?? ''}
            onchange={(e) => setRequiredQty((e.target as HTMLInputElement).value)}
          >
        </div>
        <div class="mt-0.5 text-[10px] text-muted-foreground">empty = follow placed</div>
      </Card.Content>
    </Card.Root>
    <Card.Root class="py-0">
      <Card.Content class="px-3 py-2.5">
        <div class={labelClass}>Diff</div>
        <div
          class="font-mono text-lg font-semibold {diff > 0
            ? 'text-amber-600'
            : diff < 0
              ? 'text-rose-600'
              : 'text-muted-foreground'}"
        >
          {diff > 0 ? `+${diff}` : diff}
        </div>
        <div class="mt-0.5 text-[10px] text-muted-foreground">
          {#if diff > 0}
            {diff}
            more needed
          {:else if diff < 0}
            {Math.abs(diff)}
            over
          {:else}
            match
          {/if}
        </div>
      </Card.Content>
    </Card.Root>
  </div>

  <!-- Spec details -->
  <Card.Root class="mb-6 py-0">
    <Card.Content class="px-5 py-4">
      <div class="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        Spec
      </div>
      <dl class="grid grid-cols-[8rem_1fr] gap-y-1.5 text-xs">
        <dt class="text-muted-foreground">Kind</dt>
        <dd class="font-mono">{product.kind === 'device' ? product.spec.kind : product.kind}</dd>

        {#if product.kind === 'device'}
          {#if 'type' in product.spec && product.spec.type}
            <dt class="text-muted-foreground">Type</dt>
            <dd class="font-mono">{product.spec.type}</dd>
          {/if}
          <dt class="text-muted-foreground">Vendor</dt>
          <dd class="font-mono">{product.spec.vendor ?? '—'}</dd>
          <dt class="text-muted-foreground">Identifier</dt>
          <dd class="font-mono">{specIdentifier(product.spec)}</dd>
        {:else if product.kind === 'module'}
          <dt class="text-muted-foreground">Vendor</dt>
          <dd class="font-mono">{product.spec.vendor ?? '—'}</dd>
          <dt class="text-muted-foreground">MPN</dt>
          <dd class="font-mono">{product.spec.mpn ?? '—'}</dd>
          <dt class="text-muted-foreground">Standard</dt>
          <dd class="font-mono">{product.spec.standard}</dd>
          {#if product.spec.formFactor}
            <dt class="text-muted-foreground">Form factor</dt>
            <dd class="font-mono">{product.spec.formFactor}</dd>
          {/if}
          {#if product.spec.reach_m}
            <dt class="text-muted-foreground">Reach</dt>
            <dd class="font-mono">{product.spec.reach_m} m</dd>
          {/if}
        {:else}
          <dt class="text-muted-foreground">Vendor</dt>
          <dd class="font-mono">{product.spec.vendor ?? '—'}</dd>
          <dt class="text-muted-foreground">MPN</dt>
          <dd class="font-mono">{product.spec.mpn ?? '—'}</dd>
          <dt class="text-muted-foreground">Medium</dt>
          <dd class="font-mono">{product.spec.medium}</dd>
          {#if product.spec.category}
            <dt class="text-muted-foreground">Category</dt>
            <dd class="font-mono">{product.spec.category}</dd>
          {/if}
          {#if product.spec.length_m}
            <dt class="text-muted-foreground">Length</dt>
            <dd class="font-mono">{product.spec.length_m} m</dd>
          {/if}
        {/if}

        {#if product.notes}
          <dt class="text-muted-foreground">Notes</dt>
          <dd>{product.notes}</dd>
        {/if}
      </dl>
    </Card.Content>
  </Card.Root>

  <!-- Placement listings -->
  <div class="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
    Bound to
  </div>
  {#if placedNodes.length === 0 && linkBindings.length === 0}
    <Card.Root class="py-8">
      <Card.Content class="text-center text-xs text-muted-foreground">
        No placements yet.
      </Card.Content>
    </Card.Root>
  {:else}
    <Card.Root class="py-0">
      <Table.Root>
        <Table.Header>
          <Table.Row>
            <Table.Head class="w-24">Where</Table.Head>
            <Table.Head>Detail</Table.Head>
            <Table.Head class="w-24"></Table.Head>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {#each placedNodes as node}
            <Table.Row>
              <Table.Cell><Badge variant="default">node</Badge></Table.Cell>
              <Table.Cell>
                <div class="flex items-center gap-1 font-mono text-xs">
                  <GitBranch class="h-3 w-3 text-muted-foreground" />
                  {node.label}
                </div>
              </Table.Cell>
              <Table.Cell>
                <Button
                  variant="ghost"
                  size="sm"
                  onclick={() => goto(`/project/${projectId}/diagram`)}
                >
                  Open
                </Button>
              </Table.Cell>
            </Table.Row>
          {/each}
          {#each linkBindings as link}
            <Table.Row>
              <Table.Cell><Badge variant="secondary">{link.kind}</Badge></Table.Cell>
              <Table.Cell class="font-mono text-xs">{link.detail}</Table.Cell>
              <Table.Cell>
                <Button
                  variant="ghost"
                  size="sm"
                  onclick={() => goto(`/project/${projectId}/connections`)}
                >
                  Open
                </Button>
              </Table.Cell>
            </Table.Row>
          {/each}
        </Table.Body>
      </Table.Root>
    </Card.Root>
  {/if}
{/if}

<!-- Remove confirm dialog -->
<Dialog.Root bind:open={removeOpen}>
  <Dialog.Portal>
    <Dialog.Overlay class="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px] dark:bg-black/40" />
    <Dialog.Content
      class="fixed top-1/2 left-1/2 z-50 w-[460px] -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-popover shadow-2xl focus:outline-none"
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
        {#if product}
          <p>Remove <span class="font-mono">{productLabel(product)}</span>?</p>
          <div class="space-y-1 rounded-md bg-muted/40 p-3 text-xs">
            <div class="text-[10px] uppercase tracking-wider text-muted-foreground">
              Impact preview
            </div>
            {#if placedNodes.length > 0}
              <div>
                <span class="font-mono font-semibold text-amber-600">{placedNodes.length}</span>
                placed node{placedNodes.length === 1 ? '' : 's'}
                will lose their product binding
              </div>
            {/if}
            {#if linkBindings.length > 0}
              <div>
                <span class="font-mono font-semibold text-amber-600">{linkBindings.length}</span>
                link endpoint{linkBindings.length === 1 ? '' : 's'}
                will lose their product
              </div>
            {/if}
            {#if placedNodes.length === 0 && linkBindings.length === 0}
              <div class="text-muted-foreground">No diagram impact.</div>
            {/if}
          </div>
        {/if}
        <div class="flex justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" onclick={() => { removeOpen = false }}>Cancel</Button>
          <Button variant="destructive" size="sm" onclick={confirmRemove}>Remove</Button>
        </div>
      </div>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
