<script lang="ts">
  import { runAction, visibleActionsByGroup } from '$lib/actions/registry'
  import type { Action, ActionContext } from '$lib/actions/types'

  // Right-click menu on canvas surfaces. Renders whatever actions
  // the registry exposes for the given context, grouped by their
  // `group` field. Surfaces choose what `ctx` to pass (selection,
  // canvas position, mode, camera handle).

  let {
    open = $bindable(false),
    x = 0,
    y = 0,
    ctx,
  }: {
    open: boolean
    x: number
    y: number
    ctx: ActionContext
  } = $props()

  const groups = $derived(open ? visibleActionsByGroup(ctx) : [])

  function isEnabled(a: Action): boolean {
    return a.enabled ? a.enabled(ctx) : true
  }

  async function pick(a: Action) {
    if (!isEnabled(a)) return
    open = false
    await runAction(a.id, ctx)
  }

  function onkeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      open = false
    }
  }

  // Close on any click outside the menu surface (the menu's own
  // pointer events stop propagation below).
  function onWindowPointerDown() {
    if (open) open = false
  }

  $effect(() => {
    if (!open) return
    window.addEventListener('pointerdown', onWindowPointerDown, { capture: true })
    window.addEventListener('keydown', onkeydown)
    return () => {
      window.removeEventListener('pointerdown', onWindowPointerDown, { capture: true })
      window.removeEventListener('keydown', onkeydown)
    }
  })
</script>

{#if open}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="fixed z-50 min-w-[200px] rounded-lg border border-neutral-200 bg-white py-1 text-sm shadow-lg dark:border-neutral-700 dark:bg-neutral-800"
    style="left: {x}px; top: {y}px"
    role="menu"
    tabindex="-1"
    onpointerdown={(e) => e.stopPropagation()}
  >
    {#each groups as [ group, items ], i (group)}
      {#if i > 0}
        <div class="my-1 h-px bg-neutral-200 dark:bg-neutral-700"></div>
      {/if}
      {#each items as a (a.id)}
        {@const enabled = isEnabled(a)}
        <button
          type="button"
          class="flex w-full items-center justify-between gap-4 px-3 py-1.5 text-left transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent dark:disabled:hover:bg-transparent"
          disabled={!enabled}
          onclick={() => pick(a)}
        >
          <span class="flex items-center gap-2">
            {#if a.icon}
              <a.icon class="h-4 w-4 text-neutral-500" />
            {/if}
            {a.label}
          </span>
          {#if a.shortcut}
            <span class="text-[10px] font-mono text-muted-foreground">{a.shortcut}</span>
          {/if}
        </button>
      {/each}
    {/each}
  </div>
{/if}
