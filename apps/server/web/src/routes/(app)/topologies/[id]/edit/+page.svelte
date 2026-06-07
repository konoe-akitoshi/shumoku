<script lang="ts">
  /**
   * Edit the project's own (intrinsic) graph — the topology's hand-authored
   * contribution. NOT a data source: every topology has one, edited here and
   * resolved as the top-priority contribution. Reads/writes via
   * GET/PUT /api/topologies/:id/intrinsic.
   *
   * JSON, deliberately: the intrinsic carries the FULL authored graph — ports,
   * identities, metrics-binding attachments, exclusions, settings, terminations.
   * A lossy YAML serializer would silently drop those on save (it round-trips
   * only a handful of fields), so editing the canonical graph is JSON to stay
   * lossless. `save` parses + replaces the whole intrinsic atomically.
   */
  import type { NetworkGraph } from '@shumoku/core'
  import { FloppyDiskIcon } from 'phosphor-svelte'
  import { onMount } from 'svelte'
  import { api } from '$lib/api'
  import { Button } from '$lib/components/ui/button'
  import { useTopologyCtx } from '../_context.svelte'

  const ctx = useTopologyCtx()

  let jsonContent = $state('')
  let loading = $state(true)
  let saving = $state(false)
  let error = $state<string | null>(null)
  let savedAt = $state<number | null>(null)

  onMount(load)

  async function load() {
    if (!ctx.topology?.id) return
    loading = true
    error = null
    try {
      const { graph } = await api.topologies.getIntrinsic(ctx.topology.id)
      const g =
        graph ?? ({ version: '1', name: ctx.topology.name, nodes: [], links: [] } as NetworkGraph)
      jsonContent = JSON.stringify(g, null, 2)
    } catch (e) {
      error = e instanceof Error ? e.message : String(e)
    } finally {
      loading = false
    }
  }

  async function save() {
    if (!ctx.topology?.id) return
    let graph: NetworkGraph
    try {
      graph = JSON.parse(jsonContent) as NetworkGraph
    } catch (e) {
      error = `Invalid JSON: ${e instanceof Error ? e.message : String(e)}`
      return
    }
    if (!Array.isArray(graph.nodes) || !Array.isArray(graph.links)) {
      error = 'graph.nodes and graph.links must be arrays'
      return
    }
    saving = true
    error = null
    try {
      await api.topologies.putIntrinsic(ctx.topology.id, graph)
      savedAt = Date.now()
      // Committed edit → re-resolve + re-render the diagram.
      ctx.bumpRevision()
    } catch (e) {
      error = e instanceof Error ? e.message : String(e)
    } finally {
      saving = false
    }
  }
</script>

<div class="space-y-4">
  <div class="flex items-center justify-between">
    <div>
      <h2 class="font-medium text-theme-text-emphasis">Edit graph content</h2>
      <p class="text-sm text-theme-text-muted">
        The project's own graph (JSON) — folded with every attached source at top priority.
      </p>
    </div>
    <Button onclick={save} disabled={saving || loading}>
      <FloppyDiskIcon size={16} class="mr-2" />
      {saving ? 'Saving…' : 'Save'}
    </Button>
  </div>

  {#if error}
    <div class="rounded border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-400">
      {error}
    </div>
  {/if}
  {#if savedAt && !error}
    <div class="text-xs text-theme-text-muted">Saved.</div>
  {/if}

  {#if loading}
    <div class="text-sm text-theme-text-muted">Loading…</div>
  {:else}
    <textarea
      bind:value={jsonContent}
      spellcheck="false"
      class="h-[60vh] w-full rounded border border-theme-border bg-theme-bg-canvas p-3 font-mono text-sm"
    ></textarea>
  {/if}
</div>
