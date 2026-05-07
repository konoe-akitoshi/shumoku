<script lang="ts">
  import { getActionContext } from '$lib/actions/context-provider.svelte'
  import { runAction, visibleActionsByGroup } from '$lib/actions/registry'
  import type { Action } from '$lib/actions/types'
  import {
    canvasMenuPosition,
    closeCanvasMenu,
    isCanvasMenuOpen,
  } from '$lib/state/canvas-menu.svelte'

  // Right-click menu on canvas surfaces. Reads its open/position
  // state and the action context from global slots so it can be
  // mounted once at the (canvas) layout level — pages just call
  // `openCanvasMenu(x, y)` from their right-click handler.

  const open = $derived(isCanvasMenuOpen())
  const pos = $derived(canvasMenuPosition())
  const ctx = $derived(getActionContext())

  const groups = $derived(open ? visibleActionsByGroup(ctx) : [])

  function isEnabled(a: Action): boolean {
    return a.enabled ? a.enabled(ctx) : true
  }

  async function pick(a: Action) {
    if (!isEnabled(a)) return
    closeCanvasMenu()
    await runAction(a.id, ctx)
  }

  function onkeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') closeCanvasMenu()
  }

  // Bind to the menu root so the close-on-outside-click handler
  // can tell "click inside menu" from "click on the page".
  let menuEl = $state<HTMLDivElement | null>(null)

  // Close on click outside. `capture: true` so we see the event
  // before the underlying canvas handlers (otherwise SVG / Svelte
  // Flow nodes' own pointerdown can swallow it). Inside-menu
  // clicks (button picks) are filtered by the target check —
  // closing on the click itself would race with the button's
  // pointerdown→click sequence and the click would never reach.
  function onWindowPointerDown(e: PointerEvent) {
    if (!open) return
    const t = e.target
    if (menuEl && t instanceof Node && menuEl.contains(t)) return
    closeCanvasMenu()
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
    bind:this={menuEl}
    class="fixed z-50 min-w-[200px] rounded-lg border border-neutral-200 bg-white py-1 text-sm shadow-lg dark:border-neutral-700 dark:bg-neutral-800"
    style="left: {pos.x}px; top: {pos.y}px"
    role="menu"
    tabindex="-1"
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
          {#if a.shortcut || a.shortcutHint}
            <span class="text-[10px] font-mono text-muted-foreground">
              {a.shortcut ?? a.shortcutHint}
            </span>
          {/if}
        </button>
      {/each}
    {/each}
  </div>
{/if}
