<script lang="ts">
import { onMount } from 'svelte'
import { api } from '$lib/api'
import type { Topology, DataSource, Dashboard } from '$lib/types'
import TreeStructure from 'phosphor-svelte/lib/TreeStructure'
import Database from 'phosphor-svelte/lib/Database'
import SquaresFour from 'phosphor-svelte/lib/SquaresFour'
import Plus from 'phosphor-svelte/lib/Plus'
import ArrowRight from 'phosphor-svelte/lib/ArrowRight'
import Spinner from 'phosphor-svelte/lib/Spinner'

let topologies: Topology[] = $state([])
let dataSources: DataSource[] = $state([])
let dashboards: Dashboard[] = $state([])
let loading = $state(true)
let error = $state('')

onMount(async () => {
  try {
    const [topoRes, dsRes, dashRes] = await Promise.all([
      api.topologies.list(),
      api.dataSources.list(),
      api.dashboards.list(),
    ])
    topologies = topoRes
    dataSources = dsRes
    dashboards = dashRes
  } catch (e) {
    error = e instanceof Error ? e.message : 'Failed to load data'
  } finally {
    loading = false
  }
})

// Count connected data sources
let connectedSources = $derived(dataSources.filter(ds => ds.status === 'connected').length)
</script>

<svelte:head>
  <title>Home - Shumoku</title>
</svelte:head>

<div class="h-full overflow-auto">
  {#if loading}
    <div class="flex items-center justify-center h-full">
      <Spinner size={32} class="animate-spin text-theme-text-muted" />
    </div>
  {:else if error}
    <div class="p-6">
      <div class="card p-6 text-center">
        <p class="text-danger">{error}</p>
      </div>
    </div>
  {:else}
    <!-- Hero Section -->
    <div class="bg-gradient-to-br from-primary/5 to-primary/10 border-b border-theme-border">
      <div class="max-w-6xl mx-auto px-6 py-8">
        <h1 class="text-2xl font-bold text-theme-text-emphasis mb-2">Welcome to Shumoku</h1>
        <p class="text-theme-text-muted">Network topology visualization and monitoring</p>
      </div>
    </div>

    <div class="max-w-6xl mx-auto px-6 py-6">
      <!-- Stats Grid -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <a href="/topologies" class="card p-4 hover:border-primary/50 transition-colors group">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center group-hover:bg-primary/20 transition-colors">
              <TreeStructure size={20} class="text-primary" />
            </div>
            <div>
              <p class="text-2xl font-bold text-theme-text-emphasis">{topologies.length}</p>
              <p class="text-xs text-theme-text-muted">Topologies</p>
            </div>
          </div>
        </a>

        <a href="/dashboards" class="card p-4 hover:border-primary/50 transition-colors group">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 bg-info/10 rounded-lg flex items-center justify-center group-hover:bg-info/20 transition-colors">
              <SquaresFour size={20} class="text-info" />
            </div>
            <div>
              <p class="text-2xl font-bold text-theme-text-emphasis">{dashboards.length}</p>
              <p class="text-xs text-theme-text-muted">Dashboards</p>
            </div>
          </div>
        </a>

        <a href="/datasources" class="card p-4 hover:border-primary/50 transition-colors group">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 bg-warning/10 rounded-lg flex items-center justify-center group-hover:bg-warning/20 transition-colors">
              <Database size={20} class="text-warning" />
            </div>
            <div>
              <p class="text-2xl font-bold text-theme-text-emphasis">{connectedSources}<span class="text-sm font-normal text-theme-text-muted">/{dataSources.length}</span></p>
              <p class="text-xs text-theme-text-muted">Data Sources</p>
            </div>
          </div>
        </a>

        <div class="card p-4">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 bg-success/10 rounded-lg flex items-center justify-center">
              <div class="w-3 h-3 bg-success rounded-full animate-pulse"></div>
            </div>
            <div>
              <p class="text-lg font-bold text-success">Online</p>
              <p class="text-xs text-theme-text-muted">Server Status</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Two Column Layout -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Topologies -->
        <div class="card">
          <div class="px-4 py-3 border-b border-theme-border flex items-center justify-between">
            <h2 class="font-semibold text-theme-text-emphasis">Topologies</h2>
            <a href="/topologies" class="text-xs text-primary hover:underline flex items-center gap-1">
              View all <ArrowRight size={12} />
            </a>
          </div>
          <div class="p-2">
            {#if topologies.length === 0}
              <div class="text-center py-8">
                <TreeStructure size={40} class="text-theme-text-muted mx-auto mb-3" />
                <p class="text-sm text-theme-text-muted mb-3">No topologies yet</p>
                <a href="/topologies" class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded text-sm hover:bg-primary-dark transition-colors">
                  <Plus size={14} />
                  Create Topology
                </a>
              </div>
            {:else}
              {#each topologies.slice(0, 4) as topology}
                <a
                  href="/topologies/{topology.id}"
                  class="flex items-center gap-3 p-2 rounded-lg hover:bg-theme-bg transition-colors"
                >
                  <div class="w-8 h-8 bg-primary/10 rounded flex items-center justify-center flex-shrink-0">
                    <TreeStructure size={16} class="text-primary" />
                  </div>
                  <div class="min-w-0 flex-1">
                    <p class="font-medium text-sm text-theme-text-emphasis truncate">{topology.name}</p>
                    <p class="text-xs text-theme-text-muted">
                      {new Date(topology.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                </a>
              {/each}
            {/if}
          </div>
        </div>

        <!-- Dashboards -->
        <div class="card">
          <div class="px-4 py-3 border-b border-theme-border flex items-center justify-between">
            <h2 class="font-semibold text-theme-text-emphasis">Dashboards</h2>
            <a href="/dashboards" class="text-xs text-primary hover:underline flex items-center gap-1">
              View all <ArrowRight size={12} />
            </a>
          </div>
          <div class="p-2">
            {#if dashboards.length === 0}
              <div class="text-center py-8">
                <SquaresFour size={40} class="text-theme-text-muted mx-auto mb-3" />
                <p class="text-sm text-theme-text-muted mb-3">No dashboards yet</p>
                <a href="/dashboards" class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded text-sm hover:bg-primary-dark transition-colors">
                  <Plus size={14} />
                  Create Dashboard
                </a>
              </div>
            {:else}
              {#each dashboards.slice(0, 4) as dashboard}
                <a
                  href="/dashboards/{dashboard.id}"
                  class="flex items-center gap-3 p-2 rounded-lg hover:bg-theme-bg transition-colors"
                >
                  <div class="w-8 h-8 bg-info/10 rounded flex items-center justify-center flex-shrink-0">
                    <SquaresFour size={16} class="text-info" />
                  </div>
                  <div class="min-w-0 flex-1">
                    <p class="font-medium text-sm text-theme-text-emphasis truncate">{dashboard.name}</p>
                    <p class="text-xs text-theme-text-muted">
                      {new Date(dashboard.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                </a>
              {/each}
            {/if}
          </div>
        </div>
      </div>
    </div>
  {/if}
</div>
