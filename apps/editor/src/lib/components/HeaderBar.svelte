<script lang="ts">
  import { Tooltip } from 'bits-ui'
  import { ArrowClockwise, ArrowCounterClockwise } from 'phosphor-svelte'
  import { getActionContext } from '$lib/actions/context-provider.svelte'
  import { getAction, runAction } from '$lib/actions/registry'
  import { diagramState } from '$lib/context.svelte'

  // Toolbar surface for `edit.undo` / `edit.redo`. Reads everything
  // (label, shortcut display, enabled state) from the action
  // registry — no local copy of "is undo enabled" or the keyboard
  // handler. The global keyboard handler installed in
  // routes/+layout.svelte handles Mod+Z / Mod+Shift+Z.

  const undo = $derived(getAction('edit.undo'))
  const redo = $derived(getAction('edit.redo'))

  // Reactively derive enabled state. Both actions' enabled
  // predicates read `diagramState.canUndo` / `canRedo` (themselves
  // $derived-backed), so this re-fires on every undo / redo.
  const ctx = $derived(getActionContext())
  const undoEnabled = $derived(undo?.enabled?.(ctx) ?? true)
  const redoEnabled = $derived(redo?.enabled?.(ctx) ?? true)

  // The undo/redo *labels* on the buttons come from the action;
  // the tooltip adds the human label of the next undoable step
  // ("Undo: Move node") which is editor-state, not action-state.
  const undoLabel = $derived(diagramState.undoLabel)
  const redoLabel = $derived(diagramState.redoLabel)
</script>

<div
  class="flex items-center gap-1 rounded-xl border border-neutral-200 bg-white/90 p-1 shadow-lg backdrop-blur-sm dark:border-neutral-700 dark:bg-neutral-800/90"
>
  <Tooltip.Root>
    <Tooltip.Trigger>
      <button
        type="button"
        aria-label={undo?.label ?? 'Undo'}
        class="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-600 transition-colors hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent dark:text-neutral-300 dark:hover:bg-neutral-700"
        disabled={!undoEnabled}
        onclick={() => runAction('edit.undo', ctx)}
      >
        <ArrowCounterClockwise class="h-4 w-4" />
      </button>
    </Tooltip.Trigger>
    <Tooltip.Content
      side="bottom"
      class="rounded bg-neutral-800 px-2 py-1 text-xs text-white shadow-lg"
    >
      {undoLabel ? `Undo: ${undoLabel}` : (undo?.label ?? 'Undo')}
      {#if undo?.shortcut}
        ({undo.shortcut})
      {/if}
    </Tooltip.Content>
  </Tooltip.Root>

  <Tooltip.Root>
    <Tooltip.Trigger>
      <button
        type="button"
        aria-label={redo?.label ?? 'Redo'}
        class="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-600 transition-colors hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent dark:text-neutral-300 dark:hover:bg-neutral-700"
        disabled={!redoEnabled}
        onclick={() => runAction('edit.redo', ctx)}
      >
        <ArrowClockwise class="h-4 w-4" />
      </button>
    </Tooltip.Trigger>
    <Tooltip.Content
      side="bottom"
      class="rounded bg-neutral-800 px-2 py-1 text-xs text-white shadow-lg"
    >
      {redoLabel ? `Redo: ${redoLabel}` : (redo?.label ?? 'Redo')}
      {#if redo?.shortcut}
        ({redo.shortcut})
      {/if}
    </Tooltip.Content>
  </Tooltip.Root>
</div>
