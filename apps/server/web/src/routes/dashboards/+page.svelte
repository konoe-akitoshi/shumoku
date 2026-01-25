<script lang="ts">
import { onMount } from 'svelte'
import { goto } from '$app/navigation'
import { dashboardStore, dashboards, dashboardLoading, dashboardError } from '$lib/stores/dashboards'
import Plus from 'phosphor-svelte/lib/Plus'
import SquaresFour from 'phosphor-svelte/lib/SquaresFour'
import Trash from 'phosphor-svelte/lib/Trash'
import Spinner from 'phosphor-svelte/lib/Spinner'
import CaretRight from 'phosphor-svelte/lib/CaretRight'

let showCreateModal = $state(false)
let newDashboardName = $state('')
let creating = $state(false)
let deleteConfirmId = $state<string | null>(null)

onMount(() => {
  dashboardStore.load()
})

async function handleCreate() {
  if (!newDashboardName.trim()) return

  creating = true
  const dashboard = await dashboardStore.create(newDashboardName.trim())
  creating = false

  if (dashboard) {
    showCreateModal = false
    newDashboardName = ''
    goto(`/dashboards/${dashboard.id}`)
  }
}

async function handleDelete(id: string) {
  await dashboardStore.delete(id)
  deleteConfirmId = null
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}
</script>

<div class="p-6 max-w-6xl mx-auto">
  <!-- Header -->
  <div class="flex items-center justify-between mb-6">
    <div>
      <h1 class="text-2xl font-bold text-theme-text-emphasis">Dashboards</h1>
      <p class="text-theme-text-muted mt-1">Create custom dashboard views with widgets</p>
    </div>
    <button
      onclick={() => (showCreateModal = true)}
      class="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
    >
      <Plus size={20} />
      <span>New Dashboard</span>
    </button>
  </div>

  <!-- Error Message -->
  {#if $dashboardError}
    <div class="mb-4 p-4 bg-danger/10 border border-danger/20 rounded-lg text-danger">
      {$dashboardError}
    </div>
  {/if}

  <!-- Loading -->
  {#if $dashboardLoading && $dashboards.length === 0}
    <div class="flex items-center justify-center py-12">
      <Spinner size={32} class="animate-spin text-theme-text-muted" />
    </div>
  {:else if $dashboards.length === 0}
    <!-- Empty State -->
    <div class="flex flex-col items-center justify-center py-16 text-center">
      <SquaresFour size={64} class="text-theme-text-muted mb-4" />
      <h2 class="text-xl font-semibold text-theme-text-emphasis mb-2">No dashboards yet</h2>
      <p class="text-theme-text-muted mb-6 max-w-md">
        Create your first dashboard to get started. You can add widgets to visualize your network
        topology and metrics.
      </p>
      <button
        onclick={() => (showCreateModal = true)}
        class="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
      >
        <Plus size={20} />
        <span>Create Dashboard</span>
      </button>
    </div>
  {:else}
    <!-- Dashboard Grid -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {#each $dashboards as dashboard}
        <div
          class="group relative bg-theme-bg-elevated rounded-lg border border-theme-border hover:border-primary/50 transition-colors overflow-hidden"
        >
          <a href="/dashboards/{dashboard.id}" class="block p-4">
            <div class="flex items-start justify-between mb-3">
              <div class="flex items-center gap-2">
                <SquaresFour size={20} class="text-primary" />
                <h3 class="font-semibold text-theme-text-emphasis">{dashboard.name}</h3>
              </div>
              <CaretRight
                size={16}
                class="text-theme-text-muted group-hover:text-primary transition-colors"
              />
            </div>
            <div class="text-xs text-theme-text-muted">
              Created {formatDate(dashboard.createdAt)}
              {#if dashboard.updatedAt !== dashboard.createdAt}
                <span class="mx-1">&middot;</span>
                Updated {formatDate(dashboard.updatedAt)}
              {/if}
            </div>
          </a>

          <!-- Delete Button -->
          <button
            onclick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              deleteConfirmId = dashboard.id
            }}
            class="absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded-lg opacity-0 group-hover:opacity-100 hover:bg-danger/10 text-theme-text-muted hover:text-danger transition-all"
            title="Delete dashboard"
          >
            <Trash size={16} />
          </button>
        </div>
      {/each}
    </div>
  {/if}
</div>

<!-- Create Modal -->
{#if showCreateModal}
  <div
    class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
    role="dialog"
    aria-modal="true"
  >
    <div class="bg-theme-bg-elevated rounded-lg border border-theme-border shadow-xl w-full max-w-md mx-4">
      <div class="p-4 border-b border-theme-border">
        <h2 class="text-lg font-semibold text-theme-text-emphasis">Create Dashboard</h2>
      </div>
      <form
        onsubmit={(e) => {
          e.preventDefault()
          handleCreate()
        }}
        class="p-4"
      >
        <div class="mb-4">
          <label for="dashboard-name" class="block text-sm font-medium text-theme-text mb-1.5">
            Dashboard Name
          </label>
          <input
            id="dashboard-name"
            type="text"
            bind:value={newDashboardName}
            placeholder="My Dashboard"
            class="w-full px-3 py-2 bg-theme-bg-canvas border border-theme-border rounded-lg text-theme-text placeholder:text-theme-text-muted focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
            autofocus
          />
        </div>
        <div class="flex justify-end gap-2">
          <button
            type="button"
            onclick={() => {
              showCreateModal = false
              newDashboardName = ''
            }}
            class="px-4 py-2 text-theme-text-muted hover:text-theme-text transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!newDashboardName.trim() || creating}
            class="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {#if creating}
              <Spinner size={16} class="animate-spin" />
            {/if}
            Create
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<!-- Delete Confirmation Modal -->
{#if deleteConfirmId}
  <div
    class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
    role="dialog"
    aria-modal="true"
  >
    <div class="bg-theme-bg-elevated rounded-lg border border-theme-border shadow-xl w-full max-w-sm mx-4 p-4">
      <h2 class="text-lg font-semibold text-theme-text-emphasis mb-2">Delete Dashboard?</h2>
      <p class="text-theme-text-muted mb-4">
        This action cannot be undone. The dashboard and all its widgets will be permanently deleted.
      </p>
      <div class="flex justify-end gap-2">
        <button
          onclick={() => (deleteConfirmId = null)}
          class="px-4 py-2 text-theme-text-muted hover:text-theme-text transition-colors"
        >
          Cancel
        </button>
        <button
          onclick={() => handleDelete(deleteConfirmId!)}
          class="px-4 py-2 bg-danger text-white rounded-lg hover:bg-danger/80 transition-colors"
        >
          Delete
        </button>
      </div>
    </div>
  </div>
{/if}
