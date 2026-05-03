<script lang="ts">
  import { Tooltip } from 'bits-ui'
  import { ArrowClockwise, ArrowCounterClockwise } from 'phosphor-svelte'
  import { onDestroy, onMount } from 'svelte'
  import { diagramState } from '$lib/context.svelte'

  const canUndo = $derived(diagramState.canUndo)
  const canRedo = $derived(diagramState.canRedo)
  const undoLabel = $derived(diagramState.undoLabel)
  const redoLabel = $derived(diagramState.redoLabel)

  function isMac(): boolean {
    if (typeof navigator === 'undefined') return false
    return /mac/i.test(navigator.platform) || /mac/i.test(navigator.userAgent)
  }
  const modKey = $derived(isMac() ? '⌘' : 'Ctrl')

  function onKeydown(e: KeyboardEvent) {
    const target = e.target as HTMLElement | null
    // Don't hijack typing in inputs / textareas / contenteditable
    if (target && (/input|textarea|select/i.test(target.tagName) || target.isContentEditable)) {
      return
    }
    const mod = e.metaKey || e.ctrlKey
    if (!mod) return
    if (e.key === 'z' && !e.shiftKey) {
      e.preventDefault()
      diagramState.undo()
    } else if ((e.key === 'z' && e.shiftKey) || e.key === 'y') {
      e.preventDefault()
      diagramState.redo()
    }
  }

  // onDestroy runs on the SSR side too, so guard the window access.
  // onMount-only-on-client is fine but symmetry beats subtle bugs.
  onMount(() => {
    if (typeof window === 'undefined') return
    window.addEventListener('keydown', onKeydown)
  })
  onDestroy(() => {
    if (typeof window === 'undefined') return
    window.removeEventListener('keydown', onKeydown)
  })
</script>

<div
  class="flex items-center gap-1 rounded-xl border border-neutral-200 bg-white/90 p-1 shadow-lg backdrop-blur-sm dark:border-neutral-700 dark:bg-neutral-800/90"
>
  <Tooltip.Root>
    <Tooltip.Trigger>
      <button
        type="button"
        aria-label="Undo"
        class="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-600 transition-colors hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent dark:text-neutral-300 dark:hover:bg-neutral-700"
        disabled={!canUndo}
        onclick={() => diagramState.undo()}
      >
        <ArrowCounterClockwise class="h-4 w-4" />
      </button>
    </Tooltip.Trigger>
    <Tooltip.Content
      side="bottom"
      class="rounded bg-neutral-800 px-2 py-1 text-xs text-white shadow-lg"
    >
      {undoLabel ? `Undo: ${undoLabel}` : 'Undo'}
      ({modKey}+Z)
    </Tooltip.Content>
  </Tooltip.Root>

  <Tooltip.Root>
    <Tooltip.Trigger>
      <button
        type="button"
        aria-label="Redo"
        class="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-600 transition-colors hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent dark:text-neutral-300 dark:hover:bg-neutral-700"
        disabled={!canRedo}
        onclick={() => diagramState.redo()}
      >
        <ArrowClockwise class="h-4 w-4" />
      </button>
    </Tooltip.Trigger>
    <Tooltip.Content
      side="bottom"
      class="rounded bg-neutral-800 px-2 py-1 text-xs text-white shadow-lg"
    >
      {redoLabel ? `Redo: ${redoLabel}` : 'Redo'}
      ({modKey}+Shift+Z)
    </Tooltip.Content>
  </Tooltip.Root>
</div>
