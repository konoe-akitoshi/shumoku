<script lang="ts">
  import { runAction, visibleActionsByGroup } from '$lib/actions/registry'
  import type { Action, ActionContext, SubmenuItem } from '$lib/actions/types'

  // Right-click menu on canvas surfaces. Renders whatever actions
  // the registry exposes for the given context, grouped by their
  // `group` field. Surfaces choose what `ctx` to pass (selection,
  // canvas position, mode, camera handle).
  //
  // Submenu support: actions with a `submenu(ctx)` callback render
  // as a parent with a `›` indicator. Hovering (or focusing) the
  // parent reveals a flyout on the right that lists the returned
  // SubmenuItem[]. Items handle their own `pick`; the parent's
  // own `run` is unused on this surface.

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

  // Which submenu parent (if any) is currently expanded. Hovering
  // a parent expands it; hovering away collapses it. Using the
  // action id rather than a boolean lets the flyout switch cleanly
  // when the user moves between two adjacent parents.
  let activeSubmenu = $state<string | null>(null)

  // Snapshot the ctx used to compute submenu items at the moment
  // the parent expanded, so closing the menu (which re-derives
  // ctx.canvasPos) doesn't strip canvasPos out of the submenu's
  // pick callback. The submenu items already capture nodeId via
  // closure in builtin.ts, so this is mostly belt-and-braces for
  // future submenu actions.
  let activeCtx = $state<ActionContext | null>(null)
  const activeItems = $derived.by<SubmenuItem[]>(() => {
    if (!activeSubmenu || !activeCtx) return []
    const parent = groups.flatMap(([, items]) => items).find((a) => a.id === activeSubmenu)
    return parent?.submenu ? parent.submenu(activeCtx) : []
  })

  async function pick(a: Action) {
    if (!isEnabled(a)) return
    if (a.submenu) return // parent — handled by hover, not click
    // Snapshot canvasPos before closing — setting `open = false`
    // causes the parent's reactive ctx to re-derive with
    // canvasPos=undefined (canvasMenuOpen flips), and that re-read
    // lands at the action call site. Paste anchors follow-up UI
    // to the right-click position; it needs this value preserved
    // across the close.
    const ctxAtPick: ActionContext = {
      ...ctx,
      canvasPos: ctx.canvasPos ? { ...ctx.canvasPos } : undefined,
    }
    open = false
    await runAction(a.id, ctxAtPick)
  }

  async function pickSubmenuItem(item: SubmenuItem) {
    if (item.enabled === false) return
    const snapshotCtx = activeCtx
      ? { ...activeCtx, canvasPos: activeCtx.canvasPos ? { ...activeCtx.canvasPos } : undefined }
      : ctx
    open = false
    activeSubmenu = null
    activeCtx = null
    await item.pick(snapshotCtx)
  }

  function expandSubmenu(a: Action) {
    if (!a.submenu || !isEnabled(a)) return
    activeSubmenu = a.id
    activeCtx = {
      ...ctx,
      canvasPos: ctx.canvasPos ? { ...ctx.canvasPos } : undefined,
    }
  }

  function collapseSubmenu(a: Action) {
    if (activeSubmenu === a.id) {
      activeSubmenu = null
      activeCtx = null
    }
  }

  function onkeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      open = false
      activeSubmenu = null
      activeCtx = null
    }
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
    open = false
    activeSubmenu = null
    activeCtx = null
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
    style="left: {x}px; top: {y}px"
    role="menu"
    tabindex="-1"
  >
    {#each groups as [ group, items ], i (group)}
      {#if i > 0}
        <div class="my-1 h-px bg-neutral-200 dark:bg-neutral-700"></div>
      {/if}
      {#each items as a (a.id)}
        {@const enabled = isEnabled(a)}
        {#if a.submenu}
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div
            class="relative"
            onpointerenter={() => expandSubmenu(a)}
            onpointerleave={() => collapseSubmenu(a)}
          >
            <button
              type="button"
              class="flex w-full items-center justify-between gap-4 px-3 py-1.5 text-left transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent dark:disabled:hover:bg-transparent"
              disabled={!enabled}
              onfocus={() => expandSubmenu(a)}
              onblur={() => collapseSubmenu(a)}
            >
              <span class="flex items-center gap-2">
                {#if a.icon}
                  <a.icon class="h-4 w-4 text-neutral-500" />
                {/if}
                {a.label}
              </span>
              <span class="text-neutral-400">›</span>
            </button>
            {#if activeSubmenu === a.id && activeItems.length > 0}
              <div
                class="absolute left-full top-0 ml-1 min-w-[180px] rounded-lg border border-neutral-200 bg-white py-1 text-sm shadow-lg dark:border-neutral-700 dark:bg-neutral-800"
                role="menu"
              >
                {#each activeItems as item (item.id)}
                  <button
                    type="button"
                    class="flex w-full items-center px-3 py-1.5 text-left transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent dark:disabled:hover:bg-transparent"
                    disabled={item.enabled === false}
                    onclick={() => pickSubmenuItem(item)}
                  >
                    <span
                      class="truncate"
                      class:italic={item.muted}
                      class:text-slate-500={item.muted}
                      class:dark:text-neutral-400={item.muted}
                    >
                      {item.label}
                    </span>
                  </button>
                {/each}
              </div>
            {/if}
          </div>
        {:else}
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
        {/if}
      {/each}
    {/each}
  </div>
{/if}
