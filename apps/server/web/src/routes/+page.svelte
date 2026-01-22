<script lang="ts">
  import { onMount } from 'svelte'
  import { api } from '$lib/api'
  import type { Topology, DataSource } from '$lib/types'

  let topologies: Topology[] = []
  let dataSources: DataSource[] = []
  let loading = true
  let error = ''

  onMount(async () => {
    try {
      const [topoRes, dsRes] = await Promise.all([api.topologies.list(), api.dataSources.list()])
      topologies = topoRes
      dataSources = dsRes
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load data'
    } finally {
      loading = false
    }
  })
</script>

<svelte:head>
  <title>Home - Shumoku</title>
</svelte:head>

<div class="p-6">
  {#if loading}
    <div class="flex items-center justify-center py-12">
      <div
        class="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"
      ></div>
    </div>
  {:else if error}
    <div class="card p-6 text-center">
      <p class="text-danger">{error}</p>
    </div>
  {:else}
    <!-- Stats -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <div class="card p-4">
        <div class="flex items-center gap-4">
          <div class="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
            <svg
              class="w-6 h-6 text-primary"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <circle cx="12" cy="5" r="3" />
              <circle cx="5" cy="19" r="3" />
              <circle cx="19" cy="19" r="3" />
              <line x1="12" y1="8" x2="5" y2="16" />
              <line x1="12" y1="8" x2="19" y2="16" />
            </svg>
          </div>
          <div>
            <p class="text-2xl font-semibold text-theme-text-emphasis">{topologies.length}</p>
            <p class="text-sm text-theme-text-muted">Topologies</p>
          </div>
        </div>
      </div>

      <div class="card p-4">
        <div class="flex items-center gap-4">
          <div class="w-12 h-12 bg-info/10 rounded-lg flex items-center justify-center">
            <svg
              class="w-6 h-6 text-info"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <ellipse cx="12" cy="5" rx="9" ry="3" />
              <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
              <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
            </svg>
          </div>
          <div>
            <p class="text-2xl font-semibold text-theme-text-emphasis">{dataSources.length}</p>
            <p class="text-sm text-theme-text-muted">Data Sources</p>
          </div>
        </div>
      </div>

      <div class="card p-4">
        <div class="flex items-center gap-4">
          <div class="w-12 h-12 bg-success/10 rounded-lg flex items-center justify-center">
            <svg
              class="w-6 h-6 text-success"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
          <div>
            <p class="text-2xl font-semibold text-theme-text-emphasis">Online</p>
            <p class="text-sm text-theme-text-muted">Server Status</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Quick Actions -->
    <div class="mb-6">
      <h2 class="text-sm font-medium text-theme-text-muted mb-3">Quick Actions</h2>
      <div class="flex gap-3 flex-wrap">
        <a href="/topologies" class="btn btn-primary">
          <svg
            class="w-4 h-4 mr-2"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New Topology
        </a>
        <a href="/datasources" class="btn btn-secondary">
          <svg
            class="w-4 h-4 mr-2"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <ellipse cx="12" cy="5" rx="9" ry="3" />
            <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
            <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
          </svg>
          Manage Data Sources
        </a>
        <a href="/settings" class="btn btn-secondary">
          <svg
            class="w-4 h-4 mr-2"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <circle cx="12" cy="12" r="3" />
            <path
              d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"
            />
          </svg>
          Settings
        </a>
      </div>
    </div>

    <!-- Recent Topologies -->
    <div class="card">
      <div class="card-header flex items-center justify-between">
        <h2 class="font-medium text-theme-text-emphasis">Recent Topologies</h2>
        <a href="/topologies" class="text-sm text-primary hover:text-primary-dark">View all</a>
      </div>
      <div class="card-body">
        {#if topologies.length === 0}
          <div class="text-center py-8">
            <svg
              class="w-12 h-12 text-theme-text-muted mx-auto mb-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
            >
              <circle cx="12" cy="5" r="3" />
              <circle cx="5" cy="19" r="3" />
              <circle cx="19" cy="19" r="3" />
              <line x1="12" y1="8" x2="5" y2="16" />
              <line x1="12" y1="8" x2="19" y2="16" />
            </svg>
            <p class="text-theme-text-muted mb-4">No topologies yet</p>
            <a href="/topologies" class="btn btn-primary">Add Topology</a>
          </div>
        {:else}
          <div class="space-y-2">
            {#each topologies.slice(0, 5) as topology}
              <a
                href="/topologies/{topology.id}"
                class="flex items-center justify-between p-3 rounded-lg hover:bg-theme-bg transition-colors"
              >
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                    <svg
                      class="w-5 h-5 text-primary"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <circle cx="12" cy="5" r="3" />
                      <circle cx="5" cy="19" r="3" />
                      <circle cx="19" cy="19" r="3" />
                      <line x1="12" y1="8" x2="5" y2="16" />
                      <line x1="12" y1="8" x2="19" y2="16" />
                    </svg>
                  </div>
                  <div>
                    <p class="font-medium text-theme-text-emphasis">{topology.name}</p>
                    <p class="text-xs text-theme-text-muted">
                      Updated {new Date(topology.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <svg
                  class="w-5 h-5 text-theme-text-muted"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </a>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>
