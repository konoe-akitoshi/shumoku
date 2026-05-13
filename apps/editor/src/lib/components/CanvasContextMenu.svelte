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

<ContextMenu.Root bind:open>
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
