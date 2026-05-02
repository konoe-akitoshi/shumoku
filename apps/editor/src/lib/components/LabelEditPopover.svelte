<script lang="ts">
  import { diagramState } from '$lib/context.svelte'

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

  let inputEl: HTMLInputElement | null = $state(null)
  let value = $state(label)
  let highlight = $state(0)
  let committed = false

  // Pull catalog port-name suggestions for the node owning this port.
  // Reactive so the list updates if the node's spec changes mid-edit.
  // Look up nodeId via the resolved-ports map — port ids became opaque
  // ("port-<random>") in #124 so the previous "split on ':'" trick no
  // longer works.
  const nodeId = $derived(diagramState.ports.get(portId)?.nodeId ?? '')
  const suggestions = $derived(nodeId ? diagramState.getPortLabelSuggestions(nodeId) : [])

  // Filter against typed text. When the field still holds the original
  // label (initial state), we show the full list so the user can browse.
  const filtered = $derived.by(() => {
    const q = value.trim().toLowerCase()
    if (!q || q === label.toLowerCase()) return suggestions
    return suggestions.filter((s) => s.toLowerCase().includes(q))
  })

  $effect(() => {
    inputEl?.focus()
    inputEl?.select()
  })

  $effect(() => {
    if (highlight >= filtered.length) highlight = 0
  })

  function commit(next: string) {
    if (committed) return
    committed = true
    const trimmed = next.trim()
    if (trimmed !== label) oncommit?.(portId, trimmed)
    onclose?.()
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (filtered.length > 0) highlight = (highlight + 1) % filtered.length
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (filtered.length > 0) highlight = (highlight - 1 + filtered.length) % filtered.length
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const picked = filtered[highlight]
      if (picked && value === label) commit(picked)
      else commit(value)
    } else if (e.key === 'Escape') {
      onclose?.()
    }
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
    bind:value
    type="text"
    placeholder="port label"
    class="text-sm px-2 py-1 border border-blue-300 rounded outline-none focus:ring-2 focus:ring-blue-200 w-44 text-slate-900 dark:text-neutral-100 bg-white dark:bg-neutral-700"
    onkeydown={onKey}
    onblur={() => commit(value)}
  >
  {#if filtered.length > 0}
    <ul
      class="mt-1 w-44 max-h-48 overflow-auto rounded-md border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-sm"
    >
      {#each filtered as s, i}
        <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
        <li
          class="px-2 py-1 cursor-pointer font-mono text-slate-700 dark:text-neutral-200 {i ===
          highlight
            ? 'bg-blue-50 dark:bg-blue-900/30'
            : 'hover:bg-neutral-50 dark:hover:bg-neutral-700/50'}"
          onmouseenter={() => {
            highlight = i
          }}
          onmousedown={(e) => {
            // mousedown fires before input.blur() — pick the suggestion
            // here so blur-commit doesn't beat us to it.
            e.preventDefault()
            commit(s)
          }}
        >
          {s}
        </li>
      {/each}
    </ul>
  {/if}
</div>
