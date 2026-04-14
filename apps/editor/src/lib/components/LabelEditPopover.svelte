<script lang="ts">
  let {
    portId,
    label,
    x,
    y,
    oncommit,
    onclose,
  }: {
    portId: string
    label: string
    x: number
    y: number
    oncommit?: (portId: string, value: string) => void
    onclose?: () => void
  } = $props()

  let inputEl: HTMLInputElement | undefined = $state()

  $effect(() => {
    inputEl?.focus()
  })

  function commit(value: string) {
    const trimmed = value.trim()
    if (trimmed && trimmed !== label) {
      oncommit?.(portId, trimmed)
    }
    onclose?.()
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div class="fixed inset-0 z-40" onclick={() => onclose?.()}></div>
<div
  class="fixed z-50 bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-600 rounded-lg shadow-lg p-2"
  style="top: {y - 10}px; left: {x - 4}px;"
>
  <input
    bind:this={inputEl}
    type="text"
    value={label}
    class="text-sm px-2 py-1 border border-blue-300 rounded outline-none focus:ring-2 focus:ring-blue-200 w-32 text-slate-900 dark:text-neutral-100 bg-white dark:bg-neutral-700"
    onkeydown={(e) => {
      if (e.key === 'Enter') commit((e.target as HTMLInputElement).value)
      if (e.key === 'Escape') onclose?.()
    }}
    onblur={(e) => commit((e.target as HTMLInputElement).value)}
  >
</div>
