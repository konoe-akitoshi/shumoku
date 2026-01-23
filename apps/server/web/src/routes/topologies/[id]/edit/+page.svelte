<script lang="ts">
import { onMount } from 'svelte'
import { page } from '$app/stores'
import { goto } from '$app/navigation'
import { api } from '$lib/api'
import type { Topology, DataSource, TopologyFile } from '$lib/types'
import { parseMultiFileContent, serializeMultiFileContent } from '$lib/types'
import ArrowLeft from 'phosphor-svelte/lib/ArrowLeft'
import Plus from 'phosphor-svelte/lib/Plus'
import X from 'phosphor-svelte/lib/X'

// Get ID from route params (always defined for this route)
$: id = $page.params.id!

let topology: Topology | null = null
let dataSources: DataSource[] = []
let loading = true
let error = ''
let saving = false

// Form state
let formName = ''
let formDataSourceId = ''

// Multi-file state
let files: TopologyFile[] = []
let activeFileIndex = 0

onMount(async () => {
  try {
    const [topoData, dsData] = await Promise.all([api.topologies.get(id), api.dataSources.list()])
    topology = topoData
    dataSources = dsData
    formName = topology.name
    formDataSourceId = topology.dataSourceId || ''

    // Parse multi-file content
    files = parseMultiFileContent(topology.contentJson)
    activeFileIndex = 0
  } catch (e) {
    error = e instanceof Error ? e.message : 'Failed to load topology'
  } finally {
    loading = false
  }
})

function selectFile(index: number) {
  activeFileIndex = index
}

function addFile() {
  const baseName = 'new-file'
  let name = `${baseName}.yaml`
  let counter = 1
  while (files.some((f) => f.name === name)) {
    name = `${baseName}-${counter}.yaml`
    counter++
  }
  files = [...files, { name, content: `# ${name}\n` }]
  activeFileIndex = files.length - 1
}

function removeFile(index: number) {
  if (files.length <= 1) {
    alert('Cannot delete the last file')
    return
  }
  if (files[index].name === 'main.yaml') {
    alert('Cannot delete main.yaml')
    return
  }
  if (!confirm(`Delete "${files[index].name}"?`)) {
    return
  }
  files = files.filter((_, i) => i !== index)
  if (activeFileIndex >= files.length) {
    activeFileIndex = files.length - 1
  }
}

function renameFile(index: number) {
  const file = files[index]
  if (file.name === 'main.yaml') {
    alert('Cannot rename main.yaml')
    return
  }
  const newName = prompt('New file name:', file.name)
  if (newName && newName !== file.name) {
    if (!newName.endsWith('.yaml') && !newName.endsWith('.yml')) {
      alert('File name must end with .yaml or .yml')
      return
    }
    if (files.some((f) => f.name === newName)) {
      alert('A file with this name already exists')
      return
    }
    files = files.map((f, i) => (i === index ? { ...f, name: newName } : f))
  }
}

function updateFileContent(content: string) {
  files = files.map((f, i) => (i === activeFileIndex ? { ...f, content } : f))
}

async function handleSave() {
  if (!formName.trim()) {
    error = 'Name is required'
    return
  }

  // Validate main.yaml exists
  if (!files.some((f) => f.name === 'main.yaml')) {
    error = 'main.yaml is required'
    return
  }

  saving = true
  error = ''

  try {
    const contentJson = serializeMultiFileContent(files)
    await api.topologies.update(id, {
      name: formName.trim(),
      contentJson,
      dataSourceId: formDataSourceId || undefined,
    })
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
      <form class="flex flex-col h-full" onsubmit={(e) => { e.preventDefault(); handleSave(); }}>
        <div class="p-4 border-b border-theme-border space-y-4">
          {#if error}
            <div class="p-3 bg-danger/10 border border-danger/20 rounded-lg text-danger text-sm">
              {error}
            </div>
          {/if}

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label for="name" class="label">Name</label>
              <input type="text" id="name" class="input" bind:value={formName} />
            </div>
            <div>
              <label for="dataSource" class="label">Data Source</label>
              <select id="dataSource" class="input" bind:value={formDataSourceId}>
                <option value="">None</option>
                {#each dataSources as ds}
                  <option value={ds.id}>{ds.name}</option>
                {/each}
              </select>
            </div>
          </div>
        </div>

        <!-- File tabs -->
        <div class="flex items-center gap-1 px-4 pt-2 border-b border-theme-border bg-theme-bg-canvas overflow-x-auto">
          {#each files as file, index}
            <div
              class="flex items-center gap-1 px-3 py-1.5 text-sm rounded-t-lg border border-b-0 transition-colors cursor-pointer {activeFileIndex === index
                ? 'bg-theme-bg-elevated border-theme-border text-theme-text-emphasis'
                : 'bg-transparent border-transparent text-theme-text-muted hover:text-theme-text hover:bg-theme-bg'}"
              onclick={() => selectFile(index)}
              ondblclick={() => renameFile(index)}
              role="tab"
              tabindex="0"
              aria-selected={activeFileIndex === index}
              onkeydown={(e) => e.key === 'Enter' && selectFile(index)}
            >
              <span class="max-w-32 truncate">{file.name}</span>
              {#if file.name !== 'main.yaml' && files.length > 1}
                <button
                  type="button"
                  class="ml-1 p-0.5 rounded hover:bg-theme-bg-canvas text-theme-text-muted hover:text-danger"
                  onclick={(e) => { e.stopPropagation(); removeFile(index); }}
                  title="Delete file"
                >
                  <X size={12} />
                </button>
              {/if}
            </div>
          {/each}
          <button
            type="button"
            class="flex items-center gap-1 px-2 py-1.5 text-sm text-theme-text-muted hover:text-theme-text rounded-lg hover:bg-theme-bg transition-colors"
            onclick={addFile}
            title="Add file"
          >
            <Plus size={16} />
          </button>
        </div>

        <!-- Editor -->
        <div class="flex-1 overflow-hidden">
          {#if files[activeFileIndex]}
            <textarea
              class="w-full h-full p-4 font-mono text-sm bg-theme-bg-elevated border-0 resize-none focus:outline-none"
              value={files[activeFileIndex].content}
              oninput={(e) => updateFileContent(e.currentTarget.value)}
              placeholder="Enter YAML content..."
            ></textarea>
          {/if}
        </div>

        <div class="flex justify-between items-center gap-2 p-4 border-t border-theme-border">
          <p class="text-xs text-theme-text-muted">
            {files.length} file{files.length !== 1 ? 's' : ''} • Double-click tab to rename
          </p>
          <div class="flex gap-2">
            <a href="/topologies/{$page.params.id}" class="btn btn-secondary">Cancel</a>
            <button type="submit" class="btn btn-primary" disabled={saving}>
              {#if saving}
                <span class="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2"></span>
              {/if}
              Save Changes
            </button>
          </div>
        </div>
      </form>
    </div>
  {/if}
</div>
