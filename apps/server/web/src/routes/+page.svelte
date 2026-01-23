<script lang="ts">
import { onMount } from 'svelte'
import { api } from '$lib/api'
import type { Topology, DataSource } from '$lib/types'
import TreeStructure from 'phosphor-svelte/lib/TreeStructure'
import Database from 'phosphor-svelte/lib/Database'
import CheckCircle from 'phosphor-svelte/lib/CheckCircle'
import Plus from 'phosphor-svelte/lib/Plus'
import GearSix from 'phosphor-svelte/lib/GearSix'
import CaretRight from 'phosphor-svelte/lib/CaretRight'

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
            <TreeStructure size={24} class="text-primary" />
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
            <Database size={24} class="text-info" />
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
            <CheckCircle size={24} class="text-success" />
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
          <Plus size={16} class="mr-2" />
          New Topology
        </a>
        <a href="/datasources" class="btn btn-secondary">
          <Database size={16} class="mr-2" />
          Manage Data Sources
        </a>
        <a href="/settings" class="btn btn-secondary">
          <GearSix size={16} class="mr-2" />
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
            <TreeStructure size={48} class="text-theme-text-muted mx-auto mb-4" />
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
                    <TreeStructure size={20} class="text-primary" />
                  </div>
                  <div>
                    <p class="font-medium text-theme-text-emphasis">{topology.name}</p>
                    <p class="text-xs text-theme-text-muted">
                      Updated {new Date(topology.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <CaretRight size={20} class="text-theme-text-muted" />
              </a>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>
