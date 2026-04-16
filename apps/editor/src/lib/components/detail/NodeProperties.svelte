<script lang="ts">
  import type { Node, Subgraph } from '@shumoku/core'
  import { Combobox } from 'bits-ui'
  import { CaretUpDown } from 'phosphor-svelte'
  import type { SpecPaletteEntry } from '$lib/types'
  import { paletteEntryLabel } from '$lib/types'

  let {
    node,
    editing = false,
    palette = [],
    subgraphs = new Map(),
    onupdate,
    onbindpalette,
  }: {
    node: Node
    editing?: boolean
    palette?: SpecPaletteEntry[]
    subgraphs?: Map<string, Subgraph>
    onupdate?: (field: string, value: unknown) => void
    onbindpalette?: (paletteId: string) => void
  } = $props()

  let comboSearchValue = $state('')

  const comboResults = $derived.by(() => {
    if (!palette.length) return []
    if (!comboSearchValue.trim()) return palette.slice(0, 10)
    const q = comboSearchValue.toLowerCase()
    return palette.filter((e) => paletteEntryLabel(e).toLowerCase().includes(q)).slice(0, 10)
  })

  const nodeLabel = $derived(
    node.label ? (Array.isArray(node.label) ? node.label.join(' / ') : String(node.label)) : '',
  )

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
        <Combobox.Root type="single" onValueChange={(v) => { if (v) onbindpalette?.(v) }}>
          <div class="relative">
            <Combobox.Input
              placeholder="Assign spec..."
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
            {#each comboResults as palEntry}
              <Combobox.Item
                value={palEntry.id}
                label={paletteEntryLabel(palEntry)}
                class="px-3 py-1.5 text-[11px] cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-700/50 data-[highlighted]:bg-neutral-50 dark:data-[highlighted]:bg-neutral-700/50"
              >
                <div class="font-medium text-neutral-800 dark:text-neutral-100">
                  {paletteEntryLabel(palEntry)}
                </div>
                <div class="text-[9px] font-mono text-neutral-400">
                  {palEntry.spec.kind}
                  / {palEntry.spec.vendor ?? ''}
                </div>
              </Combobox.Item>
            {/each}
          </Combobox.Content>
        </Combobox.Root>
      {:else}
        <span class={valueClass}>
          {node.spec ? `${node.spec.kind} / ${node.spec.vendor ?? ''}` : 'None'}
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
