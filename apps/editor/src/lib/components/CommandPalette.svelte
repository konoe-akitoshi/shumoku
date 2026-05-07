<script lang="ts">
  import { Dialog } from 'bits-ui'
  import { tick } from 'svelte'
  import { getActionContext } from '$lib/actions/context-provider.svelte'
  import { closePalette, isPaletteOpen } from '$lib/actions/palette.svelte'
  import { runAction, visibleActions } from '$lib/actions/registry'
  import type { Action } from '$lib/actions/types'

  // Cmd+K-style command palette. Renders into +layout.svelte so it
  // works on every page; consumes the action registry directly.
  // Filtering is plain case-insensitive substring on label —
  // fuzzy / scoring is a follow-up if it ever feels insufficient.

  const open = $derived(isPaletteOpen())

  let query = $state('')
  let highlight = $state(0)
  let inputEl = $state<HTMLInputElement | null>(null)

  // Re-derive on every open or query / context change so the list
  // reflects which actions are currently available + enabled.
  const filtered = $derived.by<Action[]>(() => {
    if (!open) return []
    const ctx = getActionContext()
    const q = query.trim().toLowerCase()
    const all = visibleActions(ctx)
    const matched = q ? all.filter((a) => a.label.toLowerCase().includes(q)) : all
    return matched.slice(0, 50)
  })

  // Reset state + focus the input each time the palette opens. The
  // `tick()` lets the dialog mount before we reach for inputEl.
  $effect(() => {
    if (!open) return
    query = ''
    highlight = 0
    void (async () => {
      await tick()
      inputEl?.focus()
    })()
  })

  $effect(() => {
    // Keep highlight in range when filtered shrinks.
    if (highlight >= filtered.length) highlight = Math.max(0, filtered.length - 1)
  })

  function pick(index: number) {
    const a = filtered[index]
    if (!a) return
    if (a.enabled && !a.enabled(getActionContext())) return
    closePalette()
    void runAction(a.id, getActionContext())
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      highlight = Math.min(highlight + 1, filtered.length - 1)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      highlight = Math.max(highlight - 1, 0)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      pick(highlight)
    }
    // Escape is handled by Dialog itself.
  }
</script>

<Dialog.Root {open} onOpenChange={(v) => (v ? null : closePalette())}>
  <Dialog.Portal>
    <Dialog.Overlay class="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px] dark:bg-black/50" />
    <Dialog.Content
      class="fixed left-1/2 top-[20%] z-50 w-[min(560px,90vw)] -translate-x-1/2 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-2xl focus:outline-none dark:border-neutral-700 dark:bg-neutral-900"
    >
      <Dialog.Title class="sr-only">Command palette</Dialog.Title>
      <Dialog.Description class="sr-only">
        Type to filter actions; arrow keys to navigate; Enter to run.
      </Dialog.Description>
      <input
        bind:this={inputEl}
        bind:value={query}
        onkeydown={onKeydown}
        placeholder="Search commands…"
        class="w-full border-b border-neutral-200 bg-transparent px-4 py-3 text-sm outline-none placeholder:text-neutral-400 dark:border-neutral-700"
        autocomplete="off"
        spellcheck="false"
      >
      <div class="max-h-[60vh] overflow-y-auto py-1">
        {#if filtered.length === 0}
          <div class="px-4 py-6 text-center text-xs text-neutral-500">No matching commands.</div>
        {:else}
          {#each filtered as a, i (a.id)}
            {@const enabled = a.enabled ? a.enabled(getActionContext()) : true}
            <!-- svelte-ignore a11y_mouse_events_have_key_events -->
            <button
              type="button"
              class="flex w-full items-center justify-between gap-4 px-4 py-2 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50"
              class:bg-neutral-100={i === highlight}
              class:dark:bg-neutral-800={i === highlight}
              disabled={!enabled}
              onmouseenter={() => (highlight = i)}
              onclick={() => pick(i)}
            >
              <span class="flex items-center gap-2.5 truncate">
                {#if a.icon}
                  <a.icon class="h-4 w-4 shrink-0 text-neutral-500" />
                {/if}
                <span class="truncate">{a.label}</span>
                {#if a.group}
                  <span class="text-[10px] uppercase tracking-wider text-neutral-400"
                    >{a.group}</span
                  >
                {/if}
              </span>
              {#if a.shortcut}
                <span class="font-mono text-[10px] text-neutral-400">{a.shortcut}</span>
              {/if}
            </button>
          {/each}
        {/if}
      </div>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
