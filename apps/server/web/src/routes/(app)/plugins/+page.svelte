<script lang="ts">
import { onMount } from 'svelte'
import { api, type PluginInfo } from '$lib/api'
import * as Dialog from '$lib/components/ui/dialog'
import { Button } from '$lib/components/ui/button'
import Plus from 'phosphor-svelte/lib/Plus'
import Cube from 'phosphor-svelte/lib/Cube'
import Package from 'phosphor-svelte/lib/Package'
import ArrowsClockwise from 'phosphor-svelte/lib/ArrowsClockwise'
import Trash from 'phosphor-svelte/lib/Trash'
import Check from 'phosphor-svelte/lib/Check'
import X from 'phosphor-svelte/lib/X'
import Warning from 'phosphor-svelte/lib/Warning'
import TreeStructure from 'phosphor-svelte/lib/TreeStructure'
import ChartLine from 'phosphor-svelte/lib/ChartLine'
import Users from 'phosphor-svelte/lib/Users'
import Bell from 'phosphor-svelte/lib/Bell'

// State
let plugins = $state<PluginInfo[]>([])
let loading = $state(true)
let error = $state<string | null>(null)
let reloading = $state(false)

// Modal state
let showAddModal = $state(false)
let addMethod = $state<'path' | 'upload'>('path')
let addPath = $state('')
let addFile = $state<File | null>(null)
let addError = $state('')
let addSubmitting = $state(false)

// Confirm delete state
let deletePlugin = $state<PluginInfo | null>(null)
let deleteFiles = $state(false)
let deleting = $state(false)

// Derived
let builtinPlugins = $derived(plugins.filter((p) => p.builtin))
let externalPlugins = $derived(plugins.filter((p) => !p.builtin))

onMount(async () => {
  await loadPlugins()
})

async function loadPlugins() {
  loading = true
  error = null
  try {
    plugins = await api.plugins.list()
  } catch (e) {
    error = e instanceof Error ? e.message : 'Failed to load plugins'
  } finally {
    loading = false
  }
}

async function handleReload() {
  reloading = true
  try {
    const result = await api.plugins.reload()
    plugins = result.plugins
  } catch (e) {
    error = e instanceof Error ? e.message : 'Failed to reload plugins'
  } finally {
    reloading = false
  }
}

function openAddModal() {
  addMethod = 'path'
  addPath = ''
  addFile = null
  addError = ''
  showAddModal = true
}

async function handleAdd() {
  addSubmitting = true
  addError = ''

  try {
    if (addMethod === 'path') {
      if (!addPath.trim()) {
        addError = 'Path is required'
        return
      }
      await api.plugins.addByPath(addPath.trim())
    } else {
      if (!addFile) {
        addError = 'Please select a file'
        return
      }
      await api.plugins.uploadZip(addFile)
    }

    showAddModal = false
    await loadPlugins()
  } catch (e) {
    addError = e instanceof Error ? e.message : 'Failed to add plugin'
  } finally {
    addSubmitting = false
  }
}

async function handleToggleEnabled(plugin: PluginInfo) {
  try {
    await api.plugins.setEnabled(plugin.id, !plugin.enabled)
    await loadPlugins()
  } catch (e) {
    alert(e instanceof Error ? e.message : 'Failed to update plugin')
  }
}

function confirmDelete(plugin: PluginInfo) {
  deletePlugin = plugin
  deleteFiles = false
}

async function handleDelete() {
  if (!deletePlugin) return

  deleting = true
  try {
    await api.plugins.remove(deletePlugin.id, deleteFiles)
    deletePlugin = null
    await loadPlugins()
  } catch (e) {
    alert(e instanceof Error ? e.message : 'Failed to remove plugin')
  } finally {
    deleting = false
  }
}

function handleFileSelect(e: Event) {
  const input = e.target as HTMLInputElement
  if (input.files && input.files.length > 0) {
    addFile = input.files[0]
  }
}

function getCapabilityIcon(cap: string) {
  switch (cap) {
    case 'topology':
      return TreeStructure
    case 'metrics':
      return ChartLine
    case 'hosts':
      return Users
    case 'alerts':
      return Bell
    default:
      return Cube
  }
}

function getCapabilityLabel(cap: string): string {
  switch (cap) {
    case 'topology':
      return 'Topology'
    case 'metrics':
      return 'Metrics'
    case 'hosts':
      return 'Hosts'
    case 'alerts':
      return 'Alerts'
    case 'auto-mapping':
      return 'Auto-mapping'
    default:
      return cap
  }
}
</script>

<svelte:head>
  <title>Plugins - Shumoku</title>
</svelte:head>

<div class="p-6">
  <!-- Header -->
  <div class="flex items-center justify-between mb-6">
    <div>
      <h1 class="text-2xl font-bold text-theme-text-emphasis">Plugins</h1>
      <p class="text-theme-text-muted mt-1">Manage data source plugins</p>
    </div>
    <div class="flex items-center gap-2">
      <Button variant="outline" onclick={handleReload} disabled={reloading}>
        <ArrowsClockwise size={20} class="mr-1 {reloading ? 'animate-spin' : ''}" />
        Reload
      </Button>
      <Button onclick={openAddModal}>
        <Plus size={20} class="mr-1" />
        Add Plugin
      </Button>
    </div>
  </div>

  {#if loading}
    <div class="flex items-center justify-center py-12">
      <div class="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
    </div>
  {:else if error}
    <div class="card p-6 text-center">
      <p class="text-destructive">{error}</p>
      <Button variant="outline" class="mt-4" onclick={loadPlugins}>Retry</Button>
    </div>
  {:else}
    <!-- Built-in Plugins -->
    <div class="mb-8">
      <h2 class="text-lg font-semibold text-theme-text-emphasis mb-4">Built-in Plugins</h2>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {#each builtinPlugins as plugin}
          <div class="card p-4">
            <div class="flex items-start gap-3">
              <div class="p-2 rounded-lg bg-primary/10">
                <Package size={24} class="text-primary" />
              </div>
              <div class="flex-1 min-w-0">
                <p class="font-medium text-theme-text-emphasis">{plugin.name}</p>
                <p class="text-xs text-theme-text-muted mt-0.5">Built-in</p>
                <div class="flex flex-wrap gap-1 mt-2">
                  {#each plugin.capabilities as cap}
                    {@const Icon = getCapabilityIcon(cap)}
                    <span
                      class="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-theme-bg text-theme-text-muted"
                      title={getCapabilityLabel(cap)}
                    >
                      <Icon size={12} />
                      {getCapabilityLabel(cap)}
                    </span>
                  {/each}
                </div>
              </div>
            </div>
          </div>
        {/each}
      </div>
    </div>

    <!-- External Plugins -->
    <div>
      <h2 class="text-lg font-semibold text-theme-text-emphasis mb-4">External Plugins</h2>
      {#if externalPlugins.length === 0}
        <div class="card p-12 text-center">
          <Cube size={64} class="text-theme-text-muted mx-auto mb-4" />
          <h3 class="text-lg font-medium text-theme-text-emphasis mb-2">No external plugins</h3>
          <p class="text-theme-text-muted mb-4">Add an external plugin to extend functionality</p>
          <Button onclick={openAddModal}>Add Plugin</Button>
        </div>
      {:else}
        <div class="card">
          <table class="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Version</th>
                <th>Capabilities</th>
                <th>Status</th>
                <th class="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {#each externalPlugins as plugin}
                <tr>
                  <td>
                    <div>
                      <p class="font-medium text-theme-text-emphasis">{plugin.name}</p>
                      <p class="text-xs text-theme-text-muted font-mono truncate max-w-[300px]" title={plugin.path}>
                        {plugin.path}
                      </p>
                    </div>
                  </td>
                  <td>
                    <span class="badge badge-info">{plugin.version}</span>
                  </td>
                  <td>
                    <div class="flex flex-wrap gap-1">
                      {#each plugin.capabilities as cap}
                        {@const Icon = getCapabilityIcon(cap)}
                        <span
                          class="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-theme-bg text-theme-text-muted"
                          title={getCapabilityLabel(cap)}
                        >
                          <Icon size={12} />
                        </span>
                      {/each}
                    </div>
                  </td>
                  <td>
                    {#if plugin.error}
                      <div class="flex items-center gap-1 text-destructive" title={plugin.error}>
                        <Warning size={16} />
                        <span class="text-sm">Error</span>
                      </div>
                    {:else if plugin.enabled}
                      <div class="flex items-center gap-1 text-success">
                        <Check size={16} />
                        <span class="text-sm">Enabled</span>
                      </div>
                    {:else}
                      <div class="flex items-center gap-1 text-theme-text-muted">
                        <X size={16} />
                        <span class="text-sm">Disabled</span>
                      </div>
                    {/if}
                  </td>
                  <td class="text-right">
                    <div class="flex items-center justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onclick={() => handleToggleEnabled(plugin)}
                      >
                        {plugin.enabled ? 'Disable' : 'Enable'}
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onclick={() => confirmDelete(plugin)}
                      >
                        <Trash size={16} />
                      </Button>
                    </div>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </div>
  {/if}
</div>

<!-- Add Plugin Modal -->
<Dialog.Root bind:open={showAddModal}>
  <Dialog.Content class="sm:max-w-md">
    <Dialog.Header>
      <Dialog.Title>Add External Plugin</Dialog.Title>
      <Dialog.Description>
        Add an external plugin by specifying a path or uploading a ZIP file.
      </Dialog.Description>
    </Dialog.Header>

    <div class="py-4 space-y-4">
      {#if addError}
        <div class="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
          {addError}
        </div>
      {/if}

      <!-- Method Selection -->
      <div class="flex gap-2">
        <button
          type="button"
          class="flex-1 p-3 rounded-lg border transition-colors {addMethod === 'path'
            ? 'border-primary bg-primary/5'
            : 'border-theme-border hover:border-primary/50'}"
          onclick={() => addMethod = 'path'}
        >
          <p class="font-medium text-theme-text-emphasis">Local Path</p>
          <p class="text-xs text-theme-text-muted mt-1">Path on server filesystem</p>
        </button>
        <button
          type="button"
          class="flex-1 p-3 rounded-lg border transition-colors {addMethod === 'upload'
            ? 'border-primary bg-primary/5'
            : 'border-theme-border hover:border-primary/50'}"
          onclick={() => addMethod = 'upload'}
        >
          <p class="font-medium text-theme-text-emphasis">Upload ZIP</p>
          <p class="text-xs text-theme-text-muted mt-1">Upload plugin archive</p>
        </button>
      </div>

      {#if addMethod === 'path'}
        <div>
          <label for="path" class="label">Plugin Path</label>
          <input
            type="text"
            id="path"
            class="input font-mono text-sm"
            placeholder="/path/to/plugin"
            bind:value={addPath}
          />
          <p class="text-xs text-theme-text-muted mt-1">
            Absolute path to the plugin directory on the server
          </p>
        </div>
      {:else}
        <div>
          <label for="file" class="label">Plugin ZIP File</label>
          <input
            type="file"
            id="file"
            class="input"
            accept=".zip"
            onchange={handleFileSelect}
          />
          {#if addFile}
            <p class="text-xs text-theme-text-muted mt-1">
              Selected: {addFile.name} ({Math.round(addFile.size / 1024)} KB)
            </p>
          {/if}
        </div>
      {/if}
    </div>

    <Dialog.Footer>
      <Button variant="outline" onclick={() => showAddModal = false}>Cancel</Button>
      <Button onclick={handleAdd} disabled={addSubmitting}>
        {#if addSubmitting}
          <span class="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2"></span>
        {/if}
        Add Plugin
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>

<!-- Delete Confirmation Modal -->
<Dialog.Root open={deletePlugin !== null} onOpenChange={(open) => { if (!open) deletePlugin = null }}>
  <Dialog.Content class="sm:max-w-md">
    <Dialog.Header>
      <Dialog.Title>Remove Plugin</Dialog.Title>
      <Dialog.Description>
        Are you sure you want to remove "{deletePlugin?.name}"?
      </Dialog.Description>
    </Dialog.Header>

    <div class="py-4">
      <label class="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          class="w-4 h-4 rounded border-theme-border"
          bind:checked={deleteFiles}
        />
        <span class="text-sm text-theme-text">Also delete plugin files from disk</span>
      </label>
    </div>

    <Dialog.Footer>
      <Button variant="outline" onclick={() => deletePlugin = null}>Cancel</Button>
      <Button variant="destructive" onclick={handleDelete} disabled={deleting}>
        {#if deleting}
          <span class="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2"></span>
        {/if}
        Remove
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
