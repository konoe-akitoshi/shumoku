<script lang="ts">
  /**
   * Settings — display preferences + danger zone for a topology.
   *
   * Used to be a 5-tab monolith holding Sources / Discovery / Mapping /
   * Resolved as well; those have all been promoted to siblings under
   * `/topologies/[id]/` (each its own subroute) because they're not
   * "settings" — they're workspaces. What remains here is genuinely
   * configuration: edge style, live-updates toggles, edit Manual
   * shortcut, delete.
   *
   * Statistics card stays because the layout's breadcrumb intentionally
   * doesn't carry node/edge counts (they're noise everywhere except
   * here, where the operator might be deciding whether the topology
   * is big enough to keep).
   */
  import { PencilSimpleIcon, TrashIcon } from 'phosphor-svelte'
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import { api } from '$lib/api'
  import { Button } from '$lib/components/ui/button'
  import {
    displaySettings,
    liveUpdatesEnabled,
    metricsConnected,
    showNodeStatus,
    showTrafficFlow,
    topologies,
  } from '$lib/stores'
  import { useTopologyCtx } from '../_context.svelte'

  const ctx = useTopologyCtx()

  let edgeStyle = $state('orthogonal')
  let splineMode = $state('sloppy')
  let savingEdgeStyle = $state(false)
  let deleting = $state(false)

  onMount(() => {
    void parseGraphSettings()
  })

  // Re-parse if the topology changes (e.g. user navigates [id]).
  $effect(() => {
    if (ctx.topology?.manualSourceId) void parseGraphSettings()
  })

  /**
   * edgeStyle / splineMode live on `NetworkGraph.settings` inside the Manual
   * source's authored graph, which is now a per-topology observation. Read the
   * latest snapshot; write by recording a new observation.
   */
  async function parseGraphSettings() {
    if (!ctx.topology?.manualSourceId) return
    try {
      const snap = await api.topologies.sources.latestSnapshot(
        ctx.topology.id,
        ctx.topology.manualSourceId,
      )
      const settings = (
        snap?.graph as { settings?: { edgeStyle?: string; splineMode?: string } } | null
      )?.settings
      edgeStyle = settings?.edgeStyle || 'orthogonal'
      splineMode = settings?.splineMode || 'sloppy'
    } catch {
      // Use defaults
    }
  }

  async function updateEdgeStyle() {
    if (!ctx.topology?.manualSourceId) return
    savingEdgeStyle = true
    try {
      const snap = await api.topologies.sources.latestSnapshot(
        ctx.topology.id,
        ctx.topology.manualSourceId,
      )
      const graph = (snap?.graph ?? { version: '1', nodes: [], links: [] }) as unknown as {
        settings?: Record<string, unknown>
        [k: string]: unknown
      }
      graph.settings = (graph.settings ?? {}) as Record<string, unknown>
      graph.settings['edgeStyle'] = edgeStyle
      if (edgeStyle === 'splines') graph.settings['splineMode'] = splineMode
      else delete graph.settings['splineMode']
      await api.topologies.sources.recordObservation(
        ctx.topology.id,
        ctx.topology.manualSourceId,
        graph as unknown as Parameters<typeof api.topologies.sources.recordObservation>[2],
        'ok',
      )
    } catch (e) {
      console.error('Failed to update edge style:', e)
    } finally {
      savingEdgeStyle = false
    }
  }

  async function handleDelete() {
    if (!ctx.topology) return
    if (!confirm(`Delete topology "${ctx.topology.name}"? This action cannot be undone.`)) return
    deleting = true
    try {
      await topologies.delete(ctx.topology.id)
      goto('/topologies')
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to delete')
      deleting = false
    }
  }
</script>

<div class="p-4 space-y-4">
  <!-- Statistics -->
  {#if ctx.renderData}
    <div class="card">
      <div class="card-header">
        <h2 class="font-medium text-theme-text-emphasis">Statistics</h2>
      </div>
      <div class="card-body">
        <div class="grid grid-cols-3 gap-4">
          <div class="bg-theme-bg rounded-lg p-3">
            <p class="text-xs text-theme-text-muted">Nodes</p>
            <p class="text-xl font-semibold text-theme-text-emphasis">{ctx.renderData.nodeCount}</p>
          </div>
          <div class="bg-theme-bg rounded-lg p-3">
            <p class="text-xs text-theme-text-muted">Edges</p>
            <p class="text-xl font-semibold text-theme-text-emphasis">{ctx.renderData.edgeCount}</p>
          </div>
          <div class="bg-theme-bg rounded-lg p-3">
            <p class="text-xs text-theme-text-muted">Updated</p>
            <p class="text-sm text-theme-text">
              {ctx.topology ? new Date(ctx.topology.updatedAt).toLocaleDateString() : '—'}
            </p>
          </div>
        </div>
      </div>
    </div>
  {/if}

  <!-- Display -->
  <div class="card">
    <div class="card-header">
      <h2 class="font-medium text-theme-text-emphasis">Display</h2>
    </div>
    <div class="card-body space-y-4">
      <div>
        <label for="edgeStyle" class="text-sm text-theme-text block mb-1">Edge Style</label>
        <select
          id="edgeStyle"
          class="input w-full"
          bind:value={edgeStyle}
          onchange={updateEdgeStyle}
          disabled={savingEdgeStyle}
        >
          <option value="orthogonal">Orthogonal (default)</option>
          <option value="polyline">Polyline</option>
          <option value="splines">Splines (curved)</option>
          <option value="straight">Straight</option>
        </select>
      </div>

      {#if edgeStyle === 'splines'}
        <div>
          <label for="splineMode" class="text-sm text-theme-text block mb-1">Spline Mode</label>
          <select
            id="splineMode"
            class="input w-full"
            bind:value={splineMode}
            onchange={updateEdgeStyle}
            disabled={savingEdgeStyle}
          >
            <option value="sloppy">Sloppy</option>
            <option value="conservative">Conservative</option>
            <option value="conservative_soft">Conservative Soft</option>
          </select>
        </div>
      {/if}

      <hr class="border-theme-border">

      <div class="flex items-center justify-between">
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

      <label class="flex items-center justify-between cursor-pointer">
        <div>
          <p class="text-sm text-theme-text">Live Updates</p>
          <p class="text-xs text-theme-text-muted">Connect to metrics server</p>
        </div>
        <input
          type="checkbox"
          class="toggle"
          checked={$liveUpdatesEnabled}
          onchange={(e) => displaySettings.setLiveUpdates(e.currentTarget.checked)}
        >
      </label>

      <label
        class="flex items-center justify-between cursor-pointer {!$liveUpdatesEnabled
          ? 'opacity-50'
          : ''}"
      >
        <div>
          <p class="text-sm text-theme-text">Traffic Flow</p>
          <p class="text-xs text-theme-text-muted">Show link utilization colors</p>
        </div>
        <input
          type="checkbox"
          class="toggle"
          checked={$showTrafficFlow}
          disabled={!$liveUpdatesEnabled}
          onchange={(e) => displaySettings.setShowTrafficFlow(e.currentTarget.checked)}
        >
      </label>

      <label
        class="flex items-center justify-between cursor-pointer {!$liveUpdatesEnabled
          ? 'opacity-50'
          : ''}"
      >
        <div>
          <p class="text-sm text-theme-text">Node Status</p>
          <p class="text-xs text-theme-text-muted">Show up/down indicators</p>
        </div>
        <input
          type="checkbox"
          class="toggle"
          checked={$showNodeStatus}
          disabled={!$liveUpdatesEnabled}
          onchange={(e) => displaySettings.setShowNodeStatus(e.currentTarget.checked)}
        >
      </label>
    </div>
  </div>

  <!-- Actions -->
  {#if ctx.topology?.manualSourceId}
    <div class="card">
      <div class="card-header">
        <h2 class="font-medium text-theme-text-emphasis">Actions</h2>
      </div>
      <div class="card-body">
        <a
          href="/datasources/{ctx.topology.manualSourceId}"
          class="btn btn-secondary w-full justify-center"
        >
          <PencilSimpleIcon size={16} class="mr-2" />
          Edit Manual content
        </a>
      </div>
    </div>
  {/if}

  <!-- Danger zone -->
  <div class="card border-danger/30">
    <div class="card-header">
      <h2 class="font-medium text-danger">Danger Zone</h2>
    </div>
    <div class="card-body">
      <p class="text-xs text-theme-text-muted mb-3">
        Once deleted, this topology cannot be recovered.
      </p>
      <Button
        variant="destructive"
        class="w-full justify-center"
        onclick={handleDelete}
        disabled={deleting}
      >
        {#if deleting}
          <span
            class="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2"
          ></span>
        {:else}
          <TrashIcon size={16} class="mr-2" />
        {/if}
        Delete Topology
      </Button>
    </div>
  </div>
</div>
