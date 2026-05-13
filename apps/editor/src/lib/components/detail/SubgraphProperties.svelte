<script lang="ts">
  import type { Subgraph } from '@shumoku/core'
  import SubgraphColorDialog from '../SubgraphColorDialog.svelte'

  let {
    subgraph,
    editing = false,
    onupdate,
  }: {
    subgraph: Subgraph
    editing?: boolean
    onupdate?: (field: string, value: unknown) => void
  } = $props()

  let colorDialogOpen = $state(false)

  // Map known accent / surface tokens to a representative preview
  // color for the swatch chip. Custom hex values render directly.
  const TOKEN_PREVIEW: Record<string, string> = {
    'accent-blue': '#bfdbfe',
    'accent-green': '#bbf7d0',
    'accent-red': '#fecdd3',
    'accent-amber': '#fcd34d',
    'accent-purple': '#e9d5ff',
    'surface-1': '#e2e8f0',
    'surface-2': '#cbd5e1',
    'surface-3': '#94a3b8',
  }

  const swatchColor = $derived.by(() => {
    const fill = subgraph.style?.fill
    if (!fill) return '#e2e8f0'
    if (fill.startsWith('#')) return fill
    return TOKEN_PREVIEW[fill] ?? '#e2e8f0'
  })

  const swatchLabel = $derived(subgraph.style?.fill ?? 'default')

  function pickColor(fill: string | undefined) {
    const nextStyle = { ...(subgraph.style ?? {}) }
    if (fill === undefined) delete nextStyle.fill
    else nextStyle.fill = fill
    onupdate?.('style', nextStyle)
  }

  const inputClass =
    'w-full text-[11px] px-2 py-1 bg-transparent border border-neutral-200 dark:border-neutral-700 rounded outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 text-neutral-800 dark:text-neutral-100 font-mono'

  const selectClass =
    'w-full text-[11px] px-2 py-1 bg-transparent border border-neutral-200 dark:border-neutral-700 rounded outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 text-neutral-800 dark:text-neutral-100 font-mono appearance-none cursor-pointer'

  const labelClass = 'text-[10px] font-medium text-neutral-400 dark:text-neutral-500'
  const valueClass = 'text-[11px] font-mono text-neutral-700 dark:text-neutral-200'

  const directionOptions: { value: string; label: string }[] = [
    { value: 'TB', label: 'TB (Top to Bottom)' },
    { value: 'BT', label: 'BT (Bottom to Top)' },
    { value: 'LR', label: 'LR (Left to Right)' },
    { value: 'RL', label: 'RL (Right to Left)' },
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
          value={subgraph.label ?? ''}
          placeholder="Group label"
          onblur={(e) => onupdate?.('label', (e.target as HTMLInputElement).value)}
          onkeydown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
        >
      {:else}
        <span class={valueClass}>{subgraph.label || subgraph.id}</span>
      {/if}
    </dd>
  </div>

  <!-- Direction -->
  <div class="flex items-center justify-between">
    <dt class={labelClass}>Direction</dt>
    <dd>
      {#if editing}
        <select
          class={selectClass}
          value={subgraph.direction ?? 'TB'}
          onchange={(e) => onupdate?.('direction', (e.target as HTMLSelectElement).value)}
        >
          {#each directionOptions as opt}
            <option value={opt.value}>{opt.label}</option>
          {/each}
        </select>
      {:else}
        <span class={valueClass}>{subgraph.direction ?? 'TB'}</span>
      {/if}
    </dd>
  </div>

  <!-- Color — the swatch itself is the affordance. Click to open the
       picker dialog in edit mode; in read mode it's a passive chip. -->
  <div class="flex items-center justify-between">
    <dt class={labelClass}>Color</dt>
    <dd class="flex items-center gap-2">
      {#if editing}
        <button
          type="button"
          class="block h-5 w-5 rounded border border-black/15 outline-none transition-shadow hover:ring-2 hover:ring-blue-300 focus:ring-2 focus:ring-blue-400"
          style="background-color: {swatchColor};"
          onclick={() => {
            colorDialogOpen = true
          }}
          title="Change color"
          aria-label="Change color"
        ></button>
      {:else}
        <span
          class="block h-5 w-5 rounded border border-black/15"
          style="background-color: {swatchColor};"
        ></span>
      {/if}
      <span class={valueClass}>{swatchLabel}</span>
    </dd>
  </div>
</dl>

<SubgraphColorDialog
  bind:open={colorDialogOpen}
  currentFill={subgraph.style?.fill ?? ''}
  onpick={pickColor}
/>
