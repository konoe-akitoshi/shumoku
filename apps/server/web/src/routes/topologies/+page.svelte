<script lang="ts">
import { onMount } from 'svelte'
import { topologies, topologiesList, topologiesLoading, topologiesError } from '$lib/stores'
import { YamlParser } from '@shumoku/parser-yaml'
import * as Dialog from '$lib/components/ui/dialog'
import { Button } from '$lib/components/ui/button'
import Plus from 'phosphor-svelte/lib/Plus'
import TreeStructure from 'phosphor-svelte/lib/TreeStructure'
import GearSix from 'phosphor-svelte/lib/GearSix'

let showCreateModal = $state(false)

// Form state
let formName = $state('')
let formYaml = $state('')
let formError = $state('')
let formSubmitting = $state(false)

const sampleYaml = `name: My Network
nodes:
  - id: router1
    label: Core Router
    type: router
  - id: switch1
    label: Switch 1
    type: switch
links:
  - from: router1
    to: switch1
    bandwidth: 1G
`

onMount(() => {
  topologies.load()
})

function openCreateModal() {
  formName = ''
  formYaml = sampleYaml
  formError = ''
  showCreateModal = true
}

async function handleCreate() {
  if (!formName.trim() || !formYaml.trim()) {
    formError = 'Name and YAML content are required'
    return
  }

  formSubmitting = true
  formError = ''

  try {
    // Parse YAML to NetworkGraph
    const parser = new YamlParser()
    const result = parser.parse(formYaml)

    // Send NetworkGraph JSON
    const contentJson = JSON.stringify(result.graph)
    await topologies.create({
      name: formName.trim(),
      contentJson,
    })
    showCreateModal = false
  } catch (e) {
    formError = e instanceof Error ? e.message : 'Failed to create topology'
  } finally {
    formSubmitting = false
  }
}
</script>

<svelte:head>
  <title>Topologies - Shumoku</title>
</svelte:head>

<div class="p-6">
  <!-- Actions -->
  <div class="flex items-center justify-end mb-6">
    <Button onclick={openCreateModal}>
      <Plus size={20} class="mr-1" />
      Add Topology
    </Button>
  </div>

  {#if $topologiesLoading}
    <div class="flex items-center justify-center py-12">
      <div class="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
    </div>
  {:else if $topologiesError}
    <div class="card p-6 text-center">
      <p class="text-destructive">{$topologiesError}</p>
      <Button variant="outline" class="mt-4" onclick={() => topologies.load()}>Retry</Button>
    </div>
  {:else if $topologiesList.length === 0}
    <div class="card p-12 text-center">
      <TreeStructure size={64} class="text-theme-text-muted mx-auto mb-4" />
      <h3 class="text-lg font-medium text-theme-text-emphasis mb-2">No topologies</h3>
      <p class="text-theme-text-muted mb-4">Create your first network topology diagram</p>
      <Button onclick={openCreateModal}>Add Topology</Button>
    </div>
  {:else}
    <!-- Topologies Grid -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {#each $topologiesList as topo}
        <div class="card hover:border-primary/50 transition-colors">
          <div class="card-body">
            <div class="flex items-start justify-between mb-4">
              <div class="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                <TreeStructure size={24} class="text-primary" />
              </div>
              <a
                href="/topologies/{topo.id}/settings"
                class="text-theme-text-muted hover:text-theme-text"
                title="Settings"
              >
                <GearSix size={20} />
              </a>
            </div>

            <h3 class="font-medium text-theme-text-emphasis mb-1">{topo.name}</h3>
            <p class="text-xs text-theme-text-muted mb-4">
              Updated {new Date(topo.updatedAt).toLocaleDateString()}
            </p>

            <div class="flex items-center gap-2">
              <a href="/topologies/{topo.id}" class="btn btn-primary py-1 px-3 text-xs flex-1 text-center">
                View
              </a>
              <a href="/topologies/{topo.id}/edit" class="btn btn-secondary py-1 px-3 text-xs flex-1 text-center">
                Edit
              </a>
            </div>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<!-- Create Modal -->
<Dialog.Root bind:open={showCreateModal}>
  <Dialog.Content class="sm:max-w-2xl max-h-[90vh] flex flex-col">
    <Dialog.Header>
      <Dialog.Title>Add Topology</Dialog.Title>
      <Dialog.Description>Create a new network topology diagram using YAML definition.</Dialog.Description>
    </Dialog.Header>

    <form class="space-y-4 overflow-auto flex-1" onsubmit={(e) => { e.preventDefault(); handleCreate(); }}>
      {#if formError}
        <div class="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
          {formError}
        </div>
      {/if}

      <div>
        <label for="name" class="label">Name</label>
        <input
          type="text"
          id="name"
          class="input"
          placeholder="My Network"
          bind:value={formName}
        />
      </div>

      <div>
        <label for="yaml" class="label">YAML Definition</label>
        <textarea
          id="yaml"
          class="input font-mono text-sm"
          rows="15"
          placeholder="Enter your network YAML..."
          bind:value={formYaml}
        ></textarea>
        <p class="text-xs text-muted-foreground mt-1">
          Define your network topology using YAML format.
          <a href="https://shumoku-docs.dev/yaml-spec" target="_blank" class="text-primary hover:underline">
            View documentation
          </a>
        </p>
      </div>
    </form>

    <Dialog.Footer>
      <Button variant="outline" onclick={() => showCreateModal = false}>Cancel</Button>
      <Button onclick={handleCreate} disabled={formSubmitting}>
        {#if formSubmitting}
          <span class="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2"></span>
        {/if}
        Create
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
