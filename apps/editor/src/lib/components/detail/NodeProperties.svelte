<script lang="ts">
  import {
    DeviceType,
    type Node,
    type NodeSpec,
    type Subgraph,
    specDeviceType,
  } from '@shumoku/core'
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

  /** Role label for the Type row. Returns the device type when set
   *  (e.g. "router", "internet", "l3-switch"), otherwise the broader
   *  kind ("hardware", "compute", "service"). Intentionally drops
   *  vendor / model — those belong to the Product row. */
  function roleLabel(spec: NodeSpec | undefined): string {
    if (!spec) return 'None'
    return specDeviceType(spec) ?? spec.kind
  }

  // Hardware role options for the Type dropdown, derived directly
  // from the `DeviceType` enum so adding a new role in core
  // automatically surfaces it here without a second hardcoded list.
  // Used only when the node isn't bound to a Product — bound nodes
  // inherit their type from `Product.spec`.
  const hardwareTypeOptions: { value: DeviceType; label: string }[] = Object.values(DeviceType).map(
    (value) => ({
      value,
      // "l3-switch" → "L3 Switch", "access-point" → "Access Point"
      label: value
        .split('-')
        .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
        .join(' '),
    }),
  )

  function changeHardwareType(value: string) {
    const next: NodeSpec =
      node.spec && 'kind' in node.spec && node.spec.kind === 'hardware'
        ? { ...node.spec, type: value as DeviceType }
        : { kind: 'hardware', type: value as DeviceType }
    onupdate?.('spec', next)
  }

  // Reactive flags consumed by the Type row template. `@const` can't
  // sit at the top level of the markup tree in Svelte 5, so we
  // surface these as plain `$derived` values in the script.
  const isHardware = $derived(node.spec?.kind === 'hardware')
  const productBound = $derived(!!node.productId && products.some((p) => p.id === node.productId))

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

  <!-- Type — the node's role. When the node is bound to a Product
       the type is derived from `Product.spec` and is read-only;
       otherwise the user picks freely from the role palette. This
       mirrors the data flow: Product binding implies the spec,
       generic placeholders need a manual role choice. -->
  <div class="flex items-center justify-between">
    <dt class={labelClass}>Type</dt>
    <dd>
      {#if editing && isHardware && !productBound}
        <select
          class={selectClass}
          value={specDeviceType(node.spec) ?? DeviceType.Generic}
          onchange={(e) => changeHardwareType((e.target as HTMLSelectElement).value)}
        >
          {#each hardwareTypeOptions as opt}
            <option value={opt.value}>{opt.label}</option>
          {/each}
        </select>
      {:else}
        <span class={valueClass}>
          {roleLabel(node.spec)}
          {#if productBound}
            <span class="ml-1 text-[9px] text-neutral-400">(from Product)</span>
          {/if}
        </span>
      {/if}
    </dd>
  </div>

  <!-- Product binding — orthogonal to Spec. A node can have a Spec
       without a Product (typed placeholder like Internet / ONU) and
       a Product binding additionally specifies which procured item
       this node maps to in Materials / BOM. -->
  <div class="flex items-center justify-between">
    <dt class={labelClass}>Product</dt>
    <dd>
      {#if editing}
        {@const boundProductInList = node.productId
          ? products.find((p) => p.id === node.productId)
          : null}
        <Combobox.Root type="single" onValueChange={(v) => { if (v) onbindproduct?.(v) }}>
          <div class="relative">
            <Combobox.Input
              placeholder={boundProductInList ? '' : 'Assign product...'}
              defaultValue={boundProductInList ? productLabel(boundProductInList) : ''}
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
        {@const boundProductInList = node.productId
          ? products.find((p) => p.id === node.productId)
          : null}
        <span class={valueClass}>
          {boundProductInList ? productLabel(boundProductInList) : 'None'}
        </span>
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
