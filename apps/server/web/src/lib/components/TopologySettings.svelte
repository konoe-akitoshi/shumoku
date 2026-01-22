<script lang="ts">
  import { goto } from '$app/navigation'
  import { api } from '$lib/api'
  import { Button } from '$lib/components/ui/button'
  import {
    displaySettings,
    metricsConnected,
    liveUpdatesEnabled,
    showTrafficFlow,
    showNodeStatus,
  } from '$lib/stores'
  import type { Topology } from '$lib/types'

  export let topology: Topology
  export let renderData: { nodeCount: number; edgeCount: number } | null = null
  export let onDeleted: (() => void) | null = null

  let deleting = false

  async function handleDelete() {
    if (!confirm(`Delete topology "${topology.name}"? This action cannot be undone.`)) {
      return
    }
    deleting = true
    try {
      await api.topologies.delete(topology.id)
      if (onDeleted) {
        onDeleted()
      } else {
        goto('/topologies')
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to delete')
      deleting = false
    }
  }
</script>

<div class="space-y-4">
  <!-- General -->
  <div class="space-y-3">
    <h3 class="text-xs font-medium text-theme-text-muted uppercase tracking-wide">General</h3>
    <div class="space-y-2">
      <div>
        <p class="text-xs text-theme-text-muted">Name</p>
        <p class="text-sm font-medium text-theme-text-emphasis">{topology.name}</p>
      </div>
      <div>
        <p class="text-xs text-theme-text-muted">ID</p>
        <p class="text-xs font-mono text-theme-text">{topology.id}</p>
      </div>
    </div>
  </div>

  <hr class="border-theme-border" />

  <!-- Statistics -->
  {#if renderData}
    <div class="space-y-3">
      <h3 class="text-xs font-medium text-theme-text-muted uppercase tracking-wide">Statistics</h3>
      <div class="grid grid-cols-2 gap-3">
        <div class="bg-theme-bg rounded-lg p-3">
          <p class="text-xs text-theme-text-muted">Nodes</p>
          <p class="text-xl font-semibold text-theme-text-emphasis">{renderData.nodeCount}</p>
        </div>
        <div class="bg-theme-bg rounded-lg p-3">
          <p class="text-xs text-theme-text-muted">Edges</p>
          <p class="text-xl font-semibold text-theme-text-emphasis">{renderData.edgeCount}</p>
        </div>
      </div>
      <div class="space-y-2">
        <div>
          <p class="text-xs text-theme-text-muted">Data Source</p>
          <p class="text-sm text-theme-text">{topology.dataSourceId || 'None'}</p>
        </div>
        <div>
          <p class="text-xs text-theme-text-muted">Updated</p>
          <p class="text-sm text-theme-text">{new Date(topology.updatedAt).toLocaleString()}</p>
        </div>
      </div>
    </div>

    <hr class="border-theme-border" />
  {/if}

  <!-- Display Settings -->
  <div class="space-y-3">
    <h3 class="text-xs font-medium text-theme-text-muted uppercase tracking-wide">Display</h3>

    <!-- Connection Status (read-only indicator) -->
    <div class="flex items-center justify-between py-2">
      <div>
        <p class="text-sm text-theme-text">Connection Status</p>
        <p class="text-xs text-theme-text-muted">Real-time data stream</p>
      </div>
      <div class="flex items-center gap-2">
        {#if $metricsConnected}
          <span class="w-2 h-2 bg-success rounded-full animate-pulse"></span>
          <span class="text-xs text-success font-medium">Live</span>
        {:else}
          <span class="w-2 h-2 bg-theme-text-muted rounded-full"></span>
          <span class="text-xs text-theme-text-muted">Offline</span>
        {/if}
      </div>
    </div>

    <hr class="border-theme-border/50" />

    <!-- Live Updates Toggle -->
    <label class="flex items-center justify-between py-2 cursor-pointer">
      <div>
        <p class="text-sm text-theme-text">Live Updates</p>
        <p class="text-xs text-theme-text-muted">Connect to metrics server</p>
      </div>
      <input
        type="checkbox"
        class="toggle"
        checked={$liveUpdatesEnabled}
        on:change={(e) => displaySettings.setLiveUpdates(e.currentTarget.checked)}
      />
    </label>

    <!-- Traffic Flow Toggle -->
    <label class="flex items-center justify-between py-2 cursor-pointer {!$liveUpdatesEnabled ? 'opacity-50' : ''}">
      <div>
        <p class="text-sm text-theme-text">Traffic Flow</p>
        <p class="text-xs text-theme-text-muted">Show link utilization colors</p>
      </div>
      <input
        type="checkbox"
        class="toggle"
        checked={$showTrafficFlow}
        disabled={!$liveUpdatesEnabled}
        on:change={(e) => displaySettings.setShowTrafficFlow(e.currentTarget.checked)}
      />
    </label>

    <!-- Node Status Toggle -->
    <label class="flex items-center justify-between py-2 cursor-pointer {!$liveUpdatesEnabled ? 'opacity-50' : ''}">
      <div>
        <p class="text-sm text-theme-text">Node Status</p>
        <p class="text-xs text-theme-text-muted">Show up/down indicators</p>
      </div>
      <input
        type="checkbox"
        class="toggle"
        checked={$showNodeStatus}
        disabled={!$liveUpdatesEnabled}
        on:change={(e) => displaySettings.setShowNodeStatus(e.currentTarget.checked)}
      />
    </label>
  </div>

  <hr class="border-theme-border" />

  <!-- Actions -->
  <div class="space-y-3">
    <h3 class="text-xs font-medium text-theme-text-muted uppercase tracking-wide">Actions</h3>
    <div class="space-y-2">
      <a href="/topologies/{topology.id}/edit" class="btn btn-secondary w-full justify-center">
        <svg class="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
        Edit YAML
      </a>
    </div>
  </div>

  <hr class="border-theme-border" />

  <!-- Danger Zone -->
  <div class="space-y-3">
    <h3 class="text-xs font-medium text-danger uppercase tracking-wide">Danger Zone</h3>
    <div>
      <p class="text-xs text-theme-text-muted mb-2">Once deleted, this topology cannot be recovered.</p>
      <Button variant="destructive" class="w-full justify-center" onclick={handleDelete} disabled={deleting}>
        {#if deleting}
          <span class="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2"></span>
        {:else}
          <svg class="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
        {/if}
        Delete Topology
      </Button>
    </div>
  </div>
</div>
