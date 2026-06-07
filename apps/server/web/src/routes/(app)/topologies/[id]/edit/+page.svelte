<script lang="ts">
  /**
   * Edit the project's own (intrinsic) graph — the topology's hand-authored
   * contribution. NOT a data source: every topology has one, edited here and
   * resolved as the top-priority contribution. Reads/writes via
   * GET/PUT /api/topologies/:id/intrinsic. A YAML tab for quick edits; a JSON tab
   * for anything the YAML serializer doesn't round-trip.
   */
  import { type NetworkGraph, YamlParser } from '@shumoku/core'
  import { FloppyDiskIcon } from 'phosphor-svelte'
  import { onMount } from 'svelte'
  import { api } from '$lib/api'
  import { Button } from '$lib/components/ui/button'
  import { graphToYaml } from '$lib/graph-yaml'
  import { useTopologyCtx } from '../_context.svelte'

  const ctx = useTopologyCtx()

  let editorMode = $state<'yaml' | 'json'>('yaml')
  let yamlContent = $state('')
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
      const g = graph ?? ({ version: '1', name: ctx.topology.name, nodes: [], links: [] } as NetworkGraph)
      jsonContent = JSON.stringify(g, null, 2)
      yamlContent = graphToYaml(g as unknown as Record<string, unknown>)
    } catch (e) {
      error = e instanceof Error ? e.message : String(e)
    } finally {
      loading = false
    }
  }

  function switchMode(mode: 'yaml' | 'json') {
    if (mode === editorMode) return
    try {
      if (mode === 'json') {
        const result = new YamlParser().parse(yamlContent)
        jsonContent = JSON.stringify(result.graph, null, 2)
      } else {
        yamlContent = graphToYaml(JSON.parse(jsonContent))
      }
      editorMode = mode
      error = null
    } catch (e) {
      error = `Can't switch tab — fix the current ${editorMode.toUpperCase()} first: ${e instanceof Error ? e.message : String(e)}`
    }
  }

  function graphFromEditor(): NetworkGraph {
    return editorMode === 'yaml'
      ? (new YamlParser().parse(yamlContent).graph as NetworkGraph)
      : (JSON.parse(jsonContent) as NetworkGraph)
  }

  async function save() {
    if (!ctx.topology?.id) return
    saving = true
    error = null
    try {
      await api.topologies.putIntrinsic(ctx.topology.id, graphFromEditor())
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
        The project's own graph — folded with every attached source at top priority.
      </p>
    </div>
    <div class="flex items-center gap-2">
      <div class="flex rounded border border-theme-border p-0.5">
        <button
          type="button"
          class="px-2 py-0.5 text-xs rounded {editorMode === 'yaml'
            ? 'bg-primary text-primary-foreground'
            : 'text-theme-text hover:bg-theme-bg-canvas'}"
          onclick={() => switchMode('yaml')}
        >
          YAML
        </button>
        <button
          type="button"
          class="px-2 py-0.5 text-xs rounded {editorMode === 'json'
            ? 'bg-primary text-primary-foreground'
            : 'text-theme-text hover:bg-theme-bg-canvas'}"
          onclick={() => switchMode('json')}
        >
          JSON
        </button>
      </div>
      <Button onclick={save} disabled={saving || loading}>
        <FloppyDiskIcon size={16} class="mr-2" />
        {saving ? 'Saving…' : 'Save'}
      </Button>
    </div>
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
  {:else if editorMode === 'yaml'}
    <textarea
      bind:value={yamlContent}
      spellcheck="false"
      class="h-[60vh] w-full rounded border border-theme-border bg-theme-bg-canvas p-3 font-mono text-sm"
    ></textarea>
  {:else}
    <textarea
      bind:value={jsonContent}
      spellcheck="false"
      class="h-[60vh] w-full rounded border border-theme-border bg-theme-bg-canvas p-3 font-mono text-sm"
    ></textarea>
  {/if}
</div>
