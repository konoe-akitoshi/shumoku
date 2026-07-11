<script lang="ts">
  import { GearSixIcon, PlusIcon, TreeStructureIcon } from 'phosphor-svelte'
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import { Button } from '$lib/components/ui/button'
  import * as Dialog from '$lib/components/ui/dialog'
  import { Input } from '$lib/components/ui/input'
  import { Label } from '$lib/components/ui/label'
  import { topologies, topologiesError, topologiesList, topologiesLoading } from '$lib/stores'

  let showCreateModal = $state(false)
  let formName = $state('')
  let formError = $state('')
  let formSubmitting = $state(false)

  onMount(() => {
    topologies.load()
  })

  function openCreateModal() {
    formName = ''
    formError = ''
    showCreateModal = true
  }

  async function handleCreate() {
    const name = formName.trim()
    if (!name) {
      formError = 'Name is required'
      return
    }

    formSubmitting = true
    formError = ''

    try {
      // A topology is a composition of sources. Create the shell and land on its
      // Sources tab to add sources (Manual is just one option — no longer
      // auto-attached; it's created lazily on first edit).
      const topology = await topologies.create({ name })
      showCreateModal = false
      await goto(`/topologies/${topology.id}/sources`)
    } catch (e) {
      formError = e instanceof Error ? e.message : 'Failed to create topology'
    } finally {
      formSubmitting = false
    }
  }
</script>

<svelte:head> <title>Topologies - Shumoku</title> </svelte:head>

<div class="p-6">
  <div class="flex items-center justify-end mb-6">
    <Button onclick={openCreateModal}>
      <PlusIcon size={20} />
      Add Topology
    </Button>
  </div>

  {#if $topologiesLoading}
    <div class="flex items-center justify-center py-12">
      <div
        class="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"
      ></div>
    </div>
  {:else if $topologiesError}
    <div class="card p-6 text-center">
      <p class="text-destructive">{$topologiesError}</p>
      <Button variant="outline" class="mt-4" onclick={() => topologies.load()}>Retry</Button>
    </div>
  {:else if $topologiesList.length === 0}
    <div class="card p-12 text-center">
      <TreeStructureIcon size={64} class="text-theme-text-muted mx-auto mb-4" />
      <h3 class="text-lg font-medium text-theme-text-emphasis mb-2">No topologies</h3>
      <p class="text-theme-text-muted mb-4">Create your first network topology diagram</p>
      <Button onclick={openCreateModal}>Add Topology</Button>
    </div>
  {:else}
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {#each $topologiesList as topo}
        <div class="card hover:border-primary/50 transition-colors">
          <div class="card-body">
            <div class="flex items-start justify-between mb-4">
              <div class="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                <TreeStructureIcon size={24} class="text-primary" />
              </div>
              <a
                href="/topologies/{topo.id}/settings"
                class="text-theme-text-muted hover:text-theme-text"
                title="Settings"
              >
                <GearSixIcon size={20} />
              </a>
            </div>

            <h3 class="font-medium text-theme-text-emphasis mb-1">{topo.name}</h3>
            <p class="text-xs text-theme-text-muted mb-4">
              Updated {new Date(topo.updatedAt).toLocaleDateString()}
            </p>

            <div class="flex items-center gap-2">
              <a
                href="/topologies/{topo.id}"
                class="btn btn-primary py-1 px-3 text-xs flex-1 text-center"
              >
                Open
              </a>
            </div>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<Dialog.Root bind:open={showCreateModal}>
  <Dialog.Content class="sm:max-w-md">
    <Dialog.Header>
      <Dialog.Title>Add Topology</Dialog.Title>
      <Dialog.Description>
        Give your topology a name, then add data sources to compose it.
      </Dialog.Description>
    </Dialog.Header>

    <Dialog.Body>
      <form
        class="space-y-4"
        onsubmit={(e) => {
          e.preventDefault()
          handleCreate()
        }}
      >
        {#if formError}
          <div
            class="p-3 bg-destructive/10 border border-destructive/20 rounded-md text-destructive text-sm"
          >
            {formError}
          </div>
        {/if}

        <div class="space-y-2">
          <Label for="name">Name</Label>
          <Input
            id="name"
            placeholder="My Network"
            bind:value={formName}
            autofocus
            disabled={formSubmitting}
          />
        </div>
      </form>
    </Dialog.Body>

    <Dialog.Footer>
      <Button variant="outline" onclick={() => (showCreateModal = false)}>Cancel</Button>
      <Button onclick={handleCreate} disabled={formSubmitting || !formName.trim()}>
        {#if formSubmitting}
          <span
            class="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"
          ></span>
        {/if}
        Create
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
