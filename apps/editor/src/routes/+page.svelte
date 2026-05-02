<script lang="ts">
  import { DropdownMenu } from 'bits-ui'
  import { CaretDown, Cube, FileJs, FolderOpen, Plus } from 'phosphor-svelte'
  import { goto } from '$app/navigation'
  import { Button } from '$lib/components/ui/button'
  import * as Card from '$lib/components/ui/card'
  import { diagramState } from '$lib/context.svelte'

  const projects = [
    { id: 'sample', name: 'Sample Network', description: 'Multi-site campus network with PoE' },
    { id: 'empty', name: 'Empty Project', description: 'Start from scratch' },
  ]

  /**
   * Prompt for a local file and stream its contents through `onLoad`.
   * The file picker's `accept` is a hint to the OS dialog — we still
   * check the file name to keep wrong-format imports from silently
   * feeding JSON.parse something that would only fail later.
   */
  function promptFile(opts: {
    accept: string
    expectedSuffix: string
    formatLabel: string
    onLoad: (text: string) => Promise<void>
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
      const text = await file.text()
      try {
        await opts.onLoad(text)
      } catch (e) {
        alert(`Import failed: ${e instanceof Error ? e.message : String(e)}`)
      }
    }
    input.click()
  }

  function handleImportProject() {
    promptFile({
      accept: '.neted.json',
      expectedSuffix: '.neted.json',
      formatLabel: 'neted project',
      onLoad: async (text) => {
        await diagramState.importProject(text)
        goto('/project/imported/diagram')
      },
    })
  }

  function handleImportDiagram() {
    promptFile({
      accept: '.json',
      expectedSuffix: '.json',
      formatLabel: 'diagram JSON (NetworkGraph)',
      onLoad: async (text) => {
        await diagramState.importDiagram(text)
        goto('/project/imported/diagram')
      },
    })
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
        <DropdownMenu.Item class="{itemClass} opacity-50 cursor-not-allowed" disabled>
          <Plus class="w-4 h-4 text-neutral-400" />
          New Project
        </DropdownMenu.Item>
        <DropdownMenu.Separator class="my-1 h-px bg-neutral-200 dark:bg-neutral-700" />
        <DropdownMenu.Item class={itemClass} onSelect={handleImportProject}>
          <FolderOpen class="w-4 h-4 text-neutral-400" />
          <div class="flex flex-col items-start gap-0.5">
            <span>Import Project</span>
            <span class="text-[10px] text-neutral-400 dark:text-neutral-500"
              >.neted.json (products + diagram)</span
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

  <div class="grid gap-4">
    {#each projects as project}
      <Card.Root
        class="cursor-pointer hover:ring-2 hover:ring-primary/20 transition-all"
        onclick={() => goto(`/project/${project.id}/diagram`)}
      >
        <Card.Content class="pt-4 flex items-center gap-4">
          <div class="p-3 rounded-lg bg-muted"><Cube class="w-6 h-6 text-muted-foreground" /></div>
          <div>
            <div class="font-semibold">{project.name}</div>
            <div class="text-sm text-muted-foreground">{project.description}</div>
          </div>
        </Card.Content>
      </Card.Root>
    {/each}
  </div>
</div>
