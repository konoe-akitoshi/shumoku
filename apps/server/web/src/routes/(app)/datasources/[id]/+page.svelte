<script lang="ts">
  import { YamlParser } from '@shumoku/core'
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
  import { dataSources, topologies } from '$lib/stores'
  import type { ConnectionResult, DataSource, Topology } from '$lib/types'

  // Get ID from route params (always defined for this route)
  // biome-ignore lint/style/noNonNullAssertion: using depricated $page, which is not typed
  let id = $derived($page.params.id!)
  // Manual sources are per-topology; the link that brought us here
  // includes ?topology=<id> so we know which topology 's content to load.
  let parentTopologyId = $derived($page.url.searchParams.get('topology') ?? '')

  // Manual-editor state
  let manualTopology = $state<Topology | null>(null)
  let editorMode = $state<'yaml' | 'json'>('yaml')
  let yamlContent = $state('')
  let jsonContent = $state('')

  let dataSource = $state<DataSource | null>(null)
  let loading = $state(true)
  let error = $state('')
  let saving = $state(false)
  let testResult = $state<ConnectionResult | null>(null)
  let testing = $state(false)

  // Form state
  let formName = $state('')
  let formUrl = $state('')
  let formToken = $state('')
  let formPollInterval = $state(30000)
  let hasExistingToken = $state(false)
  let formInsecure = $state(false)
  // SNMP / Network Discovery — community + targets, no URL.
  let formSnmpCommunity = $state('public')
  let formSnmpTargets = $state('')
  let formSnmpTimeoutMs = $state(2000)

  // Grafana webhook state
  let formUseWebhook = $state(false)
  let webhookUrl = $state('')
  let webhookLoading = $state(false)
  let copied = $state(false)
  let copiedTimer: ReturnType<typeof setTimeout> | null = null

  function copyWebhookUrl() {
    navigator.clipboard.writeText(webhookUrl)
    copied = true
    if (copiedTimer) clearTimeout(copiedTimer)
    copiedTimer = setTimeout(() => {
      copied = false
      copiedTimer = null
    }, 2000)
  }

  $effect(() => {
    return () => {
      if (copiedTimer) clearTimeout(copiedTimer)
    }
  })

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
    // snmp-lldp uses a different config shape (no URL).
    if (type === 'snmp-lldp') {
      const community = formSnmpCommunity.trim() || 'public'
      const targets = formSnmpTargets
        .split(/[\s,]+/)
        .map((s) => s.trim())
        .filter(Boolean)
      return JSON.stringify({
        community,
        targets,
        timeoutMs: formSnmpTimeoutMs,
      })
    }

    const config: Record<string, unknown> = {
      url: formUrl.trim(),
    }

    // Only include token if user entered a new one; omit to let server preserve existing
    if (formToken.trim()) {
      config['token'] = formToken.trim()
    }

    if (type === 'zabbix') {
      config['pollInterval'] = formPollInterval
    }

    if (type === 'netbox') {
      if (formInsecure) config['insecure'] = true
    }

    if (type === 'grafana') {
      config['useWebhook'] = formUseWebhook
    }

    return JSON.stringify(config)
  }

  async function loadWebhookUrl() {
    if (!formUseWebhook) {
      webhookUrl = ''
      return
    }
    webhookLoading = true
    try {
      const result = await api.dataSources.getWebhookUrl(id)
      webhookUrl = `${window.location.origin}${result.webhookPath}`
    } catch (err) {
      console.error('[WebhookUrl] Failed to load:', err)
      webhookUrl = ''
    } finally {
      webhookLoading = false
    }
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
    webhookUrl = ''

    ;(async () => {
      try {
        const ds = await api.dataSources.get(currentId)
        if (cancelled) return
        dataSource = ds
        formName = ds.name
        const config = parseConfig(ds.configJson)
        formUrl = config.url || ''
        formToken = ''
        formPollInterval = config.pollInterval || 30000
        hasExistingToken = !!config.token
        formInsecure = !!config.insecure
        formUseWebhook = !!config.useWebhook
        // snmp-lldp specific
        formSnmpCommunity = config.community || 'public'
        formSnmpTargets = (config.targets ?? []).join('\n')
        formSnmpTimeoutMs = config.timeoutMs ?? 2000

        // Manual sources: pull the parent topology 's contentJson (which
        // is itself derived from this Manual source 's latest observation
        // server-side — see TopologyService.withManual). Save routes
        // back through PUT /api/topologies/:id so a new observation is
        // recorded.
        if (ds.type === 'manual' && parentTopologyId) {
          try {
            const t = await api.topologies.get(parentTopologyId)
            if (cancelled) return
            manualTopology = t
            const graph = JSON.parse(t.contentJson ?? '{"version":"1","nodes":[],"links":[]}')
            jsonContent = JSON.stringify(graph, null, 2)
            yamlContent = graphToYaml(graph)
          } catch (err) {
            console.warn('[Manual] Failed to load parent topology:', err)
          }
        }

        if (formUseWebhook) {
          await loadWebhookUrl()
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

  // YAML stringification helper, lifted from the old /edit page. Walks
  // the NetworkGraph 's well-known top-level shape — anything not in
  // this list round-trips via the JSON tab instead.
  function graphToYaml(graph: Record<string, unknown>): string {
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

  async function handleSaveManual() {
    if (!manualTopology) {
      error = `No parent topology — open this page from a topology's Sources tab.`
      return
    }
    saving = true
    error = ''
    try {
      let contentJson: string
      if (editorMode === 'yaml') {
        const parser = new YamlParser()
        const result = parser.parse(yamlContent)
        contentJson = JSON.stringify(result.graph)
      } else {
        JSON.parse(jsonContent) // validate
        contentJson = jsonContent
      }
      await topologies.update(manualTopology.id, { contentJson })
      goto(`/topologies/${manualTopology.id}`)
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to save'
    } finally {
      saving = false
    }
  }

  async function handleSave() {
    if (!dataSource) {
      error = 'dataSource is null'
      return
    }

    if (dataSource.type === 'manual') {
      await handleSaveManual()
      return
    }

    if (!formName.trim()) {
      error = 'Name is required'
      return
    }
    if (dataSource.type === 'snmp-lldp') {
      if (!formSnmpTargets.trim()) {
        error = 'At least one target is required'
        return
      }
    } else if (!formUrl.trim()) {
      error = 'URL is required'
      return
    }

    saving = true
    error = ''

    try {
      const updates = {
        name: formName.trim(),
        configJson: getConfigFromForm(dataSource.type),
      }

      dataSource = await dataSources.update(id, updates)
      // Update hasExistingToken state
      const newConfig = parseConfig(dataSource.configJson)
      hasExistingToken = !!newConfig.token

      // Load webhook URL after save (secret may have been generated)
      if (dataSource.type === 'grafana' && formUseWebhook) {
        await loadWebhookUrl()
      }

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
      {#if dataSource.type === 'manual'}
        <!-- Manual source: YAML/JSON editor for the parent topology -->
        <div class="lg:col-span-3">
          <div class="card flex flex-col" style="min-height: 70vh">
            <div class="card-header flex items-center justify-between">
              <div>
                <h2 class="font-medium text-theme-text-emphasis">
                  Edit {manualTopology?.name ?? 'topology'}
                </h2>
                <p class="text-xs text-theme-text-muted mt-0.5">
                  Editing the Manual source. Save records a new observation.
                </p>
              </div>
              <div class="flex items-center gap-2">
                <span class="text-xs text-theme-text-muted">Format:</span>
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
            {#if error}
              <div
                class="mx-4 mt-3 p-3 bg-danger/10 border border-danger/20 rounded-lg text-danger text-sm"
              >
                {error}
              </div>
            {/if}
            {#if !manualTopology}
              <div class="card-body text-sm text-theme-text-muted">
                No parent topology context. Open this page from a topology's Sources tab (it appends
                <code>?topology=…</code>
                for us).
              </div>
            {:else}
              <div class="flex-1 overflow-hidden flex flex-col">
                {#if editorMode === 'yaml'}
                  <textarea
                    class="w-full flex-1 p-4 font-mono text-sm bg-theme-bg-elevated border-0 resize-none focus:outline-none"
                    bind:value={yamlContent}
                    placeholder="Enter YAML content..."
                  ></textarea>
                {:else}
                  <textarea
                    class="w-full flex-1 p-4 font-mono text-sm bg-theme-bg-elevated border-0 resize-none focus:outline-none"
                    bind:value={jsonContent}
                    placeholder="Enter JSON content..."
                  ></textarea>
                {/if}
              </div>
              <div class="flex justify-between items-center gap-2 p-4 border-t border-theme-border">
                <p class="text-xs text-theme-text-muted">Editing as {editorMode.toUpperCase()}</p>
                <div class="flex gap-2">
                  <a href="/topologies/{manualTopology.id}" class="btn btn-secondary">Cancel</a>
                  <button
                    type="button"
                    class="btn btn-primary"
                    disabled={saving}
                    onclick={handleSaveManual}
                  >
                    {#if saving}
                      <span
                        class="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2"
                      ></span>
                    {/if}
                    Save Changes
                  </button>
                </div>
              </div>
            {/if}
          </div>
        </div>
      {:else}
        <!-- Edit Form -->
        <div class="lg:col-span-2">
          <div class="card">
            <div class="card-header">
              <h2 class="font-medium text-theme-text-emphasis">Configuration</h2>
            </div>
            <form
              class="card-body space-y-4"
              onsubmit={(e) => { e.preventDefault(); handleSave(); }}
            >
              {#if error}
                <div
                  class="p-3 bg-danger/10 border border-danger/20 rounded-lg text-danger text-sm"
                >
                  {error}
                </div>
              {/if}

              <div>
                <label for="name" class="label">Name</label>
                <input type="text" id="name" class="input" bind:value={formName}>
              </div>

              {#if dataSource.type !== 'snmp-lldp'}
                <div>
                  <label for="url" class="label">URL</label>
                  <input type="url" id="url" class="input" bind:value={formUrl}>
                </div>
              {/if}

              {#if dataSource.type === 'snmp-lldp'}
                <div>
                  <label for="snmpCommunity" class="label">SNMP Community</label>
                  <input
                    type="text"
                    id="snmpCommunity"
                    class="input"
                    placeholder="public"
                    bind:value={formSnmpCommunity}
                  >
                </div>
                <div>
                  <label for="snmpTargets" class="label">Targets</label>
                  <textarea
                    id="snmpTargets"
                    class="input min-h-24 font-mono"
                    placeholder="10.0.0.0/24&#10;192.168.5.1&#10;core-rtr-01.example.net"
                    bind:value={formSnmpTargets}
                  ></textarea>
                  <p class="text-xs text-theme-text-muted mt-1">
                    One per line. CIDR / single IP / hostname all accepted.
                  </p>
                </div>
                <div>
                  <label for="snmpTimeout" class="label">Per-Device Timeout (ms)</label>
                  <input
                    type="number"
                    id="snmpTimeout"
                    class="input"
                    min="500"
                    max="30000"
                    step="500"
                    bind:value={formSnmpTimeoutMs}
                  >
                </div>
              {/if}

              {#if dataSource.type === 'zabbix' || dataSource.type === 'netbox' || dataSource.type === 'grafana'}
                <div>
                  <label for="token" class="label">API Token</label>
                  <input
                    type="password"
                    id="token"
                    class="input"
                    placeholder="Enter new token to update"
                    bind:value={formToken}
                  >
                  <p class="text-xs text-theme-text-muted mt-1">
                    {hasExistingToken ? 'Token is set. Enter a new value to update.' : 'No token set.'}
                  </p>
                </div>
              {/if}

              {#if dataSource.type === 'zabbix'}
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

              {#if dataSource.type === 'netbox'}
                <div class="flex items-center gap-2">
                  <input type="checkbox" id="insecure" bind:checked={formInsecure}>
                  <label for="insecure" class="text-sm">Skip TLS certificate verification</label>
                  <p class="text-xs text-muted-foreground">(for self-signed certificates)</p>
                </div>
              {/if}

              {#if dataSource.type === 'grafana'}
                <div class="pt-2 border-t border-theme-border">
                  <div class="flex items-center justify-between">
                    <div>
                      <p class="text-sm font-medium text-theme-text-emphasis">Webhook Alerts</p>
                      <p class="text-xs text-theme-text-muted mt-0.5">
                        Receive alerts via Grafana Contact Point instead of polling Alertmanager
                        API.
                      </p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={formUseWebhook}
                      aria-label="Toggle webhook alerts"
                      class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors {formUseWebhook ? 'bg-primary' : 'bg-theme-border'}"
                      onclick={() => { formUseWebhook = !formUseWebhook; if (formUseWebhook) loadWebhookUrl(); else webhookUrl = ''; }}
                    >
                      <span
                        class="inline-block h-4 w-4 rounded-full bg-white transition-transform {formUseWebhook ? 'translate-x-6' : 'translate-x-1'}"
                      ></span>
                    </button>
                  </div>

                  {#if formUseWebhook}
                    <div class="mt-3 p-3 rounded-lg bg-theme-bg-canvas border border-theme-border">
                      {#if webhookUrl}
                        <p class="text-xs text-theme-text-muted mb-1.5">
                          Set this URL as a Grafana Contact Point (Webhook type, POST method).
                        </p>
                        <div class="flex items-center gap-2">
                          <input
                            type="text"
                            class="input flex-1 font-mono text-xs"
                            value={webhookUrl}
                            readonly
                          >
                          <button
                            type="button"
                            class="btn btn-secondary p-2"
                            title="Copy to clipboard"
                            onclick={copyWebhookUrl}
                          >
                            {#if copied}
                              <CheckIcon size={16} class="text-success" />
                            {:else}
                              <CopyIcon size={16} />
                            {/if}
                          </button>
                        </div>
                      {:else if webhookLoading}
                        <p class="text-xs text-theme-text-muted">Loading webhook URL...</p>
                      {:else}
                        <p class="text-xs text-theme-text-muted">
                          Click <strong>Save Changes</strong> to generate the Webhook URL.
                        </p>
                      {/if}
                    </div>
                  {/if}
                </div>
              {/if}

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
                <span class="text-theme-text"
                  >{new Date(dataSource.createdAt).toLocaleString()}</span
                >
              </div>
              <div class="flex justify-between">
                <span class="text-theme-text-muted">Updated</span>
                <span class="text-theme-text"
                  >{new Date(dataSource.updatedAt).toLocaleString()}</span
                >
              </div>
            </div>
          </div>
        </div>
      {/if}
    </div>
  {/if}
</div>
