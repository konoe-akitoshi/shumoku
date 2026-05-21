<script lang="ts">
  import {
    ChartLineIcon,
    CubeIcon,
    DatabaseIcon,
    PlusIcon,
    TreeStructureIcon,
  } from 'phosphor-svelte'
  import { onMount } from 'svelte'
  import { api } from '$lib/api'
  import { Button } from '$lib/components/ui/button'
  import * as Dialog from '$lib/components/ui/dialog'
  import { dataSources, dataSourcesError, dataSourcesList, dataSourcesLoading } from '$lib/stores'
  import type { ConnectionResult, DataSource, DataSourcePluginInfo } from '$lib/types'

  let showCreateModal = $state(false)
  let testingId = $state<string | null>(null)
  let testResults = $state<Record<string, ConnectionResult>>({})
  let scanningId = $state<string | null>(null)
  /** Per-source last-scan result for surfacing in the table. */
  let scanResults = $state<
    Record<
      string,
      {
        status: 'ok' | 'partial' | 'failed' | 'empty'
        nodeCount: number
        linkCount: number
        portCount: number
        message?: string
      }
    >
  >({})

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
  let formInsecure = $state(false)
  // Aruba Instant On uses portal account (email + password) instead of URL + token
  let formArubaUsername = $state('')
  let formArubaPassword = $state('')
  let formArubaSiteId = $state('')
  // Network Discovery (snmp-lldp) uses community + seeds, no URL.
  let formSnmpCommunity = $state('public')
  /** Newline- or comma-separated list of seed device addresses. */
  let formSnmpTargets = $state('')
  let formSnmpTimeoutMs = $state(2000)
  let formError = $state('')
  let formSubmitting = $state(false)
  // Dynamic config values for external plugins
  let dynamicConfig = $state<Record<string, string>>({})

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
    formInsecure = false
    formPrometheusPreset = 'snmp'
    formArubaUsername = ''
    formArubaPassword = ''
    formArubaSiteId = ''
    formSnmpCommunity = 'public'
    formSnmpTargets = ''
    formSnmpTimeoutMs = 2000
    // Initialize dynamic config from schema defaults
    dynamicConfig = {}
    if (plugin.configSchema?.properties) {
      for (const [key, prop] of Object.entries(plugin.configSchema.properties)) {
        if (prop.default !== undefined) {
          dynamicConfig[key] = String(prop.default)
        } else {
          dynamicConfig[key] = ''
        }
      }
    }
  }

  function getConfigFromForm(): string {
    if (!selectedPlugin) return '{}'

    // Builtin plugins with hardcoded config
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
        insecure: formInsecure || undefined,
      })
    }

    if (selectedPlugin.type === 'prometheus') {
      return JSON.stringify({
        url: formUrl.trim(),
        preset: formPrometheusPreset,
      })
    }

    if (selectedPlugin.type === 'grafana') {
      return JSON.stringify({
        url: formUrl.trim(),
        token: formToken.trim() || undefined,
      })
    }

    if (selectedPlugin.type === 'aruba-instant-on') {
      return JSON.stringify({
        username: formArubaUsername.trim(),
        password: formArubaPassword,
        siteId: formArubaSiteId.trim() || undefined,
      })
    }

    if (selectedPlugin.type === 'snmp-lldp') {
      // Targets are entered as one per line (or comma-separated). Each
      // entry may be an IP, hostname, or CIDR — the plugin expands CIDR
      // and liveness-probes before the full walk. Community is shared
      // across all targets in v1 (per-target community is a v2 item).
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

    // External plugins with configSchema - use dynamicConfig
    if (selectedPlugin.configSchema?.properties) {
      const config: Record<string, unknown> = {}
      for (const [key, value] of Object.entries(dynamicConfig)) {
        if (value.trim()) {
          config[key] = value.trim()
        }
      }
      return JSON.stringify(config)
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

    // Validation for bundled plugins
    if (['zabbix', 'netbox', 'prometheus', 'grafana'].includes(selectedPlugin.type)) {
      if (!formName.trim() || !formUrl.trim()) {
        formError = 'Name and URL are required'
        return
      }
    } else if (selectedPlugin.type === 'aruba-instant-on') {
      if (!formName.trim() || !formArubaUsername.trim() || !formArubaPassword) {
        formError = 'Name, portal email, and password are required'
        return
      }
    } else if (selectedPlugin.type === 'snmp-lldp') {
      if (!formName.trim() || !formSnmpTargets.trim()) {
        formError = 'Name and at least one target are required'
        return
      }
    } else if (selectedPlugin.configSchema?.properties) {
      // Validation for external plugins with configSchema
      if (!formName.trim()) {
        formError = 'Name is required'
        return
      }
      const required = selectedPlugin.configSchema.required || []
      for (const key of required) {
        if (!dynamicConfig[key]?.trim()) {
          const prop = selectedPlugin.configSchema.properties[key]
          formError = `${prop?.title || key} is required`
          return
        }
      }
    } else {
      if (!formName.trim() || !formUrl.trim()) {
        formError = 'Name and URL are required'
        return
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

  /**
   * Ad-hoc autoscan against a data source. The snapshot is NOT persisted
   * here because no topology context is supplied — this is a "preview"
   * scan used to confirm credentials / network reachability / what the
   * source can actually see. To persist, scan from inside a topology.
   */
  async function handleScan(ds: DataSource) {
    scanningId = ds.id
    try {
      const result = await api.dataSources.scan(ds.id)
      const counts = result.snapshot.graph ?? { nodes: [], links: [] }
      const nodeCount = counts.nodes?.length ?? 0
      const linkCount = counts.links?.length ?? 0
      let portCount = 0
      for (const n of counts.nodes ?? []) {
        portCount += n.ports?.length ?? 0
      }
      scanResults = {
        ...scanResults,
        [ds.id]: {
          status: result.snapshot.status,
          nodeCount,
          linkCount,
          portCount,
          message: result.snapshot.statusMessage,
        },
      }
    } catch (e) {
      scanResults = {
        ...scanResults,
        [ds.id]: {
          status: 'failed',
          nodeCount: 0,
          linkCount: 0,
          portCount: 0,
          message: e instanceof Error ? e.message : 'Scan failed',
        },
      }
    } finally {
      scanningId = null
    }
  }

  /** Does the registered plugin advertise the `autoscan` capability? */
  function hasAutoscan(type: string): boolean {
    return pluginTypeMap[type]?.capabilities?.includes('autoscan') ?? false
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
              {@const config = parseConfig(ds.configJson)}
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
                  {config.url || '-'}
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
                    {#if hasAutoscan(ds.type)}
                      <Button
                        variant="outline"
                        size="sm"
                        onclick={() => handleScan(ds)}
                        disabled={scanningId === ds.id}
                        title="Run an ad-hoc autoscan (preview — not persisted)"
                      >
                        {#if scanningId === ds.id}
                          <span
                            class="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin mr-1"
                          ></span>
                        {/if}
                        Scan
                      </Button>
                    {/if}
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
                  {#each scanResults[ds.id] ? [scanResults[ds.id]] : [] as r (ds.id)}
                    {#if r}
                      <div class="mt-1 text-xs">
                        {#if r.status === 'ok'}
                          <span class="text-theme-text-muted">
                            ✓ {r.nodeCount} nodes / {r.linkCount} links / {r.portCount} ports
                          </span>
                        {:else if r.status === 'partial'}
                          <span class="text-theme-text-muted">
                            ⚠ partial: {r.nodeCount} nodes / {r.linkCount} links
                          </span>
                        {:else if r.status === 'empty'}
                          <span class="text-theme-text-muted">no devices observed</span>
                        {:else}
                          <span class="text-red-500" title={r.message}
                            >✗ {r.message ?? 'failed'}</span
                          >
                        {/if}
                      </div>
                    {/if}
                  {/each}
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
                    {#if plugin.type === 'zabbix'}
                      <ChartLineIcon
                        size={24}
                        class="text-theme-text-muted group-hover:text-primary"
                      />
                    {:else if plugin.type === 'netbox'}
                      <CubeIcon size={24} class="text-theme-text-muted group-hover:text-primary" />
                    {:else if plugin.type === 'prometheus'}
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

        {#if ['zabbix', 'netbox', 'prometheus', 'grafana'].includes(selectedPlugin.type) || (!selectedPlugin.configSchema?.properties && !['aruba-instant-on', 'snmp-lldp'].includes(selectedPlugin.type))}
          <div>
            <label for="url" class="label">URL</label>
            <input
              type="url"
              id="url"
              class="input"
              placeholder="https://example.com"
              bind:value={formUrl}
            >
          </div>
        {/if}

        {#if selectedPlugin.type === 'zabbix' || selectedPlugin.type === 'netbox' || selectedPlugin.type === 'grafana'}
          <div>
            <label for="token" class="label">API Token</label>
            <input
              type="password"
              id="token"
              class="input"
              placeholder="Enter API token"
              bind:value={formToken}
            >
            {#if selectedPlugin.type === 'zabbix'}
              <p class="text-xs text-muted-foreground mt-1">
                Required for API access (Zabbix 5.4+)
              </p>
            {:else if selectedPlugin.type === 'grafana'}
              <p class="text-xs text-muted-foreground mt-1">Service Account Token (Bearer token)</p>
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

        {#if selectedPlugin.type === 'snmp-lldp'}
          <div>
            <label for="snmpCommunity" class="label">SNMP Community</label>
            <input
              type="text"
              id="snmpCommunity"
              class="input"
              placeholder="public"
              bind:value={formSnmpCommunity}
            >
            <p class="text-xs text-muted-foreground mt-1">
              SNMPv2c community string used for every seed.
            </p>
          </div>

          <div>
            <label for="snmpTargets" class="label">Targets</label>
            <textarea
              id="snmpTargets"
              class="input min-h-24 font-mono"
              placeholder="10.0.0.0/24&#10;192.168.5.1&#10;core-rtr-01.example.net"
              bind:value={formSnmpTargets}
            ></textarea>
            <p class="text-xs text-muted-foreground mt-1">
              One per line. Each entry can be a <strong>CIDR block</strong> (e.g. 10.0.0.0/24), a
              single IP, or a hostname. CIDR is expanded and a short SNMP liveness probe runs in
              parallel before the full walk — dead addresses are silently skipped. Up to /16 per
              entry.
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

          <div
            class="rounded border border-theme-border bg-theme-surface p-3 text-xs text-theme-text-muted"
          >
            v1 scope: SNMP only (System-MIB, IF-MIB, ifXTable, LLDP-MIB). CIDR sweep + liveness
            probe is supported. CDP / BRIDGE-MIB / ENTITY-MIB / NETCONF / gNMI / CLI scraping and
            LLDP-neighbor auto-expansion land in v2.
          </div>
        {/if}

        {#if selectedPlugin.type === 'aruba-instant-on'}
          <div>
            <label for="arubaUsername" class="label">Portal Email</label>
            <input
              type="email"
              id="arubaUsername"
              class="input"
              placeholder="account@example.com"
              autocomplete="username"
              bind:value={formArubaUsername}
            >
            <p class="text-xs text-muted-foreground mt-1">
              Aruba Instant On account email. <strong>MFA must be disabled</strong> on this account
              — the (undocumented) API auth flow doesn't support MFA.
            </p>
          </div>

          <div>
            <label for="arubaPassword" class="label">Portal Password</label>
            <input
              type="password"
              id="arubaPassword"
              class="input"
              placeholder="Account password"
              autocomplete="current-password"
              bind:value={formArubaPassword}
            >
          </div>

          <div>
            <label for="arubaSiteId" class="label">Site ID (optional)</label>
            <input
              type="text"
              id="arubaSiteId"
              class="input"
              placeholder="Leave blank for all sites"
              bind:value={formArubaSiteId}
            >
            <p class="text-xs text-muted-foreground mt-1">
              Restrict polling to a single site. Leave empty to include every site the account can
              access.
            </p>
          </div>

          <div class="rounded border border-warning/40 bg-warning/10 p-3 text-xs text-foreground">
            ⚠️ Aruba Instant On API is unofficial / unsupported by HPE. It may stop working without
            notice.
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
            >
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
            >
            <p class="text-xs text-muted-foreground mt-1">Filter devices by tag slug</p>
          </div>

          <div class="flex items-center gap-2">
            <input type="checkbox" id="insecure" bind:checked={formInsecure}>
            <label for="insecure" class="text-sm">Skip TLS certificate verification</label>
            <p class="text-xs text-muted-foreground">(for self-signed certificates)</p>
          </div>
        {/if}

        <!-- Dynamic fields from configSchema (external plugins) -->
        {#if selectedPlugin.configSchema?.properties && !['zabbix', 'netbox', 'prometheus', 'grafana', 'aruba-instant-on'].includes(selectedPlugin.type)}
          {#each Object.entries(selectedPlugin.configSchema.properties) as [ key, prop ]}
            <div>
              <label for="config-{key}" class="label">
                {prop.title || key}
                {#if !selectedPlugin.configSchema.required?.includes(key)}
                  <span class="text-theme-text-muted font-normal">(optional)</span>
                {/if}
              </label>
              {#if prop.enum}
                <select id="config-{key}" class="input" bind:value={dynamicConfig[key]}>
                  {#each prop.enum as option}
                    <option value={option}>{option}</option>
                  {/each}
                </select>
              {:else}
                <input
                  type={prop.format === 'password' ? 'password' : prop.type === 'number' ? 'number' : 'text'}
                  id="config-{key}"
                  class="input"
                  placeholder={prop.description || ''}
                  bind:value={dynamicConfig[key]}
                >
              {/if}
              {#if prop.description}
                <p class="text-xs text-muted-foreground mt-1">{prop.description}</p>
              {/if}
            </div>
          {/each}
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
