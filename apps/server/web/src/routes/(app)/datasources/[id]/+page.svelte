<script lang="ts">
  import { type NetworkGraph, YamlParser } from '@shumoku/core'
  import {
    ArrowLeftIcon,
    CheckCircleIcon,
    CheckIcon,
    CopyIcon,
    WarningIcon,
    XCircleIcon,
  } from 'phosphor-svelte'
  import { goto } from '$app/navigation'
  import { page } from '$app/stores'
  import { api } from '$lib/api'
  import SchemaForm from '$lib/components/SchemaForm.svelte'
  import { dataSources } from '$lib/stores'
  import type {
    ConnectionResult,
    DataSource,
    DataSourcePluginInfo,
    PluginConfigSchema,
  } from '$lib/types'

  // Get ID from route params (always defined for this route)
  // biome-ignore lint/style/noNonNullAssertion: using depricated $page, which is not typed
  let id = $derived($page.params.id!)

  let dataSource = $state<DataSource | null>(null)
  let loading = $state(true)
  let error = $state('')
  let saving = $state(false)
  let testResult = $state<ConnectionResult | null>(null)
  let testing = $state(false)
  // For Manual sources: the topologies this source is attached to —
  // shown as a tag list so users see where this content is in use.
  let attachedTopologies = $state<{ topologyId: string; name: string }[]>([])

  // Manual graph editor state (only used when dataSource.type === 'manual').
  // Manual stores its graph in config_json under the `graph` key — the
  // graph is the source 's content, shared across all attached topologies.
  let editorMode = $state<'yaml' | 'json'>('yaml')
  let yamlContent = $state('')
  let jsonContent = $state('')

  // Form state. Non-manual config is rendered + edited via <SchemaForm> from
  // the plugin's configSchema; Manual keeps the graph editor below.
  let formName = $state('')
  let config = $state<Record<string, unknown>>({})
  let pluginTypes = $state<DataSourcePluginInfo[]>([])

  function configSchemaFor(type?: string): PluginConfigSchema | undefined {
    return type ? pluginTypes.find((p) => p.type === type)?.configSchema : undefined
  }

  // Derived, display-only connection info (e.g. grafana webhook URL), rendered
  // generically from the plugin's getConnectionInfo — no per-plugin branch.
  let connectionItems = $state<{ label: string; value: string; copyable?: boolean }[]>([])
  let copiedValue = $state<string | null>(null)
  let copiedTimer: ReturnType<typeof setTimeout> | null = null

  async function loadConnectionInfo() {
    try {
      const res = await api.dataSources.getConnectionInfo(id, window.location.origin)
      connectionItems = res.items
    } catch {
      connectionItems = []
    }
  }

  function copyValue(value: string) {
    navigator.clipboard.writeText(value)
    copiedValue = value
    if (copiedTimer) clearTimeout(copiedTimer)
    copiedTimer = setTimeout(() => {
      copiedValue = null
      copiedTimer = null
    }, 2000)
  }

  $effect(() => {
    return () => {
      if (copiedTimer) clearTimeout(copiedTimer)
    }
  })

  function graphToYaml(graph: Record<string, unknown>): string {
    // Same converter as the dedicated edit page used to have. Walks the
    // NetworkGraph 's top-level shape; anything not enumerated below
    // round-trips through the JSON tab instead.
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
        const result = new YamlParser().parse(yamlContent)
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

  interface ParsedConfig {
    url?: string
    token?: string
    pollInterval?: number
    insecure?: boolean
    useWebhook?: boolean
    webhookSecret?: string
    community?: string
    targets?: string[]
    timeoutMs?: number
  }

  function parseConfig(configJson: string): ParsedConfig {
    try {
      return JSON.parse(configJson)
    } catch {
      return {}
    }
  }

  function getConfigFromForm(type: string): string {
    // Manual stores its graph in config_json. Parse whichever editor pane is
    // active, then serialise. Everything else serialises the schema-driven
    // `config` (empty password fields are pruned → the server preserves the
    // stored secret).
    if (type === 'manual') {
      const graph =
        editorMode === 'yaml'
          ? new YamlParser().parse(yamlContent).graph
          : (JSON.parse(jsonContent) as NetworkGraph)
      return JSON.stringify({ graph })
    }
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

  /**
   * Blank password fields so the masked secret loaded from the API isn't
   * re-submitted; the server preserves the stored secret when a field is
   * omitted (and re-generates grafana's webhookSecret as needed).
   */
  function blankSecrets(
    cfg: Record<string, unknown>,
    schema?: PluginConfigSchema,
  ): Record<string, unknown> {
    if (!schema) return cfg
    const out = { ...cfg }
    for (const [key, prop] of Object.entries(schema.properties)) {
      if (prop.format === 'password') out[key] = ''
    }
    return out
  }

  // Re-fetch whenever the route id changes (the component is reused across
  // /datasources/[id] navigations).
  $effect(() => {
    const currentId = id
    let cancelled = false
    loading = true
    error = ''
    dataSource = null
    testResult = null
    connectionItems = []

    ;(async () => {
      try {
        const ds = await api.dataSources.get(currentId)
        if (cancelled) return
        dataSource = ds
        formName = ds.name
        if (!pluginTypes.length) {
          pluginTypes = await api.dataSources.getPluginTypes()
          if (cancelled) return
        }
        const parsed = parseConfig(ds.configJson) as Record<string, unknown>
        config = blankSecrets(parsed, configSchemaFor(ds.type))

        await loadConnectionInfo()

        if (ds.type === 'manual') {
          try {
            attachedTopologies = await api.dataSources.listAttachedTopologies(currentId)
          } catch (err) {
            console.warn('[Manual] Failed to list attached topologies:', err)
          }
          // Seed the editor with the source 's stored graph.
          const graph = (parsed as { graph?: Record<string, unknown> }).graph ?? {
            version: '1',
            nodes: [],
            links: [],
          }
          jsonContent = JSON.stringify(graph, null, 2)
          yamlContent = graphToYaml(graph)
        }
      } catch (e) {
        if (cancelled) return
        error = e instanceof Error ? e.message : 'Failed to load data source'
      } finally {
        if (!cancelled) loading = false
      }
    })()

    return () => {
      cancelled = true
    }
  })

  async function handleSave() {
    if (!dataSource) {
      error = 'dataSource is null'
      return
    }

    if (!formName.trim()) {
      error = 'Name is required'
      return
    }
    // Config is validated server-side (core validateAgainstSchema → 400). Do a
    // light required-field check here for instant feedback.
    const cfgSchema = configSchemaFor(dataSource.type)
    if (cfgSchema?.required) {
      const filled = pruneEmpty(config)
      for (const key of cfgSchema.required) {
        if (filled[key] === undefined) {
          const prop = cfgSchema.properties[key]
          error = `${prop?.title ?? key} is required`
          return
        }
      }
    }

    saving = true
    error = ''

    try {
      const updates = {
        name: formName.trim(),
        configJson: getConfigFromForm(dataSource.type),
      }

      dataSource = await dataSources.update(id, updates)
      // Re-seed from the saved (masked) config so password fields blank again.
      config = blankSecrets(
        parseConfig(dataSource.configJson) as Record<string, unknown>,
        configSchemaFor(dataSource.type),
      )

      // Refresh derived connection info after save (e.g. a webhook secret may
      // have just been generated server-side).
      await loadConnectionInfo()

      // Auto-test connection after save
      await handleTest()
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to save'
    } finally {
      saving = false
    }
  }

  async function handleTest() {
    testing = true
    testResult = null
    try {
      testResult = await api.dataSources.test(id)
    } catch (e) {
      testResult = {
        success: false,
        message: e instanceof Error ? e.message : 'Test failed',
      }
    }
    testing = false
  }

  async function handleDelete() {
    if (!confirm(`Delete data source "${dataSource?.name}"?`)) {
      return
    }
    try {
      await dataSources.delete(id)
      goto('/datasources')
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to delete'
    }
  }
</script>

<svelte:head> <title>{dataSource?.name || 'Data Source'} - Shumoku</title> </svelte:head>

<div class="p-6">
  <!-- Back link -->
  <a
    href="/datasources"
    class="inline-flex items-center gap-2 text-theme-text-muted hover:text-theme-text mb-4"
  >
    <ArrowLeftIcon size={16} />
    Back to Data Sources
  </a>

  {#if loading}
    <div class="flex items-center justify-center py-12">
      <div
        class="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"
      ></div>
    </div>
  {:else if error && !dataSource}
    <div class="card p-6 text-center">
      <p class="text-danger">{error}</p>
      <a href="/datasources" class="btn btn-secondary mt-4">Go Back</a>
    </div>
  {:else if dataSource}
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-semibold text-theme-text-emphasis">{dataSource.name}</h1>
      <button class="btn btn-danger" onclick={handleDelete}>Delete</button>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Edit Form -->
      <div class="lg:col-span-2">
        <div class="card">
          <div class="card-header">
            <h2 class="font-medium text-theme-text-emphasis">Configuration</h2>
          </div>
          <form class="card-body space-y-4" onsubmit={(e) => { e.preventDefault(); handleSave(); }}>
            {#if error}
              <div class="p-3 bg-danger/10 border border-danger/20 rounded-lg text-danger text-sm">
                {error}
              </div>
            {/if}

            <div>
              <label for="name" class="label">Name</label>
              <input type="text" id="name" class="input" bind:value={formName}>
            </div>

            {#if dataSource.type === 'manual'}
              <!-- Manual stores its graph in config_json. Same source-level
                   content is shared across every topology it 's attached to. -->
              <div>
                <div class="flex items-center justify-between mb-1">
                  <span class="label">Graph</span>
                  <div class="flex items-center gap-2">
                    <button
                      type="button"
                      class="px-2 py-0.5 text-xs rounded {editorMode === 'yaml' ? 'bg-primary text-primary-foreground' : 'bg-theme-bg hover:bg-theme-bg-canvas text-theme-text'}"
                      onclick={() => switchMode('yaml')}
                    >
                      YAML
                    </button>
                    <button
                      type="button"
                      class="px-2 py-0.5 text-xs rounded {editorMode === 'json' ? 'bg-primary text-primary-foreground' : 'bg-theme-bg hover:bg-theme-bg-canvas text-theme-text'}"
                      onclick={() => switchMode('json')}
                    >
                      JSON
                    </button>
                  </div>
                </div>
                {#if editorMode === 'yaml'}
                  <textarea
                    class="input min-h-[400px] font-mono text-sm"
                    bind:value={yamlContent}
                    placeholder="Enter YAML content..."
                  ></textarea>
                {:else}
                  <textarea
                    class="input min-h-[400px] font-mono text-sm"
                    bind:value={jsonContent}
                    placeholder="Enter JSON content..."
                  ></textarea>
                {/if}
                {#if attachedTopologies.length > 0}
                  <p class="text-xs text-theme-text-muted mt-2">
                    Used by:
                    {#each attachedTopologies as t, i}
                      <a class="text-primary hover:underline" href="/topologies/{t.topologyId}">
                        {t.name}
                      </a>
                      {#if i < attachedTopologies.length - 1}
                        ,{' '}
                      {/if}
                    {/each}
                  </p>
                {:else}
                  <p class="text-xs text-theme-text-muted mt-2">
                    Not attached to any topology yet. Attach from a topology 's Sources tab to use
                    this graph.
                  </p>
                {/if}
              </div>
            {:else}
              {@const cfgSchema = configSchemaFor(dataSource.type)}
              {#if cfgSchema}
                <SchemaForm
                  schema={cfgSchema}
                  value={config}
                  getOptions={(key) =>
                    api.dataSources.getConfigOptions(id, key).then((r) => r.options)}
                />
              {/if}
            {/if}

            <!-- Derived connection info (e.g. webhook URL), rendered generically
                 from the plugin's getConnectionInfo — no per-plugin branch. -->
            {#each connectionItems as item (item.label)}
              <div class="pt-2 border-t border-theme-border">
                <p class="text-sm font-medium text-theme-text-emphasis">{item.label}</p>
                <div class="flex items-center gap-2 mt-1">
                  <input
                    type="text"
                    class="input flex-1 font-mono text-xs"
                    value={item.value}
                    readonly
                  >
                  {#if item.copyable}
                    <button
                      type="button"
                      class="btn btn-secondary p-2"
                      title="Copy to clipboard"
                      onclick={() => copyValue(item.value)}
                    >
                      {#if copiedValue === item.value}
                        <CheckIcon size={16} class="text-success" />
                      {:else}
                        <CopyIcon size={16} />
                      {/if}
                    </button>
                  {/if}
                </div>
              </div>
            {/each}

            <div class="flex justify-end pt-4 border-t border-theme-border">
              <button type="submit" class="btn btn-primary" disabled={saving}>
                {#if saving}
                  <span
                    class="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2"
                  ></span>
                {/if}
                Save Changes
              </button>
            </div>
          </form>
        </div>
      </div>

      <!-- Connection Test -->
      <div>
        <div class="card">
          <div class="card-header">
            <h2 class="font-medium text-theme-text-emphasis">Connection Test</h2>
          </div>
          <div class="card-body">
            <button class="btn btn-secondary w-full mb-4" onclick={handleTest} disabled={testing}>
              {#if testing}
                <span
                  class="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2"
                ></span>
              {/if}
              Test Connection
            </button>

            {#if testResult}
              <div class="p-4 rounded-lg {testResult.success ? 'bg-success/10' : 'bg-danger/10'}">
                <div class="flex items-center gap-2 mb-2">
                  {#if testResult.success}
                    <CheckCircleIcon size={20} class="text-success" />
                    <span class="font-medium text-success">Connected</span>
                  {:else}
                    <XCircleIcon size={20} class="text-danger" />
                    <span class="font-medium text-danger">Failed</span>
                  {/if}
                </div>
                <p class="text-sm text-theme-text-muted">{testResult.message}</p>
                {#if testResult.version}
                  <p class="text-xs text-theme-text-muted mt-1">Version: {testResult.version}</p>
                {/if}
                {#if testResult.warnings?.length}
                  <div class="mt-2 pt-2 border-t border-warning/30">
                    {#each testResult.warnings as warning}
                      <div class="flex items-center gap-1 text-xs text-warning">
                        <WarningIcon size={14} />
                        <span>{warning}</span>
                      </div>
                    {/each}
                  </div>
                {/if}
              </div>
            {/if}
          </div>
        </div>

        <!-- Info -->
        <div class="card mt-4">
          <div class="card-header">
            <h2 class="font-medium text-theme-text-emphasis">Info</h2>
          </div>
          <div class="card-body text-sm space-y-2">
            <div class="flex justify-between">
              <span class="text-theme-text-muted">ID</span>
              <span class="font-mono text-theme-text">{dataSource.id}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-theme-text-muted">Type</span>
              <span class="text-theme-text">{dataSource.type}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-theme-text-muted">Created</span>
              <span class="text-theme-text">{new Date(dataSource.createdAt).toLocaleString()}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-theme-text-muted">Updated</span>
              <span class="text-theme-text">{new Date(dataSource.updatedAt).toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  {/if}
</div>
