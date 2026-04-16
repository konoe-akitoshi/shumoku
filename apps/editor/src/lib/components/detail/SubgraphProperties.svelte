<script lang="ts">
  import type { Subgraph } from '@shumoku/core'

  let {
    subgraph,
    editing = false,
    onupdate,
  }: {
    subgraph: Subgraph
    editing?: boolean
    onupdate?: (field: string, value: unknown) => void
  } = $props()

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
</dl>
