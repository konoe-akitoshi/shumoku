<script lang="ts">
  import { newId } from '@shumoku/core'
  import { Dialog, DropdownMenu } from 'bits-ui'
  import { CaretDown, Graph, ImageSquare, MapPin, Plus, Trash, X } from 'phosphor-svelte'
  import { Button } from '$lib/components/ui/button'
  import { diagramState } from '$lib/context.svelte'
  import { isPhysicalSubgraph } from '$lib/scene/scope'

  // Unified picker that replaces SheetBar (hierarchy drill-down) and
  // SceneBar (presentation views). The natural mental model after
  // binding scenes to subgraphs is "pick a hierarchy level, then pick
  // logical-or-one-of-its-physical-realizations" — so one dropdown
  // covers both axes.

  let addOpen = $state(false)
  let newName = $state('')
  let pendingBg = $state<{ src: string; width: number; height: number } | null>(null)
  let uploadError = $state<string | null>(null)
  let pendingScope = $state<string | undefined>(undefined)

  const scenes = $derived(diagramState.scenes)
  const currentSceneId = $derived(diagramState.currentSceneId)
  const currentSheetId = $derived(diagramState.currentSheetId)
  const currentScene = $derived(diagramState.currentScene)
  const subgraphs = $derived([...diagramState.subgraphs.values()])
  const topLevelSubgraphs = $derived(subgraphs.filter((sg) => !sg.parent))

  const triggerLabel = $derived.by(() => {
    if (currentSceneId && currentScene) {
      const scope = currentScene.scopeSubgraphId
      const parentLabel = scope ? (subgraphs.find((sg) => sg.id === scope)?.label ?? 'Root') : null
      return parentLabel ? `${parentLabel} / ${currentScene.name}` : currentScene.name
    }
    if (currentSheetId !== null) {
      const sg = subgraphs.find((s) => s.id === currentSheetId)
      return sg?.label ?? 'Sheet'
    }
    return 'Diagram (root)'
  })

  function loadImageDimensions(src: string): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
      img.onerror = () => reject(new Error('Failed to load image'))
      img.src = src
    })
  }

  async function handleUpload(e: Event) {
    uploadError = null
    const input = e.target as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result ?? ''))
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(file)
    })
    try {
      const dim = await loadImageDimensions(dataUrl)
      pendingBg = { src: dataUrl, ...dim }
      if (!newName) newName = file.name.replace(/\.[^.]+$/, '')
    } catch (err) {
      uploadError = err instanceof Error ? err.message : String(err)
    }
    input.value = ''
  }

  function openAddDialog(scope: string | undefined) {
    addOpen = true
    newName = ''
    pendingBg = null
    uploadError = null
    pendingScope = scope
  }

  function commitAdd() {
    const name = newName.trim() || 'Untitled scene'
    const id = newId('scene')
    diagramState.addScene({
      id,
      name,
      background: pendingBg ?? undefined,
      nodePlacements: [],
      wireRoutes: [],
      scopeSubgraphId: pendingScope,
    })
    diagramState.setCurrentScene(id)
    addOpen = false
  }

  function selectDiagram() {
    diagramState.setCurrentScene(null)
    diagramState.switchSheet(null)
  }

  function selectSheet(sheetId: string) {
    diagramState.setCurrentScene(null)
    diagramState.switchSheet(sheetId)
  }

  function selectScene(sceneId: string) {
    diagramState.setCurrentScene(sceneId)
  }

  function deleteScene(id: string) {
    diagramState.removeScene(id)
  }

  function scenesForScope(scopeId: string | undefined) {
    return scenes.filter((s) => s.scopeSubgraphId === scopeId)
  }

  const rootScopeScenes = $derived(scenesForScope(undefined))
</script>

<DropdownMenu.Root>
  <DropdownMenu.Trigger>
    {#snippet child({ props })}
      <button
        type="button"
        class="flex items-center gap-1.5 rounded-xl border border-neutral-200 bg-white/90 px-3 py-1.5 text-xs font-medium text-neutral-700 shadow-lg backdrop-blur-sm hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800/90 dark:text-neutral-200 dark:hover:bg-neutral-700/60"
        title="View"
        {...props}
      >
        {#if currentSceneId}
          <MapPin class="h-3.5 w-3.5 text-amber-500" />
        {:else}
          <Graph class="h-3.5 w-3.5 text-neutral-500" />
        {/if}
        <span class="max-w-[260px] truncate">{triggerLabel}</span>
        <CaretDown class="h-3 w-3 text-neutral-400" />
      </button>
    {/snippet}
  </DropdownMenu.Trigger>
  <DropdownMenu.Content
    align="center"
    sideOffset={6}
    class="z-50 min-w-[280px] rounded-lg border border-neutral-200 bg-white p-1 shadow-lg dark:border-neutral-700 dark:bg-neutral-800"
  >
    <!-- Root: Diagram + root-scoped scenes -->
    <div
      class="px-2 pt-1 pb-0.5 text-[9px] font-medium tracking-wider text-muted-foreground uppercase"
    >
      Root
    </div>
    <DropdownMenu.Item
      class="cursor-pointer rounded-md px-2 py-1.5 text-xs hover:bg-neutral-100 data-[highlighted]:bg-neutral-100 dark:hover:bg-neutral-700 dark:data-[highlighted]:bg-neutral-700/60 {currentSceneId ===
        null && currentSheetId === null
        ? 'font-semibold text-blue-700 dark:text-blue-300'
        : 'text-neutral-700 dark:text-neutral-200'}"
      onclick={selectDiagram}
    >
      <span class="flex items-center gap-1.5">
        <Graph class="h-3 w-3" />
        Diagram (logical)
      </span>
    </DropdownMenu.Item>
    {#each rootScopeScenes as scene (scene.id)}
      {@const isActive = scene.id === currentSceneId}
      <div class="flex items-center gap-1">
        <DropdownMenu.Item
          class="flex-1 cursor-pointer rounded-md px-2 py-1.5 pl-5 text-xs hover:bg-neutral-100 data-[highlighted]:bg-neutral-100 dark:hover:bg-neutral-700 dark:data-[highlighted]:bg-neutral-700/60 {isActive
            ? 'font-semibold text-blue-700 dark:text-blue-300'
            : 'text-neutral-700 dark:text-neutral-200'}"
          onclick={() => selectScene(scene.id)}
        >
          <span class="flex items-center gap-1.5">
            <MapPin class="h-3 w-3 text-amber-500" />
            <span class="block truncate">{scene.name}</span>
          </span>
        </DropdownMenu.Item>
        <button
          type="button"
          aria-label="Delete scene"
          class="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-rose-600 dark:hover:bg-neutral-700"
          onclick={(e) => {
            e.stopPropagation()
            deleteScene(scene.id)
          }}
        >
          <Trash class="h-3 w-3" />
        </button>
      </div>
    {/each}
    <DropdownMenu.Item
      class="cursor-pointer rounded-md px-2 py-1.5 pl-5 text-xs text-muted-foreground hover:bg-neutral-100 data-[highlighted]:bg-neutral-100 dark:hover:bg-neutral-700 dark:data-[highlighted]:bg-neutral-700/60"
      onclick={() => openAddDialog(undefined)}
    >
      <span class="flex items-center gap-1.5">
        <Plus class="h-3 w-3" />
        Add scene at root…
      </span>
    </DropdownMenu.Item>

    {#if topLevelSubgraphs.length > 0}
      <div class="my-1 border-t border-neutral-200 dark:border-neutral-700"></div>
      <div
        class="px-2 pt-1 pb-0.5 text-[9px] font-medium tracking-wider text-muted-foreground uppercase"
      >
        Subgraphs
      </div>
      {#each topLevelSubgraphs as sg (sg.id)}
        {@const physical = isPhysicalSubgraph(sg)}
        {@const sgScenes = scenesForScope(sg.id)}
        {@const sheetActive = currentSceneId === null && currentSheetId === sg.id}
        <DropdownMenu.Item
          class="cursor-pointer rounded-md px-2 py-1.5 text-xs hover:bg-neutral-100 data-[highlighted]:bg-neutral-100 dark:hover:bg-neutral-700 dark:data-[highlighted]:bg-neutral-700/60 {sheetActive
            ? 'font-semibold text-blue-700 dark:text-blue-300'
            : 'text-neutral-700 dark:text-neutral-200'}"
          onclick={() => selectSheet(sg.id)}
        >
          <span class="flex items-center gap-1.5">
            <Graph class="h-3 w-3" />
            <span class="block max-w-[220px] truncate">{sg.label}</span>
            {#if !physical}
              <span class="text-[9px] text-muted-foreground">logical</span>
            {/if}
          </span>
        </DropdownMenu.Item>
        {#each sgScenes as scene (scene.id)}
          {@const isActive = scene.id === currentSceneId}
          <div class="flex items-center gap-1">
            <DropdownMenu.Item
              class="flex-1 cursor-pointer rounded-md px-2 py-1.5 pl-5 text-xs hover:bg-neutral-100 data-[highlighted]:bg-neutral-100 dark:hover:bg-neutral-700 dark:data-[highlighted]:bg-neutral-700/60 {isActive
                ? 'font-semibold text-blue-700 dark:text-blue-300'
                : 'text-neutral-700 dark:text-neutral-200'}"
              onclick={() => selectScene(scene.id)}
            >
              <span class="flex items-center gap-1.5">
                <MapPin class="h-3 w-3 text-amber-500" />
                <span class="block truncate">{scene.name}</span>
              </span>
            </DropdownMenu.Item>
            <button
              type="button"
              aria-label="Delete scene"
              class="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-rose-600 dark:hover:bg-neutral-700"
              onclick={(e) => {
                e.stopPropagation()
                deleteScene(scene.id)
              }}
            >
              <Trash class="h-3 w-3" />
            </button>
          </div>
        {/each}
        {#if physical}
          <DropdownMenu.Item
            class="cursor-pointer rounded-md px-2 py-1.5 pl-5 text-xs text-muted-foreground hover:bg-neutral-100 data-[highlighted]:bg-neutral-100 dark:hover:bg-neutral-700 dark:data-[highlighted]:bg-neutral-700/60"
            onclick={() => openAddDialog(sg.id)}
          >
            <span class="flex items-center gap-1.5">
              <Plus class="h-3 w-3" />
              Add scene…
            </span>
          </DropdownMenu.Item>
        {/if}
      {/each}
    {/if}
  </DropdownMenu.Content>
</DropdownMenu.Root>

<Dialog.Root bind:open={addOpen}>
  <Dialog.Portal>
    <Dialog.Overlay class="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px] dark:bg-black/40" />
    <Dialog.Content
      class="fixed top-1/2 left-1/2 z-50 w-[460px] -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-popover shadow-2xl focus:outline-none"
    >
      <div class="flex items-center justify-between border-b px-5 py-4">
        <Dialog.Title class="text-sm font-semibold">
          Add scene
          {#if pendingScope}
            {@const sg = subgraphs.find((s) => s.id === pendingScope)}
            <span class="ml-1 text-xs text-muted-foreground">to {sg?.label ?? '…'}</span>
          {:else}
            <span class="ml-1 text-xs text-muted-foreground">at root</span>
          {/if}
        </Dialog.Title>
        <Dialog.Close
          class="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X class="h-4 w-4" />
        </Dialog.Close>
      </div>
      <Dialog.Description class="sr-only">
        Create a new scene with optional background image
      </Dialog.Description>
      <div class="space-y-3 px-5 py-4 text-sm">
        <div>
          <div class="mb-1 text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
            Name
          </div>
          <input
            type="text"
            class="w-full rounded-lg border border-input bg-background px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-ring"
            placeholder="Floor 1, Server Room…"
            bind:value={newName}
          >
        </div>
        <div>
          <div class="mb-1 text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
            Background image (optional)
          </div>
          <label
            class="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-input bg-background px-2 py-1.5 text-xs hover:bg-muted"
          >
            <ImageSquare class="h-3.5 w-3.5" />
            Upload image
            <input type="file" accept="image/*" class="hidden" onchange={handleUpload}>
          </label>
          {#if pendingBg}
            <div class="mt-2 rounded-md border bg-muted/30 p-2">
              <img src={pendingBg.src} alt="background preview" class="max-h-32 object-contain">
              <p class="mt-1 text-[10px] text-muted-foreground">
                {pendingBg.width}
                × {pendingBg.height}
              </p>
            </div>
          {/if}
          {#if uploadError}
            <p class="mt-1 text-[10px] text-rose-600">{uploadError}</p>
          {/if}
        </div>
        <div class="flex justify-end gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            onclick={() => {
              addOpen = false
            }}
          >
            Cancel
          </Button>
          <Button size="sm" onclick={commitAdd}>Create</Button>
        </div>
      </div>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
