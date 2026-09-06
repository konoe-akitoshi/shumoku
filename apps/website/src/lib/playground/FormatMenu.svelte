<script lang="ts">
  import type { Format } from './export'

  let {
    label,
    disabled,
    onselect,
  }: { label: string; disabled: boolean; onselect: (format: Format) => void } = $props()
  let expanded = $state(false)
  const formats = [
    { format: 'svg', label: 'Vector' },
    { format: 'html', label: 'Interactive' },
    { format: 'png', label: 'Image' },
  ] as const
</script>
<svelte:window onkeydown={(event) => { if (event.key === 'Escape') expanded = false }} />
<div class="relative">
  <button
    type="button"
    {disabled}
    aria-expanded={expanded && !disabled}
    onclick={() => { expanded = !expanded }}
    class="rounded border border-neutral-300 bg-white px-4 py-2 text-sm font-medium disabled:opacity-50 dark:border-neutral-600 dark:bg-neutral-800"
  >
    {label}
    ▾
  </button>
  {#if expanded && !disabled}
    <button
      type="button"
      class="fixed inset-0 z-10 cursor-default"
      aria-label={`Close ${label}`}
      onclick={() => { expanded = false }}
    ></button>
    <div
      class="absolute right-0 top-full z-20 mt-1 w-40 rounded border border-neutral-200 bg-white shadow-lg dark:border-neutral-600 dark:bg-neutral-800"
      role="group"
      aria-label={label}
    >
      {#each formats as item}
        <button
          type="button"
          class="flex w-full gap-3 px-3 py-2 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-700"
          onclick={() => { expanded = false; onselect(item.format) }}
        >
          <span class="text-neutral-500">.{item.format}</span>{item.label}
        </button>
      {/each}
    </div>
  {/if}
</div>
