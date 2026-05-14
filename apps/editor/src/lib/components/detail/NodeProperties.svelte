<script lang="ts">
  import { type Node, type NodeSpec, type Subgraph, specDeviceType } from '@shumoku/core'
  import { Combobox } from 'bits-ui'
  import { CaretUpDown } from 'phosphor-svelte'
  import type { Product } from '$lib/types'
  import { productLabel } from '$lib/types'

  let {
    node,
    editing = false,
    products = [],
    subgraphs = new Map(),
    onupdate,
    onbindproduct,
  }: {
    node: Node
    editing?: boolean
    products?: Product[]
    subgraphs?: Map<string, Subgraph>
    onupdate?: (field: string, value: unknown) => void
    onbindproduct?: (productId: string) => void
  } = $props()

  let comboSearchValue = $state('')

  const deviceProducts = $derived(products.filter((p) => p.kind === 'device'))

  const comboResults = $derived.by(() => {
    if (!deviceProducts.length) return []
    if (!comboSearchValue.trim()) return deviceProducts.slice(0, 10)
    const q = comboSearchValue.toLowerCase()
    return deviceProducts.filter((e) => productLabel(e).toLowerCase().includes(q)).slice(0, 10)
  })

  const nodeLabel = $derived(
    node.label ? (Array.isArray(node.label) ? node.label.join(' / ') : String(node.label)) : '',
  )

  /** Compact identity string for a NodeSpec. Falls back to device
   *  type when only kind+type are populated so generic nodes (no
   *  vendor / model) still read sensibly. Same shape as the helper
   *  in NodeContent.svelte's Content tab — kept inline to avoid a
   *  shared util just for two callsites. */
  function specSummary(spec: NodeSpec): string {
    if ('model' in spec) {
      const parts = [spec.vendor, spec.model].filter(Boolean).join(' / ')
      if (parts) return parts
    }
    if ('platform' in spec) {
      const parts = [spec.vendor, spec.platform].filter(Boolean).join(' / ')
      if (parts) return parts
    }
    if ('service' in spec) {
      const parts = [spec.vendor, spec.service, spec.resource].filter(Boolean).join(' / ')
      if (parts) return parts
    }
    return specDeviceType(spec) ?? spec.vendor ?? spec.kind
  }

  const subgraphOptions = $derived(
    [...subgraphs.entries()].map(([id, sg]) => ({ id, label: sg.label || id })),
  )

  const inputClass =
    'w-full text-[11px] px-2 py-1 bg-transparent border border-neutral-200 dark:border-neutral-700 rounded outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 text-neutral-800 dark:text-neutral-100 font-mono'

  const selectClass =
    'w-full text-[11px] px-2 py-1 bg-transparent border border-neutral-200 dark:border-neutral-700 rounded outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 text-neutral-800 dark:text-neutral-100 font-mono appearance-none cursor-pointer'

  const labelClass = 'text-[10px] font-medium text-neutral-400 dark:text-neutral-500'
  const valueClass = 'text-[11px] font-mono text-neutral-700 dark:text-neutral-200'

  const shapeOptions: { value: string; label: string }[] = [
    { value: 'rounded', label: 'Rounded' },
    { value: 'rect', label: 'Rectangle' },
    { value: 'circle', label: 'Circle' },
    { value: 'diamond', label: 'Diamond' },
    { value: 'hexagon', label: 'Hexagon' },
    { value: 'cylinder', label: 'Cylinder' },
    { value: 'stadium', label: 'Stadium' },
    { value: 'trapezoid', label: 'Trapezoid' },
  ]
</script>

<dl class="space-y-2.5">
  <!-- Label -->
  <div class="flex items-center justify-between">
    <dt class={labelClass}>Label</dt>
    <dd>
      {#if editing}
        <input
          type="text"
          class={inputClass}
          value={nodeLabel}
          placeholder="Label"
          onblur={(e) => onupdate?.('label', (e.target as HTMLInputElement).value)}
          onkeydown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
        >
      {:else}
        <span class={valueClass}>{nodeLabel || node.id}</span>
      {/if}
    </dd>
  </div>

  <!-- Shape -->
  <div class="flex items-center justify-between">
    <dt class={labelClass}>Shape</dt>
    <dd>
      {#if editing}
        <select
          class={selectClass}
          value={node.shape ?? 'rounded'}
          onchange={(e) => onupdate?.('shape', (e.target as HTMLSelectElement).value)}
        >
          {#each shapeOptions as opt}
            <option value={opt.value}>{opt.label}</option>
          {/each}
        </select>
      {:else}
        <span class={valueClass}>{node.shape ?? 'rounded'}</span>
      {/if}
    </dd>
  </div>

  <!-- Spec Binding -->
  <div class="flex items-center justify-between">
    <dt class={labelClass}>Spec</dt>
    <dd>
      {#if editing}
        <!-- Show the current binding (Product label) or generic spec
             summary above the Combobox so the user can tell at a
             glance what's already assigned — the Combobox itself is
             empty until typed into, which used to make the row look
             blank for generic nodes. -->
        {@const boundProductInList = node.productId
          ? products.find((p) => p.id === node.productId)
          : null}
        {#if boundProductInList}
          <div class="mb-1 text-[10px] font-mono text-neutral-500 dark:text-neutral-400">
            current: {productLabel(boundProductInList)}
          </div>
        {:else if node.spec}
          <div class="mb-1 text-[10px] font-mono text-neutral-500 dark:text-neutral-400">
            current: {specSummary(node.spec)} <span class="text-neutral-400">(generic)</span>
          </div>
        {/if}
        <Combobox.Root type="single" onValueChange={(v) => { if (v) onbindproduct?.(v) }}>
          <div class="relative">
            <Combobox.Input
              placeholder="Assign product..."
              class="w-full pl-2 pr-7 py-1 text-[11px] bg-transparent border border-neutral-200 dark:border-neutral-700 rounded outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 text-neutral-800 dark:text-neutral-100 font-mono"
              oninput={(e) => { comboSearchValue = (e.target as HTMLInputElement).value }}
            />
            <CaretUpDown
              class="absolute right-1 top-1/2 -translate-y-1/2 w-3 h-3 text-neutral-400"
            />
          </div>
          <Combobox.Content
            class="z-[70] mt-1 max-h-48 w-full overflow-auto rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 shadow-lg"
          >
            {#each comboResults as product}
              <Combobox.Item
                value={product.id}
                label={productLabel(product)}
                class="px-3 py-1.5 text-[11px] cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-700/50 data-[highlighted]:bg-neutral-50 dark:data-[highlighted]:bg-neutral-700/50"
              >
                <div class="font-medium text-neutral-800 dark:text-neutral-100">
                  {productLabel(product)}
                </div>
                <div class="text-[9px] font-mono text-neutral-400">
                  {product.spec.kind}
                  / {product.spec.vendor ?? ''}
                </div>
              </Combobox.Item>
            {/each}
          </Combobox.Content>
        </Combobox.Root>
      {:else}
        <span class={valueClass}> {node.spec ? specSummary(node.spec) : 'None'} </span>
      {/if}
    </dd>
  </div>

  <!-- Parent -->
  <div class="flex items-center justify-between">
    <dt class={labelClass}>Parent</dt>
    <dd>
      {#if editing}
        <select
          class={selectClass}
          value={node.parent ?? ''}
          onchange={(e) => onupdate?.('parent', (e.target as HTMLSelectElement).value || undefined)}
        >
          <option value="">None</option>
          {#each subgraphOptions as opt}
            <option value={opt.id}>{opt.label} ({opt.id})</option>
          {/each}
        </select>
      {:else}
        <span class={valueClass}>
          {#if node.parent}
            {subgraphs.get(node.parent)?.label ?? node.parent}
          {:else}
            None
          {/if}
        </span>
      {/if}
    </dd>
  </div>
</dl>
