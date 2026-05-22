<script lang="ts">
  import { type NetworkGraph, YamlParser } from '@shumoku/core'
  import { ArrowLeftIcon } from 'phosphor-svelte'
  import { goto } from '$app/navigation'
  import { page } from '$app/stores'
  import { api } from '$lib/api'

  // Both params always defined by the route shape.
  // biome-ignore lint/style/noNonNullAssertion: route params are guaranteed by SvelteKit
  const topologyId = $derived($page.params.id!)
  // biome-ignore lint/style/noNonNullAssertion: route params are guaranteed by SvelteKit
  const sourceId = $derived($page.params.sourceId!)

  let loading = $state(true)
  let saving = $state(false)
  let error = $state('')

  let topologyName = $state<string | null>(null)
  let sourceName = $state<string | null>(null)
  let sourceType = $state<string | null>(null)

  let editorMode = $state<'yaml' | 'json'>('yaml')
  let yamlContent = $state('')
  let jsonContent = $state('')

  function graphToYaml(graph: Record<string, unknown>): string {
    // Top-level shape walker — anything not enumerated below round-trips
    // via the JSON tab. Same converter as the original /edit page.
    const lines: string[] = []
    if (graph['name']) lines.push(`name: ${graph['name']}`)
    if (graph['version']) lines.push(`version: "${graph['version']}"`)
    if (graph['description']) lines.push(`description: ${graph['description']}`)
    lines.push('')
    lines.push('nodes:')
    const nodes = (graph['nodes'] as Array<Record<string, unknown>>) || []
    for (const node of nodes) {
      lines.push(`  - id: ${node['id']}`)
      if (node['label']) lines.push(`    label: ${node['label']}`)
      if (node['type']) lines.push(`    type: ${node['type']}`)
      if (node['vendor']) lines.push(`    vendor: ${node['vendor']}`)
      if (node['model']) lines.push(`    model: ${node['model']}`)
      if (node['parent']) lines.push(`    parent: ${node['parent']}`)
    }
    lines.push('')
    lines.push('links:')
    const links = (graph['links'] as Array<Record<string, unknown>>) || []
    for (const link of links) {
      const from = link['from'] as string | { node: string; port?: string }
      const to = link['to'] as string | { node: string; port?: string }
      if (typeof from === 'string') lines.push(`  - from: ${from}`)
      else {
        lines.push(`  - from:`)
        lines.push(`      node: ${from.node}`)
        if (from.port) lines.push(`      port: ${from.port}`)
      }
      if (typeof to === 'string') lines.push(`    to: ${to}`)
      else {
        lines.push(`    to:`)
        lines.push(`      node: ${to.node}`)
        if (to.port) lines.push(`      port: ${to.port}`)
      }
      if (link['bandwidth']) lines.push(`    bandwidth: ${link['bandwidth']}`)
    }
    const subgraphs = graph['subgraphs'] as Array<Record<string, unknown>> | undefined
    if (subgraphs && subgraphs.length > 0) {
      lines.push('')
      lines.push('subgraphs:')
      for (const sg of subgraphs) {
        lines.push(`  - id: ${sg['id']}`)
        if (sg['label']) lines.push(`    label: ${sg['label']}`)
        if (sg['parent']) lines.push(`    parent: ${sg['parent']}`)
      }
    }
    return lines.join('\n')
  }

  function switchMode(mode: 'yaml' | 'json') {
    if (mode === editorMode) return
    try {
      if (mode === 'json') {
        const parser = new YamlParser()
        const result = parser.parse(yamlContent)
        jsonContent = JSON.stringify(result.graph, null, 2)
      } else {
        const graph = JSON.parse(jsonContent)
        yamlContent = graphToYaml(graph)
      }
      editorMode = mode
      error = ''
    } catch (e) {
      error = e instanceof Error ? e.message : `Failed to convert to ${mode.toUpperCase()}`
    }
  }

  $effect(() => {
    const tid = topologyId
    const sid = sourceId
    let cancelled = false
    loading = true
    error = ''
    ;(async () => {
      try {
        const [topology, source, snap] = await Promise.all([
          api.topologies.get(tid),
          api.dataSources.get(sid),
          api.topologies.sources.latestSnapshot(tid, sid),
        ])
        if (cancelled) return
        topologyName = topology.name
        sourceName = source.name
        sourceType = source.type
        const graph = (snap.graph ?? { version: '1', nodes: [], links: [] }) as unknown as Record<
          string,
          unknown
        >
        jsonContent = JSON.stringify(graph, null, 2)
        yamlContent = graphToYaml(graph)
      } catch (e) {
        if (!cancelled) error = e instanceof Error ? e.message : 'Failed to load'
      } finally {
        if (!cancelled) loading = false
      }
    })()
    return () => {
      cancelled = true
    }
  })

  async function handleSave() {
    saving = true
    error = ''
    try {
      let graph: NetworkGraph
      if (editorMode === 'yaml') {
        const parser = new YamlParser()
        const result = parser.parse(yamlContent)
        graph = result.graph
      } else {
        graph = JSON.parse(jsonContent)
      }
      await api.topologies.sources.recordObservation(topologyId, sourceId, graph)
      goto(`/topologies/${topologyId}`)
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to save'
    } finally {
      saving = false
    }
  }
</script>

<svelte:head> <title>Edit {sourceName ?? 'source'} content — Shumoku</title> </svelte:head>

<div class="p-6 h-full flex flex-col">
  <a
    href="/topologies/{topologyId}/settings"
    class="inline-flex items-center gap-2 text-theme-text-muted hover:text-theme-text mb-4"
  >
    <ArrowLeftIcon size={16} />
    Back to {topologyName ?? 'topology'}
  </a>

  {#if loading}
    <div class="flex items-center justify-center py-12 flex-1">
      <div
        class="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"
      ></div>
    </div>
  {:else}
    <div class="mb-4">
      <h1 class="text-2xl font-semibold text-theme-text-emphasis">
        Edit {sourceName ?? sourceType ?? 'source'} content
      </h1>
      <p class="text-sm text-theme-text-muted mt-1">
        Editing the {sourceType ?? '—'} source 's snapshot for
        <strong>{topologyName ?? topologyId}</strong>. Save records a new observation.
      </p>
    </div>

    <div class="card flex-1 flex flex-col overflow-hidden">
      <div class="p-4 border-b border-theme-border flex items-center justify-between">
        {#if error}
          <div
            class="p-3 bg-danger/10 border border-danger/20 rounded-lg text-danger text-sm flex-1 mr-4"
          >
            {error}
          </div>
        {:else}
          <div></div>
        {/if}
        <div class="flex items-center gap-2">
          <span class="text-sm text-theme-text-muted">Format:</span>
          <button
            type="button"
            class="px-3 py-1 text-sm rounded-lg {editorMode === 'yaml' ? 'bg-primary text-primary-foreground' : 'bg-theme-bg hover:bg-theme-bg-canvas text-theme-text'}"
            onclick={() => switchMode('yaml')}
          >
            YAML
          </button>
          <button
            type="button"
            class="px-3 py-1 text-sm rounded-lg {editorMode === 'json' ? 'bg-primary text-primary-foreground' : 'bg-theme-bg hover:bg-theme-bg-canvas text-theme-text'}"
            onclick={() => switchMode('json')}
          >
            JSON
          </button>
        </div>
      </div>

      <div class="flex-1 overflow-hidden">
        {#if editorMode === 'yaml'}
          <textarea
            class="w-full h-full p-4 font-mono text-sm bg-theme-bg-elevated border-0 resize-none focus:outline-none"
            bind:value={yamlContent}
            placeholder="Enter YAML content..."
          ></textarea>
        {:else}
          <textarea
            class="w-full h-full p-4 font-mono text-sm bg-theme-bg-elevated border-0 resize-none focus:outline-none"
            bind:value={jsonContent}
            placeholder="Enter JSON content..."
          ></textarea>
        {/if}
      </div>

      <div class="flex justify-between items-center gap-2 p-4 border-t border-theme-border">
        <p class="text-xs text-theme-text-muted">Editing as {editorMode.toUpperCase()}</p>
        <div class="flex gap-2">
          <a href="/topologies/{topologyId}" class="btn btn-secondary">Cancel</a>
          <button type="button" class="btn btn-primary" disabled={saving} onclick={handleSave}>
            {#if saving}
              <span
                class="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2"
              ></span>
            {/if}
            Save Changes
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>
