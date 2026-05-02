<script lang="ts">
  import { DropdownMenu, Tooltip } from 'bits-ui'
  import { Eye, EyeSlash, Moon, Pencil, Plus, Ruler, Sun } from 'phosphor-svelte'
  import { diagramState, editorState } from '$lib/context.svelte'
  import { productLabel } from '$lib/types'
  import { sceneAuthoring } from './scene-authoring.svelte'

  let {
    sceneId,
  }: {
    sceneId: string
  } = $props()

  const scene = $derived(diagramState.scenes.find((s) => s.id === sceneId))
  const deviceProducts = $derived(diagramState.products.filter((p) => p.kind === 'device'))
  const editing = $derived(editorState.mode === 'edit')
  const isDark = $derived(editorState.isDark)
  const hiddenCount = $derived(
    (scene?.hiddenNodeIds?.length ?? 0) + (scene?.hiddenLinkIds?.length ?? 0),
  )
  const calibration = $derived(scene?.calibration)

  function unhideAll() {
    if (!scene) return
    for (const id of scene.hiddenNodeIds ?? []) diagramState.unhideNodeInScene(scene.id, id)
    for (const id of scene.hiddenLinkIds ?? []) diagramState.unhideLinkInScene(scene.id, id)
  }

  function clearCalibration() {
    if (!scene) return
    diagramState.updateScene(scene.id, { calibration: undefined })
  }
</script>

<div
  class="flex flex-col gap-1.5 rounded-xl border border-neutral-200 bg-white/90 p-1.5 shadow-lg backdrop-blur-sm transition-all duration-200 dark:border-neutral-700 dark:bg-neutral-800/90"
>
  {#if editing}
    <!-- Place (item / product) -->
    <DropdownMenu.Root>
      <Tooltip.Root>
        <Tooltip.Trigger>
          <DropdownMenu.Trigger>
            {#snippet child({ props })}
              <button
                type="button"
                class="flex h-9 w-9 items-center justify-center rounded-lg text-neutral-600 transition-colors hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-700"
                {...props}
              >
                <div class="relative"><Plus class="h-4.5 w-4.5" /></div>
              </button>
            {/snippet}
          </DropdownMenu.Trigger>
        </Tooltip.Trigger>
        <Tooltip.Content
          side="left"
          class="rounded bg-neutral-800 px-2 py-1 text-xs text-white shadow-lg"
        >
          Place item
        </Tooltip.Content>
      </Tooltip.Root>
      <DropdownMenu.Content
        side="left"
        sideOffset={8}
        class="z-50 min-w-[220px] rounded-lg border border-neutral-200 bg-white p-1 shadow-lg dark:border-neutral-700 dark:bg-neutral-800"
      >
        <DropdownMenu.Item
          class="cursor-pointer rounded-md px-2 py-1.5 text-xs text-neutral-700 hover:bg-neutral-100 data-[highlighted]:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-700 dark:data-[highlighted]:bg-neutral-700/60"
          onclick={() => {
            sceneAuthoring.pendingPlacement = { kind: 'empty' }
          }}
        >
          Empty node
        </DropdownMenu.Item>
        {#if deviceProducts.length > 0}
          <div class="my-1 border-t border-neutral-200 dark:border-neutral-700"></div>
          <div
            class="px-2 pt-1 pb-0.5 text-[9px] font-medium tracking-wider text-muted-foreground uppercase"
          >
            Products
          </div>
          {#each deviceProducts as product (product.id)}
            <DropdownMenu.Item
              class="cursor-pointer rounded-md px-2 py-1.5 text-xs text-neutral-700 hover:bg-neutral-100 data-[highlighted]:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-700 dark:data-[highlighted]:bg-neutral-700/60"
              onclick={() => {
                sceneAuthoring.pendingPlacement = { kind: 'product', productId: product.id }
              }}
            >
              <span class="block max-w-[260px] truncate">{productLabel(product)}</span>
            </DropdownMenu.Item>
          {/each}
        {/if}
      </DropdownMenu.Content>
    </DropdownMenu.Root>

    <!-- Calibrate / re-calibrate / clear -->
    <Tooltip.Root>
      <Tooltip.Trigger>
        <button
          type="button"
          class="relative flex h-9 w-9 items-center justify-center rounded-lg text-neutral-600 transition-colors hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-700"
          onclick={() => sceneAuthoring.startCalibration()}
        >
          <Ruler class="h-4.5 w-4.5" />
          {#if calibration}
            <span
              class="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-amber-500"
              aria-hidden="true"
            ></span>
          {/if}
        </button>
      </Tooltip.Trigger>
      <Tooltip.Content
        side="left"
        class="rounded bg-neutral-800 px-2 py-1 text-xs text-white shadow-lg"
      >
        {calibration
          ? `Re-calibrate (now ${calibration.pxPerMeter.toFixed(1)} px/m)`
          : 'Calibrate scale'}
      </Tooltip.Content>
    </Tooltip.Root>

    {#if calibration}
      <Tooltip.Root>
        <Tooltip.Trigger>
          <button
            type="button"
            class="flex h-6 w-9 items-center justify-center rounded-md text-[10px] text-muted-foreground hover:bg-neutral-100 dark:hover:bg-neutral-700"
            onclick={clearCalibration}
          >
            clear
          </button>
        </Tooltip.Trigger>
        <Tooltip.Content
          side="left"
          class="rounded bg-neutral-800 px-2 py-1 text-xs text-white shadow-lg"
        >
          Clear calibration
        </Tooltip.Content>
      </Tooltip.Root>
    {/if}

    {#if hiddenCount > 0}
      <Tooltip.Root>
        <Tooltip.Trigger>
          <button
            type="button"
            class="flex h-9 w-9 items-center justify-center rounded-lg text-neutral-600 transition-colors hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-700"
            onclick={unhideAll}
          >
            <EyeSlash class="h-4.5 w-4.5" />
          </button>
        </Tooltip.Trigger>
        <Tooltip.Content
          side="left"
          class="rounded bg-neutral-800 px-2 py-1 text-xs text-white shadow-lg"
        >
          Show {hiddenCount} hidden
        </Tooltip.Content>
      </Tooltip.Root>
    {/if}

    <div class="my-0.5 border-t border-neutral-200 dark:border-neutral-700"></div>
  {/if}

  <!-- Edit/View toggle (always visible) -->
  <Tooltip.Root>
    <Tooltip.Trigger>
      <button
        type="button"
        class="flex h-9 w-9 items-center justify-center rounded-lg transition-colors {editing
          ? 'bg-blue-500 text-white shadow-sm'
          : 'text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-700'}"
        onclick={() => (editorState.mode = editing ? 'view' : 'edit')}
      >
        {#if editing}
          <Eye class="h-4.5 w-4.5" weight="bold" />
        {:else}
          <Pencil class="h-4.5 w-4.5" />
        {/if}
      </button>
    </Tooltip.Trigger>
    <Tooltip.Content
      side="left"
      class="rounded bg-neutral-800 px-2 py-1 text-xs text-white shadow-lg"
    >
      {editing ? 'Switch to View mode' : 'Switch to Edit mode'}
    </Tooltip.Content>
  </Tooltip.Root>

  <!-- Theme toggle -->
  <Tooltip.Root>
    <Tooltip.Trigger>
      <button
        type="button"
        class="flex h-9 w-9 items-center justify-center rounded-lg text-neutral-500 transition-colors hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-700"
        onclick={() => editorState.toggleTheme()}
      >
        {#if isDark}
          <Sun class="h-4.5 w-4.5" />
        {:else}
          <Moon class="h-4.5 w-4.5" />
        {/if}
      </button>
    </Tooltip.Trigger>
    <Tooltip.Content
      side="left"
      class="rounded bg-neutral-800 px-2 py-1 text-xs text-white shadow-lg"
    >
      {isDark ? 'Light mode' : 'Dark mode'}
    </Tooltip.Content>
  </Tooltip.Root>
</div>
