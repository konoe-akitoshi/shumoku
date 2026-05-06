<script lang="ts">
  import { Dialog, DropdownMenu } from 'bits-ui'
  import { CaretDown, Cube, FileJs, FolderOpen, Plus, Trash, X } from 'phosphor-svelte'
  import { tick } from 'svelte'
  import { goto } from '$app/navigation'
  import { Button } from '$lib/components/ui/button'
  import * as Card from '$lib/components/ui/card'
  import { diagramState } from '$lib/context.svelte'
  import { type ProjectSummary, projectsDb } from '$lib/persistence/projects-store'

  const starters = [
    { id: 'sample', name: 'Sample Network', description: 'Multi-site campus network with PoE' },
  ]

  let cached = $state<ProjectSummary[]>([])
  let cachedLoaded = $state(false)

  $effect(() => {
    void refreshCache()
  })

  async function refreshCache() {
    cached = await projectsDb.list()
    cachedLoaded = true
  }

  /**
   * Prompt for a local file and stream it through `onLoad`. The
   * picker's `accept` is a UI hint; we still check the suffix so a
   * mismatched file doesn't silently fail at parse time. Receives the
   * raw `File` so callers can decide between text and Blob handling.
   */
  function promptFile(opts: {
    accept: string
    expectedSuffix: string
    formatLabel: string
    onLoad: (file: File) => Promise<void>
  }) {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = opts.accept
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      if (!file.name.toLowerCase().endsWith(opts.expectedSuffix.toLowerCase())) {
        alert(
          `This looks like the wrong file — expected ${opts.formatLabel} (${opts.expectedSuffix}).`,
        )
        return
      }
      try {
        await opts.onLoad(file)
      } catch (e) {
        alert(`Import failed: ${e instanceof Error ? e.message : String(e)}`)
      }
    }
    input.click()
  }

  let newOpen = $state(false)
  let newName = $state('')
  let newInputEl = $state<HTMLInputElement | null>(null)

  async function openNewProjectDialog() {
    newName = ''
    newOpen = true
    // Focus the input once the dialog has rendered.
    await tick()
    newInputEl?.focus()
  }

  async function confirmNewProject() {
    const name = newName.trim() || 'Untitled'
    newOpen = false
    const id = await diagramState.createNewProject(name)
    goto(`/project/${id}/diagram`)
  }

  function handleImportProject() {
    promptFile({
      accept: '.neted.zip,.zip',
      expectedSuffix: '.neted.zip',
      formatLabel: 'neted project',
      onLoad: async (file) => {
        const id = await diagramState.importProject(file)
        goto(`/project/${id}/diagram`)
      },
    })
  }

  function handleImportDiagram() {
    promptFile({
      accept: '.json',
      expectedSuffix: '.json',
      formatLabel: 'diagram JSON (NetworkGraph)',
      onLoad: async (file) => {
        const id = await diagramState.importDiagram(await file.text())
        goto(`/project/${id}/diagram`)
      },
    })
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete cached project "${name}"? This cannot be undone.`)) return
    await projectsDb.deleteProject(id)
    await refreshCache()
  }

  function fmtUpdatedAt(t: number): string {
    const diff = Date.now() - t
    if (diff < 60_000) return 'just now'
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
    return new Date(t).toLocaleDateString()
  }

  function fmtSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const itemClass =
    'flex items-center gap-2 w-full px-3 py-2 text-sm text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-700 cursor-pointer transition-colors'
</script>

<div class="min-h-screen bg-background px-6 py-8 max-w-4xl mx-auto">
  <div class="flex items-center justify-between mb-8">
    <div>
      <h1 class="text-2xl font-bold">shumoku</h1>
      <p class="text-sm text-muted-foreground">Network Topology Editor</p>
    </div>
    <DropdownMenu.Root>
      <DropdownMenu.Trigger>
        {#snippet child({ props })}
          <Button {...props}>
            <Plus class="w-4 h-4 mr-1" />
            New
            <CaretDown class="w-3 h-3 ml-1" />
          </Button>
        {/snippet}
      </DropdownMenu.Trigger>
      <DropdownMenu.Content
        class="min-w-[200px] bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl shadow-lg py-1 z-50"
        sideOffset={4}
        align="end"
      >
        <DropdownMenu.Item class={itemClass} onSelect={openNewProjectDialog}>
          <Plus class="w-4 h-4 text-neutral-400" />
          New Project
        </DropdownMenu.Item>
        <DropdownMenu.Separator class="my-1 h-px bg-neutral-200 dark:bg-neutral-700" />
        <DropdownMenu.Item class={itemClass} onSelect={handleImportProject}>
          <FolderOpen class="w-4 h-4 text-neutral-400" />
          <div class="flex flex-col items-start gap-0.5">
            <span>Import Project</span>
            <span class="text-[10px] text-neutral-400 dark:text-neutral-500"
              >.neted.zip (diagram, products, scenes, assets)</span
            >
          </div>
        </DropdownMenu.Item>
        <DropdownMenu.Item class={itemClass} onSelect={handleImportDiagram}>
          <FileJs class="w-4 h-4 text-neutral-400" />
          <div class="flex flex-col items-start gap-0.5">
            <span>Import Diagram</span>
            <span class="text-[10px] text-neutral-400 dark:text-neutral-500"
              >.json (diagram only — NetworkGraph)</span
            >
          </div>
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  </div>

  <!-- Recent projects (local cache, beta) -->
  <section class="mb-8">
    <h2 class="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
      Recent projects
    </h2>
    <div
      class="mb-3 rounded-lg border border-amber-300/70 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-200"
    >
      <span class="font-semibold">Beta — local only.</span>
      Projects live in this browser's IndexedDB. They can be lost if you clear site data, switch
      browsers / profiles / devices, or use a private window. Export
      <span class="font-mono">.neted.zip</span>
      as a durable backup.
    </div>
    {#if !cachedLoaded}
      <div class="text-sm text-muted-foreground">Loading…</div>
    {:else if cached.length === 0}
      <div class="text-sm text-muted-foreground">
        No cached projects yet — create or import one to start.
      </div>
    {:else}
      <div class="grid gap-2">
        {#each cached as project (project.id)}
          <Card.Root class="hover:ring-2 hover:ring-primary/20 transition-all">
            <Card.Content class="flex items-center gap-4">
              <button
                type="button"
                class="flex items-center gap-4 flex-1 text-left"
                onclick={() => goto(`/project/${project.id}/diagram`)}
              >
                <div class="p-3 rounded-lg bg-muted">
                  <Cube class="w-6 h-6 text-muted-foreground" />
                </div>
                <div class="flex-1">
                  <div class="text-sm font-semibold">{project.name}</div>
                  <div class="text-xs text-muted-foreground mt-0.5">
                    Updated {fmtUpdatedAt(project.updatedAt)} · {fmtSize(project.size)}
                  </div>
                </div>
              </button>
              <Button
                variant="ghost"
                size="sm"
                onclick={() => handleDelete(project.id, project.name)}
                aria-label="Delete project"
              >
                <Trash class="w-4 h-4 text-muted-foreground" />
              </Button>
            </Card.Content>
          </Card.Root>
        {/each}
      </div>
    {/if}
  </section>

  <!-- Starter projects -->
  <section>
    <h2 class="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
      Starter projects
    </h2>
    <div class="grid gap-2">
      {#each starters as project (project.id)}
        <Card.Root
          class="cursor-pointer hover:ring-2 hover:ring-primary/20 transition-all"
          onclick={() => goto(`/project/${project.id}/diagram`)}
        >
          <Card.Content class="flex items-center gap-4">
            <div class="p-3 rounded-lg bg-muted">
              <Cube class="w-6 h-6 text-muted-foreground" />
            </div>
            <div>
              <div class="text-sm font-semibold">{project.name}</div>
              <div class="text-xs text-muted-foreground mt-0.5">{project.description}</div>
            </div>
          </Card.Content>
        </Card.Root>
      {/each}
    </div>
  </section>
</div>

<!-- New project — name first, then create + navigate. Prompting
     for a name up front avoids the "create Untitled, hunt down
     Settings, rename, then start working" flow. -->
<Dialog.Root bind:open={newOpen}>
  <Dialog.Portal>
    <Dialog.Overlay class="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px] dark:bg-black/40" />
    <Dialog.Content
      class="fixed top-1/2 left-1/2 z-50 w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-popover shadow-2xl focus:outline-none"
    >
      <div class="flex items-center justify-between border-b px-5 py-4">
        <Dialog.Title class="text-sm font-semibold">New project</Dialog.Title>
        <Dialog.Close
          class="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X class="h-4 w-4" />
        </Dialog.Close>
      </div>
      <Dialog.Description class="sr-only">Name a new project before opening it.</Dialog.Description>
      <form
        class="space-y-3 px-5 py-4 text-sm"
        onsubmit={(e) => {
          e.preventDefault()
          void confirmNewProject()
        }}
      >
        <label class="block space-y-1">
          <span class="text-xs font-medium text-muted-foreground">Project name</span>
          <input
            bind:this={newInputEl}
            bind:value={newName}
            class="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            placeholder="My new network"
            autocomplete="off"
            spellcheck="false"
          >
        </label>
        <div class="flex justify-end gap-2 pt-1">
          <Button variant="outline" size="sm" type="button" onclick={() => { newOpen = false }}
            >Cancel</Button
          >
          <Button size="sm" type="submit">Create</Button>
        </div>
      </form>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
