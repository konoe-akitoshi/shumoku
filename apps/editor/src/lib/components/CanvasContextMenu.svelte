<script lang="ts">
  import type { Snippet } from 'svelte'
  import { runAction, visibleActionsByGroup } from '$lib/actions/registry'
  import type { Action, ActionContext, SubmenuItem } from '$lib/actions/types'
  import * as ContextMenu from '$lib/components/ui/context-menu'

  // Canvas right-click menu. Wraps the canvas surface in
  // shadcn-svelte's ContextMenu (which delegates to bits-ui's
  // accessible Radix-style primitives). Empty-canvas right-click and
  // per-element right-click both bubble up to the Trigger; the
  // renderer's per-element handler is responsible for updating
  // `selected` before the event bubbles (so the menu sees the right
  // selection when it opens).
  //
  // Items come from the action registry: each action renders as a
  // `ContextMenu.Item`; actions with a `submenu(ctx)` callback
  // render as `ContextMenu.Sub` with a hover-revealed flyout.

  let {
    ctx,
    children,
  }: {
    ctx: ActionContext
    children: Snippet
  } = $props()

  let open = $state(false)

  // The shadcn ContextMenu owns positioning itself, so the only
  // thing we need to capture is the cursor — actions like
  // `edit.paste` still need the original right-click point. The
  // derived `openCtx` rebuilds whenever ctx or the cursor changes,
  // so action-gating (`enabled`, `submenu`) stays reactive without
  // a separate `$state` snapshot.
  let cursorPoint = $state<{ x: number; y: number } | null>(null)
  const openCtx = $derived<ActionContext>({
    ...ctx,
    canvasPos: cursorPoint ?? ctx.canvasPos,
  })

  // Trackpad two-finger right-clicks land both a `contextmenu`
  // (opens the menu at the cursor) and a `pointerup` (~60-100ms
  // later) in one fast gesture. If the pointerup happens to fall
  // on a freshly rendered menu item, bits-ui's MenuItem fires
  // `onSelect` via a synthesised click — the user activates an
  // item they never meant to (Delete being the worst case).
  // Known upstream bug: bits-ui #1955 (Radix React's MenuItem
  // tracks `isPointerDownRef` per-item to suppress this; bits-ui's
  // port omits the guard).
  //
  // Block at the event layer instead of gating pickAction by time:
  // while the menu is open, capture every `pointerup` on the way
  // down and swallow any with a non-zero button (right / middle
  // release) that lands inside the menu. bits-ui's pointerup
  // handler never runs, no synthesised click, no stray onSelect.
  // Deliberate left-click activations (button === 0) pass through
  // untouched, including fast clicks — no threshold to tune.
  // Keyboard activations don't involve pointerup so they're
  // unaffected.
  let strayGuardDetach: (() => void) | null = null
  function attachStrayGuard() {
    // Three layers of defence, all running at capture phase so
    // bits-ui's MenuItem handlers never see the event:
    //
    //   (a) `pointerup` with non-zero button inside the menu —
    //       the canonical stray (Kobalte's level of defence).
    //   (b) `auxclick` inside the menu — Chrome fires this on
    //       middle / right release; if bits-ui's onSelect path
    //       ever listens to it (or grows to), we're already
    //       covered.
    //   (c) The very next `click` after a `contextmenu` on the
    //       menu's subtree — covers Firefox's documented
    //       click-leak after right-release (bugzilla 990614) and
    //       any other browser that synthesises `click button=0`
    //       directly after the opening gesture.
    const inMenu = (target: EventTarget | null) =>
      !!(target as Element | null)?.closest('[role="menu"], [role="menuitem"]')

    let swallowNextClick = false

    const onPointerUp = (e: PointerEvent) => {
      if (e.button === 0 || !inMenu(e.target)) return
      e.stopImmediatePropagation()
      swallowNextClick = true
    }
    const onAuxClick = (e: MouseEvent) => {
      if (!inMenu(e.target)) return
      e.stopImmediatePropagation()
      swallowNextClick = true
    }
    const onContextMenu = (e: MouseEvent) => {
      if (!inMenu(e.target)) return
      swallowNextClick = true
    }
    const onClick = (e: MouseEvent) => {
      if (!swallowNextClick) return
      swallowNextClick = false
      if (!inMenu(e.target)) return
      e.stopImmediatePropagation()
    }

    document.addEventListener('pointerup', onPointerUp, { capture: true })
    document.addEventListener('auxclick', onAuxClick, { capture: true })
    document.addEventListener('contextmenu', onContextMenu, { capture: true })
    document.addEventListener('click', onClick, { capture: true })

    return () => {
      document.removeEventListener('pointerup', onPointerUp, { capture: true })
      document.removeEventListener('auxclick', onAuxClick, { capture: true })
      document.removeEventListener('contextmenu', onContextMenu, { capture: true })
      document.removeEventListener('click', onClick, { capture: true })
    }
  }

  function captureCursor(e: MouseEvent) {
    cursorPoint = { x: e.clientX, y: e.clientY }
  }

  const groups = $derived(open ? visibleActionsByGroup(openCtx) : [])

  function isEnabled(a: Action): boolean {
    return a.enabled ? a.enabled(openCtx) : true
  }

  async function pickAction(a: Action) {
    if (a.submenu) return
    await runAction(a.id, openCtx)
  }

  async function pickItem(item: SubmenuItem) {
    if (item.enabled === false) return
    await item.pick(openCtx)
  }
</script>

<ContextMenu.Root
  bind:open
  onOpenChange={(o) => { strayGuardDetach?.(); strayGuardDetach = o ? attachStrayGuard() : null }}
>
  <ContextMenu.Trigger oncontextmenu={captureCursor} class="block h-full w-full">
    {@render children()}
  </ContextMenu.Trigger>
  <ContextMenu.Content class="min-w-[220px]">
    {#each groups as [ group, items ], i (group)}
      {#if i > 0}
        <ContextMenu.Separator />
      {/if}
      {#each items as a (a.id)}
        {@const enabled = isEnabled(a)}
        {#if a.submenu}
          {@const subItems = a.submenu(openCtx)}
          <ContextMenu.Sub>
            <ContextMenu.SubTrigger disabled={!enabled}>
              {#if a.icon}
                <a.icon class="h-4 w-4 text-muted-foreground" />
              {/if}
              <span>{a.label}</span>
            </ContextMenu.SubTrigger>
            <ContextMenu.SubContent class="min-w-[180px]">
              {#each subItems as item (item.id)}
                <ContextMenu.Item disabled={item.enabled === false} onSelect={() => pickItem(item)}>
                  <span class:italic={item.muted} class:text-muted-foreground={item.muted}>
                    {item.label}
                  </span>
                </ContextMenu.Item>
              {/each}
            </ContextMenu.SubContent>
          </ContextMenu.Sub>
        {:else}
          <ContextMenu.Item disabled={!enabled} onSelect={() => pickAction(a)}>
            {#if a.icon}
              <a.icon class="h-4 w-4 text-muted-foreground" />
            {/if}
            <span>{a.label}</span>
            {#if a.shortcut || a.shortcutHint}
              <ContextMenu.Shortcut>{a.shortcut ?? a.shortcutHint}</ContextMenu.Shortcut>
            {/if}
          </ContextMenu.Item>
        {/if}
      {/each}
    {/each}
  </ContextMenu.Content>
</ContextMenu.Root>
