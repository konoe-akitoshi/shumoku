<script lang="ts">
  import { DownloadSimple } from 'phosphor-svelte'
  import { Button } from '$lib/components/ui/button'
  import { diagramState } from '$lib/context.svelte'

  function handleExportProject() {
    const json = diagramState.exportProject('Project')
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'project.neted.json'
    a.click()
    URL.revokeObjectURL(url)
  }
</script>

<div class="max-w-2xl mx-auto space-y-8">
  <h1 class="text-lg font-bold">Settings</h1>

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
          Download as .neted.json (includes products and diagram)
        </div>
      </div>
      <Button variant="outline" size="sm" onclick={handleExportProject}>
        <DownloadSimple class="w-4 h-4 mr-1" />
        Export
      </Button>
    </div>
  </section>
</div>
