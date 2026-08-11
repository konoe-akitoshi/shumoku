<script lang="ts">
  import { dumpGraph, type NetworkGraph, YamlParser } from '@shumoku/core'
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
  import { copyTextToClipboard } from '$lib/clipboard'
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
  let copyErrorValue = $state<string | null>(null)
  let copiedTimer: ReturnType<typeof setTimeout> | null = null

  async function loadConnectionInfo() {
    try {
      const res = await api.dataSources.getConnectionInfo(id, window.location.origin)
      connectionItems = res.items
    } catch {
      connectionItems = []
    }
  }

  async function copyValue(value: string) {
    copyErrorValue = null
    try {
      await copyTextToClipboard(value)
      copiedValue = value
      if (copiedTimer) clearTimeout(copiedTimer)
      copiedTimer = setTimeout(() => {
        copiedValue = null
        copiedTimer = null
      }, 2000)
    } catch {
      copiedValue = null
      copyErrorValue = value
    }
  }

  $effect(() => {
    return () => {
      if (copiedTimer) clearTimeout(copiedTimer)
    }
  })

  /**
   * Seed the YAML pane from a saved graph.
   *
   * Delegates to core's `dumpGraph`, the inverse of the parser: it quotes
   * values that need it and emits every field the graph carries. The
   * hand-rolled writer this replaced did neither — it interpolated labels raw
   * (a two-line segment name produced an unparseable document) and enumerated
   * only six node keys, so identity / ports / metadata and every link id
   * silently vanished on the next save.
   */
  function graphToYaml(graph: Record<string, unknown>): string {
    return dumpGraph(graph as unknown as NetworkGraph)
  }

  /**
   * Parse YAML into a NetworkGraph, or throw if the YAML was unparseable.
   *
   * YamlParser.parse() never throws on its own — a fatal syntax error (e.g. an
   * unquoted multi-line label) is caught internally and returned as a
   * look-alike empty graph (`{nodes: [], links: []}`) plus a `PARSE_ERROR`
   * warning. Every caller here used to read only `.graph` and drop
   * `.warnings`, so a broken paste silently "succeeded" as an empty diagram —
   * and, on save, silently replaced the source's last-good content. Surfacing
   * `PARSE_ERROR` as a thrown error lets the existing try/catch around each
   * call site do its job instead.
   */
  function parseYamlOrThrow(text: string): NetworkGraph {
    const result = new YamlParser().parse(text)
    // EVERY severity-error warning is fatal here, not just PARSE_ERROR: the
    // parser now reports keys it cannot carry (UNKNOWN_KEY for typos and
    // pasted API envelopes, NOT_AUTHORABLE for observation-layer fields).
    // Proceeding past those saves a silently reduced graph — the exact
    // failure this editor exists to prevent.
    const fatal = (result.warnings ?? []).filter((w) => w.severity === 'error')
    if (fatal.length > 0) {
      throw new Error(`Invalid YAML:\n${fatal.map((w) => `• ${w.message}`).join('\n')}`)
    }
    return result.graph
  }

  // Text of the OTHER pane at the moment of the last conversion. When the user
  // switches back without editing, the original text is restored verbatim
  // instead of re-derived — deriving JSON from YAML runs the parser, which by
  // design cannot carry observation-layer fields (rateBps, presence, …), so a
  // JSON pane holding observation data used to lose fields merely because the
  // YAML tab was VISITED in between.
  let yamlSnapshot = ''
  let jsonSnapshot = ''

  function switchMode(mode: 'yaml' | 'json') {
    if (mode === editorMode) return
    try {
      if (mode === 'json') {
        if (yamlContent === yamlSnapshot && jsonSnapshot !== '') {
          jsonContent = jsonSnapshot // untouched — restore, don't re-derive
        } else {
          jsonContent = JSON.stringify(parseYamlOrThrow(yamlContent), null, 2)
        }
      } else {
        if (jsonContent === jsonSnapshot && yamlSnapshot !== '') {
          yamlContent = yamlSnapshot // untouched — restore, don't re-derive
        } else {
          const graph = JSON.parse(jsonContent)
          yamlContent = graphToYaml(graph)
        }
      }
      yamlSnapshot = yamlContent
      jsonSnapshot = jsonContent
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
    // Manual has no connection config — its graph is recorded as an observation
    // (see manualGraphFromEditor / handleSave), not stored in config_json.
    if (type === 'manual') return '{}'
    return JSON.stringify(pruneEmpty(config))
  }

  /** Parse the active editor pane (YAML or JSON) into a NetworkGraph. */
  function manualGraphFromEditor(): NetworkGraph {
    return editorMode === 'yaml'
      ? parseYamlOrThrow(yamlContent)
      : (JSON.parse(jsonContent) as NetworkGraph)
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
        // Config includes secret values (returned to the admin-only UI); the
        // form masks them with a reveal toggle.
        config = parseConfig(ds.configJson) as Record<string, unknown>

        await loadConnectionInfo()

        if (ds.type === 'manual') {
          try {
            attachedTopologies = await api.dataSources.listAttachedTopologies(currentId)
          } catch (err) {
            console.warn('[Manual] Failed to list attached topologies:', err)
          }
          // Manual content is a per-topology observation now (not config_json).
          // Seed the editor from this source's latest snapshot for its topology.
          let graph: Record<string, unknown> = { version: '1', nodes: [], links: [] }
          const topoId = attachedTopologies[0]?.topologyId
          if (topoId) {
            try {
              const snap = await api.topologies.sources.latestSnapshot(topoId, currentId)
              if (snap?.graph) graph = snap.graph as unknown as Record<string, unknown>
            } catch (err) {
              console.warn('[Manual] Failed to load latest snapshot:', err)
            }
          }
          if (cancelled) return
          jsonContent = JSON.stringify(graph, null, 2)
          yamlContent = graphToYaml(graph)
          // Both panes were seeded from the SAME graph — arm the snapshots so
          // tab switches restore each other's text instead of converting. For
          // an observation-bearing graph the YAML→JSON conversion is not even
          // possible (the parser rightly rejects observation fields), so
          // without this the first tab switch would error.
          yamlSnapshot = yamlContent
          jsonSnapshot = jsonContent
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

      // Manual: persist the drawn graph as an observation against its topology
      // (the human is the "scanner"); config_json holds no graph. The graph is a
      // per-topology observation, so THIS standalone editor needs exactly one
      // attached topology to know which one to write — refuse on none (would
      // silently lose the edit) or many (would edit an arbitrary one). This is a
      // limitation of editing from /datasources, not a cardinality constraint:
      // Manual is fully uniform and may be attached to many topologies. The fix
      // is to edit from the topology context (#362), where the target is known.
      if (dataSource.type === 'manual') {
        if (attachedTopologies.length !== 1) {
          error =
            attachedTopologies.length === 0
              ? 'Attach this Manual source to a topology before editing its content.'
              : 'This Manual is attached to multiple topologies; edit its content from a topology.'
          saving = false
          return
        }
        const topoId = attachedTopologies[0]?.topologyId
        if (topoId) {
          await api.topologies.sources.recordObservation(topoId, id, manualGraphFromEditor(), 'ok')
        }
      }

      dataSource = await dataSources.update(id, updates)
      // Re-seed from the saved config (a server-generated webhook secret may now
      // be present).
      config = parseConfig(dataSource.configJson) as Record<string, unknown>

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
                {#if copyErrorValue === item.value}
                  <p class="mt-1 text-xs text-danger" role="status">
                    Could not copy this value. Select and copy it manually.
                  </p>
                {/if}
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
