<script lang="ts">
  import { ChartLineIcon, DatabaseIcon, PlusIcon, TreeStructureIcon } from 'phosphor-svelte'
  import { onMount } from 'svelte'
  import { api } from '$lib/api'
  import SchemaForm from '$lib/components/SchemaForm.svelte'
  import { Button } from '$lib/components/ui/button'
  import * as Dialog from '$lib/components/ui/dialog'
  import { dataSources, dataSourcesError, dataSourcesList, dataSourcesLoading } from '$lib/stores'
  import type {
    ConnectionResult,
    DataSource,
    DataSourcePluginInfo,
    PluginConfigSchema,
  } from '$lib/types'

  let showCreateModal = $state(false)
  let testingId = $state<string | null>(null)
  let testResults = $state<Record<string, ConnectionResult>>({})

  // Plugin types from API
  let pluginTypes = $state<DataSourcePluginInfo[]>([])
  let selectedPlugin = $state<DataSourcePluginInfo | null>(null)

  // Form state. The data source name is the only field outside the schema;
  // everything else is the plugin's config, rendered + validated from
  // `selectedPlugin.configSchema` via <SchemaForm> — no per-plugin branch.
  let formName = $state('')
  let config = $state<Record<string, unknown>>({})
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
    config = {}
    formError = ''
    showCreateModal = true
  }

  function selectPlugin(plugin: DataSourcePluginInfo) {
    selectedPlugin = plugin
    formName = ''
    formError = ''
    config = initConfig(plugin.configSchema)
  }

  /** Seed a config object with the schema's declared defaults. */
  function initConfig(schema?: PluginConfigSchema): Record<string, unknown> {
    const out: Record<string, unknown> = {}
    if (!schema) return out
    for (const [key, prop] of Object.entries(schema.properties)) {
      if (prop.default !== undefined) out[key] = prop.default
    }
    return out
  }

  /** Parse a stored config_json for read-only display in the table. */
  function parseConfig(configJson: string): { url?: string; pollInterval?: number } {
    try {
      return JSON.parse(configJson)
    } catch {
      return {}
    }
  }

  /**
   * Build config_json from the schema-driven `config`. Prune empty/blank
   * values so unset stays unset, and drop optional objects whose children are
   * all empty (F3 serialization rule).
   */
  function getConfigFromForm(): string {
    return JSON.stringify(pruneEmpty(config))
  }

  function pruneEmpty(obj: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(obj)) {
      if (value == null) continue
      if (typeof value === 'string') {
        const trimmed = value.trim()
        if (trimmed) out[key] = trimmed
        continue
      }
      if (Array.isArray(value)) {
        if (value.length > 0) out[key] = value
        continue
      }
      if (typeof value === 'object') {
        const nested = pruneEmpty(value as Record<string, unknown>)
        if (Object.keys(nested).length > 0) out[key] = nested
        continue
      }
      out[key] = value
    }
    return out
  }

  async function handleCreate() {
    if (!selectedPlugin) {
      formError = 'Please select a data source type'
      return
    }
    if (!formName.trim()) {
      formError = 'Name is required'
      return
    }
    // Full config validation is authoritative on the server (core
    // validateAgainstSchema → 400, surfaced in the catch below). Here we do a
    // light required-field check for instant feedback before the round-trip.
    if (selectedPlugin.configSchema?.required) {
      const filled = pruneEmpty(config)
      for (const key of selectedPlugin.configSchema.required) {
        if (filled[key] === undefined) {
          const prop = selectedPlugin.configSchema.properties[key]
          formError = `${prop?.title ?? key} is required`
          return
        }
      }
    }

    formSubmitting = true
    formError = ''

    try {
      const created = await dataSources.create({
        name: formName.trim(),
        type: selectedPlugin.type,
        configJson: getConfigFromForm(),
      })
      showCreateModal = false

      // Auto-test connection after creation
      await handleTest(created.id)
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

  function formatLastChecked(timestamp?: number): string {
    if (!timestamp) return ''
    const diff = Date.now() - timestamp
    if (diff < 60_000) return 'just now'
    if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`
    if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h ago`
    return new Date(timestamp).toLocaleDateString()
  }
</script>

<svelte:head> <title>Data Sources - Shumoku</title> </svelte:head>

<div class="p-6">
  <!-- Actions -->
  <div class="flex items-center justify-end mb-6">
    <Button onclick={openCreateModal}>
      <PlusIcon size={20} class="mr-1" />
      Add Data Source
    </Button>
  </div>

  {#if $dataSourcesLoading}
    <div class="flex items-center justify-center py-12">
      <div
        class="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"
      ></div>
    </div>
  {:else if $dataSourcesError}
    <div class="card p-6 text-center">
      <p class="text-destructive">{$dataSourcesError}</p>
      <Button variant="outline" class="mt-4" onclick={() => dataSources.load()}>Retry</Button>
    </div>
  {:else if $dataSourcesList.length === 0}
    <div class="card p-12 text-center">
      <DatabaseIcon size={64} class="text-theme-text-muted mx-auto mb-4" />
      <h3 class="text-lg font-medium text-theme-text-emphasis mb-2">No data sources</h3>
      <p class="text-theme-text-muted mb-4">
        Add a data source to start collecting metrics or topology
      </p>
      <Button onclick={openCreateModal}>Add Data Source</Button>
    </div>
  {:else}
    <!-- Data Sources Table -->
    <div class="card">
      <div class="datasources-table">
        <table class="table table-auto">
          <colgroup>
            <col class="w-[12%]">
            <col class="w-[18%]">
            <col>
            <col class="w-[12%]">
            <col class="w-[18%]">
          </colgroup>
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
              {@const dsConfig = parseConfig(ds.configJson)}
              <tr>
                <td>
                  <a
                    href="/datasources/{ds.id}"
                    class="font-medium text-theme-text-emphasis hover:text-primary"
                  >
                    {ds.name}
                  </a>
                </td>
                <td>
                  <div class="flex items-center gap-2">
                    <span class="badge badge-info">{getTypeLabel(ds.type)}</span>
                    {#if pluginTypeMap[ds.type]}
                      <div class="flex gap-1">
                        {#each pluginTypeMap[ds.type]?.capabilities as cap}
                          <span
                            class="text-xs px-1.5 py-0.5 rounded bg-theme-bg text-theme-text-muted"
                            title={cap}
                          >
                            {#if cap === 'metrics'}
                              <ChartLineIcon size={12} />
                            {:else if cap === 'topology'}
                              <TreeStructureIcon size={12} />
                            {:else}
                              {cap}
                            {/if}
                          </span>
                        {/each}
                      </div>
                    {/if}
                  </div>
                </td>
                <td class="text-theme-text-muted text-sm font-mono truncate">
                  {dsConfig.url || '-'}
                </td>
                <td class="datasources-status-cell">
                  <div class="flex flex-col gap-0.5">
                    {#if ds.status === 'connected'}
                      <span class="badge badge-success">Connected</span>
                    {:else if ds.status === 'disconnected'}
                      <span class="badge badge-danger" title={ds.statusMessage}>Disconnected</span>
                    {:else}
                      <span class="badge badge-secondary">Unknown</span>
                    {/if}
                    {#if ds.lastCheckedAt}
                      <span class="text-xs text-theme-text-muted"
                        >{formatLastChecked(ds.lastCheckedAt)}</span
                      >
                    {/if}
                  </div>
                </td>
                <td class="text-right datasources-actions-cell">
                  <div class="flex items-center justify-end gap-2 datasources-actions">
                    <Button
                      variant="outline"
                      size="sm"
                      onclick={() => handleTest(ds.id)}
                      disabled={testingId === ds.id}
                    >
                      {#if testingId === ds.id}
                        <span
                          class="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin mr-1"
                        ></span>
                      {/if}
                      Test
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onclick={() => (window.location.href = `/datasources/${ds.id}`)}
                    >
                      Edit
                    </Button>
                    <Button variant="destructive" size="sm" onclick={() => handleDelete(ds)}>
                      Delete
                    </Button>
                  </div>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
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
            <div
              class="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2"
            ></div>
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
                  <div
                    class="p-2 rounded-lg bg-theme-bg group-hover:bg-primary/10 transition-colors"
                  >
                    {#if plugin.capabilities.includes('topology')}
                      <TreeStructureIcon
                        size={24}
                        class="text-theme-text-muted group-hover:text-primary"
                      />
                    {:else if plugin.capabilities.includes('metrics')}
                      <ChartLineIcon
                        size={24}
                        class="text-theme-text-muted group-hover:text-primary"
                      />
                    {:else}
                      <DatabaseIcon
                        size={24}
                        class="text-theme-text-muted group-hover:text-primary"
                      />
                    {/if}
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="font-medium text-theme-text-emphasis">{plugin.displayName}</p>
                    <div class="flex flex-wrap gap-1 mt-1">
                      {#each plugin.capabilities as cap}
                        <span
                          class="text-xs px-1.5 py-0.5 rounded bg-theme-bg text-theme-text-muted"
                        >
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
          <div
            class="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm"
          >
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
          >
        </div>

        {#if selectedPlugin.configSchema}
          <SchemaForm schema={selectedPlugin.configSchema} bind:value={config} />
        {/if}
      </form>

      <Dialog.Footer>
        <Button variant="outline" onclick={() => selectedPlugin = null}>Back</Button>
        <Button onclick={handleCreate} disabled={formSubmitting}>
          {#if formSubmitting}
            <span
              class="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2"
            ></span>
          {/if}
          Create
        </Button>
      </Dialog.Footer>
    {/if}
  </Dialog.Content>
</Dialog.Root>
