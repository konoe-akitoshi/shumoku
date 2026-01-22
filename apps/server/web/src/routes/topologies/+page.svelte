<script lang="ts">
  import { onMount } from 'svelte'
  import { topologies, topologiesList, topologiesLoading, topologiesError } from '$lib/stores'
  import type { Topology } from '$lib/types'

  let showCreateModal = false

  // Form state
  let formName = ''
  let formYaml = ''
  let formError = ''
  let formSubmitting = false

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

  function closeCreateModal() {
    showCreateModal = false
  }

  async function handleCreate() {
    if (!formName.trim() || !formYaml.trim()) {
      formError = 'Name and YAML content are required'
      return
    }

    formSubmitting = true
    formError = ''

    try {
      await topologies.create({
        name: formName.trim(),
        yamlContent: formYaml,
      })
      closeCreateModal()
    } catch (e) {
      formError = e instanceof Error ? e.message : 'Failed to create topology'
    } finally {
      formSubmitting = false
    }
  }

  async function handleDelete(topo: Topology) {
    if (!confirm(`Delete topology "${topo.name}"?`)) {
      return
    }
    try {
      await topologies.delete(topo.id)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to delete')
    }
  }
</script>

<svelte:head>
  <title>Topologies - Shumoku</title>
</svelte:head>

<div class="p-6">
  <!-- Header -->
  <div class="flex items-center justify-between mb-6">
    <div>
      <h1 class="text-2xl font-semibold text-theme-text-emphasis">Topologies</h1>
      <p class="text-theme-text-muted mt-1">Manage your network topology diagrams</p>
    </div>
    <button class="btn btn-primary" onclick={openCreateModal}>
      <svg class="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="12" y1="5" x2="12" y2="19"/>
        <line x1="5" y1="12" x2="19" y2="12"/>
      </svg>
      Add Topology
    </button>
  </div>

  {#if $topologiesLoading}
    <div class="flex items-center justify-center py-12">
      <div class="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
    </div>
  {:else if $topologiesError}
    <div class="card p-6 text-center">
      <p class="text-danger">{$topologiesError}</p>
      <button class="btn btn-secondary mt-4" onclick={() => topologies.load()}>Retry</button>
    </div>
  {:else if $topologiesList.length === 0}
    <div class="card p-12 text-center">
      <svg class="w-16 h-16 text-theme-text-muted mx-auto mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <circle cx="12" cy="5" r="3"/>
        <circle cx="5" cy="19" r="3"/>
        <circle cx="19" cy="19" r="3"/>
        <line x1="12" y1="8" x2="5" y2="16"/>
        <line x1="12" y1="8" x2="19" y2="16"/>
      </svg>
      <h3 class="text-lg font-medium text-theme-text-emphasis mb-2">No topologies</h3>
      <p class="text-theme-text-muted mb-4">Create your first network topology diagram</p>
      <button class="btn btn-primary" onclick={openCreateModal}>Add Topology</button>
    </div>
  {:else}
    <!-- Topologies Grid -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {#each $topologiesList as topo}
        <div class="card hover:border-primary/50 transition-colors">
          <div class="card-body">
            <div class="flex items-start justify-between mb-4">
              <div class="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                <svg class="w-6 h-6 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="5" r="3"/>
                  <circle cx="5" cy="19" r="3"/>
                  <circle cx="19" cy="19" r="3"/>
                  <line x1="12" y1="8" x2="5" y2="16"/>
                  <line x1="12" y1="8" x2="19" y2="16"/>
                </svg>
              </div>
              <button
                class="text-theme-text-muted hover:text-danger"
                onclick={() => handleDelete(topo)}
                title="Delete"
              >
                <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
              </button>
            </div>

            <h3 class="font-medium text-theme-text-emphasis mb-1">{topo.name}</h3>
            <p class="text-xs text-theme-text-muted mb-4">
              Updated {new Date(topo.updatedAt).toLocaleDateString()}
            </p>

            <div class="flex items-center gap-2">
              <a href="/topologies/{topo.id}" class="btn btn-secondary py-1 px-3 text-xs flex-1 text-center">
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
{#if showCreateModal}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onclick={closeCreateModal}>
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div class="bg-theme-bg-elevated border border-theme-border rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col" onclick={(e) => e.stopPropagation()}>
      <div class="flex items-center justify-between p-4 border-b border-theme-border">
        <h2 class="text-lg font-semibold text-theme-text-emphasis">Add Topology</h2>
        <button class="text-theme-text-muted hover:text-theme-text" onclick={closeCreateModal}>
          <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <form class="p-4 space-y-4 overflow-auto flex-1" onsubmit={(e) => { e.preventDefault(); handleCreate(); }}>
        {#if formError}
          <div class="p-3 bg-danger/10 border border-danger/20 rounded-lg text-danger text-sm">
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
          <p class="text-xs text-theme-text-muted mt-1">
            Define your network topology using YAML format.
            <a href="https://shumoku-docs.dev/yaml-spec" target="_blank" class="text-primary hover:underline">
              View documentation
            </a>
          </p>
        </div>
      </form>

      <div class="flex justify-end gap-2 p-4 border-t border-theme-border">
        <button type="button" class="btn btn-secondary" onclick={closeCreateModal}>Cancel</button>
        <button type="button" class="btn btn-primary" onclick={handleCreate} disabled={formSubmitting}>
          {#if formSubmitting}
            <span class="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2"></span>
          {/if}
          Create
        </button>
      </div>
    </div>
  </div>
{/if}
