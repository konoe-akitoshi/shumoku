<script lang="ts">
  import { DropdownMenu } from 'bits-ui'
  import { CaretDown, Cube, FileJs, FolderOpen, Plus, Trash } from 'phosphor-svelte'
  import { goto } from '$app/navigation'
  import { Badge } from '$lib/components/ui/badge'
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

  async function handleNewProject() {
    const id = await diagramState.createNewProject('Untitled')
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
        <DropdownMenu.Item class={itemClass} onSelect={handleNewProject}>
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
    <div class="flex items-center gap-2 mb-1">
      <h2 class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Recent projects
      </h2>
      <Badge variant="outline" class="text-[10px]">Beta — local only</Badge>
    </div>
    <div class="text-xs text-muted-foreground mb-3">
      Stored in this browser's IndexedDB. Lost if you clear site data, switch browsers, or use
      private mode — export <span class="font-mono">.neted.zip</span> for a durable backup.
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
            <Card.Content class="pt-4 flex items-center gap-4">
              <button
                type="button"
                class="flex items-center gap-4 flex-1 text-left"
                onclick={() => goto(`/project/${project.id}/diagram`)}
              >
                <div class="p-3 rounded-lg bg-muted">
                  <Cube class="w-6 h-6 text-muted-foreground" />
                </div>
                <div class="flex-1">
                  <div class="font-semibold">{project.name}</div>
                  <div class="text-xs text-muted-foreground">
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
          <Card.Content class="pt-4 flex items-center gap-4">
            <div class="p-3 rounded-lg bg-muted">
              <Cube class="w-6 h-6 text-muted-foreground" />
            </div>
            <div>
              <div class="font-semibold">{project.name}</div>
              <div class="text-sm text-muted-foreground">{project.description}</div>
            </div>
          </Card.Content>
        </Card.Root>
      {/each}
    </div>
  </section>
</div>
