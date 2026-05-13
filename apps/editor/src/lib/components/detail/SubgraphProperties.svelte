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
  let swatchEl: HTMLButtonElement | null = $state(null)

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

  const currentFill = $derived(subgraph.style?.fill ?? '')

  const swatchColor = $derived.by(() => {
    if (!currentFill) return '#e2e8f0'
    if (currentFill.startsWith('#')) return currentFill
    return TOKEN_PREVIEW[currentFill] ?? '#e2e8f0'
  })

  const swatchLabel = $derived(currentFill || 'default')

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

  <!-- Color — wide chip showing the selected color as a horizontal
       bar with the token name overlaid. The whole bar is clickable
       and opens the popover picker. Always interactive. -->
  <div class="flex items-center justify-between">
    <dt class={labelClass}>Color</dt>
    <dd>
      <button
        bind:this={swatchEl}
        type="button"
        class="flex h-5 min-w-[8rem] items-center justify-end rounded border border-black/15 px-2 font-mono text-[10px] text-neutral-700 outline-none transition-shadow hover:ring-2 hover:ring-blue-300 focus:ring-2 focus:ring-blue-400 dark:text-neutral-200"
        style="background-color: {swatchColor};"
        onclick={() => {
          colorDialogOpen = !colorDialogOpen
        }}
        title="Change color"
        aria-label="Change color"
      >
        <span class="rounded bg-white/70 px-1 dark:bg-neutral-900/60">{swatchLabel}</span>
      </button>
    </dd>
  </div>
</dl>

<SubgraphColorDialog
  bind:open={colorDialogOpen}
  {currentFill}
  anchor={swatchEl}
  onpick={pickColor}
/>
