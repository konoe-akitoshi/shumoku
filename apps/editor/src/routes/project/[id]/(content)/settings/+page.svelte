<script lang="ts">
  import { DownloadSimple, Trash } from 'phosphor-svelte'
  import { goto } from '$app/navigation'
  import { Badge } from '$lib/components/ui/badge'
  import { Button } from '$lib/components/ui/button'
  import { diagramState } from '$lib/context.svelte'
  import { projectsDb } from '$lib/persistence/projects-store'
  import { cache } from '$lib/state/cache.svelte'
  import { sessionStore } from '$lib/state/session.svelte'

  async function handleExportProject() {
    const blob = await diagramState.exportProjectZip(sessionStore.projectName)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${sessionStore.projectName || 'project'}.neted.zip`
    a.click()
    URL.revokeObjectURL(url)
  }

  let storage = $state<{ usage: number; quota: number } | null>(null)
  let projectCount = $state<number | null>(null)
  $effect(() => {
    void refreshStorage()
  })
  async function refreshStorage() {
    storage = await projectsDb.storageEstimate()
    projectCount = (await projectsDb.list()).length
  }

  async function handleClearCache() {
    if (
      !confirm(
        "Delete all cached projects? Anything you haven't exported will be lost. This cannot be undone.",
      )
    )
      return
    await projectsDb.clearAll()
    await refreshStorage()
    goto('/')
  }

  function fmtSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
  }

  let renaming = $state(false)
  let renameValue = $state('')
  function startRename() {
    renameValue = sessionStore.projectName
    renaming = true
  }
  async function commitRename() {
    const next = renameValue.trim()
    if (!next || !sessionStore.projectId) {
      renaming = false
      return
    }
    sessionStore.setProjectName(next)
    await diagramState.renameCachedProject(sessionStore.projectId, next)
    renaming = false
  }
</script>

<div class="max-w-2xl mx-auto space-y-8">
  <h1 class="text-lg font-bold">Settings</h1>

  <!-- Project info -->
  <section class="space-y-3">
    <h2
      class="text-sm font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider"
    >
      Project
    </h2>
    <div
      class="flex items-center justify-between p-4 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900"
    >
      <div class="flex-1">
        <div class="text-sm font-medium">Name</div>
        {#if renaming}
          <input
            class="mt-1 px-2 py-1 text-sm rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 w-full max-w-sm"
            bind:value={renameValue}
            onkeydown={(e) => e.key === 'Enter' && commitRename()}
            onblur={commitRename}
          >
        {:else}
          <div class="text-xs text-muted-foreground">{sessionStore.projectName}</div>
        {/if}
      </div>
      {#if !renaming}
        <Button variant="outline" size="sm" onclick={startRename}>Rename</Button>
      {/if}
    </div>
  </section>

  <!-- Export -->
  <section class="space-y-3">
    <h2
      class="text-sm font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider"
    >
      Export
    </h2>
    <div
      class="flex items-center justify-between p-4 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900"
    >
      <div>
        <div class="text-sm font-medium">Project file</div>
        <div class="text-xs text-muted-foreground">
          Download as .neted.zip (diagram, products, scenes, image assets)
        </div>
      </div>
      <Button variant="outline" size="sm" onclick={handleExportProject}>
        <DownloadSimple class="w-4 h-4 mr-1" />
        Export
      </Button>
    </div>
  </section>

  <!-- Local cache -->
  <section class="space-y-3">
    <div class="flex items-center gap-2">
      <h2
        class="text-sm font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider"
      >
        Local cache
      </h2>
      <Badge variant="outline" class="text-[10px]">Beta</Badge>
    </div>
    <div
      class="space-y-3 p-4 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900"
    >
      <div class="flex items-center justify-between">
        <div>
          <div class="text-sm font-medium">Cache edits in this browser</div>
          <div class="text-xs text-muted-foreground">
            Reload picks up where you left off. Export remains the source of truth.
          </div>
        </div>
        <Button variant="outline" size="sm" onclick={() => cache.setEnabled(!cache.enabled)}>
          {cache.enabled ? 'On' : 'Off'}
        </Button>
      </div>
      <div class="flex items-center justify-between">
        <div>
          <div class="text-sm font-medium">Storage</div>
          <div class="text-xs text-muted-foreground">
            {projectCount ?? '—'}
            cached project{projectCount === 1 ? '' : 's'}
            {#if storage}
              · {fmtSize(storage.usage)} used of {fmtSize(storage.quota)} quota
            {/if}
          </div>
        </div>
        <Button variant="outline" size="sm" onclick={handleClearCache}>
          <Trash class="w-4 h-4 mr-1" />
          Clear cache
        </Button>
      </div>
    </div>
  </section>
</div>
