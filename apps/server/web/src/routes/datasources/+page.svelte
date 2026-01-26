<script lang="ts">
import { onMount } from 'svelte'
import { api } from '$lib/api'
import { dataSources, dataSourcesList, dataSourcesLoading, dataSourcesError } from '$lib/stores'
import type {
  DataSource,
  DataSourceType,
  DataSourcePluginInfo,
  ConnectionTestResult,
} from '$lib/types'
import * as Dialog from '$lib/components/ui/dialog'
import { Button } from '$lib/components/ui/button'
import Plus from 'phosphor-svelte/lib/Plus'
import Database from 'phosphor-svelte/lib/Database'
import ChartLine from 'phosphor-svelte/lib/ChartLine'
import TreeStructure from 'phosphor-svelte/lib/TreeStructure'
import Cube from 'phosphor-svelte/lib/Cube'

let showCreateModal = $state(false)
let testingId = $state<string | null>(null)
let testResults = $state<Record<string, ConnectionTestResult>>({})

// Plugin types from API
let pluginTypes = $state<DataSourcePluginInfo[]>([])
let selectedPlugin = $state<DataSourcePluginInfo | null>(null)

// Form state
let formName = $state('')
let formUrl = $state('')
let formToken = $state('')
let formPollInterval = $state(30000)
let formSiteFilter = $state('')
let formTagFilter = $state('')
let formPrometheusPreset = $state<'snmp' | 'node_exporter'>('snmp')
let formError = $state('')
let formSubmitting = $state(false)

// Plugin type lookup
let pluginTypeMap = $derived(
  pluginTypes.reduce(
    (acc, p) => {
      acc[p.type] = p
      return acc
    },
    {} as Record<string, DataSourcePluginInfo>,
  ),
)

onMount(async () => {
  dataSources.load()
  // Load available plugin types
  try {
    pluginTypes = await api.dataSources.getPluginTypes()
  } catch (e) {
    console.error('Failed to load plugin types:', e)
  }
})

function openCreateModal() {
  selectedPlugin = null
  formName = ''
  formUrl = ''
  formToken = ''
  formPollInterval = 30000
  formError = ''
  showCreateModal = true
}

function selectPlugin(plugin: DataSourcePluginInfo) {
  selectedPlugin = plugin
  formName = ''
  formUrl = ''
  formToken = ''
  formPollInterval = 30000
  formSiteFilter = ''
  formTagFilter = ''
  formPrometheusPreset = 'snmp'
}

function getConfigFromForm(): string {
  if (!selectedPlugin) return '{}'

  if (selectedPlugin.type === 'zabbix') {
    return JSON.stringify({
      url: formUrl.trim(),
      token: formToken.trim() || undefined,
      pollInterval: formPollInterval,
    })
  }

  if (selectedPlugin.type === 'netbox') {
    return JSON.stringify({
      url: formUrl.trim(),
      token: formToken.trim() || undefined,
      siteFilter: formSiteFilter.trim() || undefined,
      tagFilter: formTagFilter.trim() || undefined,
    })
  }

  if (selectedPlugin.type === 'prometheus') {
    return JSON.stringify({
      url: formUrl.trim(),
      preset: formPrometheusPreset,
    })
  }

  // Generic config for other types
  return JSON.stringify({
    url: formUrl.trim(),
  })
}

function parseConfig(configJson: string): { url?: string; pollInterval?: number } {
  try {
    return JSON.parse(configJson)
  } catch {
    return {}
  }
}

async function handleCreate() {
  if (!selectedPlugin) {
    formError = 'Please select a data source type'
    return
  }
  if (!formName.trim() || !formUrl.trim()) {
    formError = 'Name and URL are required'
    return
  }

  formSubmitting = true
  formError = ''

  try {
    await dataSources.create({
      name: formName.trim(),
      type: selectedPlugin.type as DataSourceType,
      configJson: getConfigFromForm(),
    })
    showCreateModal = false
  } catch (e) {
    formError = e instanceof Error ? e.message : 'Failed to create data source'
  } finally {
    formSubmitting = false
  }
}

async function handleTest(id: string) {
  testingId = id
  try {
    const result = await dataSources.test(id)
    testResults = { ...testResults, [id]: result }
    // Refresh data source list to get updated status
    await dataSources.load()
  } catch (e) {
    testResults = {
      ...testResults,
      [id]: {
        success: false,
        message: e instanceof Error ? e.message : 'Test failed',
      },
    }
  }
  testingId = null
}

async function handleDelete(ds: DataSource) {
  if (!confirm(`Delete data source "${ds.name}"?`)) {
    return
  }
  try {
    await dataSources.delete(ds.id)
  } catch (e) {
    alert(e instanceof Error ? e.message : 'Failed to delete')
  }
}

function getTypeLabel(type: string): string {
  return pluginTypeMap[type]?.displayName || type
}

function getCapabilityIcon(capability: string) {
  switch (capability) {
    case 'metrics':
      return ChartLine
    case 'topology':
      return TreeStructure
    default:
      return Database
  }
}

function formatLastChecked(timestamp?: number): string {
  if (!timestamp) return ''
  const diff = Date.now() - timestamp
  if (diff < 60_000) return 'just now'
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h ago`
  return new Date(timestamp).toLocaleDateString()
}
</script>

<svelte:head>
  <title>Data Sources - Shumoku</title>
</svelte:head>

<div class="p-6">
  <!-- Actions -->
  <div class="flex items-center justify-end mb-6">
    <Button onclick={openCreateModal}>
      <Plus size={20} class="mr-1" />
      Add Data Source
    </Button>
  </div>

  {#if $dataSourcesLoading}
    <div class="flex items-center justify-center py-12">
      <div class="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
    </div>
  {:else if $dataSourcesError}
    <div class="card p-6 text-center">
      <p class="text-destructive">{$dataSourcesError}</p>
      <Button variant="outline" class="mt-4" onclick={() => dataSources.load()}>Retry</Button>
    </div>
  {:else if $dataSourcesList.length === 0}
    <div class="card p-12 text-center">
      <Database size={64} class="text-theme-text-muted mx-auto mb-4" />
      <h3 class="text-lg font-medium text-theme-text-emphasis mb-2">No data sources</h3>
      <p class="text-theme-text-muted mb-4">Add a data source to start collecting metrics or topology</p>
      <Button onclick={openCreateModal}>Add Data Source</Button>
    </div>
  {:else}
    <!-- Data Sources Table -->
    <div class="card">
      <table class="table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Type</th>
            <th>URL</th>
            <th>Status</th>
            <th class="text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {#each $dataSourcesList as ds}
            {@const config = parseConfig(ds.configJson)}
            {@const testResult = testResults[ds.id]}
            <tr>
              <td>
                <a href="/datasources/{ds.id}" class="font-medium text-theme-text-emphasis hover:text-primary">
                  {ds.name}
                </a>
              </td>
              <td>
                <div class="flex items-center gap-2">
                  <span class="badge badge-info">{getTypeLabel(ds.type)}</span>
                  {#if pluginTypeMap[ds.type]}
                    <div class="flex gap-1">
                      {#each pluginTypeMap[ds.type].capabilities as cap}
                        <span class="text-xs px-1.5 py-0.5 rounded bg-theme-bg text-theme-text-muted" title={cap}>
                          {#if cap === 'metrics'}
                            <ChartLine size={12} />
                          {:else if cap === 'topology'}
                            <TreeStructure size={12} />
                          {:else}
                            {cap}
                          {/if}
                        </span>
                      {/each}
                    </div>
                  {/if}
                </div>
              </td>
              <td class="text-theme-text-muted text-sm font-mono">{config.url || '-'}</td>
              <td>
                <div class="flex flex-col gap-0.5">
                  {#if ds.status === 'connected'}
                    <span class="badge badge-success">Connected</span>
                  {:else if ds.status === 'disconnected'}
                    <span class="badge badge-danger" title={ds.statusMessage}>Disconnected</span>
                  {:else}
                    <span class="badge badge-secondary">Unknown</span>
                  {/if}
                  {#if ds.lastCheckedAt}
                    <span class="text-xs text-theme-text-muted">{formatLastChecked(ds.lastCheckedAt)}</span>
                  {/if}
                </div>
              </td>
              <td class="text-right">
                <div class="flex items-center justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onclick={() => handleTest(ds.id)}
                    disabled={testingId === ds.id}
                  >
                    {#if testingId === ds.id}
                      <span class="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin mr-1"></span>
                    {/if}
                    Test
                  </Button>
                  <Button variant="outline" size="sm" onclick={() => window.location.href = `/datasources/${ds.id}`}>Edit</Button>
                  <Button variant="destructive" size="sm" onclick={() => handleDelete(ds)}>Delete</Button>
                </div>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>

<!-- Create Modal -->
<Dialog.Root bind:open={showCreateModal}>
  <Dialog.Content class="sm:max-w-lg">
    <Dialog.Header>
      <Dialog.Title>
        {#if selectedPlugin}
          Configure {selectedPlugin.displayName}
        {:else}
          Add Data Source
        {/if}
      </Dialog.Title>
      <Dialog.Description>
        {#if selectedPlugin}
          Configure the connection settings for {selectedPlugin.displayName}.
        {:else}
          Select a data source type to connect.
        {/if}
      </Dialog.Description>
    </Dialog.Header>

    {#if !selectedPlugin}
      <!-- Plugin Selection Grid -->
      <div class="py-4">
        {#if pluginTypes.length === 0}
          <div class="text-center py-8 text-theme-text-muted">
            <div class="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
            Loading plugins...
          </div>
        {:else}
          <div class="grid grid-cols-2 gap-3">
            {#each pluginTypes as plugin}
              <button
                type="button"
                class="p-4 rounded-lg border border-theme-border hover:border-primary hover:bg-primary/5 transition-colors text-left group"
                onclick={() => selectPlugin(plugin)}
              >
                <div class="flex items-start gap-3">
                  <div class="p-2 rounded-lg bg-theme-bg group-hover:bg-primary/10 transition-colors">
                    {#if plugin.type === 'zabbix'}
                      <ChartLine size={24} class="text-theme-text-muted group-hover:text-primary" />
                    {:else if plugin.type === 'netbox'}
                      <Cube size={24} class="text-theme-text-muted group-hover:text-primary" />
                    {:else if plugin.type === 'prometheus'}
                      <ChartLine size={24} class="text-theme-text-muted group-hover:text-primary" />
                    {:else}
                      <Database size={24} class="text-theme-text-muted group-hover:text-primary" />
                    {/if}
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="font-medium text-theme-text-emphasis">{plugin.displayName}</p>
                    <div class="flex flex-wrap gap-1 mt-1">
                      {#each plugin.capabilities as cap}
                        <span class="text-xs px-1.5 py-0.5 rounded bg-theme-bg text-theme-text-muted">
                          {cap}
                        </span>
                      {/each}
                    </div>
                  </div>
                </div>
              </button>
            {/each}
          </div>
        {/if}
      </div>

      <Dialog.Footer>
        <Button variant="outline" onclick={() => showCreateModal = false}>Cancel</Button>
      </Dialog.Footer>
    {:else}
      <!-- Plugin Configuration Form -->
      <form class="space-y-4 py-2" onsubmit={(e) => { e.preventDefault(); handleCreate(); }}>
        {#if formError}
          <div class="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
            {formError}
          </div>
        {/if}

        <div>
          <label for="name" class="label">Name</label>
          <input
            type="text"
            id="name"
            class="input"
            placeholder="My {selectedPlugin.displayName} Server"
            bind:value={formName}
          />
        </div>

        <div>
          <label for="url" class="label">URL</label>
          <input
            type="url"
            id="url"
            class="input"
            placeholder="https://example.com"
            bind:value={formUrl}
          />
        </div>

        {#if selectedPlugin.type === 'zabbix' || selectedPlugin.type === 'netbox'}
          <div>
            <label for="token" class="label">API Token</label>
            <input
              type="password"
              id="token"
              class="input"
              placeholder="Enter API token"
              bind:value={formToken}
            />
            {#if selectedPlugin.type === 'zabbix'}
              <p class="text-xs text-muted-foreground mt-1">Required for API access (Zabbix 5.4+)</p>
            {/if}
          </div>
        {/if}

        {#if selectedPlugin.type === 'prometheus'}
          <div>
            <label for="preset" class="label">Exporter Type</label>
            <select id="preset" class="input" bind:value={formPrometheusPreset}>
              <option value="snmp">SNMP Exporter</option>
              <option value="node_exporter">Node Exporter</option>
            </select>
            <p class="text-xs text-muted-foreground mt-1">
              {#if formPrometheusPreset === 'snmp'}
                Uses ifHCInOctets/ifHCOutOctets metrics with ifName label
              {:else}
                Uses node_network_receive/transmit_bytes_total metrics with device label
              {/if}
            </p>
          </div>
        {/if}

        {#if selectedPlugin.type === 'zabbix'}
          <div>
            <label for="pollInterval" class="label">Poll Interval</label>
            <select id="pollInterval" class="input" bind:value={formPollInterval}>
              <option value={5000}>5 seconds</option>
              <option value={10000}>10 seconds</option>
              <option value={30000}>30 seconds</option>
              <option value={60000}>1 minute</option>
              <option value={300000}>5 minutes</option>
            </select>
          </div>
        {/if}

        {#if selectedPlugin.type === 'netbox'}
          <div>
            <label for="siteFilter" class="label">Site Filter (optional)</label>
            <input
              type="text"
              id="siteFilter"
              class="input"
              placeholder="e.g., tokyo-dc1"
              bind:value={formSiteFilter}
            />
            <p class="text-xs text-muted-foreground mt-1">Filter devices by site slug</p>
          </div>

          <div>
            <label for="tagFilter" class="label">Tag Filter (optional)</label>
            <input
              type="text"
              id="tagFilter"
              class="input"
              placeholder="e.g., production"
              bind:value={formTagFilter}
            />
            <p class="text-xs text-muted-foreground mt-1">Filter devices by tag slug</p>
          </div>
        {/if}
      </form>

      <Dialog.Footer>
        <Button variant="outline" onclick={() => selectedPlugin = null}>Back</Button>
        <Button onclick={handleCreate} disabled={formSubmitting}>
          {#if formSubmitting}
            <span class="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2"></span>
          {/if}
          Create
        </Button>
      </Dialog.Footer>
    {/if}
  </Dialog.Content>
</Dialog.Root>
