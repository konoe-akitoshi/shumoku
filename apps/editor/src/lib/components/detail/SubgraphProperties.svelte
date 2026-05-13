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
  let moreEl: HTMLButtonElement | null = $state(null)

  // Theme palette rendered inline in the Color row. Token id is what
  // gets stored; preview is the light-mode hex shown on the chip.
  // Keep in sync with SubgraphColorDialog.svelte and the theme files.
  const PALETTE = [
    { token: 'accent-blue', label: 'Blue', preview: '#bfdbfe' },
    { token: 'accent-green', label: 'Green', preview: '#bbf7d0' },
    { token: 'accent-red', label: 'Red', preview: '#fecdd3' },
    { token: 'accent-amber', label: 'Amber', preview: '#fcd34d' },
    { token: 'accent-purple', label: 'Purple', preview: '#e9d5ff' },
    { token: 'surface-1', label: 'Neutral 1', preview: '#e2e8f0' },
    { token: 'surface-2', label: 'Neutral 2', preview: '#cbd5e1' },
    { token: 'surface-3', label: 'Neutral 3', preview: '#94a3b8' },
  ] as const

  const currentFill = $derived(subgraph.style?.fill ?? '')

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

  <!-- Color — inline palette. Each swatch is a one-click set. A
       small "…" button at the end opens the popover for custom hex
       or clear. Always interactive (no edit-mode gate). -->
  <div class="flex items-center justify-between">
    <dt class={labelClass}>Color</dt>
    <dd class="flex items-center gap-1">
      {#each PALETTE as opt (opt.token)}
        {@const selected = currentFill === opt.token}
        <button
          type="button"
          class="block h-4 w-4 rounded-sm border border-black/15 outline-none transition-shadow hover:ring-2 hover:ring-blue-300"
          class:ring-2={selected}
          class:ring-foreground={selected}
          style="background-color: {opt.preview};"
          onclick={() => pickColor(opt.token)}
          title={opt.label}
          aria-label={opt.label}
        ></button>
      {/each}
      <button
        bind:this={moreEl}
        type="button"
        class="ml-0.5 flex h-4 w-4 items-center justify-center rounded-sm border border-black/15 text-[10px] leading-none text-muted-foreground hover:bg-muted hover:text-foreground"
        onclick={() => {
          colorDialogOpen = !colorDialogOpen
        }}
        title="Custom color"
        aria-label="Custom color"
      >
        …
      </button>
    </dd>
  </div>
</dl>

<SubgraphColorDialog bind:open={colorDialogOpen} {currentFill} anchor={moreEl} onpick={pickColor} />
