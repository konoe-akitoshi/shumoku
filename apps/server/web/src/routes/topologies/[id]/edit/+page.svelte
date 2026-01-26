<script lang="ts">
import { onMount } from 'svelte'
import { page } from '$app/stores'
import { goto } from '$app/navigation'
import { api } from '$lib/api'
import { YamlParser } from '@shumoku/parser-yaml'
import type { Topology } from '$lib/types'
import ArrowLeft from 'phosphor-svelte/lib/ArrowLeft'

// Get ID from route params (always defined for this route)
$: id = $page.params.id!

let topology: Topology | null = null
let loading = true
let error = ''
let saving = false

// Editor state
let editorMode: 'yaml' | 'json' = 'yaml'
let yamlContent = ''
let jsonContent = ''

onMount(async () => {
  try {
    topology = await api.topologies.get(id)

    // Parse stored JSON and display as YAML for editing
    const graph = JSON.parse(topology.contentJson)
    jsonContent = JSON.stringify(graph, null, 2)

    // Convert to YAML for display (simple conversion)
    yamlContent = graphToYaml(graph)
  } catch (e) {
    error = e instanceof Error ? e.message : 'Failed to load topology'
  } finally {
    loading = false
  }
})

// Simple NetworkGraph to YAML converter
function graphToYaml(graph: Record<string, unknown>): string {
  const lines: string[] = []

  if (graph.name) lines.push(`name: ${graph.name}`)
  if (graph.version) lines.push(`version: "${graph.version}"`)
  if (graph.description) lines.push(`description: ${graph.description}`)

  lines.push('')
  lines.push('nodes:')
  const nodes = (graph.nodes as Array<Record<string, unknown>>) || []
  for (const node of nodes) {
    lines.push(`  - id: ${node.id}`)
    if (node.label) lines.push(`    label: ${node.label}`)
    if (node.type) lines.push(`    type: ${node.type}`)
    if (node.vendor) lines.push(`    vendor: ${node.vendor}`)
    if (node.model) lines.push(`    model: ${node.model}`)
    if (node.parent) lines.push(`    parent: ${node.parent}`)
  }

  lines.push('')
  lines.push('links:')
  const links = (graph.links as Array<Record<string, unknown>>) || []
  for (const link of links) {
    const from = link.from as string | { node: string; port?: string }
    const to = link.to as string | { node: string; port?: string }

    if (typeof from === 'string') {
      lines.push(`  - from: ${from}`)
    } else {
      lines.push(`  - from:`)
      lines.push(`      node: ${from.node}`)
      if (from.port) lines.push(`      port: ${from.port}`)
    }

    if (typeof to === 'string') {
      lines.push(`    to: ${to}`)
    } else {
      lines.push(`    to:`)
      lines.push(`      node: ${to.node}`)
      if (to.port) lines.push(`      port: ${to.port}`)
    }

    if (link.bandwidth) lines.push(`    bandwidth: ${link.bandwidth}`)
  }

  const subgraphs = graph.subgraphs as Array<Record<string, unknown>> | undefined
  if (subgraphs && subgraphs.length > 0) {
    lines.push('')
    lines.push('subgraphs:')
    for (const sg of subgraphs) {
      lines.push(`  - id: ${sg.id}`)
      if (sg.label) lines.push(`    label: ${sg.label}`)
      if (sg.parent) lines.push(`    parent: ${sg.parent}`)
    }
  }

  return lines.join('\n')
}

function switchMode(mode: 'yaml' | 'json') {
  if (mode === editorMode) return

  if (mode === 'json') {
    // YAML -> JSON
    try {
      const parser = new YamlParser()
      const result = parser.parse(yamlContent)
      jsonContent = JSON.stringify(result.graph, null, 2)
      editorMode = 'json'
      error = ''
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to parse YAML'
    }
  } else {
    // JSON -> YAML
    try {
      const graph = JSON.parse(jsonContent)
      yamlContent = graphToYaml(graph)
      editorMode = 'yaml'
      error = ''
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to parse JSON'
    }
  }
}

async function handleSave() {
  saving = true
  error = ''

  try {
    let contentJson: string

    if (editorMode === 'yaml') {
      // Parse YAML to NetworkGraph JSON
      const parser = new YamlParser()
      const result = parser.parse(yamlContent)
      contentJson = JSON.stringify(result.graph)
    } else {
      // Validate JSON
      JSON.parse(jsonContent)
      contentJson = jsonContent
    }

    await api.topologies.update(id, { contentJson })
    goto(`/topologies/${id}`)
  } catch (e) {
    error = e instanceof Error ? e.message : 'Failed to save'
  } finally {
    saving = false
  }
}
</script>

<svelte:head>
  <title>Edit {topology?.name || 'Topology'} - Shumoku</title>
</svelte:head>

<div class="p-6 h-full flex flex-col">
  <!-- Back link -->
  <a href="/topologies/{$page.params.id}" class="inline-flex items-center gap-2 text-theme-text-muted hover:text-theme-text mb-4">
    <ArrowLeft size={16} />
    Back to Topology
  </a>

  {#if loading}
    <div class="flex items-center justify-center py-12 flex-1">
      <div class="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
    </div>
  {:else if error && !topology}
    <div class="card p-6 text-center">
      <p class="text-danger">{error}</p>
      <a href="/topologies" class="btn btn-secondary mt-4">Go Back</a>
    </div>
  {:else if topology}
    <div class="flex items-center justify-between mb-4">
      <h1 class="text-2xl font-semibold text-theme-text-emphasis">Edit {topology.name}</h1>
    </div>

    <div class="card flex-1 flex flex-col overflow-hidden">
      <div class="p-4 border-b border-theme-border">
        {#if error}
          <div class="p-3 bg-danger/10 border border-danger/20 rounded-lg text-danger text-sm mb-4">
            {error}
          </div>
        {/if}

        <!-- Mode toggle -->
        <div class="flex items-center gap-2">
          <span class="text-sm text-theme-text-muted">Format:</span>
          <button
            type="button"
            class="px-3 py-1 text-sm rounded-lg transition-colors {editorMode === 'yaml' ? 'bg-primary text-primary-foreground' : 'bg-theme-bg hover:bg-theme-bg-canvas text-theme-text'}"
            onclick={() => switchMode('yaml')}
          >
            YAML
          </button>
          <button
            type="button"
            class="px-3 py-1 text-sm rounded-lg transition-colors {editorMode === 'json' ? 'bg-primary text-primary-foreground' : 'bg-theme-bg hover:bg-theme-bg-canvas text-theme-text'}"
            onclick={() => switchMode('json')}
          >
            JSON
          </button>
        </div>
      </div>

      <!-- Editor -->
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
        <p class="text-xs text-theme-text-muted">
          Editing as {editorMode.toUpperCase()}
        </p>
        <div class="flex gap-2">
          <a href="/topologies/{$page.params.id}" class="btn btn-secondary">Cancel</a>
          <button type="button" class="btn btn-primary" disabled={saving} onclick={handleSave}>
            {#if saving}
              <span class="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2"></span>
            {/if}
            Save Changes
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>
